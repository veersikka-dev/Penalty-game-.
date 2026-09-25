import * as THREE from 'three';
import type { ParticleSystem } from '../destruction/ParticleSystem';
import type { TargetManager } from '../targets/TargetManager';
import type { Target } from '../targets/Target';
import type { ThemeDef } from '../world/themes/Theme';
import { glowTexture } from '../utils/textures';

export interface Projectile {
  mesh: THREE.Mesh;
  halo: THREE.Sprite;
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  vel: THREE.Vector3;
  alive: boolean;
  age: number;
  bounces: number;
  /** Once a projectile ricochets off an intact object it can no longer damage anything. */
  spent: boolean;
  hits: Set<Target>;
  kills: number;
  pierceLeft: number;
  origin: THREE.Vector3;
}

export type HitResponse = 'pierce' | 'stop' | 'ricochet';

export interface ShotCallbacks {
  onHit(p: Projectile, target: Target, point: THREE.Vector3): HitResponse;
  onExpire(p: Projectile): void;
  onBounce(p: Projectile): void;
}

const _seg = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _col = new THREE.Color();

/**
 * Fires glowing energy orbs with a slight ballistic arc. Swept collision against
 * targets each substep, floor/wall bounces, particle trails and a light on the newest orb.
 */
export class ShootingSystem {
  readonly root = new THREE.Group();
  private projectiles: Projectile[] = [];
  readonly light: THREE.PointLight;
  speed = 82;
  gravity = 9;
  radius = 0.18;
  cooldown = 0;
  fireInterval = 0.14;
  trailColor = new THREE.Color(0x9fe8ff);

  constructor(private particles: ParticleSystem) {
    const geo = new THREE.SphereGeometry(0.17, 16, 12);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.2, 2.6) });
    const haloMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0x9fe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 });
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      const halo = new THREE.Sprite(haloMat);
      halo.scale.setScalar(1.3);
      mesh.add(halo);
      mesh.visible = false;
      this.root.add(mesh);
      this.projectiles.push({ mesh, halo, pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), alive: false, age: 0, bounces: 0, spent: false, hits: new Set(), kills: 0, pierceLeft: 3, origin: new THREE.Vector3() });
    }
    this.light = new THREE.PointLight(0x9fe8ff, 0, 18, 2);
    this.root.add(this.light);
  }

  get inFlight() {
    let n = 0;
    for (const p of this.projectiles) if (p.alive) n++;
    return n;
  }

  setColor(c: THREE.ColorRepresentation) {
    this.trailColor.set(c);
    (this.projectiles[0].halo.material as THREE.SpriteMaterial).color.set(c);
    this.light.color.set(c);
  }

  fire(origin: THREE.Vector3, dir: THREE.Vector3, carry: THREE.Vector3): Projectile | null {
    if (this.cooldown > 0) return null;
    const p = this.projectiles.find((q) => !q.alive) ?? this.projectiles.reduce((a, b) => (a.age > b.age ? a : b));
    if (p.alive) this.expire(p, null);
    this.cooldown = this.fireInterval;
    p.alive = true;
    p.age = 0;
    p.bounces = 0;
    p.spent = false;
    p.kills = 0;
    p.pierceLeft = 3;
    p.hits.clear();
    p.pos.copy(origin);
    p.prev.copy(origin);
    p.origin.copy(origin);
    p.vel.copy(dir).multiplyScalar(this.speed).add(carry);
    p.mesh.visible = true;
    p.mesh.position.copy(origin);
    return p;
  }

  private expire(p: Projectile, cb: ShotCallbacks | null) {
    p.alive = false;
    p.mesh.visible = false;
    cb?.onExpire(p);
  }

  update(dt: number, targets: TargetManager, theme: ThemeDef, cam: THREE.Vector3, cb: ShotCallbacks) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    let newest: Projectile | null = null;
    const steps = 3;
    const h = dt / steps;
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.age += dt;
      for (let s = 0; s < steps && p.alive; s++) {
        p.prev.copy(p.pos);
        p.vel.y -= this.gravity * h;
        p.pos.addScaledVector(p.vel, h);
        if (!p.spent) {
          const hit = targets.raycast(p.prev, p.pos, this.radius, p.hits);
          if (hit) {
            p.hits.add(hit.target);
            const res = cb.onHit(p, hit.target, hit.point);
            if (res === 'stop') {
              p.pos.copy(hit.point);
              this.expire(p, cb);
              break;
            } else if (res === 'ricochet') {
              p.pos.copy(hit.point);
              p.vel.multiplyScalar(-0.3);
              p.vel.y += 3;
              p.spent = true;
            } else {
              p.vel.multiplyScalar(0.85);
              if (--p.pierceLeft <= 0) p.spent = true;
            }
          }
        }
        // Floor
        const fy = theme.floorY;
        if (fy !== null && p.pos.y < fy + this.radius) {
          p.pos.y = fy + this.radius;
          p.vel.y = Math.abs(p.vel.y) * 0.45;
          p.vel.x *= 0.8;
          p.vel.z *= 0.8;
          p.bounces++;
          cb.onBounce(p);
        }
        // Walls / tunnel
        if (!theme.inside(p.pos.x, p.pos.y)) {
          if (theme.id === 'core') {
            _tmp.set(p.pos.x, p.pos.y - 2.5, 0).normalize();
            const vn = p.vel.x * _tmp.x + p.vel.y * _tmp.y;
            p.vel.x -= 1.6 * vn * _tmp.x;
            p.vel.y -= 1.6 * vn * _tmp.y;
            p.pos.copy(p.prev);
          } else if (Math.abs(p.pos.x) > 1) {
            p.vel.x = -p.vel.x * 0.6;
            p.pos.x = p.prev.x;
          } else {
            p.vel.y = -Math.abs(p.vel.y) * 0.5;
            p.pos.y = p.prev.y;
          }
          p.bounces++;
          cb.onBounce(p);
        }
      }
      if (!p.alive) continue;
      p.mesh.position.copy(p.pos);
      // Trail: particles spaced along this frame's travel
      _seg.subVectors(p.pos, p.prev);
      const n = 4;
      const c = _col.copy(this.trailColor).multiplyScalar(p.spent ? 0.6 : 1.4);
      for (let i = 0; i < n; i++) {
        const k = i / n;
        this.particles.emit({
          x: p.pos.x - _seg.x * k * steps, y: p.pos.y - _seg.y * k * steps, z: p.pos.z - _seg.z * k * steps,
          vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, vz: (Math.random() - 0.5) * 0.4,
          r: c.r, g: c.g, b: c.b, size: 0.3, life: 0.28, drag: 0, grow: 0,
        });
      }
      const far = p.pos.z < cam.z - 170 || p.pos.z > cam.z + 10 || p.pos.y < -30;
      if (p.age > 3.2 || p.bounces > 3 || far) this.expire(p, cb);
      else if (!newest || p.age < newest.age) newest = p;
    }
    if (newest) {
      this.light.position.copy(newest.pos);
      this.light.intensity = 14;
    } else this.light.intensity = 0;
  }

  clear() {
    for (const p of this.projectiles) {
      p.alive = false;
      p.mesh.visible = false;
    }
    this.light.intensity = 0;
  }
}
