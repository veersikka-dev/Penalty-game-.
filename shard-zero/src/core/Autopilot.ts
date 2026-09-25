import * as THREE from 'three';
import type { Target } from '../targets/Target';

export interface AutopilotHost {
  camera: THREE.PerspectiveCamera;
  targets: Target[];
  projectileSpeed: number;
  gravity: number;
  canFire(): boolean;
  fireDir(dir: THREE.Vector3): void;
  look(dir: THREE.Vector3): void;
}

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();

/**
 * QA bot used for automated play-testing (enable with ?autoplay or window.__shard.autoplay()).
 * Leads moving targets, compensates for gravity, prioritises imminent obstacles, and
 * adds configurable aim error so balancing reflects an imperfect human player.
 */
export class Autopilot {
  enabled = false;
  aimError = 0.012;
  private last = new Map<Target, THREE.Vector3>();
  private claimed = new Map<Target, number>();
  /** Shots in flight per target, so multi-hit targets don't get over-fired. */
  private pending = new Map<Target, number[]>();
  private clock = 0;

  update(dt: number, host: AutopilotHost) {
    if (!this.enabled) return;
    this.clock += dt;
    const cam = host.camera.position;
    let best: Target | null = null;
    let bestScore = Infinity;
    for (const t of host.targets) {
      if (!t.alive) continue;
      const prev = this.last.get(t) ?? t.center.clone();
      this.last.set(t, prev);
      const dz = cam.z - t.center.z;
      if (dz < 4 || dz > 72) continue;
      const claimedUntil = this.claimed.get(t) ?? 0;
      if (claimedUntil > this.clock) continue;
      const blocking = t.def.obstacle && (t.def.shape === 'sphere' || this.inPath(t, cam));
      const useful = t.def.ammo > 0 || t.def.special || t.tag === 'boss' || blocking || t.kind === 'shieldPlate';
      if (!useful) continue;
      if (t.kind === 'shieldPlate' && t.tag !== 'boss') continue;
      const priority = blocking ? dz * 0.6 : dz + (t.def.ammo > 0 ? -6 : 0);
      if (priority < bestScore) {
        bestScore = priority;
        best = t;
      }
    }
    const syncLast = () => {
      for (const [t, p] of this.last) {
        if (!t.alive) this.last.delete(t);
        else p.copy(t.center);
      }
    };
    if (!best || !host.canFire()) {
      syncLast();
      return;
    }
    // Lead: estimate target velocity from last frame and solve time-of-flight iteratively
    const prev = this.last.get(best)!;
    const vel = _v.subVectors(best.center, prev).divideScalar(Math.max(dt, 1e-3));
    let t = cam.distanceTo(best.center) / host.projectileSpeed;
    const aim = new THREE.Vector3();
    for (let i = 0; i < 3; i++) {
      aim.copy(best.center).addScaledVector(vel, t);
      aim.y += 0.5 * host.gravity * t * t;
      t = cam.distanceTo(aim) / host.projectileSpeed;
    }
    syncLast();
    _dir.subVectors(aim, cam).normalize();
    _dir.x += (Math.random() - 0.5) * this.aimError * 2;
    _dir.y += (Math.random() - 0.5) * this.aimError * 2;
    _dir.normalize();
    host.look(_dir);
    host.fireDir(_dir);
    const inFlight = (this.pending.get(best) ?? []).filter((x) => x > this.clock);
    inFlight.push(this.clock + t + 0.1);
    this.pending.set(best, inFlight);
    if (inFlight.length >= Math.max(1, best.hp)) this.claimed.set(best, this.clock + t + 0.2);
  }

  private inPath(t: Target, cam: THREE.Vector3) {
    const hx = t.half.x + 0.8;
    const hy = t.half.y + 1;
    return Math.abs(t.center.x - cam.x) < hx + 1.5 && Math.abs(t.center.y - cam.y) < hy;
  }
}
