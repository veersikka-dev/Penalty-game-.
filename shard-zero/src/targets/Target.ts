import * as THREE from 'three';
import type { Motion, TargetKind } from '../data/types';
import type { TargetDef } from './TargetDefs';

/**
 * A destructible object. Visual meshes are pooled per kind by the TargetFactory;
 * this class only holds state. World-space collider data is refreshed every frame.
 */
export class Target {
  alive = false;
  hp = 1;
  maxHp = 1;
  /** >= 0 while the crack/break animation plays after death. */
  dying = -1;
  base = new THREE.Vector3();
  motion: Motion = { type: 'static' };
  age = 0;
  w = 1;
  h = 1;
  depth = 0.12;
  tilt = 0;
  flash = 0;
  crack = 0;
  crackTarget = 0;
  spin = 0.6;
  phase = 0;
  passed = false;
  hitPoint = new THREE.Vector3();
  hitDir = new THREE.Vector3(0, 0, -1);
  cause: 'shot' | 'explosion' | 'crash' | 'boss' = 'shot';
  /** Custom per-frame behaviour (boss parts, homing orbs). */
  custom: ((t: Target, dt: number) => void) | null = null;
  tag: string | null = null;

  // World-space collider (refreshed each frame)
  center = new THREE.Vector3();
  quat = new THREE.Quaternion();
  half = new THREE.Vector3(0.5, 0.5, 0.5);
  radius = 1;

  constructor(
    readonly kind: TargetKind,
    readonly def: TargetDef,
    readonly root: THREE.Object3D,
    readonly body: THREE.Mesh,
    readonly glassMat: THREE.ShaderMaterial | null,
    readonly crystalMat: THREE.MeshStandardMaterial | null,
    readonly halo: THREE.Sprite | null,
    readonly extra: THREE.Object3D | null,
    readonly cables: THREE.LineSegments | null,
  ) {}

  get isGlass() {
    return this.def.frag === 'glass';
  }
}
