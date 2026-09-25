export type EnemyType = 'chicken' | 'toast' | 'carrot' | 'bubble' | 'boar';

export interface EnemyDef {
  type: EnemyType;
  name: string;
  hp: number;
  speed: number;
  radius: number;
  height: number;
  flying: boolean;
  hover: number;
  detect: number;
  attackRange: number;
  damage: number;
  score: number;
  coins: [number, number];
  color: number;
  /** 0..1 — how much knockback is ignored */
  heft: number;
  weakRadius: number;
}

/** Tuning for every enemy type. */
export const ENEMIES: Record<EnemyType, EnemyDef> = {
  chicken: { type: 'chicken', name: 'Robo Chicken', hp: 34, speed: 4.2, radius: 0.45, height: 1.2, flying: false, hover: 0, detect: 22, attackRange: 7, damage: 12, score: 100, coins: [2, 4], color: 0xe6ecf4, heft: 0.1, weakRadius: 0.26 },
  toast: { type: 'toast', name: 'Toast Bot', hp: 48, speed: 3.4, radius: 0.55, height: 1, flying: true, hover: 2.6, detect: 26, attackRange: 18, damage: 9, score: 150, coins: [3, 5], color: 0xd7dde8, heft: 0.2, weakRadius: 0.24 },
  carrot: { type: 'carrot', name: 'Angry Carrot', hp: 16, speed: 7.4, radius: 0.35, height: 1.2, flying: false, hover: 0, detect: 20, attackRange: 1.4, damage: 7, score: 60, coins: [1, 2], color: 0xff8a2a, heft: 0, weakRadius: 0.22 },
  bubble: { type: 'bubble', name: 'Bubble Bot', hp: 55, speed: 3, radius: 0.55, height: 1, flying: true, hover: 2.2, detect: 24, attackRange: 14, damage: 0, score: 175, coins: [3, 6], color: 0x9fe8ff, heft: 0.2, weakRadius: 0.22 },
  boar: { type: 'boar', name: 'Big Bad Boar', hp: 520, speed: 4.4, radius: 1.25, height: 2.8, flying: false, hover: 0, detect: 40, attackRange: 16, damage: 22, score: 1500, coins: [18, 26], color: 0x7a4a3a, heft: 0.85, weakRadius: 0.4 },
};
