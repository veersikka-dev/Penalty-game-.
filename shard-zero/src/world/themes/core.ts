import * as THREE from 'three';
import { Disposer } from '../../utils/Disposer';
import { GeoBuilder } from '../../utils/GeoBuilder';
import { Rng } from '../../utils/MathUtils';
import { createEnergyMaterial } from '../../materials/GlassMaterial';
import { chunkFromParts, glow, type EmissiveEntry, type ThemeDef, type ThemeInstance, type Animator } from './Theme';

const R = 6.2;
const CY = 2.5;

/** LEVEL 5 — THE CORE: a living energy tunnel of gold and magenta, spinning rings, blinding speed. */
export const coreTheme: ThemeDef = {
  id: 'core',
  fog: { color: 0x1a0612, density: 0.02 },
  background: 0x0a0208,
  hemi: { sky: 0xc07040, ground: 0x14020c, intensity: 0.3 },
  lights: { a: 0xffb040, b: 0xff3ca0, ia: 30, ib: 45 },
  envIntensity: 1,
  exposure: 0.95,
  bloom: { strength: 0.8, radius: 0.55, threshold: 0.85 },
  glass: 0xffd29a,
  accent: 0xffb040,
  dust: { color: 0xffc080, size: 0.12, opacity: 0.6 },
  floorY: null,
  viewDistance: 140,
  roll: 0.02,
  inside: (x, y) => x * x + (y - CY) * (y - CY) < (R - 0.4) * (R - 0.4),
  create(): ThemeInstance {
    const d = new Disposer();
    const emissives: EmissiveEntry[] = [];
    const L = 24;
    const tunnelMat = d.track(createEnergyMaterial(0xffa030, 0xff2a8a, { side: THREE.BackSide, intensity: 0.4 }));
    const tunnelGeo = d.track(new THREE.CylinderGeometry(R, R, L, 40, 1, true).rotateX(Math.PI / 2));
    const conduit = glow(d, emissives, 0xff4ab0, 1.6, { pulse: 3 });
    const conduitGeo = d.track(new THREE.BoxGeometry(0.14, 0.14, L));
    const ribMat = d.track(new THREE.MeshStandardMaterial({ color: 0x1a0a10, metalness: 0.95, roughness: 0.2 }));
    const ribGeo = d.track(new THREE.TorusGeometry(R - 0.1, 0.22, 6, 40));

    const variants: [THREE.Material, THREE.BufferGeometry][][] = [];
    const vr = new Rng(505);
    for (let v = 0; v < 2; v++) {
      const b = new GeoBuilder();
      b.add(tunnelMat, tunnelGeo, [0, CY, 0]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + v * 0.2;
        b.add(conduit, conduitGeo, [Math.cos(a) * (R - 0.25), CY + Math.sin(a) * (R - 0.25), 0], [0, 0, a]);
      }
      for (const z of [-8, 0, 8]) b.add(ribMat, ribGeo, [0, CY, z]);
      void vr;
      variants.push(b.build());
    }
    for (const v of variants) for (const [, g] of v) d.track(g);

    const arcGeo = d.track(new THREE.TorusGeometry(R - 0.5, 0.1, 6, 48, Math.PI * 1.3));
    const arcA = glow(d, emissives, 0xffc050, 3.2);
    const arcB = glow(d, emissives, 0xff3ca0, 3.2);

    return {
      chunkLength: L,
      emissives,
      buildChunk(index, rng) {
        const g = chunkFromParts(variants[index % 2]);
        g.position.z = -index * L - L / 2;
        const anims: Animator[] = [];
        for (const z of [-4, 4]) {
          const arc = new THREE.Mesh(arcGeo, rng.chance(0.5) ? arcA : arcB);
          arc.position.set(0, CY, z);
          g.add(arc);
          const s = rng.range(0.8, 2.2) * rng.sign();
          const ph = rng.range(0, 6);
          anims.push((t) => (arc.rotation.z = t * s + ph));
        }
        g.userData.animators = anims;
        return g;
      },
      update(t) {
        tunnelMat.uniforms.uTime.value = t;
      },
      dispose: () => d.dispose(),
    };
  },
};
