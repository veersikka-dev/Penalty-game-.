import * as THREE from 'three';

export interface ParticleOpts {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  r: number; g: number; b: number;
  size: number;
  life: number;
  drag?: number;
  gravity?: number;
  /** Size multiplier reached at end of life (0 = shrink away, 2 = double). */
  grow?: number;
  alpha?: number;
}

const VERT = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
varying vec4 vColor;
uniform float uScale;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 0.0, 220.0);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
varying vec4 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, d);
  float core = pow(soft, 6.0);
  gl_FragColor = vec4(vColor.rgb * (0.6 + core * 2.0), vColor.a * soft * soft);
}`;

/**
 * One draw call for every spark, trail puff and energy mote in the game.
 * Particles are stored densely in typed arrays (swap-remove on death) and the
 * GPU buffers are rewritten each frame.
 */
export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly capacity: number;
  cap: number;
  count = 0;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private rgb: Float32Array;
  private size: Float32Array;
  private baseSize: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private drag: Float32Array;
  private grav: Float32Array;
  private grow: Float32Array;
  private alpha: Float32Array;
  private material: THREE.ShaderMaterial;
  private geo: THREE.BufferGeometry;

  constructor(capacity = 9000) {
    this.capacity = capacity;
    this.cap = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 4);
    this.rgb = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 500 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  /** Converts world-size to pixels for the current viewport. */
  setViewport(heightPx: number, fovDeg: number) {
    this.material.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  setCap(n: number) {
    this.cap = Math.min(n, this.capacity);
  }

  emit(o: ParticleOpts) {
    if (this.count >= this.cap) return;
    const i = this.count++;
    const i3 = i * 3;
    this.pos[i3] = o.x; this.pos[i3 + 1] = o.y; this.pos[i3 + 2] = o.z;
    this.vel[i3] = o.vx; this.vel[i3 + 1] = o.vy; this.vel[i3 + 2] = o.vz;
    this.rgb[i3] = o.r; this.rgb[i3 + 1] = o.g; this.rgb[i3 + 2] = o.b;
    this.baseSize[i] = o.size;
    this.life[i] = 0;
    this.maxLife[i] = o.life;
    this.drag[i] = o.drag ?? 1.5;
    this.grav[i] = o.gravity ?? 0;
    this.grow[i] = o.grow ?? 0;
    this.alpha[i] = o.alpha ?? 1;
  }

  /** Emits `n` particles in a sphere around a point. */
  burst(p: THREE.Vector3, color: THREE.Color, n: number, speed: number, size: number, life: number, extra: Partial<ParticleOpts> = {}) {
    for (let k = 0; k < n; k++) {
      // random direction on sphere
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const sp = speed * (0.25 + Math.random() * 0.75);
      this.emit({
        x: p.x, y: p.y, z: p.z,
        vx: s * Math.cos(th) * sp, vy: u * sp, vz: s * Math.sin(th) * sp,
        r: color.r, g: color.g, b: color.b,
        size: size * (0.5 + Math.random()),
        life: life * (0.5 + Math.random() * 0.8),
        ...extra,
      });
    }
  }

  private kill(i: number) {
    const last = --this.count;
    if (i === last) return;
    const i3 = i * 3, l3 = last * 3;
    for (let k = 0; k < 3; k++) {
      this.pos[i3 + k] = this.pos[l3 + k];
      this.vel[i3 + k] = this.vel[l3 + k];
      this.rgb[i3 + k] = this.rgb[l3 + k];
    }
    this.baseSize[i] = this.baseSize[last];
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
    this.drag[i] = this.drag[last];
    this.grav[i] = this.grav[last];
    this.grow[i] = this.grow[last];
    this.alpha[i] = this.alpha[last];
  }

  update(dt: number) {
    let i = 0;
    while (i < this.count) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i]) {
        this.kill(i);
        continue;
      }
      const i3 = i * 3;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i3] *= d;
      this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.grav[i] * dt;
      this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      const fade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
      const i4 = i * 4;
      this.col[i4] = this.rgb[i3];
      this.col[i4 + 1] = this.rgb[i3 + 1];
      this.col[i4 + 2] = this.rgb[i3 + 2];
      this.col[i4 + 3] = fade * this.alpha[i];
      this.size[i] = this.baseSize[i] * (1 + (this.grow[i] - 1) * t);
      i++;
    }
    this.geo.setDrawRange(0, this.count);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  }

  clear() {
    this.count = 0;
    this.geo.setDrawRange(0, 0);
  }
}
