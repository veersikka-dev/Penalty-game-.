import * as THREE from 'three';
import { Disposer } from '../../utils/Disposer';
import { GeoBuilder } from '../../utils/GeoBuilder';
import { Rng } from '../../utils/MathUtils';
import { chunkFromParts, glow, type EmissiveEntry, type ThemeDef, type ThemeInstance, type Animator } from './Theme';

/** LEVEL 1 — THE AWAKENING: a black, mirror-like corridor lined with cold blue light. */
export const awakeningTheme: ThemeDef = {
  id: 'awakening',
  fog: { color: 0x02040a, density: 0.03 },
  background: 0x010208,
  hemi: { sky: 0x2a4270, ground: 0x020306, intensity: 0.18 },
  lights: { a: 0x5fb4ff, b: 0xcfe6ff, ia: 22, ib: 30 },
  envIntensity: 0.6,
  exposure: 0.95,
  bloom: { strength: 0.75, radius: 0.5, threshold: 0.85 },
  glass: 0x8fd8ff,
  accent: 0x5fd4ff,
  dust: { color: 0x8fc8ff, size: 0.12, opacity: 0.55 },
  floorY: 0,
  viewDistance: 130,
  roll: 0,
  inside: (x, y) => Math.abs(x) < 5.4 && y < 7.4,
  create(): ThemeInstance {
    const d = new Disposer();
    const emissives: EmissiveEntry[] = [];
    const L = 24;
    const floorMat = d.track(new THREE.MeshStandardMaterial({ color: 0x05070c, roughness: 0.06, metalness: 0.95, envMapIntensity: 0.9 }));
    const wallMat = d.track(new THREE.MeshStandardMaterial({ color: 0x080a10, roughness: 0.45, metalness: 0.7 }));
    const ribMat = d.track(new THREE.MeshStandardMaterial({ color: 0x07090f, roughness: 0.15, metalness: 0.9 }));
    const strip = glow(d, emissives, 0x3fa9ff, 3.2);
    const frame = glow(d, emissives, 0xbfe4ff, 2.6, { pulse: 1.4 });
    const frameDim = glow(d, emissives, 0x3a6aa0, 0.8, { pulse: 3.1, phase: 1 });
    const line = glow(d, emissives, 0x1d5fa8, 1.1);
    const panel = glow(d, emissives, 0x16325a, 1.2, { pulse: 0.6 });

    const floorGeo = d.track(new THREE.PlaneGeometry(11, L).rotateX(-Math.PI / 2));
    const wallGeo = d.track(new THREE.PlaneGeometry(L, 7.5));
    const stripGeo = d.track(new THREE.BoxGeometry(0.06, 0.06, L));
    const frameV = d.track(new THREE.BoxGeometry(0.14, 7.5, 0.14));
    const frameH = d.track(new THREE.BoxGeometry(10.8, 0.14, 0.14));
    const lineGeo = d.track(new THREE.BoxGeometry(10.6, 0.01, 0.05));
    const panelGeo = d.track(new THREE.PlaneGeometry(2.6, 1.1));
    const ribGeo = d.track(new THREE.BoxGeometry(0.35, 7.5, 0.5));

    // Pre-merge a few chunk variants so each chunk is ~8 draw calls
    const variants: [THREE.Material, THREE.BufferGeometry][][] = [];
    const vr = new Rng(101);
    for (let v = 0; v < 4; v++) {
      const b = new GeoBuilder();
      b.add(floorMat, floorGeo, [0, 0, 0]);
      b.add(wallMat, floorGeo, [0, 7.5, 0], [Math.PI, 0, 0]);
      b.add(wallMat, wallGeo, [-5.5, 3.75, 0], [0, Math.PI / 2, 0]);
      b.add(wallMat, wallGeo, [5.5, 3.75, 0], [0, -Math.PI / 2, 0]);
      for (const sx of [-1, 1]) {
        b.add(strip, stripGeo, [sx * 5.2, 0.03, 0]);
        b.add(strip, stripGeo, [sx * 5.2, 7.45, 0]);
        for (let z = -10; z <= 10; z += 4) b.add(ribMat, ribGeo, [sx * 5.35, 3.75, z]);
      }
      for (const fz of [-6, 6]) {
        const m = vr.chance(0.3) ? frameDim : frame;
        b.add(m, frameV, [-5.2, 3.75, fz]);
        b.add(m, frameV, [5.2, 3.75, fz]);
        b.add(m, frameH, [0, 7.35, fz]);
        b.add(m, frameH, [0, 0.02, fz], [0, 0, 0], [1, 0.3, 1]);
      }
      for (const z of [-9, -3, 3, 9]) b.add(line, lineGeo, [0, 0.012, z]);
      const np = vr.int(1, 3);
      for (let i = 0; i < np; i++) {
        const sx = vr.sign();
        b.add(panel, panelGeo, [sx * 5.3, vr.range(2, 5.5), vr.range(-10, 10)], [0, -sx * Math.PI / 2, 0]);
      }
      variants.push(b.build());
    }
    for (const v of variants) for (const [, g] of v) d.track(g);

    return {
      chunkLength: L,
      emissives,
      buildChunk(index, rng) {
        const g = chunkFromParts(variants[rng.int(0, variants.length - 1)]);
        g.position.z = -index * L - L / 2;
        return g;
      },
      update(t) {
        void t;
      },
      dispose: () => d.dispose(),
    };
  },
};

export type { Animator };
