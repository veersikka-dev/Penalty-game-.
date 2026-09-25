import * as THREE from 'three';
import type { ThemeId } from '../../data/types';
import type { Rng } from '../../utils/MathUtils';
import type { Disposer } from '../../utils/Disposer';

export interface EmissiveEntry {
  mat: THREE.MeshBasicMaterial;
  base: THREE.Color;
  pulse?: number;
  phase?: number;
}

/** A live, built theme: owns its GPU resources and knows how to produce corridor chunks. */
export interface ThemeInstance {
  chunkLength: number;
  buildChunk(index: number, rng: Rng): THREE.Object3D;
  update(t: number, dt: number, cam: THREE.Vector3): void;
  /** Objects that follow the camera (starfields, distant skies). */
  decor?: THREE.Object3D;
  emissives: EmissiveEntry[];
  dispose(): void;
}

/** Static description of an environment: palette, fog, lighting, bounds and a builder. */
export interface ThemeDef {
  id: ThemeId;
  fog: { color: number; density: number };
  background: number;
  hemi: { sky: number; ground: number; intensity: number };
  lights: { a: number; b: number; ia: number; ib: number };
  envIntensity: number;
  exposure: number;
  bloom: { strength: number; radius: number; threshold: number };
  glass: number;
  accent: number;
  dust: { color: number; size: number; opacity: number };
  floorY: number | null;
  viewDistance: number;
  roll: number;
  /** True if a point is inside the playable volume (projectiles die/bounce outside). */
  inside(x: number, y: number): boolean;
  create(): ThemeInstance;
}

/** HDR emissive material registered for light-level scaling and optional pulsing. */
export function glow(d: Disposer, list: EmissiveEntry[], color: number, intensity: number, opts: { pulse?: number; phase?: number; transparent?: boolean; opacity?: number; additive?: boolean; side?: THREE.Side; map?: THREE.Texture } = {}): THREE.MeshBasicMaterial {
  const base = new THREE.Color(color).multiplyScalar(intensity);
  const mat = d.track(
    new THREE.MeshBasicMaterial({
      color: base.clone(),
      transparent: opts.transparent ?? !!opts.additive,
      opacity: opts.opacity ?? 1,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !opts.additive,
      side: opts.side ?? THREE.FrontSide,
      map: opts.map ?? null,
    }),
  );
  list.push({ mat, base, pulse: opts.pulse, phase: opts.phase });
  return mat;
}

/** Wraps merged [material, geometry] pairs into a chunk group. */
export function chunkFromParts(parts: [THREE.Material, THREE.BufferGeometry][]): THREE.Group {
  const g = new THREE.Group();
  for (const [mat, geo] of parts) {
    const m = new THREE.Mesh(geo, mat);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    g.add(m);
  }
  return g;
}

export type Animator = (t: number) => void;
