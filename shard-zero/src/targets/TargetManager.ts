import * as THREE from 'three';
import type { SpawnEvent } from '../data/types';
import { Target } from './Target';
import { TargetFactory } from './TargetFactory';

export interface RayHit {
  target: Target;
  t: number;
  point: THREE.Vector3;
}

export interface TargetHooks {
  /** Called the instant a target is destroyed (scoring, specials). */
  onDestroyed(t: Target): void;
  /** Called after the crack animation, when the object physically shatters. */
  onShatter(t: Target): void;
  /** An obstacle reached the player intact. */
  onCrash(t: Target): void;
}

const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _d = new THREE.Vector3();
const _f = new THREE.Vector3();
const _qi = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _box = new THREE.Box3();
const _v = new THREE.Vector3();

/** Spawns, animates, collides and despawns every destructible object. */
export class TargetManager {
  readonly targets: Target[] = [];
  readonly root = new THREE.Group();
  private scheduled: { t: Target; at: number; point: THREE.Vector3; dir: THREE.Vector3 }[] = [];
  private clock = 0;
  /** Player collision box half-size around the camera. */
  playerHalf = { x: 0.65, yUp: 0.5, yDown: 0.95 };

  constructor(readonly factory: TargetFactory, private hooks: TargetHooks) {}

  spawn(ev: SpawnEvent, z: number, glassColor: number): Target {
    const t = this.factory.acquire(ev.kind);
    this.factory.configure(t, ev, z, glassColor);
    this.root.add(t.root);
    this.targets.push(t);
    this.refreshCollider(t);
    return t;
  }

  get aliveCount() {
    let n = 0;
    for (const t of this.targets) if (t.alive) n++;
    return n;
  }

  clear() {
    for (const t of this.targets) this.factory.release(t);
    this.targets.length = 0;
    this.scheduled.length = 0;
  }

  private refreshCollider(t: Target) {
    t.root.updateMatrixWorld(true);
    if (t.def.shape === 'box') {
      t.body.matrixWorld.decompose(t.center, t.quat, _scale);
      t.half.set(_scale.x * 0.5, _scale.y * 0.5, _scale.z * 0.5);
    } else {
      t.body.getWorldPosition(t.center);
      t.radius = t.def.radius * t.root.scale.x;
    }
  }

  private applyMotion(t: Target, dt: number) {
    const m = t.motion;
    const a = t.age;
    const p = t.root.position;
    switch (m.type) {
      case 'static':
      case 'spin':
        p.copy(t.base);
        break;
      case 'sway': {
        const off = Math.sin(a * m.freq * Math.PI * 2 + (m.phase ?? 0)) * m.amp;
        p.copy(t.base);
        if (m.axis === 'x') p.x += off;
        else p.y += off;
        break;
      }
      case 'orbit': {
        const ang = (m.phase ?? 0) + a * m.speed;
        p.set(t.base.x + Math.cos(ang) * m.radius, t.base.y + Math.sin(ang) * m.radius, t.base.z);
        break;
      }
      case 'approach':
        t.base.z += m.speed * dt;
        p.copy(t.base);
        break;
      case 'drift':
        t.base.x += m.vx * dt;
        t.base.y += m.vy * dt;
        p.copy(t.base);
        break;
      case 'pendulum': {
        const th = Math.sin(a * m.freq * Math.PI * 2 + (m.phase ?? 0)) * m.amp;
        p.copy(t.base);
        if (t.kind === 'hanging') {
          t.root.rotation.z = th;
        } else {
          p.x += Math.sin(th) * m.length;
          p.y += m.length - Math.cos(th) * m.length;
        }
        break;
      }
    }
  }

  update(dt: number, cam: THREE.Vector3) {
    this.clock += dt;
    // Delayed chain-reaction kills
    for (let i = this.scheduled.length - 1; i >= 0; i--) {
      const s = this.scheduled[i];
      if (this.clock >= s.at) {
        this.scheduled.splice(i, 1);
        if (s.t.alive) this.kill(s.t, s.point, s.dir, 'explosion');
      }
    }

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      t.age += dt;
      if (t.alive) {
        this.applyMotion(t, dt);
        t.custom?.(t, dt);
        if (t.tag === 'discard') {
          this.remove(i);
          continue;
        }
      }
      this.animate(t, dt);
      this.refreshCollider(t);

      if (t.dying >= 0) {
        t.dying -= dt;
        if (t.dying < 0) {
          this.hooks.onShatter(t);
          this.remove(i);
        }
        continue;
      }
      if (!t.alive) continue;

      // Obstacle reaching the player's plane
      if (t.def.obstacle && !t.passed) {
        const front = t.def.shape === 'box' ? t.center.z - t.half.z : t.center.z - t.radius;
        if (front > cam.z - 0.4) {
          t.passed = true;
          if (this.overlapsPlayer(t, cam)) {
            t.cause = 'crash';
            t.hitPoint.copy(t.center);
            t.hitDir.set(0, 0, 1);
            this.hooks.onCrash(t);
            this.kill(t, t.center, t.hitDir, 'crash');
            continue;
          }
        }
      }
      // Despawn once well behind the camera
      if (t.center.z > cam.z + 8) {
        this.factory.release(t);
        this.targets.splice(i, 1);
      }
    }
  }

  private overlapsPlayer(t: Target, cam: THREE.Vector3): boolean {
    const ph = this.playerHalf;
    if (t.def.shape === 'sphere') {
      const dx = Math.max(0, Math.abs(t.center.x - cam.x) - ph.x);
      const dy = t.center.y > cam.y ? Math.max(0, t.center.y - cam.y - ph.yUp) : Math.max(0, cam.y - t.center.y - ph.yDown);
      return dx * dx + dy * dy < t.radius * t.radius;
    }
    _box.setFromObject(t.body);
    return _box.max.x > cam.x - ph.x && _box.min.x < cam.x + ph.x && _box.max.y > cam.y - ph.yDown && _box.min.y < cam.y + ph.yUp;
  }

  private animate(t: Target, dt: number) {
    t.flash = Math.max(0, t.flash - dt * 5);
    const a = t.age;
    if (t.glassMat) {
      const u = t.glassMat.uniforms;
      if (t.dying >= 0) t.crackTarget = 1;
      t.crack += (t.crackTarget - t.crack) * Math.min(1, dt * 30);
      u.uCrack.value = t.crack;
      u.uFlash.value = t.flash * 0.6;
      u.uTime.value = a;
    }
    if (t.crystalMat) {
      const base = t.kind === 'weakpoint' || t.kind === 'bossOrb' ? 3 : 1.3;
      const swell = t.dying >= 0 ? 6 : 0;
      t.crystalMat.emissiveIntensity = base + t.flash * 4 + swell + (t.kind === 'explosive' ? Math.sin(a * 10) * 0.8 : 0);
      t.body.rotation.y += dt * t.spin * (t.motion.type === 'spin' ? t.motion.speed : 1);
      if (t.kind !== 'weakpoint' && t.kind !== 'bossOrb') t.body.position.y = Math.sin(a * 1.8 + t.phase) * 0.12;
      if (t.dying >= 0) t.root.scale.multiplyScalar(1 + dt * 4);
    }
    if (t.extra) {
      t.extra.rotation.x += dt * 0.9;
      t.extra.rotation.y += dt * 1.3;
    }
    if (t.halo) {
      const m = t.halo.material as THREE.SpriteMaterial;
      m.opacity = 0.45 + Math.sin(a * 3 + t.phase) * 0.12 + t.flash * 0.5;
    }
  }

  private remove(i: number) {
    const t = this.targets[i];
    this.factory.release(t);
    this.targets.splice(i, 1);
  }

  /**
   * Swept-sphere test of a projectile segment against all live targets.
   * Returns the earliest hit so fast projectiles never tunnel through thin glass.
   */
  raycast(a: THREE.Vector3, b: THREE.Vector3, radius: number, ignore?: Set<Target>): RayHit | null {
    let best: RayHit | null = null;
    let bestT = Infinity;
    const minZ = Math.min(a.z, b.z) - 6;
    const maxZ = Math.max(a.z, b.z) + 6;
    for (const t of this.targets) {
      if (!t.alive || (ignore && ignore.has(t))) continue;
      if (t.center.z < minZ || t.center.z > maxZ) continue;
      let hitT = -1;
      if (t.def.shape === 'sphere') {
        _d.subVectors(b, a);
        _f.subVectors(a, t.center);
        const r = t.radius + radius;
        const A = _d.dot(_d);
        const B = 2 * _f.dot(_d);
        const C = _f.dot(_f) - r * r;
        const disc = B * B - 4 * A * C;
        if (disc < 0) continue;
        let tt = (-B - Math.sqrt(disc)) / (2 * A);
        if (tt < 0) tt = C < 0 ? 0 : -1;
        if (tt >= 0 && tt <= 1) hitT = tt;
      } else {
        // Transform the segment into the box's local (unscaled) frame, then slab test
        _qi.copy(t.quat).invert();
        _p0.subVectors(a, t.center).applyQuaternion(_qi);
        _p1.subVectors(b, t.center).applyQuaternion(_qi);
        _d.subVectors(_p1, _p0);
        let tmin = 0;
        let tmax = 1;
        let ok = true;
        for (const ax of ['x', 'y', 'z'] as const) {
          const h = t.half[ax] + radius;
          const o = _p0[ax];
          const dd = _d[ax];
          if (Math.abs(dd) < 1e-8) {
            if (o < -h || o > h) { ok = false; break; }
          } else {
            let t1 = (-h - o) / dd;
            let t2 = (h - o) / dd;
            if (t1 > t2) [t1, t2] = [t2, t1];
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
            if (tmin > tmax) { ok = false; break; }
          }
        }
        if (ok) hitT = tmin;
      }
      if (hitT >= 0 && hitT < bestT) {
        bestT = hitT;
        best = { target: t, t: hitT, point: new THREE.Vector3().lerpVectors(a, b, hitT) };
      }
    }
    return best;
  }

  /** Removes a target silently (no score, no effects). */
  discard(t: Target) {
    const i = this.targets.indexOf(t);
    if (i >= 0) this.remove(i);
  }

  /** Applies one hit. Returns true if the target was destroyed. */
  hit(t: Target, point: THREE.Vector3, dir: THREE.Vector3, damage = 1): boolean {
    if (!t.alive) return false;
    t.hp -= damage;
    t.flash = 1;
    t.hitPoint.copy(point);
    t.hitDir.copy(dir);
    if (t.glassMat) {
      // crack centred where the projectile landed, in the panel's UV space
      _qi.copy(t.quat).invert();
      _v.subVectors(point, t.center).applyQuaternion(_qi);
      t.glassMat.uniforms.uCrackCenter.value.set(_v.x / (t.half.x * 2) + 0.5, _v.y / (t.half.y * 2) + 0.5);
      t.glassMat.uniforms.uDamage.value = 1 - Math.max(0, t.hp) / t.maxHp;
      t.crackTarget = Math.min(1, 0.35 + (1 - t.hp / t.maxHp) * 0.6);
      t.crack = Math.min(t.crack, 0.1);
    }
    if (t.hp <= 0) {
      this.kill(t, point, dir, 'shot');
      return true;
    }
    return false;
  }

  /** Destroys a target: scoring fires now, the physical shatter after a short crack/flash. */
  kill(t: Target, point: THREE.Vector3, dir: THREE.Vector3, cause: Target['cause']) {
    if (!t.alive) return;
    t.alive = false;
    t.cause = cause;
    t.hitPoint.copy(point);
    t.hitDir.copy(dir);
    t.dying = t.isGlass ? (cause === 'crash' ? 0.01 : 0.06) : 0.035;
    if (t.glassMat) {
      _qi.copy(t.quat).invert();
      _v.subVectors(point, t.center).applyQuaternion(_qi);
      t.glassMat.uniforms.uCrackCenter.value.set(_v.x / (t.half.x * 2) + 0.5, _v.y / (t.half.y * 2) + 0.5);
      t.glassMat.uniforms.uDamage.value = 1;
    }
    this.hooks.onDestroyed(t);
  }

  /** Chain reaction: destroys everything within `radius`, delayed by distance for a rippling effect. */
  explode(center: THREE.Vector3, radius: number, source?: Target) {
    for (const t of this.targets) {
      if (!t.alive || t === source || t.kind === 'bossCore') continue;
      const d = t.center.distanceTo(center) - (t.def.shape === 'sphere' ? t.radius : Math.max(t.half.x, t.half.y));
      if (d < radius) {
        const dir = new THREE.Vector3().subVectors(t.center, center).normalize();
        this.scheduled.push({ t, at: this.clock + 0.04 + Math.max(0, d) * 0.025, point: t.center.clone(), dir });
      }
    }
  }
}
