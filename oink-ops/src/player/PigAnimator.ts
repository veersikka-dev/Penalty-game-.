import * as THREE from 'three';
import { PigModel, solveTwoBone } from './PigModel';
import type { WeaponModel } from '../weapons/WeaponModels';
import { clamp, damp, lerp, smoothstep } from '../utils/MathUtils';
import { canvasTexture } from '../utils/textures';

export type Expression = 'neutral' | 'happy' | 'angry' | 'annoyed' | 'confused' | 'hurt' | 'surprised' | 'dizzy';
export type Emote = 'question' | 'exclaim' | 'anger' | 'stars' | 'heart' | 'sweat';
type Fidget = 'look' | 'scratch' | 'inspect' | 'yawn' | 'sniff';

export interface AnimInput {
  dt: number;
  time: number;
  speed: number;
  sprint: boolean;
  grounded: boolean;
  vy: number;
  aim: number;
  crouch: boolean;
  /** Camera pitch (radians, +up) used to point the weapon. */
  aimPitch: number;
  /** Camera yaw minus body yaw, for upper-body twist. */
  aimYaw: number;
  /** Local-space strafe amount (-1..1) for leaning. */
  strafe: number;
}

/** A small spring used for ears, band tails and secondary motion. */
class Spring {
  x = 0;
  v = 0;
  constructor(public k = 90, public d = 9) {}
  step(target: number, dt: number) {
    this.v += ((target - this.x) * this.k - this.v * this.d) * dt;
    this.x += this.v * dt;
    return this.x;
  }
}

const EMOTE_TEX = new Map<Emote, THREE.Texture>();
export function emoteTexture(kind: Emote): THREE.Texture {
  const hit = EMOTE_TEX.get(kind);
  if (hit) return hit;
  const tex = canvasTexture(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const bubble = (fill: string) => {
      g.fillStyle = fill;
      g.strokeStyle = '#2b1d33';
      g.lineWidth = 8;
      g.beginPath();
      g.arc(w / 2, h / 2 - 6, 46, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(w / 2 - 12, h / 2 + 34);
      g.lineTo(w / 2 - 4, h - 8);
      g.lineTo(w / 2 + 12, h / 2 + 32);
      g.fill();
    };
    g.font = 'bold 72px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (kind === 'question' || kind === 'exclaim') {
      bubble('#ffffff');
      g.fillStyle = kind === 'question' ? '#6a5cff' : '#ff4a5a';
      g.fillText(kind === 'question' ? '?' : '!', w / 2, h / 2 - 2);
    } else if (kind === 'anger') {
      g.strokeStyle = '#ff3a4a';
      g.lineWidth = 12;
      g.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        g.save();
        g.translate(w / 2, h / 2);
        g.rotate((i * Math.PI) / 2 + Math.PI / 4);
        g.beginPath();
        g.moveTo(12, -8);
        g.quadraticCurveTo(34, 0, 12, 8);
        g.stroke();
        g.restore();
      }
    } else if (kind === 'stars') {
      g.fillStyle = '#ffd84a';
      g.strokeStyle = '#2b1d33';
      g.lineWidth = 5;
      for (const [x, y, s] of [[34, 64, 20], [94, 50, 24], [66, 96, 16]] as const) {
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 ? s * 0.45 : s;
          g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        g.closePath();
        g.fill();
        g.stroke();
      }
    } else if (kind === 'heart') {
      g.fillStyle = '#ff5a8a';
      g.strokeStyle = '#2b1d33';
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(64, 104);
      g.bezierCurveTo(10, 64, 30, 16, 64, 42);
      g.bezierCurveTo(98, 16, 118, 64, 64, 104);
      g.fill();
      g.stroke();
    } else {
      g.fillStyle = '#7fd4ff';
      g.strokeStyle = '#2b1d33';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(64, 18);
      g.quadraticCurveTo(100, 76, 64, 104);
      g.quadraticCurveTo(28, 76, 64, 18);
      g.fill();
      g.stroke();
    }
  }, false);
  EMOTE_TEX.set(kind, tex);
  return tex;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _pole = new THREE.Vector3();

/**
 * Procedural animation for Trotter. Pose is rebuilt every frame from blended,
 * smoothed parameters, so transitions (idle→walk→run→sprint, aim→shoot→recoil,
 * jump→fall→land, hit→recover) are always continuous — nothing snaps.
 */
export class PigAnimator {
  weapon: WeaponModel | null = null;
  private phase = 0;
  private move = 0;
  private aimW = 0;
  private hipFire = 0;
  private crouchW = 0;
  private airW = 0;
  private recoil = 0;
  private squash = new Spring(160, 10);
  private squashKick = 0;
  private hurt = 0;
  private hurtDir = 1;
  private reloadT = -1;
  private reloadDur = 1;
  private dodgeT = -1;
  private dodgeDur = 0.45;
  private celebrateT = -1;
  private victory = false;
  private dead = false;
  private deadT = 0;
  private blinkT = 2;
  private blinking = 0;
  private idleTime = 0;
  private fidget: Fidget | null = null;
  private fidgetT = 0;
  private lastFidget: Fidget | null = null;
  private expr: Expression = 'neutral';
  private exprT = 0;
  private emote: THREE.Sprite;
  private emoteT = 0;
  private earL = new Spring(70, 7);
  private earR = new Spring(70, 7);
  private earFlap = 0;
  private bandSprings = [new Spring(40, 5), new Spring(40, 5), new Spring(40, 5)];
  private tailWag = 0;
  private prevVy = 0;
  private headYaw = 0;
  private headPitch = 0;
  private lidTarget = -1.5;
  private leftHandW = 1;

  constructor(readonly model: PigModel) {
    this.emote = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoteTexture('question'), transparent: true, depthTest: false }));
    this.emote.renderOrder = 50;
    this.emote.position.set(0.25, 0.75, 0);
    this.emote.scale.setScalar(0.001);
    this.emote.visible = false;
    model.head.add(this.emote);
  }

  // ---------------------------------------------------------------- triggers
  shot() {
    this.recoil = Math.min(1.4, this.recoil + 1);
    this.hipFire = 1;
    this.setExpression('angry', 0.6);
  }
  jump() {
    this.squashKick = 0.22;
  }
  land(strength: number) {
    this.squashKick = -clamp(strength * 0.05, 0.08, 0.32);
  }
  hit(dirSign: number) {
    this.hurt = 1;
    this.hurtDir = dirSign;
    this.setExpression('hurt', 0.5);
  }
  reload(duration: number) {
    this.reloadT = 0;
    this.reloadDur = duration;
  }
  dodge(duration: number) {
    this.dodgeT = 0;
    this.dodgeDur = duration;
  }
  celebrate() {
    this.celebrateT = 0;
    this.setExpression('happy', 1.6);
    this.showEmote('heart', 1.4);
  }
  setVictory(v: boolean) {
    this.victory = v;
    if (v) this.setExpression('happy', 999);
  }
  setDead(d: boolean) {
    this.dead = d;
    this.deadT = 0;
    if (d) {
      this.setExpression('dizzy', 999);
      this.showEmote('stars', 999);
    } else {
      this.expr = 'neutral';
      this.emoteT = 0;
    }
  }
  setExpression(e: Expression, duration: number) {
    this.expr = e;
    this.exprT = duration;
  }
  showEmote(kind: Emote, duration = 1.4) {
    (this.emote.material as THREE.SpriteMaterial).map = emoteTexture(kind);
    this.emote.visible = true;
    this.emoteT = duration;
  }
  /** Interrupts idle fidgets (called whenever the player acts). */
  poke() {
    this.idleTime = 0;
    this.fidget = null;
  }
  get isReloading() {
    return this.reloadT >= 0;
  }

  // ---------------------------------------------------------------- update
  update(i: AnimInput) {
    const m = this.model;
    const dt = i.dt;
    const t = i.time;

    // ---- smoothed blend parameters
    this.move = damp(this.move, clamp(i.speed / 9.5, 0, 1.25), 10, dt);
    this.aimW = damp(this.aimW, Math.max(i.aim, this.hipFire > 0 ? 0.85 : 0), 14, dt);
    this.hipFire = Math.max(0, this.hipFire - dt * 1.6);
    this.crouchW = damp(this.crouchW, i.crouch ? 1 : 0, 12, dt);
    this.airW = damp(this.airW, i.grounded ? 0 : 1, 14, dt);
    this.recoil = damp(this.recoil, 0, 14, dt);
    this.hurt = Math.max(0, this.hurt - dt * 3.2);
    const walkW = smoothstep(0.02, 0.25, this.move) * (1 - this.airW);
    const runW = smoothstep(0.45, 0.9, this.move);
    const sprintW = i.sprint ? smoothstep(0.8, 1.1, this.move) : 0;
    const freq = 5.5 + this.move * 6;
    this.phase += dt * freq * (walkW > 0.01 ? 1 : 0.2);
    const ph = this.phase;

    // idle fidgets
    const idle = i.speed < 0.3 && i.grounded && i.aim < 0.1 && this.reloadT < 0 && !this.dead && !this.victory && this.celebrateT < 0;
    this.idleTime = idle ? this.idleTime + dt : 0;
    if (!idle) this.fidget = null;
    if (idle && !this.fidget && this.idleTime > 5 + Math.random() * 3) {
      const options: Fidget[] = ['look', 'scratch', 'inspect', 'yawn', 'sniff'];
      let f = options[Math.floor(Math.random() * options.length)];
      if (f === this.lastFidget) f = options[(options.indexOf(f) + 1) % options.length];
      this.fidget = f;
      this.lastFidget = f;
      this.fidgetT = 0;
      if (f === 'yawn') this.setExpression('neutral', 0);
    }
    if (this.fidget) {
      this.fidgetT += dt;
      if (this.fidgetT > 2.6) {
        this.fidget = null;
        this.idleTime = 0;
      }
    }
    const fk = this.fidget ? Math.sin(Math.min(1, this.fidgetT / 2.6) * Math.PI) : 0; // 0→1→0 envelope

    // ---- whole-body squash & stretch
    if (this.squashKick !== 0) {
      this.squash.v += this.squashKick * 22;
      this.squashKick = 0;
    }
    const sq = this.squash.step(0, dt);
    const breathe = Math.sin(t * 2.3) * 0.012 * (1 - this.move);
    const sy = 1 + sq + breathe;
    const sxz = 1 / Math.sqrt(Math.max(0.3, sy));
    m.scaler.scale.set(sxz, sy, sxz);

    // ---- hips & legs
    const bob = Math.abs(Math.sin(ph)) * (0.035 + runW * 0.04) * walkW;
    let hipsY = 0.44 + bob - this.crouchW * 0.13;
    m.hips.rotation.set(0, Math.sin(ph) * 0.1 * walkW, Math.sin(ph) * 0.06 * walkW * (1 - runW * 0.5));
    const amp = lerp(0.55, 1.0, runW) * walkW;
    let hipL = -Math.sin(ph) * amp;
    let hipR = Math.sin(ph) * amp;
    let kneeL = Math.max(0, Math.cos(ph)) * amp * 1.4;
    let kneeR = Math.max(0, -Math.cos(ph)) * amp * 1.4;
    // crouch
    hipL -= this.crouchW * 0.7;
    hipR -= this.crouchW * 0.7;
    kneeL += this.crouchW * 1.3;
    kneeR += this.crouchW * 1.3;
    // airborne: tuck on the way up, flail on the way down
    if (this.airW > 0.01) {
      const up = i.vy > 0;
      const aL = up ? -0.9 : -0.3 + Math.sin(t * 13) * 0.35;
      const aR = up ? -0.2 : -0.3 - Math.sin(t * 13) * 0.35;
      hipL = lerp(hipL, aL, this.airW);
      hipR = lerp(hipR, aR, this.airW);
      kneeL = lerp(kneeL, up ? 1.3 : 0.5, this.airW);
      kneeR = lerp(kneeR, up ? 0.7 : 0.5, this.airW);
    }
    // ---- spine / chest
    let spineX = runW * 0.12 + sprintW * 0.2 - this.aimW * 0.05 + this.crouchW * 0.2;
    let spineY = clamp(i.aimYaw, -0.7, 0.7) * this.aimW;
    let spineZ = -i.strafe * 0.08 * walkW;
    spineX -= this.recoil * 0.05;
    spineX -= this.hurt * 0.45;
    spineZ += this.hurt * 0.2 * this.hurtDir;
    // dodge roll: full forward flip around the hips
    let hipsRoll = 0;
    if (this.dodgeT >= 0) {
      this.dodgeT += dt;
      const p = clamp(this.dodgeT / this.dodgeDur, 0, 1);
      hipsRoll = p * Math.PI * 2;
      hipsY -= Math.sin(p * Math.PI) * 0.18;
      hipL = kneeL = kneeR = hipR = 0;
      hipL = hipR = -1.2;
      kneeL = kneeR = 1.8;
      if (p >= 1) this.dodgeT = -1;
    }
    // celebrate hop
    let celebrate = 0;
    if (this.celebrateT >= 0) {
      this.celebrateT += dt;
      celebrate = Math.sin(clamp(this.celebrateT / 1.3, 0, 1) * Math.PI);
      hipsY += Math.abs(Math.sin(this.celebrateT * 9)) * 0.12 * celebrate;
      if (this.celebrateT > 1.3) this.celebrateT = -1;
    }
    if (this.victory) {
      hipsY += Math.abs(Math.sin(t * 6)) * 0.1;
      m.hips.rotation.y = Math.sin(t * 3) * 0.5;
      m.hips.rotation.z = Math.sin(t * 6) * 0.12;
      hipL = Math.sin(t * 6) * 0.4;
      hipR = -Math.sin(t * 6) * 0.4;
    }
    // death: flop onto the back
    if (this.dead) {
      this.deadT += dt;
      const p = smoothstep(0, 0.6, this.deadT);
      spineX = lerp(spineX, -1.35, p);
      hipsY = lerp(hipsY, 0.24, p);
      hipL = lerp(hipL, -1.6, p) + Math.sin(t * 20) * 0.15 * (1 - smoothstep(0.6, 1.4, this.deadT));
      hipR = lerp(hipR, -1.4, p);
      kneeL = kneeR = lerp(0, 0.4, p);
      spineY = 0;
    }
    m.hips.position.y = hipsY;
    m.hips.rotation.x = hipsRoll;
    m.spine.rotation.set(spineX, spineY, spineZ);
    m.chest.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5);
    m.legL.root.rotation.set(hipL, 0, 0.04);
    m.legR.root.rotation.set(hipR, 0, -0.04);
    m.legL.mid.rotation.set(kneeL, 0, 0);
    m.legR.mid.rotation.set(kneeR, 0, 0);
    m.legL.end.rotation.set(-(hipL + kneeL) * 0.75, 0, 0);
    m.legR.end.rotation.set(-(hipR + kneeR) * 0.75, 0, 0);

    // ---- head
    let yawT = -spineY * 0.3;
    let pitchT = i.aimPitch * 0.35 * this.aimW - this.hurt * 0.2;
    let rollT = 0;
    if (this.fidget === 'look') yawT += Math.sin(this.fidgetT * 2.2) * 0.8 * fk;
    if (this.fidget === 'yawn') { pitchT += 0.35 * fk; rollT += 0.1 * fk; }
    if (this.fidget === 'sniff') { yawT += Math.sin(this.fidgetT * 5) * 0.3 * fk; pitchT += 0.15 * fk; }
    if (this.fidget === 'inspect') { yawT += 0.35 * fk; pitchT -= 0.25 * fk; }
    if (this.fidget === 'scratch') rollT -= 0.25 * fk;
    if (this.expr === 'confused') rollT += 0.25;
    if (this.dead) { pitchT = 0.3; yawT = 0; }
    this.headYaw = damp(this.headYaw, yawT, 8, dt);
    this.headPitch = damp(this.headPitch, pitchT, 8, dt);
    m.neck.rotation.set(-this.headPitch - bob * 1.5, this.headYaw, rollT + Math.sin(ph) * 0.03 * walkW);
    m.head.rotation.set(0, 0, 0);
    // snout wiggle
    const sniff = this.fidget === 'sniff' ? Math.abs(Math.sin(this.fidgetT * 16)) * 0.12 * fk : 0;
    m.snout.scale.set(1 + sniff, 1 - sniff * 0.5, 1 + sniff * 0.6);

    // ---- ears (springs driven by vertical motion & speed)
    const vyDelta = i.vy - this.prevVy;
    this.prevVy = i.vy;
    this.earFlap = this.airW > 0.5 && i.vy < 0 ? Math.sin(t * 22) * 0.35 : 0;
    const earTarget = -0.1 + this.move * 0.35 + (this.airW > 0.5 ? (i.vy > 0 ? -0.3 : 0.5) : 0) - this.hurt * 0.4 + this.crouchW * 0.2;
    this.earL.v += -vyDelta * 0.6;
    this.earR.v += -vyDelta * 0.6;
    const eL = this.earL.step(earTarget + this.earFlap, dt);
    const eR = this.earR.step(earTarget - this.earFlap, dt);
    const twitch = Math.max(0, Math.sin(t * 1.3) - 0.97) * 8;
    m.earL.rotation.set(0.25 + eL, 0, 0.55 + eL * 0.4 + twitch * 0.3);
    m.earR.rotation.set(0.25 + eR, 0, -0.55 - eR * 0.4);

    // ---- headband tails & curly tail
    let parentDrive = -0.25 - this.move * 0.5 + (i.vy > 0 ? 0.3 : -0.2) * this.airW;
    this.bandSprings.forEach((s, k) => {
      const tgt = parentDrive + Math.sin(t * (7 + this.move * 6) + k * 1.3) * (0.1 + this.move * 0.2);
      const v = s.step(tgt, dt);
      m.bandTails[k].rotation.x = v;
      m.bandTails[k + 3].rotation.x = v;
      parentDrive = 0;
    });
    this.tailWag += dt * (6 + this.move * 10 + (this.expr === 'happy' ? 10 : 0));
    m.tail.rotation.set(Math.sin(this.tailWag) * 0.2, 0, Math.sin(this.tailWag * 1.3) * 0.4);

    // ---- face
    if (this.exprT > 0) {
      this.exprT -= dt;
      if (this.exprT <= 0 && !this.dead && !this.victory) this.expr = 'neutral';
    }
    let e = this.expr;
    if (e === 'neutral' && this.aimW > 0.6) e = 'angry';
    if (this.fidget === 'yawn' && fk > 0.3) e = 'surprised';
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blinking = 0.14;
      this.blinkT = 1.8 + Math.random() * 3.5;
    }
    this.blinking = Math.max(0, this.blinking - dt);
    const lidOpen: Record<Expression, number> = { neutral: -1.5, happy: -1.05, angry: -0.95, annoyed: -0.7, confused: -1.45, hurt: 0.1, surprised: -1.75, dizzy: 0.15 };
    this.lidTarget = damp(this.lidTarget, lidOpen[e], 14, dt);
    const lid = this.blinking > 0 || (this.fidget === 'yawn' && fk > 0.5) ? 0.2 : this.lidTarget;
    m.lidL.rotation.x = lid;
    m.lidR.rotation.x = e === 'confused' ? -1.1 : lid;
    const browTilt: Record<Expression, number> = { neutral: 0, happy: -0.15, angry: 0.4, annoyed: 0.1, confused: 0, hurt: -0.3, surprised: -0.2, dizzy: -0.2 };
    const browY: Record<Expression, number> = { neutral: 0.14, happy: 0.16, angry: 0.11, annoyed: 0.105, confused: 0.14, hurt: 0.13, surprised: 0.18, dizzy: 0.13 };
    m.browL.rotation.z = damp(m.browL.rotation.z, -browTilt[e], 12, dt);
    m.browR.rotation.z = damp(m.browR.rotation.z, e === 'confused' ? -0.35 : browTilt[e], 12, dt);
    m.browL.position.y = damp(m.browL.position.y, browY[e] + (e === 'confused' ? 0.03 : 0), 12, dt);
    m.browR.position.y = damp(m.browR.position.y, browY[e], 12, dt);
    const open = e === 'hurt' || e === 'surprised' || (this.airW > 0.7 && i.vy > 2) || this.recoil > 0.6 || celebrate > 0.3 || this.victory;
    m.mouthOpen.visible = open;
    m.mouthSmile.visible = !open && (e === 'happy' || e === 'neutral');
    m.mouthFlat.visible = !open && !m.mouthSmile.visible;
    m.mouthOpen.scale.set(1, e === 'surprised' ? 1.3 : 0.8, 0.4);
    // pupils drift toward aim
    const px = clamp(-i.aimYaw * 0.03, -0.02, 0.02) + (this.fidget === 'look' ? Math.sin(this.fidgetT * 2.2) * 0.02 : 0);
    m.pupilL.position.x = m.pupilR.position.x = px;
    m.pupilL.position.y = m.pupilR.position.y = -0.005 + clamp(i.aimPitch * 0.03, -0.02, 0.02);

    // ---- emote bubble
    if (this.emoteT > 0) {
      this.emoteT -= dt;
      const k = Math.min(1, (this.emote.userData.age = (this.emote.userData.age ?? 0) + dt) * 6);
      const s = 0.45 * (k < 1 ? 1.25 - Math.cos(k * Math.PI) * 0.25 : 1) + Math.sin(t * 6) * 0.02;
      this.emote.scale.set(s, s, s);
      this.emote.position.y = 0.78 + Math.sin(t * 3) * 0.03;
      if (this.emoteT <= 0) {
        this.emote.visible = false;
        this.emote.userData.age = 0;
      }
    }

    // ---- weapon pose (carry ↔ aim), then arms reach it with IK
    this.poseWeapon(i, dt, t, walkW, runW, sprintW, fk, celebrate);
  }

  private poseWeapon(i: AnimInput, dt: number, t: number, walkW: number, runW: number, sprintW: number, fk: number, celebrate: number) {
    const m = this.model;
    const wr = m.weaponRoot;
    const a = this.dead ? 0 : this.aimW;
    // carry: diagonal across the body, muzzle low. aim: shouldered, pointing where the camera looks.
    const bounce = Math.sin(this.phase * 2) * 0.02 * walkW;
    const carry = { x: 0.04, y: 0.1 + bounce, z: 0.32, rx: 0.55 + runW * 0.2 + sprintW * 0.4, ry: -0.5, rz: 0.35 };
    const aim = { x: 0.07, y: 0.26, z: 0.34, rx: -i.aimPitch - (this.model.spine.rotation.x) * 0.6, ry: -0.02, rz: 0 };
    let x = lerp(carry.x, aim.x, a);
    let y = lerp(carry.y, aim.y, a);
    let z = lerp(carry.z, aim.z, a);
    let rx = lerp(carry.rx, aim.rx, a);
    let ry = lerp(carry.ry, aim.ry, a);
    let rz = lerp(carry.rz, aim.rz, a);
    // recoil kicks the weapon back and up
    z -= this.recoil * 0.06;
    rx -= this.recoil * 0.18;
    // reload: tilt the weapon, the left hand pops the energy chamber
    let reloadK = 0;
    if (this.reloadT >= 0) {
      this.reloadT += dt;
      const p = clamp(this.reloadT / this.reloadDur, 0, 1);
      reloadK = Math.sin(p * Math.PI);
      rz += reloadK * 0.9;
      rx += reloadK * 0.35;
      y += reloadK * 0.05;
      this.weapon?.setChamberOut(smoothstep(0.15, 0.35, p) * (1 - smoothstep(0.6, 0.8, p)));
      if (p >= 1) {
        this.reloadT = -1;
        this.weapon?.setChamberOut(0);
      }
    }
    // inspect fidget: bring the weapon up and turn it over
    if (this.fidget === 'inspect') {
      ry += 1.2 * fk;
      rz += Math.sin(this.fidgetT * 2.5) * 0.4 * fk;
      y += 0.12 * fk;
      x -= 0.1 * fk;
    }
    if (this.victory || celebrate > 0) {
      rx -= 1.2 * Math.max(celebrate, this.victory ? 1 : 0);
      y += 0.15 * Math.max(celebrate, this.victory ? 1 : 0);
    }
    if (this.dead) {
      rx = 1.4;
      y = -0.1;
    }
    wr.position.set(x, y, z);
    wr.rotation.set(rx, ry, rz);

    // IK: right hand on the rear grip, left hand on the fore grip (or elsewhere)
    if (!this.weapon) return;
    m.root.updateMatrixWorld(true);
    const w = this.weapon;
    w.rearGrip.getWorldPosition(_v);
    _pole.set(1.2, -0.8, -0.8);
    m.chest.localToWorld(_pole);
    solveTwoBone(m.armR, _v, _pole);

    let leftTarget: THREE.Vector3 = w.foreGrip.getWorldPosition(_v2);
    let wantW = 1;
    if (reloadK > 0.05) {
      const c = w.chamber.getWorldPosition(new THREE.Vector3());
      leftTarget = leftTarget.lerp(c, smoothstep(0.1, 0.6, reloadK));
    }
    if (this.fidget === 'scratch' && fk > 0.05) {
      const ear = m.earL.localToWorld(new THREE.Vector3(0, 0.08, 0));
      ear.x += Math.sin(this.fidgetT * 18) * 0.03 * fk;
      leftTarget = leftTarget.lerp(ear, smoothstep(0, 0.4, fk));
      wantW = 0;
    }
    if (celebrate > 0.05 || this.victory) {
      const up = m.chest.localToWorld(new THREE.Vector3(-0.35, 0.95 + Math.sin(t * 12) * 0.08, 0.15));
      leftTarget = leftTarget.lerp(up, Math.max(celebrate, this.victory ? 1 : 0));
    }
    if (this.dead) leftTarget = m.chest.localToWorld(new THREE.Vector3(-0.6, 0.3, 0.2));
    this.leftHandW = damp(this.leftHandW, wantW, 10, dt);
    _pole.set(-1.2, -0.8, -0.8);
    m.chest.localToWorld(_pole);
    solveTwoBone(m.armL, leftTarget, _pole);
  }
}
