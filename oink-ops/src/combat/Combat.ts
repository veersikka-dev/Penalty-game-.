import * as THREE from 'three';
import type { Damageable, DamageInfo, HitShape } from './types';
import type { CollisionWorld } from '../physics/Collision';
import type { VFXManager } from '../effects/VFXManager';
import type { WeaponDef } from '../weapons/WeaponDefs';
import { outline, toon } from '../render/Toon';

export interface TargetHit {
  target: Damageable;
  shape: HitShape;
  dist: number;
  point: THREE.Vector3;
}

export interface AimResult {
  point: THREE.Vector3;
  target: Damageable | null;
  weak: boolean;
  dist: number;
}

type ProjKind = 'carrot' | 'egg' | 'bubble' | 'toast' | 'enemyBubble' | 'missile' | 'bacon';

interface Projectile {
  kind: ProjKind;
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  gravity: number;
  life: number;
  fuse: number;
  bounces: number;
  radius: number;
  damage: number;
  splash: number;
  splashDamage: number;
  knock: number;
  trap: number;
  team: 'player' | 'enemy';
  alive: boolean;
  spin: THREE.Vector3;
}

export interface CombatHooks {
  /** A player projectile/hitscan landed on something damageable. */
  onHit(target: Damageable, info: DamageInfo, dealt: number): void;
  /** Something hurts the player. */
  hurtPlayer(amount: number, from: THREE.Vector3, knock: number): void;
  sound(name: 'explosion' | 'impact' | 'bounce' | 'pop' | 'splat' | 'wave' | 'shockwave', pos: THREE.Vector3): void;
  shake(amount: number, pos: THREE.Vector3): void;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _qi = new THREE.Quaternion();
const _o = new THREE.Vector3();

function projectileModel(kind: ProjKind): THREE.Object3D {
  const g = new THREE.Group();
  switch (kind) {
    case 'carrot': {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 10).rotateX(Math.PI / 2), toon(0xff8a2a));
      outline(c, 0.02);
      g.add(c);
      for (let i = 0; i < 3; i++) {
        const l = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 4).rotateX(-Math.PI / 2), toon(0x4fd14a));
        l.position.set((i - 1) * 0.04, 0, -0.32);
        g.add(l);
      }
      break;
    }
    case 'egg': {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), toon(0xfff6e0));
      e.scale.set(1, 1.3, 1);
      outline(e, 0.02);
      g.add(e);
      const spot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), toon(0xff5a3a));
      spot.position.set(0.1, 0.05, 0.08);
      g.add(spot);
      break;
    }
    case 'bubble':
    case 'enemyBubble': {
      const b = new THREE.Mesh(new THREE.SphereGeometry(kind === 'bubble' ? 0.35 : 0.3, 18, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc8f6ff).multiplyScalar(1.3), transparent: true, opacity: 0.45, depthWrite: false }));
      g.add(b);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.position.set(0.12, 0.14, 0.12);
      g.add(hl);
      break;
    }
    case 'toast': {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.08), toon(0xf2c27a));
      outline(t, 0.02);
      const crust = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.37, 0.06), toon(0xa8632a));
      t.add(crust);
      g.add(t);
      break;
    }
    case 'missile':
    case 'bacon': {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 4, 10).rotateX(Math.PI / 2), toon(kind === 'bacon' ? 0xd8433a : 0x9aa4b8));
      outline(body, 0.025);
      g.add(body);
      const stripe = new THREE.Mesh(new THREE.CapsuleGeometry(0.185, 0.2, 4, 10).rotateX(Math.PI / 2), toon(0xffe0c8));
      g.add(stripe);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa040).multiplyScalar(2) }));
      flame.position.z = -0.5;
      g.add(flame);
      break;
    }
  }
  g.traverse((o) => ((o as THREE.Mesh).isMesh && o.name !== 'outline' ? (o.castShadow = true) : null));
  return g;
}

/**
 * Combat hub: aiming (camera raycast + subtle aim assist), hitscan, projectiles
 * (player and enemy), explosions with falloff and knockback, shockwaves, and
 * the Piggy Pulse cone.
 */
export class Combat {
  readonly root = new THREE.Group();
  private projectiles: Projectile[] = [];
  private pools = new Map<ProjKind, THREE.Object3D[]>();
  private shockwaves: { pos: THREE.Vector3; r: number; max: number; speed: number; damage: number; hit: boolean; ring: THREE.Mesh }[] = [];
  targets: () => Iterable<Damageable> = () => [];
  playerPos = new THREE.Vector3();
  playerGrounded = true;
  playerRadius = 0.45;

  constructor(private world: CollisionWorld, private vfx: VFXManager, private hooks: CombatHooks) {}

  // ------------------------------------------------------------------ queries

  private rayShape(o: THREE.Vector3, d: THREE.Vector3, s: HitShape, max: number): number {
    if (s.type === 'sphere') {
      _v.subVectors(o, s.c);
      const b = _v.dot(d);
      const c = _v.lengthSq() - s.r * s.r;
      const disc = b * b - c;
      if (disc < 0) return -1;
      let t = -b - Math.sqrt(disc);
      if (t < 0) t = c < 0 ? 0 : -1;
      return t >= 0 && t <= max ? t : -1;
    }
    // oriented box: slab test in local frame
    _qi.copy(s.quat ?? _qi.identity()).invert();
    _o.subVectors(o, s.c).applyQuaternion(_qi);
    _dir.copy(d).applyQuaternion(_qi);
    let tmin = 0, tmax = max;
    for (const ax of ['x', 'y', 'z'] as const) {
      const h = s.half[ax];
      if (Math.abs(_dir[ax]) < 1e-9) {
        if (_o[ax] < -h || _o[ax] > h) return -1;
        continue;
      }
      let t1 = (-h - _o[ax]) / _dir[ax];
      let t2 = (h - _o[ax]) / _dir[ax];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
    return tmin;
  }

  /** Nearest damageable along a ray (weak spots win ties so crits register). */
  raycastTargets(o: THREE.Vector3, d: THREE.Vector3, max: number): TargetHit | null {
    let best: TargetHit | null = null;
    for (const t of this.targets()) {
      if (!t.alive) continue;
      for (const s of t.shapes) {
        const dist = this.rayShape(o, d, s, best ? best.dist + (s.weak ? 0.3 : 0) : max);
        if (dist < 0) continue;
        if (!best || dist < best.dist - (s.weak ? 0.3 : 0) || (s.weak && Math.abs(dist - best.dist) < 0.3)) {
          best = { target: t, shape: s, dist, point: o.clone().addScaledVector(d, dist) };
        }
      }
    }
    return best;
  }

  /**
   * What the crosshair is pointing at: nearest of world geometry and targets,
   * with a gentle pull toward nearby enemies (aim assist).
   */
  aim(camPos: THREE.Vector3, camDir: THREE.Vector3, max: number, assistAngle: number): AimResult & { dir: THREE.Vector3 } {
    const dir = camDir.clone();
    // aim assist: nudge toward the closest assistable shape within a small cone
    let bestAng = assistAngle;
    let assistTo: THREE.Vector3 | null = null;
    for (const t of this.targets()) {
      if (!t.alive || !t.assist) continue;
      for (const s of t.shapes) {
        _v.subVectors(s.c, camPos);
        const dist = _v.length();
        if (dist > max || dist < 2) continue;
        const ang = _v.divideScalar(dist).angleTo(camDir);
        const angAdj = ang - (s.type === 'sphere' ? Math.atan(s.r / dist) : 0) * 0.5;
        if (angAdj < bestAng && !this.world.blocked(camPos, s.c)) {
          bestAng = angAdj;
          assistTo = s.c;
        }
      }
    }
    if (assistTo) {
      _v.subVectors(assistTo, camPos).normalize();
      dir.lerp(_v, 0.35).normalize();
    }
    const wh = this.world.raycast(camPos, dir, max, true);
    const th = this.raycastTargets(camPos, dir, wh ? wh.dist : max);
    if (th) return { point: th.point, target: th.target, weak: !!th.shape.weak, dist: th.dist, dir };
    const dist = wh ? wh.dist : max;
    return { point: camPos.clone().addScaledVector(dir, dist), target: null, weak: false, dist, dir };
  }

  // ------------------------------------------------------------------ player fire

  /** Instant-hit shot (Bacon Blaster). Returns what it hit. */
  hitscan(from: THREE.Vector3, dir: THREE.Vector3, def: WeaponDef, damageMult: number, tracerColor: number): { point: THREE.Vector3; hit: Damageable | null; weak: boolean } {
    const wh = this.world.raycast(from, dir, def.range, true);
    const maxD = wh ? wh.dist : def.range;
    const th = this.raycastTargets(from, dir, maxD);
    const end = th ? th.point : wh ? wh.point : from.clone().addScaledVector(dir, def.range);
    this.vfx.tracer(from, end, tracerColor, 0.04, 0.07);
    if (th) {
      const info: DamageInfo = { amount: def.damage * damageMult, point: th.point, dir: dir.clone(), knockback: def.knockback, weak: !!th.shape.weak, source: 'player', weapon: def.id, shape: th.shape };
      this.applyHit(th.target, info);
      return { point: th.point, hit: th.target, weak: info.weak };
    }
    if (wh) {
      this.vfx.impact(wh.point, wh.normal, 0xffe0a0, 1);
      this.hooks.sound('impact', wh.point);
    }
    return { point: end, hit: null, weak: false };
  }

  private applyHit(target: Damageable, info: DamageInfo) {
    const before = (target as unknown as { hp?: number }).hp ?? 0;
    target.takeDamage(info);
    const after = (target as unknown as { hp?: number }).hp ?? 0;
    this.hooks.onHit(target, info, Math.max(0, before - Math.max(0, after)));
  }

  private acquire(kind: ProjKind): THREE.Object3D {
    const pool = this.pools.get(kind) ?? [];
    this.pools.set(kind, pool);
    const m = pool.pop() ?? projectileModel(kind);
    m.visible = true;
    this.root.add(m);
    return m;
  }

  private spawnProj(p: Omit<Projectile, 'mesh' | 'alive' | 'spin'> & { spin?: THREE.Vector3 }) {
    const proj: Projectile = { ...p, mesh: this.acquire(p.kind), alive: true, spin: p.spin ?? new THREE.Vector3() };
    proj.mesh.position.copy(p.pos);
    this.projectiles.push(proj);
    return proj;
  }

  /** Physical projectile weapons (carrot, egg, bubble). */
  fireProjectile(from: THREE.Vector3, dir: THREE.Vector3, def: WeaponDef, damageMult: number) {
    const kind: ProjKind = def.id === 'carrot' ? 'carrot' : def.id === 'egg' ? 'egg' : 'bubble';
    this.spawnProj({
      kind, pos: from.clone(), vel: dir.clone().multiplyScalar(def.projSpeed ?? 30), gravity: def.gravity ?? 0,
      life: 5, fuse: def.fuse ?? 99, bounces: 0, radius: kind === 'bubble' ? 0.35 : 0.18,
      damage: def.damage * damageMult, splash: def.splash ?? 0, splashDamage: (def.splashDamage ?? 0) * damageMult,
      knock: def.knockback, trap: def.trap ?? 0, team: 'player',
      spin: kind === 'egg' ? new THREE.Vector3(8, 3, 0) : new THREE.Vector3(0, 0, 10),
    });
  }

  /** Piggy Pulse: a cone shockwave in front of the player. */
  pulse(from: THREE.Vector3, dir: THREE.Vector3, def: WeaponDef, damageMult: number) {
    const cosHalf = Math.cos(0.6);
    this.vfx.ring(from.clone().addScaledVector(dir, 1.2), def.color, def.range * 0.7, 0.35, 0.9);
    this.vfx.ring(from.clone().addScaledVector(dir, 2.5), 0xffffff, def.range * 0.9, 0.4, 0.6);
    this.vfx.puffs.cloud(from.clone().addScaledVector(dir, 2), 8, 0.5, 8, 0xd8c0ff, 0.5, 0.4);
    this.hooks.sound('wave', from);
    for (const t of this.targets()) {
      if (!t.alive) continue;
      _v.subVectors(t.position, from);
      const d = _v.length();
      if (d > def.range + 1) continue;
      _v2.copy(_v).setY(0).normalize();
      if (_v2.dot(_dir.copy(dir).setY(0).normalize()) < cosHalf && d > 1.8) continue;
      if (this.world.blocked(from, t.shapes[0]?.c ?? t.position)) continue;
      const falloff = 1 - Math.min(1, d / (def.range + 1)) * 0.5;
      this.applyHit(t, { amount: def.damage * damageMult * falloff, point: t.shapes[0]?.c.clone() ?? t.position.clone(), dir: _v2.clone(), knockback: def.knockback * falloff, weak: false, source: 'player', weapon: def.id, shape: t.shapes[0] });
    }
  }

  // ------------------------------------------------------------------ enemy fire

  enemyShoot(kind: 'toast' | 'bubble' | 'missile' | 'bacon', from: THREE.Vector3, target: THREE.Vector3, speed: number, damage = 9) {
    _v.subVectors(target, from);
    const flat = Math.hypot(_v.x, _v.z);
    const t = flat / speed;
    const g = kind === 'toast' ? 9 : kind === 'missile' || kind === 'bacon' ? 6 : 0;
    const vel = new THREE.Vector3(_v.x / t, _v.y / t + 0.5 * g * t, _v.z / t);
    const pk: ProjKind = kind === 'bubble' ? 'enemyBubble' : kind;
    this.spawnProj({
      kind: pk, pos: from.clone(), vel, gravity: g, life: 6, fuse: 99, bounces: 0, radius: kind === 'bubble' ? 0.3 : 0.25,
      damage, splash: kind === 'missile' || kind === 'bacon' ? 3 : 0, splashDamage: kind === 'missile' || kind === 'bacon' ? damage : 0,
      knock: 5, trap: 0, team: 'enemy', spin: new THREE.Vector3(6, 9, 0),
    });
  }

  // ------------------------------------------------------------------ area damage

  explode(pos: THREE.Vector3, radius: number, damage: number, knock: number, source: 'player' | 'enemy' | 'explosion', sourceTarget?: Damageable) {
    this.vfx.explosion(pos, radius * 0.55);
    this.hooks.sound('explosion', pos);
    this.hooks.shake(Math.min(1, radius * 0.12), pos);
    for (const t of this.targets()) {
      if (!t.alive || t === sourceTarget) continue;
      const c = t.shapes[0]?.c ?? t.position;
      const d = c.distanceTo(pos);
      if (d > radius + 0.8) continue;
      const k = 1 - Math.min(1, d / (radius + 0.8));
      _v.subVectors(c, pos).normalize();
      this.applyHit(t, { amount: damage * (0.35 + 0.65 * k), point: c.clone(), dir: _v.clone(), knockback: knock * k, weak: false, source: source === 'enemy' ? 'enemy' : 'explosion', shape: t.shapes[0] });
    }
    // the player is caught too (much less for their own explosions — it's a cartoon)
    const pd = _v.copy(this.playerPos).setY(this.playerPos.y + 0.8).distanceTo(pos);
    if (pd < radius) {
      const k = 1 - pd / radius;
      this.hooks.hurtPlayer(damage * k * (source === 'enemy' ? 0.5 : 0.15), pos, knock * k);
    }
  }

  /** Expanding ground ring (boar slam, boss stomp) that hurts a grounded player. */
  shockwave(pos: THREE.Vector3, radius: number, damage: number) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc080).multiplyScalar(1.5), transparent: true, opacity: 0.9 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(pos).setY(pos.y + 0.15);
    this.root.add(ring);
    this.shockwaves.push({ pos: pos.clone(), r: 0.5, max: radius, speed: 11, damage, hit: false, ring });
    this.vfx.puffs.ring(pos, 18, 1.2, 0.45, 0xd8c8a8, 7);
    this.hooks.sound('shockwave', pos);
    this.hooks.shake(0.5, pos);
  }

  // ------------------------------------------------------------------ update

  update(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.fuse -= dt;
      const prev = _v2.copy(p.pos);
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      if (p.kind === 'carrot' || p.kind === 'missile' || p.kind === 'bacon') p.mesh.lookAt(_v.copy(p.pos).add(p.vel));
      else p.mesh.rotation.z += p.spin.z * dt;
      if (p.kind === 'missile' || p.kind === 'bacon' || p.kind === 'carrot') {
        if (Math.random() < 0.6) this.vfx.puffs.emit(p.pos.x, p.pos.y, p.pos.z, 0, 0.3, 0, 0.12, 0.4, p.kind === 'carrot' ? 0xfff0e0 : 0xb8b0c0, 1.6, 0.3);
      }
      let done = p.life <= 0;
      const seg = _dir.subVectors(p.pos, prev);
      const segLen = seg.length();
      if (!done && segLen > 1e-5) {
        seg.divideScalar(segLen);
        const wh = this.world.raycast(prev, seg, segLen + p.radius, true);
        if (p.team === 'player') {
          const th = this.raycastTargets(prev, seg, (wh ? wh.dist : segLen) + p.radius);
          if (th) {
            done = this.projectileHit(p, th.target, th.shape, th.point);
          } else if (wh) {
            if (p.kind === 'egg' && p.bounces < 4) {
              p.pos.copy(wh.point).addScaledVector(wh.normal, p.radius + 0.01);
              const vn = p.vel.dot(wh.normal);
              p.vel.addScaledVector(wh.normal, -1.65 * vn).multiplyScalar(0.72);
              p.bounces++;
              this.hooks.sound('bounce', p.pos);
            } else done = true;
          }
        } else {
          // enemy projectile vs player
          _v.copy(this.playerPos).setY(this.playerPos.y + 0.8);
          if (_v.distanceTo(p.pos) < this.playerRadius + p.radius + 0.3) {
            this.hooks.hurtPlayer(p.damage, p.pos, p.knock);
            done = true;
          } else if (wh) done = true;
        }
      }
      if (p.fuse <= 0) done = true;
      if (done) {
        this.detonate(p);
        p.alive = false;
        p.mesh.visible = false;
        this.root.remove(p.mesh);
        this.pools.get(p.kind)!.push(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.r += s.speed * dt;
      s.ring.scale.setScalar(s.r);
      (s.ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - s.r / s.max);
      const pd = Math.hypot(this.playerPos.x - s.pos.x, this.playerPos.z - s.pos.z);
      if (!s.hit && Math.abs(pd - s.r) < 0.9 && this.playerGrounded && Math.abs(this.playerPos.y - s.pos.y) < 1.2) {
        s.hit = true;
        this.hooks.hurtPlayer(s.damage, s.pos, 9);
      }
      if (s.r >= s.max) {
        this.root.remove(s.ring);
        s.ring.geometry.dispose();
        this.shockwaves.splice(i, 1);
      }
    }
  }

  /** Returns true if the projectile should be consumed. */
  private projectileHit(p: Projectile, target: Damageable, shape: HitShape, point: THREE.Vector3): boolean {
    const dir = p.vel.clone().normalize();
    if (p.kind === 'bubble') {
      this.applyHit(target, { amount: p.damage, point, dir, knockback: 0, weak: false, source: 'player', weapon: 'bubble', trap: target.kind === 'enemy' ? p.trap : 0, shape });
      this.vfx.pickupSparkle(point, 0xbff6ff);
      this.hooks.sound('pop', point);
      return true;
    }
    this.applyHit(target, { amount: p.damage, point, dir, knockback: p.knock * 0.5, weak: !!shape.weak, source: 'player', weapon: p.kind === 'carrot' ? 'carrot' : 'egg', shape });
    return true;
  }

  private detonate(p: Projectile) {
    if (p.splash > 0) {
      this.explode(p.pos, p.splash, p.splashDamage, p.knock, p.team === 'enemy' ? 'enemy' : 'player');
    } else if (p.kind === 'toast') {
      this.vfx.puffs.cloud(p.pos, 4, 0.25, 2, 0xf2c27a, 0.4);
      this.hooks.sound('splat', p.pos);
    } else if (p.kind === 'enemyBubble' || p.kind === 'bubble') {
      this.vfx.sparks(p.pos, 0xbff6ff, 10, 3, 0.1, 0.4, -1);
      this.hooks.sound('pop', p.pos);
    }
  }

  clear() {
    for (const p of this.projectiles) {
      this.root.remove(p.mesh);
      this.pools.get(p.kind)!.push(p.mesh);
    }
    this.projectiles.length = 0;
    for (const s of this.shockwaves) this.root.remove(s.ring);
    this.shockwaves.length = 0;
  }
}
