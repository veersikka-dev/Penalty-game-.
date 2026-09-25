/**
 * Persistent settings and save data (localStorage). Every read is validated
 * field-by-field against defaults, so corrupted or old saves can never crash
 * the game — bad values are simply replaced.
 */
export type Quality = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityProfile {
  maxPixelRatio: number;
  bloom: boolean;
  bloomScale: number;
  shadows: boolean;
  shadowMap: number;
  particles: number;
  fragments: number;
  msaa: number;
  outlines: boolean;
}

export const QUALITY_PROFILES: Record<Quality, QualityProfile> = {
  low: { maxPixelRatio: 0.8, bloom: false, bloomScale: 0.5, shadows: false, shadowMap: 512, particles: 1800, fragments: 100, msaa: 0, outlines: true },
  medium: { maxPixelRatio: 1, bloom: true, bloomScale: 0.5, shadows: true, shadowMap: 1024, particles: 3500, fragments: 180, msaa: 0, outlines: true },
  high: { maxPixelRatio: 1.5, bloom: true, bloomScale: 0.6, shadows: true, shadowMap: 2048, particles: 6000, fragments: 260, msaa: 4, outlines: true },
  ultra: { maxPixelRatio: 2, bloom: true, bloomScale: 1, shadows: true, shadowMap: 4096, particles: 9000, fragments: 360, msaa: 4, outlines: true },
};
export const QUALITY_ORDER: Quality[] = ['low', 'medium', 'high', 'ultra'];

export interface SettingsData {
  master: number;
  music: number;
  sfx: number;
  sensitivity: number;
  quality: Quality;
  autoQuality: boolean;
  motion: boolean;
  invertY: boolean;
}

export interface WorldRecord {
  completed: boolean;
  bestScore: number;
  bestTime: number;
  bestAccuracy: number;
}

export interface Loadout {
  hat: string;
  glasses: string;
  pack: string;
  armor: string;
  body: string;
  skin: string;
}

export interface SaveData {
  unlocked: number;
  coins: number;
  worlds: Record<number, WorldRecord>;
  found: string[];
  upgrades: Record<string, number>;
  owned: string[];
  loadout: Loadout;
  weapons: string[];
  tutorialDone: boolean;
}

const SETTINGS_KEY = 'oinkops.settings.v1';
const SAVE_KEY = 'oinkops.save.v1';

const num = (v: unknown, d: number, min = -Infinity, max = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const str = (v: unknown, d: string) => (typeof v === 'string' && v.length < 64 ? v : d);
const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length < 64).slice(0, 500) : []);

function readJSON(key: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function detectQuality(): Quality {
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    gpu = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch {
    /* ignore */
  }
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) return 'low';
  if (/RTX|RX ?[67]\d{3}|Apple M\d (Pro|Max|Ultra)|Apple M[3-9]/i.test(gpu)) return 'ultra';
  if (/Apple|Radeon|GeForce|Arc|Iris Xe/i.test(gpu)) return 'high';
  if (/Intel/i.test(gpu)) return 'medium';
  return (navigator.hardwareConcurrency || 4) >= 8 ? 'high' : 'medium';
}

function loadSettings(): SettingsData {
  const r = readJSON(SETTINGS_KEY);
  const q = r.quality;
  return {
    master: num(r.master, 0.8, 0, 1),
    music: num(r.music, 0.65, 0, 1),
    sfx: num(r.sfx, 0.9, 0, 1),
    sensitivity: num(r.sensitivity, 1, 0.2, 3),
    quality: q === 'low' || q === 'medium' || q === 'high' || q === 'ultra' ? q : detectQuality(),
    autoQuality: bool(r.autoQuality, true),
    motion: bool(r.motion, true),
    invertY: bool(r.invertY, false),
  };
}

export const DEFAULT_LOADOUT: Loadout = { hat: 'band', glasses: 'none', pack: 'tactical', armor: 'teal', body: 'pink', skin: 'classic' };

function loadSave(): SaveData {
  const r = readJSON(SAVE_KEY);
  const worlds: Record<number, WorldRecord> = {};
  if (r.worlds && typeof r.worlds === 'object') {
    for (const [k, v] of Object.entries(r.worlds as Record<string, unknown>)) {
      const i = parseInt(k, 10);
      if (!Number.isInteger(i) || i < 0 || i > 20 || !v || typeof v !== 'object') continue;
      const w = v as Record<string, unknown>;
      worlds[i] = { completed: bool(w.completed, false), bestScore: num(w.bestScore, 0, 0), bestTime: num(w.bestTime, 0, 0), bestAccuracy: num(w.bestAccuracy, 0, 0, 1) };
    }
  }
  const upgrades: Record<string, number> = {};
  if (r.upgrades && typeof r.upgrades === 'object') for (const [k, v] of Object.entries(r.upgrades as Record<string, unknown>)) upgrades[k] = num(v, 0, 0, 10);
  const lo = (r.loadout && typeof r.loadout === 'object' ? r.loadout : {}) as Record<string, unknown>;
  return {
    unlocked: num(r.unlocked, 0, 0, 4),
    coins: num(r.coins, 0, 0, 1e9),
    worlds,
    found: strArr(r.found),
    upgrades,
    owned: strArr(r.owned),
    loadout: {
      hat: str(lo.hat, DEFAULT_LOADOUT.hat),
      glasses: str(lo.glasses, DEFAULT_LOADOUT.glasses),
      pack: str(lo.pack, DEFAULT_LOADOUT.pack),
      armor: str(lo.armor, DEFAULT_LOADOUT.armor),
      body: str(lo.body, DEFAULT_LOADOUT.body),
      skin: str(lo.skin, DEFAULT_LOADOUT.skin),
    },
    weapons: strArr(r.weapons).length ? strArr(r.weapons) : ['blaster'],
    tutorialDone: bool(r.tutorialDone, false),
  };
}

export const settings: SettingsData = loadSettings();
export const save: SaveData = loadSave();

export function saveSettings() {
  write(SETTINGS_KEY, settings);
}
export function persist() {
  write(SAVE_KEY, save);
}

export function worldRecord(i: number): WorldRecord {
  return save.worlds[i] ?? { completed: false, bestScore: 0, bestTime: 0, bestAccuracy: 0 };
}

/** Records a finished world. Returns true on a new high score. */
export function recordWorld(i: number, score: number, time: number, accuracy: number, worldCount: number): boolean {
  const r = worldRecord(i);
  const best = score > r.bestScore;
  save.worlds[i] = {
    completed: true,
    bestScore: Math.max(r.bestScore, score),
    bestTime: r.bestTime ? Math.min(r.bestTime, time) : time,
    bestAccuracy: Math.max(r.bestAccuracy, accuracy),
  };
  save.unlocked = Math.min(worldCount - 1, Math.max(save.unlocked, i + 1));
  persist();
  return best;
}

export function resetSave() {
  save.unlocked = 0;
  save.coins = 0;
  save.worlds = {};
  save.found = [];
  save.upgrades = {};
  save.owned = [];
  save.loadout = { ...DEFAULT_LOADOUT };
  save.weapons = ['blaster'];
  save.tutorialDone = false;
  persist();
}
