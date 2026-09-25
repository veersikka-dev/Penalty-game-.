import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { outline, outlineMaterial, toon } from '../render/Toon';
import type { CollisionWorld, GroundInfo } from '../physics/Collision';
import type { PowerUpId } from '../combat/types';
import { glowTexture } from '../utils/textures';
import { rand } from '../utils/MathUtils';

export type PickupType = 'token' | 'carrot' | 'star' | 'health' | 'ammo' | PowerUpId;

export const PICKUP_INFO: Record<PickupType, { name: string; color: number }> = {
  token: { name: 'Bacon Token', color: 0xff7a5a },
  carrot: { name: 'Golden Carrot', color: 0xffc93a },
  star: { name: 'Secret Star', color: 0xfff27a },
  health: { name: 'Apple Pie', color: 0xff5a6a },
  ammo: { name: 'Ammo Crate', color: 0x6ad0ff },
  golden: { name: 'Golden Pig', color: 0xffd23f },
  turbo: { name: 'Turbo Snout', color: 0x4affb0 },
  rage: { name: 'Bacon Rage', color: 0xff4a3a },
  shield: { name: 'Piggy Shield', color: 0x7fe0ff },
  giant: { name: 'Giant Pig', color: 0xb070ff },
};

interface Coin {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  settled: boolean;
  alive: boolean;
  phase: number;
  floor: number;
  value: number;
  age: number;
}

export interface Pickup {
  type: PickupType;
  group: THREE.Group;
  pos: THREE.Vector3;
  alive: boolean;
  id: string;
  phase: number;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _g: GroundInfo = { y: 0, box: null };

/** Builds the floating model for a special pickup. */
function pickupModel(type: PickupType): THREE.Group {
  const g = new THREE.Group();
  const c = PICKUP_INFO[type].color;
  const add = (m: THREE.Mesh, ink = 0.025) => {
    outline(m, ink);
    g.add(m);
    return m;
  };
  switch (type) {
    case 'token': {
      const disc = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24).rotateX(Math.PI / 2), toon(0xffc93a)));
      disc.position.y = 0;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector3(-0.25 + i * 0.05, Math.sin(i * 1.2) * 0.05, 0.07));
      const bacon = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.05, 6), toon(0xd8433a));
      g.add(bacon);
      break;
    }
    case 'carrot': {
      const body = add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 12).rotateX(Math.PI), toon(0xffc93a, { emissive: 0xffa000, emissiveIntensity: 0.4 })));
      body.position.y = 0;
      for (let i = 0; i < 3; i++) {
        const leaf = add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 5), toon(0xffe46a)), 0.012);
        leaf.position.set((i - 1) * 0.06, 0.45, 0);
        leaf.rotation.z = (i - 1) * 0.4;
      }
      break;
    }
    case 'star': {
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        const r = i % 2 ? 0.22 : 0.5;
        if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
      geo.center();
      add(new THREE.Mesh(geo, toon(0xfff27a, { emissive: 0xffd000, emissiveIntensity: 0.5 })), 0.03);
      break;
    }
    case 'health': {
      const pie = add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.22, 20), toon(0xe8a860)));
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 20), toon(0xff5a6a));
      top.position.y = 0.12;
      g.add(top);
      const cherry = add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), toon(0xff2a3a)), 0.012);
      cherry.position.y = 0.22;
      void pie;
      break;
    }
    case 'ammo': {
      add(new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.45, 0.45, 2, 0.08), toon(0x5a8a3a)));
      const band = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.12, 0.47, 2, 0.03), toon(0xffd23f));
      g.add(band);
      for (let i = 0; i < 3; i++) {
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8), toon(0xff6aa8));
        shell.position.set((i - 1) * 0.14, 0.32, 0);
        g.add(shell);
      }
      break;
    }
    default: {
      // Power-ups: a glowing orb with an icon-ish shape inside, in a spinning ring
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), toon(c, { transparent: true, opacity: 0.45 }));
      outline(orb, 0.025);
      g.add(orb);
      let icon: THREE.Mesh;
      if (type === 'golden') {
        icon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), toon(0xffd23f, { emissive: 0xffa000, emissiveIntensity: 0.6 }));
        const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12).rotateX(Math.PI / 2), toon(0xffb000));
        snout.position.z = 0.19;
        icon.add(snout);
      } else if (type === 'turbo') {
        icon = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 3).rotateZ(-Math.PI / 2), toon(0x4affb0, { emissive: 0x20ff90, emissiveIntensity: 0.6 }));
      } else if (type === 'rage') {
        icon = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), toon(0xff4a3a, { emissive: 0xff2010, emissiveIntensity: 0.7 }));
      } else if (type === 'shield') {
        icon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI), toon(0x7fe0ff, { emissive: 0x40c0ff, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
      } else {
        icon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.1), toon(0xb070ff, { emissive: 0x8040ff, emissiveIntensity: 0.6 }));
        const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 4), icon.material);
        arrowHead.position.y = 0.24;
        icon.add(arrowHead);
      }
      outline(icon, 0.015);
      g.add(icon);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.03, 6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.6) }));
      ring.rotation.x = Math.PI / 2;
      ring.name = 'ring';
      g.add(ring);
    }
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(1.8);
  g.add(halo);
  // light beam for visibility from afar
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 5, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.8), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 2;
  beam.name = 'beam';
  g.add(beam);
  return g;
}

/**
 * Coins (instanced, magnetised, physics-popped from enemies/crates) and special
 * pickups (tokens, golden carrots, stars, health, ammo, power-ups).
 */
export class PickupManager {
  readonly root = new THREE.Group();
  private coinMesh: THREE.InstancedMesh;
  private coinOutline: THREE.InstancedMesh;
  private coins: Coin[] = [];
  readonly specials: Pickup[] = [];
  magnetRadius = 3.5;
  private readonly capacity = 260;

  constructor(private world: CollisionWorld) {
    const geo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20).rotateX(Math.PI / 2);
    this.coinMesh = new THREE.InstancedMesh(geo, toon(0xffc93a, { emissive: 0xff9a00, emissiveIntensity: 0.25 }), this.capacity);
    this.coinOutline = new THREE.InstancedMesh(geo, outlineMaterial(0.025), this.capacity);
    for (const m of [this.coinMesh, this.coinOutline]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      this.root.add(m);
    }
    this.coinMesh.castShadow = true;
  }

  /** A placed, floating coin. */
  addCoin(x: number, y: number, z: number) {
    this.pushCoin({ x, y: y + 1, z, vx: 0, vy: 0, vz: 0, settled: true, alive: true, phase: Math.random() * 6, floor: y, value: 1, age: 10 });
  }

  /** Coins bursting out of something. */
  burst(pos: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(2, 4.5);
      this.world.groundAt(pos.x, pos.z, pos.y + 0.5, _g);
      this.pushCoin({ x: pos.x, y: pos.y + 0.5, z: pos.z, vx: Math.cos(a) * s, vy: rand(5, 8), vz: Math.sin(a) * s, settled: false, alive: true, phase: Math.random() * 6, floor: Number.isFinite(_g.y) ? _g.y : pos.y - 5, value: 1, age: 0 });
    }
  }

  private pushCoin(c: Coin) {
    const free = this.coins.find((k) => !k.alive);
    if (free) Object.assign(free, c);
    else if (this.coins.length < this.capacity) this.coins.push(c);
  }

  addSpecial(type: PickupType, x: number, y: number, z: number, id = ''): Pickup {
    const g = pickupModel(type);
    g.position.set(x, y + 1.1, z);
    this.root.add(g);
    const p: Pickup = { type, group: g, pos: g.position, alive: true, id, phase: Math.random() * 6 };
    this.specials.push(p);
    return p;
  }

  /** Returns coins collected this frame and specials touched. */
  update(dt: number, t: number, player: THREE.Vector3, playerScale: number): { coins: number; specials: Pickup[] } {
    let collected = 0;
    const got: Pickup[] = [];
    let n = 0;
    const px = player.x, py = player.y + 0.8, pz = player.z;
    const magnet = this.magnetRadius * playerScale;
    for (const c of this.coins) {
      if (!c.alive) continue;
      c.age += dt;
      if (!c.settled) {
        c.vy -= 22 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.z += c.vz * dt;
        if (c.y < c.floor + 0.35) {
          c.y = c.floor + 0.35;
          c.vy = Math.abs(c.vy) * 0.45;
          c.vx *= 0.6;
          c.vz *= 0.6;
          if (c.vy < 1.2) {
            c.settled = true;
            c.y = c.floor + 0.6;
          }
        }
      }
      const dx = px - c.x, dy = py - c.y, dz = pz - c.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (c.age > 0.35 && d2 < magnet * magnet) {
        const d = Math.sqrt(d2) || 1;
        const pull = Math.min(d, (10 + (magnet - d) * 8) * dt);
        c.x += (dx / d) * pull;
        c.y += (dy / d) * pull;
        c.z += (dz / d) * pull;
        c.settled = true;
      }
      if (d2 < 0.6 * playerScale) {
        c.alive = false;
        collected += c.value;
        continue;
      }
      const bob = c.settled ? Math.sin(t * 3 + c.phase) * 0.12 : 0;
      _q.setFromEuler(_e.set(0, t * 3 + c.phase, 0));
      _m.compose(_p.set(c.x, c.y + bob, c.z), _q, _s.set(1, 1, 1));
      this.coinMesh.setMatrixAt(n, _m);
      this.coinOutline.setMatrixAt(n, _m);
      n++;
    }
    this.coinMesh.count = this.coinOutline.count = n;
    this.coinMesh.instanceMatrix.needsUpdate = true;
    this.coinOutline.instanceMatrix.needsUpdate = true;

    for (const p of this.specials) {
      if (!p.alive) continue;
      const base = p.group.userData.baseY ?? (p.group.userData.baseY = p.group.position.y);
      p.group.position.y = base + Math.sin(t * 2.2 + p.phase) * 0.18;
      p.group.rotation.y += dt * 1.6;
      const ring = p.group.getObjectByName('ring');
      if (ring) ring.rotation.z += dt * 2;
      const dx = px - p.pos.x, dy = py - p.pos.y, dz = pz - p.pos.z;
      if (dx * dx + dy * dy + dz * dz < 1.4 * playerScale) {
        p.alive = false;
        this.root.remove(p.group);
        got.push(p);
      }
    }
    return { coins: collected, specials: got };
  }

  clear() {
    for (const c of this.coins) c.alive = false;
    for (const p of this.specials) this.root.remove(p.group);
    this.specials.length = 0;
  }
}
