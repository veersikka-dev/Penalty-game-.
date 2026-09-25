import * as THREE from 'three';

/**
 * Cartoon rendering helpers: a shared stepped-shading gradient, cached toon
 * materials, and inverted-hull ink outlines. Everything in the game's art
 * direction goes through here so the look stays consistent.
 */

let gradient: THREE.DataTexture | null = null;

/** Four soft tone bands: shadow, core shadow, mid, lit. */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([110, 170, 225, 255]);
  gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

export interface ToonOpts {
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  map?: THREE.Texture | null;
  fog?: boolean;
  unique?: boolean;
}

const toonCache = new Map<string, THREE.MeshToonMaterial>();

/** Cached toon material. Pass `unique: true` for materials that get animated per-object. */
export function toon(color: THREE.ColorRepresentation, o: ToonOpts = {}): THREE.MeshToonMaterial {
  const c = new THREE.Color(color);
  const key = `${c.getHexString()}|${o.emissive ?? ''}|${o.emissiveIntensity ?? ''}|${o.transparent ?? ''}|${o.opacity ?? ''}|${o.side ?? ''}|${o.map?.uuid ?? ''}|${o.fog ?? ''}`;
  if (!o.unique) {
    const hit = toonCache.get(key);
    if (hit) return hit;
  }
  const m = new THREE.MeshToonMaterial({
    color: c,
    gradientMap: toonGradient(),
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
    map: o.map ?? null,
    fog: o.fog ?? true,
  });
  if (!o.unique) toonCache.set(key, m);
  return m;
}

/** Bright unlit material (glows under bloom when colour > 1). */
export function glowMat(color: THREE.ColorRepresentation, intensity = 1, o: { transparent?: boolean; opacity?: number; additive?: boolean; unique?: boolean } = {}): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity),
    transparent: o.transparent ?? !!o.additive,
    opacity: o.opacity ?? 1,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !o.additive,
  });
}

export const INK = 0x2b1d33;
const outlineCache = new Map<string, THREE.MeshBasicMaterial>();

/**
 * Inverted-hull outline material: pushes vertices along their normals and renders
 * back faces in ink colour. Works with instancing and fog automatically because it
 * patches the standard MeshBasicMaterial shader.
 */
export function outlineMaterial(thickness = 0.025, color = INK): THREE.MeshBasicMaterial {
  const key = `${thickness}|${color}`;
  const hit = outlineCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uThick = { value: thickness };
    shader.vertexShader = 'uniform float uThick;\n' + shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) + normal * uThick;');
  };
  m.customProgramCacheKey = () => `outline-${thickness}`;
  outlineCache.set(key, m);
  return m;
}

/** Adds an ink outline shell as a child of `mesh` (shares its geometry). */
export function outline<T extends THREE.Mesh>(mesh: T, thickness = 0.025, color = INK): T {
  const shell = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness, color));
  shell.name = 'outline';
  shell.castShadow = false;
  shell.receiveShadow = false;
  shell.raycast = () => undefined;
  mesh.add(shell);
  return mesh;
}

/** Enables shadow casting/receiving on every mesh in a subtree (outlines excluded). */
export function shadows(obj: THREE.Object3D, cast = true, receive = true) {
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name !== 'outline') {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return obj;
}

/** Convenience: a toon mesh with optional outline. */
export function part(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, ink = 0, opts: ToonOpts = {}): THREE.Mesh {
  const m = new THREE.Mesh(geo, toon(color, opts));
  if (ink > 0) outline(m, ink);
  return m;
}
