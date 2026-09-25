import * as THREE from 'three';
import { Disposer } from '../../utils/Disposer';
import { GeoBuilder } from '../../utils/GeoBuilder';
import { Rng } from '../../utils/MathUtils';
import { canvasTexture } from '../../utils/textures';
import { chunkFromParts, glow, type EmissiveEntry, type ThemeDef, type ThemeInstance, type Animator } from './Theme';

/** LEVEL 3 — NEON INDUSTRIAL: pipes, grating, spinning fans and rotating warning beacons. */
export const industrialTheme: ThemeDef = {
  id: 'industrial',
  fog: { color: 0x160805, density: 0.028 },
  background: 0x0c0403,
  hemi: { sky: 0xff9a60, ground: 0x140806, intensity: 0.45 },
  lights: { a: 0xff5a2a, b: 0xffb060, ia: 40, ib: 55 },
  envIntensity: 0.8,
  exposure: 1,
  bloom: { strength: 0.75, radius: 0.5, threshold: 0.85 },
  glass: 0xffc48a,
  accent: 0xff7a3a,
  dust: { color: 0xffb080, size: 0.1, opacity: 0.5 },
  floorY: 0,
  viewDistance: 130,
  roll: 0,
  inside: (x, y) => Math.abs(x) < 5.2 && y < 6.9,
  create(): ThemeInstance {
    const d = new Disposer();
    const emissives: EmissiveEntry[] = [];
    const L = 24;
    const wallTex = d.track(canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#2a2624';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 600; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`;
        g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 30, Math.random() * 30);
      }
      g.strokeStyle = '#0d0b0a';
      g.lineWidth = 3;
      g.strokeRect(2, 2, w - 4, h / 2 - 4);
      g.strokeRect(2, h / 2 + 2, w - 4, h / 2 - 4);
      g.fillStyle = '#4a4440';
      for (const [x, y] of [[10, 10], [w - 10, 10], [10, h / 2 - 10], [w - 10, h / 2 - 10], [10, h / 2 + 10], [w - 10, h / 2 + 10], [10, h - 10], [w - 10, h - 10]]) {
        g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill();
      }
    }));
    wallTex.repeat.set(6, 2);
    const grateTex = d.track(canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#141212';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#3a3532';
      for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 4);
      for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 3, h);
    }));
    grateTex.repeat.set(5, 12);
    const hazardTex = d.track(canvasTexture(64, 64, (g, w, h) => {
      g.fillStyle = '#111';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffae1a';
      for (let i = -2; i < 4; i++) {
        g.beginPath();
        g.moveTo(i * 32, 0); g.lineTo(i * 32 + 16, 0); g.lineTo(i * 32 + 16 + h, h); g.lineTo(i * 32 + h, h);
        g.fill();
      }
    }));
    hazardTex.repeat.set(1, 20);

    const floorMat = d.track(new THREE.MeshStandardMaterial({ map: grateTex, roughness: 0.5, metalness: 0.8, color: 0x9a8f88 }));
    const wallMat = d.track(new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.55, metalness: 0.6, color: 0x8a807a }));
    const ceilMat = d.track(new THREE.MeshStandardMaterial({ color: 0x100c0a, roughness: 0.7, metalness: 0.5 }));
    const hazardMat = d.track(new THREE.MeshStandardMaterial({ map: hazardTex, emissiveMap: hazardTex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.6 }));
    const pipeMat = d.track(new THREE.MeshStandardMaterial({ color: 0x8a5230, roughness: 0.3, metalness: 0.95 }));
    const steelMat = d.track(new THREE.MeshStandardMaterial({ color: 0x3a3634, roughness: 0.4, metalness: 0.9 }));
    const warn = glow(d, emissives, 0xff2a10, 4, { pulse: 5 });
    const orange = glow(d, emissives, 0xff8a2a, 2.4, { pulse: 0.9 });

    const floorGeo = d.track(new THREE.PlaneGeometry(11, L).rotateX(-Math.PI / 2));
    const wallGeo = d.track(new THREE.PlaneGeometry(L, 7));
    const hazardGeo = d.track(new THREE.PlaneGeometry(0.8, L).rotateX(-Math.PI / 2));
    const pipeGeo = d.track(new THREE.CylinderGeometry(0.22, 0.22, L, 10).rotateX(Math.PI / 2));
    const bigPipeGeo = d.track(new THREE.CylinderGeometry(0.38, 0.38, L, 12).rotateX(Math.PI / 2));
    const ringGeo = d.track(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 10).rotateX(Math.PI / 2));
    const beamGeo = d.track(new THREE.BoxGeometry(11, 0.45, 0.3));
    const postGeo = d.track(new THREE.BoxGeometry(0.3, 7, 0.3));
    const warnGeo = d.track(new THREE.BoxGeometry(0.25, 0.25, 0.25));
    const stripGeo = d.track(new THREE.BoxGeometry(0.12, 0.05, L));

    const variants: [THREE.Material, THREE.BufferGeometry][][] = [];
    const vr = new Rng(303);
    for (let v = 0; v < 4; v++) {
      const b = new GeoBuilder();
      b.add(floorMat, floorGeo, [0, 0, 0]);
      b.add(ceilMat, floorGeo, [0, 7, 0], [Math.PI, 0, 0]);
      b.add(orange, stripGeo, [0, 6.95, 0]);
      for (const sx of [-1, 1]) {
        b.add(wallMat, wallGeo, [sx * 5.5, 3.5, 0], [0, -sx * Math.PI / 2, 0]);
        b.add(hazardMat, hazardGeo, [sx * 4.8, 0.01, 0]);
        b.add(pipeMat, pipeGeo, [sx * 5.15, 1.1, 0]);
        b.add(pipeMat, pipeGeo, [sx * 5.15, 1.6, 0]);
        b.add(pipeMat, bigPipeGeo, [sx * 5.0, 6.3, 0]);
        for (let z = -10; z <= 10; z += 5) {
          b.add(steelMat, ringGeo, [sx * 5.15, 1.1, z]);
          b.add(steelMat, ringGeo, [sx * 5.15, 1.6, z]);
        }
      }
      for (const z of [-9, -3, 3, 9]) b.add(steelMat, beamGeo, [0, 6.75, z]);
      for (const z of [-9, 3]) {
        b.add(steelMat, postGeo, [-5.25, 3.5, z]);
        b.add(steelMat, postGeo, [5.25, 3.5, z]);
        b.add(warn, warnGeo, [-5.1, 5.9, z]);
        b.add(warn, warnGeo, [5.1, 5.9, z]);
      }
      void vr;
      variants.push(b.build());
    }
    for (const v of variants) for (const [, g] of v) d.track(g);

    // Animated machinery
    const fanFrame = d.track(new THREE.TorusGeometry(1.25, 0.12, 8, 32));
    const bladeGeo = d.track(new THREE.BoxGeometry(0.28, 2.2, 0.05));
    const hubGeo = d.track(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 12).rotateX(Math.PI / 2));
    const fanGlow = glow(d, emissives, 0xff6a2a, 1.4, { side: THREE.DoubleSide });
    const beamMat = glow(d, emissives, 0xff3a1a, 0.6, { additive: true, side: THREE.DoubleSide, opacity: 0.5 });
    const beamPlane = d.track(new THREE.PlaneGeometry(0.4, 10).translate(0, 5, 0));
    const pistonGeo = d.track(new THREE.BoxGeometry(1.2, 1.4, 1.2));
    const discGeo = d.track(new THREE.CircleGeometry(1.15, 32));

    return {
      chunkLength: L,
      emissives,
      buildChunk(index, rng) {
        const g = chunkFromParts(variants[rng.int(0, variants.length - 1)]);
        g.position.z = -index * L - L / 2;
        const anims: Animator[] = [];
        // Wall fan
        const side = rng.sign();
        const fan = new THREE.Group();
        fan.position.set(side * 5.42, 3.6, rng.range(-6, 6));
        fan.rotation.y = -side * Math.PI / 2;
        const disc = new THREE.Mesh(discGeo, fanGlow);
        disc.position.z = -0.05;
        fan.add(new THREE.Mesh(fanFrame, steelMat), disc);
        const blades = new THREE.Group();
        for (let i = 0; i < 4; i++) {
          const bl = new THREE.Mesh(bladeGeo, steelMat);
          bl.rotation.z = (i * Math.PI) / 4;
          blades.add(bl);
        }
        blades.add(new THREE.Mesh(hubGeo, steelMat));
        fan.add(blades);
        g.add(fan);
        const fs = rng.range(4, 9) * side;
        anims.push((t) => (blades.rotation.z = t * fs));
        // Rotating beacon beams
        for (const z of [-9, 3]) {
          const beam = new THREE.Mesh(beamPlane, beamMat);
          beam.position.set(rng.sign() * 5.1, 5.9, z);
          g.add(beam);
          const ph = rng.range(0, 6);
          anims.push((t) => {
            beam.rotation.set(Math.PI / 2 + Math.sin(t * 3 + ph) * 0.6, t * 4 + ph, 0);
          });
        }
        // Ceiling piston
        if (rng.chance(0.6)) {
          const p = new THREE.Mesh(pistonGeo, steelMat);
          const px = rng.range(-3, 3);
          const pz = rng.range(-8, 8);
          g.add(p);
          const ph = rng.range(0, 6);
          anims.push((t) => p.position.set(px, 6.2 + Math.sin(t * 2.2 + ph) * 0.35, pz));
        }
        g.userData.animators = anims;
        return g;
      },
      update() {},
      dispose: () => d.dispose(),
    };
  },
};
