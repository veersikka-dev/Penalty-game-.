import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { outline, toon } from '../render/Toon';
import type { WeaponId } from './WeaponDefs';

const INK = 0.012;

export interface WeaponSkin {
  body: number;
  accent: number;
  metal: number;
  glow: number;
}

export const WEAPON_SKINS: Record<string, WeaponSkin> = {
  classic: { body: 0xff8a3d, accent: 0xffd23f, metal: 0x4b4d63, glow: 0xff5fa8 },
  candy: { body: 0xff7ac6, accent: 0xffffff, metal: 0x8a5cff, glow: 0x7fffd4 },
  gold: { body: 0xffc93a, accent: 0xfff2b0, metal: 0xb07a18, glow: 0xffa020 },
  neon: { body: 0x2a2440, accent: 0x3affd8, metal: 0x16121f, glow: 0x3affd8 },
  jungle: { body: 0x5f8f3a, accent: 0xc9a25a, metal: 0x3a3226, glow: 0xb6ff4a },
};

function rb(w: number, h: number, d: number, r: number, color: number, ink = INK) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), toon(color));
  if (ink) outline(m, ink);
  return m;
}
function cyl(r0: number, r1: number, len: number, color: number, ink = INK, seg = 16) {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg);
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, toon(color));
  if (ink) outline(m, ink);
  return m;
}

/**
 * A weapon model points down +Z. Grips are where the hands go (IK targets);
 * `muzzle` is where shots spawn; `chamber` is the reload hand target.
 */
export class WeaponModel {
  readonly group = new THREE.Group();
  readonly muzzle = new THREE.Object3D();
  readonly rearGrip = new THREE.Object3D();
  readonly foreGrip = new THREE.Object3D();
  readonly chamber = new THREE.Object3D();
  readonly spinners: THREE.Object3D[] = [];
  readonly glowMats: THREE.MeshBasicMaterial[] = [];
  private chamberPart: THREE.Object3D | null = null;
  private heat = 0;
  private spin = 0;

  constructor(readonly id: WeaponId, skin: WeaponSkin) {
    this.group.add(this.muzzle, this.rearGrip, this.foreGrip, this.chamber);
    switch (id) {
      case 'blaster':
        this.buildBlaster(skin);
        break;
      case 'carrot':
        this.buildCarrot(skin);
        break;
      case 'egg':
        this.buildEgg(skin);
        break;
      case 'bubble':
        this.buildBubble(skin);
        break;
      case 'pulse':
        this.buildPulse(skin);
        break;
    }
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name !== 'outline') o.castShadow = true;
    });
  }

  private glow(color: number, intensity = 2.2, opacity = 1) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), transparent: opacity < 1, opacity });
    this.glowMats.push(m);
    return m;
  }

  private buildBlaster(s: WeaponSkin) {
    const g = this.group;
    const body = rb(0.17, 0.19, 0.46, 0.06, s.body);
    body.position.set(0, 0.02, 0.04);
    g.add(body);
    const stripe = rb(0.175, 0.04, 0.3, 0.015, s.accent, 0);
    stripe.position.set(0, 0.08, 0.06);
    g.add(stripe);
    // Oversized barrel with flared muzzle
    const barrel = cyl(0.065, 0.075, 0.28, s.metal);
    barrel.position.set(0, 0.03, 0.4);
    g.add(barrel);
    const flare = cyl(0.085, 0.12, 0.1, s.accent);
    flare.position.set(0, 0.03, 0.56);
    g.add(flare);
    const bore = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), this.glow(s.glow, 1.8));
    bore.position.set(0, 0.03, 0.611);
    g.add(bore);
    for (const z of [0.3, 0.44]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.016, 6, 20), toon(s.accent));
      ring.position.set(0, 0.03, z);
      g.add(ring);
    }
    // Glowing energy chamber on top with spinning rings (pops out when reloading)
    const chamber = new THREE.Group();
    chamber.position.set(0, 0.17, 0.02);
    g.add(chamber);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 18).rotateX(Math.PI / 2), toon(0xcff6ff, { transparent: true, opacity: 0.45 }));
    outline(glass, INK);
    chamber.add(glass);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.17, 12).rotateX(Math.PI / 2), this.glow(s.glow, 2.6));
    chamber.add(core);
    for (const z of [-0.06, 0.06]) {
      const sp = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.012, 6, 20), toon(s.accent));
      sp.position.z = z;
      chamber.add(sp);
      this.spinners.push(sp);
    }
    const capF = cyl(0.066, 0.066, 0.03, s.metal, 0);
    capF.position.z = 0.11;
    const capB = capF.clone();
    capB.position.z = -0.11;
    chamber.add(capF, capB);
    this.chamberPart = chamber;
    this.chamber.position.set(0.12, 0.17, 0.02);
    // Bacon strip decoration along the side
    for (const side of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pts.push(new THREE.Vector3(side * 0.09, 0.0 + Math.sin(t * Math.PI * 4) * 0.022, -0.14 + t * 0.34));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const red = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.018, 5), toon(0xd8433a));
      const fat = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.01, 5), toon(0xffe0c8));
      fat.position.y = 0.022;
      g.add(red, fat);
    }
    // Scope
    const scope = cyl(0.03, 0.03, 0.12, s.metal);
    scope.position.set(0, 0.27, -0.1);
    g.add(scope);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 16), this.glow(0x7fe8ff, 1.6));
    lens.position.set(0, 0.27, -0.039);
    g.add(lens);
    // Grip, trigger guard, fore-grip, stock
    const grip = rb(0.09, 0.17, 0.08, 0.03, 0x5a3a2a);
    grip.position.set(0, -0.13, -0.1);
    grip.rotation.x = 0.35;
    g.add(grip);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 14, Math.PI), toon(s.metal));
    guard.position.set(0, -0.07, -0.02);
    guard.rotation.set(0, Math.PI / 2, Math.PI);
    g.add(guard);
    const fore = rb(0.08, 0.13, 0.07, 0.03, s.metal);
    fore.position.set(0, -0.1, 0.25);
    g.add(fore);
    const stock = rb(0.11, 0.14, 0.18, 0.05, s.body);
    stock.position.set(0, -0.01, -0.26);
    g.add(stock);
    this.muzzle.position.set(0, 0.03, 0.64);
    this.rearGrip.position.set(0, -0.15, -0.11);
    this.foreGrip.position.set(-0.05, -0.1, 0.07);
  }

  private buildCarrot(s: WeaponSkin) {
    const g = this.group;
    const tube = cyl(0.12, 0.13, 0.62, 0xff8a2a);
    tube.position.set(0, 0.04, 0.12);
    g.add(tube);
    for (const z of [-0.05, 0.12, 0.3]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.018, 6, 22), toon(0x3a8a3a));
      band.position.set(0, 0.04, z);
      g.add(band);
    }
    const mouth = cyl(0.14, 0.16, 0.08, 0x3a8a3a);
    mouth.position.set(0, 0.04, 0.46);
    g.add(mouth);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 10).rotateX(Math.PI / 2), toon(0xff7a1a));
    tip.position.set(0, 0.04, 0.5);
    g.add(tip);
    const leaves = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 5), toon(0x5ecf4a));
      leaf.position.set((i - 1) * 0.04, 0.22, -0.18);
      leaf.rotation.set(-0.5, 0, (i - 1) * 0.4);
      outline(leaf, 0.008);
      leaves.add(leaf);
    }
    g.add(leaves);
    const drum = cyl(0.09, 0.09, 0.16, s.metal);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, 0.2, 0.05);
    g.add(drum);
    this.spinners.push(drum);
    const coreM = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), this.glow(0xffb040, 2.4));
    coreM.position.set(0, 0.2, 0.05);
    g.add(coreM);
    const grip = rb(0.09, 0.17, 0.09, 0.03, 0x5a3a2a);
    grip.position.set(0, -0.14, -0.08);
    grip.rotation.x = 0.35;
    g.add(grip);
    const fore = rb(0.09, 0.12, 0.08, 0.03, 0x3a8a3a);
    fore.position.set(0, -0.11, 0.26);
    g.add(fore);
    this.chamberPart = drum;
    this.chamber.position.set(0.1, 0.2, 0.05);
    this.muzzle.position.set(0, 0.04, 0.6);
    this.rearGrip.position.set(0, -0.16, -0.09);
    this.foreGrip.position.set(-0.06, -0.1, 0.09);
  }

  private buildEgg(s: WeaponSkin) {
    const g = this.group;
    const body = rb(0.2, 0.18, 0.4, 0.07, 0xffd84a);
    body.position.set(0, 0.02, 0.05);
    g.add(body);
    const drum = cyl(0.13, 0.13, 0.16, 0xfff4d8);
    drum.position.set(0, 0.03, -0.02);
    drum.rotation.z = 0;
    g.add(drum);
    this.spinners.push(drum);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const egg = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), toon(0xffffff));
      egg.scale.set(1, 1.3, 1);
      egg.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.085);
      drum.add(egg);
    }
    const barrel = cyl(0.07, 0.08, 0.26, s.metal);
    barrel.position.set(0, 0.03, 0.38);
    g.add(barrel);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 4).rotateX(Math.PI / 2), toon(0xff9a2a));
    beak.position.set(0, 0.03, 0.55);
    outline(beak, 0.008);
    g.add(beak);
    const comb = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), toon(0xff4a4a));
      c.position.set(0, 0.13 + (i === 1 ? 0.02 : 0), -0.02 + (i - 1) * 0.05);
      comb.add(c);
    }
    g.add(comb);
    const grip = rb(0.09, 0.17, 0.08, 0.03, 0x5a3a2a);
    grip.position.set(0, -0.13, -0.08);
    grip.rotation.x = 0.35;
    g.add(grip);
    const fore = rb(0.08, 0.12, 0.07, 0.03, s.metal);
    fore.position.set(0, -0.1, 0.24);
    g.add(fore);
    this.chamberPart = drum;
    this.chamber.position.set(0.14, 0.03, -0.02);
    this.muzzle.position.set(0, 0.03, 0.6);
    this.rearGrip.position.set(0, -0.15, -0.09);
    this.foreGrip.position.set(-0.06, -0.09, 0.07);
  }

  private buildBubble(s: WeaponSkin) {
    const g = this.group;
    const body = rb(0.17, 0.16, 0.44, 0.07, 0xff9ad0);
    body.position.set(0, 0.0, 0.06);
    g.add(body);
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), toon(0x9fe8ff, { transparent: true, opacity: 0.5 }));
    outline(tank, INK);
    tank.position.set(0, 0.2, -0.02);
    g.add(tank);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.02 + i * 0.006, 8, 6), this.glow(0xdffcff, 1.3));
      b.position.set((i - 1.5) * 0.04, -0.04 + (i % 2) * 0.05, 0);
      tank.add(b);
      this.spinners.push(b);
    }
    const nozzle = cyl(0.05, 0.1, 0.18, 0x7fe0ff);
    nozzle.position.set(0, 0.0, 0.36);
    g.add(nozzle);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 24), toon(0xffffff));
    ring.position.set(0, 0, 0.46);
    g.add(ring);
    const grip = rb(0.09, 0.17, 0.08, 0.03, 0x8a5cff);
    grip.position.set(0, -0.13, -0.08);
    grip.rotation.x = 0.35;
    g.add(grip);
    const fore = rb(0.08, 0.12, 0.07, 0.03, 0x8a5cff);
    fore.position.set(0, -0.1, 0.22);
    g.add(fore);
    this.chamberPart = tank;
    this.chamber.position.set(0.12, 0.2, -0.02);
    this.muzzle.position.set(0, 0, 0.5);
    this.rearGrip.position.set(0, -0.15, -0.09);
    this.foreGrip.position.set(-0.05, -0.09, 0.07);
  }

  private buildPulse(s: WeaponSkin) {
    const g = this.group;
    const body = rb(0.18, 0.18, 0.38, 0.07, 0x6a4aff);
    body.position.set(0, 0.02, 0.02);
    g.add(body);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.06, 0.14, 24, 1, true).rotateX(Math.PI / 2), toon(0xd8c8ff, { side: THREE.DoubleSide }));
    outline(dish, INK);
    dish.position.set(0, 0.03, 0.33);
    g.add(dish);
    const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), this.glow(0xc080ff, 3));
    emitter.position.set(0, 0.03, 0.3);
    g.add(emitter);
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.09 + i * 0.035, 0.01, 6, 24), this.glow(0xb070ff, 1.8));
      r.position.set(0, 0.03, 0.18 - i * 0.07);
      g.add(r);
      this.spinners.push(r);
    }
    const coil = cyl(0.07, 0.07, 0.2, s.metal);
    coil.position.set(0, 0.18, -0.02);
    g.add(coil);
    const grip = rb(0.09, 0.17, 0.08, 0.03, 0x2a2440);
    grip.position.set(0, -0.13, -0.08);
    grip.rotation.x = 0.35;
    g.add(grip);
    const fore = rb(0.08, 0.12, 0.07, 0.03, 0x2a2440);
    fore.position.set(0, -0.1, 0.18);
    g.add(fore);
    this.chamberPart = coil;
    this.chamber.position.set(0.1, 0.18, -0.02);
    this.muzzle.position.set(0, 0.03, 0.42);
    this.rearGrip.position.set(0, -0.15, -0.09);
    this.foreGrip.position.set(-0.05, -0.1, 0.05);
  }

  /** 0 = seated, 1 = popped out (reload animation). */
  setChamberOut(k: number) {
    if (!this.chamberPart) return;
    const base = this.chamberPart.userData.baseY ?? (this.chamberPart.userData.baseY = this.chamberPart.position.y);
    this.chamberPart.position.y = base + k * 0.12;
    this.chamberPart.rotation.z = k * 0.6;
  }

  fired() {
    this.heat = Math.min(1, this.heat + 0.25);
  }

  update(dt: number, t: number) {
    this.heat = Math.max(0, this.heat - dt * 0.8);
    this.spin += dt * (2 + this.heat * 30);
    this.spinners.forEach((s, i) => {
      if (this.id === 'bubble') s.position.y = -0.04 + (i % 2) * 0.05 + Math.sin(t * 3 + i) * 0.02;
      else if (this.id === 'carrot' || this.id === 'egg') s.rotation.z = this.spin * 0.5;
      else s.rotation.z = this.spin * (i % 2 ? -1 : 1);
    });
    const pulse = 1 + Math.sin(t * 5) * 0.15 + this.heat * 1.2;
    for (const m of this.glowMats) {
      const base = m.userData.base ?? (m.userData.base = m.color.clone());
      m.color.copy(base).multiplyScalar(pulse);
    }
  }
}
