import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CollisionWorld, Box } from '../physics/Collision';
import { outlineMaterial, toon } from '../render/Toon';
import type { ThemeDef } from './Themes';
import type { PropSpawn, PropType } from './Destructibles';
import type { PickupType } from './Pickups';
import type { EnemyType } from '../enemies/EnemyDefs';
import { Rng } from '../utils/MathUtils';

export interface EncounterDef {
  id: string;
  trigger: { x: number; z: number; r: number };
  waves: { type: EnemyType; x: number; z: number }[][];
}

export type ObjectiveDef = { text: string; openGate?: string; checkpoint?: { x: number; z: number }; via?: [number, number][] } & (
  | { type: 'reach'; x: number; z: number; r: number }
  | { type: 'encounter'; id: string; x: number; z: number }
  | { type: 'destroy'; tag: string; x: number; z: number }
  | { type: 'boss'; x: number; z: number }
  | { type: 'exit'; x: number; z: number }
);

export interface GateDef {
  id: string;
  x: number;
  z: number;
  w: number;
  h: number;
  rot: number;
}

export interface MovingPlatform {
  box: Box;
  mesh: THREE.Object3D;
  path: THREE.Vector3[];
  speed: number;
  t: number;
  size: THREE.Vector3;
}

export type Animator = (t: number, dt: number) => void;

export interface LevelData {
  root: THREE.Group;
  animators: Animator[];
  platforms: MovingPlatform[];
  props: PropSpawn[];
  coins: [number, number, number][];
  specials: { type: PickupType; x: number; y: number; z: number; id: string }[];
  enemies: { type: EnemyType; x: number; z: number; y: number }[];
  encounters: EncounterDef[];
  objectives: ObjectiveDef[];
  gates: GateDef[];
  spawn: { x: number; z: number; yaw: number };
  liquids: THREE.Mesh[];
  bossArena?: { x: number; z: number };
  arenaTiles: { box: Box; mesh: THREE.Object3D }[];
  exit: { x: number; z: number } | null;
}

const CELL = 48;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

type V3 = [number, number, number];

/** Strips a geometry down to position+normal, non-indexed, so anything can be merged. */
function normalize(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

/**
 * Builds a level: static scenery is merged per region/material (few draw calls,
 * frustum-cullable cells) with ink outlines; colliders go into the CollisionWorld;
 * gameplay objects are recorded for the game to instantiate.
 */
export class LevelBuilder {
  readonly rng: Rng;
  readonly data: LevelData;
  private buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean }>();
  private geoCache = new Map<string, THREE.BufferGeometry>();

  constructor(readonly world: CollisionWorld, readonly theme: ThemeDef, readonly size: number, seed = 1) {
    this.rng = new Rng(seed);
    this.data = {
      root: new THREE.Group(), animators: [], platforms: [], props: [], coins: [], specials: [], enemies: [],
      encounters: [], objectives: [], gates: [], spawn: { x: 0, z: 0, yaw: 0 }, liquids: [], arenaTiles: [], exit: null,
    };
    world.clear();
    world.bounds = { minX: -size, maxX: size, minZ: -size, maxZ: size };
  }

  // ------------------------------------------------------------------ geometry helpers (cached, unit-ish)
  g(key: string, make: () => THREE.BufferGeometry) {
    let geo = this.geoCache.get(key);
    if (!geo) this.geoCache.set(key, (geo = make()));
    return geo;
  }
  rbox(w: number, h: number, d: number, r = 0.1) {
    return this.g(`rb${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01)));
  }
  box(w: number, h: number, d: number) {
    return this.g(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
  }
  cyl(rt: number, rb: number, h: number, seg = 12) {
    return this.g(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
  }
  sphere(r: number, detail = 1) {
    return this.g(`s${r},${detail}`, () => new THREE.IcosahedronGeometry(r, detail));
  }
  cone(r: number, h: number, seg = 8) {
    return this.g(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
  }

  /** Adds static geometry (merged later). `ink` = outline thickness (0 = none). */
  add(geo: THREE.BufferGeometry, color: number | THREE.Material, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], ink = 0.04, cast = true) {
    const mat = typeof color === 'number' ? toon(color) : color;
    _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], 'YXZ'));
    _m.compose(_p.set(pos[0], pos[1], pos[2]), _q, _s.set(scale[0], scale[1], scale[2]));
    const g = normalize(geo);
    g.applyMatrix4(_m);
    const cell = `${Math.floor(pos[0] / CELL)},${Math.floor(pos[2] / CELL)}`;
    const key = `${cell}|${mat.uuid}|${cast}`;
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = { mat, geos: [], cast }));
    b.geos.push(g);
    if (ink > 0) {
      const om = outlineMaterial(ink);
      const okey = `${cell}|ink${ink}`;
      let ob = this.buckets.get(okey);
      if (!ob) this.buckets.set(okey, (ob = { mat: om, geos: [], cast: false }));
      ob.geos.push(g.clone());
    }
  }

  /** Adds a dynamic object (animated props) directly to the scene. */
  object(o: THREE.Object3D, anim?: Animator) {
    this.data.root.add(o);
    if (anim) this.data.animators.push(anim);
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh && c.name !== 'outline') {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    return o;
  }

  // ------------------------------------------------------------------ colliders & walkable geometry
  solid(x: number, y: number, z: number, w: number, h: number, d: number, walkable = true) {
    return this.world.addBlock(x, y, z, w, h, d, { walkable });
  }
  post(x: number, z: number, r: number, h: number, y = 0) {
    return this.world.addCyl(x, z, r, y, y + h);
  }

  /** A walkable block with a toon look. */
  platform(x: number, z: number, w: number, d: number, h: number, color: number, top?: number, y0 = 0) {
    this.add(this.rbox(w, h, d, Math.min(0.25, h / 3)), color, [x, y0 + h / 2, z]);
    if (top !== undefined) this.add(this.rbox(w + 0.1, 0.22, d + 0.1, 0.1), top, [x, y0 + h - 0.05, z], [0, 0, 0], [1, 1, 1], 0.03);
    return this.solid(x, y0, z, w, h, d);
  }

  /** Ramp rising along +axis direction from h0 to h1 (walkable, sloped top). */
  ramp(x: number, z: number, w: number, d: number, h0: number, h1: number, axis: 'x' | 'z', color: number) {
    const len = axis === 'x' ? w : d;
    const rise = h1 - h0;
    const ang = Math.atan2(rise, len);
    const slab = Math.hypot(len, rise);
    const thick = 0.4;
    const rot: V3 = axis === 'x' ? [0, 0, ang] : [-ang, 0, 0];
    const sx = axis === 'x' ? slab : w;
    const sz = axis === 'x' ? d : slab;
    this.add(this.rbox(sx, thick, sz, 0.08), color, [x, (h0 + h1) / 2 - thick / 2 + 0.05, z], rot);
    // support underneath
    if (Math.max(h0, h1) > 0.6) this.add(this.box(axis === 'x' ? w * 0.9 : w * 0.8, Math.max(h0, h1) * 0.5, axis === 'x' ? d * 0.8 : d * 0.9), color, [x, Math.max(h0, h1) * 0.25, z], [0, 0, 0], [1, 1, 1], 0);
    this.world.addBox(x - w / 2, 0, z - d / 2, x + w / 2, Math.max(h0, h1), z + d / 2, { ramp: { axis, h0, h1 }, solid: false });
  }

  stairs(x: number, z: number, w: number, depth: number, h: number, steps: number, dir: 'x' | 'z' | '-x' | '-z', color: number) {
    for (let i = 0; i < steps; i++) {
      const sh = (h / steps) * (i + 1);
      const off = -depth / 2 + (depth / steps) * (i + 0.5);
      const sd = depth / steps;
      if (dir === 'x' || dir === '-x') {
        const sx = x + (dir === 'x' ? off : -off);
        this.platform(sx, z, sd, w, sh, color);
      } else {
        const sz = z + (dir === 'z' ? off : -off);
        this.platform(x, sz, w, sd, sh, color);
      }
    }
  }

  /** A pit (liquid / chasm): the floor is removed and a liquid surface drawn. */
  pit(x: number, z: number, w: number, d: number, depth = 3) {
    this.world.addPit(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    const th = this.theme;
    const mat = th.liquid.glow > 0
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(th.liquid.color).multiplyScalar(th.liquid.glow) })
      : toon(th.liquid.color, { transparent: true, opacity: 0.9 });
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 8, 8).rotateX(-Math.PI / 2), mat);
    surf.position.set(x, 0.06, z);
    surf.receiveShadow = true;
    this.data.root.add(surf);
    this.data.liquids.push(surf);
    const base = surf.geometry.attributes.position.array.slice() as Float32Array;
    this.data.animators.push((t) => {
      const p = surf.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) p.setY(i, base[i * 3 + 1] + Math.sin(t * 2 + base[i * 3] * 0.8 + base[i * 3 + 2] * 0.6) * 0.03);
      p.needsUpdate = true;
    });
    // banks
    const bank = this.theme.ground.edge;
    for (const [bx, bz, bw, bd] of [[x, z - d / 2, w + 0.6, 0.6], [x, z + d / 2, w + 0.6, 0.6], [x - w / 2, z, 0.6, d], [x + w / 2, z, 0.6, d]]) {
      this.add(this.rbox(bw, 0.4, bd, 0.15), bank, [bx, -0.12, bz], [0, 0, 0], [1, 1, 1], 0.03);
    }
    void depth;
  }

  /** A platform that loops along a path (carries the player). */
  movingPlatform(path: V3[], w: number, d: number, speed: number, color: number, top: number) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(w, 0.6, d, 2, 0.15), toon(color));
    const cap = new THREE.Mesh(new RoundedBoxGeometry(w + 0.1, 0.18, d + 0.1, 2, 0.08), toon(top));
    cap.position.y = 0.3;
    g.add(body, cap);
    const pts = path.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    g.position.copy(pts[0]);
    this.object(g);
    const box = this.world.addBlock(pts[0].x, pts[0].y - 0.3, pts[0].z, w, 0.7, d, { delta: new THREE.Vector3() });
    this.data.platforms.push({ box, mesh: g, path: pts, speed, t: 0, size: new THREE.Vector3(w, 0.7, d) });
  }

  // ------------------------------------------------------------------ ground & boundary
  ground() {
    const th = this.theme;
    const S = this.size + 60;
    const geo = new THREE.PlaneGeometry(S * 2, S * 2, 96, 96).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const ca = new THREE.Color(th.ground.a), cb = new THREE.Color(th.ground.b), ce = new THREE.Color(th.ground.edge), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = Math.sin(x * 0.11) * Math.cos(z * 0.13) + Math.sin(x * 0.037 + z * 0.05) * 0.8;
      c.copy(ca).lerp(cb, n > 0.2 ? 1 : 0);
      const edge = Math.max(Math.abs(x), Math.abs(z)) - this.size;
      if (edge > 0) {
        c.lerp(ce, Math.min(1, edge / 10));
        pos.setY(i, Math.min(18, edge * edge * 0.02) * (0.7 + 0.3 * Math.sin(x * 0.2 + z * 0.17)));
      }
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = toon(0xffffff);
    const gm = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: mat.gradientMap });
    const mesh = new THREE.Mesh(geo, gm);
    mesh.receiveShadow = true;
    this.data.root.add(mesh);
    // Pits need holes: hide ground where pits are by drawing the ground as-is (pits are below y=0 and covered by the liquid)
    // Boundary hills ring
    const hillCols = th.palette.foliage;
    const n = Math.floor(this.size / 5);
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i <= n; i++) {
        const t = -this.size + (i / n) * this.size * 2;
        const off = this.size + this.rng.range(4, 10);
        const [x, z] = side === 0 ? [t, -off] : side === 1 ? [t, off] : side === 2 ? [-off, t] : [off, t];
        const r = this.rng.range(5, 10);
        this.add(this.sphere(1, 1), hillCols[i % hillCols.length], [x, -r * 0.3, z], [0, this.rng.range(0, 6), 0], [r, r * 0.8, r], 0.06);
      }
    }
  }

  /** A painted path ribbon on the ground. */
  path(points: [number, number][], width: number, color = this.theme.ground.path) {
    const mat = toon(color, { unique: true });
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -2;
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0.02, z)));
    const segs = Math.max(8, points.length * 10);
    const verts: number[] = [];
    const norms: number[] = [];
    for (let i = 0; i < segs; i++) {
      const a = curve.getPoint(i / segs), b = curve.getPoint((i + 1) / segs);
      const ta = curve.getTangent(i / segs), tb = curve.getTangent((i + 1) / segs);
      const na = new THREE.Vector3(-ta.z, 0, ta.x).normalize().multiplyScalar(width / 2);
      const nb = new THREE.Vector3(-tb.z, 0, tb.x).normalize().multiplyScalar(width / 2);
      const q = [a.clone().add(na), a.clone().sub(na), b.clone().add(nb), b.clone().sub(nb)];
      for (const v of [q[0], q[2], q[1], q[1], q[2], q[3]]) {
        verts.push(v.x, 0.03, v.z);
        norms.push(0, 1, 0);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    this.data.root.add(m);
    // round end caps
    for (const p of [points[0], points[points.length - 1]]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(width / 2, 16).rotateX(-Math.PI / 2), mat);
      cap.position.set(p[0], 0.03, p[1]);
      this.data.root.add(cap);
    }
  }

  // ------------------------------------------------------------------ gameplay registration
  exit(x: number, z: number) {
    this.data.exit = { x, z };
  }
  spawnAt(x: number, z: number, yaw: number) {
    this.data.spawn = { x, z, yaw };
  }
  prop(type: PropType, x: number, z: number, o: Partial<PropSpawn> = {}) {
    this.data.props.push({ type, x, z, ...o });
  }
  coin(x: number, z: number, y = 0) {
    this.data.coins.push([x, y, z]);
  }
  coinLine(x1: number, z1: number, x2: number, z2: number, n: number, y = 0) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      this.coin(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, y);
    }
  }
  coinRing(x: number, z: number, r: number, n: number, y = 0) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.coin(x + Math.cos(a) * r, z + Math.sin(a) * r, y);
    }
  }
  special(type: PickupType, x: number, z: number, y = 0, id = '') {
    this.data.specials.push({ type, x, y, z, id });
  }
  enemy(type: EnemyType, x: number, z: number, y = 0) {
    this.data.enemies.push({ type, x, z, y });
  }
  encounter(e: EncounterDef) {
    this.data.encounters.push(e);
  }
  objective(o: ObjectiveDef) {
    this.data.objectives.push(o);
  }
  /** A collapsible arena floor tile (boss phase 4). */
  arenaTile(x: number, z: number, w: number, d: number, h: number, color: number, top: number) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(w - 0.1, h, d - 0.1, 2, 0.12), toon(color));
    body.position.y = -h / 2;
    const cap = new THREE.Mesh(new RoundedBoxGeometry(w - 0.3, 0.12, d - 0.3, 2, 0.05), toon(top));
    g.add(body, cap);
    g.position.set(x, h, z);
    this.object(g);
    const box = this.world.addBlock(x, 0, z, w, h, d);
    this.data.arenaTiles.push({ box, mesh: g });
  }

  gate(id: string, x: number, z: number, w: number, rot = 0, h = 3.6) {
    this.data.gates.push({ id, x, z, w, h, rot });
  }

  /** Merges all static geometry into meshes and returns the level data. */
  finalize(): LevelData {
    for (const [, b] of this.buckets) {
      if (!b.geos.length) continue;
      const merged = mergeGeometries(b.geos, false);
      b.geos.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, b.mat);
      mesh.castShadow = b.cast && !(b.mat as THREE.MeshBasicMaterial).side;
      mesh.castShadow = b.cast && b.mat.side !== THREE.BackSide;
      mesh.receiveShadow = b.mat.side !== THREE.BackSide;
      mesh.matrixAutoUpdate = false;
      this.data.root.add(mesh);
    }
    this.buckets.clear();
    for (const g of this.geoCache.values()) g.dispose();
    this.geoCache.clear();
    return this.data;
  }
}
