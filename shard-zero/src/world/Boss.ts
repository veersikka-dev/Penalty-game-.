import * as THREE from 'three';
import type { TargetManager } from '../targets/TargetManager';
import type { Target } from '../targets/Target';
import type { VFXManager } from '../effects/VFXManager';
import type { AudioManager } from '../audio/AudioManager';
import type { MusicManager } from '../audio/MusicManager';
import type { ScreenEffects } from '../effects/ScreenEffects';
import type { CameraController } from '../player/CameraController';
import type { DestructionSystem } from '../destruction/DestructionSystem';
import type { Environment } from './Environment';
import { createEnergyMaterial } from '../materials/GlassMaterial';
import { glowTexture } from '../utils/textures';
import { rand } from '../utils/MathUtils';

export interface BossContext {
  scene: THREE.Scene;
  targets: TargetManager;
  vfx: VFXManager;
  audio: AudioManager;
  music: MusicManager;
  screen: ScreenEffects;
  cam: CameraController;
  destruction: DestructionSystem;
  env: Environment;
  playerPos: () => THREE.Vector3;
  setBossBar: (visible: boolean, fraction: number, label: string) => void;
  hint: (text: string, sub?: string, dur?: number) => void;
  slowMo: (dur: number, scale: number) => void;
  onDefeated: () => void;
}

type Phase = 'idle' | 'intro' | 'p1' | 'p2' | 'p3' | 'shift' | 'dying' | 'dead';

/**
 * THE HEART — final encounter. A colossal energy core ringed by weak points and
 * orbiting shields. Three phases escalate orb barrages, shield speed and hazards.
 */
export class Boss {
  phase: Phase = 'idle';
  private group: THREE.Group | null = null;
  private core!: THREE.Mesh;
  private coreMat!: THREE.ShaderMaterial;
  private shell!: THREE.Mesh;
  private shellMat!: THREE.MeshBasicMaterial;
  private rings: THREE.Mesh[] = [];
  private arenaMat!: THREE.ShaderMaterial;
  private coreGlow!: THREE.Sprite;
  readonly center = new THREE.Vector3();
  private time = 0;
  private phaseT = 0;
  private orbT = 0;
  private crystalT = 0;
  private plateT = 0;
  private novaT = 0;
  private nextPhase: Phase = 'p1';
  private weak: Target[] = [];
  private plates: Target[] = [];
  private coreTarget: Target | null = null;
  private weakTotal = 1;
  private dyingT = 0;
  private boomT = 0;

  constructor(private ctx: BossContext) {}

  get active() {
    return this.phase !== 'idle' && this.phase !== 'dead';
  }

  private build() {
    const g = new THREE.Group();
    this.arenaMat = createEnergyMaterial(0x5a1040, 0x8a4a14, { side: THREE.BackSide, intensity: 0.7, scale: 0.35 });
    const arena = new THREE.Mesh(new THREE.SphereGeometry(75, 48, 24), this.arenaMat);
    g.add(arena);
    this.coreMat = createEnergyMaterial(0xffb040, 0xff2a8a, { intensity: 1.6, scale: 1.4 });
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(4.4, 4), this.coreMat);
    g.add(this.core);
    this.shellMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc060).multiplyScalar(2.2), wireframe: true, transparent: true, opacity: 0.7 });
    this.shell = new THREE.Mesh(new THREE.IcosahedronGeometry(6.2, 1), this.shellMat);
    g.add(this.shell);
    const ringCols = [0xffc050, 0xff3ca0, 0xffffff];
    [9.5, 12, 15].forEach((r, i) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 8, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(ringCols[i]).multiplyScalar(2.4) }));
      m.rotation.x = Math.PI / 2 + i * 0.4;
      this.rings.push(m);
      g.add(m);
    });
    this.coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffa060, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.coreGlow.scale.setScalar(26);
    g.add(this.coreGlow);
    this.group = g;
  }

  start(centerZ: number) {
    if (!this.group) this.build();
    const g = this.group!;
    this.center.set(0, 6, centerZ);
    g.position.copy(this.center);
    g.visible = true;
    this.core.visible = this.shell.visible = true;
    this.coreMat.uniforms.uCrack.value = 0;
    this.shellMat.opacity = 0.7;
    this.ctx.scene.add(g);
    this.phase = 'intro';
    this.phaseT = 0;
    this.time = 0;
    this.weak = [];
    this.plates = [];
    this.coreTarget = null;
    this.ctx.audio.bossRoar();
    this.ctx.music.play('boss', 0.15);
    this.ctx.music.tension(2.5);
    this.ctx.hint('THE HEART', 'Destroy the weak points', 3.5);
    this.ctx.setBossBar(true, 1, 'THE HEART');
  }

  reset() {
    if (this.group) this.ctx.scene.remove(this.group);
    this.phase = 'idle';
    this.weak = [];
    this.plates = [];
    this.coreTarget = null;
    this.ctx.env.bossLight.intensity = 0;
    this.ctx.setBossBar(false, 0, '');
    this.ctx.screen.setTint(0xffffff);
  }

  private spawn(kind: Target['kind'], x: number, y: number, z: number, extra: { hp?: number; w?: number; h?: number } = {}): Target {
    const t = this.ctx.targets.spawn({ at: 0, kind, x, y, ...extra }, z, 0xffd29a);
    t.tag = 'boss';
    return t;
  }

  private enterPhase(p: Phase) {
    const c = this.center;
    this.phase = p;
    this.phaseT = 0;
    this.orbT = 2;
    this.crystalT = 1;
    this.plateT = 0;
    this.novaT = 4;
    const T = () => this.time;
    if (p === 'p1' || p === 'p2') {
      const n = p === 'p1' ? 4 : 5;
      const hp = p === 'p1' ? 2 : 3;
      const R = p === 'p1' ? 9 : 8.2;
      const speed = p === 'p1' ? 0.35 : 0.45;
      this.weak = [];
      for (let i = 0; i < n; i++) {
        const ph = (i / n) * Math.PI * 2;
        const t = this.spawn('weakpoint', 0, 0, c.z + 3, { hp });
        t.custom = (tt) => {
          const a = ph + T() * speed;
          const bob = p === 'p2' ? Math.sin(T() * 1.1 + ph) * 1.0 : 0;
          tt.root.position.set(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R * 0.7 + bob, c.z + 3);
        };
        this.weak.push(t);
      }
      this.weakTotal = n * hp;
      this.spawnPlates(p === 'p1' ? 5 : 7, R, c.z + 7, p === 'p1' ? -0.55 : -0.9, 2.8, 2.1);
      this.ctx.music.setIntensity(p === 'p1' ? 0.55 : 0.8);
    } else if (p === 'p3') {
      this.coreTarget = this.spawn('bossCore', c.x, c.y, c.z, { hp: 15 });
      this.coreTarget.custom = (tt) => tt.root.position.copy(c);
      this.spawnPlates(9, 6.4, c.z + 3, 1.1, 2.4, 1.8);
      this.ctx.music.setIntensity(1);
      this.ctx.hint('THE CORE IS EXPOSED', 'Break the shield ring and strike the heart', 3);
    }
  }

  private spawnPlates(n: number, R: number, z: number, speed: number, w: number, h: number) {
    const c = this.center;
    this.plates = this.plates.filter((t) => t.alive);
    for (let i = 0; i < n; i++) {
      const ph = (i / n) * Math.PI * 2 + 0.3;
      const t = this.spawn('shieldPlate', 0, 0, z, { w, h });
      t.custom = (tt) => {
        const a = ph + this.time * speed;
        tt.root.position.set(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R * 0.7, z);
      };
      this.plates.push(t);
    }
  }

  private launchOrb() {
    const c = this.center;
    const t = this.spawn('bossOrb', c.x + rand(-3, 3), c.y + rand(-2, 2), c.z + 5);
    const speed = this.phase === 'p1' ? 9 : this.phase === 'p2' ? 11 : 12.5;
    const vel = new THREE.Vector3();
    t.custom = (tt, dt) => {
      const target = this.ctx.playerPos();
      const want = new THREE.Vector3().subVectors(target, tt.base).normalize().multiplyScalar(speed);
      vel.lerp(want, Math.min(1, dt * (tt.age < 0.1 ? 60 : 1.2)));
      tt.base.addScaledVector(vel, dt);
      tt.root.position.copy(tt.base);
    };
    this.ctx.audio.orbLaunch(t.base.x / 10);
    this.ctx.vfx.flare(t.base, 0xff4ab0, 3, 0.3);
  }

  private launchCrystal() {
    const c = this.center;
    const side = Math.random() < 0.5 ? -1 : 1;
    const t = this.spawn(Math.random() < 0.4 ? 'crystalLarge' : 'crystal', side * 15, rand(1, 6), c.z + rand(14, 22));
    const vx = -side * rand(3.5, 5.5);
    t.custom = (tt, dt) => {
      tt.base.x += vx * dt;
      tt.root.position.copy(tt.base);
      if (Math.abs(tt.base.x) > 17 && tt.age > 1) tt.tag = 'discard';
    };
  }

  /** Called by the game whenever a boss-tagged target is destroyed. */
  onDestroyed(t: Target) {
    if (t.kind === 'weakpoint') {
      this.ctx.audio.bossHit(t.center.x / 10);
      this.ctx.vfx.explosion(t.center, 0xff3a6a, 3);
      this.ctx.cam.addTrauma(0.45);
      this.ctx.env.pulseLights(0xff3a6a, 1);
    }
    if (t.kind === 'bossCore') this.beginDeath();
  }

  onHit(t: Target) {
    if (t.kind === 'weakpoint' || t.kind === 'bossCore') {
      this.ctx.audio.bossHit(t.center.x / 10);
      this.ctx.cam.addTrauma(0.15);
      this.coreMat.uniforms.uIntensity.value = 3;
    }
  }

  private beginDeath() {
    this.phase = 'dying';
    this.dyingT = 0;
    this.boomT = 0;
    this.ctx.slowMo(2.6, 0.35);
    this.ctx.music.stop(2.5);
    this.ctx.audio.bossPhase();
    this.ctx.setBossBar(false, 0, '');
    this.ctx.targets.explode(this.center, 60);
  }

  private shift(next: Phase) {
    this.phase = 'shift';
    this.nextPhase = next;
    this.phaseT = 0;
    this.ctx.audio.bossPhase();
    this.ctx.music.tension(2);
    this.ctx.music.impact();
    this.ctx.cam.addTrauma(0.8);
    this.ctx.screen.flash(0xff80c0, 0.7);
    this.ctx.screen.pulseCA(2);
    this.ctx.env.pulseLights(0xff3ca0, 1.5);
    this.ctx.targets.explode(this.center, 40);
    if (next === 'p2') {
      this.coreMat.uniforms.uCrack.value = 0.5;
      this.shellMat.color.set(0xff3a6a).multiplyScalar(2.4);
      this.ctx.screen.setTint(0xffc0d0);
      this.ctx.hint('PHASE II', 'It adapts', 2.5);
    } else {
      this.coreMat.uniforms.uCrack.value = 1;
      this.shell.visible = false;
      this.ctx.screen.setTint(0xffb0b0);
      this.ctx.hint('PHASE III', 'The heart opens', 2.5);
    }
  }

  update(dt: number) {
    if (this.phase === 'idle' || this.phase === 'dead' || !this.group) return;
    this.time += dt;
    this.phaseT += dt;
    const c = this.center;
    const fury = this.phase === 'p3' ? 2.2 : this.phase === 'p2' ? 1.5 : 1;
    this.core.rotation.y += dt * 0.25 * fury;
    this.core.rotation.x += dt * 0.12 * fury;
    this.shell.rotation.y -= dt * 0.3 * fury;
    this.shell.rotation.z += dt * 0.15;
    this.rings.forEach((r, i) => {
      r.rotation.z += dt * (0.3 + i * 0.25) * fury * (i % 2 ? -1 : 1);
      r.rotation.x += dt * 0.05 * (i + 1);
    });
    this.coreMat.uniforms.uTime.value = this.time;
    this.arenaMat.uniforms.uTime.value = this.time * 0.5;
    const ci = this.coreMat.uniforms.uIntensity;
    ci.value += (1.6 + Math.sin(this.time * 4 * fury) * 0.3 - ci.value) * Math.min(1, dt * 6);
    (this.coreGlow.material as THREE.SpriteMaterial).opacity = 0.6 + Math.sin(this.time * 3 * fury) * 0.2;
    const L = this.ctx.env.bossLight;
    L.position.set(c.x, c.y, c.z + 8);
    L.intensity = 400 + Math.sin(this.time * 5) * 80;

    switch (this.phase) {
      case 'intro':
        if (this.phaseT > 1.2 && this.phaseT - dt <= 1.2) this.ctx.music.impact();
        this.ctx.cam.addTrauma(dt * 0.3);
        if (this.phaseT > 3.4) this.enterPhase('p1');
        break;
      case 'p1':
      case 'p2':
      case 'p3': {
        const orbEvery = this.phase === 'p1' ? 4.2 : this.phase === 'p2' ? 3.0 : 2.3;
        this.orbT -= dt;
        if (this.orbT <= 0) {
          this.orbT = orbEvery;
          this.launchOrb();
          if (this.phase !== 'p1' && Math.random() < 0.25) setTimeout(() => this.phase !== 'dying' && this.launchOrb(), 350);
        }
        this.crystalT -= dt;
        if (this.crystalT <= 0) {
          this.crystalT = this.phase === 'p3' ? 1.7 : 2.0;
          this.launchCrystal();
        }
        if (this.phase === 'p3') {
          this.plateT += dt;
          if (this.plateT > 7) {
            this.plateT = 0;
            const alive = this.plates.filter((p) => p.alive).length;
            if (alive < 5) this.spawnPlates(9 - alive, 6.4, c.z + 3, 1.1, 2.4, 1.8);
          }
          this.novaT -= dt;
          if (this.novaT <= 0) {
            this.novaT = 8;
            const a = rand(0, Math.PI * 2);
            const nova = this.spawn('explosive', c.x + Math.cos(a) * 6.4, c.y + Math.sin(a) * 4.5, c.z + 5);
            nova.custom = (tt) => tt.root.position.copy(tt.base);
          }
          const core = this.coreTarget;
          this.ctx.setBossBar(true, core ? Math.max(0, core.hp) / core.maxHp : 0, 'THE HEART — PHASE III');
        } else {
          const remaining = this.weak.reduce((s, w) => s + (w.alive ? Math.max(0, w.hp) : 0), 0);
          this.ctx.setBossBar(true, remaining / this.weakTotal, this.phase === 'p1' ? 'THE HEART — PHASE I' : 'THE HEART — PHASE II');
          if (this.weak.every((w) => !w.alive) && this.phaseT > 1) this.shift(this.phase === 'p1' ? 'p2' : 'p3');
        }
        break;
      }
      case 'shift':
        this.ctx.cam.addTrauma(dt * 0.4);
        if (this.phaseT > 2.6) this.enterPhase(this.nextPhase);
        break;
      case 'dying': {
        this.dyingT += dt;
        this.boomT -= dt;
        this.ctx.cam.addTrauma(dt * 0.9);
        if (this.boomT <= 0 && this.dyingT < 3) {
          this.boomT = 0.18;
          const p = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-0.2, 1)).normalize().multiplyScalar(4.4).add(c);
          this.ctx.vfx.explosion(p, Math.random() < 0.5 ? 0xffc050 : 0xff3ca0, 2.5);
          this.ctx.audio.explosion(p.x / 12);
        }
        this.core.scale.setScalar(1 + this.dyingT * 0.08 + Math.sin(this.dyingT * 40) * 0.03);
        if (this.dyingT >= 3.2) {
          this.phase = 'dead';
          this.core.visible = false;
          this.shell.visible = false;
          this.core.scale.setScalar(1);
          this.ctx.destruction.megaShatter(c, 5, 0xffc070);
          this.ctx.screen.flash(0xffffff, 1);
          this.ctx.cam.addTrauma(1);
          this.ctx.audio.explosion(0);
          this.ctx.audio.victory();
          this.ctx.env.bossLight.intensity = 0;
          setTimeout(() => this.ctx.onDefeated(), 1600);
        }
        break;
      }
    }
  }
}
