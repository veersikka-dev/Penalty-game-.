import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { outline, toon } from '../render/Toon';
import type { EnemyType } from './EnemyDefs';

const INK = 0.02;

export interface EnemyRig {
  root: THREE.Group;
  body: THREE.Group;
  parts: Record<string, THREE.Object3D>;
  /** Unique materials that flash on hit. */
  mats: THREE.MeshToonMaterial[];
  /** Armour pieces (boar) that can be shot off. */
  armor: THREE.Object3D[];
  headHeight: number;
  bodyHeight: number;
}

function mat(rig: EnemyRig, color: number, extra: { transparent?: boolean; opacity?: number; emissive?: number } = {}) {
  const m = toon(color, { unique: true, transparent: extra.transparent, opacity: extra.opacity, emissive: extra.emissive });
  rig.mats.push(m);
  return m;
}
function mesh(geo: THREE.BufferGeometry, m: THREE.Material, ink = INK) {
  const x = new THREE.Mesh(geo, m);
  if (ink) outline(x, ink);
  return x;
}
function eye(rig: EnemyRig, r: number, angry = true, pupil = 0x1a1024): THREE.Group {
  const g = new THREE.Group();
  const white = mesh(new THREE.SphereGeometry(r, 14, 10), mat(rig, 0xffffff), 0.012);
  white.scale.set(1, 1.1, 0.6);
  g.add(white);
  const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 10, 8), pupil === 0x1a1024 ? toon(pupil) : toon(pupil, { emissive: pupil, emissiveIntensity: 0.9 }));
  p.position.z = r * 0.45;
  p.scale.set(1, 1, 0.5);
  g.add(p);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.18, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  hl.position.set(r * 0.2, r * 0.25, r * 0.62);
  g.add(hl);
  if (angry) {
    const brow = mesh(new RoundedBoxGeometry(r * 2.2, r * 0.45, r * 0.4, 2, r * 0.15), toon(0x2b1d33), 0);
    brow.position.set(0, r * 1.05, r * 0.3);
    g.add(brow);
    g.userData.brow = brow;
  }
  return g;
}

function base(): EnemyRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  return { root, body, parts: {}, mats: [], armor: [], headHeight: 1, bodyHeight: 0.6 };
}

function chicken(): EnemyRig {
  const r = base();
  const metal = mat(r, 0xe6ecf4);
  const dark = mat(r, 0x5a6478);
  const torso = mesh(new THREE.SphereGeometry(0.36, 20, 14), metal);
  torso.scale.set(1, 0.95, 1.15);
  torso.position.y = 0.62;
  r.body.add(torso);
  const belly = mesh(new THREE.SphereGeometry(0.26, 16, 12), mat(r, 0xfff3d8), 0);
  belly.position.set(0, 0.56, 0.22);
  belly.scale.set(1, 1, 0.5);
  r.body.add(belly);
  const head = new THREE.Group();
  head.position.set(0, 0.98, 0.18);
  r.body.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.24, 18, 14), metal);
  head.add(skull);
  const beak = mesh(new THREE.ConeGeometry(0.09, 0.22, 4).rotateX(Math.PI / 2), mat(r, 0xffa62a), 0.012);
  beak.position.set(0, -0.03, 0.26);
  head.add(beak);
  const wattle = mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(r, 0xff3a4a), 0.01);
  wattle.scale.set(1, 1.6, 0.8);
  wattle.position.set(0, -0.14, 0.2);
  head.add(wattle);
  for (let i = 0; i < 3; i++) {
    const c = mesh(new THREE.SphereGeometry(0.07 - i * 0.008, 10, 8), mat(r, 0xff3a4a), 0.01);
    c.position.set(0, 0.22 - i * 0.02, 0.06 - i * 0.09);
    head.add(c);
  }
  for (const s of [-1, 1]) {
    const e = eye(r, 0.075);
    e.position.set(s * 0.1, 0.06, 0.19);
    e.rotation.y = s * 0.3;
    e.userData.brow?.rotation.set(0, 0, -s * 0.4);
    head.add(e);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 5), toon(0x5a6478));
  antenna.position.set(0.08, 0.3, -0.05);
  head.add(antenna);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3030).multiplyScalar(2) }));
  bulb.position.set(0.08, 0.41, -0.05);
  head.add(bulb);
  r.parts.bulb = bulb;
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(s * 0.33, 0.7, -0.02);
    r.body.add(wing);
    const w = mesh(new RoundedBoxGeometry(0.08, 0.3, 0.38, 2, 0.04), dark);
    w.position.y = -0.1;
    wing.add(w);
    r.parts[s < 0 ? 'wingL' : 'wingR'] = wing;
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.8, -0.38);
  for (let i = 0; i < 3; i++) {
    const f = mesh(new RoundedBoxGeometry(0.06, 0.32, 0.12, 2, 0.03), dark, 0.012);
    f.position.y = 0.12;
    f.rotation.set(-0.5, 0, (i - 1) * 0.4);
    tail.add(f);
  }
  r.body.add(tail);
  r.parts.tail = tail;
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.14, 0.34, 0);
    r.root.add(leg);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), toon(0xffa62a));
    shin.position.y = -0.15;
    leg.add(shin);
    for (let t = -1; t <= 1; t++) {
      const toe = mesh(new THREE.CapsuleGeometry(0.025, 0.08, 3, 6).rotateX(Math.PI / 2), toon(0xffa62a), 0.008);
      toe.position.set(t * 0.04, -0.31, 0.05);
      toe.rotation.y = t * 0.5;
      leg.add(toe);
    }
    r.parts[s < 0 ? 'legL' : 'legR'] = leg;
  }
  r.parts.head = head;
  r.headHeight = 0.98;
  r.bodyHeight = 0.62;
  return r;
}

function toaster(): EnemyRig {
  const r = base();
  const chrome = mat(r, 0xd7dde8);
  const box = mesh(new RoundedBoxGeometry(0.95, 0.72, 0.6, 3, 0.16), chrome);
  box.position.y = 0;
  r.body.add(box);
  const band = mesh(new RoundedBoxGeometry(0.97, 0.12, 0.62, 2, 0.05), mat(r, 0xff6a5a), 0);
  band.position.y = -0.2;
  r.body.add(band);
  // screen face
  const screen = mesh(new RoundedBoxGeometry(0.6, 0.3, 0.05, 2, 0.05), toon(0x1a1a2e), 0.01);
  screen.position.set(0, 0.03, 0.305);
  r.body.add(screen);
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6affff).multiplyScalar(2) });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.09, 0.02, 2, 0.03), eyeMat);
    e.position.set(s * 0.15, 0.05, 0.335);
    e.rotation.z = s * 0.25;
    r.body.add(e);
    r.parts[s < 0 ? 'eyeL' : 'eyeR'] = e;
  }
  r.parts.eyeMat = new THREE.Object3D();
  r.parts.eyeMat.userData.mat = eyeMat;
  // slots + toast
  for (const s of [-1, 1]) {
    const slot = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.04, 0.12, 2, 0.02), toon(0x2a2a3a));
    slot.position.set(s * 0.2, 0.36, 0);
    r.body.add(slot);
    const toast = new THREE.Group();
    toast.position.set(s * 0.2, 0.25, 0);
    const bread = mesh(new RoundedBoxGeometry(0.3, 0.3, 0.07, 2, 0.06), toon(0xf2c27a), 0.01);
    const crust = mesh(new RoundedBoxGeometry(0.32, 0.32, 0.05, 2, 0.06), toon(0xa8632a), 0);
    bread.add(crust);
    toast.add(bread);
    r.body.add(toast);
    r.parts[s < 0 ? 'toastL' : 'toastR'] = toast;
  }
  const lever = mesh(new RoundedBoxGeometry(0.08, 0.14, 0.08, 2, 0.03), mat(r, 0x3a3a4a), 0.01);
  lever.position.set(0.5, 0.05, 0);
  r.body.add(lever);
  r.parts.lever = lever;
  // propeller + jet
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), toon(0x5a6478));
  mast.position.y = 0.46;
  r.body.add(mast);
  const prop = new THREE.Group();
  prop.position.y = 0.57;
  for (let i = 0; i < 3; i++) {
    const b = mesh(new RoundedBoxGeometry(0.42, 0.02, 0.1, 1, 0.01), toon(0xff6a5a), 0.008);
    b.position.x = 0.21;
    const arm = new THREE.Group();
    arm.rotation.y = (i / 3) * Math.PI * 2;
    arm.add(b);
    prop.add(arm);
  }
  r.body.add(prop);
  r.parts.prop = prop;
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 12).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa040).multiplyScalar(2), transparent: true, opacity: 0.8 }));
  jet.position.y = -0.55;
  r.body.add(jet);
  r.parts.jet = jet;
  r.headHeight = 0.3;
  r.bodyHeight = 0;
  return r;
}

function carrot(): EnemyRig {
  const r = base();
  const orange = mat(r, 0xff8a2a);
  const bodyGeo = new THREE.ConeGeometry(0.28, 0.9, 14);
  bodyGeo.rotateX(Math.PI);
  const c = mesh(bodyGeo, orange);
  c.position.y = 0.62;
  r.body.add(c);
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2 - i * 0.04, 0.012, 4, 16), toon(0xe0661a));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.82 - i * 0.16;
    r.body.add(ring);
  }
  const leaves = new THREE.Group();
  leaves.position.y = 1.08;
  for (let i = 0; i < 5; i++) {
    const l = mesh(new THREE.ConeGeometry(0.06, 0.36, 5), mat(r, 0x4fd14a), 0.01);
    l.position.y = 0.14;
    const piv = new THREE.Group();
    piv.rotation.set(Math.cos(i * 1.3) * 0.5, 0, Math.sin(i * 1.3) * 0.5);
    piv.add(l);
    leaves.add(piv);
  }
  r.body.add(leaves);
  r.parts.leaves = leaves;
  for (const s of [-1, 1]) {
    const e = eye(r, 0.075);
    e.position.set(s * 0.1, 0.88, 0.2);
    e.rotation.y = s * 0.25;
    e.userData.brow?.rotation.set(0, 0, -s * 0.55);
    r.body.add(e);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 5, 12, Math.PI), toon(0x5a1a10));
  mouth.position.set(0, 0.72, 0.23);
  r.body.add(mouth);
  r.parts.mouth = mouth;
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.1, 0.24, 0);
    r.root.add(leg);
    const l = mesh(new THREE.CapsuleGeometry(0.04, 0.12, 3, 6), toon(0xe0661a), 0.01);
    l.position.y = -0.1;
    leg.add(l);
    const foot = mesh(new THREE.SphereGeometry(0.06, 8, 6), toon(0xe0661a), 0.01);
    foot.scale.set(1, 0.6, 1.5);
    foot.position.set(0, -0.2, 0.03);
    leg.add(foot);
    r.parts[s < 0 ? 'legL' : 'legR'] = leg;
    const arm = new THREE.Group();
    arm.position.set(s * 0.22, 0.7, 0);
    const a = mesh(new THREE.CapsuleGeometry(0.03, 0.14, 3, 6), toon(0xe0661a), 0.01);
    a.position.y = -0.09;
    arm.add(a);
    r.body.add(arm);
    r.parts[s < 0 ? 'armL' : 'armR'] = arm;
  }
  r.headHeight = 0.9;
  r.bodyHeight = 0.6;
  return r;
}

function bubbleBot(): EnemyRig {
  const r = base();
  const dome = mesh(new THREE.SphereGeometry(0.5, 24, 18), mat(r, 0x9fe8ff, { transparent: true, opacity: 0.35 }), 0.015);
  dome.position.y = 0.1;
  r.body.add(dome);
  const baseRing = mesh(new THREE.TorusGeometry(0.46, 0.1, 10, 28), mat(r, 0xff8ad8));
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = -0.22;
  r.body.add(baseRing);
  const core = new THREE.Group();
  core.position.y = 0.05;
  r.body.add(core);
  const bot = mesh(new THREE.SphereGeometry(0.2, 16, 12), mat(r, 0xfff0a0), 0.012);
  core.add(bot);
  for (const s of [-1, 1]) {
    const e = eye(r, 0.05, false);
    e.position.set(s * 0.07, 0.03, 0.16);
    core.add(e);
  }
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fffea).multiplyScalar(1.6), transparent: true, opacity: 0.5 }));
  glow.position.y = -0.2;
  r.body.add(glow);
  r.parts.core = core;
  const wand = new THREE.Group();
  wand.position.set(0.5, -0.1, 0.1);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), toon(0x8a5cff));
  stick.position.y = 0.2;
  wand.add(stick);
  const loop = mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 18), mat(r, 0xff8ad8), 0.008);
  loop.position.y = 0.52;
  wand.add(loop);
  r.body.add(wand);
  r.parts.wand = wand;
  r.headHeight = 0.1;
  r.bodyHeight = 0.1;
  return r;
}

function boar(): EnemyRig {
  const r = base();
  const fur = mat(r, 0x7a4a3a);
  const furDark = mat(r, 0x5a3228);
  const metal = mat(r, 0x8a93a8);
  const torso = mesh(new THREE.SphereGeometry(0.95, 24, 18), fur, 0.03);
  torso.scale.set(1.05, 0.95, 1.2);
  torso.position.y = 1.35;
  r.body.add(torso);
  const belly = mesh(new THREE.SphereGeometry(0.7, 18, 12), mat(r, 0xb88468), 0);
  belly.scale.set(1, 0.9, 0.6);
  belly.position.set(0, 1.2, 0.55);
  r.body.add(belly);
  const head = new THREE.Group();
  head.position.set(0, 2.0, 0.85);
  r.body.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.62, 20, 16), fur, 0.03);
  skull.scale.set(1, 0.9, 1);
  head.add(skull);
  const snout = mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.3, 18).rotateX(Math.PI / 2), furDark, 0.025);
  snout.position.set(0, -0.15, 0.55);
  head.add(snout);
  for (const s of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), toon(0x2a1010));
    n.scale.set(0.8, 1.2, 0.3);
    n.position.set(s * 0.1, -0.15, 0.71);
    head.add(n);
    const tusk = mesh(new THREE.ConeGeometry(0.07, 0.42, 8), toon(0xfff4dc), 0.015);
    tusk.position.set(s * 0.24, -0.28, 0.55);
    tusk.rotation.set(-0.3, 0, -s * 0.5);
    head.add(tusk);
    const e = eye(r, 0.11, true, 0xff2a2a);
    e.position.set(s * 0.22, 0.12, 0.5);
    e.rotation.y = s * 0.3;
    e.userData.brow?.rotation.set(0, 0, -s * 0.5);
    head.add(e);
    const ear = mesh(new THREE.ConeGeometry(0.18, 0.36, 4).scale(1, 1, 0.4), fur, 0.02);
    ear.position.set(s * 0.42, 0.45, -0.05);
    ear.rotation.z = -s * 0.6;
    head.add(ear);
  }
  // mohawk
  for (let i = 0; i < 6; i++) {
    const sp = mesh(new THREE.ConeGeometry(0.1, 0.4, 5), furDark, 0.015);
    sp.position.set(0, 0.55 - i * 0.05, 0.25 - i * 0.22);
    sp.rotation.x = -0.4 - i * 0.15;
    head.add(sp);
  }
  // armour pieces (shootable off)
  const helmet = mesh(new THREE.SphereGeometry(0.66, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), metal, 0.025);
  helmet.position.y = 0.05;
  head.add(helmet);
  r.armor.push(helmet);
  for (const s of [-1, 1]) {
    const pad = mesh(new RoundedBoxGeometry(0.7, 0.35, 0.8, 3, 0.12), metal, 0.025);
    pad.position.set(s * 0.85, 1.85, 0.1);
    pad.rotation.z = -s * 0.5;
    r.body.add(pad);
    r.armor.push(pad);
  }
  const backPlate = mesh(new RoundedBoxGeometry(1.2, 0.9, 0.3, 3, 0.12), metal, 0.025);
  backPlate.position.set(0, 1.6, -1.0);
  backPlate.rotation.x = 0.3;
  r.body.add(backPlate);
  r.armor.push(backPlate);
  // weak point: glowing battery on the back, hidden under the plate
  const battery = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 14).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6affff).multiplyScalar(2.2) }));
  battery.position.set(0, 1.6, -0.95);
  r.body.add(battery);
  r.parts.battery = battery;
  for (const s of [-1, 1]) {
    for (const f of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(s * 0.55, 0.75, f * 0.5);
      r.root.add(leg);
      const l = mesh(new THREE.CapsuleGeometry(0.2, 0.35, 4, 10), furDark, 0.025);
      l.position.y = -0.35;
      leg.add(l);
      const hoof = mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.16, 10), toon(0x2a1a14), 0.02);
      hoof.position.y = -0.7;
      leg.add(hoof);
      r.parts[`leg${s < 0 ? 'L' : 'R'}${f < 0 ? 'B' : 'F'}`] = leg;
    }
  }
  r.parts.head = head;
  r.headHeight = 2.0;
  r.bodyHeight = 1.35;
  return r;
}

export function buildEnemyRig(type: EnemyType): EnemyRig {
  const rig = type === 'chicken' ? chicken() : type === 'toast' ? toaster() : type === 'carrot' ? carrot() : type === 'bubble' ? bubbleBot() : boar();
  rig.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name !== 'outline') o.castShadow = true;
  });
  return rig;
}
