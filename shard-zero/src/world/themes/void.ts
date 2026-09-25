import * as THREE from 'three';
import { Disposer } from '../../utils/Disposer';
import { GeoBuilder } from '../../utils/GeoBuilder';
import { Rng } from '../../utils/MathUtils';
import { glowTexture } from '../../utils/textures';
import { chunkFromParts, glow, type EmissiveEntry, type ThemeDef, type ThemeInstance, type Animator } from './Theme';

/** LEVEL 4 — THE VOID: open space, floating platforms, colossal slow-turning geometry. */
export const voidTheme: ThemeDef = {
  id: 'void',
  fog: { color: 0x07031a, density: 0.0075 },
  background: 0x03010c,
  hemi: { sky: 0x5a44c0, ground: 0x05020f, intensity: 0.3 },
  lights: { a: 0x8a6bff, b: 0x3affd8, ia: 30, ib: 45 },
  envIntensity: 1,
  exposure: 0.95,
  bloom: { strength: 0.8, radius: 0.7, threshold: 0.85 },
  glass: 0x9ff7ff,
  accent: 0x6affe0,
  dust: { color: 0xb8a8ff, size: 0.18, opacity: 0.55 },
  floorY: null,
  viewDistance: 200,
  roll: 0.07,
  inside: () => true,
  create(): ThemeInstance {
    const d = new Disposer();
    const emissives: EmissiveEntry[] = [];
    const L = 40;

    // Camera-following sky: stars + nebula clouds
    const decor = new THREE.Group();
    const starCount = 3000;
    const sp = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = 380;
      const s = Math.sqrt(1 - u * u);
      sp[i * 3] = s * Math.cos(th) * r;
      sp[i * 3 + 1] = u * r;
      sp[i * 3 + 2] = s * Math.sin(th) * r;
    }
    const starGeo = d.track(new THREE.BufferGeometry());
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const starMat = d.track(new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 }));
    decor.add(new THREE.Points(starGeo, starMat));
    const nebCols = [0x6a3cff, 0x1fd6c8, 0xff3cae, 0x3a6aff];
    for (let i = 0; i < 6; i++) {
      const m = d.track(new THREE.SpriteMaterial({ map: glowTexture(), color: nebCols[i % nebCols.length], transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      const s = new THREE.Sprite(m);
      const a = (i / 6) * Math.PI * 2;
      s.position.set(Math.cos(a) * 300, Math.sin(a * 1.7) * 90 + 20, -200 + Math.sin(a) * 150);
      s.scale.setScalar(260 + Math.random() * 120);
      decor.add(s);
    }

    const tileMat = d.track(new THREE.MeshStandardMaterial({ color: 0x0a0818, roughness: 0.2, metalness: 0.9, emissive: 0x2affd0, emissiveIntensity: 0.12 }));
    const tileEdge = glow(d, emissives, 0x3affd8, 1.8, { pulse: 1.2 });
    const platMat = d.track(new THREE.MeshStandardMaterial({ color: 0x0d0a1c, roughness: 0.35, metalness: 0.85 }));
    const platEdge = glow(d, emissives, 0x8a6bff, 2.0);
    const monoMat = d.track(new THREE.MeshStandardMaterial({ color: 0x05040a, roughness: 0.1, metalness: 1 }));
    const tileGeo = d.track(new THREE.BoxGeometry(1.4, 0.08, 1.4));
    const tileEdgeGeo = d.track(new THREE.BoxGeometry(1.5, 0.02, 0.05));
    const boxGeo = d.track(new THREE.BoxGeometry(1, 1, 1));
    const edgeGeo = d.track(new THREE.BoxGeometry(1, 0.04, 0.04));

    const variants: [THREE.Material, THREE.BufferGeometry][][] = [];
    const vr = new Rng(404);
    for (let v = 0; v < 4; v++) {
      const b = new GeoBuilder();
      for (let z = -L / 2 + 2; z < L / 2; z += 4) {
        b.add(tileMat, tileGeo, [0, -1.6, z]);
        b.add(tileEdge, tileEdgeGeo, [0, -1.55, z - 0.72]);
        b.add(tileEdge, tileEdgeGeo, [0, -1.55, z + 0.72]);
      }
      const plats = vr.int(3, 6);
      for (let i = 0; i < plats; i++) {
        const w = vr.range(3, 9), dd = vr.range(3, 10), h = vr.range(0.5, 1.4);
        const x = vr.sign() * vr.range(7, 30), y = vr.range(-14, -3), z = vr.range(-L / 2, L / 2);
        b.add(platMat, boxGeo, [x, y, z], [0, 0, 0], [w, h, dd]);
        b.add(platEdge, edgeGeo, [x, y + h / 2, z - dd / 2], [0, 0, 0], [w, 1, 1]);
        b.add(platEdge, edgeGeo, [x, y + h / 2, z + dd / 2], [0, 0, 0], [w, 1, 1]);
        b.add(platEdge, edgeGeo, [x - w / 2, y + h / 2, z], [0, Math.PI / 2, 0], [dd, 1, 1]);
        b.add(platEdge, edgeGeo, [x + w / 2, y + h / 2, z], [0, Math.PI / 2, 0], [dd, 1, 1]);
      }
      if (vr.chance(0.6)) {
        const x = vr.sign() * vr.range(14, 40);
        b.add(monoMat, boxGeo, [x, vr.range(4, 18), vr.range(-L / 2, L / 2)], [0, vr.range(0, 3), vr.range(-0.3, 0.3)], [2, vr.range(12, 26), 2]);
      }
      variants.push(b.build());
    }
    for (const v of variants) for (const [, g] of v) d.track(g);

    // Colossal structures and ring gates
    const giantGeos = [new THREE.TorusKnotGeometry(16, 3.2, 128, 12), new THREE.IcosahedronGeometry(22, 1), new THREE.TorusGeometry(26, 1.2, 12, 96)].map((g) => d.track(g));
    const giantSolid = d.track(new THREE.MeshStandardMaterial({ color: 0x0c0920, metalness: 0.95, roughness: 0.2 }));
    const giantWire = glow(d, emissives, 0xff4ad0, 1.2, { transparent: true, opacity: 0.6 });
    giantWire.wireframe = true;
    const ringGeo = d.track(new THREE.TorusGeometry(13, 0.25, 8, 96));
    const ringMat = glow(d, emissives, 0x6affe0, 1.6, { pulse: 2 });

    return {
      chunkLength: L,
      emissives,
      decor,
      buildChunk(index, rng) {
        const g = chunkFromParts(variants[rng.int(0, variants.length - 1)]);
        g.position.z = -index * L - L / 2;
        const anims: Animator[] = [];
        if (index % 3 === 1) {
          const k = rng.int(0, giantGeos.length - 1);
          const giant = new THREE.Group();
          giant.add(new THREE.Mesh(giantGeos[k], giantSolid));
          const w = new THREE.Mesh(giantGeos[k], giantWire);
          w.scale.setScalar(1.01);
          giant.add(w);
          giant.position.set(rng.sign() * rng.range(70, 120), rng.range(-10, 40), rng.range(-10, 10));
          g.add(giant);
          const s = rng.range(0.03, 0.08);
          anims.push((t) => giant.rotation.set(t * s, t * s * 1.3, 0));
        }
        if (index % 4 === 2) {
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.position.set(0, 2.5, 0);
          g.add(ring);
          anims.push((t) => (ring.rotation.z = t * 0.2));
        }
        g.userData.animators = anims;
        return g;
      },
      update(t, _dt, cam) {
        decor.position.copy(cam);
        decor.rotation.y = t * 0.004;
      },
      dispose: () => d.dispose(),
    };
  },
};
