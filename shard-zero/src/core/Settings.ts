/**
 * Persistent settings and progression, stored in localStorage.
 * Every access is guarded: private browsing or blocked storage just means nothing persists.
 */
export type Quality = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityProfile {
  maxPixelRatio: number;
  bloom: boolean;
  bloomScale: number;
  particles: number;
  fragments: number;
  dust: number;
  post: boolean;
  msaa: number;
}

export const QUALITY_PROFILES: Record<Quality, QualityProfile> = {
  low: { maxPixelRatio: 0.8, bloom: false, bloomScale: 0.5, particles: 1800, fragments: 90, dust: 250, post: false, msaa: 0 },
  medium: { maxPixelRatio: 1, bloom: true, bloomScale: 0.5, particles: 3500, fragments: 160, dust: 500, post: true, msaa: 0 },
  high: { maxPixelRatio: 1.5, bloom: true, bloomScale: 0.6, particles: 6000, fragments: 260, dust: 800, post: true, msaa: 4 },
  ultra: { maxPixelRatio: 2, bloom: true, bloomScale: 1, particles: 9000, fragments: 380, dust: 1100, post: true, msaa: 4 },
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
}

export interface LevelRecord {
  completed: boolean;
  bestScore: number;
  bestAccuracy: number;
  bestCombo: number;
  bestTime: number;
}

export interface ProgressData {
  unlocked: number; // highest playable level index
  introSeen: boolean;
  levels: Record<number, LevelRecord>;
}

const SETTINGS_KEY = 'shardzero.settings.v1';
const PROGRESS_KEY = 'shardzero.progress.v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

/** Picks a sensible default quality from the GPU string and device characteristics. */
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

export const settings: SettingsData = read<SettingsData>(SETTINGS_KEY, {
  master: 0.8,
  music: 0.7,
  sfx: 0.9,
  sensitivity: 1,
  quality: detectQuality(),
  autoQuality: true,
  motion: true,
});

export const progress: ProgressData = read<ProgressData>(PROGRESS_KEY, { unlocked: 0, introSeen: false, levels: {} });

export function saveSettings() {
  write(SETTINGS_KEY, settings);
}
export function saveProgress() {
  write(PROGRESS_KEY, progress);
}

export function levelRecord(i: number): LevelRecord {
  return progress.levels[i] ?? { completed: false, bestScore: 0, bestAccuracy: 0, bestCombo: 0, bestTime: 0 };
}

/** Records a completed run. Returns true if it set a new high score. */
export function recordLevel(i: number, score: number, accuracy: number, combo: number, time: number, levelCount: number): boolean {
  const r = levelRecord(i);
  const isBest = score > r.bestScore;
  progress.levels[i] = {
    completed: true,
    bestScore: Math.max(r.bestScore, score),
    bestAccuracy: Math.max(r.bestAccuracy, accuracy),
    bestCombo: Math.max(r.bestCombo, combo),
    bestTime: r.bestTime ? Math.min(r.bestTime, time) : time,
  };
  progress.unlocked = Math.min(levelCount - 1, Math.max(progress.unlocked, i + 1));
  saveProgress();
  return isBest;
}
