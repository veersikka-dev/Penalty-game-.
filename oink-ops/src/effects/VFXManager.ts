import * as THREE from 'three';
import type { ParticleSystem } from '../destruction/ParticleSystem';
import type { FragmentSystem } from '../destruction/FragmentSystem';
import { PuffSystem } from './PuffSystem';
import { canvasTexture, glowTexture } from '../utils/textures';

interface TimedLight { light: THREE.PointLight; t: number; dur: number; peak: number }
interface Timed { obj: THREE.Mesh | THREE.Sprite; t: number; dur: number; s0: number; s1: number; active: boolean; opacity: number; spin: number }
interface Tracer { mesh: THREE.Mesh; t: number; dur: number; active: boolean }

const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();
const _v = new THREE.Vector3();

let starTex: THREE.Texture | null = null;
function starTexture() {
  if (starTex) return starTex;
  starTex = canvasTexture(128, 128, (g, w) => {
    g.translate(w / 2, w / 2);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,240,200,0.9)');
    grad.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = grad;
    g.beginPath();
    const spikes = 8;
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 ? w * 0.16 : w * 0.5;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  }, false);
  return starTex;
}

/**
 * Cartoon VFX toolkit built from pooled primitives: puffs, sparks, tracers,
 * star-burst muzzle flashes, shockwave rings and flash lights (fixed light count).
 */
export class VFXManager {
  readonly root = new THREE.Group();
  readonly puffs: PuffSystem;
  private lights: TimedLight[] = [];
  private rings: Timed[] = [];
  private flares: Timed[] = [];
  private stars: Timed[] = [];
  private tracers: Tracer[] = [];
  private nextLight = 0;
  motion = true;

  constructor(private particles: ParticleSystem, private frags: FragmentSystem, private camera: THREE.Camera) {
    this.puffs = new PuffSystem(420);
    this.root.add(this.puffs.mesh);
    for (let i = 0; i < 5; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 16, 2);
      this.root.add(light);
      this.lights.push({ light, t: 1, dur: 1, peak: 0 });
    }
    const ringGeo = new THREE.RingGeometry(0.9, 1, 48);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false;
      this.root.add(m);
      this.rings.push({ obj: m, t: 0, dur: 1, s0: 1, s1: 2, active: false, opacity: 1, spin: 0 });
    }
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.visible = false;
      this.root.add(s);
      this.flares.push({ obj: s, t: 0, dur: 1, s0: 1, s1: 2, active: false, opacity: 1, spin: 0 });
    }
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.visible = false;
      s.renderOrder = 20;
      this.root.add(s);
      this.stars.push({ obj: s, t: 0, dur: 1, s0: 1, s1: 1, active: false, opacity: 1, spin: 0 });
    }
    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0);
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false;
      m.frustumCulled = false;
      this.root.add(m);
      this.tracers.push({ mesh: m, t: 0, dur: 0.08, active: false });
    }
  }

  light(pos: THREE.Vector3, color: THREE.ColorRepresentation, intensity: number, dur: number) {
    const L = this.lights[this.nextLight++ % this.lights.length];
    L.light.position.copy(pos);
    L.light.color.set(color);
    L.peak = intensity;
    L.t = 0;
    L.dur = dur;
  }

  private start(list: Timed[], pos: THREE.Vector3, color: THREE.ColorRepresentation, s0: number, s1: number, dur: number, opacity: number) {
    const it = list.find((r) => !r.active) ?? list.reduce((a, b) => (a.t / a.dur > b.t / b.dur ? a : b));
    it.active = true;
    it.t = 0;
    it.dur = dur;
    it.s0 = s0;
    it.s1 = s1;
    it.opacity = opacity;
    it.spin = Math.random() * Math.PI;
    it.obj.visible = true;
    it.obj.position.copy(pos);
    ((it.obj as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(color);
    return it;
  }

  ring(pos: THREE.Vector3, color: THREE.ColorRepresentation, size: number, dur = 0.4, opacity = 0.8, flat = false) {
    const r = this.start(this.rings, pos, color, size * 0.2, size, dur, opacity);
    r.obj.userData.flat = flat;
  }
  flare(pos: THREE.Vector3, color: THREE.ColorRepresentation, size: number, dur = 0.2, opacity = 1) {
    this.start(this.flares, pos, color, size, size * 1.5, dur, opacity);
  }
  star(pos: THREE.Vector3, color: THREE.ColorRepresentation, size: number, dur = 0.06) {
    this.start(this.stars, pos, color, size, size * 1.2, dur, 1);
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation, width = 0.035, dur = 0.07) {
    const tr = this.tracers.find((t) => !t.active) ?? this.tracers[0];
    _d.subVectors(to, from);
    const len = _d.length();
    if (len < 0.01) return;
    tr.active = true;
    tr.t = 0;
    tr.dur = dur;
    tr.mesh.visible = true;
    tr.mesh.position.copy(from);
    tr.mesh.quaternion.setFromUnitVectors(_up, _d.divideScalar(len));
    tr.mesh.scale.set(width, len, width);
    (tr.mesh.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(2.2);
  }

  sparks(pos: THREE.Vector3, color: THREE.ColorRepresentation, count: number, speed: number, size = 0.1, life = 0.4, gravity = 10) {
    _c.set(color).multiplyScalar(1.8);
    this.particles.burst(pos, _c, count, speed, size, life, { drag: 3, gravity, grow: 0 });
  }

  muzzle(pos: THREE.Vector3, dir: THREE.Vector3, color: THREE.ColorRepresentation, big = 1) {
    this.star(pos, color, 0.55 * big, 0.05);
    this.flare(pos, color, 1.1 * big, 0.08, 0.9);
    this.light(pos, color, 10 * big, 0.08);
    _v.copy(pos).addScaledVector(dir, 0.15);
    this.puffs.emit(_v.x, _v.y, _v.z, dir.x * 1.5, dir.y * 1.5 + 0.3, dir.z * 1.5, 0.09 * big, 0.35, 0xe8e0f0, 1.8, 0.5);
    _c.set(color).multiplyScalar(2);
    for (let i = 0; i < 4 * big; i++) {
      const s = 4 + Math.random() * 5;
      this.particles.emit({ x: pos.x, y: pos.y, z: pos.z, vx: dir.x * s + (Math.random() - 0.5) * 2, vy: dir.y * s + (Math.random() - 0.5) * 2, vz: dir.z * s + (Math.random() - 0.5) * 2, r: _c.r, g: _c.g, b: _c.b, size: 0.08, life: 0.14, drag: 6 });
    }
  }

  /** Brass casing ejected to the right of the weapon. */
  shell(pos: THREE.Vector3, right: THREE.Vector3, floor: number) {
    _v.copy(right).multiplyScalar(2 + Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 2.5 + Math.random(), (Math.random() - 0.5) * 0.6));
    this.frags.spawn('shell', pos, new THREE.Euler(Math.random() * 3, Math.random() * 3, 0), new THREE.Vector3(1, 1, 1), _v, new THREE.Vector3(18, 6, 12), 0xffc94a, 1.2, floor);
  }

  impact(pos: THREE.Vector3, normal: THREE.Vector3, color: THREE.ColorRepresentation, strength = 1) {
    this.star(pos, 0xffffff, 0.35 * strength, 0.05);
    _c.set(color).multiplyScalar(1.6);
    for (let i = 0; i < 8 * strength; i++) {
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.9).add(normal).normalize().multiplyScalar(4 + Math.random() * 5);
      this.particles.emit({ x: pos.x, y: pos.y, z: pos.z, vx: _v.x, vy: _v.y, vz: _v.z, r: _c.r, g: _c.g, b: _c.b, size: 0.09, life: 0.3, drag: 3, gravity: 12 });
    }
    this.puffs.emit(pos.x + normal.x * 0.1, pos.y + normal.y * 0.1, pos.z + normal.z * 0.1, normal.x, normal.y + 0.5, normal.z, 0.12 * strength, 0.35, 0xf2ece4, 1.6, 0.4);
  }

  /** Enemy hit: white flash + coloured sparks. */
  hit(pos: THREE.Vector3, color: THREE.ColorRepresentation, crit: boolean) {
    this.star(pos, crit ? 0xffe040 : 0xffffff, crit ? 0.9 : 0.5, 0.06);
    this.sparks(pos, color, crit ? 16 : 8, crit ? 9 : 6, 0.1, 0.35);
  }

  /** Big cartoon explosion: flash, fireball puffs, dark smoke, sparks, shockwave. */
  explosion(pos: THREE.Vector3, radius: number, color: THREE.ColorRepresentation = 0xff9a2a) {
    this.star(pos, 0xffffff, radius * 1.1, 0.08);
    this.flare(pos, color, radius * 2.8, 0.35, 0.9);
    this.light(pos, color, 90, 0.45);
    this.ring(pos.clone().setY(pos.y + 0.1), 0xfff2c0, radius * 1.3, 0.35, 0.85, true);
    this.puffs.cloud(pos, 10, radius * 0.35, radius * 2.2, 0xffd24a, 0.35, 1);
    this.puffs.cloud(pos, 8, radius * 0.4, radius * 1.8, 0xff7a2a, 0.5, 1);
    this.puffs.cloud(pos, 7, radius * 0.4, radius * 1.4, 0xc8c0c8, 0.9, 1.3);
    this.sparks(pos, 0xffc060, 36, radius * 5, 0.13, 0.7, 14);
  }

  /** Enemy defeat poof. */
  poof(pos: THREE.Vector3, color: THREE.ColorRepresentation, size = 1) {
    this.puffs.cloud(pos, 9, size * 0.5, size * 3, 0xffffff, 0.6, 0.8);
    this.puffs.cloud(pos, 4, size * 0.35, size * 2, color, 0.5, 0.8);
    this.star(pos, 0xffffff, size * 1.2, 0.08);
    this.sparks(pos, 0xffe070, 14, 7 * size, 0.12, 0.6, 8);
  }

  dust(pos: THREE.Vector3, count: number, radius: number, color: THREE.ColorRepresentation = 0xe8dcc8) {
    this.puffs.ring(pos, count, radius, 0.22, color, 2.5);
  }

  pickupSparkle(pos: THREE.Vector3, color: THREE.ColorRepresentation) {
    this.flare(pos, color, 1.4, 0.25, 0.9);
    this.ring(pos, color, 1.4, 0.3, 0.9);
    this.sparks(pos, color, 14, 5, 0.1, 0.5, -2);
  }

  update(dt: number) {
    this.puffs.update(dt);
    for (const L of this.lights) {
      if (L.t >= L.dur) {
        L.light.intensity = 0;
        continue;
      }
      L.t += dt;
      const k = Math.max(0, 1 - L.t / L.dur);
      L.light.intensity = L.peak * k * k;
    }
    const camQ = this.camera.quaternion;
    for (const list of [this.rings, this.flares, this.stars]) {
      for (const r of list) {
        if (!r.active) continue;
        r.t += dt;
        const k = r.t / r.dur;
        if (k >= 1) {
          r.active = false;
          r.obj.visible = false;
          continue;
        }
        const e = 1 - Math.pow(1 - k, 3);
        const s = r.s0 + (r.s1 - r.s0) * e;
        r.obj.scale.set(s, s, s);
        if (list === this.rings) {
          if (r.obj.userData.flat) r.obj.rotation.set(-Math.PI / 2, 0, 0);
          else r.obj.quaternion.copy(camQ);
        }
        if (list === this.stars) ((r.obj as THREE.Sprite).material as THREE.SpriteMaterial).rotation = r.spin;
        ((r.obj as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = r.opacity * (1 - k);
      }
    }
    for (const tr of this.tracers) {
      if (!tr.active) continue;
      tr.t += dt;
      const k = tr.t / tr.dur;
      if (k >= 1) {
        tr.active = false;
        tr.mesh.visible = false;
        continue;
      }
      (tr.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    }
  }

  clear() {
    this.puffs.clear();
    for (const list of [this.rings, this.flares, this.stars]) for (const r of list) { r.active = false; r.obj.visible = false; }
    for (const tr of this.tracers) { tr.active = false; tr.mesh.visible = false; }
    for (const L of this.lights) { L.t = L.dur; L.light.intensity = 0; }
  }
}
