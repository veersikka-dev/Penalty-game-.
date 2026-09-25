import type { SkyStyle } from '../render/Sky';

export type ThemeId = 'village' | 'candy' | 'jungle' | 'city' | 'fortress' | 'menu';
export type MusicId = 'menu' | 'village' | 'candy' | 'jungle' | 'city' | 'fortress' | 'boss' | 'victory';

export interface ThemeDef {
  id: ThemeId;
  sky: SkyStyle;
  fog: { color: number; near: number; far: number };
  sun: { color: number; intensity: number };
  hemi: { sky: number; ground: number; intensity: number };
  ground: { a: number; b: number; path: number; edge: number };
  liquid: { color: number; glow: number };
  ambient: { color: number; size: number; kind: 'leaves' | 'pollen' | 'sparkles' | 'embers' | 'fireflies' };
  exposure: number;
  bloom: { strength: number; radius: number; threshold: number };
  music: MusicId;
  palette: { primary: number[]; wood: number; stone: number; roof: number[]; foliage: number[]; trunk: number; accent: number };
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  village: {
    id: 'village',
    sky: { top: 0x4aa8ff, horizon: 0xcfeaff, bottom: 0x9fd07a, sun: 0xfff2c0, sunDir: [0.5, 0.6, -0.4], cloud: 0xffffff, cloudShade: 0xdfe8ff, clouds: 22, mountains: [0x7aa0d8, 0x8fbf8a, 0x78b060], snow: true },
    fog: { color: 0xcfeaff, near: 70, far: 360 },
    sun: { color: 0xfff0d8, intensity: 2.6 },
    hemi: { sky: 0xbfe0ff, ground: 0x7aa050, intensity: 1.1 },
    ground: { a: 0x8fd35a, b: 0x74c04a, path: 0xe8cf94, edge: 0x5aa040 },
    liquid: { color: 0x4ab8ff, glow: 0 },
    ambient: { color: 0xffffff, size: 0.14, kind: 'pollen' },
    exposure: 1.0,
    bloom: { strength: 0.3, radius: 0.5, threshold: 0.92 },
    music: 'village',
    palette: { primary: [0xffd6e0, 0xfff0c8, 0xd8f0ff, 0xe0ffd8, 0xffe0c0], wood: 0xb57a45, stone: 0xb8b0a8, roof: [0xe8413c, 0x3a8ad8, 0xff8a3a, 0x8a5cff], foliage: [0x5ec94a, 0x4fb840, 0x7ad85a], trunk: 0x8a5a36, accent: 0xff6aa8 },
  },
  candy: {
    id: 'candy',
    sky: { top: 0xff9ad8, horizon: 0xffe0f4, bottom: 0xffc0e0, sun: 0xfff6d0, sunDir: [-0.4, 0.55, -0.5], cloud: 0xfff0fa, cloudShade: 0xffd0ec, clouds: 26, mountains: [0xd89aff, 0xff9ac8, 0xffb8d8], snow: false },
    fog: { color: 0xffe0f4, near: 60, far: 330 },
    sun: { color: 0xfff0f0, intensity: 2.4 },
    hemi: { sky: 0xffe0ff, ground: 0xff9ac8, intensity: 1.15 },
    ground: { a: 0xffd0e8, b: 0xffc0dc, path: 0x8a5234, edge: 0xff9ac8 },
    liquid: { color: 0x7a3a22, glow: 0 },
    ambient: { color: 0xffffff, size: 0.12, kind: 'sparkles' },
    exposure: 1.0,
    bloom: { strength: 0.35, radius: 0.5, threshold: 0.9 },
    music: 'candy',
    palette: { primary: [0xff6aa8, 0x6ad8ff, 0xffe04a, 0x9aff7a, 0xc080ff], wood: 0x9a5a34, stone: 0xf2e0f0, roof: [0xff4a8a, 0x4ab8ff, 0xffc03a], foliage: [0xff7ac6, 0x7affd4, 0xffe46a], trunk: 0xffffff, accent: 0x6ad8ff },
  },
  jungle: {
    id: 'jungle',
    sky: { top: 0x3ab8c8, horizon: 0xd8f8d8, bottom: 0x4a8a3a, sun: 0xfff6c0, sunDir: [0.3, 0.7, 0.4], cloud: 0xffffff, cloudShade: 0xd8f0e0, clouds: 18, mountains: [0x3a8a6a, 0x4aa060, 0x3a8040], snow: false },
    fog: { color: 0xc8f0d0, near: 45, far: 260 },
    sun: { color: 0xfff4d0, intensity: 2.3 },
    hemi: { sky: 0xd0ffe0, ground: 0x4a7a30, intensity: 1.05 },
    ground: { a: 0x6ab83a, b: 0x5aa030, path: 0xc8a870, edge: 0x3a7a28 },
    liquid: { color: 0x3ad0c8, glow: 0 },
    ambient: { color: 0xc8ff6a, size: 0.12, kind: 'fireflies' },
    exposure: 1.0,
    bloom: { strength: 0.35, radius: 0.55, threshold: 0.9 },
    music: 'jungle',
    palette: { primary: [0xc8b890, 0xa89878, 0x9ab870], wood: 0x8a5a30, stone: 0x9aa088, roof: [0x5a8a3a], foliage: [0x3fb04a, 0x2e9a3a, 0x5ac85a, 0x2a8a50], trunk: 0x7a5030, accent: 0xff5a8a },
  },
  city: {
    id: 'city',
    sky: { top: 0x1a1a5a, horizon: 0xff8ac0, bottom: 0x2a2050, sun: 0xffb0d8, sunDir: [0, 0.18, -1], cloud: 0x6a5aa8, cloudShade: 0x4a3a88, clouds: 14, mountains: [0x2a2458, 0x3a2a68, 0x4a3478], snow: false, stars: true },
    fog: { color: 0x5a3a8a, near: 50, far: 300 },
    sun: { color: 0xffc0e0, intensity: 1.6 },
    hemi: { sky: 0x8a8aff, ground: 0x3a2a5a, intensity: 1.0 },
    ground: { a: 0x4a4a64, b: 0x42425a, path: 0x2a2a3a, edge: 0x6a6a84 },
    liquid: { color: 0x3affd8, glow: 1.4 },
    ambient: { color: 0x9afcff, size: 0.1, kind: 'sparkles' },
    exposure: 1.05,
    bloom: { strength: 0.7, radius: 0.55, threshold: 0.82 },
    music: 'city',
    palette: { primary: [0x5a6aa8, 0x6a5a98, 0x4a7aa0, 0x7a6ab0], wood: 0x6a6a84, stone: 0x8a8aa8, roof: [0x3affd8, 0xff5ac8], foliage: [0x3affd8, 0xff5ac8], trunk: 0x3a3a4a, accent: 0x3affd8 },
  },
  fortress: {
    id: 'fortress',
    sky: { top: 0x3a1030, horizon: 0xff8a4a, bottom: 0x3a1a1a, sun: 0xffd08a, sunDir: [0.2, 0.25, -1], cloud: 0x8a4a5a, cloudShade: 0x5a2a3a, clouds: 20, mountains: [0x4a2030, 0x5a2a2a, 0x6a3020], snow: false },
    fog: { color: 0x8a3a3a, near: 50, far: 300 },
    sun: { color: 0xffc090, intensity: 2.0 },
    hemi: { sky: 0xffa080, ground: 0x4a2020, intensity: 1.0 },
    ground: { a: 0x8a7064, b: 0x7a6258, path: 0x5a4a44, edge: 0x6a5048 },
    liquid: { color: 0xff6a1a, glow: 1.6 },
    ambient: { color: 0xffa040, size: 0.11, kind: 'embers' },
    exposure: 1.05,
    bloom: { strength: 0.6, radius: 0.55, threshold: 0.85 },
    music: 'fortress',
    palette: { primary: [0x8a7a70, 0x7a6a64, 0x9a8878], wood: 0x6a4028, stone: 0x8a7a70, roof: [0xa8302a, 0x5a2a4a], foliage: [0x6a5040], trunk: 0x4a3020, accent: 0xff5a3a },
  },
  menu: {
    id: 'menu',
    sky: { top: 0x5ab8ff, horizon: 0xdff4ff, bottom: 0xa8e08a, sun: 0xfff2c0, sunDir: [0.4, 0.5, 0.6], cloud: 0xffffff, cloudShade: 0xdfe8ff, clouds: 20, mountains: [0x8aa8e0, 0x9ac89a, 0x80b870], snow: true },
    fog: { color: 0xdff4ff, near: 60, far: 360 },
    sun: { color: 0xfff0d8, intensity: 2.6 },
    hemi: { sky: 0xbfe0ff, ground: 0x7aa050, intensity: 1.15 },
    ground: { a: 0x8fd35a, b: 0x74c04a, path: 0xe8cf94, edge: 0x5aa040 },
    liquid: { color: 0x4ab8ff, glow: 0 },
    ambient: { color: 0xffffff, size: 0.14, kind: 'pollen' },
    exposure: 1.0,
    bloom: { strength: 0.3, radius: 0.5, threshold: 0.92 },
    music: 'menu',
    palette: { primary: [0xffd6e0], wood: 0xb57a45, stone: 0xb8b0a8, roof: [0xe8413c], foliage: [0x5ec94a, 0x4fb840, 0x7ad85a], trunk: 0x8a5a36, accent: 0xff6aa8 },
  },
};
