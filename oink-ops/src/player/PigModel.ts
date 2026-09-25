import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { outline, toon, INK } from '../render/Toon';

export interface PigColors {
  skin: number;
  skinDark: number;
  belly: number;
  armor: number;
  trim: number;
  boots: number;
  gloves: number;
  band: number;
  pack: number;
}

export const DEFAULT_PIG_COLORS: PigColors = {
  skin: 0xffa6bd,
  skinDark: 0xf07c9a,
  belly: 0xffcad6,
  armor: 0x3fb6c9,
  trim: 0xffc94a,
  boots: 0x7a4a2c,
  gloves: 0x3b3a4a,
  band: 0xe8413c,
  pack: 0x6f9a3c,
};

const INK_W = 0.018;

/** Rounded capsule-ish limb along -Y starting at the pivot. */
function limb(radius: number, length: number, color: number, ink = INK_W): THREE.Mesh {
  const g = new THREE.CapsuleGeometry(radius, length, 6, 12);
  g.translate(0, -length / 2 - radius * 0.3, 0);
  const m = new THREE.Mesh(g, toon(color));
  outline(m, ink);
  return m;
}

function ball(r: number, color: number, ink = INK_W, seg = 20): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(10, seg - 6)), toon(color));
  if (ink) outline(m, ink);
  return m;
}

function rbox(w: number, h: number, d: number, r: number, color: number, ink = INK_W): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), toon(color));
  if (ink) outline(m, ink);
  return m;
}

/** Two-bone arm/leg chain. */
export interface Chain {
  root: THREE.Object3D;
  mid: THREE.Object3D;
  end: THREE.Object3D;
  l1: number;
  l2: number;
}

/**
 * TROTTER — the procedural warrior pig. Built as a hierarchy of pivots (a rig)
 * so the animator can pose every part. All proportions are chibi: big head,
 * short legs, oversized boots.
 */
export class PigModel {
  readonly root = new THREE.Group(); // at the feet
  readonly scaler = new THREE.Group(); // squash & stretch / giant power-up
  readonly hips = new THREE.Group();
  readonly spine = new THREE.Group();
  readonly chest = new THREE.Group();
  readonly neck = new THREE.Group();
  readonly head = new THREE.Group();
  readonly earL = new THREE.Group();
  readonly earR = new THREE.Group();
  readonly lidL = new THREE.Group();
  readonly lidR = new THREE.Group();
  readonly browL = new THREE.Group();
  readonly browR = new THREE.Group();
  readonly pupilL = new THREE.Group();
  readonly pupilR = new THREE.Group();
  readonly snout = new THREE.Group();
  readonly mouthSmile: THREE.Mesh;
  readonly mouthOpen: THREE.Mesh;
  readonly mouthFlat: THREE.Mesh;
  readonly tail = new THREE.Group();
  readonly bandTails: THREE.Object3D[] = [];
  readonly armL: Chain;
  readonly armR: Chain;
  readonly legL: Chain;
  readonly legR: Chain;
  /** Weapon attaches here; it lives on the chest so it follows the upper body. */
  readonly weaponRoot = new THREE.Group();
  readonly hatSocket = new THREE.Group();
  readonly faceSocket = new THREE.Group();
  readonly backSocket = new THREE.Group();
  readonly headband = new THREE.Group();
  readonly defaultPack = new THREE.Group();
  /** Materials that flash when hurt / glow gold when invincible. */
  readonly skinMats: THREE.MeshToonMaterial[] = [];
  readonly armorMat: THREE.MeshToonMaterial;
  readonly bodyHeight = 1.55;
  colors: PigColors;

  constructor(colors: PigColors = DEFAULT_PIG_COLORS) {
    this.colors = colors;
    // Per-pig unique materials (so tint/flash changes don't leak to other objects)
    const skin = toon(colors.skin, { unique: true });
    const skinDark = toon(colors.skinDark, { unique: true });
    const belly = toon(colors.belly, { unique: true });
    this.skinMats.push(skin, skinDark, belly);
    this.armorMat = toon(colors.armor, { unique: true });
    const skinMesh = (geo: THREE.BufferGeometry, mat = skin, ink = INK_W) => {
      const m = new THREE.Mesh(geo, mat);
      if (ink) outline(m, ink);
      return m;
    };

    this.root.add(this.scaler);
    this.scaler.add(this.hips);
    this.hips.position.y = 0.44;
    this.hips.add(this.spine);
    this.spine.add(this.chest);
    this.chest.position.y = 0.12;

    // ---- Body
    const bodyGeo = new THREE.SphereGeometry(0.36, 28, 20);
    bodyGeo.scale(1, 1.02, 0.92);
    const body = skinMesh(bodyGeo);
    body.position.y = 0.16;
    this.chest.add(body);
    const bellyM = skinMesh(new THREE.SphereGeometry(0.27, 20, 14), belly, 0);
    bellyM.scale.set(1, 1.05, 0.55);
    bellyM.position.set(0, 0.08, 0.2);
    this.chest.add(bellyM);

    // Chest armour with gold trim and shoulder pads
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.3, 0.18, 3, 0.07), this.armorMat);
    outline(plate, INK_W);
    plate.position.set(0, 0.24, 0.24);
    plate.rotation.x = -0.18;
    this.chest.add(plate);
    const trim = rbox(0.52, 0.05, 0.19, 0.02, colors.trim, 0);
    trim.position.set(0, 0.1, 0.25);
    trim.rotation.x = -0.18;
    this.chest.add(trim);
    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), toon(colors.trim));
    emblem.rotation.x = Math.PI / 2 - 0.18;
    emblem.position.set(0, 0.26, 0.345);
    this.chest.add(emblem);
    for (const s of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.armorMat);
      outline(pad, INK_W);
      pad.position.set(s * 0.3, 0.33, 0.02);
      pad.rotation.z = -s * 0.5;
      pad.scale.set(1.1, 0.9, 1);
      this.chest.add(pad);
    }
    // Belt with buckle
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 8, 32), toon(0x5a3a22));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.02;
    belt.scale.set(1, 0.92, 1);
    this.chest.add(belt);
    const buckle = rbox(0.1, 0.07, 0.03, 0.01, colors.trim, 0.01);
    buckle.position.set(0, 0.02, 0.31);
    this.chest.add(buckle);

    // Backpack (default cosmetic)
    const pack = rbox(0.36, 0.38, 0.2, 0.06, colors.pack);
    pack.position.set(0, 0.22, -0.33);
    const pocket = rbox(0.26, 0.14, 0.06, 0.03, 0x5a8030, 0.012);
    pocket.position.set(0, -0.08, -0.11);
    pack.add(pocket);
    const flap = rbox(0.34, 0.08, 0.21, 0.03, 0x587e2c, 0.012);
    flap.position.set(0, 0.17, 0);
    pack.add(flap);
    this.defaultPack.add(pack);
    for (const s of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 6, 16, Math.PI), toon(0x4a3a2a));
      strap.position.set(s * 0.15, 0.27, -0.02);
      strap.rotation.y = Math.PI / 2;
      this.defaultPack.add(strap);
    }
    this.backSocket.add(this.defaultPack);
    this.chest.add(this.backSocket);

    // Curly tail
    const tailPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const a = t * Math.PI * 3.2;
      tailPts.push(new THREE.Vector3(Math.cos(a) * 0.05 * (1 - t * 0.4), Math.sin(a) * 0.05 * (1 - t * 0.4) + t * 0.02, -t * 0.12));
    }
    const tailM = skinMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts), 40, 0.018, 6), skinDark, 0.008);
    this.tail.add(tailM);
    this.tail.position.set(0, 0.0, -0.33);
    this.chest.add(this.tail);

    // ---- Head
    this.neck.position.y = 0.46;
    this.chest.add(this.neck);
    this.neck.add(this.head);
    this.head.position.y = 0.26;
    const headGeo = new THREE.SphereGeometry(0.4, 32, 24);
    headGeo.scale(1.04, 0.95, 0.98);
    this.head.add(skinMesh(headGeo, skin, 0.02));
    // Cheeks
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), toon(0xff7f9f, { transparent: true, opacity: 0.7 }));
      cheek.position.set(s * 0.25, -0.1, 0.3);
      cheek.lookAt(s * 0.6, -0.2, 1.2);
      this.head.add(cheek);
    }
    // Snout
    this.snout.position.set(0, -0.07, 0.36);
    this.head.add(this.snout);
    const snoutGeo = new THREE.CylinderGeometry(0.15, 0.165, 0.14, 24);
    snoutGeo.rotateX(Math.PI / 2);
    const snoutM = skinMesh(snoutGeo, skinDark, 0.016);
    this.snout.add(snoutM);
    const snoutCap = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), skinDark);
    snoutCap.position.z = 0.071;
    this.snout.add(snoutCap);
    for (const s of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), toon(0x7a2a44));
      nostril.scale.set(0.8, 1.3, 0.3);
      nostril.position.set(s * 0.055, 0, 0.074);
      this.snout.add(nostril);
    }
    // Eyes with pupils, highlights, lids and brows
    for (const s of [-1, 1]) {
      const eyeRoot = new THREE.Group();
      eyeRoot.position.set(s * 0.155, 0.09, 0.3);
      eyeRoot.rotation.y = s * 0.28;
      this.head.add(eyeRoot);
      const white = ball(0.11, 0xffffff, 0.012);
      white.scale.set(0.9, 1.08, 0.72);
      eyeRoot.add(white);
      const pupil = s < 0 ? this.pupilL : this.pupilR;
      pupil.position.set(0, -0.005, 0.06);
      eyeRoot.add(pupil);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), toon(0x2a1a3a));
      iris.scale.set(0.9, 1.15, 0.5);
      pupil.add(iris);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.position.set(0.02, 0.03, 0.03);
      pupil.add(hl);
      const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl2.position.set(-0.018, -0.022, 0.03);
      pupil.add(hl2);
      // Upper eyelid: hemisphere that rotates down over the eye to blink/squint
      const lid = s < 0 ? this.lidL : this.lidR;
      eyeRoot.add(lid);
      const lidM = new THREE.Mesh(new THREE.SphereGeometry(0.118, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), skin);
      lidM.scale.set(0.92, 1.1, 0.78);
      outline(lidM, 0.01);
      lid.add(lidM);
      lid.rotation.x = -1.5;
      const brow = s < 0 ? this.browL : this.browR;
      brow.position.set(0, 0.14, 0.02);
      eyeRoot.add(brow);
      const browM = rbox(0.13, 0.035, 0.035, 0.015, 0x6a3044, 0);
      brow.add(browM);
    }
    // Mouths (swapped by expression)
    this.mouthSmile = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 6, 16, Math.PI), toon(0x7a2a44));
    this.mouthSmile.rotation.z = Math.PI;
    this.mouthSmile.position.set(0, -0.2, 0.33);
    this.mouthSmile.rotation.x = -0.3;
    this.head.add(this.mouthSmile);
    this.mouthOpen = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10), toon(0x5a1a30));
    this.mouthOpen.scale.set(1, 0.8, 0.4);
    this.mouthOpen.position.set(0, -0.22, 0.32);
    this.mouthOpen.visible = false;
    this.head.add(this.mouthOpen);
    this.mouthFlat = rbox(0.09, 0.02, 0.02, 0.008, 0x7a2a44, 0);
    this.mouthFlat.position.set(0, -0.215, 0.335);
    this.mouthFlat.visible = false;
    this.head.add(this.mouthFlat);

    // Ears: floppy triangles on pivots
    for (const s of [-1, 1]) {
      const ear = s < 0 ? this.earL : this.earR;
      ear.position.set(s * 0.25, 0.28, -0.02);
      ear.rotation.set(0.25, 0, s * -0.55);
      this.head.add(ear);
      const earGeo = new THREE.ConeGeometry(0.14, 0.3, 4, 1);
      earGeo.scale(1, 1, 0.35);
      earGeo.translate(0, 0.15, 0);
      const earM = skinMesh(earGeo, skin, 0.014);
      ear.add(earM);
      const inner = new THREE.Mesh(earGeo.clone().scale(0.62, 0.7, 0.5), skinDark);
      inner.position.set(0, 0.02, 0.035);
      ear.add(inner);
    }

    // Headband with trailing tails
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.04, 8, 36), toon(colors.band));
    band.rotation.x = Math.PI / 2 - 0.12;
    band.position.y = 0.2;
    band.scale.set(1.04, 1, 1);
    outline(band, 0.01);
    this.headband.add(band);
    const knot = ball(0.055, colors.band, 0.01, 12);
    knot.position.set(0, 0.18, -0.4);
    this.headband.add(knot);
    for (const s of [-1, 1]) {
      let parent: THREE.Object3D = this.headband;
      const start = new THREE.Group();
      start.position.set(s * 0.03, 0.17, -0.42);
      parent.add(start);
      parent = start;
      for (let i = 0; i < 3; i++) {
        const seg = new THREE.Group();
        if (i > 0) seg.position.z = -0.1;
        const m = rbox(0.06, 0.018, 0.11, 0.008, colors.band, 0);
        m.position.z = -0.05;
        seg.add(m);
        parent.add(seg);
        this.bandTails.push(seg);
        parent = seg;
      }
      start.rotation.y = s * 0.3;
    }
    this.head.add(this.headband);
    this.hatSocket.position.y = 0.3;
    this.head.add(this.hatSocket);
    this.faceSocket.position.set(0, 0.09, 0.34);
    this.head.add(this.faceSocket);

    // ---- Arms (IK chains). Pivots sit in chest space.
    const mkArm = (s: number): Chain => {
      const root = new THREE.Group();
      root.position.set(s * 0.3, 0.28, 0.04);
      this.chest.add(root);
      const upper = limb(0.075, 0.15, colors.skin);
      root.add(upper);
      const mid = new THREE.Group();
      mid.position.y = -0.25;
      root.add(mid);
      const fore = limb(0.07, 0.13, colors.skin);
      mid.add(fore);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.07, 14), toon(colors.gloves));
      cuff.position.y = -0.2;
      mid.add(cuff);
      const end = new THREE.Group();
      end.position.y = -0.25;
      mid.add(end);
      const glove = ball(0.085, colors.gloves, INK_W, 16);
      glove.scale.set(1, 0.9, 1.1);
      end.add(glove);
      for (let f = 0; f < 3; f++) {
        const tip = ball(0.028, colors.skin, 0.008, 10);
        tip.position.set((f - 1) * 0.035, -0.07, 0.035);
        end.add(tip);
      }
      const thumb = ball(0.03, colors.skin, 0.008, 10);
      thumb.position.set(-s * 0.06, -0.03, 0.05);
      end.add(thumb);
      return { root, mid, end, l1: 0.25, l2: 0.25 };
    };
    this.armL = mkArm(-1);
    this.armR = mkArm(1);

    // ---- Legs
    const mkLeg = (s: number): Chain => {
      const root = new THREE.Group();
      root.position.set(s * 0.15, 0.02, 0);
      this.hips.add(root);
      root.add(limb(0.095, 0.06, colors.skin));
      const mid = new THREE.Group();
      mid.position.y = -0.18;
      root.add(mid);
      const shin = limb(0.085, 0.03, colors.skin);
      mid.add(shin);
      const end = new THREE.Group();
      end.position.y = -0.14;
      mid.add(end);
      const boot = rbox(0.21, 0.17, 0.31, 0.07, colors.boots);
      boot.position.set(0, -0.03, 0.045);
      end.add(boot);
      const sole = rbox(0.22, 0.05, 0.32, 0.02, 0x3a2418, 0.01);
      sole.position.set(0, -0.11, 0.045);
      end.add(sole);
      const lace = rbox(0.12, 0.04, 0.06, 0.015, 0xe8c890, 0);
      lace.position.set(0, 0.03, 0.17);
      end.add(lace);
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 16), toon(0x5a3420));
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = 0.06;
      end.add(cuff);
      return { root, mid, end, l1: 0.18, l2: 0.14 };
    };
    this.legL = mkLeg(-1);
    this.legR = mkLeg(1);

    this.chest.add(this.weaponRoot);
    this.weaponRoot.position.set(0.12, 0.22, 0.42);

    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name !== 'outline') {
        o.castShadow = true;
        o.receiveShadow = false;
      }
    });
  }

  /** Recolours the pig (customisation). */
  setColors(c: Partial<PigColors>) {
    this.colors = { ...this.colors, ...c };
    if (c.skin !== undefined) this.skinMats[0].color.set(c.skin);
    if (c.skinDark !== undefined) this.skinMats[1].color.set(c.skinDark);
    if (c.belly !== undefined) this.skinMats[2].color.set(c.belly);
    if (c.armor !== undefined) this.armorMat.color.set(c.armor);
  }

  /** Emissive tint applied to skin & armour (hurt flash, golden invincibility). */
  setTint(color: THREE.Color, amount: number) {
    for (const m of [...this.skinMats, this.armorMat]) {
      m.emissive.copy(color);
      m.emissiveIntensity = amount;
    }
  }
}

// ------------------------------------------------------------------ IK

const _t = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _s = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);
const _m = new THREE.Matrix4();
const _pq = new THREE.Quaternion();

/**
 * Analytic two-bone IK. Bones point down -Y in their local space. `target` and
 * `pole` are world-space; the chain root's parent must have an up-to-date matrixWorld.
 */
export function solveTwoBone(chain: Chain, target: THREE.Vector3, pole: THREE.Vector3) {
  const parent = chain.root.parent!;
  _m.copy(parent.matrixWorld).invert();
  _t.copy(target).applyMatrix4(_m);
  _pole.copy(pole).applyMatrix4(_m);
  _s.copy(chain.root.position);
  _dir.subVectors(_t, _s);
  let d = _dir.length();
  const { l1, l2 } = chain;
  d = Math.min(Math.max(d, Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);
  _dir.normalize();
  // shoulder angle and elbow bend from the law of cosines
  const a = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const b = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2))));
  // orient -Y along the target direction
  _q.setFromUnitVectors(_down, _dir);
  // bend plane defined by pole
  _pole.sub(_s);
  _axis.crossVectors(_dir, _pole);
  if (_axis.lengthSq() < 1e-8) _axis.set(1, 0, 0);
  _axis.normalize();
  _q2.setFromAxisAngle(_axis, a);
  chain.root.quaternion.copy(_q2.multiply(_q));
  // elbow: rotate around the same axis expressed in the upper bone's local space
  _pq.copy(chain.root.quaternion).invert();
  _axis.applyQuaternion(_pq);
  chain.mid.quaternion.setFromAxisAngle(_axis, -(Math.PI - b));
}
