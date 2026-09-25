import * as THREE from 'three';
import type { ParticleSystem } from '../destruction/ParticleSystem';
import { glowTexture } from '../utils/textures';

interface TimedLight { light: THREE.PointLight; t: number; dur: number; peak: number }
interface TimedMesh { obj: THREE.Mesh | THREE.Sprite; t: number; dur: number; s0: number; s1: number; active: boolean; opacity: number }

const _v = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * High-level visual effects built from pooled primitives: flash lights, expanding
 * shockwave rings, lens flares and particle bursts. Light count stays constant
 * (unused lights sit at zero intensity) so shaders never need recompiling.
 */
export class VFXManager {
  readonly root = new THREE.Group();
  private lights: TimedLight[] = [];
  private rings: TimedMesh[] = [];
  private flares: TimedMesh[] = [];
  private nextLight = 0;
  motion = true;

  constructor(private particles: ParticleSystem, private camera: THREE.Camera) {
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 40, 2);
      this.root.add(light);
      this.lights.push({ light, t: 1, dur: 1, peak: 0 });
    }
    const ringGeo = new THREE.RingGeometry(0.955, 1, 72);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false;
      m.renderOrder = 11;
      this.root.add(m);
      this.rings.push({ obj: m, t: 0, dur: 1, s0: 1, s1: 2, active: false, opacity: 1 });
    }
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.visible = false;
      s.renderOrder = 12;
      this.root.add(s);
      this.flares.push({ obj: s, t: 0, dur: 1, s0: 1, s1: 2, active: false, opacity: 1 });
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

  private startTimed(list: TimedMesh[], pos: THREE.Vector3, color: THREE.ColorRepresentation, s0: number, s1: number, dur: number, opacity: number) {
    const item = list.find((r) => !r.active) ?? list.reduce((a, b) => (a.t / a.dur > b.t / b.dur ? a : b));
    item.active = true;
    item.t = 0;
    item.dur = dur;
    item.s0 = s0;
    item.s1 = s1;
    item.opacity = opacity;
    item.obj.visible = true;
    item.obj.position.copy(pos);
    ((item.obj as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(color);
  }

  ring(pos: THREE.Vector3, color: THREE.ColorRepresentation, size: number, dur = 0.45, opacity = 0.9) {
    this.startTimed(this.rings, pos, color, size * 0.2, size, dur, opacity);
  }

  flare(pos: THREE.Vector3, color: THREE.ColorRepresentation, size: number, dur = 0.25, opacity = 1) {
    this.startTimed(this.flares, pos, color, size, size * 1.6, dur, opacity);
  }

  sparks(pos: THREE.Vector3, color: THREE.ColorRepresentation, count: number, speed: number, size = 0.18, life = 0.6, gravity = 6) {
    _c.set(color);
    this.particles.burst(pos, _c, count, speed, size, life, { drag: 2.2, gravity, grow: 0 });
  }

  dust(pos: THREE.Vector3, color: THREE.ColorRepresentation, count: number, spread = 1) {
    _c.set(color).multiplyScalar(0.35);
    for (let i = 0; i < count; i++) {
      this.particles.emit({
        x: pos.x + (Math.random() - 0.5) * spread, y: pos.y + (Math.random() - 0.5) * spread, z: pos.z + (Math.random() - 0.5) * spread,
        vx: (Math.random() - 0.5) * 2.5, vy: (Math.random() - 0.3) * 1.5, vz: (Math.random() - 0.5) * 2.5,
        r: _c.r, g: _c.g, b: _c.b, size: 0.9 + Math.random() * 1.2, life: 1 + Math.random() * 1.2, drag: 1.2, grow: 2.4, alpha: 0.5,
      });
    }
  }

  impact(pos: THREE.Vector3, color: THREE.ColorRepresentation, strength = 1) {
    this.flare(pos, color, 2.2 * strength, 0.15);
    this.sparks(pos, color, Math.round(14 * strength), 9 * strength, 0.14, 0.4);
  }

  shatter(pos: THREE.Vector3, color: THREE.ColorRepresentation, scale = 1) {
    this.flare(pos, color, 4 * scale, 0.22);
    this.flare(pos, 0xffffff, 1.8 * scale, 0.1);
    this.ring(pos, color, 2.4 * scale, 0.3, 0.35);
    this.light(pos, color, 60 * scale, 0.35);
    this.sparks(pos, color, Math.round(40 * scale), 14 * scale, 0.16, 0.7);
    this.sparks(pos, 0xffffff, Math.round(16 * scale), 20 * scale, 0.1, 0.35, 0);
    this.dust(pos, color, Math.round(10 * scale), scale);
  }

  explosion(pos: THREE.Vector3, color: THREE.ColorRepresentation, radius: number) {
    this.flare(pos, 0xffffff, radius * 1.4, 0.18);
    this.flare(pos, color, radius * 2.6, 0.5, 0.9);
    this.ring(pos, color, radius * 1.6, 0.5, 0.6);
    this.ring(pos, 0xffffff, radius * 1.1, 0.3, 0.45);
    this.light(pos, color, 220, 0.6);
    this.sparks(pos, color, 120, 26, 0.22, 1.0, 4);
    this.sparks(pos, 0xffd9a0, 60, 36, 0.12, 0.5, 0);
    this.dust(pos, color, 30, radius * 0.4);
  }

  muzzle(pos: THREE.Vector3, dir: THREE.Vector3, color: THREE.ColorRepresentation) {
    _c.set(color);
    for (let i = 0; i < 8; i++) {
      const s = 4 + Math.random() * 6;
      this.particles.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: dir.x * s + (Math.random() - 0.5) * 3, vy: dir.y * s + (Math.random() - 0.5) * 3, vz: dir.z * s + (Math.random() - 0.5) * 3,
        r: _c.r * 2, g: _c.g * 2, b: _c.b * 2, size: 0.12, life: 0.18, drag: 6,
      });
    }
  }

  update(dt: number) {
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
    for (const list of [this.rings, this.flares]) {
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
        if (list === this.rings) r.obj.quaternion.copy(camQ);
        ((r.obj as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = r.opacity * (1 - k);
      }
    }
    void _v;
  }

  clear() {
    for (const list of [this.rings, this.flares]) for (const r of list) { r.active = false; r.obj.visible = false; }
    for (const L of this.lights) { L.t = L.dur; L.light.intensity = 0; }
  }
}
