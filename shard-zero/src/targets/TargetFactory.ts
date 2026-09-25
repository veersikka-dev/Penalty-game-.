import * as THREE from 'three';
import type { SpawnEvent, TargetKind } from '../data/types';
import { TARGET_DEFS } from './TargetDefs';
import { Target } from './Target';
import { createGlassMaterial } from '../materials/GlassMaterial';
import { makeBipyramid } from '../destruction/ShardGeometry';
import { glowTexture } from '../utils/textures';

/**
 * Builds and pools the visual representation of each target kind.
 * Geometries are shared; materials are per pooled instance so each object can
 * flash, crack and fade independently.
 */
export class TargetFactory {
  private pools = new Map<TargetKind, Target[]>();
  private geo = {
    box: new THREE.BoxGeometry(1, 1, 1),
    crystal: makeBipyramid(0.5, 0.95, 0.75, 6),
    crystalLarge: makeBipyramid(0.85, 1.6, 1.2, 6),
    rotator: makeBipyramid(0.42, 0.8, 0.8, 5),
    ico: new THREE.IcosahedronGeometry(0.62, 0),
    icoCage: new THREE.IcosahedronGeometry(1.0, 0),
    octa: new THREE.OctahedronGeometry(0.7, 0),
    dodeca: new THREE.DodecahedronGeometry(0.66, 0),
    ring: new THREE.TorusGeometry(1.05, 0.04, 6, 48),
    sphere: new THREE.SphereGeometry(0.62, 20, 14),
    weak: new THREE.SphereGeometry(0.75, 20, 14),
    core: new THREE.SphereGeometry(1, 12, 8),
  };
  private cageMatCache = new Map<number, THREE.MeshBasicMaterial>();

  acquire(kind: TargetKind): Target {
    const pool = this.pools.get(kind);
    const t = pool?.pop() ?? this.create(kind);
    return t;
  }

  release(t: Target) {
    t.alive = false;
    t.root.visible = false;
    t.custom = null;
    t.tag = null;
    t.root.parent?.remove(t.root);
    let pool = this.pools.get(t.kind);
    if (!pool) this.pools.set(t.kind, (pool = []));
    pool.push(t);
  }

  /** Pre-creates a few of each kind so first appearances don't hitch. */
  prewarm(scene: THREE.Scene) {
    const kinds = Object.keys(TARGET_DEFS) as TargetKind[];
    const made: Target[] = [];
    for (const k of kinds) for (let i = 0; i < (k === 'panel' || k === 'crystal' ? 6 : 2); i++) made.push(this.acquire(k));
    for (const t of made) {
      t.root.visible = true;
      t.root.position.set(0, -1000, 0);
      scene.add(t.root);
    }
    return () => made.forEach((t) => this.release(t));
  }

  private cageMat(color: number) {
    let m = this.cageMatCache.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), wireframe: true, transparent: true, opacity: 0.8 });
      this.cageMatCache.set(color, m);
    }
    return m;
  }

  private create(kind: TargetKind): Target {
    const def = TARGET_DEFS[kind];
    const root = new THREE.Group();
    let body: THREE.Mesh;
    let glassMat: THREE.ShaderMaterial | null = null;
    let crystalMat: THREE.MeshStandardMaterial | null = null;
    let halo: THREE.Sprite | null = null;
    let extra: THREE.Object3D | null = null;
    let cables: THREE.LineSegments | null = null;

    const mkCrystalMat = (color: number, emissive = 1.3) =>
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, metalness: 0.3, roughness: 0.12, flatShading: true, envMapIntensity: 1.6 });
    const mkHalo = (color: number, scale: number) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.scale.setScalar(scale);
      return s;
    };

    switch (kind) {
      case 'panel':
      case 'barrier':
      case 'hanging':
      case 'shieldPlate': {
        glassMat = createGlassMaterial(def.color);
        body = new THREE.Mesh(this.geo.box, glassMat);
        body.renderOrder = 2;
        root.add(body);
        if (kind === 'hanging') {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
          cables = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb4d0, transparent: true, opacity: 0.6 }));
          root.add(cables);
        }
        break;
      }
      case 'crystal':
      case 'crystalLarge':
      case 'rotator': {
        crystalMat = mkCrystalMat(def.color);
        body = new THREE.Mesh(kind === 'crystal' ? this.geo.crystal : kind === 'crystalLarge' ? this.geo.crystalLarge : this.geo.rotator, crystalMat);
        halo = mkHalo(def.color, def.radius * 3.2);
        root.add(body, halo);
        break;
      }
      case 'explosive': {
        crystalMat = mkCrystalMat(def.color, 1.8);
        body = new THREE.Mesh(this.geo.ico, crystalMat);
        extra = new THREE.Mesh(this.geo.icoCage, this.cageMat(0xff6a3a));
        halo = mkHalo(0xff5a2a, 3.4);
        root.add(body, extra, halo);
        break;
      }
      case 'timeCrystal':
      case 'multiplier': {
        crystalMat = mkCrystalMat(def.color, 1.6);
        body = new THREE.Mesh(kind === 'timeCrystal' ? this.geo.octa : this.geo.dodeca, crystalMat);
        const ring = new THREE.Mesh(this.geo.ring, this.cageMat(def.color));
        const ring2 = ring.clone();
        ring2.rotation.x = Math.PI / 2;
        extra = new THREE.Group();
        extra.add(ring, ring2);
        halo = mkHalo(def.color, 3.6);
        root.add(body, extra, halo);
        break;
      }
      case 'weakpoint': {
        crystalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff5a8a, emissiveIntensity: 3, roughness: 0.2, metalness: 0.2 });
        body = new THREE.Mesh(this.geo.weak, crystalMat);
        extra = new THREE.Mesh(this.geo.icoCage, this.cageMat(0xff2a5a));
        extra.scale.setScalar(1.35);
        halo = mkHalo(0xff3a6a, 5);
        root.add(body, extra, halo);
        break;
      }
      case 'bossOrb': {
        crystalMat = new THREE.MeshStandardMaterial({ color: 0x220010, emissive: def.color, emissiveIntensity: 3.2, roughness: 0.3 });
        body = new THREE.Mesh(this.geo.sphere, crystalMat);
        extra = new THREE.Mesh(this.geo.icoCage, this.cageMat(0xff80d0));
        extra.scale.setScalar(0.95);
        halo = mkHalo(def.color, 3.2);
        root.add(body, extra, halo);
        break;
      }
      case 'bossCore':
      default: {
        body = new THREE.Mesh(this.geo.core, new THREE.MeshBasicMaterial({ visible: false }));
        root.add(body);
        break;
      }
    }
    root.visible = false;
    return new Target(kind, def, root, body, glassMat, crystalMat, halo, extra, cables);
  }

  /** Resets a pooled target for a new spawn event. */
  configure(t: Target, ev: SpawnEvent, z: number, glassColor: number) {
    const def = t.def;
    t.alive = true;
    t.dying = -1;
    t.hp = ev.hp ?? def.hp;
    t.maxHp = t.hp;
    t.age = 0;
    t.flash = 0;
    t.crack = 0;
    t.crackTarget = 0;
    t.passed = false;
    t.cause = 'shot';
    t.custom = null;
    t.tag = null;
    t.phase = Math.random() * Math.PI * 2;
    t.spin = 0.4 + Math.random() * 0.8;
    t.motion = ev.motion ?? { type: 'static' };
    t.base.set(ev.x ?? 0, ev.y ?? 2.5, z);
    t.tilt = ev.tilt ?? 0;
    t.root.visible = true;
    t.root.position.copy(t.base);
    t.root.rotation.set(0, 0, 0);
    t.root.scale.setScalar(1);
    t.body.position.set(0, 0, 0);
    t.body.rotation.set(0, 0, 0);
    t.body.scale.setScalar(1);

    if (t.glassMat) {
      t.w = ev.w ?? (t.kind === 'shieldPlate' ? 2.4 : 4);
      t.h = ev.h ?? (t.kind === 'shieldPlate' ? 1.6 : 3);
      t.depth = t.kind === 'barrier' ? 0.35 : 0.12;
      t.body.scale.set(t.w, t.h, t.depth);
      t.body.rotation.z = t.tilt;
      const u = t.glassMat.uniforms;
      const color = t.kind === 'panel' || t.kind === 'hanging' ? glassColor : def.color;
      u.uColor.value.set(color);
      u.uCrack.value = 0;
      u.uDamage.value = 0;
      u.uFlash.value = 0;
      u.uSize.value.set(t.w, t.h);
      u.uOpacity.value = t.kind === 'barrier' ? 0.42 : 0.26;
      u.uEdge.value = t.kind === 'barrier' ? 3.2 : 2.4;
      if (t.kind === 'hanging' && t.cables) {
        const len = t.motion.type === 'pendulum' ? t.motion.length : 3;
        t.body.position.y = -len;
        const p = t.cables.geometry.attributes.position as THREE.BufferAttribute;
        const hw = t.w * 0.4;
        p.setXYZ(0, -hw, 0, 0); p.setXYZ(1, -hw, -len + t.h / 2, 0);
        p.setXYZ(2, hw, 0, 0); p.setXYZ(3, hw, -len + t.h / 2, 0);
        p.needsUpdate = true;
      }
    }
    if (t.crystalMat) {
      t.crystalMat.emissiveIntensity = t.kind === 'weakpoint' || t.kind === 'bossOrb' ? 3 : 1.3;
    }
    if (t.halo) (t.halo.material as THREE.SpriteMaterial).opacity = 0.55;
    t.radius = def.radius;
  }
}
