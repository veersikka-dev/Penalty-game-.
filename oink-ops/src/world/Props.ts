import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { LevelBuilder } from './LevelBuilder';
import { glowMat, outline, toon } from '../render/Toon';
import { canvasTexture } from '../utils/textures';

/**
 * Scenery library. Every function places merged static geometry (plus colliders
 * where it matters) or an animated object. Themes share a common visual language:
 * rounded shapes, toon shading, ink outlines, saturated palettes.
 */

// ---------------------------------------------------------------- common nature

export function tree(b: LevelBuilder, x: number, z: number, s = 1, colors = b.theme.palette.foliage) {
  const r = b.rng;
  const h = 2.4 * s;
  b.add(b.cyl(0.22 * s, 0.32 * s, h, 8), b.theme.palette.trunk, [x, h / 2, z]);
  const c = colors[r.int(0, colors.length - 1)];
  const blobs = r.int(2, 3);
  for (let i = 0; i < blobs; i++) {
    const rr = (1.3 - i * 0.2) * s * r.range(0.9, 1.15);
    b.add(b.sphere(1, 1), c, [x + r.range(-0.5, 0.5) * s, h + 0.4 * s + i * 0.9 * s, z + r.range(-0.5, 0.5) * s], [0, r.range(0, 6), 0], [rr, rr * 0.9, rr], 0.05);
  }
  b.post(x, z, 0.35 * s, h + 1);
}

export function pine(b: LevelBuilder, x: number, z: number, s = 1) {
  const c = b.theme.palette.foliage[b.rng.int(0, b.theme.palette.foliage.length - 1)];
  b.add(b.cyl(0.18 * s, 0.25 * s, 1.2 * s, 6), b.theme.palette.trunk, [x, 0.6 * s, z]);
  for (let i = 0; i < 3; i++) {
    const w = (1.5 - i * 0.35) * s;
    b.add(b.cone(1, 1, 8), c, [x, (1.4 + i * 0.95) * s, z], [0, i, 0], [w, 1.5 * s, w], 0.045);
  }
  b.post(x, z, 0.3 * s, 4 * s);
}

export function bush(b: LevelBuilder, x: number, z: number, s = 1) {
  const c = b.theme.palette.foliage[b.rng.int(0, b.theme.palette.foliage.length - 1)];
  for (let i = 0; i < 3; i++) b.add(b.sphere(1, 1), c, [x + (i - 1) * 0.45 * s, 0.35 * s, z + b.rng.range(-0.2, 0.2)], [0, i, 0], [0.55 * s, 0.5 * s, 0.55 * s], 0.035);
}

export function rock(b: LevelBuilder, x: number, z: number, s = 1, color = b.theme.palette.stone) {
  b.add(b.sphere(1, 0), color, [x, 0.3 * s, z], [b.rng.range(0, 3), b.rng.range(0, 3), 0], [s * 1.1, s * 0.75, s], 0.04);
  b.solid(x, 0, z, s * 1.6, s * 1.0, s * 1.4);
}

const FLOWER = [0xff6aa8, 0xffe04a, 0xffffff, 0xb08aff, 0xff8a4a];
export function flowers(b: LevelBuilder, x: number, z: number, n = 8, spread = 2) {
  for (let i = 0; i < n; i++) {
    const fx = x + b.rng.range(-spread, spread), fz = z + b.rng.range(-spread, spread);
    b.add(b.cyl(0.02, 0.02, 0.35, 4), 0x4a9a3a, [fx, 0.17, fz], [0, 0, 0], [1, 1, 1], 0, false);
    b.add(b.sphere(0.1, 0), FLOWER[b.rng.int(0, FLOWER.length - 1)], [fx, 0.38, fz], [0, 0, 0], [1, 0.6, 1], 0, false);
  }
}

export function grass(b: LevelBuilder, x: number, z: number, n = 10, spread = 3) {
  const c = b.theme.ground.edge;
  for (let i = 0; i < n; i++) {
    b.add(b.cone(0.08, 0.4, 3), c, [x + b.rng.range(-spread, spread), 0.18, z + b.rng.range(-spread, spread)], [b.rng.range(-0.2, 0.2), b.rng.range(0, 3), b.rng.range(-0.2, 0.2)], [1, 1, 1], 0, false);
  }
}

/** Scatter nature decor in a rectangle, avoiding a list of keep-out circles. */
export function scatter(b: LevelBuilder, x0: number, z0: number, x1: number, z1: number, count: number, kinds: ('tree' | 'pine' | 'bush' | 'rock' | 'flowers' | 'grass' | 'palm' | 'fern' | 'lolly' | 'gumdrop' | 'mushroom')[], avoid: [number, number, number][] = []) {
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 10) {
    tries++;
    const x = b.rng.range(x0, x1), z = b.rng.range(z0, z1);
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    const k = kinds[b.rng.int(0, kinds.length - 1)];
    const s = b.rng.range(0.8, 1.3);
    if (k === 'tree') tree(b, x, z, s);
    else if (k === 'pine') pine(b, x, z, s);
    else if (k === 'bush') bush(b, x, z, s);
    else if (k === 'rock') rock(b, x, z, s * 0.8);
    else if (k === 'flowers') flowers(b, x, z, 6, 1.5);
    else if (k === 'grass') grass(b, x, z, 8, 2);
    else if (k === 'palm') palm(b, x, z, s);
    else if (k === 'fern') fern(b, x, z, s);
    else if (k === 'lolly') lollipop(b, x, z, s);
    else if (k === 'gumdrop') gumdrop(b, x, z, s);
    else if (k === 'mushroom') bigMushroom(b, x, z, s);
    placed++;
  }
}

// ---------------------------------------------------------------- village

export function house(b: LevelBuilder, x: number, z: number, rot = 0, w = 6, d = 5, variant = 0) {
  const pal = b.theme.palette;
  const wall = pal.primary[variant % pal.primary.length];
  const roof = pal.roof[variant % pal.roof.length];
  const h = 3.4;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const L = (lx: number, lz: number): [number, number] => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
  b.add(b.rbox(w, h, d, 0.3), wall, [x, h / 2, z], [0, rot, 0]);
  b.add(b.rbox(w + 0.3, 0.35, d + 0.3, 0.12), pal.wood, [x, 0.17, z], [0, rot, 0], [1, 1, 1], 0.03);
  // gable roof: two slanted slabs + gable triangles
  const rh = 2.2;
  const slab = Math.hypot(d / 2 + 0.5, rh);
  const ang = Math.atan2(rh, d / 2 + 0.5);
  for (const s of [-1, 1]) {
    const [rx, rz] = L(0, s * (d / 4 + 0.25));
    b.add(b.rbox(w + 0.8, 0.35, slab, 0.12), roof, [rx, h + rh / 2, rz], [s * ang, rot, 0]);
  }
  const tri = b.g(`tri${d}`, () => {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, 0);
    shape.lineTo(d / 2, 0);
    shape.lineTo(0, rh);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: w - 0.2, bevelEnabled: false }).translate(0, 0, -(w - 0.2) / 2).rotateY(Math.PI / 2);
  });
  b.add(tri, wall, [x, h - 0.05, z], [0, rot, 0], [1, 1, 1], 0.03);
  // door, windows, chimney, flower boxes
  const [dx, dz] = L(0, d / 2 + 0.02);
  b.add(b.rbox(1.2, 2, 0.2, 0.15), pal.wood, [dx, 1, dz], [0, rot, 0], [1, 1, 1], 0.03);
  const knob: [number, number] = L(0.35, d / 2 + 0.14);
  b.add(b.sphere(0.07, 0), 0xffd23f, [knob[0], 1, knob[1]], [0, 0, 0], [1, 1, 1], 0, false);
  for (const s of [-1, 1]) {
    const [wx, wz] = L(s * w * 0.3, d / 2 + 0.05);
    b.add(b.rbox(1.1, 1, 0.15, 0.1), 0xbfe8ff, [wx, 2.1, wz], [0, rot, 0], [1, 1, 1], 0.03);
    b.add(b.rbox(1.3, 0.12, 0.3, 0.05), 0xffffff, [wx, 1.55, wz], [0, rot, 0], [1, 1, 1], 0.02);
    const [fx, fz] = L(s * w * 0.3, d / 2 + 0.3);
    b.add(b.rbox(1.1, 0.3, 0.3, 0.06), pal.wood, [fx, 1.4, fz], [0, rot, 0], [1, 1, 1], 0.02);
    for (let i = 0; i < 3; i++) b.add(b.sphere(0.12, 0), FLOWER[(i + variant) % FLOWER.length], [fx + (i - 1) * 0.3 * cos, 1.62, fz - (i - 1) * 0.3 * sin], [0, 0, 0], [1, 1, 1], 0, false);
  }
  const [cx, cz] = L(w * 0.28, -d * 0.1);
  b.add(b.rbox(0.7, 1.6, 0.7, 0.1), pal.stone, [cx, h + rh * 0.7, cz], [0, rot, 0]);
  // collider (rotated 0/90 only)
  const swap = Math.abs(sin) > 0.7;
  b.solid(x, 0, z, swap ? d : w, h + rh, swap ? w : d, false);
}

export function windmill(b: LevelBuilder, x: number, z: number, rot = 0) {
  const pal = b.theme.palette;
  b.add(b.cyl(1.6, 2.4, 8, 10), 0xfff0dc, [x, 4, z], [0, rot, 0], [1, 1, 1], 0.06);
  b.add(b.cone(2.2, 2.2, 10), pal.roof[0], [x, 9.1, z], [0, rot, 0], [1, 1, 1], 0.05);
  b.add(b.rbox(1.2, 2, 0.3, 0.15), pal.wood, [x + Math.sin(rot) * 2.3, 1, z + Math.cos(rot) * 2.3], [0, rot, 0], [1, 1, 1], 0.03);
  b.post(x, z, 2.2, 9);
  const blades = new THREE.Group();
  blades.position.set(x + Math.sin(rot) * 2.1, 7.4, z + Math.cos(rot) * 2.1);
  blades.rotation.y = rot;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 12).rotateX(Math.PI / 2), toon(pal.wood));
  outline(hub, 0.03);
  blades.add(hub);
  const spin = new THREE.Group();
  blades.add(spin);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i / 4) * Math.PI * 2;
    const beam = new THREE.Mesh(new RoundedBoxGeometry(0.25, 5.5, 0.15, 1, 0.05), toon(pal.wood));
    beam.position.y = 2.9;
    outline(beam, 0.025);
    const sail = new THREE.Mesh(new RoundedBoxGeometry(1.3, 4.2, 0.06, 1, 0.03), toon(0xfff8f0));
    sail.position.set(0.7, 3.3, 0.05);
    outline(sail, 0.02);
    arm.add(beam, sail);
    spin.add(arm);
  }
  b.object(blades, (t) => (spin.rotation.z = t * 0.6));
}

export function barn(b: LevelBuilder, x: number, z: number, rot = 0) {
  b.add(b.rbox(9, 5, 7, 0.3), 0xd8413c, [x, 2.5, z], [0, rot, 0]);
  b.add(b.rbox(9.6, 0.5, 7.6, 0.2), 0xffffff, [x, 5.1, z], [0, rot, 0], [1, 1, 1], 0.03);
  b.add(b.cyl(0.1, 4.4, 3, 4), 0x8a2a2a, [x, 6.8, z], [0, rot + Math.PI / 4, 0], [1.4, 1, 1], 0.05);
  const fx = x + Math.sin(rot) * 3.52, fz = z + Math.cos(rot) * 3.52;
  b.add(b.rbox(3.6, 3.8, 0.2, 0.1), 0xffffff, [fx, 1.9, fz], [0, rot, 0], [1, 1, 1], 0.03);
  b.add(b.rbox(3.2, 3.4, 0.24, 0.1), 0xa82a2a, [fx, 1.9, fz], [0, rot, 0], [1, 1, 1], 0);
  const swap = Math.abs(Math.sin(rot)) > 0.7;
  b.solid(x, 0, z, swap ? 7 : 9, 8, swap ? 9 : 7, false);
}

export function well(b: LevelBuilder, x: number, z: number) {
  b.add(b.cyl(1, 1.1, 1, 14), b.theme.palette.stone, [x, 0.5, z]);
  b.add(b.cyl(0.8, 0.8, 0.1, 14), 0x4ab8ff, [x, 0.9, z], [0, 0, 0], [1, 1, 1], 0);
  for (const s of [-1, 1]) b.add(b.rbox(0.18, 2.2, 0.18, 0.05), b.theme.palette.wood, [x + s * 0.9, 1.6, z], [0, 0, 0], [1, 1, 1], 0.025);
  b.add(b.cone(1.5, 1, 4), b.theme.palette.roof[0], [x, 3.1, z], [0, Math.PI / 4, 0], [1, 1, 1], 0.04);
  b.post(x, z, 1.1, 1);
}

export function field(b: LevelBuilder, x: number, z: number, w: number, d: number, crop = 0xffc93a) {
  b.add(b.rbox(w, 0.25, d, 0.1), 0x8a5a36, [x, 0.1, z], [0, 0, 0], [1, 1, 1], 0.03);
  for (let i = 0; i < Math.floor(w / 1.2); i++) {
    for (let j = 0; j < Math.floor(d / 1.2); j++) {
      const cx = x - w / 2 + 0.6 + i * 1.2, cz = z - d / 2 + 0.6 + j * 1.2;
      b.add(b.cone(0.28, 0.7, 5), crop === 0xffc93a ? 0x6ac04a : crop, [cx, 0.55, cz], [0, i + j, 0], [1, 1, 1], 0, false);
      if (crop === 0xffc93a) b.add(b.sphere(0.12, 0), crop, [cx, 0.9, cz], [0, 0, 0], [1, 1, 1], 0, false);
    }
  }
}

export function fenceRow(b: LevelBuilder, x1: number, z1: number, x2: number, z2: number, color = 0xf2e2c4) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.round(len / 2));
  const ang = Math.atan2(x2 - x1, z2 - z1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    b.add(b.rbox(0.18, 1.1, 0.18, 0.05), color, [x1 + (x2 - x1) * t, 0.55, z1 + (z2 - z1) * t], [0, ang, 0], [1, 1, 1], 0.025);
  }
  for (const y of [0.4, 0.8]) b.add(b.rbox(0.08, 0.12, len, 0.03), color, [(x1 + x2) / 2, y, (z1 + z2) / 2], [0, ang, 0], [1, 1, 1], 0.02);
  // low collider: jumpable
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
  b.solid(cx, 0, cz, alongX ? len : 0.3, 1.0, alongX ? 0.3 : len);
}

export function bridge(b: LevelBuilder, x: number, z: number, len: number, alongX: boolean, h = 0.9) {
  const w = 3;
  const n = Math.floor(len / 0.6);
  for (let i = 0; i < n; i++) {
    const t = -len / 2 + i * 0.6 + 0.3;
    const arch = Math.sin(((i + 0.5) / n) * Math.PI) * 0.5;
    b.add(b.rbox(alongX ? 0.55 : w, 0.2, alongX ? w : 0.55, 0.05), b.theme.palette.wood, [x + (alongX ? t : 0), h + arch, z + (alongX ? 0 : t)], [0, 0, 0], [1, 1, 1], 0.025);
  }
  for (const s of [-1, 1]) {
    b.add(b.rbox(alongX ? len : 0.15, 0.15, alongX ? 0.15 : len, 0.05), b.theme.palette.wood, [x + (alongX ? 0 : s * w / 2), h + 1.1, z + (alongX ? s * w / 2 : 0)], [0, 0, 0], [1, 1, 1], 0.025);
  }
  b.world.addBox(x - (alongX ? len / 2 : w / 2), 0, z - (alongX ? w / 2 : len / 2), x + (alongX ? len / 2 : w / 2), h + 0.35, z + (alongX ? w / 2 : len / 2), { solid: false });
  // ramps onto the bridge
  const rl = 2.5;
  if (alongX) {
    b.ramp(x - len / 2 - rl / 2, z, rl, w, 0, h + 0.1, 'x', b.theme.palette.wood);
    b.ramp(x + len / 2 + rl / 2, z, rl, w, h + 0.1, 0, 'x', b.theme.palette.wood);
  } else {
    b.ramp(x, z - len / 2 - rl / 2, w, rl, 0, h + 0.1, 'z', b.theme.palette.wood);
    b.ramp(x, z + len / 2 + rl / 2, w, rl, h + 0.1, 0, 'z', b.theme.palette.wood);
  }
}

// ---------------------------------------------------------------- candy factory

export function lollipop(b: LevelBuilder, x: number, z: number, s = 1) {
  const cols = [0xff4a8a, 0x6ad8ff, 0xffe04a, 0x9aff7a, 0xc080ff];
  const h = 3.4 * s;
  b.add(b.cyl(0.1 * s, 0.1 * s, h, 6), 0xffffff, [x, h / 2, z], [0, 0, 0], [1, 1, 1], 0.025);
  const c = cols[b.rng.int(0, cols.length - 1)];
  b.add(b.cyl(1 * s, 1 * s, 0.35 * s, 18), c, [x, h + 0.7 * s, z], [Math.PI / 2, b.rng.range(0, 3), 0], [1, 1, 1], 0.05);
  b.add(b.cyl(0.55 * s, 0.55 * s, 0.37 * s, 18), 0xffffff, [x, h + 0.7 * s, z], [Math.PI / 2, 0, 0], [1, 1, 1], 0);
  b.post(x, z, 0.2 * s, h);
}

export function candyCane(b: LevelBuilder, x: number, z: number, s = 1) {
  const h = 5 * s;
  for (let i = 0; i < 10; i++) b.add(b.cyl(0.3 * s, 0.3 * s, h / 10, 10), i % 2 ? 0xff3a4a : 0xffffff, [x, (i + 0.5) * (h / 10), z], [0, 0, 0], [1, 1, 1], i === 0 ? 0.04 : 0);
  const hook = b.g(`hook${s}`, () => new THREE.TorusGeometry(0.8 * s, 0.3 * s, 8, 16, Math.PI));
  b.add(hook, 0xff3a4a, [x + 0.8 * s, h, z], [0, 0, 0], [1, 1, 1], 0.04);
  b.post(x, z, 0.35 * s, h);
}

export function gumdrop(b: LevelBuilder, x: number, z: number, s = 1) {
  const cols = [0xff4a8a, 0x6ad8ff, 0xffe04a, 0x9aff7a, 0xff8a3a];
  b.add(b.sphere(1, 2), cols[b.rng.int(0, cols.length - 1)], [x, 0.4 * s, z], [0, 0, 0], [0.8 * s, 0.9 * s, 0.8 * s], 0.04);
}

export function cupcakeHouse(b: LevelBuilder, x: number, z: number, s = 1) {
  b.add(b.cyl(3 * s, 2.4 * s, 3 * s, 18), 0xffc0e0, [x, 1.5 * s, z], [0, 0, 0], [1, 1, 1], 0.05);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.add(b.box(0.2, 3 * s, 0.3), 0xff8ac0, [x + Math.cos(a) * 2.75 * s, 1.5 * s, z + Math.sin(a) * 2.75 * s], [0, -a, 0.1], [1, 1, 1], 0);
  }
  b.add(b.sphere(1, 2), 0xfff4fa, [x, 3.4 * s, z], [0, 0, 0], [3.1 * s, 1.6 * s, 3.1 * s], 0.05);
  b.add(b.sphere(1, 2), 0xfff4fa, [x, 4.7 * s, z], [0, 0, 0], [1.9 * s, 1.2 * s, 1.9 * s], 0.05);
  b.add(b.sphere(0.6 * s, 1), 0xff2a4a, [x, 6 * s, z], [0, 0, 0], [1, 1, 1], 0.04);
  b.post(x, z, 3.1 * s, 6 * s);
}

export function candyMachine(b: LevelBuilder, x: number, z: number, rot = 0) {
  b.add(b.rbox(6, 5, 4, 0.4), 0x6ad8ff, [x, 2.5, z], [0, rot, 0]);
  b.add(b.rbox(6.4, 0.6, 4.4, 0.2), 0xff6aa8, [x, 5.2, z], [0, rot, 0], [1, 1, 1], 0.04);
  for (let i = 0; i < 3; i++) b.add(b.cyl(0.35, 0.35, 3, 10), [0xffe04a, 0xff6aa8, 0x9aff7a][i], [x + (i - 1) * 1.6, 7, z], [0, 0, 0], [1, 1, 1], 0.03);
  b.add(b.sphere(1.2, 1), 0xffffff, [x, 4.2, z + Math.cos(rot) * 2.1], [0, 0, 0], [1, 1, 0.3], 0.04);
  const swap = Math.abs(Math.sin(rot)) > 0.7;
  b.solid(x, 0, z, swap ? 4 : 6, 5.5, swap ? 6 : 4);
  const gear = new THREE.Group();
  gear.position.set(x + Math.sin(rot + Math.PI / 2) * 3.05, 3, z + Math.cos(rot + Math.PI / 2) * 3.05);
  gear.rotation.y = rot + Math.PI / 2;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.3, 12).rotateX(Math.PI / 2), toon(0xffe04a));
  outline(disc, 0.03);
  gear.add(disc);
  for (let i = 0; i < 8; i++) {
    const tooth = new THREE.Mesh(new RoundedBoxGeometry(0.35, 0.5, 0.3, 1, 0.05), toon(0xffe04a));
    const a = (i / 8) * Math.PI * 2;
    tooth.position.set(Math.cos(a) * 1.35, Math.sin(a) * 1.35, 0);
    tooth.rotation.z = a;
    disc.add(tooth);
  }
  b.object(gear, (t) => (disc.rotation.z = t * 1.2));
}

export function pipe(b: LevelBuilder, x1: number, z1: number, x2: number, z2: number, y: number, color = 0xff6aa8) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const ang = Math.atan2(x2 - x1, z2 - z1);
  b.add(b.cyl(0.45, 0.45, len, 12), color, [(x1 + x2) / 2, y, (z1 + z2) / 2], [Math.PI / 2, ang, 0], [1, 1, 1], 0.04);
  for (let t = 0; t <= 1; t += 1 / Math.max(1, Math.floor(len / 4))) b.add(b.cyl(0.55, 0.55, 0.3, 12), 0xffffff, [x1 + (x2 - x1) * t, y, z1 + (z2 - z1) * t], [Math.PI / 2, ang, 0], [1, 1, 1], 0.03);
}

export function factoryWall(b: LevelBuilder, x: number, z: number, w: number, d: number, h = 7, color = 0xf2e0f0) {
  b.add(b.rbox(w, h, d, 0.3), color, [x, h / 2, z]);
  b.add(b.rbox(w + 0.2, 0.6, d + 0.2, 0.2), 0xff6aa8, [x, h, z], [0, 0, 0], [1, 1, 1], 0.04);
  b.solid(x, 0, z, w, h, d, false);
}

// ---------------------------------------------------------------- jungle

export function palm(b: LevelBuilder, x: number, z: number, s = 1) {
  const h = 5 * s;
  const lean = b.rng.range(-0.25, 0.25);
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    b.add(b.cyl(0.26 * s, 0.3 * s, h / 6 + 0.05, 8), i % 2 ? 0x9a6a3a : 0x8a5a30, [x + lean * t * h, (t + 1 / 12) * h, z], [0, 0, -lean], [1, 1, 1], i === 0 ? 0.03 : 0);
  }
  const tx = x + lean * h;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    b.add(b.sphere(1, 1), b.theme.palette.foliage[i % b.theme.palette.foliage.length], [tx + Math.cos(a) * 1.3 * s, h + 0.1, z + Math.sin(a) * 1.3 * s], [0, -a, 0.35], [1.6 * s, 0.14 * s, 0.55 * s], 0.035);
  }
  b.add(b.sphere(0.25 * s, 0), 0x7a4a2a, [tx, h - 0.2, z], [0, 0, 0], [1, 1, 1], 0.02);
  b.post(x, z, 0.35 * s, h);
}

export function fern(b: LevelBuilder, x: number, z: number, s = 1) {
  const c = b.theme.palette.foliage[b.rng.int(0, b.theme.palette.foliage.length - 1)];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add(b.sphere(1, 1), c, [x + Math.cos(a) * 0.7 * s, 0.5 * s, z + Math.sin(a) * 0.7 * s], [0, -a, 0.7], [1.1 * s, 0.1 * s, 0.35 * s], 0.025);
  }
}

export function giantLeafPlant(b: LevelBuilder, x: number, z: number, s = 1) {
  const c = b.theme.palette.foliage[b.rng.int(0, b.theme.palette.foliage.length - 1)];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + b.rng.range(0, 1);
    const hh = b.rng.range(2, 3.5) * s;
    b.add(b.cyl(0.08 * s, 0.1 * s, hh, 5), 0x3a8a3a, [x + Math.cos(a) * 0.4, hh / 2, z + Math.sin(a) * 0.4], [Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2], [1, 1, 1], 0.02);
    b.add(b.sphere(1, 1), c, [x + Math.cos(a) * 1.4 * s, hh, z + Math.sin(a) * 1.4 * s], [0, -a, 0.3], [1.7 * s, 0.12 * s, 1.1 * s], 0.035);
  }
}

export function bigMushroom(b: LevelBuilder, x: number, z: number, s = 1) {
  const h = 2.2 * s;
  b.add(b.cyl(0.35 * s, 0.5 * s, h, 12), 0xfff2e8, [x, h / 2, z], [0, 0, 0], [1, 1, 1], 0.03);
  b.add(b.sphere(1, 2), b.rng.chance(0.5) ? 0xff4a5a : 0xb070ff, [x, h, z], [0, 0, 0], [1.6 * s, 0.8 * s, 1.6 * s], 0.05);
  b.post(x, z, 0.5 * s, h);
}

export function ruinBlock(b: LevelBuilder, x: number, z: number, w: number, d: number, h: number, walkable = true) {
  const st = b.theme.palette.stone;
  b.add(b.rbox(w, h, d, 0.2), st, [x, h / 2, z]);
  b.add(b.rbox(w * 0.9, 0.2, d * 0.9, 0.1), 0x5ab04a, [x, h + 0.02, z], [0, 0, 0], [1, 1, 1], 0.02);
  b.solid(x, 0, z, w, h, d, walkable);
}

export function brokenPillar(b: LevelBuilder, x: number, z: number, h = 4) {
  b.add(b.cyl(0.7, 0.8, h, 10), b.theme.palette.stone, [x, h / 2, z], [0, 0, 0], [1, 1, 1], 0.04);
  b.add(b.rbox(2, 0.5, 2, 0.1), b.theme.palette.stone, [x, 0.25, z], [0, 0, 0], [1, 1, 1], 0.04);
  b.add(b.sphere(0.5, 0), 0x4ab04a, [x + 0.3, h, z], [0, 0, 0], [1.2, 0.4, 1.2], 0.02);
  b.post(x, z, 0.8, h);
}

export function waterfall(b: LevelBuilder, x: number, z: number, w: number, h: number, rot = 0) {
  const cliff = b.theme.palette.stone;
  b.add(b.rbox(w + 6, h + 2, 5, 0.6), cliff, [x - Math.sin(rot) * 1.5, (h + 2) / 2, z - Math.cos(rot) * 1.5], [0, rot, 0]);
  const tex = canvasTexture(64, 256, (g, cw, ch) => {
    g.fillStyle = '#5ad8ff';
    g.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.5})`;
      g.fillRect(Math.random() * cw, Math.random() * ch, 2 + Math.random() * 4, 20 + Math.random() * 40);
    }
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9 });
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  fall.position.set(x + Math.sin(rot) * 1.05, h / 2, z + Math.cos(rot) * 1.05);
  fall.rotation.y = rot;
  b.object(fall, (t) => {
    tex.offset.y = t * 1.2;
  });
  b.pit(x + Math.sin(rot) * 3.2, z + Math.cos(rot) * 3.2, w + 2, 4);
  b.solid(x - Math.sin(rot) * 1.5, 0, z - Math.cos(rot) * 1.5, Math.abs(Math.cos(rot)) > 0.5 ? w + 6 : 5, h + 2, Math.abs(Math.cos(rot)) > 0.5 ? 5 : w + 6, false);
}

export function ropeBridge(b: LevelBuilder, x: number, z: number, len: number, alongX: boolean, h: number) {
  const w = 2.6;
  const n = Math.floor(len / 0.55);
  for (let i = 0; i < n; i++) {
    const t = -len / 2 + i * 0.55 + 0.275;
    const sag = -Math.sin(((i + 0.5) / n) * Math.PI) * 0.35;
    b.add(b.rbox(alongX ? 0.45 : w, 0.14, alongX ? w : 0.45, 0.04), b.theme.palette.wood, [x + (alongX ? t : 0), h + sag, z + (alongX ? 0 : t)], [0, 0, b.rng.range(-0.05, 0.05)], [1, 1, 1], 0.02);
  }
  for (const s of [-1, 1]) b.add(b.cyl(0.04, 0.04, len, 4), 0xd8c090, [x + (alongX ? 0 : s * w / 2), h + 0.9, z + (alongX ? s * w / 2 : 0)], alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0], [1, 1, 1], 0.015);
  b.world.addBox(x - (alongX ? len / 2 : w / 2), h - 0.8, z - (alongX ? w / 2 : len / 2), x + (alongX ? len / 2 : w / 2), h - 0.25, z + (alongX ? w / 2 : len / 2), { solid: false });
}

export function vine(b: LevelBuilder, x: number, y: number, z: number, len = 3) {
  b.add(b.cyl(0.05, 0.05, len, 5), 0x3a9a3a, [x, y - len / 2, z], [0, 0, 0], [1, 1, 1], 0.015, false);
  for (let i = 0; i < 4; i++) b.add(b.sphere(0.18, 0), 0x4ab84a, [x + (i % 2 ? 0.1 : -0.1), y - (i + 0.5) * (len / 4), z], [0, i, 0], [1, 0.5, 1], 0, false);
}

// ---------------------------------------------------------------- robot city

const neonCache = new Map<string, THREE.Texture>();
function neonTexture(text: string, color: string) {
  const key = text + color;
  let t = neonCache.get(key);
  if (t) return t;
  t = canvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = '#120a24';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 10;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.font = 'bold 96px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 24;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + 4);
    g.fillStyle = '#ffffff';
    g.shadowBlur = 0;
    g.globalAlpha = 0.6;
    g.fillText(text, w / 2, h / 2 + 4);
  }, false);
  neonCache.set(key, t);
  return t;
}

export function neonSign(b: LevelBuilder, x: number, y: number, z: number, rot: number, text: string, color: string, w = 4) {
  const mat = new THREE.MeshBasicMaterial({ map: neonTexture(text, color), color: new THREE.Color(1.6, 1.6, 1.6) });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.31), mat);
  m.position.set(x, y, z);
  m.rotation.y = rot;
  const flick = Math.random() * 10;
  b.object(m, (t) => {
    const f = Math.sin(t * 13 + flick) > 0.97 ? 0.4 : 1.6;
    mat.color.setScalar(f);
  });
}

const WINDOW_TEX = new Map<number, THREE.Texture>();
function windowTexture(seed: number) {
  let t = WINDOW_TEX.get(seed);
  if (t) return t;
  t = canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#1a1830';
    g.fillRect(0, 0, w, h);
    for (let y = 8; y < h; y += 24) {
      for (let x = 8; x < w; x += 20) {
        const lit = Math.random() < 0.55;
        g.fillStyle = lit ? (Math.random() < 0.5 ? '#ffe9a0' : '#9ff4ff') : '#2a2848';
        g.fillRect(x, y, 12, 14);
      }
    }
  });
  WINDOW_TEX.set(seed, t);
  return t;
}

export function skyscraper(b: LevelBuilder, x: number, z: number, w: number, d: number, h: number, colorIdx = 0) {
  const pal = b.theme.palette;
  b.add(b.rbox(w, h, d, 0.4), pal.primary[colorIdx % pal.primary.length], [x, h / 2, z]);
  const tex = windowTexture(colorIdx % 3).clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 6)));
  const winMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.25, 1.25, 1.25) });
  for (const [ox, oz, ry, fw] of [[0, d / 2 + 0.02, 0, w], [0, -d / 2 - 0.02, Math.PI, w], [w / 2 + 0.02, 0, Math.PI / 2, d], [-w / 2 - 0.02, 0, -Math.PI / 2, d]] as const) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(fw * 0.8, h * 0.85), winMat);
    m.position.set(x + ox, h * 0.5, z + oz);
    m.rotation.y = ry;
    b.data.root.add(m);
  }
  b.add(b.rbox(w + 0.4, 0.5, d + 0.4, 0.15), pal.roof[colorIdx % pal.roof.length], [x, h, z], [0, 0, 0], [1, 1, 1], 0.04);
  b.add(b.cyl(0.08, 0.08, 3, 5), 0x8a8aa8, [x, h + 1.5, z], [0, 0, 0], [1, 1, 1], 0.02);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), glowMat(0xff3a5a, 2));
  beacon.position.set(x, h + 3.1, z);
  b.object(beacon, (t) => beacon.scale.setScalar(Math.sin(t * 3 + x) > 0 ? 1 : 0.4));
  b.solid(x, 0, z, w, h, d, false);
}

export function hologram(b: LevelBuilder, x: number, z: number, color = 0x3affd8) {
  b.add(b.cyl(0.9, 1.1, 0.5, 14), 0x3a3a54, [x, 0.25, z], [0, 0, 0], [1, 1, 1], 0.03);
  const holo = new THREE.Group();
  holo.position.set(x, 2.4, z);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4), transparent: true, opacity: 0.45, wireframe: true });
  const pig = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat);
  holo.add(pig);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.6), transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }));
  cone.position.y = -1.1;
  cone.rotation.x = Math.PI;
  holo.add(cone);
  b.object(holo, (t) => {
    pig.rotation.y = t;
    pig.position.y = Math.sin(t * 2) * 0.15;
  });
  b.post(x, z, 1.1, 0.5);
}

export function flyingCars(b: LevelBuilder, cx: number, cz: number, r: number, y: number, n = 4) {
  const cols = [0xff5ac8, 0x3affd8, 0xffe04a, 0x7a8aff];
  for (let i = 0; i < n; i++) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.4, 4, 10).rotateZ(Math.PI / 2), toon(cols[i % cols.length]));
    outline(body, 0.03);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xbfefff, { transparent: true, opacity: 0.6 }));
    dome.position.y = 0.3;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 12), glowMat(0x3affd8, 2));
    glow.rotation.x = Math.PI / 2;
    glow.position.y = -0.62;
    car.add(body, dome, glow);
    const ph = (i / n) * Math.PI * 2;
    const sp = 0.12 + i * 0.02;
    const yy = y + i * 2.2;
    b.object(car, (t) => {
      const a = ph + t * sp;
      car.position.set(cx + Math.cos(a) * r, yy + Math.sin(t * 1.3 + i) * 0.4, cz + Math.sin(a) * r);
      car.rotation.y = -a;
    });
  }
}

export function streetLamp(b: LevelBuilder, x: number, z: number, color = 0x3affd8) {
  b.add(b.cyl(0.1, 0.14, 4, 8), 0x3a3a54, [x, 2, z], [0, 0, 0], [1, 1, 1], 0.025);
  b.add(b.rbox(1.2, 0.2, 0.3, 0.08), 0x3a3a54, [x + 0.5, 4, z], [0, 0, 0], [1, 1, 1], 0.025);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), glowMat(color, 2.4));
  bulb.position.set(x + 0.9, 3.8, z);
  b.object(bulb);
  b.post(x, z, 0.15, 4);
}

// ---------------------------------------------------------------- fortress

export function castleWall(b: LevelBuilder, x: number, z: number, len: number, alongX: boolean, h = 7) {
  const st = b.theme.palette.stone;
  const w = alongX ? len : 2.4, d = alongX ? 2.4 : len;
  b.add(b.rbox(w, h, d, 0.25), st, [x, h / 2, z]);
  const n = Math.floor(len / 1.6);
  for (let i = 0; i < n; i++) {
    if (i % 2) continue;
    const t = -len / 2 + (i + 0.5) * 1.6;
    b.add(b.rbox(alongX ? 1.3 : 2.6, 1, alongX ? 2.6 : 1.3, 0.12), st, [x + (alongX ? t : 0), h + 0.5, z + (alongX ? 0 : t)], [0, 0, 0], [1, 1, 1], 0.035);
  }
  b.solid(x, 0, z, w, h + 1, d, false);
}

export function tower(b: LevelBuilder, x: number, z: number, r = 3, h = 12) {
  const st = b.theme.palette.stone;
  b.add(b.cyl(r, r * 1.08, h, 14), st, [x, h / 2, z], [0, 0, 0], [1, 1, 1], 0.05);
  b.add(b.cyl(r * 1.2, r * 1.2, 1, 14), st, [x, h + 0.5, z], [0, 0, 0], [1, 1, 1], 0.04);
  b.add(b.cone(r * 1.3, r * 1.6, 14), b.theme.palette.roof[0], [x, h + 1 + r * 0.8, z], [0, 0, 0], [1, 1, 1], 0.05);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.2), glowMat(0xffb040, 1.6));
    win.position.set(x + Math.cos(a) * (r + 0.02), h * 0.65, z + Math.sin(a) * (r + 0.02));
    win.lookAt(x + Math.cos(a) * 10, h * 0.65, z + Math.sin(a) * 10);
    b.data.root.add(win);
  }
  b.post(x, z, r, h + 1);
}

export function banner(b: LevelBuilder, x: number, y: number, z: number, rot: number, color = 0xa8302a) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rot;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2, 1, 8), toon(color, { side: THREE.DoubleSide }));
  cloth.position.y = -1.6;
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), toon(0xffd23f, { side: THREE.DoubleSide }));
  emblem.position.set(0, -1.2, 0.02);
  g.add(cloth, emblem);
  const base = (cloth.geometry.attributes.position.array as Float32Array).slice();
  b.object(g, (t) => {
    const p = cloth.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(t * 3 + base[i * 3 + 1] * 1.5 + x) * 0.15 * (1.6 - base[i * 3 + 1]) * 0.4);
    p.needsUpdate = true;
  });
}

export function torch(b: LevelBuilder, x: number, z: number, y = 0) {
  b.add(b.cyl(0.12, 0.16, 2.2, 6), 0x4a3020, [x, y + 1.1, z], [0, 0, 0], [1, 1, 1], 0.025);
  b.add(b.cyl(0.3, 0.2, 0.35, 8), 0x3a3a4a, [x, y + 2.3, z], [0, 0, 0], [1, 1, 1], 0.025);
  const flame = new THREE.Group();
  flame.position.set(x, y + 2.6, z);
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 8), glowMat(0xff7a1a, 2));
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 8), glowMat(0xffe07a, 2.5));
  inner.position.y = -0.1;
  flame.add(outer, inner);
  const ph = Math.random() * 10;
  b.object(flame, (t) => {
    const s = 1 + Math.sin(t * 17 + ph) * 0.12;
    flame.scale.set(s, 1 + Math.sin(t * 11 + ph) * 0.2, s);
  });
  b.post(x, z, 0.2, 2.4, y);
}

export function spikes(b: LevelBuilder, x: number, z: number, w: number, d: number) {
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) b.add(b.cone(0.22, 0.8, 4), 0x9aa0b0, [x - w / 2 + i + 0.5, 0.4, z - d / 2 + j + 0.5], [0, 0.78, 0], [1, 1, 1], 0.02);
}
