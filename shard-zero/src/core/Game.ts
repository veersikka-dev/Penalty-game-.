import * as THREE from 'three';

import { AudioManager } from '../audio/AudioManager';
import { MusicManager } from '../audio/MusicManager';
import { PostFX } from '../effects/PostFX';
import { ScreenEffects } from '../effects/ScreenEffects';
import { VFXManager } from '../effects/VFXManager';
import { AmbientDust } from '../effects/AmbientDust';
import { ParticleSystem } from '../destruction/ParticleSystem';
import { FragmentSystem } from '../destruction/FragmentSystem';
import { DestructionSystem } from '../destruction/DestructionSystem';
import { Player } from '../player/Player';
import { CameraController } from '../player/CameraController';
import { ShootingSystem, type Projectile, type HitResponse } from '../player/ShootingSystem';
import { Environment } from '../world/Environment';
import { LevelManager } from '../world/LevelManager';
import { Boss } from '../world/Boss';
import { THEMES } from '../world/themes';
import type { ThemeDef } from '../world/themes/Theme';
import { TargetFactory } from '../targets/TargetFactory';
import { TargetManager } from '../targets/TargetManager';
import type { Target } from '../targets/Target';
import { LEVELS } from '../data/levels';
import type { LevelDef, ScriptEvent, SpawnEvent } from '../data/types';
import { Input } from './Input';
import { Session, COMBO_WINDOW } from './Session';
import { Autopilot } from './Autopilot';
import { reportError } from './ErrorHandler';
import { settings, progress, saveProgress, saveSettings, recordLevel, QUALITY_PROFILES, QUALITY_ORDER, type Quality, type QualityProfile } from './Settings';
import { HUD } from '../ui/HUD';
import { UIManager } from '../ui/UIManager';
import type { MenuActions } from '../ui/MenuActions';
import { LoadingScreen } from '../ui/LoadingScreen';
import { MainMenu } from '../ui/MainMenu';
import { LevelSelect } from '../ui/LevelSelect';
import { SettingsMenu } from '../ui/SettingsMenu';
import { PauseMenu } from '../ui/PauseMenu';
import { LevelComplete, type LevelResult } from '../ui/LevelComplete';
import { GameOver } from '../ui/GameOver';
import { Credits } from '../ui/Credits';
import { Ending } from '../ui/Ending';
import { clamp, nextFrame } from '../utils/MathUtils';

type State = 'loading' | 'menu' | 'transition' | 'intro' | 'playing' | 'paused' | 'outro' | 'levelComplete' | 'gameOver' | 'ending';

interface Checkpoint {
  level: number;
  distance: number;
  ammo: number;
  score: number;
  time: number;
}

const _v = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

/**
 * The orchestrator. Owns every system, runs the state machine and main loop, and
 * implements the game rules that connect shooting, targets, scoring and progression.
 */
export class Game implements MenuActions {
  // Core
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camCtl!: CameraController;
  post!: PostFX;
  screen!: ScreenEffects;
  input!: Input;
  audio = new AudioManager();
  music = new MusicManager(this.audio);

  // World & gameplay
  env!: Environment;
  player = new Player();
  factory = new TargetFactory();
  targets!: TargetManager;
  particles!: ParticleSystem;
  frags!: FragmentSystem;
  vfx!: VFXManager;
  destruction!: DestructionSystem;
  shooting!: ShootingSystem;
  dust!: AmbientDust;
  levels = new LevelManager();
  boss!: Boss;
  session = new Session();
  autopilot = new Autopilot();

  // UI
  hud!: HUD;
  ui!: UIManager;

  state: State = 'loading';
  private prevState: State = 'playing';
  levelIndex = 0;
  level: LevelDef = LEVELS[0];
  private time = 0;
  private last = performance.now();
  private hitStopT = 0;
  private slowMoT = 0;
  private slowMoScale = 1;
  private checkpoint: Checkpoint = { level: 0, distance: 0, ammo: 25, score: 0, time: 0 };
  private profile!: QualityProfile;
  private introT = -1;
  private outroT = 0;
  private gameOverT = 0;
  private musicBase = 0.3;
  private lowAmmoWarned = false;
  private settingsReturn = 'menu';
  private loadToken = 0;
  private pausedAt = 0;
  private slowActive = false;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fpsWindow = 0;
  private lastPickupSound = 0;
  private lastBounceSound = 0;
  private raycaster = new THREE.Raycaster();
  private arenaBounds: ThemeDef | null = null;
  /** Debug: number of simulation steps per rendered frame (fast-forward for automated tests). */
  simSteps = 1;
  frameErrors = 0;

  // ------------------------------------------------------------------ init

  async init(container: HTMLElement, loading: LoadingScreen) {
    const step = async (i: number, total: number) => {
      loading.setStep(i, i / total);
      await nextFrame();
    };
    const TOTAL = 5;

    await step(0, TOTAL);
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.camCtl = new CameraController(innerWidth / innerHeight);
    this.scene.add(this.camCtl.camera);
    this.post = new PostFX(this.renderer, this.scene, this.camCtl.camera);
    this.screen = new ScreenEffects(this.post.uniforms);
    this.input = new Input(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      reportError('WebGL context lost', 'GPU reset');
      this.pause('Graphics device was reset — resume to continue');
    });

    await step(1, TOTAL);
    this.env = new Environment(this.scene, this.renderer);
    this.frags = new FragmentSystem(160);
    this.scene.add(this.frags.root);

    await step(2, TOTAL);
    this.audio.init();
    this.applyVolumes();

    await step(3, TOTAL);
    this.particles = new ParticleSystem(9000);
    this.scene.add(this.particles.points);
    this.vfx = new VFXManager(this.particles, this.camCtl.camera);
    this.scene.add(this.vfx.root);
    this.destruction = new DestructionSystem(this.frags, this.particles, this.vfx);
    this.shooting = new ShootingSystem(this.particles);
    this.scene.add(this.shooting.root);
    this.dust = new AmbientDust(1100);
    this.scene.add(this.dust.points);
    this.targets = new TargetManager(this.factory, {
      onDestroyed: (t) => this.onTargetDestroyed(t),
      onShatter: (t) => this.onTargetShatter(t),
      onCrash: (t) => this.onCrash(t),
    });
    this.scene.add(this.targets.root);
    this.boss = new Boss({
      scene: this.scene,
      targets: this.targets,
      vfx: this.vfx,
      audio: this.audio,
      music: this.music,
      screen: this.screen,
      cam: this.camCtl,
      destruction: this.destruction,
      env: this.env,
      playerPos: () => this.camCtl.camera.position,
      setBossBar: (v, f, l) => this.hud.bossBar(v, f, l),
      hint: (t, s, d) => this.hud.message(t, s, d),
      slowMo: (d, s) => this.slowMo(d, s),
      onDefeated: () => this.beginOutro(true),
    });
    this.applyTheme(THEMES.awakening, 1);
    this.applyQuality(settings.quality);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    // Compile every material up-front (targets + environment) so the first shatter never hitches
    const releasePrewarm = this.factory.prewarm(this.scene);
    this.env.update(0, 0, this.camCtl.camera.position, 0);
    try {
      const r = this.renderer as THREE.WebGLRenderer & { compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<void> };
      if (r.compileAsync) await r.compileAsync(this.scene, this.camCtl.camera);
      else this.renderer.compile(this.scene, this.camCtl.camera);
      this.post.render(0);
    } catch (err) {
      console.warn('[SHARD//ZERO] Shader pre-compilation skipped', err);
    }
    releasePrewarm();

    await step(4, TOTAL);
    this.buildUI();
    this.bindInput();
    this.last = performance.now();
    requestAnimationFrame(this.frame);
    await step(5, TOTAL);
  }

  private buildUI() {
    this.hud = new HUD();
    this.hud.onPause = () => this.pause();
    this.hud.onFullscreen = () => this.toggleFullscreen();
    this.ui = new UIManager(this.audio);
    this.ui.register('menu', new MainMenu(this));
    this.ui.register('levels', new LevelSelect(this));
    this.ui.register('settings', new SettingsMenu(this));
    this.ui.register('pause', new PauseMenu(this));
    this.ui.register('complete', new LevelComplete(this));
    this.ui.register('gameover', new GameOver(this));
    this.ui.register('credits', new Credits(this));
    this.ui.register('ending', new Ending(this));
  }

  private bindInput() {
    this.input.onLockChange = (locked) => {
      document.body.classList.toggle('locked', locked);
      if (!locked && (this.state === 'playing' || this.state === 'intro') && !this.autopilot.enabled) this.pause();
    };
    window.addEventListener('blur', () => this.pause('Paused — window lost focus'));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause('Paused — window lost focus');
    });
  }

  /** Called once loading finishes and the player clicks (a user gesture unlocks audio). */
  enter() {
    this.audio.resume();
    this.toMenu();
    this.screen.fade(0, 1.6);
  }

  // ------------------------------------------------------------------ settings & quality

  private applyVolumes() {
    this.audio.setVolumes(settings.master, settings.music, settings.sfx);
  }

  applyQuality(q: Quality) {
    this.profile = QUALITY_PROFILES[q];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.profile.maxPixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    const ok = this.post.configure(this.profile, this.env.theme?.bloom ?? { strength: 0.9, radius: 0.6, threshold: 0.7 });
    if (!ok) this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.particles.setCap(this.profile.particles);
    this.frags.maxActive = this.profile.fragments;
    this.dust.setCount(this.profile.dust);
    this.destruction.detail = q === 'low' ? 0.55 : q === 'medium' ? 0.8 : 1;
    this.screen.post = this.profile.post;
    this.post.setSize(innerWidth, innerHeight, this.profile.bloomScale);
  }

  settingsChanged() {
    this.applyVolumes();
    this.camCtl.sensitivity = settings.sensitivity;
    this.camCtl.motion = settings.motion;
    this.screen.motion = settings.motion;
    this.vfx.motion = settings.motion;
    if (QUALITY_PROFILES[settings.quality] !== this.profile) this.applyQuality(settings.quality);
  }

  private resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h);
    this.camCtl.camera.aspect = w / h;
    this.camCtl.camera.updateProjectionMatrix();
    this.post.setSize(w, h, this.profile?.bloomScale ?? 1);
  }

  private applyTheme(def: ThemeDef, seed: number) {
    this.env.setTheme(def, seed);
    this.renderer.toneMappingExposure = def.exposure;
    this.post.setBloom(def.bloom);
    this.dust.setStyle(def.dust.color, def.dust.size, def.dust.opacity);
    this.frags.floorY = def.floorY;
    this.frags.gravity = def.floorY === null ? 5 : 14;
    this.shooting.setColor(def.accent);
    this.arenaBounds = { ...def, inside: () => true, floorY: null };
  }

  // ------------------------------------------------------------------ menu actions

  play() {
    const done = LEVELS.every((_l, i) => progress.levels[i]?.completed);
    this.startLevel(done ? 0 : Math.min(progress.unlocked, LEVELS.length - 1));
  }

  showScreen(name: string) {
    if (name === 'ending') this.state = 'ending';
    this.ui.show(name);
  }

  openSettings(returnTo: string) {
    this.settingsReturn = returnTo;
    this.ui.show('settings');
  }

  closeSettings() {
    this.ui.show(this.settingsReturn);
  }

  resetProgress() {
    progress.unlocked = 0;
    progress.levels = {};
    progress.introSeen = false;
    saveProgress();
    this.toast('Progress reset');
  }

  toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
      else document.documentElement.requestFullscreen?.().catch(() => this.toast('Fullscreen unavailable'));
    } catch {
      this.toast('Fullscreen unavailable');
    }
  }

  toMenu() {
    this.loadToken++;
    this.input.exitLock();
    document.body.classList.remove('playing');
    this.state = 'menu';
    this.hud.setVisible(false);
    this.clearWorld();
    this.boss.reset();
    this.screen.setDesat(0);
    this.screen.setTint(0xffffff);
    this.screen.fade(0, 0.8);
    const themeLevel = LEVELS[Math.min(progress.unlocked, LEVELS.length - 1)];
    if (this.env.theme?.id !== themeLevel.theme) {
      this.applyTheme(THEMES[themeLevel.theme], 99);
      this.player.reset(0, 6);
    }
    this.env.lightLevel = 1;
    this.player.stopAt = null;
    this.player.targetSpeed = 6;
    this.music.play('menu', 0.3);
    this.ui.show('menu');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.ui.hideCurrent();
    this.state = this.prevState;
    this.music.duck(false);
    this.hud.setVisible(true);
    this.input.requestLock();
    this.last = performance.now();
  }

  pause(reason?: string) {
    if (this.state !== 'playing' && this.state !== 'intro') return;
    if (this.autopilot.enabled && reason) return;
    this.prevState = this.state;
    this.state = 'paused';
    this.pausedAt = performance.now();
    this.music.duck(true);
    this.input.exitLock();
    this.ui.show('pause', reason);
  }

  restartLevel() {
    this.startLevel(this.levelIndex, false);
  }

  retryCheckpoint() {
    this.startLevel(this.levelIndex, this.checkpoint.level === this.levelIndex);
  }

  nextLevel() {
    if (this.levelIndex + 1 < LEVELS.length) this.startLevel(this.levelIndex + 1);
    else this.showScreen('ending');
  }

  // ------------------------------------------------------------------ level flow

  private clearWorld() {
    this.targets.clear();
    this.frags.clear();
    this.particles.clear();
    this.vfx.clear();
    this.shooting.clear();
  }

  async startLevel(index: number, fromCheckpoint = false) {
    const token = ++this.loadToken;
    this.input.requestLock(); // must happen inside the click gesture
    this.audio.resume();
    this.ui.hideCurrent();
    this.state = 'transition';
    this.audio.transition();
    await this.screen.fade(1, 0.55);
    if (token !== this.loadToken) return;

    const level = LEVELS[index];
    this.level = level;
    this.levelIndex = index;
    this.clearWorld();
    this.boss.reset();
    if (this.env.theme?.id !== level.theme) this.applyTheme(THEMES[level.theme], index + 1);
    this.levels.load(level);

    const cp = fromCheckpoint && this.checkpoint.level === index ? this.checkpoint : null;
    const startDist = cp ? Math.max(0, cp.distance - 14) : 0;
    this.levels.resetTo(startDist);
    this.session.reset(cp ? Math.max(cp.ammo, 20) : level.startAmmo);
    if (cp) {
      this.session.score = cp.score;
      this.session.time = cp.time;
    } else this.checkpoint = { level: index, distance: 0, ammo: level.startAmmo, score: 0, time: 0 };
    const sec = level.sections[this.levels.sectionIndexAt(startDist)];
    this.player.reset(startDist, sec.speed ?? level.baseSpeed);
    this.shooting.gravity = level.gravity;
    this.env.reset();
    this.env.lightLevel = 1;
    this.camCtl.resetLook();
    this.camCtl.cinematic = null;
    this.hitStopT = this.slowMoT = 0;
    this.gameOverT = 0;
    this.lowAmmoWarned = false;
    this.slowActive = false;
    this.musicBase = 0.3;
    this.screen.setDesat(0);
    this.screen.setTint(0xffffff);
    this.hud.reset();
    this.hud.setLevel(`${String(index + 1).padStart(2, '0')} · ${level.name}`);
    this.hud.setProgressTicks(this.levels.checkpointSections.filter((i) => i > 0).map((i) => this.levels.sectionStarts[i] / this.levels.totalLength));
    this.hud.setVisible(true);
    this.hud.setCrosshairVisible(true);
    document.body.classList.add('playing');
    this.music.play(level.music, 0.3);
    this.last = performance.now();

    if (index === 0 && !cp) {
      // Cinematic intro: darkness, lights power on, the journey begins
      this.state = 'intro';
      this.introT = 0;
      this.env.lightLevel = 0;
      this.player.speed = 0;
      this.player.targetSpeed = 0;
      this.hud.showSkip(true);
      this.screen.fade(0, 2.8);
    } else {
      this.state = 'playing';
      this.screen.fade(0, 0.9);
      this.hud.titleCard(`SECTOR ${String(index + 1).padStart(2, '0')}`, level.name.toUpperCase(), level.subtitle, level.accent);
      if (cp) this.hud.message('CHECKPOINT', sec.name, 2);
    }
  }

  private updateIntro(dt: number) {
    const t = (this.introT += dt);
    const skip = this.input.wasPressed('Space') || this.input.wasPressed('Enter') || this.input.wasPressed('Escape');
    // Lights stutter on in stages
    const stages = [1.6, 2.4, 3.1, 3.7];
    let lv = 0;
    stages.forEach((s, i) => {
      if (t >= s) lv = (i + 1) / stages.length;
      if (t >= s && t - dt < s) {
        this.audio.powerUp();
        this.env.pulseLights(0xbfe4ff, 0.6);
      }
    });
    const flicker = t < 4 && Math.random() < 0.08 ? 0.4 : 1;
    this.env.lightLevel = lv * flicker;
    this.dust.setOpacity(Math.min(1, t / 3) * (this.env.theme?.dust.opacity ?? 0.5));
    if (t >= 3.9 && t - dt < 3.9) this.hud.titleCard('SECTOR 01', 'THE AWAKENING', this.level.subtitle, this.level.accent, 3.4);
    if (t >= 4.6 && t - dt < 4.6) this.player.targetSpeed = this.level.baseSpeed;
    if (t > 7.5 || skip) this.endIntro(skip);
  }

  private endIntro(skipped: boolean) {
    this.introT = -1;
    this.state = 'playing';
    this.env.lightLevel = 1;
    this.player.targetSpeed = this.level.baseSpeed;
    if (skipped) {
      this.player.speed = Math.max(this.player.speed, this.level.baseSpeed * 0.8);
      this.screen.fade(0, 0.3);
    }
    this.dust.setOpacity(this.env.theme?.dust.opacity ?? 0.5);
    this.hud.showSkip(false);
    progress.introSeen = true;
    saveProgress();
  }

  private levelHooks = {
    spawn: (ev: SpawnEvent, z: number) => {
      this.targets.spawn(ev, z, this.env.theme?.glass ?? 0x8fd8ff);
    },
    script: (ev: ScriptEvent) => this.runScript(ev),
    enterSection: (i: number, checkpoint: boolean) => {
      const sec = this.level.sections[i];
      if (checkpoint && i > 0) {
        this.checkpoint = { level: this.levelIndex, distance: this.levels.sectionStarts[i], ammo: this.session.ammo, score: this.session.score, time: this.session.time };
        this.hud.message('CHECKPOINT', sec.name, 2.2);
        this.audio.checkpoint();
        this.env.pulseLights(this.env.theme?.accent ?? 0xffffff, 1);
        this.vfx.ring(_v.copy(this.camCtl.camera.position).add(new THREE.Vector3(0, 0, -6)), this.env.theme?.accent ?? 0xffffff, 7, 0.9, 0.6);
      }
      this.hud.setLevel(`${String(this.levelIndex + 1).padStart(2, '0')} · ${this.level.name} — ${sec.name}`);
    },
  };

  private runScript(ev: ScriptEvent) {
    switch (ev.action) {
      case 'hint':
        this.hud.message(ev.text, ev.sub, ev.duration ?? 3.2);
        break;
      case 'speed':
        this.player.targetSpeed = ev.value;
        break;
      case 'music':
        this.musicBase = ev.intensity;
        break;
      case 'tension':
        this.music.tension(2.2);
        this.audio.transition();
        break;
      case 'pulse':
        this.env.pulseLights(ev.color, 1.5);
        break;
      case 'boss':
        this.startBoss();
        break;
    }
  }

  private startBoss() {
    const S = this.levels.sectionStarts[this.levels.sectionStarts.length - 1];
    // The tunnel ends just before the stop point so the player drifts out into the open chamber
    this.env.stopDistance = S + 4;
    this.player.stopAt = S + 30;
    this.boss.start(-(S + 62));
    this.env.setFogDensity(0.006);
    this.camCtl.addTrauma(0.5);
    // The Heart feeds you for the final fight
    if (this.session.ammo < 30) {
      const gain = 30 - this.session.ammo;
      this.session.addAmmo(gain);
      this.hud.ammoChange(gain);
      this.audio.pickup();
    }
  }

  private beginOutro(final: boolean) {
    if (this.state !== 'playing') return;
    this.state = 'outro';
    this.outroT = 0;
    this.player.stopAt = null;
    this.player.targetSpeed = (this.level.sections.at(-1)?.speed ?? this.level.baseSpeed) * 1.8;
    this.audio.transition();
    this.screen.flash(0xffffff, 0.35);
    this.hud.setCrosshairVisible(false);
    this.screen.fade(1, final ? 2.2 : 1.6, '#e8f6ff').then(() => {
      if (this.state === 'outro') this.showLevelComplete(final);
    });
  }

  private showLevelComplete(final: boolean) {
    const s = this.session;
    const newBest = recordLevel(this.levelIndex, s.score, s.accuracy, s.bestCombo, s.time, LEVELS.length);
    const result: LevelResult = {
      levelIndex: this.levelIndex,
      levelName: this.level.name,
      score: s.score,
      accuracy: s.accuracy,
      destroyed: s.destroyed,
      bestCombo: s.bestCombo,
      time: s.time,
      ammoEfficiency: clamp(s.ammoCollected / Math.max(1, s.shots), 0, 9.99),
      newBest,
      isFinal: final,
    };
    this.state = 'levelComplete';
    this.input.exitLock();
    document.body.classList.remove('playing');
    this.hud.setVisible(false);
    this.clearWorld();
    this.boss.reset();
    this.player.stopAt = null;
    this.player.targetSpeed = 5;
    this.music.setIntensity(0.2);
    this.screen.fade(0, 1.2, '#e8f6ff');
    this.ui.show('complete', result);
    if (final) this.music.play('menu', 0.25);
  }

  private triggerGameOver() {
    this.state = 'gameOver';
    this.input.exitLock();
    document.body.classList.remove('playing');
    this.slowMo(1.5, 0.25);
    this.screen.setDesat(0.85);
    this.audio.gameOver();
    this.music.duck(true);
    this.hud.setCrosshairVisible(false);
    const sec = this.level.sections[this.levels.sectionIndexAt(this.player.distance)];
    setTimeout(() => {
      if (this.state === 'gameOver') this.ui.show('gameover', { score: this.session.score, section: sec?.name ?? this.level.name });
    }, 900);
  }

  // ------------------------------------------------------------------ combat rules

  hitStop(d: number) {
    this.hitStopT = Math.max(this.hitStopT, d);
  }
  slowMo(d: number, scale: number) {
    this.slowMoT = Math.max(this.slowMoT, d);
    this.slowMoScale = scale;
  }

  private screenPos(p: THREE.Vector3): { x: number; y: number } | null {
    _v.copy(p).project(this.camCtl.camera);
    if (_v.z > 1) return null;
    return { x: ((_v.x + 1) / 2) * innerWidth, y: ((1 - _v.y) / 2) * innerHeight };
  }

  private pan(x: number) {
    return clamp((x - this.camCtl.camera.position.x) / 9, -1, 1);
  }

  /** Fires a projectile along the aim ray (or an explicit direction, used by the QA bot). */
  fire(dirOverride?: THREE.Vector3) {
    if (this.state !== 'playing' && !(this.state === 'intro' && this.introT > 4.5)) return;
    if (this.shooting.cooldown > 0) return;
    if (this.session.ammo <= 0) {
      this.audio.miss();
      return;
    }
    const cam = this.camCtl.camera;
    let dir: THREE.Vector3;
    if (dirOverride) dir = dirOverride.clone();
    else if (this.input.locked) dir = this.camCtl.forward.clone();
    else {
      this.raycaster.setFromCamera(new THREE.Vector2(this.input.cursorX, this.input.cursorY), cam);
      dir = this.raycaster.ray.direction.clone();
    }
    _right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    _up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    const origin = cam.position.clone().addScaledVector(_right, 0.22).addScaledVector(_up, -0.24).addScaledVector(dir, 0.5);
    // Converge on the point under the crosshair ~32m out
    const aimPoint = cam.position.clone().addScaledVector(dir, 32);
    const shotDir = aimPoint.sub(origin).normalize();
    const p = this.shooting.fire(origin, shotDir, this.player.velocity);
    if (!p) return;
    this.session.ammo--;
    this.session.shots++;
    this.audio.shoot();
    this.camCtl.kick(1.1, 0.012);
    this.hud.fire();
    this.vfx.muzzle(origin, shotDir, this.env.theme?.accent ?? 0x9fe8ff);
  }

  private shotCallbacks = {
    onHit: (p: Projectile, t: Target, point: THREE.Vector3): HitResponse => {
      if (p.hits.size === 1) {
        this.session.hitShots++;
        this.session.streak++;
        if (this.session.streak > 0 && this.session.streak % 10 === 0) {
          const bonus = 50 * this.session.streak;
          this.session.addScore(bonus);
          const sp = this.screenPos(point);
          if (sp) this.hud.popup(`PRECISION x${this.session.streak} +${bonus}`, sp.x, sp.y - 40, '#ffd35a', true);
        }
      }
      const dir = _v.copy(p.vel).normalize().clone();
      const destroyed = this.targets.hit(t, point, dir, 1);
      this.hud.hit();
      if (t.tag === 'boss' && !destroyed) this.boss.onHit(t);
      if (destroyed) {
        p.kills++;
        const sp = this.screenPos(point);
        if (p.kills === 2 || p.kills === 3) {
          const bonus = p.kills === 2 ? 150 : 400;
          this.session.addScore(bonus);
          if (sp) this.hud.popup(`${p.kills === 2 ? 'DOUBLE' : 'TRIPLE'} +${bonus}`, sp.x, sp.y - 34, '#ffd35a', true);
          this.hitStop(0.05);
        }
        if (p.kills === 1 && p.origin.distanceTo(point) > 48) {
          this.session.addScore(100);
          if (sp) this.hud.popup('LONG SHOT +100', sp.x, sp.y + 30, '#8ff0ff');
        }
        const passThrough = t.kind === 'panel' || t.kind === 'hanging' || t.kind === 'shieldPlate' || !t.def.blocks;
        return passThrough ? 'pierce' : 'stop';
      }
      this.vfx.impact(point, t.def.color, 0.8);
      this.audio.impact(this.pan(point.x));
      return t.def.blocks ? 'ricochet' : 'pierce';
    },
    onExpire: (p: Projectile) => {
      if (p.hits.size === 0 && (this.state === 'playing' || this.state === 'intro')) {
        this.session.breakCombo();
        this.session.streak = 0;
        this.audio.miss();
      }
    },
    onBounce: (p: Projectile) => {
      this.vfx.sparks(p.pos, this.env.theme?.accent ?? 0xffffff, 6, 4, 0.1, 0.3);
      const now = performance.now();
      if (now - this.lastBounceSound > 80) {
        this.lastBounceSound = now;
        this.audio.impact(this.pan(p.pos.x));
      }
    },
  };

  private onTargetDestroyed(t: Target) {
    if (t.cause !== 'crash') {
      const { points, tierUp } = this.session.registerDestroy(t.def.score);
      const sp = this.screenPos(t.center);
      if (sp) this.hud.popup(`+${points}`, sp.x, sp.y, '#ffffff');
      if (t.def.ammo > 0) {
        // Mercy: crystals give a little extra when you're almost out
        const gain = t.def.ammo + (this.session.ammo <= 5 && t.def.frag === 'crystal' ? 1 : 0);
        this.session.addAmmo(gain);
        this.hud.ammoChange(gain);
        if (sp) this.hud.popup(`+${gain} ◆`, sp.x, sp.y + 26, '#8fffc8');
        const now = performance.now();
        if (now - this.lastPickupSound > 60) {
          this.lastPickupSound = now;
          this.audio.pickup();
        }
      }
      if (tierUp) {
        this.audio.combo(this.session.comboMult);
        if (sp) this.hud.popup(`x${this.session.comboMult}`, innerWidth - 110, innerHeight / 2 + 70, '#8ff0ff', true);
      }
      // Camera & time feedback scale with the size of what broke
      const area = t.isGlass ? t.half.x * t.half.y * 4 : 0;
      this.camCtl.addTrauma(t.isGlass ? clamp(0.08 + area * 0.012, 0.08, 0.3) : 0.08);
      this.screen.pulseCA(t.isGlass ? 0.5 : 0.3);
      if (area > 12) this.hitStop(0.045);
    }
    switch (t.def.special) {
      case 'explosive':
        this.targets.explode(t.center, 7.5, t);
        this.vfx.explosion(t.center, 0xff6a2a, 3.5);
        this.audio.explosion(this.pan(t.center.x));
        this.camCtl.addTrauma(0.7);
        this.screen.flash(0xffa060, 0.25);
        this.screen.pulseCA(1.6);
        this.env.pulseLights(0xff6a2a, 1.2);
        this.hitStop(0.07);
        break;
      case 'time':
        this.session.slowTime = 4;
        this.audio.special('time');
        this.screen.flash(0xffd35a, 0.3);
        this.hud.message('CHRONO', 'Time slows', 1.4);
        break;
      case 'multiplier':
        this.session.bonusMult = 2;
        this.session.bonusTime = 10;
        this.audio.special('multiplier');
        this.screen.flash(0xff4ad8, 0.25);
        this.hud.message('PRISM x2', 'Double score', 1.4);
        break;
    }
    if (t.tag === 'boss') this.boss.onDestroyed(t);
  }

  private onTargetShatter(t: Target) {
    this.destruction.shatter(t);
    const pan = this.pan(t.center.x);
    if (t.isGlass) {
      const area = t.half.x * t.half.y * 4;
      if (area > 8) this.audio.glassLarge(pan);
      else this.audio.glassSmall(pan);
    } else if (t.def.frag === 'crystal' && t.def.special !== 'explosive') {
      this.audio.crystal(pan, this.session.combo);
    }
  }

  private onCrash(t: Target) {
    if (this.state !== 'playing') return;
    const loss = t.kind === 'bossOrb' ? 3 : 10;
    const lost = Math.min(loss, this.session.ammo);
    this.session.ammo -= lost;
    this.session.crashes++;
    this.session.breakCombo();
    this.session.streak = 0;
    this.hud.ammoChange(-loss);
    this.hud.crack();
    this.hud.message(t.kind === 'bossOrb' ? 'HIT' : 'CRASH', `−${loss} shards`, 1.2);
    this.screen.hurt();
    this.screen.flash(0xff4060, 0.22);
    this.camCtl.addTrauma(0.95);
    this.camCtl.kick(-6, 0.05);
    this.audio.crash();
    this.hitStop(0.12);
  }

  // ------------------------------------------------------------------ main loop

  private frame = (now: number) => {
    requestAnimationFrame(this.frame);
    const rdt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    try {
      for (let i = 0; i < this.simSteps; i++) this.update(i === 0 ? rdt : 1 / 30);
      this.render(rdt);
      this.frameErrors = 0;
    } catch (err) {
      this.frameErrors++;
      if (this.frameErrors < 5) reportError('Frame update', err);
    }
  };

  private update(rdt: number) {
    this.time += rdt;
    const input = this.input;

    if (input.wasPressed('KeyF')) this.toggleFullscreen();
    if ((input.wasPressed('Escape') || input.wasPressed('KeyP')) && performance.now() - this.pausedAt > 350) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused' && this.ui.current === 'pause') this.resume();
    }

    switch (this.state) {
      case 'menu':
      case 'ending':
      case 'levelComplete':
        this.updateAttract(rdt);
        break;
      case 'intro':
      case 'playing':
      case 'outro':
      case 'gameOver':
        this.updateGameplay(rdt);
        break;
      case 'transition':
      case 'loading':
      case 'paused':
        break;
    }
    this.screen.update(rdt);
    this.music.update(rdt);
    this.hud?.update(rdt);
    input.endFrame();
  }

  /** Menu background: the world drifts by with a slow cinematic camera. */
  private updateAttract(dt: number) {
    const t = this.time;
    this.player.update(dt);
    this.camCtl.cinematic = { yaw: Math.sin(t * 0.09) * 0.22, pitch: 0.04 + Math.sin(t * 0.13) * 0.05 };
    this.camCtl.extraRoll = (this.env.theme?.roll ?? 0) * Math.sin(t * 0.3);
    this.camCtl.update(dt, t, this.player.position, this.player.speed, 0);
    this.env.update(t, dt, this.camCtl.camera.position, this.player.distance);
    this.dust.update(t, dt, this.camCtl.camera.position);
    this.frags.update(dt);
    this.particles.update(dt);
    this.vfx.update(dt);
    this.screen.speed = 0;
  }

  private updateGameplay(rdt: number) {
    const s = this.session;
    let scale = 1;
    if (s.slowTime > 0) scale = 0.45;
    if (this.slowMoT > 0) {
      this.slowMoT -= rdt;
      scale = Math.min(scale, this.slowMoScale);
    }
    if (this.hitStopT > 0) {
      this.hitStopT -= rdt;
      scale = Math.min(scale, 0.08);
    }
    const dt = rdt * scale;
    const t = this.time;
    const cam = this.camCtl.camera;

    if (this.state === 'intro') this.updateIntro(rdt);

    // Aim
    this.camCtl.cinematic = null;
    if (this.autopilot.enabled) {
      // bot drives the camera directly
    } else if (this.input.locked) {
      this.camCtl.addLook(this.input.dx, this.input.dy);
      this.hud.setCrosshair(null, null);
    } else {
      this.camCtl.setCursorLean(this.input.cursorX, this.input.cursorY);
      this.hud.setCrosshair(((this.input.cursorX + 1) / 2) * innerWidth, ((1 - this.input.cursorY) / 2) * innerHeight);
    }
    this.hud.showAimNote(!this.input.locked && !this.autopilot.enabled && (this.state === 'playing' || this.state === 'intro'));
    if (this.input.firePressed && (this.state === 'playing' || this.state === 'intro')) {
      if (!this.input.locked && !this.autopilot.enabled) this.input.requestLock();
      this.fire();
    }

    if (this.state === 'playing' || this.state === 'intro' || this.state === 'outro') {
      this.player.update(dt);
      this.levels.update(this.player.distance, (this.env.theme?.viewDistance ?? 130) * 0.85, this.levelHooks);
    }
    this.boss.update(dt);
    this.targets.update(dt, cam.position);
    this.autopilot.update(rdt, {
      camera: cam,
      targets: this.targets.targets,
      projectileSpeed: this.shooting.speed,
      gravity: this.shooting.gravity,
      canFire: () => this.shooting.cooldown <= 0 && this.session.ammo > 0 && this.state === 'playing',
      fireDir: (d) => this.fire(d),
      look: (d) => {
        this.camCtl.targetYaw = clamp(Math.atan2(-d.x, -d.z), -1.1, 1.1);
        this.camCtl.targetPitch = clamp(Math.asin(d.y), -0.8, 0.8);
      },
    });
    const bounds = this.boss.active && this.arenaBounds && this.player.distance > this.env.stopDistance - 8 ? this.arenaBounds : this.env.theme!;
    this.shooting.update(dt, this.targets, bounds, cam.position, this.shotCallbacks);
    this.frags.update(dt);
    this.particles.update(dt);
    this.vfx.update(dt);
    if (this.state !== 'gameOver') s.update(dt);

    // Slow-motion presentation
    const slow = s.slowTime > 0;
    if (slow !== this.slowActive) {
      this.slowActive = slow;
      this.screen.setTint(slow ? 0xffe6b0 : 0xffffff);
      this.screen.setDesat(slow ? 0.18 : 0);
      this.camCtl.extraFov = slow ? -5 : 0;
    }

    this.camCtl.extraRoll = (this.env.theme?.roll ?? 0) * Math.sin(t * 0.35);
    this.camCtl.update(rdt, t, this.player.position, this.player.speed, this.player.accel);
    this.env.update(t, dt, cam.position, this.player.distance);
    this.dust.update(t, dt, cam.position);
    this.screen.speed = clamp((this.player.speed - 9) / 9, 0, 1) * 0.8 + (this.state === 'outro' ? 0.6 : 0);

    // HUD
    this.hud.setAmmo(s.ammo);
    this.hud.setScore(s.score);
    this.hud.setMult(s.comboMult, s.bonusMult);
    this.hud.setCombo(s.combo, s.comboTimer / COMBO_WINDOW);
    this.hud.setProgress(this.levels.progress(this.player.distance));
    this.hud.setSpecials(Math.max(0, s.slowTime) / 4, Math.max(0, s.bonusTime) / 10);
    if (s.ammo <= 5 && !this.lowAmmoWarned && this.state === 'playing') {
      this.lowAmmoWarned = true;
      this.audio.lowAmmo();
    } else if (s.ammo > 7) this.lowAmmoWarned = false;

    if (!this.boss.active) this.music.setIntensity(this.musicBase + Math.min(0.12, s.combo * 0.012));

    if (this.state === 'playing') {
      // Level end
      if (!this.level.boss && this.player.distance >= this.levels.totalLength - 4) this.beginOutro(false);
      // Out of shards
      const bossEnding = this.boss.phase === 'dying' || this.boss.phase === 'dead';
      const nearFinish = !this.level.boss && this.player.distance > this.levels.totalLength - 60;
      if (s.ammo <= 0 && this.shooting.inFlight === 0 && !bossEnding && !nearFinish) {
        this.gameOverT += rdt;
        if (this.gameOverT > 1.1) this.triggerGameOver();
      } else this.gameOverT = 0;
      this.trackPerformance(rdt);
    }
  }

  /** Adaptive quality: steps graphics down if the frame rate stays low. */
  private trackPerformance(rdt: number) {
    if (!settings.autoQuality || this.simSteps > 1) return;
    this.fpsAcc += rdt;
    this.fpsFrames++;
    this.fpsWindow += rdt;
    if (this.fpsWindow < 5) return;
    const fps = this.fpsFrames / this.fpsAcc;
    this.fpsAcc = this.fpsFrames = this.fpsWindow = 0;
    const idx = QUALITY_ORDER.indexOf(settings.quality);
    if (fps < 42 && idx > 0) {
      settings.quality = QUALITY_ORDER[idx - 1];
      saveSettings();
      this.applyQuality(settings.quality);
      this.toast(`Graphics set to ${settings.quality.toUpperCase()} for smoother play`);
    }
  }

  private render(rdt: number) {
    if (!this.renderer) return;
    this.particles.setViewport(this.renderer.domElement.height, this.camCtl.camera.fov);
    this.post.render(rdt);
  }

  toast(msg: string) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout((t as HTMLElement & { _h?: number })._h);
    (t as HTMLElement & { _h?: number })._h = window.setTimeout(() => t.classList.remove('show'), 3200);
  }
}
