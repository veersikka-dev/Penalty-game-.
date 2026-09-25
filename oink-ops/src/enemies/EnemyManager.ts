import * as THREE from 'three';
import { Enemy, type AIContext } from './Enemy';
import type { EnemyType } from './EnemyDefs';
import type { DamageInfo } from '../combat/types';

export interface EnemyEvents {
  onKilled(e: Enemy, info: DamageInfo): void;
  onArmorBreak(e: Enemy, pos: THREE.Vector3): void;
}

/** Owns every live enemy: spawning (with pop-in), updates, cleanup and group queries. */
export class EnemyManager {
  readonly root = new THREE.Group();
  readonly list: Enemy[] = [];

  constructor(private events: EnemyEvents) {}

  spawn(type: EnemyType, x: number, y: number, z: number, group = ''): Enemy {
    const e = new Enemy(type, x, y, z);
    e.group = group;
    e.onDeath = (en, info) => this.events.onKilled(en, info);
    this.root.add(e.rig.root);
    this.list.push(e);
    return e;
  }

  aliveIn(group: string) {
    let n = 0;
    for (const e of this.list) if (e.alive && e.group === group) n++;
    return n;
  }
  get aliveCount() {
    let n = 0;
    for (const e of this.list) if (e.alive) n++;
    return n;
  }
  /** Number of enemies actively fighting the player (drives combat music). */
  get engaged() {
    let n = 0;
    for (const e of this.list) if (e.alive && e.aggro) n++;
    return n;
  }

  update(dt: number, ctx: AIContext) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.update(dt, ctx);
      while (e.pendingArmorBreak.length) this.events.onArmorBreak(e, e.pendingArmorBreak.pop()!);
      if (e.removed) {
        this.root.remove(e.rig.root);
        this.list.splice(i, 1);
      }
    }
  }

  clear() {
    for (const e of this.list) this.root.remove(e.rig.root);
    this.list.length = 0;
  }
}
