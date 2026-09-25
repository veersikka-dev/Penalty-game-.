import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/**
 * Collects transformed copies of primitive geometries grouped by material and merges
 * them, so a whole environment chunk renders in a handful of draw calls.
 */
export class GeoBuilder {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(mat: THREE.Material, geo: THREE.BufferGeometry, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) {
    const g = geo.index ? geo.clone() : geo.clone();
    _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
    _m.compose(_p.set(pos[0], pos[1], pos[2]), _q, _s.set(scale[0], scale[1], scale[2]));
    g.applyMatrix4(_m);
    let list = this.parts.get(mat);
    if (!list) this.parts.set(mat, (list = []));
    list.push(g);
    return this;
  }

  build(): [THREE.Material, THREE.BufferGeometry][] {
    const out: [THREE.Material, THREE.BufferGeometry][] = [];
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (merged) {
        merged.computeBoundingSphere();
        out.push([mat, merged]);
      }
    }
    this.parts.clear();
    return out;
  }
}
