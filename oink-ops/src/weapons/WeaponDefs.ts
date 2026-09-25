export type WeaponId = 'blaster' | 'carrot' | 'egg' | 'bubble' | 'pulse';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  desc: string;
  mag: number;
  /** null = unlimited reserve */
  reserve: number | null;
  maxReserve: number;
  fireInterval: number;
  auto: boolean;
  reload: number;
  damage: number;
  hipSpread: number;
  aimSpread: number;
  kind: 'hitscan' | 'projectile' | 'wave';
  range: number;
  projSpeed?: number;
  gravity?: number;
  splash?: number;
  splashDamage?: number;
  bounce?: boolean;
  fuse?: number;
  trap?: number;
  knockback: number;
  recoil: number;
  shake: number;
  color: number;
  /** World index (0-based) where the weapon is unlocked. */
  unlock: number;
  key: string;
}

/** Tuning for every weapon lives here. */
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  blaster: {
    id: 'blaster', name: 'Bacon Blaster', desc: 'Trusty rapid-fire energy blaster. Never runs dry.', key: '1',
    mag: 24, reserve: null, maxReserve: 0, fireInterval: 0.1, auto: true, reload: 1.15, damage: 11,
    hipSpread: 0.018, aimSpread: 0.004, kind: 'hitscan', range: 140, knockback: 1.2, recoil: 1, shake: 0.06, color: 0xff6aa8, unlock: 0,
  },
  carrot: {
    id: 'carrot', name: 'Carrot Cannon', desc: 'Lobs explosive carrots. Crunchy.', key: '2',
    mag: 4, reserve: 12, maxReserve: 24, fireInterval: 0.55, auto: false, reload: 1.5, damage: 20,
    hipSpread: 0.01, aimSpread: 0.003, kind: 'projectile', range: 120, projSpeed: 42, gravity: 9, splash: 4.2, splashDamage: 55, knockback: 9, recoil: 2.4, shake: 0.22, color: 0xff8a2a, unlock: 1,
  },
  egg: {
    id: 'egg', name: 'Egg Launcher', desc: 'Bouncing eggs that go off after a moment.', key: '3',
    mag: 6, reserve: 18, maxReserve: 30, fireInterval: 0.42, auto: false, reload: 1.3, damage: 8,
    hipSpread: 0.02, aimSpread: 0.01, kind: 'projectile', range: 80, projSpeed: 24, gravity: 22, splash: 3.6, splashDamage: 45, bounce: true, fuse: 1.3, knockback: 7, recoil: 1.6, shake: 0.14, color: 0xffe26a, unlock: 2,
  },
  bubble: {
    id: 'bubble', name: 'Bubble Blaster', desc: 'Traps enemies in bubbles. Pop them for bonus damage.', key: '4',
    mag: 8, reserve: 24, maxReserve: 40, fireInterval: 0.32, auto: false, reload: 1.2, damage: 6,
    hipSpread: 0.015, aimSpread: 0.006, kind: 'projectile', range: 70, projSpeed: 20, gravity: -0.4, trap: 3.5, knockback: 0, recoil: 0.8, shake: 0.05, color: 0x7fe0ff, unlock: 3,
  },
  pulse: {
    id: 'pulse', name: 'Piggy Pulse', desc: 'Short-range shockwave that blasts everything away.', key: '5',
    mag: 5, reserve: 15, maxReserve: 25, fireInterval: 0.75, auto: false, reload: 1.6, damage: 38,
    hipSpread: 0, aimSpread: 0, kind: 'wave', range: 10, knockback: 16, recoil: 3, shake: 0.35, color: 0xb070ff, unlock: 4,
  },
};

export const WEAPON_ORDER: WeaponId[] = ['blaster', 'carrot', 'egg', 'bubble', 'pulse'];
