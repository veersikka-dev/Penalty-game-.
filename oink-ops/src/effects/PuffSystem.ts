import * as THREE from 'three';
import { toon } from '../render/Toon';

interface Puff {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  s0: number; s1: number;
  life: number; max: number;
  rise: number;
  color: THREE.Color;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * Chunky cartoon smoke: instanced toon spheres that pop in, swell and shrink away.
 * Used for explosions, dust, landing puffs, spawn/death poofs and muzzle smoke.
 */
export class PuffSystem {
  readonly mesh: THREE.InstancedMesh;
  private puffs: Puff[] = [];
  private pool: Puff[] = [];
  cap: number;

  constructor(private capacity = 420) {
    this.cap = capacity;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = toon(0xffffff, { unique: true });
    // puffs glow a little in their own colour so shadows never make them muddy
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance += vColor.rgb * 0.35;\n#endif');
    };
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, _c.set(0xffffff));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number, color: THREE.ColorRepresentation, grow = 1.8, rise = 0.6) {
    if (this.puffs.length >= Math.min(this.cap, this.capacity)) return;
    const p = this.pool.pop() ?? ({ color: new THREE.Color() } as Puff);
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.s0 = size * 0.4;
    p.s1 = size * grow;
    p.life = 0;
    p.max = life;
    p.rise = rise;
    p.color.set(color);
    this.puffs.push(p);
  }

  /** A burst of puffs — the classic cartoon smoke cloud. */
  cloud(pos: THREE.Vector3, count: number, size: number, speed: number, color: THREE.ColorRepresentation, life = 0.8, up = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 0.8 - 0.1;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.emit(
        pos.x + Math.cos(a) * size * 0.3, pos.y + Math.random() * size * 0.3, pos.z + Math.sin(a) * size * 0.3,
        Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp * up + 0.5, Math.sin(a) * Math.cos(e) * sp,
        size * (0.6 + Math.random() * 0.6), life * (0.7 + Math.random() * 0.6), color,
      );
    }
  }

  /** Ring of dust on the ground (landings, stomps, spawns). */
  ring(pos: THREE.Vector3, count: number, radius: number, size: number, color: THREE.ColorRepresentation, speed = 3) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      this.emit(pos.x + Math.cos(a) * radius, pos.y + 0.1, pos.z + Math.sin(a) * radius, Math.cos(a) * speed, 0.4, Math.sin(a) * speed, size, 0.5 + Math.random() * 0.3, color, 1.6, 0.3);
    }
  }

  update(dt: number) {
    const list = this.puffs;
    let dirty = false;
    for (let i = 0; i < list.length; ) {
      const p = list[i];
      p.life += dt;
      if (p.life >= p.max) {
        const last = list.pop()!;
        if (last !== p) list[i] = last;
        this.pool.push(p);
        continue;
      }
      const drag = Math.exp(-3 * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy = p.vy * drag + p.rise * dt * 4;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const k = p.life / p.max;
      // pop in fast, hold, then shrink away (no transparency needed — very cartoon)
      const grow = k < 0.15 ? k / 0.15 : 1;
      const shrink = k > 0.55 ? 1 - (k - 0.55) / 0.45 : 1;
      const s = (p.s0 + (p.s1 - p.s0) * Math.sqrt(k)) * grow * shrink;
      _m.compose(_p.set(p.x, p.y, p.z), _q.identity(), _s.set(s, s, s));
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, p.color);
      dirty = true;
      i++;
    }
    this.mesh.count = list.length;
    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  clear() {
    for (const p of this.puffs) this.pool.push(p);
    this.puffs.length = 0;
    this.mesh.count = 0;
  }
}
