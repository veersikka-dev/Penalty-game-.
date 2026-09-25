import * as THREE from 'three';
import { Disposer } from '../../utils/Disposer';
import { GeoBuilder } from '../../utils/GeoBuilder';
import { Rng } from '../../utils/MathUtils';
import { canvasTexture, shaftTexture } from '../../utils/textures';
import { chunkFromParts, glow, type EmissiveEntry, type ThemeDef, type ThemeInstance, type Animator } from './Theme';

function pointedArch(x0: number, x1: number, y0: number, apex: number, z: number, alongZ = false): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = t < 0.5 ? t * 2 : (1 - t) * 2; // 0 -> 1 -> 0
    const along = x0 + (x1 - x0) * t;
    const y = y0 + (apex - y0) * Math.sin((u * Math.PI) / 2) ** 1.6;
    pts.push(alongZ ? new THREE.Vector3(z, y, along) : new THREE.Vector3(along, y, z));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/** LEVEL 2 — THE GLASS CATHEDRAL: a vast nave of mirrored pillars, stained light and floating geometry. */
export const cathedralTheme: ThemeDef = {
  id: 'cathedral',
  fog: { color: 0x120f22, density: 0.014 },
  background: 0x0a0816,
  hemi: { sky: 0x6a64c0, ground: 0x0a0814, intensity: 0.28 },
  lights: { a: 0xb9a8ff, b: 0x9ff0ff, ia: 30, ib: 45 },
  envIntensity: 1,
  exposure: 0.95,
  bloom: { strength: 0.75, radius: 0.65, threshold: 0.85 },
  glass: 0xd4c8ff,
  accent: 0xc6b8ff,
  dust: { color: 0xe6dcff, size: 0.16, opacity: 0.6 },
  floorY: 0,
  viewDistance: 160,
  roll: 0,
  inside: (x, y) => Math.abs(x) < 9.2 && y < 30,
  create(): ThemeInstance {
    const d = new Disposer();
    const emissives: EmissiveEntry[] = [];
    const L = 24;
    const floorMat = d.track(new THREE.MeshStandardMaterial({ color: 0x14162a, roughness: 0.04, metalness: 0.9, envMapIntensity: 1.2 }));
    const wallMat = d.track(new THREE.MeshStandardMaterial({ color: 0x0e0d1c, roughness: 0.55, metalness: 0.5 }));
    const pillarMat = d.track(new THREE.MeshStandardMaterial({ color: 0x8a96c8, roughness: 0.14, metalness: 0.9, envMapIntensity: 1 }));
    const stained = canvasTexture(128, 512, (g, w, h) => {
      const cols = ['#8a6bff', '#5fd4ff', '#ff8ad8', '#ffe29a', '#7affc8'];
      for (let y = 0; y < h; y += 32) {
        for (let x = 0; x < w; x += 32) {
          g.fillStyle = cols[Math.floor(Math.random() * cols.length)];
          g.globalAlpha = 0.5 + Math.random() * 0.5;
          g.fillRect(x + 2, y + 2, 28, 28);
        }
      }
      g.globalAlpha = 1;
      g.strokeStyle = '#05040a';
      g.lineWidth = 4;
      for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    }, false);
    d.track(stained);
    const windowMat = glow(d, emissives, 0xffffff, 1.1, { map: stained, pulse: 0.4 });
    const archMat = glow(d, emissives, 0xb8a4ff, 2.6, { pulse: 0.8 });
    const pillarLine = glow(d, emissives, 0xe8e0ff, 2.2);
    const runway = glow(d, emissives, 0x7c6cff, 1.2);
    const shaftTex = d.track(shaftTexture());
    const shaftMat = glow(d, emissives, 0xd8ccff, 0.18, { additive: true, map: shaftTex, side: THREE.DoubleSide });

    const floorGeo = d.track(new THREE.PlaneGeometry(19, L).rotateX(-Math.PI / 2));
    const wallGeo = d.track(new THREE.PlaneGeometry(L, 30));
    const pillarGeo = d.track(new THREE.CylinderGeometry(0.8, 0.95, 22, 6));
    const baseGeo = d.track(new THREE.CylinderGeometry(1.25, 1.35, 1.2, 6));
    const lineGeo = d.track(new THREE.BoxGeometry(0.06, 22, 0.06));
    const windowGeo = d.track(new THREE.PlaneGeometry(2.4, 10));
    const shaftGeo = d.track(new THREE.PlaneGeometry(3.2, 22));
    const runGeo = d.track(new THREE.BoxGeometry(0.05, 0.01, L));
    const across = d.track(new THREE.TubeGeometry(pointedArch(-7.2, 7.2, 14, 21, 0), 40, 0.1, 6));
    const alongL = d.track(new THREE.TubeGeometry(pointedArch(-6, 6, 13, 17, -7.2, true), 30, 0.08, 6));
    const alongR = d.track(new THREE.TubeGeometry(pointedArch(-6, 6, 13, 17, 7.2, true), 30, 0.08, 6));

    const variants: [THREE.Material, THREE.BufferGeometry][][] = [];
    const vr = new Rng(202);
    for (let v = 0; v < 3; v++) {
      const b = new GeoBuilder();
      b.add(floorMat, floorGeo, [0, 0, 0]);
      b.add(wallMat, wallGeo, [-9.6, 15, 0], [0, Math.PI / 2, 0]);
      b.add(wallMat, wallGeo, [9.6, 15, 0], [0, -Math.PI / 2, 0]);
      for (const sx of [-1, 1]) {
        b.add(runway, runGeo, [sx * 3.2, 0.012, 0]);
        for (const pz of [-6, 6]) {
          b.add(pillarMat, pillarGeo, [sx * 7.2, 11, pz]);
          b.add(pillarMat, baseGeo, [sx * 7.2, 0.6, pz]);
          b.add(pillarLine, lineGeo, [sx * 6.35, 11, pz]);
        }
        for (const wz of [-6, 6]) b.add(windowMat, windowGeo, [sx * 9.5, 10, wz], [0, -sx * Math.PI / 2, 0]);
        if (vr.chance(0.7)) b.add(shaftMat, shaftGeo, [sx * 6.5, 9, vr.range(-8, 8)], [0, -sx * 0.9, sx * 0.45]);
      }
      b.add(archMat, across, [0, 0, -6]);
      b.add(archMat, across, [0, 0, 6]);
      b.add(archMat, alongL, [0, 0, 0]);
      b.add(archMat, alongR, [0, 0, 0]);
      variants.push(b.build());
    }
    for (const v of variants) for (const [, g] of v) d.track(g);

    const floatMat = d.track(new THREE.MeshStandardMaterial({ color: 0xa8b8ff, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.55, envMapIntensity: 1.5 }));
    const floatWire = glow(d, emissives, 0xd8ccff, 2.0);
    const floatGeos = [new THREE.IcosahedronGeometry(1.4, 0), new THREE.OctahedronGeometry(1.6, 0), new THREE.TetrahedronGeometry(1.7, 0)].map((g) => d.track(g));
    const wireGeos = floatGeos.map((g) => d.track(new THREE.EdgesGeometry(g)));
    const wireLineMat = d.track(new THREE.LineBasicMaterial({ color: floatWire.color }));
    const animators = new Set<Animator>();

    return {
      chunkLength: L,
      emissives,
      buildChunk(index, rng) {
        const g = chunkFromParts(variants[rng.int(0, variants.length - 1)]);
        g.position.z = -index * L - L / 2;
        const n = rng.int(1, 2);
        const anims: Animator[] = [];
        for (let i = 0; i < n; i++) {
          const k = rng.int(0, floatGeos.length - 1);
          const m = new THREE.Mesh(floatGeos[k], floatMat);
          m.add(new THREE.LineSegments(wireGeos[k], wireLineMat));
          const bx = rng.sign() * rng.range(2.5, 6);
          const by = rng.range(9, 16);
          const bz = rng.range(-10, 10);
          const sp = rng.range(0.2, 0.6);
          const ph = rng.range(0, 6);
          m.position.set(bx, by, bz);
          g.add(m);
          anims.push((t) => {
            m.rotation.set(t * sp, t * sp * 0.7 + ph, 0);
            m.position.y = by + Math.sin(t * 0.6 + ph) * 0.8;
          });
        }
        g.userData.animators = anims;
        return g;
      },
      update() {
        void animators;
        wireLineMat.color.copy(floatWire.color);
      },
      dispose: () => d.dispose(),
    };
  },
};
