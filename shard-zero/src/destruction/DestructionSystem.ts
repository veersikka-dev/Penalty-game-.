import * as THREE from 'three';
import type { FragmentSystem } from './FragmentSystem';
import type { ParticleSystem } from './ParticleSystem';
import type { VFXManager } from '../effects/VFXManager';
import type { Target } from '../targets/Target';
import { clamp, rand } from '../utils/MathUtils';

const _local = new THREE.Vector3();
const _world = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _ang = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _rot = new THREE.Euler();
const _q = new THREE.Quaternion();
const _qr = new THREE.Quaternion();
const _c = new THREE.Color();

/**
 * Turns destroyed targets into spectacle: instanced shards whose size falls off
 * towards the impact point, energy sparks, dust, shockwave rings and flash lights.
 */
export class DestructionSystem {
  /** 0.5..1.2 — scales fragment counts with graphics quality. */
  detail = 1;

  constructor(private frags: FragmentSystem, private particles: ParticleSystem, private vfx: VFXManager) {}

  shatter(t: Target) {
    if (t.def.frag === 'glass') this.shatterGlass(t);
    else if (t.def.frag === 'crystal') this.shatterCrystal(t);
  }

  shatterGlass(t: Target) {
    const crash = t.cause === 'crash';
    const color = t.glassMat ? (t.glassMat.uniforms.uColor.value as THREE.Color) : _c.set(t.def.color);
    const area = t.half.x * t.half.y * 4;
    const n = Math.round(clamp(area * 4.5, 10, 38) * this.detail);
    const maxHalf = Math.max(t.half.x, t.half.y);
    const sizeScale = clamp(Math.sqrt(area) / 2.2, 0.6, 1.5);
    const power = t.cause === 'explosion' ? 1.6 : crash ? 1.3 : 1;
    for (let i = 0; i < n; i++) {
      _local.set(rand(-1, 1) * t.half.x, rand(-1, 1) * t.half.y, rand(-1, 1) * t.half.z);
      _world.copy(_local).applyQuaternion(t.quat).add(t.center);
      const dist = _world.distanceTo(t.hitPoint);
      const k = clamp(0.3 + (dist / maxHalf) * 0.7, 0.3, 1.1);
      const s = rand(0.45, 0.95) * k * sizeScale;
      _scale.set(s * rand(0.6, 1.2), s * rand(0.6, 1.2), 1);
      _vel.subVectors(_world, t.hitPoint).normalize().multiplyScalar(rand(1.5, 5) * power);
      if (crash) {
        _vel.x *= 1.8;
        _vel.y = _vel.y * 1.5 + rand(-1, 3);
        _vel.z = rand(2, 10);
      } else {
        _vel.addScaledVector(t.hitDir, rand(2, 8) * power);
        _vel.y += rand(0, 2.5);
      }
      _qr.setFromEuler(_rot.set(rand(-0.4, 0.4), rand(-0.4, 0.4), rand(0, Math.PI * 2)));
      _q.copy(t.quat).multiply(_qr);
      _rot.setFromQuaternion(_q);
      _ang.set(rand(-12, 12), rand(-12, 12), rand(-8, 8));
      this.frags.spawn('glass', _world, _rot, _scale, _vel, _ang, color, rand(1.6, 2.8));
    }
    const scale = 0.6 + Math.sqrt(area) * 0.22;
    this.vfx.shatter(t.hitPoint, color, scale);
    // Glittering dust drifting down from the frame
    _c.copy(color).multiplyScalar(1.5);
    for (let i = 0; i < Math.round(24 * this.detail); i++) {
      _local.set(rand(-1, 1) * t.half.x, rand(-1, 1) * t.half.y, 0).applyQuaternion(t.quat).add(t.center);
      this.particles.emit({
        x: _local.x, y: _local.y, z: _local.z,
        vx: rand(-1, 1), vy: rand(-0.5, 1.5), vz: rand(-1, 1) + (crash ? 4 : 0),
        r: _c.r, g: _c.g, b: _c.b, size: rand(0.05, 0.12), life: rand(0.8, 1.8), drag: 1, gravity: 2.5,
      });
    }
  }

  shatterCrystal(t: Target) {
    _c.set(t.def.color);
    const r = t.radius;
    const n = Math.round((r > 1 ? 16 : 10) * this.detail);
    for (let i = 0; i < n; i++) {
      _local.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      _world.copy(t.center).addScaledVector(_local, r * rand(0.1, 0.6));
      _vel.copy(_local).multiplyScalar(rand(4, 12)).addScaledVector(t.hitDir, rand(1, 5));
      _vel.y += rand(0, 3);
      const s = rand(0.2, 0.45) * r * 1.3;
      _scale.set(s, s * rand(0.8, 1.6), s);
      _rot.set(rand(0, 6), rand(0, 6), rand(0, 6));
      _ang.set(rand(-14, 14), rand(-14, 14), rand(-14, 14));
      this.frags.spawn('crystal', _world, _rot, _scale, _vel, _ang, _c, rand(1.0, 1.8));
    }
    this.vfx.shatter(t.center, _c, r * 1.1);
    _c.set(t.def.color).multiplyScalar(2);
    this.particles.burst(t.center, _c, Math.round(40 * this.detail), 10, 0.12, 0.9, { drag: 2.5, gravity: -1, grow: 0 });
  }

  /** Huge final shatter for the boss core. */
  megaShatter(center: THREE.Vector3, radius: number, color: THREE.ColorRepresentation) {
    _c.set(color);
    for (let i = 0; i < 160; i++) {
      _local.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      _world.copy(center).addScaledVector(_local, radius * rand(0.3, 1));
      _vel.copy(_local).multiplyScalar(rand(8, 30));
      const s = rand(0.5, 1.6);
      _scale.set(s, s * rand(0.8, 1.8), s);
      _rot.set(rand(0, 6), rand(0, 6), rand(0, 6));
      _ang.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
      this.frags.spawn(i % 3 ? 'crystal' : 'glass', _world, _rot, _scale, _vel, _ang, _c, rand(2.5, 4.5));
    }
    this.vfx.explosion(center, color, radius * 2);
  }
}
