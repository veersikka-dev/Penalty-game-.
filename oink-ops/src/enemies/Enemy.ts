import * as THREE from 'three';
import { ENEMIES, type EnemyDef, type EnemyType } from './EnemyDefs';
import { buildEnemyRig, type EnemyRig } from './EnemyModels';
import type { Damageable, DamageInfo, HitShape } from '../combat/types';
import type { CollisionWorld, GroundInfo } from '../physics/Collision';
import type { VFXManager } from '../effects/VFXManager';
import { emoteTexture, type Emote } from '../player/PigAnimator';
import { clamp, damp, rand } from '../utils/MathUtils';

export type AIState = 'idle' | 'patrol' | 'detect' | 'chase' | 'attack' | 'search' | 'retreat' | 'stunned' | 'dead';
export type EnemySound = 'alert' | 'attack' | 'hurt' | 'die' | 'charge' | 'slam' | 'toastPop' | 'bubble' | 'shield' | 'armor' | 'bonk' | 'step';

export interface AIContext {
  time: number;
  world: CollisionWorld;
  playerPos: THREE.Vector3;
  playerAlive: boolean;
  playerGrounded: boolean;
  playerRadius: number;
  enemies: Enemy[];
  vfx: VFXManager;
  damagePlayer(amount: number, from: THREE.Vector3, knock: number): void;
  shoot(kind: 'toast' | 'bubble', from: THREE.Vector3, target: THREE.Vector3, speed: number): void;
  shockwave(pos: THREE.Vector3, radius: number, damage: number): void;
  sfx(s: EnemySound, pos: THREE.Vector3, e: Enemy): void;
  shake(a: number): void;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _g: GroundInfo = { y: 0, box: null };
const WHITE = new THREE.Color(0xffffff);
const ARMOR_HP = 70;

function angDamp(a: number, b: number, l: number, dt: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-l * dt));
}

/**
 * A cartoon enemy with a lightweight finite-state AI:
 * IDLE → PATROL → DETECT → CHASE → ATTACK, plus SEARCH, RETREAT, STUNNED, DEAD.
 * Movement uses feeler-ray obstacle avoidance and stuck recovery; each type
 * adds its own attack pattern and procedural animation.
 */
export class Enemy implements Damageable {
  readonly kind = 'enemy' as const;
  readonly def: EnemyDef;
  readonly rig: EnemyRig;
  alive = true;
  assist = true;
  removed = false;
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  get position() {
    return this.pos;
  }
  yaw = 0;
  hp: number;
  maxHp: number;
  state: AIState = 'idle';
  stateT = 0;
  readonly home = new THREE.Vector3();
  private patrolTarget = new THREE.Vector3();
  readonly lastSeen = new THREE.Vector3();
  private seenAt = -99;
  canSee = false;
  private losT = Math.random() * 0.25;
  private attackCd = 1.5;
  private attackT = -1;
  private attackDir = new THREE.Vector3();
  private attackKind = 0;
  private hitThisAttack = false;
  private stunT = 0;
  trapT = 0;
  private flash = 0;
  private squash = 0;
  private hitReact = 0;
  shieldHP = 0;
  private shieldMesh: THREE.Mesh | null = null;
  private trapMesh: THREE.Mesh | null = null;
  private spawnT = 0;
  private deathT = 0;
  private emote: THREE.Sprite;
  private emoteT = 0;
  private avoidDir = new THREE.Vector3();
  private avoidT = 0;
  private avoidSide = Math.random() < 0.5 ? -1 : 1;
  private stuckT = 0;
  private lastProgress = new THREE.Vector3();
  private strafeSign = Math.random() < 0.5 ? -1 : 1;
  private coverPoint: THREE.Vector3 | null = null;
  private animT = Math.random() * 10;
  private grounded = true;
  armorHP: number[] = [];
  shapes: HitShape[];
  group = '';
  onDeath: ((e: Enemy, info: DamageInfo) => void) | null = null;
  /** Called when the enemy becomes aware of the player (for encounter music etc.). */
  aggro = false;
  highlighted = false;

  constructor(readonly type: EnemyType, x: number, y: number, z: number) {
    this.def = ENEMIES[type];
    this.rig = buildEnemyRig(type);
    this.hp = this.maxHp = this.def.hp;
    this.pos.set(x, y, z);
    this.home.set(x, y, z);
    this.patrolTarget.copy(this.home);
    this.lastProgress.copy(this.pos);
    this.yaw = rand(0, Math.PI * 2);
    this.armorHP = this.rig.armor.map(() => ARMOR_HP);
    this.shapes = [
      { type: 'sphere', c: new THREE.Vector3(), r: this.def.radius * (type === 'boar' ? 1.15 : 1.1) },
      { type: 'sphere', c: new THREE.Vector3(), r: this.def.weakRadius, weak: true },
    ];
    this.rig.armor.forEach((_a, i) => this.shapes.push({ type: 'sphere', c: new THREE.Vector3(), r: i === 0 ? 0.7 : 0.55, id: i }));
    this.emote = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoteTexture('exclaim'), depthTest: false, transparent: true }));
    this.emote.renderOrder = 50;
    this.emote.visible = false;
    this.rig.root.add(this.emote);
    this.rig.root.position.copy(this.pos);
    this.rig.root.scale.setScalar(0.01);
    if (this.def.flying) this.pos.y = y + this.def.hover;
    this.state = 'patrol';
  }

  get chest(): THREE.Vector3 {
    return _v2.set(this.pos.x, this.pos.y + (this.def.flying ? 0 : this.rig.bodyHeight), this.pos.z);
  }
  get isBoss() {
    return this.type === 'boar';
  }

  showEmote(kind: Emote, dur = 1) {
    (this.emote.material as THREE.SpriteMaterial).map = emoteTexture(kind);
    this.emote.visible = true;
    this.emoteT = dur;
  }

  private setState(s: AIState) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
  }

  applyShield(hp: number) {
    this.shieldHP = hp;
    if (!this.shieldMesh) {
      this.shieldMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 20, 14),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fefff).multiplyScalar(1.3), transparent: true, opacity: 0.28, depthWrite: false }),
      );
      this.rig.root.add(this.shieldMesh);
    }
    const s = this.def.radius * 1.9 + 0.2;
    this.shieldMesh.scale.setScalar(s);
    this.shieldMesh.position.y = this.def.flying ? 0 : this.rig.bodyHeight;
    this.shieldMesh.visible = true;
  }

  takeDamage(info: DamageInfo) {
    if (!this.alive) return;
    let amt = info.amount;
    // Bubble shield soaks damage first
    if (this.shieldHP > 0 && info.source !== 'env') {
      this.shieldHP -= amt;
      if (this.shieldHP <= 0 && this.shieldMesh) this.shieldMesh.visible = false;
      this.flash = 0.5;
      return;
    }
    // Trapped in a bubble: the pop does bonus damage
    if (this.trapT > 0 && !info.trap) {
      amt *= 2;
      this.trapT = 0;
    }
    if (info.trap) {
      this.trapT = info.trap * (this.isBoss ? 0.3 : 1);
      this.setState('stunned');
      this.stunT = this.trapT;
    }
    // Boar armour: plates absorb hits until shot off; the battery is the weak point
    if (this.isBoss) {
      const id = info.shape?.id;
      if (id !== undefined && this.armorHP[id] > 0) {
        this.armorHP[id] -= amt;
        this.flash = 0.6;
        if (this.armorHP[id] <= 0) this.breakArmor(id);
        return;
      }
      const backOn = this.armorHP[this.armorHP.length - 1] > 0;
      if (info.weak && backOn) info.weak = false;
      amt *= backOn ? 0.45 : 1;
      if (this.state === 'stunned') amt *= 1.6;
    }
    if (info.weak) amt *= 2.2;
    this.hp -= amt;
    this.flash = 1;
    this.hitReact = 1;
    this.squash = 0.25;
    const kb = info.knockback * (1 - this.def.heft);
    this.vel.x += info.dir.x * kb;
    this.vel.z += info.dir.z * kb;
    if (!this.def.flying) this.vel.y += kb * 0.25;
    if (this.hp <= 0) {
      this.die(info);
      return;
    }
    // Getting shot always makes you aware of the shooter
    if (this.state === 'idle' || this.state === 'patrol' || this.state === 'search') {
      this.lastSeen.copy(info.point).addScaledVector(info.dir, -6);
      this.seenAt = 0;
      this.setState('detect');
    }
  }

  private breakArmor(id: number) {
    const piece = this.rig.armor[id];
    piece.getWorldPosition(_v);
    piece.visible = false;
    this.shapes = this.shapes.filter((s) => s.id !== id);
    this.pendingArmorBreak.push(_v.clone());
  }
  /** Positions where armour just broke (the manager spawns debris + sound). */
  pendingArmorBreak: THREE.Vector3[] = [];

  private die(info: DamageInfo) {
    this.alive = false;
    this.hp = 0;
    this.setState('dead');
    this.deathT = 0;
    this.vel.set(info.dir.x * 5, 6, info.dir.z * 5);
    if (this.shieldMesh) this.shieldMesh.visible = false;
    if (this.trapMesh) this.trapMesh.visible = false;
    this.onDeath?.(this, info);
  }

  setHighlight(on: boolean) {
    this.highlighted = on;
  }

  // ------------------------------------------------------------------ update

  update(dt: number, ctx: AIContext) {
    this.animT += dt;
    this.stateT += dt;
    this.flash = Math.max(0, this.flash - dt * 6);
    this.hitReact = Math.max(0, this.hitReact - dt * 4);
    this.squash = damp(this.squash, 0, 10, dt);
    this.attackCd -= dt;
    if (this.spawnT < 1) this.spawnT = Math.min(1, this.spawnT + dt * 2.6);

    if (this.state === 'dead') {
      this.updateDeath(dt, ctx);
      return;
    }

    // Perception (throttled line-of-sight)
    this.losT -= dt;
    const toPlayer = _dir.subVectors(ctx.playerPos, this.pos);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    if (this.losT <= 0) {
      this.losT = 0.22;
      const eye = _v.set(this.pos.x, this.pos.y + (this.def.flying ? 0 : this.rig.headHeight), this.pos.z);
      const target = new THREE.Vector3(ctx.playerPos.x, ctx.playerPos.y + 1, ctx.playerPos.z);
      const range = this.aggro ? this.def.detect * 1.6 : this.def.detect;
      this.canSee = ctx.playerAlive && dist < range && !ctx.world.blocked(eye, target);
      if (this.canSee) {
        this.lastSeen.copy(ctx.playerPos);
        this.seenAt = ctx.time;
      }
    }

    // Stun (bubble trap, wall bonk)
    if (this.state === 'stunned') {
      this.stunT -= dt;
      this.trapT = Math.max(0, this.trapT - dt);
      if (this.stunT <= 0) {
        this.trapT = 0;
        this.setState('chase');
      }
    } else {
      this.think(dt, ctx, dist);
    }

    this.integrate(dt, ctx);
    this.animate(dt, ctx, dist);
  }

  private think(dt: number, ctx: AIContext, dist: number) {
    const d = this.def;
    switch (this.state) {
      case 'idle':
        this.brake(dt);
        if (this.stateT > 1.5) this.setState('patrol');
        if (this.canSee) this.alert(ctx);
        break;
      case 'patrol': {
        if (this.pos.distanceTo(this.patrolTarget) < 1.2 || this.stateT > 8) {
          this.patrolTarget.set(this.home.x + rand(-6, 6), this.home.y, this.home.z + rand(-6, 6));
          this.stateT = 0;
          if (Math.random() < 0.3) this.setState('idle');
        }
        this.moveTo(this.patrolTarget, d.speed * 0.4, dt, ctx);
        if (this.canSee) this.alert(ctx);
        break;
      }
      case 'detect':
        this.brake(dt);
        this.faceToward(this.lastSeen, dt, 12);
        if (this.stateT > 0.55) this.setState('chase');
        break;
      case 'chase':
        this.chase(dt, ctx, dist);
        break;
      case 'attack':
        this.attack(dt, ctx, dist);
        break;
      case 'search':
        this.moveTo(this.lastSeen, d.speed * 0.6, dt, ctx);
        if (this.pos.distanceTo(this.lastSeen) < 1.5) this.yaw += dt * 1.5;
        if (this.canSee) this.setState('chase');
        else if (this.stateT > 5) {
          this.aggro = false;
          this.setState('patrol');
          this.showEmote('question', 1);
        }
        break;
      case 'retreat':
        if (this.coverPoint) this.moveTo(this.coverPoint, d.speed * 1.2, dt, ctx);
        else this.brake(dt);
        if (this.stateT > 2.8 || (this.coverPoint && this.pos.distanceTo(this.coverPoint) < 1 && this.stateT > 1.6)) {
          this.coverPoint = null;
          this.setState('chase');
        }
        break;
    }
  }

  private alert(ctx: AIContext) {
    this.aggro = true;
    this.setState('detect');
    this.showEmote('exclaim', 0.9);
    ctx.sfx('alert', this.pos, this);
    // wake up nearby friends
    for (const o of ctx.enemies) {
      if (o !== this && o.alive && !o.aggro && o.pos.distanceTo(this.pos) < 12) {
        o.aggro = true;
        o.lastSeen.copy(ctx.playerPos);
        if (o.state === 'idle' || o.state === 'patrol') o.setState('detect');
      }
    }
  }

  private chase(dt: number, ctx: AIContext, dist: number) {
    const d = this.def;
    if (!ctx.playerAlive) {
      this.setState('patrol');
      return;
    }
    if (!this.canSee && ctx.time - this.seenAt > 3) {
      this.setState('search');
      return;
    }
    const target = this.canSee ? ctx.playerPos : this.lastSeen;
    switch (this.type) {
      case 'chicken':
      case 'carrot':
        this.moveTo(target, d.speed, dt, ctx);
        if (this.canSee && dist < d.attackRange && this.attackCd <= 0) this.beginAttack(ctx);
        break;
      case 'toast':
      case 'bubble': {
        // hold a comfortable distance and strafe around the player
        const ideal = this.type === 'toast' ? 11 : 12;
        _v.subVectors(this.pos, ctx.playerPos).setY(0).normalize();
        const side = _v2.set(-_v.z, 0, _v.x).multiplyScalar(this.strafeSign);
        const goal = new THREE.Vector3().copy(ctx.playerPos).addScaledVector(_v, ideal).addScaledVector(side, 4);
        this.moveTo(goal, d.speed, dt, ctx);
        this.faceToward(ctx.playerPos, dt, 8);
        if (this.stateT > 3) {
          this.strafeSign *= -1;
          this.stateT = 0;
        }
        if (this.canSee && dist < d.attackRange + 6 && this.attackCd <= 0) this.beginAttack(ctx);
        // hurt toasters look for cover
        if (this.type === 'toast' && this.hp < this.maxHp * 0.5 && Math.random() < dt * 0.5) this.findCover(ctx);
        break;
      }
      case 'boar':
        this.moveTo(target, d.speed * 0.7, dt, ctx);
        if (this.canSee && this.attackCd <= 0 && dist < 22) this.beginAttack(ctx);
        break;
    }
  }

  private findCover(ctx: AIContext) {
    let best: THREE.Vector3 | null = null;
    let bestD = 14;
    for (const b of ctx.world.boxes) {
      if (!b.enabled || !b.solid || b.max.y - b.min.y < 1.5) continue;
      const cx = (b.min.x + b.max.x) / 2;
      const cz = (b.min.z + b.max.z) / 2;
      const dd = Math.hypot(cx - this.pos.x, cz - this.pos.z);
      if (dd > bestD) continue;
      _v.set(cx - ctx.playerPos.x, 0, cz - ctx.playerPos.z).normalize();
      const half = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2;
      best = new THREE.Vector3(cx + _v.x * (half + 1.4), this.pos.y, cz + _v.z * (half + 1.4));
      bestD = dd;
    }
    if (best) {
      this.coverPoint = best;
      this.setState('retreat');
    }
  }

  private beginAttack(ctx: AIContext) {
    this.setState('attack');
    this.attackT = 0;
    this.hitThisAttack = false;
    this.attackDir.subVectors(ctx.playerPos, this.pos).setY(0).normalize();
    if (this.type === 'boar') {
      this.attackKind = Math.random() < 0.6 ? 0 : 1; // 0 charge, 1 slam
      ctx.sfx(this.attackKind === 0 ? 'charge' : 'attack', this.pos, this);
      if (this.attackKind === 0) this.showEmote('anger', 1.2);
    } else if (this.type === 'toast') {
      ctx.sfx('toastPop', this.pos, this);
    } else {
      ctx.sfx('attack', this.pos, this);
    }
  }

  private attack(dt: number, ctx: AIContext, dist: number) {
    const t = (this.attackT += dt);
    const d = this.def;
    const touch = () => {
      if (this.hitThisAttack) return;
      const reach = d.radius + ctx.playerRadius + 0.25;
      _v.subVectors(ctx.playerPos, this.pos);
      if (Math.hypot(_v.x, _v.z) < reach && Math.abs(_v.y) < d.height) {
        this.hitThisAttack = true;
        ctx.damagePlayer(d.damage, this.pos, this.type === 'boar' ? 14 : 6);
      }
    };
    switch (this.type) {
      case 'chicken': {
        // wind-up, dash, recover
        if (t < 0.5) {
          this.brake(dt);
          this.faceToward(ctx.playerPos, dt, 14);
          this.attackDir.subVectors(ctx.playerPos, this.pos).setY(0).normalize();
        } else if (t < 0.95) {
          this.vel.x = this.attackDir.x * 14;
          this.vel.z = this.attackDir.z * 14;
          touch();
        } else if (t < 1.7) this.brake(dt);
        else this.endAttack(1.4 + Math.random());
        break;
      }
      case 'carrot': {
        if (t < 0.22) {
          this.brake(dt);
          this.faceToward(ctx.playerPos, dt, 16);
        } else if (t < 0.45) {
          if (this.grounded && t - dt < 0.22) this.vel.y = 5;
          this.vel.x = this.attackDir.x * 8;
          this.vel.z = this.attackDir.z * 8;
          touch();
        } else if (t > 0.8) this.endAttack(0.7 + Math.random() * 0.4);
        break;
      }
      case 'toast': {
        this.brake(dt);
        this.faceToward(ctx.playerPos, dt, 10);
        if (t > 0.45 && t - dt <= 0.45) {
          for (const s of [-1, 1]) {
            const from = new THREE.Vector3(this.pos.x + s * 0.2, this.pos.y + 0.4, this.pos.z);
            const aim = new THREE.Vector3(ctx.playerPos.x + rand(-1, 1), ctx.playerPos.y + 0.8, ctx.playerPos.z + rand(-1, 1));
            ctx.shoot('toast', from, aim, 17 + s);
          }
        }
        if (t > 1.0) this.endAttack(2 + Math.random() * 1.2);
        break;
      }
      case 'bubble': {
        this.brake(dt);
        this.faceToward(ctx.playerPos, dt, 8);
        if (t > 0.5 && t - dt <= 0.5) {
          // shield the most valuable unshielded ally nearby, else blow a bubble at the player
          let target: Enemy | null = null;
          for (const o of ctx.enemies) if (o !== this && o.alive && o.shieldHP <= 0 && o.pos.distanceTo(this.pos) < 14 && (!target || o.maxHp > target.maxHp)) target = o;
          if (target) {
            target.applyShield(target.isBoss ? 90 : 40);
            ctx.vfx.tracer(this.pos, target.chest.clone(), 0x9fefff, 0.08, 0.35);
            ctx.sfx('shield', target.pos, this);
          } else {
            ctx.shoot('bubble', this.pos.clone(), new THREE.Vector3(ctx.playerPos.x, ctx.playerPos.y + 1, ctx.playerPos.z), 9);
            ctx.sfx('bubble', this.pos, this);
          }
        }
        if (t > 1.1) this.endAttack(3 + Math.random() * 1.5);
        break;
      }
      case 'boar': {
        if (this.attackKind === 0) {
          // CHARGE: paw the ground, then barrel forward; bonk into walls
          if (t < 0.9) {
            this.brake(dt);
            this.faceToward(ctx.playerPos, dt, 6);
            this.attackDir.subVectors(ctx.playerPos, this.pos).setY(0).normalize();
            if (Math.random() < dt * 8) ctx.vfx.dust(this.pos, 4, 0.8, 0xc8a878);
          } else if (t < 2.7) {
            const v = 16;
            this.vel.x = this.attackDir.x * v;
            this.vel.z = this.attackDir.z * v;
            if (Math.random() < dt * 14) ctx.vfx.dust(this.pos, 3, 0.8, 0xc8a878);
            touch();
            // wall bonk → stunned (the big opening)
            _v.copy(this.pos).setY(this.pos.y + 1);
            const hit = ctx.world.raycast(_v, this.attackDir, d.radius + 0.6, false);
            if (hit) {
              ctx.sfx('bonk', this.pos, this);
              ctx.shake(0.6);
              ctx.vfx.explosion(hit.point, 1.5, 0xc8a878);
              this.vel.set(-this.attackDir.x * 4, 3, -this.attackDir.z * 4);
              this.stunT = 2.8;
              this.showEmote('stars', 2.8);
              this.attackCd = 2;
              this.setState('stunned');
              return;
            }
          } else this.endAttack(1.5);
        } else {
          // SLAM: hop up and crash down with a shockwave
          if (t < 0.4) this.brake(dt);
          else if (t < 0.45 && this.grounded) this.vel.y = 11;
          else if (t > 0.6 && this.grounded && !this.hitThisAttack) {
            this.hitThisAttack = true;
            ctx.sfx('slam', this.pos, this);
            ctx.shockwave(this.pos.clone(), 8, 16);
          }
          if (t > 1.6) this.endAttack(1.8);
        }
        break;
      }
    }
    void dist;
  }

  private endAttack(cd: number) {
    this.attackCd = cd;
    this.attackT = -1;
    this.setState('chase');
  }

  private brake(dt: number) {
    this.vel.x = damp(this.vel.x, 0, 8, dt);
    this.vel.z = damp(this.vel.z, 0, 8, dt);
  }

  private faceToward(p: THREE.Vector3, dt: number, l: number) {
    this.yaw = angDamp(this.yaw, Math.atan2(p.x - this.pos.x, p.z - this.pos.z), l, dt);
  }

  /** Steer toward a point, sliding around obstacles with feeler rays. */
  private moveTo(target: THREE.Vector3, speed: number, dt: number, ctx: AIContext) {
    _dir.subVectors(target, this.pos).setY(0);
    const dist = _dir.length();
    if (dist < 0.3) {
      this.brake(dt);
      return;
    }
    _dir.divideScalar(dist);
    this.avoidT -= dt;
    if (this.avoidT <= 0) {
      this.avoidT = 0.15;
      const eye = _v.set(this.pos.x, this.pos.y + (this.def.flying ? 0 : 0.5), this.pos.z);
      const probe = Math.min(2.4, dist) + this.def.radius;
      let chosen: THREE.Vector3 | null = null;
      for (const a of [0, 0.55, -0.55, 1.1, -1.1, 1.7, -1.7]) {
        const ang = a * this.avoidSide;
        const c = Math.cos(ang), s = Math.sin(ang);
        const dx = _dir.x * c - _dir.z * s;
        const dz = _dir.x * s + _dir.z * c;
        const test = new THREE.Vector3(dx, 0, dz);
        if (!ctx.world.raycast(eye, test, probe, false)) {
          chosen = test;
          break;
        }
      }
      this.avoidDir.copy(chosen ?? _dir.clone().negate());
      // stuck recovery: little progress for a while → flip avoidance side
      this.stuckT += 0.15;
      if (this.stuckT > 1.2) {
        if (this.pos.distanceTo(this.lastProgress) < 0.6) this.avoidSide *= -1;
        this.lastProgress.copy(this.pos);
        this.stuckT = 0;
      }
    }
    // separation from other enemies
    for (const o of ctx.enemies) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const rr = this.def.radius + o.def.radius + 0.3;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        this.avoidDir.x += (dx / d) * (rr - d) * 0.8;
        this.avoidDir.z += (dz / d) * (rr - d) * 0.8;
      }
    }
    const l = Math.hypot(this.avoidDir.x, this.avoidDir.z) || 1;
    const accel = this.def.flying ? 10 : 22;
    this.vel.x += ((this.avoidDir.x / l) * speed - this.vel.x) * Math.min(1, accel * dt * 0.25);
    this.vel.z += ((this.avoidDir.z / l) * speed - this.vel.z) * Math.min(1, accel * dt * 0.25);
    if (this.state !== 'attack' && (this.type !== 'toast' && this.type !== 'bubble')) this.yaw = angDamp(this.yaw, Math.atan2(this.vel.x, this.vel.z), 10, dt);
  }

  private integrate(dt: number, ctx: AIContext) {
    const w = ctx.world;
    const trapped = this.trapT > 0;
    if (this.def.flying || trapped) {
      w.groundAt(this.pos.x, this.pos.z, this.pos.y + 10, _g, 0);
      const baseY = (Number.isFinite(_g.y) ? _g.y : 0) + (trapped && !this.def.flying ? 1.4 : this.def.hover);
      const want = baseY + Math.sin(this.animT * 2.2) * 0.2;
      this.pos.y = damp(this.pos.y, want, 3, dt);
      this.vel.y = 0;
      if (trapped) {
        this.vel.x = damp(this.vel.x, 0, 3, dt);
        this.vel.z = damp(this.vel.z, 0, 3, dt);
      }
    } else {
      this.vel.y -= 25 * dt;
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    const feet = this.pos.y - (this.def.flying || trapped ? 0.6 : 0);
    const tmp = new THREE.Vector3(this.pos.x, feet, this.pos.z);
    w.resolve(tmp, this.def.radius, this.def.height, this.def.flying ? 0.1 : 0.45);
    this.pos.x = tmp.x;
    this.pos.z = tmp.z;
    if (!this.def.flying && !trapped) {
      const prevY = this.pos.y;
      this.pos.y += this.vel.y * dt;
      w.groundAt(this.pos.x, this.pos.z, prevY + 0.45, _g, 0.1);
      if (this.pos.y <= _g.y + 0.02 && this.vel.y <= 0) {
        this.pos.y = Number.isFinite(_g.y) ? _g.y : this.pos.y;
        if (!this.grounded && this.vel.y < -6) this.squash = -0.2;
        this.vel.y = 0;
        this.grounded = true;
        if (_g.box?.delta) this.pos.add(_g.box.delta);
      } else this.grounded = false;
      if (this.pos.y < -15) this.hp = 0;
    }
    if (this.state !== 'attack') {
      this.vel.x = damp(this.vel.x, this.vel.x, 1, dt);
    }
  }

  private updateDeath(dt: number, ctx: AIContext) {
    this.deathT += dt;
    this.vel.y -= 20 * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.rig.root.position.copy(this.pos);
    this.rig.body.rotation.x += dt * 10;
    this.rig.body.rotation.z += dt * 6;
    const s = Math.max(0.01, 1 - Math.max(0, this.deathT - 0.3) * 4);
    this.rig.root.scale.setScalar(s * (1 + Math.sin(this.deathT * 30) * 0.05));
    this.setTint(WHITE, 0.6);
    if (this.deathT > 0.55 && !this.removed) {
      this.removed = true;
      ctx.vfx.poof(this.pos.clone().setY(this.pos.y + this.rig.bodyHeight * 0.8), this.def.color, this.isBoss ? 2.5 : 1);
    }
  }

  private setTint(c: THREE.Color, k: number) {
    for (const m of this.rig.mats) {
      m.emissive.copy(c);
      m.emissiveIntensity = k;
    }
  }

  private animate(dt: number, ctx: AIContext, dist: number) {
    const r = this.rig;
    const p = r.parts;
    const t = this.animT;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const spawn = this.spawnT < 1 ? 1 + Math.sin(this.spawnT * Math.PI) * 0.3 : 1;
    const sq = this.squash;
    const scale = (this.isBoss ? 1 : 1) * spawn * Math.min(1, this.spawnT * 3);
    r.root.scale.set(scale * (1 - sq * 0.5), scale * (1 + sq), scale * (1 - sq * 0.5));
    r.root.position.copy(this.pos);
    r.root.rotation.y = this.yaw;
    const hl = this.highlighted ? 0.18 : 0;
    this.setTint(this.flash > 0 ? WHITE : new THREE.Color(0xff3a3a), this.flash > 0 ? this.flash : hl);
    const walk = Math.min(1, speed / Math.max(1, this.def.speed));
    const stunned = this.state === 'stunned';
    const winding = this.state === 'attack' && this.attackT < 0.5;
    r.body.rotation.set(-this.hitReact * 0.4 + (winding ? 0.25 : 0), 0, stunned ? Math.sin(t * 8) * 0.2 : 0);
    r.body.position.set(0, 0, 0);

    switch (this.type) {
      case 'chicken': {
        const ph = t * (8 + walk * 10);
        (p.legL as THREE.Object3D).rotation.x = Math.sin(ph) * 0.8 * walk;
        (p.legR as THREE.Object3D).rotation.x = -Math.sin(ph) * 0.8 * walk;
        r.body.position.y = Math.abs(Math.sin(ph)) * 0.06 * walk;
        const flap = winding || this.state === 'detect' ? Math.sin(t * 40) * 0.8 : Math.sin(t * 3) * 0.1 + walk * Math.sin(ph) * 0.3;
        p.wingL.rotation.z = -0.2 - Math.abs(flap);
        p.wingR.rotation.z = 0.2 + Math.abs(flap);
        p.head.rotation.x = Math.sin(t * 6) * 0.1 + (winding ? 0.4 : 0);
        p.head.rotation.y = this.state === 'patrol' ? Math.sin(t * 1.4) * 0.6 : 0;
        p.tail.rotation.x = Math.sin(t * 10) * 0.2;
        ((p.bulb as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setScalar(Math.sin(t * 8) > 0 ? 2 : 0.4).multiply(new THREE.Color(1, 0.2, 0.2));
        if (this.state === 'attack' && this.attackT > 0.5 && this.attackT < 0.95) r.body.rotation.x = 0.5;
        break;
      }
      case 'carrot': {
        const ph = t * (10 + walk * 14);
        p.legL.rotation.x = Math.sin(ph) * 1.0 * walk;
        p.legR.rotation.x = -Math.sin(ph) * 1.0 * walk;
        p.armL.rotation.x = -Math.sin(ph) * 0.8 * walk;
        p.armR.rotation.x = Math.sin(ph) * 0.8 * walk;
        r.body.position.y = Math.abs(Math.sin(ph)) * 0.1 * walk;
        r.body.rotation.z += Math.sin(ph) * 0.12 * walk;
        p.leaves.rotation.y += dt * (2 + walk * 10);
        p.leaves.rotation.x = Math.sin(t * 7) * 0.15;
        p.mouth.rotation.z = this.state === 'attack' ? 0 : Math.PI;
        break;
      }
      case 'toast': {
        p.prop.rotation.y += dt * 22;
        r.body.rotation.z = Math.sin(t * 1.7) * 0.08 + (stunned ? Math.sin(t * 8) * 0.25 : 0);
        r.body.rotation.x += -this.vel.z * 0.0;
        const popping = this.state === 'attack' ? Math.sin(Math.min(1, this.attackT / 0.45) * Math.PI * 0.5) : 0;
        p.toastL.position.y = 0.25 + popping * 0.35;
        p.toastR.position.y = 0.25 + popping * 0.35;
        p.toastL.visible = p.toastR.visible = !(this.state === 'attack' && this.attackT > 0.45);
        p.lever.position.y = 0.05 - popping * 0.15;
        const jet = p.jet as THREE.Mesh;
        jet.scale.set(1, 0.8 + Math.sin(t * 30) * 0.2, 1);
        const em = p.eyeMat.userData.mat as THREE.MeshBasicMaterial;
        em.color.set(this.aggro ? 0xff4a4a : 0x6affff).multiplyScalar(2);
        break;
      }
      case 'bubble': {
        p.core.rotation.y = Math.sin(t * 1.3) * 0.6;
        p.core.position.y = 0.05 + Math.sin(t * 3) * 0.04;
        p.wand.rotation.z = this.state === 'attack' ? -1.2 + Math.sin(this.attackT * 10) * 0.3 : Math.sin(t * 2) * 0.3;
        r.body.rotation.z = Math.sin(t * 1.2) * 0.1;
        break;
      }
      case 'boar': {
        const ph = t * (4 + walk * 6);
        const charging = this.state === 'attack' && this.attackKind === 0 && this.attackT > 0.9;
        for (const [k, sgn] of [['legLF', 1], ['legRB', 1], ['legRF', -1], ['legLB', -1]] as const) {
          p[k].rotation.x = Math.sin(ph) * 0.6 * walk * sgn;
        }
        r.body.position.y = Math.abs(Math.sin(ph)) * 0.12 * walk;
        p.head.rotation.x = charging ? 0.35 : winding ? Math.sin(t * 14) * 0.2 : Math.sin(t * 2) * 0.05;
        if (this.state === 'attack' && this.attackKind === 0 && this.attackT < 0.9) p.legRF.rotation.x = Math.sin(t * 16) * 0.7; // pawing
        const bat = p.battery as THREE.Mesh;
        (bat.material as THREE.MeshBasicMaterial).color.setRGB(0.4, 2, 2).multiplyScalar(0.8 + Math.sin(t * 6) * 0.3);
        break;
      }
    }

    // emote bubble
    if (this.emoteT > 0) {
      this.emoteT -= dt;
      const k = Math.min(1, this.emoteT * 4);
      const s = (this.isBoss ? 1.3 : 0.7) * Math.min(1, k * 2);
      this.emote.scale.set(s, s, s);
      this.emote.position.y = this.def.flying ? 0.9 : this.def.height + 0.35 + Math.sin(t * 4) * 0.05;
      if (this.emoteT <= 0) this.emote.visible = false;
    }
    if (this.shieldMesh?.visible) this.shieldMesh.rotation.y += dt;
    // bubble trap visual
    if (this.trapT > 0) {
      if (!this.trapMesh) {
        this.trapMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbff6ff).multiplyScalar(1.2), transparent: true, opacity: 0.35, depthWrite: false }));
        this.rig.root.add(this.trapMesh);
      }
      this.trapMesh.visible = true;
      this.trapMesh.scale.setScalar(this.def.radius * 2.2 + Math.sin(t * 6) * 0.05);
      this.trapMesh.position.y = this.def.flying ? 0 : this.rig.bodyHeight;
    } else if (this.trapMesh) this.trapMesh.visible = false;

    // update hit shapes
    this.shapes[0].c.set(this.pos.x, this.pos.y + (this.def.flying ? 0 : this.rig.bodyHeight), this.pos.z);
    const weak = this.shapes[1];
    if (this.type === 'boar') {
      (p.battery as THREE.Object3D).getWorldPosition(weak.c);
    } else if (this.type === 'toast' || this.type === 'bubble') {
      weak.c.set(this.pos.x, this.pos.y + (this.type === 'toast' ? 0.36 : 0.05), this.pos.z);
    } else {
      weak.c.set(this.pos.x + Math.sin(this.yaw) * 0.15, this.pos.y + r.headHeight, this.pos.z + Math.cos(this.yaw) * 0.15);
    }
    for (const s of this.shapes) if (s.id !== undefined) this.rig.armor[s.id].getWorldPosition(s.c);
    void dist;
    void clamp;
  }
}
