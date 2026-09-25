import * as THREE from 'three';
import type { ThemeDef, ThemeInstance } from './themes/Theme';
import { Rng, damp } from '../utils/MathUtils';

/**
 * Owns the active theme: streams corridor chunks around the player, and manages fog,
 * background and a fixed set of lights (count never changes, to avoid shader recompiles).
 */
export class Environment {
  theme: ThemeDef | null = null;
  private inst: ThemeInstance | null = null;
  private chunks = new Map<number, THREE.Object3D>();
  private root = new THREE.Group();
  readonly hemi: THREE.HemisphereLight;
  readonly lightA: THREE.PointLight;
  readonly lightB: THREE.PointLight;
  readonly fill: THREE.DirectionalLight;
  readonly bossLight: THREE.PointLight;
  /** 0 = blackout, 1 = full; used by the intro and transitions. */
  lightLevel = 1;
  private pulse = 0;
  private pulseColor = new THREE.Color();
  /** Chunks are not built past this distance (boss arena). */
  stopDistance = Infinity;
  private seed = 1;

  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;

  constructor(private scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    scene.add(this.root);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.4);
    this.fill = new THREE.DirectionalLight(0xffffff, 0.35);
    this.fill.position.set(0.3, 1, 0.4);
    this.lightA = new THREE.PointLight(0xffffff, 50, 60, 2);
    this.lightB = new THREE.PointLight(0xffffff, 80, 90, 2);
    this.bossLight = new THREE.PointLight(0xff4080, 0, 120, 1.6);
    scene.add(this.hemi, this.fill, this.lightA, this.lightB, this.bossLight);
  }

  setTheme(def: ThemeDef, seed = 1) {
    this.clearChunks();
    if (this.inst?.decor) this.scene.remove(this.inst.decor);
    this.inst?.dispose();
    this.theme = def;
    this.seed = seed;
    this.inst = def.create();
    if (this.inst.decor) this.scene.add(this.inst.decor);
    this.scene.fog = new THREE.FogExp2(def.fog.color, def.fog.density);
    this.scene.background = new THREE.Color(def.background);
    this.scene.environmentIntensity = def.envIntensity;
    this.buildEnvMap(def);
    this.hemi.color.set(def.hemi.sky);
    this.hemi.groundColor.set(def.hemi.ground);
    this.lightA.color.set(def.lights.a);
    this.lightB.color.set(def.lights.b);
    this.stopDistance = Infinity;
    this.bossLight.intensity = 0;
  }

  /**
   * Reflection map for the theme: a near-black room with a few neon light bars in the
   * theme's colours. Glossy floors and crystals then reflect coloured light, not a white studio.
   */
  private buildEnvMap(def: ThemeDef) {
    const s = new THREE.Scene();
    const disposables: { dispose(): void }[] = [];
    const room = new THREE.BoxGeometry(60, 30, 60);
    const roomMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.background).multiplyScalar(1.2), side: THREE.BackSide });
    s.add(new THREE.Mesh(room, roomMat));
    disposables.push(room, roomMat);
    const bar = new THREE.BoxGeometry(1, 1, 1);
    disposables.push(bar);
    const cols = [def.accent, def.lights.a, def.lights.b];
    const bars: [number, number, number, number, number, number, number][] = [
      // x, y, z, sx, sy, sz, colour index
      [0, 14, 0, 2, 0.4, 50, 0],
      [-12, 13, 0, 0.6, 0.4, 50, 1],
      [12, 13, 0, 0.6, 0.4, 50, 1],
      [-28, 4, 0, 0.3, 6, 40, 2],
      [28, 4, 0, 0.3, 6, 40, 2],
      [0, 6, -28, 16, 1.2, 0.3, 0],
    ];
    for (const [x, y, z, sx, sy, sz, ci] of bars) {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(cols[ci]).multiplyScalar(ci === 0 ? 3 : 2) });
      disposables.push(m);
      const mesh = new THREE.Mesh(bar, m);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      s.add(mesh);
    }
    const rt = this.pmrem.fromScene(s, 0.035);
    this.envRT?.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    disposables.forEach((d) => d.dispose());
  }

  get floorY() {
    return this.theme?.floorY ?? null;
  }

  setFogDensity(d: number) {
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = d;
  }

  /** Flash the environment lights in a colour (checkpoints, big events). */
  pulseLights(color: THREE.ColorRepresentation, amount = 1) {
    this.pulseColor.set(color);
    this.pulse = Math.max(this.pulse, amount);
  }

  private clearChunks() {
    for (const c of this.chunks.values()) this.root.remove(c);
    this.chunks.clear();
  }

  /** Forces all chunks to rebuild (after a teleport such as a checkpoint restart). */
  reset() {
    this.clearChunks();
  }

  update(t: number, dt: number, cam: THREE.Vector3, playerDist: number) {
    const def = this.theme;
    const inst = this.inst;
    if (!def || !inst) return;
    const L = inst.chunkLength;
    const first = Math.max(0, Math.floor(playerDist / L) - 1);
    const lastByView = Math.floor((playerDist + def.viewDistance) / L) + 1;
    const lastByStop = Math.floor(this.stopDistance / L);
    const last = Math.min(lastByView, lastByStop);
    for (const [i, c] of this.chunks) {
      if (i < first || i > last) {
        this.root.remove(c);
        this.chunks.delete(i);
      }
    }
    for (let i = first; i <= last; i++) {
      if (!this.chunks.has(i)) {
        const c = inst.buildChunk(i, new Rng(this.seed * 7919 + i * 104729));
        this.root.add(c);
        this.chunks.set(i, c);
      }
    }
    for (const c of this.chunks.values()) {
      const anims = c.userData.animators as ((t: number) => void)[] | undefined;
      if (anims) for (const a of anims) a(t);
    }
    inst.update(t, dt, cam);

    this.pulse = damp(this.pulse, 0, 2.5, dt);
    const lv = this.lightLevel;
    for (const e of inst.emissives) {
      const k = e.pulse ? 0.78 + 0.22 * Math.sin(t * e.pulse + (e.phase ?? 0)) : 1;
      e.mat.color.copy(e.base).multiplyScalar(lv * k * (1 + this.pulse * 0.6));
    }
    this.hemi.intensity = def.hemi.intensity * (0.15 + 0.85 * lv);
    this.fill.intensity = 0.35 * lv;
    this.lightA.position.set(cam.x, cam.y + 2.5, cam.z - 12);
    this.lightB.position.set(cam.x, cam.y + 3.5, cam.z - 42);
    this.lightA.intensity = def.lights.ia * lv * (1 + this.pulse * 2);
    this.lightB.intensity = def.lights.ib * lv;
    if (this.pulse > 0.01) {
      this.lightA.color.set(def.lights.a).lerp(this.pulseColor, Math.min(1, this.pulse));
    } else {
      this.lightA.color.set(def.lights.a);
    }
  }
}
