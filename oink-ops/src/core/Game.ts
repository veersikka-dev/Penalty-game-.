import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { MusicManager } from '../audio/MusicManager';
import { PostFX } from '../effects/PostFX';
import { ScreenEffects } from '../effects/ScreenEffects';
import { VFXManager } from '../effects/VFXManager';
import { AmbientDust } from '../effects/AmbientDust';
import { ParticleSystem } from '../destruction/ParticleSystem';
import { FragmentSystem, type FragType } from '../destruction/FragmentSystem';
import { CollisionWorld } from '../physics/Collision';
import { Sky } from '../render/Sky';
import { PlayerController, type PlayerInput, POWERUP_DURATION } from '../player/PlayerController';
import { ThirdPersonCamera } from '../player/ThirdPersonCamera';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { WEAPONS, WEAPON_ORDER, type WeaponId } from '../weapons/WeaponDefs';
import { Combat } from '../combat/Combat';
import type { Damageable, DamageInfo, PowerUpId } from '../combat/types';
import { EnemyManager } from '../enemies/EnemyManager';
import type { Enemy, AIContext, EnemySound } from '../enemies/Enemy';
import { DestructibleManager, type Destructible } from '../world/Destructibles';
import { PickupManager, PICKUP_INFO, type Pickup } from '../world/Pickups';
import { LevelBuilder, type LevelData } from '../world/LevelBuilder';
import { LevelDirector } from '../world/LevelDirector';
import { BaconBoss, type BossContext } from '../world/BaconBoss';
import { THEMES, type ThemeDef } from '../world/Themes';
import { house, windmill, tree, flowers, bush, pine, fenceRow } from '../world/Props';
import { WORLDS } from '../data/worlds';
import { applyLoadout } from '../data/cosmetics';
import { Session, COMBO_WINDOW } from './Session';
import { Input } from './Input';
import { Autopilot } from './Autopilot';
import { reportError } from './ErrorHandler';
import { settings, save, persist, saveSettings, recordWorld, resetSave, QUALITY_PROFILES, QUALITY_ORDER, type Quality, type QualityProfile } from './Settings';
import { HUD } from '../ui/HUD';
import { UIManager } from '../ui/UIManager';
import { LoadingScreen, MainMenu, WorldSelect, UpgradesScreen, CustomizeScreen, SettingsScreen, PauseScreen, ResultsScreen, CreditsScreen, EndingScreen, type MenuActions, type Results } from '../ui/Menus';
import { clamp, nextFrame, rand } from '../utils/MathUtils';
import { glowTexture } from '../utils/textures';

type State = 'loading' | 'menu' | 'transition' | 'playing' | 'paused' | 'dead' | 'outro' | 'results' | 'ending';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _right = new THREE.Vector3();

const TUTORIAL = [
  { at: 1, html: 'Move with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · look with the <kbd>MOUSE</kbd>' },
  { at: 7, html: '<kbd>LEFT CLICK</kbd> to blast those crates!' },
  { at: 14, html: 'Hold <kbd>RIGHT CLICK</kbd> to aim over the shoulder' },
  { at: 21, html: '<kbd>SPACE</kbd> to jump the fence · <kbd>SHIFT</kbd> to sprint' },
  { at: 30, html: '<kbd>R</kbd> reload · <kbd>Q</kbd> dodge roll · <kbd>C</kbd> crouch' },
];

/**
 * The orchestrator: owns every system, runs the state machine and main loop,
 * and implements the rules that tie movement, shooting, enemies, destruction,
 * pickups, objectives and progression together.
 */
export class Game implements MenuActions {
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  cam!: ThirdPersonCamera;
  post!: PostFX;
  screen!: ScreenEffects;
  input!: Input;
  audio = new AudioManager();
  music = new MusicManager(this.audio);
  world = new CollisionWorld();
  sky: Sky | null = null;
  sun = new THREE.DirectionalLight(0xffffff, 2.5);
  hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  player!: PlayerController;
  weapons!: WeaponSystem;
  particles!: ParticleSystem;
  frags!: FragmentSystem;
  vfx!: VFXManager;
  combat!: Combat;
  enemies!: EnemyManager;
  props!: DestructibleManager;
  pickups!: PickupManager;
  director!: LevelDirector;
  dust!: AmbientDust;
  boss: BaconBoss | null = null;
  level: LevelData | null = null;
  theme: ThemeDef = THEMES.menu;
  session = new Session();
  autopilot = new Autopilot();
  hud!: HUD;
  ui!: UIManager;
  readonly worlds = WORLDS;
  state: State = 'loading';
  private prevState: State = 'playing';
  worldIndex = 0;
  private profile!: QualityProfile;
  private time = 0;
  private last = performance.now();
  private hitStopT = 0;
  private slowMoT = 0;
  private slowMoScale = 1;
  private checkpoint = { x: 0, z: 0, yaw: 0 };
  private lastSafe = new THREE.Vector3();
  private gates = new Map<string, Destructible>();
  private portal: THREE.Group | null = null;
  private aimTarget: Damageable | null = null;
  private aimPoint = new THREE.Vector3();
  private missStreak = 0;
  private deadT = 0;
  private outroT = 0;
  private settingsReturn = 'menu';
  private customizing = false;
  private loadToken = 0;
  private tutorialStep = 0;
  private levelTime = 0;
  private pausedAt = 0;
  private musicBase = 0.35;
  private fps = { acc: 0, n: 0, win: 0 };
  simSteps = 1;
  frameErrors = 0;
  private pendingBooms: { t: number; pos: THREE.Vector3; r: number; dmg: number; src?: Destructible }[] = [];

  // ------------------------------------------------------------------ init

  async init(container: HTMLElement, loading: LoadingScreen) {
    const step = async (label: string, f: number) => {
      loading.setStep(label, f);
      await nextFrame();
    };
    await step('Warming up the renderer…', 0.1);
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.cam = new ThirdPersonCamera(innerWidth / innerHeight);
    this.scene.add(this.cam.camera);
    this.post = new PostFX(this.renderer, this.scene, this.cam.camera);
    this.screen = new ScreenEffects(this.post.uniforms);
    this.input = new Input(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      reportError('WebGL context lost', 'GPU reset');
      this.pause('Graphics device was reset — resume to continue');
    });

    await step('Sculpting Trotter…', 0.25);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -34;
    this.sun.shadow.camera.right = 34;
    this.sun.shadow.camera.top = 34;
    this.sun.shadow.camera.bottom = -34;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target, this.hemi);
    this.player = new PlayerController({
      onJump: () => this.audio.jump(),
      onLand: (s) => this.onLand(s),
      onStep: () => this.onStep(),
      onHurt: (a) => this.onPlayerHurt(a),
      onDeath: () => this.onPlayerDeath(),
      onDodge: () => {
        this.audio.dodge();
        this.vfx.dust(this.player.pos, 6, 0.4);
      },
      onShieldBreak: () => {
        this.audio.shieldBreak();
        this.hud.banner('SHIELD POPPED!', '', 1.2);
      },
    });
    this.scene.add(this.player.model.root);
    this.weapons = new WeaponSystem(this.player.model, this.player.anim, {
      onFire: (d, m, dir, r) => this.onFire(d.id, m, dir, r),
      onReloadStart: () => this.audio.reloadStart(),
      onReloadEnd: () => {
        this.audio.reloadEnd();
        if (Math.random() < 0.35) this.player.anim.setExpression('annoyed', 1.1);
      },
      onEmpty: () => this.audio.dryFire(),
      onSwitch: (d) => {
        this.audio.weaponSwitch();
        this.hud.banner(d.name.toUpperCase(), d.desc, 1.4);
      },
    });

    await step('Loading explosions…', 0.45);
    this.particles = new ParticleSystem(9000);
    this.scene.add(this.particles.points);
    this.frags = new FragmentSystem(140);
    this.scene.add(this.frags.root);
    this.vfx = new VFXManager(this.particles, this.frags, this.cam.camera);
    this.scene.add(this.vfx.root);
    this.combat = new Combat(this.world, this.vfx, {
      onHit: (t, info, dealt) => this.onHit(t, info, dealt),
      hurtPlayer: (a, from, k) => this.hurtPlayer(a, from, k),
      sound: (n, p) => this.combatSound(n, p),
      shake: (a, p) => this.shakeAt(a, p),
    });
    this.scene.add(this.combat.root);
    this.enemies = new EnemyManager({ onKilled: (e, info) => this.onEnemyKilled(e, info), onArmorBreak: (e, p) => this.onArmorBreak(e, p) });
    this.scene.add(this.enemies.root);
    this.props = new DestructibleManager(this.world);
    this.props.onBreak = (p, info) => this.onPropBroken(p, info);
    this.scene.add(this.props.root);
    this.pickups = new PickupManager(this.world);
    this.scene.add(this.pickups.root);
    this.dust = new AmbientDust(700);
    this.scene.add(this.dust.points);
    this.combat.targets = () => this.damageables();
    this.director = new LevelDirector({
      spawnEnemy: (t, x, z, g, drop) => this.spawnEnemy(t, x, z, g, drop),
      aliveInGroup: (g) => this.enemies.aliveIn(g),
      countTag: (tag) => this.props.list.filter((p) => p.alive && p.tag === tag).length,
      nearestTag: (tag, from) => {
        let best: THREE.Vector3 | null = null;
        let bd = Infinity;
        for (const p of this.props.list) if (p.alive && p.tag === tag) {
          const d = p.position.distanceTo(from);
          if (d < bd) { bd = d; best = p.position; }
        }
        return best;
      },
      openGate: (id) => this.openGate(id),
      objectiveChanged: (text, i) => {
        this.hud.setObjective(text, true);
        if (i > 0) this.hud.banner('NEW OBJECTIVE', text, 2.4);
      },
      objectiveDone: () => {
        this.audio.objective();
        this.session.bonus(250);
        this.player.anim.celebrate();
        this.audio.pigYay();
      },
      waveStarted: (w, total) => {
        this.hud.banner(total > 1 ? `WAVE ${w}` : 'HERE THEY COME!', w === total && total > 1 ? 'Final wave!' : '', 1.6);
        this.audio.wave();
      },
      checkpoint: (x, z) => {
        this.checkpoint = { x, z, yaw: this.cam.yaw };
      },
      startBoss: () => this.boss?.wake(this.bossCtx()),
      bossDefeated: () => !!this.boss?.defeated,
      levelComplete: () => this.beginOutro(),
    });

    await step('Planting the village…', 0.65);
    this.audio.init();
    this.buildUI();
    this.bindInput();
    this.applyQuality(settings.quality);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.applyUpgrades();
    this.loadoutChanged();
    this.buildMenuScene();

    await step('Compiling shaders…', 0.85);
    // Pre-compile materials for every enemy, prop and weapon so the first fight never hitches
    const warm: THREE.Object3D[] = [];
    for (const t of ['chicken', 'toast', 'carrot', 'bubble', 'boar'] as const) {
      const e = this.enemies.spawn(t, 0, -500, 0);
      warm.push(e.rig.root);
    }
    for (const t of ['crate', 'barrel', 'glass', 'crystal', 'generator', 'gumball'] as const) this.props.spawn({ type: t, x: 0, z: -500, y: -50 });
    try {
      const r = this.renderer as THREE.WebGLRenderer & { compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<void> };
      if (r.compileAsync) await r.compileAsync(this.scene, this.cam.camera);
      this.post.render(0);
    } catch (err) {
      console.warn('[OINK OPS] shader precompile skipped', err);
    }
    this.enemies.clear();
    this.props.clear();
    this.world.clear();
    this.buildMenuScene();
    void warm;

    await step('Ready!', 1);
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private buildUI() {
    this.hud = new HUD();
    this.hud.onPause = () => this.pause();
    this.hud.onFullscreen = () => this.toggleFullscreen();
    this.ui = new UIManager(this.audio);
    this.ui.register('menu', new MainMenu(this));
    this.ui.register('worlds', new WorldSelect(this));
    this.ui.register('upgrades', new UpgradesScreen(this));
    this.ui.register('customize', new CustomizeScreen(this));
    this.ui.register('settings', new SettingsScreen(this));
    this.ui.register('pause', new PauseScreen(this));
    this.ui.register('results', new ResultsScreen(this));
    this.ui.register('credits', new CreditsScreen(this));
    this.ui.register('ending', new EndingScreen(this));
  }

  private bindInput() {
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'playing' && !this.autopilot.enabled) this.pause();
    };
    window.addEventListener('blur', () => this.pause('Paused — window lost focus'));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause('Paused — window lost focus');
    });
  }

  enter() {
    this.audio.resume();
    this.toMenu();
  }

  // ------------------------------------------------------------------ quality / settings

  applyQuality(q: Quality) {
    this.profile = QUALITY_PROFILES[q];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.profile.maxPixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = this.profile.shadows;
    this.sun.castShadow = this.profile.shadows;
    if (this.sun.shadow.mapSize.x !== this.profile.shadowMap) {
      this.sun.shadow.mapSize.set(this.profile.shadowMap, this.profile.shadowMap);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.post.configure({ maxPixelRatio: this.profile.maxPixelRatio, bloom: this.profile.bloom, bloomScale: this.profile.bloomScale, particles: 0, fragments: 0, dust: 0, post: true, msaa: this.profile.msaa } as never, this.theme.bloom);
    this.particles.setCap(this.profile.particles);
    this.frags.maxActive = this.profile.fragments;
    this.post.setSize(innerWidth, innerHeight, this.profile.bloomScale);
  }

  settingsChanged() {
    this.audio.setVolumes(settings.master, settings.music, settings.sfx);
    this.cam.sensitivity = settings.sensitivity;
    this.cam.motion = settings.motion;
    this.screen.motion = settings.motion;
    if (QUALITY_PROFILES[settings.quality] !== this.profile) this.applyQuality(settings.quality);
  }

  loadoutChanged() {
    applyLoadout(this.player.model, save.loadout);
    this.weapons.setSkin(save.loadout.skin);
  }

  upgradesChanged() {
    this.applyUpgrades();
  }

  private applyUpgrades() {
    const u = save.upgrades;
    this.player.stats.maxHealth = 100 + 20 * (u.health ?? 0);
    this.player.stats.damageMult = 1 + 0.12 * (u.damage ?? 0);
    this.weapons.magBonus = 6 * (u.mag ?? 0);
    this.weapons.reloadMult = 1 - 0.12 * (u.reload ?? 0);
    this.pickups.magnetRadius = 3.5 + 1.2 * (u.magnet ?? 0);
    for (const w of save.weapons) if ((WEAPON_ORDER as string[]).includes(w)) this.weapons.unlock(w as WeaponId);
  }

  private resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.cam.camera.aspect = innerWidth / innerHeight;
    this.cam.camera.updateProjectionMatrix();
    this.post.setSize(innerWidth, innerHeight, this.profile?.bloomScale ?? 1);
  }

  toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
      else document.documentElement.requestFullscreen?.().catch(() => this.toast('Fullscreen unavailable'));
    } catch {
      this.toast('Fullscreen unavailable');
    }
  }

  toast(msg: string) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout((t as HTMLElement & { _h?: number })._h);
    (t as HTMLElement & { _h?: number })._h = window.setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ------------------------------------------------------------------ scenes

  private clearLevel() {
    this.enemies.clear();
    this.props.clear();
    this.pickups.clear();
    this.combat.clear();
    this.frags.clear();
    this.particles.clear();
    this.vfx.clear();
    this.boss?.dispose();
    this.boss = null;
    this.gates.clear();
    this.pendingBooms = [];
    if (this.portal) this.scene.remove(this.portal);
    this.portal = null;
    if (this.level) {
      this.scene.remove(this.level.root);
      this.level.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
      });
    }
    this.level = null;
    this.sky?.dispose(this.scene);
    this.sky = null;
    this.hud.bossBar(false, 0, '');
  }

  private applyTheme(t: ThemeDef, center = new THREE.Vector3()) {
    this.theme = t;
    this.sky = new Sky(t.sky, center);
    this.sky.addTo(this.scene);
    this.scene.fog = new THREE.Fog(t.fog.color, t.fog.near, t.fog.far);
    this.scene.background = new THREE.Color(t.sky.horizon);
    this.sun.color.set(t.sun.color);
    this.sun.intensity = t.sun.intensity;
    this.hemi.color.set(t.hemi.sky);
    this.hemi.groundColor.set(t.hemi.ground);
    this.hemi.intensity = t.hemi.intensity;
    this.renderer.toneMappingExposure = t.exposure;
    this.post.setBloom(t.bloom);
    this.dust.setStyle(t.ambient.color, t.ambient.size * 1.6, t.ambient.kind === 'embers' ? 0.9 : 0.7);
  }

  /** The title-screen diorama: a little grassy hill with Trotter on it. */
  private buildMenuScene() {
    this.clearLevel();
    const b = new LevelBuilder(this.world, THEMES.menu, 22, 3);
    b.ground();
    house(b, -9, -7, 0.5, 6, 5, 0);
    windmill(b, 10, -12, -0.4);
    for (const [x, z, s] of [[-14, 4, 1.2], [14, 2, 1.1], [-4, -16, 1.3], [6, -20, 1.4], [18, -6, 1]]) tree(b, x, z, s);
    for (const [x, z] of [[-18, -4], [16, 10], [-12, 12]]) pine(b, x, z, 1.2);
    flowers(b, 2, 3, 16, 3);
    flowers(b, -5, 6, 10, 2);
    bush(b, 5, 6, 1);
    fenceRow(b, -6, 9, 6, 9);
    b.platform(0, 0, 3.4, 3.4, 0.5, 0x8a5a36, 0x6ac04a);
    this.level = b.finalize();
    this.scene.add(this.level.root);
    this.applyTheme(THEMES.menu);
    this.player.spawn(0, 0.5, 0, 0);
    this.player.model.root.rotation.y = 0.35;
    this.player.alive = true;
  }

  /** Builds a world from its definition and populates it. */
  private buildWorld(i: number) {
    this.clearLevel();
    const def = this.worlds[i];
    const b = new LevelBuilder(this.world, THEMES[def.theme], def.size, 100 + i);
    def.build(b);
    const data = b.finalize();
    this.level = data;
    this.scene.add(data.root);
    this.applyTheme(THEMES[def.theme]);
    for (const p of data.props) this.props.spawn(p);
    for (const [x, y, z] of data.coins) this.pickups.addCoin(x, y, z);
    for (const s of data.specials) {
      if (s.id && save.found.includes(s.id)) continue;
      this.pickups.addSpecial(s.type, s.x, s.y, s.z, s.id);
    }
    for (const e of data.enemies) this.spawnEnemy(e.type, e.x, e.z, 'roam', false, e.y);
    for (const g of data.gates) {
      const p = this.props.spawn({ type: 'barrier', x: g.x, z: g.z, w: g.w, h: g.h, rot: g.rot, tag: `gate:${g.id}` });
      this.gates.set(g.id, p);
    }
    if (data.exit) this.portal = this.buildPortal(data.exit.x, data.exit.z);
    if (data.bossArena) {
      this.boss = new BaconBoss(new THREE.Vector3(data.bossArena.x, 0.5, data.bossArena.z), this.world, this.scene);
      this.boss.tiles = data.arenaTiles.map((t) => ({ box: t.box, mesh: t.mesh, falling: -1, gone: false }));
    }
    this.director.load(data.objectives, data.encounters);
    this.hud.setObjective(this.director.progressText);
  }

  private buildPortal(x: number, z: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.28, 12, 40), new THREE.MeshToonMaterial({ color: 0xffd23f }));
    ring.position.y = 2.1;
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8fd8).multiplyScalar(1.4), transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
    swirl.position.y = 2.1;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb0e0, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.y = 2.1;
    glow.scale.setScalar(6);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.3, 24), new THREE.MeshToonMaterial({ color: 0x8a6aff }));
    base.position.y = 0.15;
    g.add(ring, swirl, glow, base);
    g.userData.swirl = swirl;
    g.userData.glow = glow;
    this.scene.add(g);
    return g;
  }

  // ------------------------------------------------------------------ menu actions

  play() {
    const allDone = this.worlds.every((_w, i) => save.worlds[i]?.completed);
    this.startWorld(allDone ? 0 : Math.min(save.unlocked, this.worlds.length - 1));
  }

  show(name: string) {
    if (name === 'ending') this.state = 'ending';
    this.ui.show(name);
  }

  openSettings(from: string) {
    this.settingsReturn = from;
    this.ui.show('settings');
  }
  closeSettings() {
    this.ui.show(this.settingsReturn);
  }

  customizeView(on: boolean) {
    this.customizing = on;
  }

  resetSave() {
    resetSave();
    this.weapons.owned = new Set(['blaster']);
    this.weapons.equip('blaster');
    this.applyUpgrades();
    this.loadoutChanged();
    this.toast('Save data reset');
  }

  toMenu() {
    this.loadToken++;
    this.input.exitLock();
    document.body.classList.remove('playing');
    this.state = 'menu';
    this.hud.setVisible(false);
    this.cam.cinematic = null;
    this.screen.setDesat(0);
    this.player.anim.setVictory(false);
    this.player.anim.setDead(false);
    this.buildMenuScene();
    this.screen.fade(0, 0.8, '#fff8ef');
    this.music.play('menu', 0.4);
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
    if (this.state !== 'playing') return;
    if (this.autopilot.enabled && reason) return;
    this.prevState = this.state;
    this.state = 'paused';
    this.pausedAt = performance.now();
    this.music.duck(true);
    this.input.exitLock();
    this.ui.show('pause', reason);
  }

  restart() {
    this.startWorld(this.worldIndex);
  }

  respawn() {
    if (this.state === 'paused') {
      this.ui.hideCurrent();
      this.state = 'playing';
      this.music.duck(false);
      this.input.requestLock();
    }
    this.respawnPlayer();
  }

  nextWorld() {
    if (this.worldIndex + 1 < this.worlds.length) this.startWorld(this.worldIndex + 1);
    else this.show('ending');
  }

  async startWorld(i: number) {
    const token = ++this.loadToken;
    this.input.requestLock();
    this.audio.resume();
    this.ui.hideCurrent();
    this.state = 'transition';
    await this.screen.fade(1, 0.45, '#fff8ef');
    if (token !== this.loadToken) return;
    this.worldIndex = i;
    try {
      this.buildWorld(i);
    } catch (err) {
      reportError('World build', err);
    }
    const sp = this.level!.spawn;
    this.player.spawn(sp.x, 0, sp.z, sp.yaw);
    this.player.anim.setVictory(false);
    this.cam.setAngles(sp.yaw, -0.12);
    this.cam.snapTo(this.player.pos);
    this.cam.cinematic = null;
    this.checkpoint = { x: sp.x, z: sp.z, yaw: sp.yaw };
    this.lastSafe.set(sp.x, 0, sp.z);
    this.weapons.resetAmmo();
    this.weapons.equip('blaster');
    this.session.reset();
    this.levelTime = 0;
    this.tutorialStep = i === 0 && !save.tutorialDone ? 0 : 99;
    this.missStreak = 0;
    this.hud.reset();
    this.hud.setVisible(true);
    this.hud.setObjective(this.director.progressText);
    document.body.classList.add('playing');
    this.music.play(this.theme.music, 0.35);
    this.musicBase = 0.35;
    this.state = 'playing';
    this.last = performance.now();
    await this.screen.fade(0, 0.7, '#fff8ef');
    const w = this.worlds[i];
    this.hud.banner(`WORLD ${i + 1}`, `${w.name} — ${w.subtitle}`, 3);
  }

  // ------------------------------------------------------------------ gameplay helpers

  private damageables(): Damageable[] {
    const out: Damageable[] = [];
    for (const e of this.enemies.list) if (e.alive) out.push(e);
    for (const p of this.props.list) if (p.alive && p.type !== 'barrier') out.push(p);
    if (this.boss?.alive && this.boss.active) out.push(this.boss);
    return out;
  }

  private spawnEnemy(type: Enemy['type'], x: number, z: number, group: string, dropIn: boolean, y = 0) {
    const e = this.enemies.spawn(type, x, y, z, group);
    if (dropIn) {
      e.aggro = true;
      e.lastSeen.copy(this.player.pos);
      e.state = 'detect';
      this.vfx.poof(new THREE.Vector3(x, y + 0.6, z), 0xffffff, type === 'boar' ? 2 : 1);
      if (type === 'boar') {
        this.audio.boarRoar(this.pan(x));
        this.hud.banner('BIG BAD BOAR!', 'Shoot off its armor — hit the glowing battery!', 2.8);
        this.cam.shake(0.5);
      }
    }
  }

  private pan(x: number) {
    return clamp((x - this.cam.camera.position.x) / 12, -1, 1);
  }

  private screenPos(p: THREE.Vector3): { x: number; y: number } | null {
    _v.copy(p).project(this.cam.camera);
    if (_v.z > 1) return null;
    return { x: ((_v.x + 1) / 2) * innerWidth, y: ((1 - _v.y) / 2) * innerHeight };
  }

  private popupAt(p: THREE.Vector3, text: string, cls = '') {
    const s = this.screenPos(p);
    if (s) this.hud.popup(text, s.x + rand(-12, 12), s.y, cls);
  }

  hitStop(d: number) {
    this.hitStopT = Math.max(this.hitStopT, d);
  }
  slowMo(d: number, s: number) {
    this.slowMoT = Math.max(this.slowMoT, d);
    this.slowMoScale = s;
  }
  private shakeAt(a: number, p: THREE.Vector3) {
    const d = p.distanceTo(this.player.pos);
    this.cam.shake(a * clamp(1.4 - d / 25, 0, 1));
  }

  private openGate(id: string) {
    const g = this.gates.get(id);
    if (!g || !g.alive) return;
    this.vfx.explosion(g.position.clone().setY(1.8), 3, 0x6affe0);
    this.vfx.sparks(g.position.clone().setY(1.8), 0x6affe0, 40, 8);
    this.props.dissolve(g);
    this.audio.gateOpen();
    this.hud.banner('GATE OPEN!', '', 1.6);
  }

  private bossCtx(): BossContext {
    return {
      world: this.world,
      combat: this.combat,
      vfx: this.vfx,
      playerPos: this.player.pos,
      playerGrounded: this.player.grounded,
      damagePlayer: (a, from, k) => this.hurtPlayer(a, from, k),
      spawnMinion: (t, x, z) => this.spawnEnemy(t, x, z, 'boss', true, 0.5),
      sfx: (n, p) => {
        const pan = this.pan(p.x);
        if (n === 'roar') this.audio.boarRoar(pan);
        else if (n === 'clank') this.audio.clank(pan);
        else if (n === 'slam') this.audio.slam();
        else if (n === 'missile') this.audio.carrotCannon();
        else if (n === 'laser') this.audio.laser();
        else if (n === 'phase') {
          this.audio.explosion(0);
          this.music.impact();
          this.music.tension(2);
        } else if (n === 'collapse') this.audio.breakSound('stone', pan);
        else if (n === 'explode') this.audio.explosion(pan);
        else if (n === 'core') this.audio.breakSound('crystal', pan);
        else this.audio.enemyHit(pan);
      },
      shake: (a) => this.cam.shake(a),
      slowMo: (d, s) => this.slowMo(d, s),
      setBar: (v, f, l) => this.hud.bossBar(v, f, l),
      announce: (t, s) => this.hud.banner(t, s, 3),
      music: (i) => {
        if (i <= 0) this.music.stop(2);
        else this.music.play('boss', i);
      },
      cinematic: (pos, look, fov) => {
        this.cam.cinematic = pos && look ? { pos, look, fov: fov ?? 55 } : null;
      },
      coins: (p, n) => this.pickups.burst(p, n),
      onDefeated: () => {
        this.session.bonus(10000);
        this.hud.banner('BACON MACHINE DESTROYED!', '+10,000', 3);
        this.audio.fanfare();
      },
    };
  }

  private aiCtx(): AIContext {
    return {
      time: this.time,
      world: this.world,
      playerPos: this.player.pos,
      playerAlive: this.player.alive,
      playerGrounded: this.player.grounded,
      playerRadius: this.player.radius * this.player.scale,
      enemies: this.enemies.list,
      vfx: this.vfx,
      damagePlayer: (a, from, k) => this.hurtPlayer(a, from, k),
      shoot: (kind, from, target, speed) => this.combat.enemyShoot(kind, from, target, speed, kind === 'toast' ? 9 : 6),
      shockwave: (p, r, d) => this.combat.shockwave(p, r, d),
      sfx: (s, p, e) => this.enemySound(s, p, e),
      shake: (a) => this.cam.shake(a),
    };
  }

  private enemySound(s: EnemySound, p: THREE.Vector3, e: Enemy) {
    const pan = this.pan(p.x);
    if (s === 'alert') {
      this.audio.alert(pan);
      if (e.type === 'chicken') this.audio.chickenBawk(pan);
      else if (e.type === 'carrot') this.audio.carrotSqueak(pan);
      else if (e.type === 'boar') this.audio.boarGrunt(pan);
    } else if (s === 'attack') {
      if (e.type === 'chicken') this.audio.chickenBawk(pan);
      else if (e.type === 'carrot') this.audio.carrotSqueak(pan);
      else if (e.type === 'boar') this.audio.boarGrunt(pan);
    } else if (s === 'charge') this.audio.boarRoar(pan);
    else if (s === 'toastPop') this.audio.toasterDing(pan);
    else if (s === 'bubble' || s === 'shield') this.audio.bubbleBlub(pan);
    else if (s === 'slam') this.audio.slam();
    else if (s === 'bonk') this.audio.clank(pan);
  }

  private combatSound(n: 'explosion' | 'impact' | 'bounce' | 'pop' | 'splat' | 'wave' | 'shockwave', p: THREE.Vector3) {
    const pan = this.pan(p.x);
    if (n === 'explosion') this.audio.explosion(pan);
    else if (n === 'impact') this.audio.impact(pan);
    else if (n === 'bounce') this.audio.bounce();
    else if (n === 'pop') this.audio.pop();
    else if (n === 'splat') this.audio.breakSound('squish', pan);
    else if (n === 'wave') this.audio.pulseShot();
    else if (n === 'shockwave') this.audio.slam();
  }

  // ------------------------------------------------------------------ event handlers

  private onFire(id: WeaponId, muzzle: THREE.Vector3, dir: THREE.Vector3, r: { hit: boolean; weak: boolean }) {
    const d = WEAPONS[id];
    this.session.shots++;
    if (r.hit) {
      this.session.hits++;
      this.missStreak = 0;
    } else if (d.kind === 'hitscan' && !this.aimTarget) {
      this.missStreak++;
      if (this.missStreak === 12) {
        this.player.anim.showEmote('question', 1.4);
        this.player.anim.setExpression('confused', 1.4);
      }
    }
    this.vfx.muzzle(muzzle, dir, d.color, id === 'blaster' ? 1 : 1.8);
    const pan = 0.2;
    if (id === 'blaster') this.audio.blaster(pan);
    else if (id === 'carrot') this.audio.carrotCannon();
    else if (id === 'egg') this.audio.eggLaunch();
    else if (id === 'bubble') this.audio.bubbleShoot();
    else this.audio.pulseShot();
    const k = d.recoil;
    this.cam.kick(0.006 * k, rand(-0.003, 0.003) * k, 0.4 * k);
    this.cam.shake(d.shake);
    if (id === 'blaster') {
      _right.set(1, 0, 0).applyQuaternion(this.player.model.root.quaternion);
      this.vfx.shell(muzzle.clone().addScaledVector(dir, -0.5), _right, this.player.pos.y);
    }
  }

  private onHit(t: Damageable, info: DamageInfo, dealt: number) {
    if (info.source === 'player' || info.source === 'explosion') {
      if (t.kind === 'enemy' || t.kind === 'boss') {
        const crit = info.weak;
        if (info.source === 'player') this.hud.hitMarker(crit);
        this.vfx.hit(info.point, crit ? 0xffe040 : 0xffffff, crit);
        this.audio.enemyHit(this.pan(info.point.x), crit);
        if (dealt > 0.5) this.popupAt(info.point, crit ? `${Math.round(dealt)}!` : String(Math.round(dealt)), crit ? 'crit' : 'dmg');
        if (crit) this.hitStop(0.035);
      } else if (t.kind === 'prop' && info.source === 'player') {
        this.vfx.impact(info.point, info.dir.clone().negate(), 0xffe0b0, 0.8);
      }
    }
  }

  private onEnemyKilled(e: Enemy, info: DamageInfo) {
    const ev = this.session.kill(e.def.score, info.weak);
    const pos = e.chest.clone();
    this.popupAt(pos, `+${ev.points}`, ev.label ? 'big' : '');
    if (ev.label) setTimeout(() => this.popupAt(pos.clone().setY(pos.y + 0.8), ev.label, 'crit'), 90);
    if (ev.tierUp) this.audio.combo(this.session.mult);
    const coins = Math.round(rand(e.def.coins[0], e.def.coins[1]));
    setTimeout(() => this.pickups.burst(pos, coins), 450);
    this.audio.enemyDie(this.pan(pos.x));
    this.hitStop(e.isBoss ? 0.2 : 0.05);
    this.cam.shake(e.isBoss ? 0.9 : 0.12);
    // fragments: robots → metal bits, carrots → orange bits, boar → lots
    const frag: FragType = e.type === 'carrot' ? 'bits' : 'metal';
    const col = e.type === 'carrot' ? 0xff8a2a : e.type === 'boar' ? 0x7a4a3a : e.def.color;
    this.spawnFrags(frag, pos, e.isBoss ? 30 : 8, col, e.isBoss ? 2 : 1, e.pos.y);
    if (e.isBoss) {
      this.slowMo(1.6, 0.3);
      this.vfx.explosion(pos, 4, 0xffa040);
      this.audio.explosion(0);
      this.player.anim.celebrate();
      this.audio.pigYay();
    } else if (this.session.combo >= 3 && this.session.combo % 3 === 0) {
      this.player.anim.showEmote('heart', 1);
    }
  }

  private onArmorBreak(e: Enemy, p: THREE.Vector3) {
    this.vfx.explosion(p, 1.6, 0xc0c8d8);
    this.audio.clank(this.pan(p.x));
    this.spawnFrags('metal', p, 6, 0x8a93a8, 1.4, e.pos.y);
    this.popupAt(p, 'ARMOR BROKEN!', 'big');
    this.session.bonus(150);
  }

  private spawnFrags(type: FragType, pos: THREE.Vector3, n: number, color: number, scale: number, floor: number) {
    for (let i = 0; i < n; i++) {
      const s = rand(0.5, 1) * scale;
      this.frags.spawn(type, _v.set(pos.x + rand(-0.4, 0.4), pos.y + rand(-0.3, 0.3), pos.z + rand(-0.4, 0.4)), new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)), _v2.set(s, s, s), new THREE.Vector3(rand(-5, 5), rand(3, 9), rand(-5, 5)), new THREE.Vector3(rand(-12, 12), rand(-12, 12), rand(-12, 12)), color, rand(1.4, 2.4), floor);
    }
  }

  private onPropBroken(p: Destructible, info: DamageInfo) {
    const def = p.def;
    const center = p.position.clone().setY(p.position.y + p.size.y / 2);
    const chained = info.source === 'explosion';
    const ev = this.session.prop(def.score, chained);
    if (ev.points > 0) this.popupAt(center, `+${ev.points}`, chained ? 'big' : '');
    if (ev.label) this.popupAt(center.clone().setY(center.y + 0.8), ev.label, 'crit');
    this.audio.breakSound(def.sound, this.pan(center.x));
    // debris
    const n = Math.round(def.fragCount * (this.profile.fragments < 150 ? 0.6 : 1));
    const scale = p.type === 'glass' ? 1.4 : p.type === 'crackedWall' ? 1.8 : 1;
    for (let i = 0; i < n; i++) {
      const col = def.colors[i % def.colors.length];
      const s = rand(0.45, 1) * scale;
      _v.set(center.x + rand(-p.size.x, p.size.x) * 0.4, center.y + rand(-p.size.y, p.size.y) * 0.4, center.z + rand(-p.size.z, p.size.z) * 0.4);
      const vel = new THREE.Vector3().subVectors(_v, info.point).normalize().multiplyScalar(rand(3, 8)).addScaledVector(info.dir, 3);
      vel.y += rand(2, 6);
      this.frags.spawn(def.frag, _v, new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)), _v2.set(s, s * (def.frag === 'glass' ? 1 : rand(0.8, 1.2)), s), vel, new THREE.Vector3(rand(-10, 10), rand(-10, 10), rand(-10, 10)), col, rand(1.4, 2.6), p.position.y);
    }
    this.vfx.puffs.cloud(center, p.type === 'crackedWall' ? 10 : 5, Math.max(0.3, p.size.y * 0.3), 3, def.frag === 'glass' || def.frag === 'crystal' ? 0xf4faff : 0xefe4d4, 0.6, 0.6);
    if (def.frag === 'glass' || def.frag === 'crystal') this.vfx.sparks(center, def.colors[0], 20, 6, 0.1, 0.5);
    const coins = Math.round(rand(def.coins[0], def.coins[1]));
    if (coins > 0) this.pickups.burst(center, coins);
    if (def.explode) {
      // short fuse so explosions ripple through neighbours
      this.pendingBooms.push({ t: chained ? 0.12 : 0.05, pos: center, r: def.explode.radius, dmg: def.explode.damage, src: p });
    }
    if (p.type === 'generator') {
      this.hud.banner('GENERATOR DOWN!', '', 1.4);
      this.cam.shake(0.3);
    }
    if (p.type === 'crackedWall') {
      this.hud.banner('SECRET FOUND!', 'Something shiny is hidden here…', 2);
      this.audio.special();
    }
    this.cam.shake(Math.min(0.25, 0.05 + p.size.y * 0.05));
  }

  private onPickup(p: Pickup) {
    const info = PICKUP_INFO[p.type];
    this.vfx.pickupSparkle(p.pos, info.color);
    const pos = p.pos.clone();
    if (p.id) {
      this.session.found.push(p.id);
    }
    switch (p.type) {
      case 'token':
        this.session.coins += 25;
        this.session.bonus(250);
        this.popupAt(pos, '+25 🪙', 'coin');
        this.audio.special();
        break;
      case 'carrot':
        this.session.coins += 60;
        this.session.bonus(500);
        this.hud.banner('GOLDEN CARROT!', `${this.session.found.filter((f) => /w\dc/.test(f)).length} found this run`, 1.8);
        this.audio.special();
        this.player.anim.celebrate();
        break;
      case 'star':
        this.session.coins += 150;
        this.session.bonus(2000);
        this.hud.banner('★ SECRET STAR! ★', 'Stars unlock special cosmetics', 2.6);
        this.audio.fanfare();
        this.player.anim.celebrate();
        break;
      case 'health':
        this.player.heal(45);
        this.audio.heal();
        this.popupAt(pos, '+45 HP', 'coin');
        break;
      case 'ammo':
        this.weapons.addAmmo();
        this.audio.reloadEnd();
        this.popupAt(pos, 'AMMO!', 'coin');
        break;
      default: {
        const id = p.type as PowerUpId;
        this.player.applyPowerUp(id);
        this.audio.powerup();
        this.hud.banner(info.name.toUpperCase() + '!', { golden: 'Invincible!', turbo: 'Super speed!', rage: 'Rapid fire!', shield: 'Bubble shield!', giant: 'Double damage, double size!' }[id], 1.8);
        this.player.anim.setExpression('happy', 1.5);
      }
    }
  }

  private hurtPlayer(amount: number, from: THREE.Vector3, knock: number) {
    const dealt = this.player.damage(amount, from);
    if (dealt > 0 && knock > 0) {
      _v.subVectors(this.player.pos, from).setY(0).normalize();
      this.player.vel.addScaledVector(_v, knock * 0.6);
      this.player.vel.y += knock * 0.25;
    }
    if (dealt > 0) {
      const ang = Math.atan2(from.x - this.player.pos.x, from.z - this.player.pos.z) - this.cam.yaw;
      this.hud.hurt(Math.PI - ang, dealt);
    }
  }

  private onPlayerHurt(amount: number) {
    this.session.hurt(amount);
    this.audio.pigHurt();
    this.cam.shake(0.25 + amount * 0.01);
    this.screen.hurt();
    this.hitStop(0.04);
  }

  private onPlayerDeath() {
    this.session.deaths++;
    this.state = 'dead';
    this.deadT = 0;
    this.audio.sadTrombone();
    this.slowMo(1.2, 0.3);
    this.screen.setDesat(0.6);
    this.hud.banner('OOF!', 'Trotter needs a nap…', 2.2);
    this.music.duck(true);
  }

  private respawnPlayer() {
    const c = this.checkpoint;
    this.world.groundAt(c.x, c.z, 50, { y: 0, box: null });
    this.player.spawn(c.x, 0.2, c.z, c.yaw);
    this.player.pos.y = Math.max(0, this.world.groundAt(c.x, c.z, 20).y);
    this.cam.setAngles(c.yaw, -0.12);
    this.cam.snapTo(this.player.pos);
    this.screen.setDesat(0);
    this.music.duck(false);
    this.vfx.poof(this.player.pos.clone().setY(this.player.pos.y + 0.8), 0xffc0d8, 1.2);
    this.state = 'playing';
    // enemies forget the player briefly (fair restart)
    for (const e of this.enemies.list) if (e.alive && e.pos.distanceTo(this.player.pos) < 10) e.pos.addScaledVector(_v.subVectors(e.pos, this.player.pos).setY(0).normalize(), 4);
  }

  private onLand(speed: number) {
    this.audio.land(speed);
    if (speed > 6) {
      this.vfx.dust(this.player.pos, 8, 0.4);
      this.cam.shake(Math.min(0.3, speed * 0.015));
    }
  }

  private onStep() {
    const surf = this.theme.id === 'city' || this.theme.id === 'fortress' ? 'stone' : this.theme.id === 'candy' ? 'candy' : 'grass';
    this.audio.footstep(surf);
    if (this.player.sprinting) this.vfx.puffs.emit(this.player.pos.x, this.player.pos.y + 0.1, this.player.pos.z, 0, 0.5, 0, 0.14, 0.4, 0xe8dcc8, 1.6, 0.2);
  }

  private beginOutro() {
    if (this.state !== 'playing') return;
    this.state = 'outro';
    this.outroT = 0;
    this.input.exitLock();
    this.player.anim.setVictory(true);
    this.audio.fanfare();
    this.music.play('victory', 0.4);
    this.hud.banner('LEVEL CLEAR!', 'Nice work, little pig!', 3);
  }

  private finishWorld() {
    const s = this.session;
    const i = this.worldIndex;
    const def = this.worlds[i];
    const newBest = recordWorld(i, s.score, s.time, s.accuracy, this.worlds.length);
    save.coins += s.coins;
    for (const f of s.found) if (!save.found.includes(f)) save.found.push(f);
    let reward: WeaponId | null = null;
    if (def.reward && !save.weapons.includes(def.reward)) {
      save.weapons.push(def.reward);
      reward = def.reward;
      this.weapons.unlock(def.reward);
    }
    if (i === 0) save.tutorialDone = true;
    persist();
    const results: Results = { world: i, name: def.name, score: s.score, time: s.time, kills: s.kills, accuracy: s.accuracy, bestCombo: s.bestCombo, coins: s.coins, found: s.found, newBest, reward, final: i === this.worlds.length - 1 };
    this.state = 'results';
    document.body.classList.remove('playing');
    this.hud.setVisible(false);
    this.ui.show('results', results);
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
      if (this.frameErrors < 5) reportError('Frame', err);
    }
  };

  private update(rdt: number) {
    this.time += rdt;
    const inp = this.input;
    if (inp.wasPressed('KeyF')) this.toggleFullscreen();
    if ((inp.wasPressed('Escape') || inp.wasPressed('KeyP')) && performance.now() - this.pausedAt > 350) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused' && this.ui.current === 'pause') this.resume();
    }
    switch (this.state) {
      case 'menu':
      case 'results':
      case 'ending':
        this.updateMenu(rdt);
        break;
      case 'playing':
      case 'dead':
      case 'outro':
        this.updateGame(rdt);
        break;
      default:
        break;
    }
    this.screen.update(rdt);
    this.music.update(rdt);
    this.hud?.update(rdt);
    inp.endFrame();
  }

  private updateMenu(dt: number) {
    const t = this.time;
    const p = this.player;
    p.model.root.position.set(0, 0.5, 0);
    const lookYaw = this.customizing ? t * 0.5 : 0.35 + Math.sin(t * 0.4) * 0.25;
    p.model.root.rotation.y = lookYaw;
    p.anim.update({ dt, time: t, speed: 0, sprint: false, grounded: true, vy: 0, aim: 0, crouch: false, aimPitch: 0, aimYaw: 0, strafe: 0 });
    this.weapons.model.update(dt, t);
    const orbit = this.customizing ? { r: 3.4, h: 1.5, a: 0.6 } : { r: 7.5, h: 2.6, a: 0.9 + Math.sin(t * 0.08) * 0.25 };
    const camPos = new THREE.Vector3(Math.sin(orbit.a) * orbit.r - (this.customizing ? 1.2 : -2.8), orbit.h, Math.cos(orbit.a) * orbit.r);
    this.cam.cinematic = { pos: camPos, look: new THREE.Vector3(this.customizing ? -1.1 : 2.4, this.customizing ? 1.1 : 1.6, 0), fov: this.customizing ? 45 : 55 };
    this.cam.update(dt, t, p.pos, { aim: false, sprint: false, grounded: true, vy: 0, scale: 1 }, this.world);
    for (const a of this.level?.animators ?? []) a(t, dt);
    this.sky?.update(t, this.cam.camera.position);
    this.dust.update(t, dt, this.cam.camera.position);
    this.frags.update(dt);
    this.particles.update(dt);
    this.vfx.update(dt);
    this.updateSun();
  }

  private updateSun() {
    const d = this.theme.sky.sunDir;
    const p = this.player.pos;
    this.sun.position.set(p.x + d[0] * 60, p.y + Math.max(0.35, d[1]) * 60, p.z + d[2] * 60);
    this.sun.target.position.copy(p);
  }

  private updateGame(rdt: number) {
    let scale = 1;
    if (this.slowMoT > 0) {
      this.slowMoT -= rdt;
      scale = Math.min(scale, this.slowMoScale);
    }
    if (this.hitStopT > 0) {
      this.hitStopT -= rdt;
      scale = Math.min(scale, 0.1);
    }
    const dt = rdt * scale;
    const t = this.time;
    const inp = this.input;
    const playing = this.state === 'playing';
    const p = this.player;

    // --- input → player
    if (playing && !this.autopilot.enabled) this.cam.look(inp.dx, settings.invertY ? -inp.dy : inp.dy);
    if (playing && (inp.leftPressed || inp.rightPressed) && !inp.locked && !this.autopilot.enabled) inp.requestLock();
    if (this.autopilot.enabled && playing) this.autopilot.think(this, rdt);
    const bot = this.autopilot.enabled ? this.autopilot.control : null;
    const move = bot ? bot.move : inp.axes();
    const aiming = playing && (bot ? bot.aim : inp.right);
    const firing = playing && (bot ? bot.fire : inp.left);
    const pin: PlayerInput = {
      move: playing ? move : { x: 0, y: 0 },
      jump: playing && (bot ? bot.jump : inp.wasPressed('Space')),
      sprint: playing && (bot ? bot.sprint : inp.down('ShiftLeft') || inp.down('ShiftRight')),
      crouch: playing && (inp.down('KeyC') || inp.down('ControlLeft')),
      dodge: playing && (inp.wasPressed('KeyQ') || inp.wasPressed('AltLeft')),
      aim: aiming,
      firing,
    };
    if (playing) {
      if (inp.wasPressed('KeyR')) this.weapons.startReload();
      for (const id of WEAPON_ORDER) if (inp.wasPressed(`Digit${WEAPONS[id].key}`)) this.weapons.equip(id);
      if (inp.wheel !== 0) this.weapons.cycle(inp.wheel > 0 ? 1 : -1);
    }
    p.update(dt, pin, this.cam, this.world);
    this.cam.update(rdt, t, p.pos, { aim: aiming, sprint: p.sprinting, grounded: p.grounded, vy: p.vel.y, scale: p.scale }, this.world);

    // --- aim: what's under the crosshair?
    const aim = this.combat.aim(this.cam.camera.position, this.cam.forward, 150, aiming ? 0.045 : 0.028);
    this.aimPoint.copy(aim.point);
    if (this.aimTarget !== aim.target) {
      this.aimTarget?.setHighlight?.(false);
      aim.target?.setHighlight?.(true);
      this.aimTarget = aim.target;
    }
    this.combat.playerPos.copy(p.pos);
    this.combat.playerGrounded = p.grounded;
    this.combat.playerRadius = p.radius * p.scale;

    // --- weapons
    p.model.root.updateMatrixWorld(true);
    _v.copy(p.pos).setY(p.pos.y + 1.1 * p.scale);
    if (p.alive && playing && !p.anim.isReloading) {
      this.weapons.update(dt, t, firing, bot ? bot.fire : inp.leftPressed, { aimPoint: this.aimPoint, camDir: bot ? bot.dir : this.cam.forward, aiming, fireRateMult: p.fireRateMult, damageMult: p.damageMult, chest: _v.clone() }, this.combat);
    } else this.weapons.update(dt, t, false, false, { aimPoint: this.aimPoint, camDir: this.cam.forward, aiming: false, fireRateMult: 1, damageMult: 1, chest: _v.clone() }, this.combat);

    // --- world simulation
    this.enemies.update(dt, this.aiCtx());
    if (this.boss) this.boss.update(dt, this.bossCtx());
    this.combat.update(dt);
    this.props.update(dt, t);
    for (let i = this.pendingBooms.length - 1; i >= 0; i--) {
      const b = this.pendingBooms[i];
      b.t -= dt;
      if (b.t <= 0) {
        this.pendingBooms.splice(i, 1);
        this.combat.explode(b.pos, b.r, b.dmg, 10, 'explosion', b.src);
      }
    }
    this.updatePlatforms(dt);
    for (const a of this.level?.animators ?? []) a(t, dt);
    if (this.portal) {
      const active = this.director.current?.type === 'exit';
      this.portal.userData.swirl.rotation.z += dt * (active ? 4 : 0.5);
      this.portal.userData.glow.material.opacity = active ? 0.7 + Math.sin(t * 5) * 0.2 : 0.15;
      this.portal.userData.swirl.material.opacity = active ? 0.8 : 0.25;
    }
    const got = this.pickups.update(dt, t, p.pos, p.scale);
    if (got.coins > 0) {
      this.session.coins += got.coins;
      this.session.bonus(10 * got.coins);
      this.audio.coin(this.session.combo);
    }
    for (const s of got.specials) this.onPickup(s);
    if (playing) this.director.update(dt, p.pos);
    const bonus = playing ? this.session.update(dt) : null;
    if (bonus) this.hud.banner(bonus.label, `+${bonus.points}`, 1.6);
    if (playing) this.levelTime += dt;

    // pits / falling out of the world
    if (p.alive && p.grounded && !this.world.inPit(p.pos.x, p.pos.z)) this.lastSafe.copy(p.pos);
    if (p.alive && p.pos.y < -5) {
      this.vfx.puffs.cloud(p.pos.clone().setY(0.2), 8, 0.5, 3, this.theme.liquid.color, 0.6);
      this.audio.breakSound('squish', 0);
      p.pos.copy(this.lastSafe);
      p.vel.set(0, 0, 0);
      p.damage(15, null);
      this.hud.banner('SPLASH!', 'Watch your step!', 1.2);
    }

    // death / outro timers
    if (this.state === 'dead') {
      this.deadT += rdt;
      if (this.deadT > 2.6) this.respawnPlayer();
    }
    if (this.state === 'outro') {
      this.outroT += rdt;
      const c = p.pos;
      const a = this.outroT * 0.5 + this.cam.yaw;
      this.cam.cinematic = { pos: new THREE.Vector3(c.x + Math.sin(a) * 5, c.y + 2, c.z + Math.cos(a) * 5), look: new THREE.Vector3(c.x, c.y + 1, c.z), fov: 50 };
      if (this.outroT > 3.4) {
        this.cam.cinematic = null;
        this.screen.fade(1, 0.6, '#fff8ef').then(() => {
          this.finishWorld();
          this.screen.fade(0, 0.6, '#fff8ef');
        });
        this.state = 'transition';
      }
    }

    // tutorial prompts (world 1, first time)
    if (this.tutorialStep < TUTORIAL.length && this.levelTime > TUTORIAL[this.tutorialStep].at) {
      this.hud.hint(TUTORIAL[this.tutorialStep].html, 5.5);
      this.tutorialStep++;
    }

    // effects
    this.frags.update(dt);
    this.particles.update(dt);
    this.vfx.update(dt);
    this.sky?.update(t, this.cam.camera.position);
    this.dust.update(t, dt, this.cam.camera.position);
    this.updateSun();
    if (p.powerups.has('turbo') && Math.hypot(p.vel.x, p.vel.z) > 6 && Math.random() < 0.6) this.vfx.sparks(p.pos.clone().setY(p.pos.y + 0.6), 0x4affb0, 2, 1, 0.12, 0.4, 0);
    if (p.powerups.has('golden') && Math.random() < 0.4) this.vfx.sparks(p.pos.clone().setY(p.pos.y + rand(0.3, 1.6)), 0xffd23f, 1, 1.5, 0.1, 0.6, -2);

    // music: combat intensity
    const engaged = this.enemies.engaged;
    if (!this.boss?.active) this.music.setIntensity(this.musicBase + (engaged > 0 || this.director.inCombat ? 0.45 : 0) + Math.min(0.1, this.session.combo * 0.01));

    this.updateHUD();
    if (playing) this.trackPerformance(rdt);
  }

  private updatePlatforms(dt: number) {
    for (const pl of this.level?.platforms ?? []) {
      const path = pl.path;
      let total = 0;
      for (let i = 0; i < path.length; i++) total += path[i].distanceTo(path[(i + 1) % path.length]);
      pl.t = (pl.t + (dt * pl.speed) / total) % 1;
      let d = pl.t * total;
      let pos = path[0];
      for (let i = 0; i < path.length; i++) {
        const a = path[i], b = path[(i + 1) % path.length];
        const seg = a.distanceTo(b);
        if (d <= seg) {
          const k = seg > 0 ? d / seg : 0;
          const s = k * k * (3 - 2 * k);
          pos = new THREE.Vector3().lerpVectors(a, b, s);
          break;
        }
        d -= seg;
      }
      const prev = pl.mesh.position.clone();
      pl.mesh.position.copy(pos);
      pl.box.delta!.subVectors(pos, prev);
      pl.box.min.set(pos.x - pl.size.x / 2, pos.y - 0.3, pos.z - pl.size.z / 2);
      pl.box.max.set(pos.x + pl.size.x / 2, pos.y + 0.4, pos.z + pl.size.z / 2);
    }
  }

  private updateHUD() {
    const p = this.player;
    const s = this.session;
    const h = this.hud;
    h.setHealth(p.health, p.stats.maxHealth, p.shieldHP);
    h.setScore(s.score);
    h.setCoins(s.coins);
    h.setCombo(s.mult, s.combo, s.comboTimer / COMBO_WINDOW);
    h.setPowerups([...p.powerups.entries()].map(([id, tt]) => [id, tt, POWERUP_DURATION[id]]));
    const w = this.weapons;
    const a = w.ammo[w.current];
    h.setWeapon(w.def.name, a.mag, w.magSize(), w.def.reserve === null ? null : a.reserve, w.current, w.owned, w.reloadProgress);
    const spread = (this.cam.aimW > 0.5 ? w.def.aimSpread : w.def.hipSpread) * 600 + Math.hypot(p.vel.x, p.vel.z) * 0.8 + (p.grounded ? 0 : 8);
    h.setCrosshair(spread, !!this.aimTarget && this.aimTarget.kind !== 'prop', this.state === 'playing' && !this.cam.cinematic);
    const tgt = this.aimTarget as unknown as { kind?: string; def?: { name: string }; hp?: number; maxHp?: number } | null;
    h.setTarget(tgt && tgt.kind === 'enemy' && tgt.def ? tgt.def.name : null, tgt?.hp !== undefined && tgt.maxHp ? tgt.hp / tgt.maxHp : 0);
    if (this.director.progressText) h.setObjective(this.director.progressText);
    // objective marker (clamped to screen edges)
    if (this.director.markerActive && this.state === 'playing') {
      const m = this.director.marker;
      _v.copy(m).project(this.cam.camera);
      const behind = _v.z > 1;
      let x = ((_v.x + 1) / 2) * innerWidth;
      let y = ((1 - _v.y) / 2) * innerHeight;
      if (behind) {
        x = innerWidth - x;
        y = innerHeight - 60;
      }
      const pad = 60;
      x = clamp(x, pad, innerWidth - pad);
      y = clamp(y, pad + 40, innerHeight - pad);
      h.setMarker(true, x, y, m.distanceTo(p.pos));
    } else h.setMarker(false);
    h.showAimNote(this.state === 'playing' && !this.input.locked && !this.autopilot.enabled);
  }

  private trackPerformance(rdt: number) {
    if (!settings.autoQuality || this.simSteps > 1) return;
    this.fps.acc += rdt;
    this.fps.n++;
    this.fps.win += rdt;
    if (this.fps.win < 6) return;
    const fps = this.fps.n / this.fps.acc;
    this.fps = { acc: 0, n: 0, win: 0 };
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
    this.particles.setViewport(this.renderer.domElement.height, this.cam.camera.fov);
    this.post.render(rdt);
  }
}
