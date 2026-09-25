import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Damageable, DamageInfo, HitShape } from '../combat/types';
import type { Combat } from '../combat/Combat';
import type { VFXManager } from '../effects/VFXManager';
import type { CollisionWorld, Box, Cyl } from '../physics/Collision';
import type { EnemyType } from '../enemies/EnemyDefs';
import { outline, toon } from '../render/Toon';
import { clamp, damp, rand } from '../utils/MathUtils';

export interface ArenaTile {
  box: Box;
  mesh: THREE.Object3D;
  falling: number;
  gone: boolean;
}

export interface BossContext {
  world: CollisionWorld;
  combat: Combat;
  vfx: VFXManager;
  playerPos: THREE.Vector3;
  playerGrounded: boolean;
  damagePlayer(amount: number, from: THREE.Vector3, knock: number): void;
  spawnMinion(type: EnemyType, x: number, z: number): void;
  sfx(name: 'roar' | 'clank' | 'hit' | 'slam' | 'missile' | 'laser' | 'phase' | 'collapse' | 'explode' | 'core', pos: THREE.Vector3): void;
  shake(a: number): void;
  slowMo(dur: number, scale: number): void;
  setBar(visible: boolean, frac: number, label: string): void;
  announce(title: string, sub: string): void;
  music(intensity: number): void;
  cinematic(pos: THREE.Vector3 | null, look?: THREE.Vector3, fov?: number): void;
  coins(pos: THREE.Vector3, n: number): void;
  onDefeated(): void;
}

type Phase = 'sleep' | 'intro' | 'p1' | 'p2' | 'p3' | 'p4' | 'final' | 'shift' | 'dying' | 'dead';

const PHASE_INFO: Record<string, { title: string; sub: string }> = {
  p1: { title: 'THE GIANT BACON MACHINE', sub: 'Dodge the bacon missiles — blast its hull!' },
  p2: { title: 'PHASE 2', sub: 'Smash off its armor plates!' },
  p3: { title: 'PHASE 3', sub: 'Shoot the glowing weak points — jump the shockwaves!' },
  p4: { title: 'PHASE 4', sub: 'The arena is collapsing! Keep moving!' },
  final: { title: 'FINISH IT!', sub: 'The core is exposed!' },
};

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const WHITE = new THREE.Color(0xffffff);

/**
 * THE GIANT BACON MACHINE — a towering robo-pig. Multi-phase fight with
 * projectile volleys, destructible armour, exposed weak points, a collapsing
 * arena with a sweeping laser, and a slow-motion destruction finale.
 */
export class BaconBoss implements Damageable {
  readonly kind = 'boss' as const;
  alive = true;
  assist = true;
  phase: Phase = 'sleep';
  readonly group = new THREE.Group();
  readonly position: THREE.Vector3;
  shapes: HitShape[] = [];
  hp = 700;
  private maxHp = 700;
  private phaseT = 0;
  private nextPhase: Phase = 'p1';
  private yaw = 0;
  private mats: THREE.MeshToonMaterial[] = [];
  private flash = 0;
  private t = 0;
  private cd = { missile: 2, toast: 4, slam: 3, stomp: 4, minion: 6, laser: 3, tile: 3 };
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private muzzle = new THREE.Object3D();
  private spatula = new THREE.Object3D();
  private plates: { obj: THREE.Mesh; hp: number; shape: HitShape }[] = [];
  private cores: { obj: THREE.Mesh; hp: number; shape: HitShape }[] = [];
  private bigCore!: THREE.Mesh;
  private visor!: THREE.Mesh;
  private laser!: THREE.Mesh;
  private laserAngle = 0;
  private laserOn = 0;
  private laserHitCd = 0;
  private slamT = -1;
  private stompT = -1;
  private collider: Cyl;
  private hullShapes: HitShape[] = [];
  private debris: { obj: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3 }[] = [];
  private dyingT = 0;
  private boomT = 0;
  tiles: ArenaTile[] = [];

  constructor(readonly center: THREE.Vector3, world: CollisionWorld, private scene: THREE.Scene) {
    this.position = this.group.position;
    this.group.position.copy(center);
    this.build();
    scene.add(this.group);
    this.collider = world.addCyl(center.x, center.z, 4.2, center.y, center.y + 9, { owner: this });
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name !== 'outline') o.castShadow = true;
    });
  }

  private mat(color: number, emissive = 0) {
    const m = toon(color, { unique: true, emissive, emissiveIntensity: emissive ? 0.6 : 1 });
    this.mats.push(m);
    return m;
  }

  private build() {
    const g = this.group;
    const metal = this.mat(0x5a6078);
    const bronze = this.mat(0xc8543a);
    const gold = this.mat(0xffc03a);
    const dark = this.mat(0x2a2a3a);
    const rb = (w: number, h: number, d: number, r: number, m: THREE.Material, ink = 0.06) => {
      const x = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);
      outline(x, ink);
      return x;
    };
    // feet & legs
    for (const s of [-1, 1]) {
      const foot = rb(2.6, 1.3, 3.6, 0.4, dark);
      foot.position.set(s * 2.4, 0.65, 0.3);
      g.add(foot);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 3, 12), metal);
      outline(leg, 0.05);
      leg.position.set(s * 2.4, 2.6, 0);
      g.add(leg);
    }
    // torso
    this.torso.position.y = 6;
    g.add(this.torso);
    const body = rb(7.2, 5, 4.6, 0.9, bronze, 0.08);
    this.torso.add(body);
    for (let i = 0; i < 10; i++) {
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), gold);
      rivet.position.set(-3 + (i % 5) * 1.5, i < 5 ? 2.2 : -2.2, 2.32);
      this.torso.add(rivet);
    }
    // frying-pan belly with sizzling bacon
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.4, 28).rotateX(Math.PI / 2), dark);
    outline(pan, 0.05);
    pan.position.set(0, -0.3, 2.4);
    this.torso.add(pan);
    for (let k = 0; k < 3; k++) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 12; i++) pts.push(new THREE.Vector3(-1.3 + i * 0.22, -0.8 + k * 0.7 + Math.sin(i * 1.3) * 0.12, 2.65));
      const curve = new THREE.CatmullRomCurve3(pts);
      this.torso.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.14, 6), toon(0xd8433a)));
      const fat = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.07, 6), toon(0xffe0c8));
      fat.position.y = 0.16;
      this.torso.add(fat);
    }
    // big final core (hidden behind the pan until the end)
    this.bigCore = new THREE.Mesh(new THREE.SphereGeometry(1.4, 20, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a2a).multiplyScalar(2.2) }));
    this.bigCore.position.set(0, -0.3, 2.2);
    this.bigCore.visible = false;
    this.torso.add(this.bigCore);
    // chimneys
    for (const s of [-1, 1]) {
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 3, 12), metal);
      outline(ch, 0.05);
      ch.position.set(s * 2.2, 3, -1.6);
      this.torso.add(ch);
    }
    // head: an evil robo-pig
    this.head.position.set(0, 3.8, 0.3);
    this.torso.add(this.head);
    const skull = rb(3.4, 2.4, 2.8, 0.7, gold, 0.07);
    this.head.add(skull);
    this.visor = new THREE.Mesh(new RoundedBoxGeometry(2.8, 0.55, 0.3, 2, 0.15), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3030).multiplyScalar(2) }));
    this.visor.position.set(0, 0.35, 1.38);
    this.head.add(this.visor);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.6, 20).rotateX(Math.PI / 2), this.mat(0xff9ab0));
    outline(snout, 0.05);
    snout.position.set(0, -0.55, 1.5);
    this.head.add(snout);
    for (const s of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(0x3a1020));
      nostril.scale.set(0.7, 1.2, 0.4);
      nostril.position.set(s * 0.28, -0.55, 1.8);
      this.head.add(nostril);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 4).scale(1, 1, 0.4), gold);
      outline(ear, 0.05);
      ear.position.set(s * 1.4, 1.5, 0);
      ear.rotation.z = -s * 0.5;
      this.head.add(ear);
    }
    // left arm: bacon missile cannon; right arm: giant spatula
    this.armL.position.set(-4.3, 1.2, 0);
    this.armR.position.set(4.3, 1.2, 0);
    this.torso.add(this.armL, this.armR);
    for (const arm of [this.armL, this.armR]) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), metal);
      outline(shoulder, 0.05);
      arm.add(shoulder);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 3, 12), metal);
      outline(upper, 0.05);
      upper.position.y = -1.8;
      arm.add(upper);
    }
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 3.4, 16).rotateX(Math.PI / 2), bronze);
    outline(cannon, 0.06);
    cannon.position.set(0, -3.4, 1.2);
    this.armL.add(cannon);
    const bore = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa040).multiplyScalar(2) }));
    bore.position.set(0, -3.4, 2.92);
    this.armL.add(bore);
    this.muzzle.position.set(0, -3.4, 3.2);
    this.armL.add(this.muzzle);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 8), dark);
    handle.position.set(0, -4.2, 0);
    this.armR.add(handle);
    const blade = rb(3.4, 0.35, 3.8, 0.2, this.mat(0xc8ced8), 0.06);
    blade.position.set(0, -6, 0.6);
    this.armR.add(blade);
    this.spatula.position.set(0, -6, 0.6);
    this.armR.add(this.spatula);
    // armour plates (phase 2)
    const plateDefs: [number, number, number, number, number, number, THREE.Object3D][] = [
      [0, 0.6, 2.45, 5.2, 2.4, 0.5, this.torso],
      [-4.3, 1.9, 0, 2.6, 0.7, 2.6, this.torso],
      [4.3, 1.9, 0, 2.6, 0.7, 2.6, this.torso],
      [0, 1.4, 0.3, 3.8, 0.7, 3.2, this.head],
    ];
    for (const [x, y, z, w, h, d, parent] of plateDefs) {
      const p = rb(w, h, d, 0.2, this.mat(0x8a93a8), 0.06);
      p.position.set(x, y, z);
      p.visible = false;
      parent.add(p);
      this.plates.push({ obj: p, hp: 160, shape: { type: 'sphere', c: new THREE.Vector3(), r: Math.max(w, d) * 0.5, id: this.plates.length } });
    }
    // weak point cores (phase 3)
    const coreDefs: [number, number, number, THREE.Object3D][] = [
      [0, 1.4, 2.5, this.torso],
      [-2.4, 2.3, -2.3, this.torso],
      [2.4, 2.3, -2.3, this.torso],
    ];
    for (const [x, y, z, parent] of coreDefs) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6affff).multiplyScalar(2.2) }));
      c.position.set(x, y, z);
      c.visible = false;
      parent.add(c);
      this.cores.push({ obj: c, hp: 180, shape: { type: 'sphere', c: new THREE.Vector3(), r: 1.05, weak: true, id: 100 + this.cores.length } });
    }
    // laser beam
    this.laser = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 8, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3030).multiplyScalar(2.5), transparent: true, opacity: 0.85 }));
    this.laser.visible = false;
    this.scene.add(this.laser);
    this.hullShapes = [
      { type: 'sphere', c: new THREE.Vector3(), r: 3.6 },
      { type: 'sphere', c: new THREE.Vector3(), r: 1.9 },
    ];
    this.shapes = [];
  }

  get active() {
    return this.phase !== 'sleep' && this.phase !== 'dead';
  }
  get defeated() {
    return this.phase === 'dead';
  }

  wake(ctx: BossContext) {
    if (this.phase !== 'sleep') return;
    this.phase = 'intro';
    this.phaseT = 0;
    ctx.sfx('roar', this.center);
    ctx.music(0.6);
  }

  private enter(p: Phase, ctx: BossContext) {
    this.phase = p;
    this.phaseT = 0;
    const info = PHASE_INFO[p];
    if (info) ctx.announce(info.title, info.sub);
    if (p === 'p1') {
      this.hp = this.maxHp = 700;
      this.shapes = [...this.hullShapes];
    } else if (p === 'p2') {
      for (const pl of this.plates) {
        pl.obj.visible = true;
        pl.hp = 160;
      }
      this.shapes = [...this.hullShapes, ...this.plates.map((p2) => p2.shape)];
      ctx.sfx('clank', this.center);
    } else if (p === 'p3') {
      for (const c of this.cores) {
        c.obj.visible = true;
        c.hp = 180;
      }
      this.shapes = [...this.hullShapes, ...this.cores.map((c) => c.shape)];
    } else if (p === 'p4') {
      this.hp = this.maxHp = 600;
      this.shapes = [...this.hullShapes];
      this.cd.tile = 2;
    } else if (p === 'final') {
      this.hp = this.maxHp = 260;
      this.bigCore.visible = true;
      this.shapes = [{ type: 'sphere', c: new THREE.Vector3(), r: 1.9, weak: true, id: 999 }];
      this.laser.visible = false;
    }
    ctx.music(p === 'p1' ? 0.75 : p === 'final' ? 1 : 0.9);
  }

  private shift(next: Phase, ctx: BossContext) {
    this.phase = 'shift';
    this.nextPhase = next;
    this.phaseT = 0;
    this.shapes = [];
    this.laser.visible = false;
    ctx.sfx('phase', this.center);
    ctx.shake(0.8);
    ctx.vfx.explosion(_v.copy(this.center).setY(this.center.y + 6), 4, 0xff7a2a);
  }

  takeDamage(info: DamageInfo) {
    if (!this.alive) return;
    const id = info.shape?.id;
    if (this.phase === 'p2') {
      const pl = this.plates.find((p) => p.shape.id === id);
      if (pl && pl.obj.visible) {
        pl.hp -= info.amount;
        this.flash = 0.5;
        if (pl.hp <= 0) this.breakPlate(pl);
      } else this.flash = 0.2; // clank off the hull
      return;
    }
    if (this.phase === 'p3') {
      const c = this.cores.find((k) => k.shape.id === id);
      if (c && c.obj.visible) {
        c.hp -= info.amount;
        this.flash = 0.8;
        if (c.hp <= 0) {
          c.obj.visible = false;
          this.shapes = this.shapes.filter((s) => s !== c.shape);
          this.pendingBooms.push(c.obj.getWorldPosition(new THREE.Vector3()));
        }
      } else this.flash = 0.2;
      return;
    }
    if (this.phase === 'p1' || this.phase === 'p4' || this.phase === 'final') {
      this.hp -= info.amount * (info.weak ? 1.5 : 1);
      this.flash = 1;
    }
  }
  /** Explosions requested by damage (processed in update). */
  pendingBooms: THREE.Vector3[] = [];
  private brokenPlates: THREE.Mesh[] = [];

  private breakPlate(pl: { obj: THREE.Mesh; hp: number; shape: HitShape }) {
    pl.obj.visible = false;
    this.shapes = this.shapes.filter((s) => s !== pl.shape);
    this.brokenPlates.push(pl.obj);
  }

  /** Remaining health as a fraction of the current phase. */
  get barFraction() {
    if (this.phase === 'p2') return this.plates.reduce((s, p) => s + (p.obj.visible ? Math.max(0, p.hp) : 0), 0) / (160 * this.plates.length);
    if (this.phase === 'p3') return this.cores.reduce((s, c) => s + (c.obj.visible ? Math.max(0, c.hp) : 0), 0) / (180 * this.cores.length);
    return Math.max(0, this.hp) / this.maxHp;
  }

  update(dt: number, ctx: BossContext) {
    this.t += dt;
    this.phaseT += dt;
    this.flash = Math.max(0, this.flash - dt * 5);
    for (const m of this.mats) {
      m.emissive.copy(WHITE);
      m.emissiveIntensity = this.flash * 0.7;
    }
    // idle life: breathing torso, bobbing head, chimney smoke, sizzle
    const breathe = Math.sin(this.t * 1.5) * 0.12;
    this.torso.position.y = 6 + breathe - (this.phase === 'final' ? 1.5 : 0);
    this.head.rotation.x = Math.sin(this.t * 0.9) * 0.05;
    (this.visor.material as THREE.MeshBasicMaterial).color.setRGB(2, 0.3, 0.3).multiplyScalar(this.phase === 'sleep' ? 0.15 : 0.8 + Math.sin(this.t * 6) * 0.3);
    if (this.phase !== 'sleep' && this.phase !== 'dead' && Math.random() < dt * 6) {
      for (const s of [-1, 1]) {
        _v.set(s * 2.2, 4.7, -1.6).applyMatrix4(this.torso.matrixWorld);
        ctx.vfx.puffs.emit(_v.x, _v.y, _v.z, rand(-0.5, 0.5), 2.5, rand(-0.5, 0.5), 0.6, 1.4, 0x5a5060, 1.8, 0.6);
      }
    }
    for (const c of this.cores) if (c.obj.visible) c.obj.scale.setScalar(1 + Math.sin(this.t * 8) * 0.1);
    if (this.bigCore.visible) this.bigCore.scale.setScalar(1 + Math.sin(this.t * 10) * 0.12);

    // face the player (slowly)
    if (this.phase !== 'sleep' && this.phase !== 'dying' && this.phase !== 'dead') {
      const want = Math.atan2(ctx.playerPos.x - this.center.x, ctx.playerPos.z - this.center.z);
      let d = want - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * (this.phase === 'final' ? 0.3 : 1.2));
      this.group.rotation.y = this.yaw;
    }
    this.group.updateMatrixWorld(true);

    // hit shapes follow the model
    this.torso.getWorldPosition(this.hullShapes[0].c);
    this.head.getWorldPosition(this.hullShapes[1].c);
    for (const p of this.plates) p.obj.getWorldPosition(p.shape.c);
    for (const c of this.cores) c.obj.getWorldPosition(c.shape.c);
    if (this.phase === 'final') this.bigCore.getWorldPosition(this.shapes[0].c);

    // debris from broken plates / destroyed cores
    while (this.brokenPlates.length) {
      const p = this.brokenPlates.pop()!;
      p.getWorldPosition(_v);
      ctx.vfx.explosion(_v, 2.2, 0xffc060);
      ctx.sfx('clank', _v);
      ctx.shake(0.4);
      const clone = p.clone();
      clone.visible = true;
      clone.position.copy(_v);
      this.scene.add(clone);
      this.debris.push({ obj: clone, vel: new THREE.Vector3(rand(-6, 6), 10, rand(-6, 6)), spin: new THREE.Vector3(rand(-4, 4), rand(-4, 4), rand(-4, 4)) });
      ctx.coins(_v, 6);
    }
    while (this.pendingBooms.length) {
      const p = this.pendingBooms.pop()!;
      ctx.vfx.explosion(p, 2.5, 0x6affff);
      ctx.sfx('core', p);
      ctx.shake(0.5);
      ctx.coins(p, 5);
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.vel.y -= 25 * dt;
      d.obj.position.addScaledVector(d.vel, dt);
      d.obj.rotation.x += d.spin.x * dt;
      d.obj.rotation.y += d.spin.y * dt;
      if (d.obj.position.y < this.center.y - 30) {
        this.scene.remove(d.obj);
        this.debris.splice(i, 1);
      } else if (d.obj.position.y < this.center.y + 0.4 && d.vel.y < 0 && this.phase !== 'dying') {
        d.vel.y = -d.vel.y * 0.3;
        d.vel.x *= 0.6;
        d.vel.z *= 0.6;
      }
    }

    switch (this.phase) {
      case 'sleep':
        return;
      case 'intro': {
        const eye = _v.set(this.center.x + Math.sin(this.yaw) * 16 + 6, this.center.y + 3, this.center.z + Math.cos(this.yaw) * 16);
        ctx.cinematic(eye.clone(), _v2.set(this.center.x, this.center.y + 7, this.center.z).clone(), 50);
        this.armL.rotation.x = -Math.sin(Math.min(1, this.phaseT / 2) * Math.PI) * 0.8;
        if (this.phaseT > 1.2 && this.phaseT - dt <= 1.2) {
          ctx.sfx('roar', this.center);
          ctx.shake(0.7);
        }
        if (this.phaseT > 3.5) {
          ctx.cinematic(null);
          this.enter('p1', ctx);
        }
        break;
      }
      case 'shift':
        this.torso.rotation.z = Math.sin(this.phaseT * 20) * 0.05 * (1 - this.phaseT / 2.5);
        if (this.phaseT > 2.5) {
          this.torso.rotation.z = 0;
          this.enter(this.nextPhase, ctx);
        }
        break;
      case 'p1':
        this.attacks(dt, ctx, { missile: 3.0, toast: 5 });
        if (this.hp <= 0) this.shift('p2', ctx);
        break;
      case 'p2':
        this.attacks(dt, ctx, { missile: 4.5, slam: 4 });
        if (this.plates.every((p) => !p.obj.visible)) this.shift('p3', ctx);
        break;
      case 'p3':
        this.attacks(dt, ctx, { missile: 5, stomp: 5, minion: 9 });
        if (this.cores.every((c) => !c.obj.visible)) this.shift('p4', ctx);
        break;
      case 'p4':
        this.attacks(dt, ctx, { missile: 4, laser: 7 });
        this.collapse(dt, ctx);
        if (this.hp <= 0) this.shift('final', ctx);
        break;
      case 'final':
        this.torso.rotation.z = Math.sin(this.t * 3) * 0.06;
        if (this.hp <= 0) this.beginDeath(ctx);
        break;
      case 'dying':
        this.updateDeath(dt, ctx);
        break;
    }
    this.updateArms(dt);
    this.updateLaser(dt, ctx);
    this.updateTiles(dt, ctx);
    if (this.phase !== 'dying' && this.phase !== 'dead' && this.phase !== 'intro') ctx.setBar(true, this.barFraction, this.phase === 'shift' ? 'GIANT BACON MACHINE' : `GIANT BACON MACHINE — ${this.phase === 'final' ? 'CORE' : 'PHASE ' + this.phase.slice(1)}`);
  }

  private attacks(dt: number, ctx: BossContext, rates: Partial<Record<keyof BaconBoss['cd'], number>>) {
    for (const k of Object.keys(rates) as (keyof BaconBoss['cd'])[]) {
      this.cd[k] -= dt;
      if (this.cd[k] > 0) continue;
      this.cd[k] = rates[k]! * rand(0.85, 1.15);
      if (k === 'missile') this.fireMissiles(ctx);
      else if (k === 'toast') this.fireToast(ctx);
      else if (k === 'slam') this.slamT = 0;
      else if (k === 'stomp') this.stompT = 0;
      else if (k === 'minion') {
        for (let i = 0; i < 2; i++) ctx.spawnMinion(Math.random() < 0.5 ? 'carrot' : 'chicken', this.center.x + rand(-10, 10), this.center.z + rand(6, 12));
      } else if (k === 'laser') {
        this.laserOn = 4.5;
        this.laserAngle = this.yaw - 1.4;
        ctx.sfx('laser', this.center);
      }
    }
  }

  private fireMissiles(ctx: BossContext) {
    this.muzzle.getWorldPosition(_v);
    const n = this.phase === 'p1' ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const target = new THREE.Vector3(ctx.playerPos.x + rand(-4, 4), ctx.playerPos.y, ctx.playerPos.z + rand(-4, 4));
      setTimeout(() => ctx.combat.enemyShoot('bacon', _v.clone(), target, 15 + i * 1.5, 12), i * 160);
    }
    ctx.sfx('missile', _v);
    ctx.vfx.muzzle(_v, new THREE.Vector3(Math.sin(this.yaw), 0.3, Math.cos(this.yaw)), 0xffa040, 3);
  }

  private fireToast(ctx: BossContext) {
    this.head.getWorldPosition(_v);
    for (let i = -2; i <= 2; i++) {
      const a = this.yaw + i * 0.25;
      const target = new THREE.Vector3(this.center.x + Math.sin(a) * 20, ctx.playerPos.y, this.center.z + Math.cos(a) * 20);
      ctx.combat.enemyShoot('toast', _v.clone(), target, 16, 8);
    }
  }

  private updateArms(dt: number) {
    // spatula slam: raise, then smash in front
    if (this.slamT >= 0) {
      this.slamT += dt;
      const t = this.slamT;
      this.armR.rotation.x = t < 0.9 ? -Math.sin((t / 0.9) * Math.PI * 0.5) * 2.4 : t < 1.1 ? -2.4 + ((t - 0.9) / 0.2) * 2.8 : damp(this.armR.rotation.x, 0, 3, dt);
      if (t >= 1.1 && t - dt < 1.1) this.pendingSlam = true;
      if (t > 2.2) this.slamT = -1;
    } else this.armR.rotation.x = damp(this.armR.rotation.x, Math.sin(this.t * 1.2) * 0.1, 3, dt);
    this.armL.rotation.x = damp(this.armL.rotation.x, -0.9 + Math.sin(this.t * 1.1) * 0.1, 3, dt);
    // stomp: crouch then pound
    if (this.stompT >= 0) {
      this.stompT += dt;
      this.group.position.y = this.center.y + (this.stompT < 0.7 ? Math.sin((this.stompT / 0.7) * Math.PI) * 1.8 : 0);
      if (this.stompT >= 0.7 && this.stompT - dt < 0.7) this.pendingStomp = true;
      if (this.stompT > 1.2) {
        this.stompT = -1;
        this.group.position.y = this.center.y;
      }
    }
  }
  private pendingSlam = false;
  private pendingStomp = false;

  private updateLaser(dt: number, ctx: BossContext) {
    if (this.pendingSlam) {
      this.pendingSlam = false;
      this.spatula.getWorldPosition(_v);
      _v.y = this.center.y;
      ctx.combat.shockwave(_v.clone(), 12, 14);
      ctx.vfx.explosion(_v, 2.5, 0xd8c8a8);
      ctx.sfx('slam', _v);
      ctx.shake(0.8);
      if (Math.hypot(ctx.playerPos.x - _v.x, ctx.playerPos.z - _v.z) < 3.5) ctx.damagePlayer(25, _v, 14);
    }
    if (this.pendingStomp) {
      this.pendingStomp = false;
      ctx.combat.shockwave(this.center.clone(), 24, 12);
      ctx.sfx('slam', this.center);
      ctx.shake(1);
    }
    this.laserHitCd -= dt;
    if (this.laserOn > 0) {
      this.laserOn -= dt;
      this.laserAngle += dt * 0.65;
      this.visor.getWorldPosition(_v);
      const len = 34;
      const dir = new THREE.Vector3(Math.sin(this.laserAngle), 0, Math.cos(this.laserAngle));
      const end = new THREE.Vector3(this.center.x, this.center.y + 1.1, this.center.z).addScaledVector(dir, len);
      const start = _v.clone();
      this.laser.visible = true;
      this.laser.position.copy(start);
      this.laser.lookAt(end);
      this.laser.scale.set(1 + Math.sin(this.t * 40) * 0.2, 1 + Math.sin(this.t * 40) * 0.2, start.distanceTo(end));
      ctx.vfx.sparks(end, 0xff5030, 3, 5, 0.12, 0.3);
      // does the sweep line pass through the player (low enough to hit)?
      const toP = new THREE.Vector3(ctx.playerPos.x - this.center.x, 0, ctx.playerPos.z - this.center.z);
      const along = toP.dot(dir);
      const perp = toP.clone().addScaledVector(dir, -along).length();
      if (this.laserHitCd <= 0 && along > 0 && along < len && perp < 0.9 && ctx.playerPos.y < this.center.y + 1.3) {
        this.laserHitCd = 0.8;
        ctx.damagePlayer(18, ctx.playerPos.clone().addScaledVector(dir, -1), 6);
      }
      if (this.laserOn <= 0) this.laser.visible = false;
    }
  }

  private collapse(dt: number, ctx: BossContext) {
    this.cd.tile -= dt;
    if (this.cd.tile > 0) return;
    this.cd.tile = 3;
    const standing = this.tiles.filter((t) => !t.gone && t.falling < 0);
    if (standing.length <= 4) return;
    // pick a tile away from the player's current tile (fair), prefer the outer ring
    standing.sort((a, b) => {
      const da = Math.hypot((a.box.min.x + a.box.max.x) / 2 - ctx.playerPos.x, (a.box.min.z + a.box.max.z) / 2 - ctx.playerPos.z);
      const db = Math.hypot((b.box.min.x + b.box.max.x) / 2 - ctx.playerPos.x, (b.box.min.z + b.box.max.z) / 2 - ctx.playerPos.z);
      return db - da;
    });
    const pick = standing[Math.floor(Math.random() * Math.min(3, standing.length))];
    pick.falling = 0;
    ctx.sfx('collapse', pick.mesh.position);
  }

  private updateTiles(dt: number, ctx: BossContext) {
    for (const tile of this.tiles) {
      if (tile.falling < 0 || tile.gone) continue;
      tile.falling += dt;
      if (tile.falling < 1.4) {
        // telegraph: shake
        tile.mesh.position.x += Math.sin(tile.falling * 60) * 0.02;
        if (Math.random() < dt * 10) ctx.vfx.puffs.emit(tile.mesh.position.x + rand(-2, 2), tile.mesh.position.y + 0.6, tile.mesh.position.z + rand(-2, 2), 0, 1, 0, 0.3, 0.6, 0xd8c8a8);
      } else {
        tile.box.enabled = false;
        tile.mesh.position.y -= dt * (tile.falling - 1.4) * 25;
        tile.mesh.rotation.x += dt * 0.6;
        if (tile.mesh.position.y < this.center.y - 25) {
          tile.gone = true;
          tile.mesh.visible = false;
        }
      }
    }
  }

  private beginDeath(ctx: BossContext) {
    this.phase = 'dying';
    this.dyingT = 0;
    this.boomT = 0;
    this.shapes = [];
    this.alive = false;
    ctx.setBar(false, 0, '');
    ctx.slowMo(3.2, 0.35);
    ctx.sfx('phase', this.center);
    ctx.music(0);
  }

  private updateDeath(dt: number, ctx: BossContext) {
    this.dyingT += dt;
    this.boomT -= dt;
    const cam = new THREE.Vector3(this.center.x + Math.sin(this.dyingT * 0.35 + 0.8) * 24, this.center.y + 6, this.center.z + Math.cos(this.dyingT * 0.35 + 0.8) * 24);
    ctx.cinematic(cam, new THREE.Vector3(this.center.x, this.center.y + 5, this.center.z), 55);
    this.torso.rotation.z = Math.sin(this.dyingT * 25) * 0.08;
    if (this.boomT <= 0 && this.dyingT < 3.4) {
      this.boomT = 0.22;
      _v.set(rand(-3.5, 3.5), rand(3, 10), rand(-2.5, 2.5)).applyMatrix4(this.group.matrixWorld);
      ctx.vfx.explosion(_v, rand(1.5, 3), Math.random() < 0.5 ? 0xff9a2a : 0xffd24a);
      ctx.sfx('explode', _v);
      ctx.shake(0.5);
    }
    // parts break off one by one
    const detach = (obj: THREE.Object3D, at: number) => {
      if (this.dyingT >= at && this.dyingT - dt < at && obj.parent) {
        obj.getWorldPosition(_v);
        const q = obj.getWorldQuaternion(new THREE.Quaternion());
        this.scene.attach(obj);
        obj.position.copy(_v);
        obj.quaternion.copy(q);
        this.debris.push({ obj, vel: new THREE.Vector3(rand(-8, 8), rand(8, 14), rand(-8, 8)), spin: new THREE.Vector3(rand(-3, 3), rand(-3, 3), rand(-3, 3)) });
        ctx.vfx.explosion(_v, 3, 0xffa040);
        ctx.sfx('explode', _v);
      }
    };
    detach(this.armR, 0.8);
    detach(this.armL, 1.6);
    detach(this.head, 2.4);
    if (this.dyingT > 3.6 && this.phase === 'dying') {
      this.phase = 'dead';
      this.group.getWorldPosition(_v);
      _v.y += 5;
      ctx.vfx.explosion(_v, 6, 0xffd24a);
      ctx.vfx.explosion(_v.clone().setY(_v.y - 3), 5, 0xff7a2a);
      ctx.sfx('explode', _v);
      ctx.shake(1);
      ctx.coins(_v, 40);
      this.group.visible = false;
      this.collider.enabled = false;
      ctx.cinematic(null);
      setTimeout(() => ctx.onDefeated(), 1400);
    }
    void clamp;
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.remove(this.laser);
    for (const d of this.debris) this.scene.remove(d.obj);
  }
}
