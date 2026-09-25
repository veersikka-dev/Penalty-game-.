/** Data-driven level format. Levels are plain data composed from these types. */

export type TargetKind =
  | 'crystal'
  | 'crystalLarge'
  | 'rotator'
  | 'panel'
  | 'barrier'
  | 'hanging'
  | 'shieldPlate'
  | 'explosive'
  | 'timeCrystal'
  | 'multiplier'
  | 'weakpoint'
  | 'bossOrb'
  | 'bossCore';

export type Motion =
  | { type: 'static' }
  | { type: 'sway'; axis: 'x' | 'y'; amp: number; freq: number; phase?: number }
  | { type: 'orbit'; radius: number; speed: number; phase?: number }
  | { type: 'spin'; speed: number }
  | { type: 'approach'; speed: number }
  | { type: 'pendulum'; length: number; amp: number; freq: number; phase?: number }
  | { type: 'drift'; vx: number; vy: number };

export interface SpawnEvent {
  /** Distance from the start of the section. */
  at: number;
  kind: TargetKind;
  x?: number;
  y?: number;
  /** Width/height for glass panels. */
  w?: number;
  h?: number;
  hp?: number;
  /** Rotation around the forward axis (radians) for panels. */
  tilt?: number;
  motion?: Motion;
}

export type ScriptEvent = { at: number } & (
  | { action: 'hint'; text: string; sub?: string; duration?: number }
  | { action: 'speed'; value: number }
  | { action: 'music'; intensity: number }
  | { action: 'tension' }
  | { action: 'boss' }
  | { action: 'pulse'; color: number }
);

export interface SectionDef {
  name: string;
  length: number;
  checkpoint?: boolean;
  speed?: number;
  events: SpawnEvent[];
  script?: ScriptEvent[];
}

export type ThemeId = 'awakening' | 'cathedral' | 'industrial' | 'void' | 'core';
export type MusicId = 'menu' | 'awakening' | 'cathedral' | 'industrial' | 'void' | 'core' | 'boss';

export interface LevelDef {
  id: number;
  name: string;
  subtitle: string;
  theme: ThemeId;
  music: MusicId;
  accent: string;
  baseSpeed: number;
  startAmmo: number;
  gravity: number;
  sections: SectionDef[];
  boss?: boolean;
}
