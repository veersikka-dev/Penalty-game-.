import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { outline, toon, glowMat } from '../render/Toon';
import type { PigModel } from '../player/PigModel';
import type { Loadout } from '../core/Settings';

export type CosmeticCat = 'hat' | 'glasses' | 'pack' | 'armor' | 'body' | 'skin';

export interface Cosmetic {
  id: string;
  cat: CosmeticCat;
  name: string;
  price: number;
  /** Secret stars required instead of / in addition to coins. */
  stars?: number;
  color?: number;
  hideBand?: boolean;
  build?: () => THREE.Object3D;
}

const ink = <T extends THREE.Mesh>(m: T, t = 0.015) => outline(m, t);
const mesh = (geo: THREE.BufferGeometry, color: number, t = 0.015) => ink(new THREE.Mesh(geo, toon(color)), t);

/** Hats sit on the head socket (origin at the crown). */
const hats: Cosmetic[] = [
  { id: 'band', cat: 'hat', name: 'Warrior Band', price: 0 },
  {
    id: 'cowboy', cat: 'hat', name: 'Cowboy Hat', price: 120, hideBand: true,
    build: () => {
      const g = new THREE.Group();
      const brim = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 28), 0x9a6a3a);
      brim.scale.set(1, 1, 0.85);
      brim.position.y = -0.02;
      const crown = mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.34, 20), 0x9a6a3a);
      crown.position.y = 0.16;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.07, 20), toon(0x4a2a1a));
      band.position.y = 0.04;
      g.add(brim, crown, band);
      g.rotation.x = -0.12;
      return g;
    },
  },
  {
    id: 'astro', cat: 'hat', name: 'Astronaut Helmet', price: 260, hideBand: true,
    build: () => {
      const g = new THREE.Group();
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 20), toon(0xbfefff, { transparent: true, opacity: 0.3 }));
      ink(bubble, 0.012);
      bubble.position.set(0, -0.28, 0.02);
      const ring = mesh(new THREE.TorusGeometry(0.5, 0.07, 10, 28), 0xf2f4f8);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.78;
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glowMat(0xff5a5a, 2));
      light.position.set(0.3, 0.2, 0.3);
      g.add(bubble, ring, light);
      return g;
    },
  },
  {
    id: 'ninja', cat: 'hat', name: 'Ninja Hood', price: 200, hideBand: true,
    build: () => {
      const g = new THREE.Group();
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.43, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), toon(0x2a2438));
      ink(hood, 0.015);
      hood.position.y = -0.28;
      hood.scale.set(1.05, 1, 1.02);
      const mask = mesh(new THREE.CylinderGeometry(0.42, 0.4, 0.2, 24, 1, true), 0x2a2438);
      (mask.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;
      mask.position.set(0, -0.52, 0.01);
      const tails = new THREE.Group();
      for (const s of [-1, 1]) {
        const t = mesh(new RoundedBoxGeometry(0.07, 0.02, 0.4, 1, 0.01), 0xe8413c, 0.008);
        t.position.set(s * 0.05, -0.25, -0.55);
        t.rotation.set(0.5, s * 0.3, 0);
        tails.add(t);
      }
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 28), toon(0xe8413c));
      band.rotation.x = Math.PI / 2 - 0.1;
      band.position.y = -0.14;
      g.add(hood, mask, tails, band);
      return g;
    },
  },
  {
    id: 'chef', cat: 'hat', name: 'Chef Toque', price: 160, hideBand: true,
    build: () => {
      const g = new THREE.Group();
      const base = mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.26, 20), 0xffffff);
      base.position.y = 0.06;
      g.add(base);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const puff = mesh(new THREE.SphereGeometry(0.2, 12, 10), 0xffffff, 0.012);
        puff.position.set(Math.cos(a) * 0.18, 0.34, Math.sin(a) * 0.18);
        g.add(puff);
      }
      const top = mesh(new THREE.SphereGeometry(0.24, 12, 10), 0xffffff, 0.012);
      top.position.y = 0.42;
      g.add(top);
      return g;
    },
  },
  {
    id: 'space', cat: 'hat', name: 'Space Cadet Cap', price: 300, stars: 1, hideBand: true,
    build: () => {
      const g = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.45), toon(0x6a5cff));
      ink(cap, 0.015);
      cap.position.y = -0.22;
      const fin = mesh(new RoundedBoxGeometry(0.08, 0.3, 0.5, 2, 0.04), 0xffd23f);
      fin.position.set(0, 0.12, -0.05);
      g.add(cap, fin);
      for (const s of [-1, 1]) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 5), toon(0xc8c8d8));
        ant.position.set(s * 0.2, 0.2, 0);
        ant.rotation.z = -s * 0.4;
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glowMat(0x3affd8, 2));
        ball.position.set(s * 0.28, 0.36, 0);
        g.add(ant, ball);
      }
      return g;
    },
  },
  {
    id: 'crown', cat: 'hat', name: 'Royal Crown', price: 600, stars: 3, hideBand: true,
    build: () => {
      const g = new THREE.Group();
      const ring = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 20, 1, true), 0xffc93a);
      (ring.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;
      ring.position.y = 0.05;
      g.add(ring);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spike = mesh(new THREE.ConeGeometry(0.06, 0.18, 4), 0xffc93a, 0.01);
        spike.position.set(Math.cos(a) * 0.29, 0.2, Math.sin(a) * 0.29);
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), toon([0xff3a5a, 0x3ad0ff, 0x6aff6a][i % 3]));
        gem.position.set(Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3);
        g.add(spike, gem);
      }
      return g;
    },
  },
  {
    id: 'party', cat: 'hat', name: 'Party Hat', price: 80,
    build: () => {
      const g = new THREE.Group();
      const cone = mesh(new THREE.ConeGeometry(0.2, 0.5, 16), 0xff6aa8);
      cone.position.y = 0.22;
      const pom = mesh(new THREE.SphereGeometry(0.07, 10, 8), 0xffe04a, 0.01);
      pom.position.y = 0.5;
      g.add(cone, pom);
      g.rotation.z = 0.25;
      return g;
    },
  },
];

const glasses: Cosmetic[] = [
  { id: 'none', cat: 'glasses', name: 'No Glasses', price: 0 },
  {
    id: 'aviators', cat: 'glasses', name: 'Aviators', price: 90,
    build: () => {
      const g = new THREE.Group();
      for (const s of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), toon(0x2a2a3a));
        lens.scale.set(1.1, 0.85, 0.35);
        lens.position.set(s * 0.155, 0, 0.02);
        ink(lens, 0.008);
        g.add(lens);
      }
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4).rotateZ(Math.PI / 2), toon(0xffc93a));
      bridge.position.set(0, 0.05, 0.05);
      g.add(bridge);
      return g;
    },
  },
  {
    id: 'nerd', cat: 'glasses', name: 'Smart Specs', price: 70,
    build: () => {
      const g = new THREE.Group();
      for (const s of [-1, 1]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 6, 20), toon(0x2a2a3a));
        rim.position.set(s * 0.155, 0, 0.04);
        g.add(rim);
      }
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 4).rotateZ(Math.PI / 2), toon(0x2a2a3a));
      bridge.position.set(0, 0.02, 0.05);
      g.add(bridge);
      return g;
    },
  },
  {
    id: 'visor', cat: 'glasses', name: 'Tactical Visor', price: 180,
    build: () => {
      const g = new THREE.Group();
      const v = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.13, 0.08, 2, 0.04), glowMat(0x3affd8, 1.6, { transparent: true, opacity: 0.85 }));
      v.position.set(0, 0, 0.04);
      g.add(v);
      return g;
    },
  },
  {
    id: 'star', cat: 'glasses', name: 'Star Shades', price: 240, stars: 2,
    build: () => {
      const g = new THREE.Group();
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        const r = i % 2 ? 0.05 : 0.12;
        if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      for (const s of [-1, 1]) {
        const st = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }), toon(0xff5ac8));
        ink(st, 0.008);
        st.position.set(s * 0.155, 0, 0.04);
        g.add(st);
      }
      return g;
    },
  },
];

const packs: Cosmetic[] = [
  { id: 'tactical', cat: 'pack', name: 'Tactical Pack', price: 0 },
  {
    id: 'jetpack', cat: 'pack', name: 'Jet Pack', price: 280,
    build: () => {
      const g = new THREE.Group();
      for (const s of [-1, 1]) {
        const tank = mesh(new THREE.CapsuleGeometry(0.1, 0.3, 4, 12), 0xd8dde8);
        tank.position.set(s * 0.11, 0.22, -0.36);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 8).rotateX(Math.PI), glowMat(0xff9a2a, 2));
        flame.position.set(s * 0.11, -0.02, -0.36);
        const cap = mesh(new THREE.ConeGeometry(0.1, 0.12, 12), 0xe8413c, 0.01);
        cap.position.set(s * 0.11, 0.47, -0.36);
        g.add(tank, flame, cap);
      }
      return g;
    },
  },
  {
    id: 'teddy', cat: 'pack', name: 'Teddy Buddy', price: 150,
    build: () => {
      const g = new THREE.Group();
      const body = mesh(new THREE.SphereGeometry(0.16, 14, 10), 0xb88a5a);
      body.position.set(0, 0.18, -0.38);
      const head = mesh(new THREE.SphereGeometry(0.12, 14, 10), 0xb88a5a);
      head.position.set(0, 0.4, -0.38);
      for (const s of [-1, 1]) {
        const ear = mesh(new THREE.SphereGeometry(0.045, 8, 6), 0xb88a5a, 0.008);
        ear.position.set(s * 0.09, 0.5, -0.38);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), toon(0x1a1024));
        eye.position.set(s * 0.04, 0.42, -0.27);
        g.add(ear, eye);
      }
      g.add(body, head);
      return g;
    },
  },
  {
    id: 'balloon', cat: 'pack', name: 'Lucky Balloon', price: 110,
    build: () => {
      const g = new THREE.Group();
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.9, 4), toon(0xffffff));
      string.position.set(0, 0.6, -0.33);
      const ball = mesh(new THREE.SphereGeometry(0.2, 16, 12), 0xff4a6a);
      ball.scale.set(1, 1.2, 1);
      ball.position.set(0, 1.15, -0.33);
      g.add(string, ball);
      return g;
    },
  },
];

const colorItem = (cat: CosmeticCat, id: string, name: string, color: number, price: number, stars?: number): Cosmetic => ({ id, cat, name, color, price, stars });

const armors: Cosmetic[] = [
  colorItem('armor', 'teal', 'Hero Teal', 0x3fb6c9, 0),
  colorItem('armor', 'camo', 'Jungle Camo', 0x5a7a3a, 90),
  colorItem('armor', 'ninja', 'Shadow Black', 0x2a2438, 120),
  colorItem('armor', 'space', 'Space White', 0xf2f4f8, 140),
  colorItem('armor', 'brown', 'Ranch Leather', 0x9a6a3a, 90),
  colorItem('armor', 'gold', 'Golden Armor', 0xffc93a, 500, 2),
];

const bodies: Cosmetic[] = [
  colorItem('body', 'pink', 'Classic Pink', 0xffa6bd, 0),
  colorItem('body', 'peach', 'Peachy', 0xffc49a, 60),
  colorItem('body', 'mud', 'Muddy Brown', 0xc08a6a, 60),
  colorItem('body', 'mint', 'Minty', 0x9ae8c8, 120),
  colorItem('body', 'lilac', 'Lilac', 0xc8a8ff, 120),
  colorItem('body', 'golden', 'Golden Hog', 0xffd86a, 450, 3),
];

const skins: Cosmetic[] = [
  { id: 'classic', cat: 'skin', name: 'Classic Blaster', price: 0 },
  { id: 'candy', cat: 'skin', name: 'Candy Swirl', price: 150 },
  { id: 'jungle', cat: 'skin', name: 'Jungle Wood', price: 150 },
  { id: 'neon', cat: 'skin', name: 'Neon Night', price: 220 },
  { id: 'gold', cat: 'skin', name: 'Solid Gold', price: 500, stars: 2 },
];

export const COSMETICS: Cosmetic[] = [...hats, ...glasses, ...packs, ...armors, ...bodies, ...skins];
export const COSMETIC_CATS: { id: CosmeticCat; name: string }[] = [
  { id: 'hat', name: 'Hats' },
  { id: 'glasses', name: 'Glasses' },
  { id: 'pack', name: 'Backpacks' },
  { id: 'armor', name: 'Armor' },
  { id: 'body', name: 'Colors' },
  { id: 'skin', name: 'Blaster Skins' },
];

export const OUTFITS: { name: string; loadout: Partial<Loadout> }[] = [
  { name: 'Cowboy Pig', loadout: { hat: 'cowboy', glasses: 'aviators', armor: 'brown', pack: 'tactical' } },
  { name: 'Astronaut Pig', loadout: { hat: 'astro', glasses: 'none', armor: 'space', pack: 'jetpack' } },
  { name: 'Ninja Pig', loadout: { hat: 'ninja', glasses: 'none', armor: 'ninja', pack: 'tactical' } },
  { name: 'Chef Pig', loadout: { hat: 'chef', glasses: 'nerd', armor: 'space', pack: 'teddy' } },
  { name: 'Space Pig', loadout: { hat: 'space', glasses: 'visor', armor: 'ninja', pack: 'jetpack', skin: 'neon' } },
];

export const cosmetic = (id: string) => COSMETICS.find((c) => c.id === id);
export const isFree = (c: Cosmetic) => c.price === 0 && !c.stars;

/** Applies a loadout to a pig model: swaps hat/glasses/pack meshes and colours. */
export function applyLoadout(pig: PigModel, lo: Loadout) {
  const clear = (socket: THREE.Object3D) => {
    for (const c of [...socket.children]) if (c !== pig.defaultPack) socket.remove(c);
  };
  clear(pig.hatSocket);
  clear(pig.faceSocket);
  clear(pig.backSocket);
  const hat = cosmetic(lo.hat);
  pig.headband.visible = !hat?.hideBand;
  if (hat?.build) pig.hatSocket.add(hat.build());
  const gl = cosmetic(lo.glasses);
  if (gl?.build) pig.faceSocket.add(gl.build());
  const pack = cosmetic(lo.pack);
  pig.defaultPack.visible = !pack?.build;
  if (pig.defaultPack.parent !== pig.backSocket) pig.backSocket.add(pig.defaultPack);
  if (pack?.build) pig.backSocket.add(pack.build());
  const armor = cosmetic(lo.armor);
  const body = cosmetic(lo.body);
  const skin = new THREE.Color(body?.color ?? 0xffa6bd);
  const dark = skin.clone().offsetHSL(0, 0.05, -0.1);
  const light = skin.clone().offsetHSL(0, -0.05, 0.08);
  pig.setColors({ skin: skin.getHex(), skinDark: dark.getHex(), belly: light.getHex(), armor: armor?.color ?? 0x3fb6c9 });
  pig.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name !== 'outline') o.castShadow = true;
  });
}
