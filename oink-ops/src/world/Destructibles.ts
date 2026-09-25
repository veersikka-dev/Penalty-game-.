import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Damageable, DamageInfo, HitShape } from '../combat/types';
import type { CollisionWorld, Box, Cyl } from '../physics/Collision';
import type { FragType } from '../destruction/FragmentSystem';
import { outline, toon } from '../render/Toon';
import { createGlassMaterial } from '../materials/GlassMaterial';
import { rand } from '../utils/MathUtils';

export type PropType =
  | 'crate' | 'barrel' | 'glass' | 'crystal' | 'sign' | 'fence' | 'hay' | 'pumpkin'
  | 'candyJar' | 'gumball' | 'pot' | 'vending' | 'barrier' | 'generator' | 'crackedWall' | 'lamp' | 'mushroom' | 'tnt';

export type BreakSound = 'wood' | 'glass' | 'crystal' | 'metal' | 'candy' | 'stone' | 'squish' | 'energy';

interface PropDef {
  hp: number;
  frag: FragType;
  colors: number[];
  explode?: { radius: number; damage: number };
  coins: [number, number];
  score: number;
  sound: BreakSound;
  fragCount: number;
}

export const PROPS: Record<PropType, PropDef> = {
  crate: { hp: 18, frag: 'wood', colors: [0xc98a4a, 0x9a6230], coins: [1, 3], score: 25, sound: 'wood', fragCount: 10 },
  barrel: { hp: 12, frag: 'metal', colors: [0xe8413c, 0x3a3a4a], explode: { radius: 5, damage: 70 }, coins: [1, 2], score: 50, sound: 'metal', fragCount: 8 },
  tnt: { hp: 8, frag: 'wood', colors: [0xff5a3a, 0xffe07a], explode: { radius: 6.5, damage: 90 }, coins: [2, 4], score: 60, sound: 'wood', fragCount: 8 },
  glass: { hp: 6, frag: 'glass', colors: [0x9fe8ff], coins: [0, 1], score: 20, sound: 'glass', fragCount: 18 },
  crystal: { hp: 20, frag: 'crystal', colors: [0x7fd4ff], coins: [3, 6], score: 80, sound: 'crystal', fragCount: 12 },
  sign: { hp: 10, frag: 'wood', colors: [0xd8a060, 0x8a5a30], coins: [0, 1], score: 15, sound: 'wood', fragCount: 6 },
  fence: { hp: 8, frag: 'wood', colors: [0xf2e2c4, 0xc9a878], coins: [0, 0], score: 10, sound: 'wood', fragCount: 6 },
  hay: { hp: 10, frag: 'bits', colors: [0xf2cc5a, 0xd8a83a], coins: [0, 2], score: 15, sound: 'squish', fragCount: 14 },
  pumpkin: { hp: 8, frag: 'bits', colors: [0xff8a2a, 0x4a8a2a], coins: [1, 2], score: 20, sound: 'squish', fragCount: 10 },
  candyJar: { hp: 10, frag: 'glass', colors: [0xffd0f0], coins: [2, 4], score: 40, sound: 'glass', fragCount: 14 },
  gumball: { hp: 22, frag: 'bits', colors: [0xff4a8a, 0x4ad8ff, 0xffe04a, 0x7aff6a], coins: [3, 6], score: 60, sound: 'candy', fragCount: 20 },
  pot: { hp: 8, frag: 'debris', colors: [0xc8703a, 0x9a5028], coins: [1, 3], score: 20, sound: 'stone', fragCount: 8 },
  vending: { hp: 40, frag: 'metal', colors: [0x3a6aff, 0xdfe6f0], coins: [4, 8], score: 90, sound: 'metal', fragCount: 10 },
  barrier: { hp: 9999, frag: 'glass', colors: [0x6affe0], coins: [0, 0], score: 0, sound: 'energy', fragCount: 20 },
  generator: { hp: 60, frag: 'metal', colors: [0x5a6478, 0x6affe0], explode: { radius: 3.5, damage: 20 }, coins: [4, 6], score: 150, sound: 'metal', fragCount: 10 },
  crackedWall: { hp: 30, frag: 'debris', colors: [0xb8a890, 0x8a7a64], coins: [0, 0], score: 50, sound: 'stone', fragCount: 14 },
  lamp: { hp: 10, frag: 'glass', colors: [0xfff2b0], coins: [0, 1], score: 15, sound: 'glass', fragCount: 8 },
  mushroom: { hp: 12, frag: 'bits', colors: [0xff4a5a, 0xfff2e8], coins: [1, 2], score: 20, sound: 'squish', fragCount: 10 },
};

const _v = new THREE.Vector3();

/**
 * A breakable prop. Owns a collider (removed on break), a toon mesh, and a hit
 * wobble. When it breaks the manager turns it into debris, dust, coins and —
 * for barrels/TNT — an explosion that can chain into its neighbours.
 */
export class Destructible implements Damageable {
  readonly kind = 'prop' as const;
  alive = true;
  hp: number;
  readonly shapes: HitShape[] = [];
  readonly position: THREE.Vector3;
  collider: Box | Cyl | null = null;
  private wobble = 0;
  flash = 0;
  glassMat: THREE.ShaderMaterial | null = null;
  tag: string | null = null;
  onBreak: ((p: Destructible, info: DamageInfo) => void) | null = null;
  pendingExplosion = -1;
  lastHit: DamageInfo | null = null;
  assist = false;

  constructor(readonly type: PropType, readonly mesh: THREE.Object3D, readonly size: THREE.Vector3, readonly def: PropDef) {
    this.hp = def.hp;
    this.position = mesh.position;
  }

  takeDamage(info: DamageInfo) {
    if (!this.alive || this.type === 'barrier') return;
    this.hp -= info.amount;
    this.wobble = 1;
    this.flash = 1;
    this.lastHit = info;
    if (this.glassMat) {
      const u = this.glassMat.uniforms;
      u.uCrack.value = Math.min(1, 0.4 + (1 - this.hp / this.def.hp) * 0.6);
      u.uDamage.value = 1 - Math.max(0, this.hp) / this.def.hp;
    }
    if (this.hp <= 0) {
      this.alive = false;
      this.onBreak?.(this, info);
    }
  }

  update(dt: number, t: number) {
    if (this.wobble > 0) {
      this.wobble = Math.max(0, this.wobble - dt * 4);
      const w = Math.sin(t * 50) * this.wobble * 0.08;
      this.mesh.rotation.z = w;
      this.mesh.scale.set(1 + this.wobble * 0.06, 1 - this.wobble * 0.06, 1 + this.wobble * 0.06);
    }
    if (this.type === 'crystal' || this.type === 'generator') this.mesh.children[0] && (this.mesh.children[0].rotation.y += dt * 0.8);
  }
}

// ------------------------------------------------------------------ models

function rb(w: number, h: number, d: number, r: number, color: number, ink = 0.03) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), toon(color));
  if (ink) outline(m, ink);
  return m;
}

/** Builds the toon model for a prop type. Returns the group and its footprint size. */
export function buildPropModel(type: PropType, opts: { w?: number; h?: number; d?: number; color?: number } = {}): { group: THREE.Group; size: THREE.Vector3; glassMat?: THREE.ShaderMaterial } {
  const g = new THREE.Group();
  let size = new THREE.Vector3(1, 1, 1);
  let glassMat: THREE.ShaderMaterial | undefined;
  switch (type) {
    case 'crate': {
      const s = opts.w ?? 1.2;
      const box = rb(s, s, s, 0.08, 0xc98a4a);
      box.position.y = s / 2;
      g.add(box);
      for (const [ax, ay, az, rx, rz] of [[0, s / 2, s / 2 + 0.01, 0, 0.78], [0, s / 2, -s / 2 - 0.01, 0, -0.78], [s / 2 + 0.01, s / 2, 0, 0, 0.78], [-s / 2 - 0.01, s / 2, 0, 0, -0.78]] as const) {
        const plank = rb(s * 1.25, s * 0.14, 0.05, 0.02, 0x9a6230, 0);
        plank.position.set(ax, ay, az);
        if (Math.abs(ax) > 0.01) plank.rotation.y = Math.PI / 2;
        plank.rotateZ(rz);
        void rx;
        g.add(plank);
      }
      const rim = rb(s + 0.04, 0.12, s + 0.04, 0.03, 0x8a5428, 0);
      rim.position.y = s - 0.06;
      g.add(rim);
      const rim2 = rim.clone();
      rim2.position.y = 0.06;
      g.add(rim2);
      size.set(s, s, s);
      break;
    }
    case 'barrel':
    case 'tnt': {
      if (type === 'barrel') {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.2, 18), toon(0xe8413c));
        outline(body, 0.03);
        body.position.y = 0.6;
        g.add(body);
        for (const y of [0.2, 1.0]) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.04, 6, 20), toon(0x3a3a4a));
          ring.rotation.x = Math.PI / 2;
          ring.position.y = y;
          g.add(ring);
        }
        const sign = new THREE.Mesh(new THREE.CircleGeometry(0.2, 3), toon(0xffe04a));
        sign.position.set(0, 0.62, 0.49);
        g.add(sign);
        const mark = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), toon(0x2b1d33));
        mark.position.set(0, 0.6, 0.495);
        g.add(mark);
        size.set(0.96, 1.2, 0.96);
      } else {
        for (let i = 0; i < 3; i++) {
          const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 12), toon(0xff5a3a));
          outline(stick, 0.025);
          stick.position.set((i - 1) * 0.3, 0.45, 0);
          g.add(stick);
        }
        const band = rb(0.95, 0.16, 0.36, 0.05, 0xffe07a, 0.02);
        band.position.y = 0.5;
        g.add(band);
        const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), toon(0x3a2a1a));
        fuse.position.set(0, 1.05, 0);
        fuse.rotation.z = 0.4;
        g.add(fuse);
        size.set(0.95, 0.95, 0.4);
      }
      break;
    }
    case 'glass':
    case 'lamp': {
      if (type === 'glass') {
        const w = opts.w ?? 3, h = opts.h ?? 2.5;
        glassMat = createGlassMaterial(opts.color ?? 0x9fe8ff);
        glassMat.uniforms.uSize.value.set(w, h);
        glassMat.uniforms.uOpacity.value = 0.35;
        const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), glassMat);
        pane.position.y = h / 2;
        pane.renderOrder = 3;
        g.add(pane);
        const frame = rb(w + 0.16, 0.14, 0.18, 0.04, 0xf2e2c4, 0.02);
        frame.position.y = 0.07;
        g.add(frame);
        size.set(w, h, 0.2);
      } else {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.6, 8), toon(0x3a3a4a));
        post.position.y = 1.3;
        g.add(post);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2b0).multiplyScalar(1.6) }));
        bulb.position.y = 2.75;
        g.add(bulb);
        const cap = rb(0.5, 0.12, 0.5, 0.04, 0x3a3a4a, 0.02);
        cap.position.y = 3.02;
        g.add(cap);
        size.set(0.6, 3.1, 0.6);
      }
      break;
    }
    case 'crystal': {
      const holder = new THREE.Group();
      const color = opts.color ?? 0x7fd4ff;
      const main = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.2, flatShading: true }));
      main.scale.set(0.8, 1.6, 0.8);
      main.position.y = 1;
      outline(main, 0.03);
      holder.add(main);
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), main.material);
        const a = (i / 3) * Math.PI * 2;
        s.scale.set(0.8, 1.5, 0.8);
        s.position.set(Math.cos(a) * 0.45, 0.4, Math.sin(a) * 0.45);
        s.rotation.z = Math.cos(a) * 0.4;
        holder.add(s);
      }
      g.add(holder);
      const rock = rb(1.2, 0.3, 1.2, 0.12, 0x8a8aa0, 0.02);
      rock.position.y = 0.15;
      g.add(rock);
      size.set(1.2, 2, 1.2);
      break;
    }
    case 'sign': {
      const post = rb(0.14, 1.4, 0.14, 0.03, 0x8a5a30, 0.02);
      post.position.y = 0.7;
      g.add(post);
      const board = rb(1.3, 0.7, 0.1, 0.06, 0xd8a060, 0.025);
      board.position.set(0, 1.35, 0.06);
      board.rotation.z = rand(-0.08, 0.08);
      g.add(board);
      const arrow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 3), toon(0x8a3a2a));
      arrow.position.set(0.1, 1.35, 0.12);
      arrow.rotation.z = -Math.PI / 2;
      g.add(arrow);
      size.set(1.3, 1.7, 0.3);
      break;
    }
    case 'fence': {
      const w = opts.w ?? 2.4;
      for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) {
        const p = rb(0.16, 1.1, 0.16, 0.04, 0xf2e2c4, 0.02);
        p.position.set(x, 0.55, 0);
        g.add(p);
      }
      for (const y of [0.4, 0.8]) {
        const rail = rb(w, 0.12, 0.08, 0.03, 0xf2e2c4, 0.02);
        rail.position.y = y;
        g.add(rail);
      }
      size.set(w, 1.1, 0.25);
      break;
    }
    case 'hay': {
      const bale = rb(1.4, 0.8, 0.9, 0.18, 0xf2cc5a);
      bale.position.y = 0.4;
      g.add(bale);
      for (const x of [-0.4, 0.4]) {
        const tie = rb(0.08, 0.84, 0.94, 0.03, 0xb8883a, 0);
        tie.position.set(x, 0.4, 0);
        g.add(tie);
      }
      size.set(1.4, 0.8, 0.9);
      break;
    }
    case 'pumpkin': {
      const geo = new THREE.SphereGeometry(0.5, 16, 12);
      geo.scale(1.15, 0.8, 1.15);
      const p = new THREE.Mesh(geo, toon(0xff8a2a));
      outline(p, 0.025);
      p.position.y = 0.4;
      g.add(p);
      for (let i = 0; i < 6; i++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 4, 16, Math.PI), toon(0xe06a1a));
        rib.rotation.y = (i / 6) * Math.PI;
        rib.position.y = 0.4;
        rib.scale.set(1.15, 1, 1.15);
        g.add(rib);
      }
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.2, 6), toon(0x4a8a2a));
      stem.position.y = 0.85;
      g.add(stem);
      size.set(1.1, 0.85, 1.1);
      break;
    }
    case 'candyJar': {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 16), toon(0xffe8fa, { transparent: true, opacity: 0.45 }));
      outline(jar, 0.025);
      jar.position.y = 0.55;
      g.add(jar);
      const cols = [0xff4a8a, 0x4ad8ff, 0xffe04a, 0x7aff6a, 0xb070ff];
      for (let i = 0; i < 10; i++) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), toon(cols[i % cols.length]));
        c.position.set(rand(-0.28, 0.28), rand(0.15, 0.8), rand(-0.28, 0.28));
        g.add(c);
      }
      const lid = rb(0.8, 0.14, 0.8, 0.06, 0xff6aa8, 0.02);
      lid.position.y = 1.15;
      g.add(lid);
      size.set(0.9, 1.2, 0.9);
      break;
    }
    case 'gumball': {
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.65, 20, 16), toon(0xffffff, { transparent: true, opacity: 0.4 }));
      outline(globe, 0.03);
      globe.position.y = 1.7;
      g.add(globe);
      const cols = [0xff4a8a, 0x4ad8ff, 0xffe04a, 0x7aff6a];
      for (let i = 0; i < 16; i++) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), toon(cols[i % 4]));
        const a = rand(0, Math.PI * 2);
        const r = rand(0, 0.42);
        c.position.set(Math.cos(a) * r, 1.45 + rand(0, 0.45), Math.sin(a) * r);
        g.add(c);
      }
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.1, 16), toon(0xe8413c));
      outline(base, 0.03);
      base.position.y = 0.55;
      g.add(base);
      const coinSlot = rb(0.2, 0.2, 0.06, 0.04, 0xc0c8d8, 0.01);
      coinSlot.position.set(0, 0.75, 0.5);
      g.add(coinSlot);
      size.set(1.2, 2.3, 1.2);
      break;
    }
    case 'pot': {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pts.push(new THREE.Vector2(0.25 + Math.sin(t * Math.PI) * 0.35 - t * 0.08, t * 1.0));
      }
      const pot = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), toon(0xc8703a));
      outline(pot, 0.025);
      g.add(pot);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.03, 4, 18), toon(0xffe07a));
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.5;
      g.add(band);
      size.set(1.1, 1, 1.1);
      break;
    }
    case 'vending': {
      const body = rb(1.3, 2.2, 0.9, 0.1, 0x3a6aff);
      body.position.y = 1.1;
      g.add(body);
      const window_ = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbfefff).multiplyScalar(1.2) }));
      window_.position.set(-0.15, 1.3, 0.46);
      g.add(window_);
      const panel = rb(0.25, 1.2, 0.05, 0.04, 0xdfe6f0, 0.01);
      panel.position.set(0.45, 1.3, 0.46);
      g.add(panel);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6aa8).multiplyScalar(1.8) }));
      sign.position.set(0, 2.0, 0.46);
      g.add(sign);
      size.set(1.3, 2.2, 0.9);
      break;
    }
    case 'barrier': {
      const w = opts.w ?? 6, h = opts.h ?? 3.5;
      glassMat = createGlassMaterial(0x6affe0);
      glassMat.uniforms.uSize.value.set(w, h);
      glassMat.uniforms.uOpacity.value = 0.45;
      glassMat.uniforms.uEdge.value = 3.5;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), glassMat);
      wall.position.y = h / 2;
      g.add(wall);
      for (const x of [-w / 2, w / 2]) {
        const post = rb(0.4, h + 0.4, 0.4, 0.1, 0x5a6478, 0.03);
        post.position.set(x, (h + 0.4) / 2, 0);
        g.add(post);
      }
      size.set(w, h, 0.4);
      break;
    }
    case 'generator': {
      const holder = new THREE.Group();
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6affe0).multiplyScalar(2) }));
      core.position.y = 1.55;
      holder.add(core);
      const cage = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), new THREE.MeshBasicMaterial({ color: 0x2b1d33, wireframe: true }));
      cage.position.y = 1.55;
      holder.add(cage);
      g.add(holder);
      const base = rb(1.1, 1, 1.1, 0.12, 0x5a6478);
      base.position.y = 0.5;
      g.add(base);
      const stripe = rb(1.14, 0.16, 1.14, 0.04, 0xffd23f, 0);
      stripe.position.y = 0.85;
      g.add(stripe);
      size.set(1.1, 2, 1.1);
      break;
    }
    case 'crackedWall': {
      const w = opts.w ?? 3, h = opts.h ?? 3;
      const wall = rb(w, h, 0.6, 0.1, 0xb8a890, 0.03);
      wall.position.y = h / 2;
      g.add(wall);
      for (let i = 0; i < 6; i++) {
        const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.06, rand(0.4, 1)), new THREE.MeshBasicMaterial({ color: 0x4a3a30 }));
        crack.position.set(rand(-w / 3, w / 3), rand(0.5, h - 0.5), 0.31);
        crack.rotation.z = rand(-0.8, 0.8);
        g.add(crack);
      }
      size.set(w, h, 0.6);
      break;
    }
    case 'mushroom': {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.8, 12), toon(0xfff2e8));
      outline(stem, 0.02);
      stem.position.y = 0.4;
      g.add(stem);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xff4a5a));
      outline(cap, 0.025);
      cap.position.y = 0.75;
      cap.scale.set(1, 0.7, 1);
      g.add(cap);
      for (let i = 0; i < 5; i++) {
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10), toon(0xffffff));
        const a = (i / 5) * Math.PI * 2;
        dot.position.set(Math.cos(a) * 0.35, 1.02, Math.sin(a) * 0.35);
        dot.lookAt(dot.position.clone().add(new THREE.Vector3(Math.cos(a), 1.4, Math.sin(a))));
        g.add(dot);
      }
      size.set(1.2, 1.2, 1.2);
      break;
    }
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name !== 'outline') {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { group: g, size, glassMat };
}

export interface PropSpawn {
  type: PropType;
  x: number;
  y?: number;
  z: number;
  rot?: number;
  w?: number;
  h?: number;
  tag?: string;
  color?: number;
}

/** Creates destructible props, their colliders, and keeps them updated. */
export class DestructibleManager {
  readonly root = new THREE.Group();
  readonly list: Destructible[] = [];
  onBreak: ((p: Destructible, info: DamageInfo) => void) | null = null;

  constructor(private world: CollisionWorld) {}

  spawn(s: PropSpawn): Destructible {
    const def = PROPS[s.type];
    const { group, size, glassMat } = buildPropModel(s.type, { w: s.w, h: s.h, color: s.color });
    const y = s.y ?? 0;
    group.position.set(s.x, y, s.z);
    const rot = s.rot ?? 0;
    group.rotation.y = rot;
    this.root.add(group);
    const p = new Destructible(s.type, group, size, def);
    p.glassMat = glassMat ?? null;
    p.tag = s.tag ?? null;
    p.assist = s.type === 'barrel' || s.type === 'tnt' || s.type === 'generator';
    // Collider: axis-aligned box of the (possibly 90°-rotated) footprint, or a cylinder for round things
    const round = ['barrel', 'pumpkin', 'pot', 'gumball', 'candyJar', 'crystal', 'mushroom', 'lamp'].includes(s.type);
    const swap = Math.abs(Math.sin(rot)) > 0.7;
    const w = swap ? size.z : size.x;
    const d = swap ? size.x : size.z;
    if (round) p.collider = this.world.addCyl(s.x, s.z, Math.max(size.x, size.z) / 2, y, y + size.y, { owner: p, walkable: s.type !== 'lamp' });
    else p.collider = this.world.addBlock(s.x, y, s.z, w, size.y, Math.max(d, 0.3), { owner: p, walkable: s.type === 'crate' || s.type === 'hay' || s.type === 'vending' || s.type === 'crackedWall' });
    // Hit shape
    if (round) p.shapes.push({ type: 'sphere', c: new THREE.Vector3(s.x, y + size.y / 2, s.z), r: Math.max(size.x, size.y, size.z) * 0.55 });
    else {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      p.shapes.push({ type: 'box', c: new THREE.Vector3(s.x, y + size.y / 2, s.z), half: new THREE.Vector3(size.x / 2, size.y / 2, Math.max(size.z, 0.3) / 2), quat: q });
    }
    p.onBreak = (pp, info) => {
      if (pp.collider) this.world.remove(pp.collider);
      pp.collider = null;
      this.onBreak?.(pp, info);
      this.root.remove(pp.mesh);
    };
    this.list.push(p);
    return p;
  }

  /** Removes a prop instantly without effects (e.g. energy barrier switched off). */
  dissolve(p: Destructible) {
    if (p.collider) this.world.remove(p.collider);
    p.collider = null;
    p.alive = false;
    this.root.remove(p.mesh);
  }

  update(dt: number, t: number) {
    for (const p of this.list) if (p.alive) p.update(dt, t);
    if (this.list.length > 400) {
      for (let i = this.list.length - 1; i >= 0; i--) if (!this.list[i].alive) this.list.splice(i, 1);
    }
    void _v;
  }

  clear() {
    for (const p of this.list) this.root.remove(p.mesh);
    this.list.length = 0;
  }
}
