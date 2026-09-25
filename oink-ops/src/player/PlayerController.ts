import * as THREE from 'three';
import { PigModel } from './PigModel';
import { PigAnimator } from './PigAnimator';
import type { ThirdPersonCamera } from './ThirdPersonCamera';
import type { CollisionWorld, GroundInfo } from '../physics/Collision';
import type { PowerUpId } from '../combat/types';
import { clamp, damp } from '../utils/MathUtils';

export interface PlayerInput {
  move: { x: number; y: number };
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  dodge: boolean;
  aim: boolean;
  firing: boolean;
}

export interface PlayerEvents {
  onJump(): void;
  onLand(speed: number): void;
  onStep(): void;
  onHurt(amount: number): void;
  onDeath(): void;
  onDodge(): void;
  onShieldBreak(): void;
}

export interface PlayerStats {
  maxHealth: number;
  damageMult: number;
  moveMult: number;
}

export const POWERUP_DURATION: Record<PowerUpId, number> = { golden: 8, turbo: 10, rage: 10, shield: 20, giant: 10 };

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _g: GroundInfo = { y: 0, box: null };
const GOLD = new THREE.Color(0xffc93a);
const RED = new THREE.Color(0xff3a3a);
const WHITE = new THREE.Color(0xffffff);

function angleDamp(a: number, b: number, lambda: number, dt: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

/**
 * Trotter's movement and state: camera-relative acceleration, sprint, crouch,
 * coyote-time jumps with input buffering, dodge roll with i-frames, moving
 * platforms, health/regen, and power-ups.
 */
export class PlayerController {
  readonly model = new PigModel();
  readonly anim = new PigAnimator(this.model);
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  yaw = 0;
  grounded = true;
  private groundBox: GroundInfo['box'] = null;
  radius = 0.42;
  height = 1.5;
  health = 100;
  stats: PlayerStats = { maxHealth: 100, damageMult: 1, moveMult: 1 };
  alive = true;
  private invulnT = 0;
  private hurtFlash = 0;
  private lastHurt = -99;
  private dodgeT = -1;
  private dodgeCd = 0;
  private dodgeDir = new THREE.Vector3();
  private coyote = 0;
  private jumpBuffer = 0;
  private stepAcc = 0;
  private airTime = 0;
  private faceShootT = 0;
  crouching = false;
  sprinting = false;
  aiming = false;
  readonly powerups = new Map<PowerUpId, number>();
  shieldHP = 0;
  private giantScale = 1;
  private shield: THREE.Mesh;
  private time = 0;
  godMode = false;
  noDamageTime = 0;

  constructor(private events: PlayerEvents) {
    const shieldMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x7fe0ff) } },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
        void main() {
          float f = pow(1.0 - abs(dot(vN, vV)), 2.5);
          float band = smoothstep(0.9, 1.0, sin(vN.y * 18.0 + uTime * 4.0)) * 0.3;
          gl_FragColor = vec4(uColor * 1.4, f * 0.85 + band + 0.05);
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(1.05, 28, 20), shieldMat);
    this.shield.position.y = 0.8;
    this.shield.visible = false;
    this.model.root.add(this.shield);
  }

  get scale() {
    return this.giantScale;
  }
  get isInvulnerable() {
    return this.godMode || this.invulnT > 0 || this.powerups.has('golden') || this.dodgeT >= 0;
  }
  get damageMult() {
    return this.stats.damageMult * (this.powerups.has('giant') ? 2 : 1);
  }
  get fireRateMult() {
    return this.powerups.has('rage') ? 2.4 : 1;
  }

  spawn(x: number, y: number, z: number, yaw: number) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.alive = true;
    this.health = this.stats.maxHealth;
    this.invulnT = 1.5;
    this.anim.setDead(false);
    this.model.root.position.copy(this.pos);
    this.grounded = true;
  }

  applyPowerUp(id: PowerUpId) {
    this.powerups.set(id, POWERUP_DURATION[id]);
    if (id === 'shield') this.shieldHP = 60;
    if (id === 'golden') this.health = this.stats.maxHealth;
  }

  heal(n: number) {
    this.health = Math.min(this.stats.maxHealth, this.health + n);
  }

  /** Returns the damage actually applied. */
  damage(amount: number, from: THREE.Vector3 | null): number {
    if (!this.alive || this.isInvulnerable) return 0;
    if (this.shieldHP > 0) {
      this.shieldHP -= amount;
      this.hurtFlash = 0.3;
      if (this.shieldHP <= 0) {
        this.powerups.delete('shield');
        this.events.onShieldBreak();
      }
      return 0;
    }
    this.health -= amount;
    this.lastHurt = this.time;
    this.noDamageTime = 0;
    this.invulnT = 0.45;
    this.hurtFlash = 1;
    let side = 1;
    if (from) {
      const dx = from.x - this.pos.x;
      const dz = from.z - this.pos.z;
      side = Math.sign(Math.sin(Math.atan2(dx, dz) - this.yaw)) || 1;
      this.vel.x -= (dx / (Math.hypot(dx, dz) || 1)) * 4;
      this.vel.z -= (dz / (Math.hypot(dx, dz) || 1)) * 4;
    }
    this.anim.hit(side);
    this.events.onHurt(amount);
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.anim.setDead(true);
      this.events.onDeath();
    }
    return amount;
  }

  update(dt: number, input: PlayerInput, cam: ThirdPersonCamera, world: CollisionWorld) {
    this.time += dt;
    this.noDamageTime += dt;
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.faceShootT = Math.max(0, this.faceShootT - dt);
    if (input.firing) this.faceShootT = 0.7;

    // Power-up timers
    for (const [id, t] of this.powerups) {
      const nt = t - dt;
      if (nt <= 0) this.powerups.delete(id);
      else this.powerups.set(id, nt);
    }
    if (!this.powerups.has('shield')) this.shieldHP = 0;
    this.giantScale = damp(this.giantScale, this.powerups.has('giant') ? 1.6 : 1, 6, dt);
    this.model.root.scale.setScalar(this.giantScale);
    this.shield.visible = this.shieldHP > 0;
    (this.shield.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;

    // Health regen after a quiet period (not punishing)
    if (this.alive && this.time - this.lastHurt > 4 && this.health < this.stats.maxHealth) this.health = Math.min(this.stats.maxHealth, this.health + 12 * dt);

    // Tint: hurt flash > golden > rage
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 5);
    if (this.hurtFlash > 0) this.model.setTint(this.shieldHP > 0 ? new THREE.Color(0x7fe0ff) : WHITE, this.hurtFlash * 0.9);
    else if (this.powerups.has('golden')) this.model.setTint(GOLD, 0.45 + Math.sin(this.time * 10) * 0.2);
    else if (this.powerups.has('rage')) this.model.setTint(RED, 0.25 + Math.sin(this.time * 14) * 0.1);
    else this.model.setTint(WHITE, this.invulnT > 0 && Math.sin(this.time * 40) > 0 ? 0.25 : 0);

    if (!this.alive) {
      this.vel.x = damp(this.vel.x, 0, 4, dt);
      this.vel.z = damp(this.vel.z, 0, 4, dt);
      this.integrate(dt, world);
      this.animate(dt, input, cam, 0);
      return;
    }

    // ---- movement intent
    cam.basis(_fwd, _right);
    _wish.set(0, 0, 0).addScaledVector(_fwd, input.move.y).addScaledVector(_right, input.move.x);
    const moving = _wish.lengthSq() > 0.01;
    if (moving) _wish.normalize();
    this.aiming = input.aim;
    this.crouching = input.crouch && this.grounded && !input.sprint;
    this.sprinting = input.sprint && moving && input.move.y > 0.2 && !this.aiming && !this.crouching;
    const turbo = this.powerups.has('turbo') ? 1.6 : 1;
    const base = this.crouching ? 2.6 : this.aiming ? 3.9 : this.sprinting ? 8.8 : 5.6;
    const maxSpeed = base * turbo * this.stats.moveMult * (0.85 + this.giantScale * 0.15);

    // ---- dodge roll
    if (input.dodge && this.dodgeCd <= 0 && this.grounded) {
      this.dodgeT = 0;
      this.dodgeCd = 0.75;
      this.dodgeDir.copy(moving ? _wish : _fwd);
      this.anim.dodge(0.42);
      this.anim.poke();
      this.events.onDodge();
    }
    if (this.dodgeT >= 0) {
      this.dodgeT += dt;
      const k = 1 - this.dodgeT / 0.42;
      this.vel.x = this.dodgeDir.x * 13 * Math.max(0.3, k);
      this.vel.z = this.dodgeDir.z * 13 * Math.max(0.3, k);
      if (this.dodgeT >= 0.42) this.dodgeT = -1;
    } else {
      const accel = this.grounded ? (moving ? 42 : 30) : 12;
      const tx = _wish.x * maxSpeed * (moving ? 1 : 0);
      const tz = _wish.z * maxSpeed * (moving ? 1 : 0);
      const dvx = tx - this.vel.x;
      const dvz = tz - this.vel.z;
      const dl = Math.hypot(dvx, dvz);
      const step = Math.min(dl, accel * dt);
      if (dl > 1e-5) {
        this.vel.x += (dvx / dl) * step;
        this.vel.z += (dvz / dl) * step;
      }
    }

    // ---- jump (coyote time + buffer)
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = input.jump ? 0.15 : Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0 && this.dodgeT < 0) {
      this.vel.y = 9.2 + (this.giantScale - 1) * 2;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.groundBox = null;
      this.anim.jump();
      this.anim.poke();
      this.events.onJump();
    }

    this.integrate(dt, world);

    // ---- facing: toward the camera while aiming/shooting, else toward movement
    const wantYaw = this.aiming || this.faceShootT > 0 ? cam.yaw : moving || this.dodgeT >= 0 ? Math.atan2(this.vel.x, this.vel.z) : this.yaw;
    this.yaw = angleDamp(this.yaw, wantYaw, this.aiming || this.faceShootT > 0 ? 20 : 11, dt);
    this.model.root.rotation.y = this.yaw;

    // footsteps
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && hs > 0.8) {
      this.stepAcc += hs * dt;
      const stride = this.sprinting ? 1.5 : 1.05;
      if (this.stepAcc > stride) {
        this.stepAcc = 0;
        this.events.onStep();
      }
    }
    if (moving || input.firing || input.aim || input.jump) this.anim.poke();
    this.animate(dt, input, cam, hs);
  }

  private integrate(dt: number, world: CollisionWorld) {
    // ride moving platforms
    if (this.grounded && this.groundBox?.delta) this.pos.add(this.groundBox.delta);
    this.vel.y -= 25 * dt;
    if (this.vel.y < -40) this.vel.y = -40;
    const steps = 2;
    const h = dt / steps;
    const wasGrounded = this.grounded;
    const r = this.radius * this.giantScale;
    for (let s = 0; s < steps; s++) {
      this.pos.x += this.vel.x * h;
      this.pos.z += this.vel.z * h;
      world.resolve(this.pos, r, this.height * this.giantScale, 0.45);
      const prevY = this.pos.y;
      this.pos.y += this.vel.y * h;
      // head bump
      if (this.vel.y > 0) {
        const ceil = world.ceilingAt(this.pos.x, this.pos.z, prevY + this.height * this.giantScale - 0.05, r);
        if (this.pos.y + this.height * this.giantScale > ceil) {
          this.pos.y = ceil - this.height * this.giantScale;
          this.vel.y = 0;
        }
      }
      const snap = wasGrounded && this.vel.y <= 0 ? 0.45 : 0.05;
      world.groundAt(this.pos.x, this.pos.z, prevY + 0.45, _g, r * 0.35);
      if (this.vel.y <= 0 && this.pos.y <= _g.y + snap && this.pos.y >= _g.y - 1.2) {
        const impact = -this.vel.y;
        this.pos.y = _g.y;
        this.vel.y = 0;
        if (!this.grounded) {
          this.grounded = true;
          if (this.airTime > 0.12) {
            this.anim.land(impact);
            this.events.onLand(impact);
          }
        }
        this.groundBox = _g.box;
      } else if (this.pos.y > _g.y + snap) {
        this.grounded = false;
        this.groundBox = null;
      }
    }
    this.airTime = this.grounded ? 0 : this.airTime + dt;
    this.model.root.position.copy(this.pos);
  }

  private animate(dt: number, input: PlayerInput, cam: ThirdPersonCamera, speed: number) {
    let aimYaw = cam.yaw - this.yaw;
    while (aimYaw > Math.PI) aimYaw -= Math.PI * 2;
    while (aimYaw < -Math.PI) aimYaw += Math.PI * 2;
    const localStrafe = Math.sin(Math.atan2(this.vel.x, this.vel.z) - this.yaw) * clamp(speed / 5, 0, 1);
    this.anim.update({
      dt,
      time: this.time,
      speed,
      sprint: this.sprinting,
      grounded: this.grounded,
      vy: this.vel.y,
      aim: this.aiming && this.alive ? 1 : 0,
      crouch: this.crouching,
      aimPitch: cam.pitch,
      aimYaw,
      strafe: localStrafe,
    });
  }
}
