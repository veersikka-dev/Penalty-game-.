import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { Rng } from '../utils/MathUtils';

/**
 * Pre-generated fracture pieces. Glass panels break into thin irregular slivers,
 * crystals into faceted convex chunks. Generated once at load, then instanced.
 */
export function makeGlassShards(count: number, seed = 7): THREE.BufferGeometry[] {
  const rng = new Rng(seed);
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const verts = rng.int(3, 5);
    const angles: number[] = [];
    for (let k = 0; k < verts; k++) angles.push(rng.range(0, Math.PI * 2));
    angles.sort((a, b) => a - b);
    const stretch = rng.range(1, 2.4);
    const shape = new THREE.Shape();
    angles.forEach((a, k) => {
      const r = rng.range(0.28, 0.6);
      const x = Math.cos(a) * r * stretch;
      const y = Math.sin(a) * r;
      if (k === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: false });
    geo.center();
    geo.computeBoundingSphere();
    out.push(geo);
  }
  return out;
}

export function makeCrystalChunks(count: number, seed = 11): THREE.BufferGeometry[] {
  const rng = new Rng(seed);
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const pts: THREE.Vector3[] = [];
    const n = rng.int(6, 9);
    for (let k = 0; k < n; k++) {
      pts.push(new THREE.Vector3(rng.range(-0.5, 0.5), rng.range(-0.8, 0.8), rng.range(-0.5, 0.5)));
    }
    const geo = new ConvexGeometry(pts);
    geo.center();
    geo.computeVertexNormals();
    out.push(geo);
  }
  return out;
}

/** A hexagonal bipyramid — the signature crystal shape. Flat-shaded facets catch light nicely. */
export function makeBipyramid(radius: number, top: number, bottom: number, sides = 6): THREE.BufferGeometry {
  const pos: number[] = [];
  const ring: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    ring.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  for (let i = 0; i < sides; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % sides];
    pos.push(0, top, 0, bx, 0, bz, ax, 0, az);
    pos.push(0, -bottom, 0, ax, 0, az, bx, 0, bz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}
