import * as THREE from 'three';
import { makeCrystalChunks, makeGlassShards } from './ShardGeometry';

interface Frag {
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  rx: number; ry: number; rz: number;
  ax: number; ay: number; az: number;
  sx: number; sy: number; sz: number;
  life: number; max: number;
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

/** Tints the emissive term by the per-instance colour so each shard glows in its object's hue. */
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
 * spinning shards cost ~12 draw calls total. Pieces are pooled and recycled.
 */
export class FragmentSystem {
  readonly root = new THREE.Group();
  private glass: FragGroup[] = [];
  private crystal: FragGroup[] = [];
  private pool: Frag[] = [];
  private active = 0;
  maxActive = 260;
  floorY: number | null = 0;
  gravity = 14;

  constructor(perVariant = 160) {
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, metalness: 0.2, roughness: 0.04, transparent: true, opacity: 0.82,
      emissive: 0xffffff, emissiveIntensity: 0.55, envMapIntensity: 2.2, side: THREE.DoubleSide,
    });
    tintEmissive(glassMat);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, metalness: 0.25, roughness: 0.12, flatShading: true,
      emissive: 0xffffff, emissiveIntensity: 1.5, envMapIntensity: 1.5,
    });
    tintEmissive(crystalMat);
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.InstancedMesh(geo, mat, perVariant);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < perVariant; i++) m.setColorAt(i, WHITE); // allocate instanceColor before first compile
      m.count = 0;
      m.frustumCulled = false;
      this.root.add(m);
      return new FragGroup(m, perVariant);
    };
    this.glass = makeGlassShards(8).map((g) => mk(g, glassMat));
    this.crystal = makeCrystalChunks(5).map((g) => mk(g, crystalMat));
  }

  get activeCount() {
    return this.active;
  }

  spawn(type: 'glass' | 'crystal', pos: THREE.Vector3, rot: THREE.Euler, scale: THREE.Vector3, vel: THREE.Vector3, angVel: THREE.Vector3, color: THREE.Color, life: number) {
    if (this.active >= this.maxActive) return;
    const groups = type === 'glass' ? this.glass : this.crystal;
    const g = groups[Math.floor(Math.random() * groups.length)];
    if (g.frags.length >= g.capacity) return;
    const f = this.pool.pop() ?? ({ color: new THREE.Color() } as Frag);
    f.px = pos.x; f.py = pos.y; f.pz = pos.z;
    f.vx = vel.x; f.vy = vel.y; f.vz = vel.z;
    f.rx = rot.x; f.ry = rot.y; f.rz = rot.z;
    f.ax = angVel.x; f.ay = angVel.y; f.az = angVel.z;
    f.sx = scale.x; f.sy = scale.y; f.sz = scale.z;
    f.life = 0; f.max = life;
    f.color.copy(color);
    g.mesh.setColorAt(g.frags.length, f.color);
    if (g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate = true;
    g.frags.push(f);
    this.active++;
  }

  update(dt: number) {
    const floor = this.floorY;
    for (const g of [...this.glass, ...this.crystal]) {
      const list = g.frags;
      let colorsDirty = false;
      for (let i = 0; i < list.length; ) {
        const f = list[i];
        f.life += dt;
        if (f.life >= f.max) {
          // swap-remove, keeping instance colours in sync
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
        const drag = Math.exp(-0.6 * dt);
        f.vx *= drag; f.vz *= drag;
        f.vy = f.vy * drag - this.gravity * dt;
        f.px += f.vx * dt; f.py += f.vy * dt; f.pz += f.vz * dt;
        if (floor !== null && f.py < floor + 0.05) {
          f.py = floor + 0.05;
          if (f.vy < 0) f.vy = -f.vy * 0.28;
          f.vx *= 0.7; f.vz *= 0.7;
          f.ax *= 0.6; f.ay *= 0.6; f.az *= 0.6;
        }
        f.rx += f.ax * dt; f.ry += f.ay * dt; f.rz += f.az * dt;
        const t = f.life / f.max;
        const k = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
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
    for (const g of [...this.glass, ...this.crystal]) {
      for (const f of g.frags) this.pool.push(f);
      g.frags.length = 0;
      g.mesh.count = 0;
    }
    this.active = 0;
  }
}
