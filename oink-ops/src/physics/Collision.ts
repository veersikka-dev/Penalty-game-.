import * as THREE from 'three';
import { clamp, lerp } from '../utils/MathUtils';

/** Axis-aligned box. Tops are walkable; sides block. Ramps slope their top along an axis. */
export interface Box {
  min: THREE.Vector3;
  max: THREE.Vector3;
  enabled: boolean;
  /** Blocks projectiles, the camera and line of sight. */
  solid: boolean;
  /** Characters can walk on top. */
  walkable: boolean;
  ramp?: { axis: 'x' | 'z'; h0: number; h1: number };
  /** Per-frame displacement for moving platforms (riders are carried by it). */
  delta?: THREE.Vector3;
  tag?: string;
  owner?: unknown;
}

/** Vertical cylinder (tree trunks, posts, pillars). */
export interface Cyl {
  x: number;
  z: number;
  r: number;
  y0: number;
  y1: number;
  enabled: boolean;
  solid: boolean;
  walkable: boolean;
  owner?: unknown;
}

/** Hole in the base floor (liquid pits, chasms). */
export interface Pit {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RayHit {
  dist: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  box?: Box;
  cyl?: Cyl;
  floor?: boolean;
}

export interface GroundInfo {
  y: number;
  box: Box | null;
}

const _n = new THREE.Vector3();

/**
 * Lightweight game physics for characters: walkable box tops, ramps, pits,
 * moving platforms, horizontal push-out, and ray casts for aiming/camera/LOS.
 * Brute force is fine here — levels have a few hundred colliders.
 */
export class CollisionWorld {
  boxes: Box[] = [];
  cyls: Cyl[] = [];
  pits: Pit[] = [];
  floorY = 0;
  hasFloor = true;
  bounds = { minX: -120, maxX: 120, minZ: -120, maxZ: 120 };

  clear() {
    this.boxes = [];
    this.cyls = [];
    this.pits = [];
    this.hasFloor = true;
  }

  addBox(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, o: Partial<Box> = {}): Box {
    const b: Box = {
      min: new THREE.Vector3(minX, minY, minZ),
      max: new THREE.Vector3(maxX, maxY, maxZ),
      enabled: true,
      solid: true,
      walkable: true,
      ...o,
    };
    this.boxes.push(b);
    return b;
  }

  /** Box by centre x/z, bottom y, and size. */
  addBlock(x: number, y: number, z: number, w: number, h: number, d: number, o: Partial<Box> = {}): Box {
    return this.addBox(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, o);
  }

  addCyl(x: number, z: number, r: number, y0: number, y1: number, o: Partial<Cyl> = {}): Cyl {
    const c: Cyl = { x, z, r, y0, y1, enabled: true, solid: true, walkable: false, ...o };
    this.cyls.push(c);
    return c;
  }

  addPit(minX: number, minZ: number, maxX: number, maxZ: number) {
    this.pits.push({ minX, maxX, minZ, maxZ });
  }

  remove(c: Box | Cyl) {
    const bi = this.boxes.indexOf(c as Box);
    if (bi >= 0) this.boxes.splice(bi, 1);
    const ci = this.cyls.indexOf(c as Cyl);
    if (ci >= 0) this.cyls.splice(ci, 1);
  }

  inPit(x: number, z: number) {
    for (const p of this.pits) if (x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ) return true;
    return false;
  }

  topAt(b: Box, x: number, z: number): number {
    if (!b.ramp) return b.max.y;
    const r = b.ramp;
    const t = r.axis === 'x' ? (x - b.min.x) / (b.max.x - b.min.x) : (z - b.min.z) / (b.max.z - b.min.z);
    return lerp(r.h0, r.h1, clamp(t, 0, 1));
  }

  /** Highest walkable surface under (x,z) at or below `maxY`. */
  groundAt(x: number, z: number, maxY: number, out: GroundInfo = { y: 0, box: null }, inset = 0.12): GroundInfo {
    let best = this.hasFloor && !this.inPit(x, z) ? this.floorY : -Infinity;
    let box: Box | null = null;
    for (const b of this.boxes) {
      if (!b.enabled || !b.walkable) continue;
      if (x < b.min.x - inset || x > b.max.x + inset || z < b.min.z - inset || z > b.max.z + inset) continue;
      const top = this.topAt(b, clamp(x, b.min.x, b.max.x), clamp(z, b.min.z, b.max.z));
      if (top <= maxY + 1e-3 && top > best) {
        best = top;
        box = b;
      }
    }
    for (const c of this.cyls) {
      if (!c.enabled || !c.walkable) continue;
      const dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz > c.r * c.r) continue;
      if (c.y1 <= maxY + 1e-3 && c.y1 > best) {
        best = c.y1;
        box = null;
      }
    }
    out.y = best;
    out.box = box;
    return out;
  }

  /**
   * Pushes a character (vertical cylinder standing at `pos`) out of anything it
   * overlaps that is taller than a step. Returns true if it collided.
   */
  resolve(pos: THREE.Vector3, radius: number, height: number, step: number): boolean {
    let hit = false;
    const feet = pos.y;
    for (const b of this.boxes) {
      if (!b.enabled) continue;
      if (b.min.y >= feet + height) continue;
      const cx = clamp(pos.x, b.min.x, b.max.x);
      const cz = clamp(pos.z, b.min.z, b.max.z);
      const top = this.topAt(b, cx, cz);
      if (top <= feet + step) continue;
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      hit = true;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        const push = radius - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      } else {
        // centre is inside the box: leave by the shortest side
        const l = pos.x - b.min.x, r = b.max.x - pos.x, n = pos.z - b.min.z, f = b.max.z - pos.z;
        const m = Math.min(l, r, n, f);
        if (m === l) pos.x = b.min.x - radius;
        else if (m === r) pos.x = b.max.x + radius;
        else if (m === n) pos.z = b.min.z - radius;
        else pos.z = b.max.z + radius;
      }
    }
    for (const c of this.cyls) {
      if (!c.enabled) continue;
      if (c.y0 >= feet + height || c.y1 <= feet + step) continue;
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const rr = radius + c.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr) continue;
      hit = true;
      const d = Math.sqrt(d2) || 1e-4;
      pos.x = c.x + (dx / d) * rr;
      pos.z = c.z + (dz / d) * rr;
    }
    const bd = this.bounds;
    if (pos.x < bd.minX + radius) { pos.x = bd.minX + radius; hit = true; }
    if (pos.x > bd.maxX - radius) { pos.x = bd.maxX - radius; hit = true; }
    if (pos.z < bd.minZ + radius) { pos.z = bd.minZ + radius; hit = true; }
    if (pos.z > bd.maxZ - radius) { pos.z = bd.maxZ - radius; hit = true; }
    return hit;
  }

  /** Lowest box bottom above `y` at (x,z) — a ceiling for jumping characters. */
  ceilingAt(x: number, z: number, y: number, radius: number): number {
    let best = Infinity;
    for (const b of this.boxes) {
      if (!b.enabled || !b.solid) continue;
      if (x < b.min.x - radius * 0.5 || x > b.max.x + radius * 0.5 || z < b.min.z - radius * 0.5 || z > b.max.z + radius * 0.5) continue;
      if (b.min.y >= y && b.min.y < best) best = b.min.y;
    }
    return best;
  }

  /** Ray cast against solid geometry and the floor. `dir` must be normalised. */
  raycast(o: THREE.Vector3, dir: THREE.Vector3, maxDist: number, floor = true): RayHit | null {
    let bestT = maxDist;
    let best: RayHit | null = null;
    for (const b of this.boxes) {
      if (!b.enabled || !b.solid) continue;
      let tmin = 0;
      let tmax = bestT;
      let axis = -1;
      let sign = 0;
      let ok = true;
      for (let a = 0; a < 3; a++) {
        const oa = a === 0 ? o.x : a === 1 ? o.y : o.z;
        const da = a === 0 ? dir.x : a === 1 ? dir.y : dir.z;
        const mn = a === 0 ? b.min.x : a === 1 ? b.min.y : b.min.z;
        let mx = a === 0 ? b.max.x : a === 1 ? b.max.y : b.max.z;
        if (a === 1 && b.ramp) mx = Math.max(b.ramp.h0, b.ramp.h1);
        if (Math.abs(da) < 1e-9) {
          if (oa < mn || oa > mx) { ok = false; break; }
          continue;
        }
        let t1 = (mn - oa) / da;
        let t2 = (mx - oa) / da;
        let s = -1;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
        if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { ok = false; break; }
      }
      if (!ok || tmin >= bestT || axis < 0) continue;
      bestT = tmin;
      _n.set(axis === 0 ? sign : 0, axis === 1 ? sign : 0, axis === 2 ? sign : 0);
      best = { dist: tmin, point: o.clone().addScaledVector(dir, tmin), normal: _n.clone(), box: b };
    }
    for (const c of this.cyls) {
      if (!c.enabled || !c.solid) continue;
      const ox = o.x - c.x, oz = o.z - c.z;
      const A = dir.x * dir.x + dir.z * dir.z;
      if (A < 1e-9) continue;
      const B = 2 * (ox * dir.x + oz * dir.z);
      const C = ox * ox + oz * oz - c.r * c.r;
      const disc = B * B - 4 * A * C;
      if (disc < 0) continue;
      const t = (-B - Math.sqrt(disc)) / (2 * A);
      if (t < 0 || t >= bestT) continue;
      const y = o.y + dir.y * t;
      if (y < c.y0 || y > c.y1) continue;
      bestT = t;
      const p = o.clone().addScaledVector(dir, t);
      best = { dist: t, point: p, normal: new THREE.Vector3(p.x - c.x, 0, p.z - c.z).normalize(), cyl: c };
    }
    if (floor && this.hasFloor && dir.y < -1e-6) {
      const t = (this.floorY - o.y) / dir.y;
      if (t > 0 && t < bestT) {
        const p = o.clone().addScaledVector(dir, t);
        if (!this.inPit(p.x, p.z)) {
          bestT = t;
          best = { dist: t, point: p, normal: new THREE.Vector3(0, 1, 0), floor: true };
        }
      }
    }
    return best;
  }

  /** True if the straight line a→b is blocked by solid geometry. */
  blocked(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    if (len < 1e-4) return false;
    d.divideScalar(len);
    const hit = this.raycast(a, d, len - 0.05, false);
    return !!hit;
  }
}
