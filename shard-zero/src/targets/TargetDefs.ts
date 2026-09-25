import type { TargetKind } from '../data/types';

export interface TargetDef {
  shape: 'sphere' | 'box';
  radius: number;
  hp: number;
  /** Crashes into the player if left intact. */
  obstacle: boolean;
  /** Stops projectiles that fail to destroy it. */
  blocks: boolean;
  ammo: number;
  score: number;
  frag: 'glass' | 'crystal' | 'none';
  special?: 'time' | 'multiplier' | 'explosive';
  color: number;
  label: string;
}

/** Gameplay data for every target type. Tuning lives here, not in code. */
export const TARGET_DEFS: Record<TargetKind, TargetDef> = {
  crystal: { shape: 'sphere', radius: 0.75, hp: 1, obstacle: false, blocks: false, ammo: 3, score: 100, frag: 'crystal', color: 0x5fd4ff, label: 'Crystal' },
  crystalLarge: { shape: 'sphere', radius: 1.2, hp: 2, obstacle: false, blocks: false, ammo: 5, score: 250, frag: 'crystal', color: 0x7affd8, label: 'Large crystal' },
  rotator: { shape: 'sphere', radius: 0.7, hp: 1, obstacle: false, blocks: false, ammo: 2, score: 175, frag: 'crystal', color: 0x9f8bff, label: 'Orbiting crystal' },
  panel: { shape: 'box', radius: 0, hp: 1, obstacle: true, blocks: true, ammo: 0, score: 60, frag: 'glass', color: 0x8fd8ff, label: 'Glass panel' },
  barrier: { shape: 'box', radius: 0, hp: 3, obstacle: true, blocks: true, ammo: 0, score: 220, frag: 'glass', color: 0xff5a7a, label: 'Barrier' },
  hanging: { shape: 'box', radius: 0, hp: 1, obstacle: true, blocks: true, ammo: 0, score: 120, frag: 'glass', color: 0x8fd8ff, label: 'Hanging glass' },
  shieldPlate: { shape: 'box', radius: 0, hp: 1, obstacle: false, blocks: true, ammo: 0, score: 80, frag: 'glass', color: 0x7a9cff, label: 'Shield' },
  explosive: { shape: 'sphere', radius: 0.85, hp: 1, obstacle: false, blocks: true, ammo: 2, score: 300, frag: 'crystal', special: 'explosive', color: 0xff3a2a, label: 'Nova core' },
  timeCrystal: { shape: 'sphere', radius: 0.85, hp: 1, obstacle: false, blocks: false, ammo: 3, score: 200, frag: 'crystal', special: 'time', color: 0xffd35a, label: 'Chrono crystal' },
  multiplier: { shape: 'sphere', radius: 0.85, hp: 1, obstacle: false, blocks: false, ammo: 3, score: 200, frag: 'crystal', special: 'multiplier', color: 0xff4ad8, label: 'Prism multiplier' },
  weakpoint: { shape: 'sphere', radius: 1.15, hp: 2, obstacle: false, blocks: true, ammo: 2, score: 1000, frag: 'crystal', color: 0xff3a6a, label: 'Weak point' },
  bossOrb: { shape: 'sphere', radius: 0.75, hp: 1, obstacle: true, blocks: true, ammo: 1, score: 80, frag: 'crystal', color: 0xff4ab0, label: 'Hunter orb' },
  bossCore: { shape: 'sphere', radius: 4.3, hp: 18, obstacle: false, blocks: true, ammo: 0, score: 5000, frag: 'none', color: 0xffc070, label: 'Core' },
};
