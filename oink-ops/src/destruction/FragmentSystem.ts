import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeCrystalChunks, makeGlassShards } from './ShardGeometry';
import { toonGradient } from '../render/Toon';

export type FragType = 'glass' | 'crystal' | 'wood' | 'shell' | 'debris' | 'bits' | 'metal';

interface Frag {
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  rx: number; ry: number; rz: number;
  ax: number; ay: number; az: number;
  sx: number; sy: number; sz: number;
  life: number; max: number;
  floor: number;
  color: THREE.Color;
}

class FragGroup {
  readonly frags: Frag[] = [];
  constructor(readonly mesh: THREE.InstancedMesh, readonly capacity: number) {}
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const WHITE = new THREE.Color(1, 1, 1);

/** Tints the emissive term by the per-instance colour so shards glow in their object's hue. */
function tintEmissive(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif',
    );
  };
}

/**
 * Instanced debris. Each fracture-piece variant is one InstancedMesh, so hundreds of
 * spinning pieces cost only a couple of dozen draw calls. Pieces are pooled.
 */
export class FragmentSystem {
  readonly root = new THREE.Group();
  private groups = new Map<FragType, FragGroup[]>();
  private all: FragGroup[] = [];
  private pool: Frag[] = [];
  private active = 0;
  maxActive = 260;
  floorY: number | null = 0;
  gravity = 20;

  constructor(perVariant = 140) {
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.8,
      emissive: 0xffffff, emissiveIntensity: 0.45, side: THREE.DoubleSide,
    });
    tintEmissive(glassMat);
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.2, flatShading: true, emissive: 0xffffff, emissiveIntensity: 1.2 });
    tintEmissive(crystalMat);
    const toonMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonGradient() });
    const mk = (type: FragType, geos: THREE.BufferGeometry[], mat: THREE.Material, cap = perVariant) => {
      const list: FragGroup[] = [];
      for (const geo of geos) {
        const m = new THREE.InstancedMesh(geo, mat, cap);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < cap; i++) m.setColorAt(i, WHITE);
        m.count = 0;
        m.frustumCulled = false;
        m.castShadow = type !== 'glass';
        this.root.add(m);
        const g = new FragGroup(m, cap);
        list.push(g);
        this.all.push(g);
      }
      this.groups.set(type, list);
    };
    mk('glass', makeGlassShards(6), glassMat);
    mk('crystal', makeCrystalChunks(4), crystalMat);
    mk('wood', [new RoundedBoxGeometry(0.9, 0.12, 0.28, 1, 0.03), new RoundedBoxGeometry(0.6, 0.1, 0.22, 1, 0.03), new THREE.BoxGeometry(0.35, 0.1, 0.18)], toonMat);
    mk('shell', [new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6)], new THREE.MeshToonMaterial({ color: 0xffc94a, gradientMap: toonGradient() }), 90);
    mk('debris', makeCrystalChunks(3, 99), toonMat);
    mk('metal', [new RoundedBoxGeometry(0.5, 0.08, 0.4, 1, 0.02), new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8)], toonMat);
    mk('bits', [new THREE.IcosahedronGeometry(0.18, 0), new THREE.SphereGeometry(0.14, 8, 6)], toonMat);
  }

  get activeCount() {
    return this.active;
  }

  spawn(type: FragType, pos: THREE.Vector3, rot: THREE.Euler, scale: THREE.Vector3, vel: THREE.Vector3, angVel: THREE.Vector3, color: THREE.ColorRepresentation, life: number, floor = this.floorY ?? -100) {
    if (this.active >= this.maxActive) return;
    const groups = this.groups.get(type)!;
    const g = groups[Math.floor(Math.random() * groups.length)];
    if (g.frags.length >= g.capacity) return;
    const f = this.pool.pop() ?? ({ color: new THREE.Color() } as Frag);
    f.px = pos.x; f.py = pos.y; f.pz = pos.z;
    f.vx = vel.x; f.vy = vel.y; f.vz = vel.z;
    f.rx = rot.x; f.ry = rot.y; f.rz = rot.z;
    f.ax = angVel.x; f.ay = angVel.y; f.az = angVel.z;
    f.sx = scale.x; f.sy = scale.y; f.sz = scale.z;
    f.life = 0;
    f.max = life;
    f.floor = floor;
    f.color.set(color);
    g.mesh.setColorAt(g.frags.length, f.color);
    if (g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate = true;
    g.frags.push(f);
    this.active++;
  }

  update(dt: number) {
    for (const g of this.all) {
      const list = g.frags;
      let colorsDirty = false;
      for (let i = 0; i < list.length; ) {
        const f = list[i];
        f.life += dt;
        if (f.life >= f.max) {
          const last = list.pop()!;
          if (last !== f) {
            list[i] = last;
            g.mesh.setColorAt(i, last.color);
            colorsDirty = true;
          }
          this.pool.push(f);
          this.active--;
          continue;
        }
        const drag = Math.exp(-0.5 * dt);
        f.vx *= drag;
        f.vz *= drag;
        f.vy -= this.gravity * dt;
        f.px += f.vx * dt;
        f.py += f.vy * dt;
        f.pz += f.vz * dt;
        if (f.py < f.floor + 0.04) {
          f.py = f.floor + 0.04;
          if (f.vy < 0) f.vy = -f.vy * 0.3;
          f.vx *= 0.65;
          f.vz *= 0.65;
          f.ax *= 0.55;
          f.ay *= 0.55;
          f.az *= 0.55;
        }
        f.rx += f.ax * dt;
        f.ry += f.ay * dt;
        f.rz += f.az * dt;
        const t = f.life / f.max;
        const k = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
        _q.setFromEuler(_e.set(f.rx, f.ry, f.rz));
        _m.compose(_p.set(f.px, f.py, f.pz), _q, _s.set(f.sx * k, f.sy * k, f.sz * k));
        g.mesh.setMatrixAt(i, _m);
        i++;
      }
      g.mesh.count = list.length;
      g.mesh.instanceMatrix.needsUpdate = true;
      if (colorsDirty && g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate = true;
    }
  }

  clear() {
    for (const g of this.all) {
      for (const f of g.frags) this.pool.push(f);
      g.frags.length = 0;
      g.mesh.count = 0;
    }
    this.active = 0;
  }
}
