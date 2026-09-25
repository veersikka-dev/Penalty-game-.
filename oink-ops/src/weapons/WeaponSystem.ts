import * as THREE from 'three';
import { WEAPONS, WEAPON_ORDER, type WeaponDef, type WeaponId } from './WeaponDefs';
import { WeaponModel, WEAPON_SKINS } from './WeaponModels';
import type { PigModel } from '../player/PigModel';
import type { PigAnimator } from '../player/PigAnimator';
import type { Combat } from '../combat/Combat';

export interface WeaponEvents {
  onFire(def: WeaponDef, muzzle: THREE.Vector3, dir: THREE.Vector3, result: { hit: boolean; weak: boolean }): void;
  onReloadStart(def: WeaponDef): void;
  onReloadEnd(def: WeaponDef): void;
  onEmpty(def: WeaponDef): void;
  onSwitch(def: WeaponDef): void;
}

export interface FireContext {
  aimPoint: THREE.Vector3;
  camDir: THREE.Vector3;
  aiming: boolean;
  fireRateMult: number;
  damageMult: number;
  chest: THREE.Vector3;
}

const _muzzle = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();

/**
 * Inventory, ammo, reloading and fire cadence. Shots leave the actual muzzle and
 * travel toward the point under the crosshair (resolved by a camera raycast),
 * so what you aim at is what you hit.
 */
export class WeaponSystem {
  owned = new Set<WeaponId>(['blaster']);
  current: WeaponId = 'blaster';
  readonly ammo: Record<WeaponId, { mag: number; reserve: number }>;
  private models = new Map<WeaponId, WeaponModel>();
  private cooldown = 0;
  private reloadT = -1;
  private reloadDur = 1;
  private switchT = 1;
  private emptyClickT = 0;
  magBonus = 0;
  reloadMult = 1;
  skin = 'classic';

  constructor(private pig: PigModel, private anim: PigAnimator, private events: WeaponEvents) {
    this.ammo = {} as Record<WeaponId, { mag: number; reserve: number }>;
    for (const id of WEAPON_ORDER) this.ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve ?? 0 };
    this.buildModels();
    this.attach(this.current);
  }

  get def(): WeaponDef {
    return WEAPONS[this.current];
  }
  magSize(id: WeaponId = this.current) {
    return WEAPONS[id].mag + (id === 'blaster' ? this.magBonus : Math.floor(this.magBonus / 6));
  }
  get reloading() {
    return this.reloadT >= 0;
  }
  get reloadProgress() {
    return this.reloadT >= 0 ? this.reloadT / this.reloadDur : 0;
  }
  get model() {
    return this.models.get(this.current)!;
  }

  setSkin(skin: string) {
    if (!WEAPON_SKINS[skin]) skin = 'classic';
    this.skin = skin;
    for (const m of this.models.values()) m.group.removeFromParent();
    this.models.clear();
    this.buildModels();
    this.attach(this.current);
  }

  private buildModels() {
    for (const id of WEAPON_ORDER) this.models.set(id, new WeaponModel(id, WEAPON_SKINS[this.skin]));
  }

  private attach(id: WeaponId) {
    for (const m of this.models.values()) m.group.removeFromParent();
    const m = this.models.get(id)!;
    this.pig.weaponRoot.add(m.group);
    this.anim.weapon = m;
  }

  unlock(id: WeaponId) {
    this.owned.add(id);
  }

  /** Refill everything (level start). */
  resetAmmo() {
    for (const id of WEAPON_ORDER) this.ammo[id] = { mag: this.magSize(id), reserve: WEAPONS[id].reserve ?? 0 };
    this.reloadT = -1;
  }

  /** Ammo crate: tops up special weapons. */
  addAmmo() {
    for (const id of WEAPON_ORDER) {
      const d = WEAPONS[id];
      if (d.reserve === null) continue;
      this.ammo[id].reserve = Math.min(d.maxReserve, this.ammo[id].reserve + Math.ceil(d.maxReserve * 0.5));
    }
  }

  equip(id: WeaponId) {
    if (!this.owned.has(id) || id === this.current) return;
    this.current = id;
    this.reloadT = -1;
    this.switchT = 0;
    this.cooldown = 0.25;
    this.attach(id);
    this.events.onSwitch(this.def);
  }

  cycle(dir: number) {
    const list = WEAPON_ORDER.filter((w) => this.owned.has(w));
    const i = list.indexOf(this.current);
    this.equip(list[(i + dir + list.length) % list.length]);
  }

  startReload() {
    const a = this.ammo[this.current];
    const d = this.def;
    if (this.reloadT >= 0 || a.mag >= this.magSize()) return;
    if (d.reserve !== null && a.reserve <= 0) return;
    this.reloadT = 0;
    this.reloadDur = d.reload * this.reloadMult;
    this.anim.reload(this.reloadDur);
    this.events.onReloadStart(d);
  }

  update(dt: number, t: number, fireHeld: boolean, firePressed: boolean, ctx: FireContext, combat: Combat) {
    this.cooldown -= dt;
    this.emptyClickT -= dt;
    this.switchT = Math.min(1, this.switchT + dt * 5);
    const m = this.model;
    const pop = this.switchT < 1 ? 0.6 + 0.4 * Math.sin(this.switchT * Math.PI * 0.5) : 1;
    m.group.scale.setScalar(pop);
    m.update(dt, t);

    const d = this.def;
    const a = this.ammo[this.current];
    if (this.reloadT >= 0) {
      this.reloadT += dt;
      if (this.reloadT >= this.reloadDur) {
        const need = this.magSize() - a.mag;
        const take = d.reserve === null ? need : Math.min(need, a.reserve);
        a.mag += take;
        if (d.reserve !== null) a.reserve -= take;
        this.reloadT = -1;
        this.events.onReloadEnd(d);
      }
      return;
    }
    const wants = d.auto ? fireHeld : firePressed;
    if (!wants || this.cooldown > 0) return;
    if (a.mag <= 0) {
      if (this.emptyClickT <= 0) {
        this.events.onEmpty(d);
        this.emptyClickT = 0.35;
      }
      this.startReload();
      return;
    }
    a.mag--;
    this.cooldown = d.fireInterval / ctx.fireRateMult;
    m.muzzle.getWorldPosition(_muzzle);
    // Direction: from the muzzle toward the crosshair target (fallback to camera dir if too close)
    _dir.subVectors(ctx.aimPoint, _muzzle);
    if (_dir.length() < 1.5 || _dir.dot(ctx.camDir) < 0) _dir.copy(ctx.camDir);
    _dir.normalize();
    const spread = ctx.aiming ? d.aimSpread : d.hipSpread;
    if (spread > 0) {
      _dir.x += (Math.random() - 0.5) * spread * 2;
      _dir.y += (Math.random() - 0.5) * spread * 2;
      _dir.z += (Math.random() - 0.5) * spread * 2;
      _dir.normalize();
    }
    let result = { hit: false, weak: false };
    if (d.kind === 'hitscan') {
      const r = combat.hitscan(_muzzle, _dir, d, ctx.damageMult, d.color);
      result = { hit: !!r.hit, weak: r.weak };
      _right.set(1, 0, 0).applyQuaternion(this.pig.root.quaternion);
    } else if (d.kind === 'projectile') {
      combat.fireProjectile(_muzzle.clone().addScaledVector(_dir, 0.2), _dir.clone(), d, ctx.damageMult);
    } else {
      combat.pulse(ctx.chest, ctx.camDir.clone(), d, ctx.damageMult);
    }
    m.fired();
    this.anim.shot();
    this.events.onFire(d, _muzzle.clone(), _dir.clone(), result);
    if (a.mag <= 0) setTimeout(() => this.startReload(), 180);
  }
}
