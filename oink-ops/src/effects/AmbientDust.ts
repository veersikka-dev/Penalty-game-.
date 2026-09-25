import * as THREE from 'three';
import { glowTexture } from '../utils/textures';

/**
 * Floating motes that fill a box around the camera and wrap as the player moves.
 * They sit still in world space, so they stream past and sell the sense of speed.
 */
export class AmbientDust {
  readonly points: THREE.Points;
  private positions: Float32Array;
  private phases: Float32Array;
  private material: THREE.PointsMaterial;
  private count: number;
  private readonly maxCount: number;
  private box = { x: 22, yMin: -3, yMax: 14, zBack: 12, zFront: 90 };

  constructor(maxCount = 1100) {
    this.maxCount = maxCount;
    this.count = maxCount;
    this.positions = new Float32Array(maxCount * 3);
    this.phases = new Float32Array(maxCount);
    for (let i = 0; i < maxCount; i++) {
      this.positions[i * 3] = (Math.random() * 2 - 1) * this.box.x;
      this.positions[i * 3 + 1] = this.box.yMin + Math.random() * (this.box.yMax - this.box.yMin);
      this.positions[i * 3 + 2] = -Math.random() * (this.box.zFront + this.box.zBack) + this.box.zBack;
      this.phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.PointsMaterial({
      map: glowTexture(), size: 0.14, sizeAttenuation: true, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false, color: 0x88ccff,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  setStyle(color: number, size: number, opacity: number) {
    this.material.color.set(color);
    this.material.size = size;
    this.material.opacity = opacity;
  }
  setOpacity(o: number) {
    this.material.opacity = o;
  }
  setCount(n: number) {
    this.count = Math.min(n, this.maxCount);
    this.points.geometry.setDrawRange(0, this.count);
  }

  update(t: number, dt: number, cam: THREE.Vector3) {
    const p = this.positions;
    const b = this.box;
    const span = b.zFront + b.zBack;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      const ph = this.phases[i];
      p[i3] += Math.sin(t * 0.3 + ph) * dt * 0.15;
      p[i3 + 1] += Math.cos(t * 0.25 + ph) * dt * 0.12;
      // wrap relative to the camera
      let dz = p[i3 + 2] - cam.z;
      if (dz > b.zBack) p[i3 + 2] -= span;
      else if (dz < -b.zFront) p[i3 + 2] += span;
      const dx = p[i3] - cam.x;
      if (dx > b.x) p[i3] -= b.x * 2;
      else if (dx < -b.x) p[i3] += b.x * 2;
      dz = 0;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
