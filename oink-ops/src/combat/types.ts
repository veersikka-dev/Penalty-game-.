import type * as THREE from 'three';
import type { WeaponId } from '../weapons/WeaponDefs';

export type HitShape =
  | { type: 'sphere'; c: THREE.Vector3; r: number; weak?: boolean; id?: number }
  | { type: 'box'; c: THREE.Vector3; half: THREE.Vector3; quat?: THREE.Quaternion; weak?: boolean; id?: number };

export interface DamageInfo {
  amount: number;
  point: THREE.Vector3;
  dir: THREE.Vector3;
  knockback: number;
  weak: boolean;
  source: 'player' | 'enemy' | 'explosion' | 'env';
  weapon?: WeaponId;
  /** Bubble trap duration in seconds. */
  trap?: number;
  /** The specific hit shape (armour pieces, weak points). */
  shape?: HitShape;
}

/** Anything the player can shoot: enemies, destructible props, boss parts. */
export interface Damageable {
  readonly kind: 'enemy' | 'prop' | 'boss';
  alive: boolean;
  shapes: HitShape[];
  position: THREE.Vector3;
  takeDamage(info: DamageInfo): void;
  /** Whether aim assist may pull toward this. */
  assist?: boolean;
  setHighlight?(on: boolean): void;
}

export type PowerUpId = 'golden' | 'turbo' | 'rage' | 'shield' | 'giant';
