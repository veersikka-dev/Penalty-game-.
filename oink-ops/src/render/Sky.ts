import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from './Toon';
import { Rng } from '../utils/MathUtils';

export interface SkyStyle {
  top: number;
  horizon: number;
  bottom: number;
  sun: number;
  sunDir: [number, number, number];
  cloud: number;
  cloudShade: number;
  clouds: number;
  mountains: number[];
  snow: boolean;
  stars?: boolean;
}

/**
 * Painted sky: gradient dome with a soft sun, drifting puffy toon clouds and a
 * ring of layered distant mountains. The dome follows the camera; mountains do not,
 * so they give real parallax.
 */
export class Sky {
  readonly group = new THREE.Group();
  private dome: THREE.Mesh;
  private domeMat: THREE.ShaderMaterial;
  private clouds = new THREE.Group();
  private mountains = new THREE.Group();
  private disposables: { dispose(): void }[] = [];

  constructor(style: SkyStyle, center = new THREE.Vector3()) {
    this.domeMat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(style.top) },
        uHorizon: { value: new THREE.Color(style.horizon) },
        uBottom: { value: new THREE.Color(style.bottom) },
        uSun: { value: new THREE.Color(style.sun) },
        uSunDir: { value: new THREE.Vector3(...style.sunDir).normalize() },
        uStars: { value: style.stars ? 1 : 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uHorizon, uBottom, uSun, uSunDir;
        uniform float uStars;
        varying vec3 vDir;
        float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
        void main() {
          float h = vDir.y;
          vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.75, h), 0.8)) : mix(uHorizon, uBottom, smoothstep(0.0, -0.3, h));
          float s = max(dot(vDir, uSunDir), 0.0);
          col += uSun * (pow(s, 600.0) * 3.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12);
          if (uStars > 0.5 && h > 0.05) {
            vec3 q = floor(vDir * 260.0);
            float st = step(0.9965, hash(q));
            col += vec3(st) * smoothstep(0.05, 0.4, h) * 0.9;
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const domeGeo = new THREE.SphereGeometry(500, 32, 16);
    this.dome = new THREE.Mesh(domeGeo, this.domeMat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);
    this.disposables.push(domeGeo, this.domeMat);

    // Puffy clouds: each is a merged cluster of spheres
    const rng = new Rng(1234);
    const cloudMat = toon(style.cloud, { fog: false, emissive: style.cloud, emissiveIntensity: 0.45 });
    const sphere = new THREE.IcosahedronGeometry(1, 2);
    for (let i = 0; i < style.clouds; i++) {
      const parts: THREE.BufferGeometry[] = [];
      const n = rng.int(4, 7);
      for (let k = 0; k < n; k++) {
        const g = sphere.clone();
        const s = rng.range(6, 13) * (k === 0 ? 1.3 : 1);
        g.scale(s * 1.2, s * 0.8, s);
        g.translate(rng.range(-14, 14), rng.range(-2, 4), rng.range(-6, 6));
        parts.push(g);
      }
      const geo = mergeGeometries(parts)!;
      parts.forEach((p) => p.dispose());
      this.disposables.push(geo);
      const c = new THREE.Mesh(geo, cloudMat);
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(170, 330);
      c.position.set(Math.cos(a) * r, rng.range(55, 110), Math.sin(a) * r);
      c.rotation.y = rng.range(0, 6);
      c.userData.speed = rng.range(0.4, 1.2);
      this.clouds.add(c);
    }
    sphere.dispose();
    this.group.add(this.clouds);

    // Layered mountain ring (world-anchored)
    const cone = new THREE.ConeGeometry(1, 1, 7, 1);
    const snowCone = new THREE.ConeGeometry(1, 1, 7, 1);
    this.disposables.push(cone, snowCone);
    style.mountains.forEach((col, layer) => {
      const mat = toon(col);
      const count = 16 + layer * 6;
      const radius = 330 - layer * 55;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rng.range(-0.1, 0.1);
        const h = rng.range(45, 110) * (1 - layer * 0.18);
        const w = rng.range(40, 75);
        const m = new THREE.Mesh(cone, mat);
        m.scale.set(w, h, w);
        m.position.set(center.x + Math.cos(a) * radius, h / 2 - 6, center.z + Math.sin(a) * radius);
        m.rotation.y = rng.range(0, 6);
        this.mountains.add(m);
        if (style.snow && layer === 0 && h > 70) {
          const cap = new THREE.Mesh(snowCone, toon(0xffffff));
          cap.scale.set(w * 0.34, h * 0.34, w * 0.34);
          cap.position.set(m.position.x, h - 6 - h * 0.17 + 0.5, m.position.z);
          cap.rotation.y = m.rotation.y;
          this.mountains.add(cap);
        }
      }
    });
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.group);
    scene.add(this.mountains);
  }

  update(t: number, cam: THREE.Vector3) {
    this.group.position.set(cam.x, 0, cam.z);
    this.clouds.rotation.y = t * 0.004;
    for (const c of this.clouds.children) c.position.y += Math.sin(t * 0.2 + c.id) * 0.004;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
    scene.remove(this.mountains);
    this.disposables.forEach((d) => d.dispose());
  }
}
