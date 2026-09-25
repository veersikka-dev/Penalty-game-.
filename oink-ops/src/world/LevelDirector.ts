import * as THREE from 'three';
import type { EncounterDef, ObjectiveDef } from './LevelBuilder';
import type { EnemyType } from '../enemies/EnemyDefs';

export interface DirectorHooks {
  spawnEnemy(type: EnemyType, x: number, z: number, group: string, dropIn: boolean): void;
  aliveInGroup(group: string): number;
  countTag(tag: string): number;
  nearestTag(tag: string, from: THREE.Vector3): THREE.Vector3 | null;
  openGate(id: string): void;
  objectiveChanged(text: string, index: number, total: number): void;
  objectiveDone(text: string, index: number): void;
  waveStarted(wave: number, total: number): void;
  checkpoint(x: number, z: number): void;
  startBoss(): void;
  bossDefeated(): boolean;
  levelComplete(): void;
}

/**
 * Runs a level's objective chain: reach points, multi-wave encounters, destroy
 * targets (generators), boss, exit. Each completed step opens gates, moves the
 * checkpoint and hands the player the next goal with a world-space marker.
 */
export class LevelDirector {
  private objectives: ObjectiveDef[] = [];
  private encounters = new Map<string, EncounterDef>();
  index = 0;
  private wave = -1;
  private waveWait = 0;
  private started = false;
  private tagTotal = 0;
  done = false;
  readonly marker = new THREE.Vector3();
  markerActive = false;
  progressText = '';
  private bossStarted = false;
  private viaIndex = 0;

  constructor(private hooks: DirectorHooks) {}

  load(objectives: ObjectiveDef[], encounters: EncounterDef[]) {
    this.objectives = objectives;
    this.encounters = new Map(encounters.map((e) => [e.id, e]));
    this.index = 0;
    this.done = false;
    this.bossStarted = false;
    this.enter();
  }

  /** Resume at a given objective (checkpoint restart keeps progress). */
  restartStep() {
    const o = this.current;
    if (o?.type === 'encounter') {
      this.started = false;
      this.wave = -1;
    }
    this.enter(false);
  }

  get current(): ObjectiveDef | undefined {
    return this.objectives[this.index];
  }
  get total() {
    return this.objectives.length;
  }
  get inCombat() {
    return this.current?.type === 'encounter' && this.started;
  }

  private enter(announce = true) {
    const o = this.current;
    if (!o) return;
    this.started = false;
    this.wave = -1;
    this.waveWait = 0;
    this.markerActive = true;
    this.viaIndex = 0;
    this.marker.set(o.x, 1.5, o.z);
    if (o.type === 'destroy') this.tagTotal = Math.max(this.tagTotal, this.hooks.countTag(o.tag));
    this.updateText();
    if (announce) this.hooks.objectiveChanged(o.text, this.index, this.objectives.length);
  }

  private updateText() {
    const o = this.current;
    if (!o) {
      this.progressText = '';
      return;
    }
    if (o.type === 'destroy') {
      const left = this.hooks.countTag(o.tag);
      this.progressText = `${o.text} (${this.tagTotal - left}/${this.tagTotal})`;
    } else if (o.type === 'encounter' && this.started) {
      const e = this.encounters.get(o.id)!;
      this.progressText = `${o.text} — wave ${this.wave + 1}/${e.waves.length}`;
    } else this.progressText = o.text;
  }

  private complete() {
    const o = this.current!;
    this.hooks.objectiveDone(o.text, this.index);
    if (o.openGate) this.hooks.openGate(o.openGate);
    if (o.checkpoint) this.hooks.checkpoint(o.checkpoint.x, o.checkpoint.z);
    else this.hooks.checkpoint(o.x, o.z);
    this.index++;
    if (this.index >= this.objectives.length) {
      this.done = true;
      this.markerActive = false;
      this.hooks.levelComplete();
      return;
    }
    this.enter();
  }

  update(dt: number, player: THREE.Vector3) {
    const o = this.current;
    if (!o || this.done) return;
    const dist = Math.hypot(player.x - o.x, player.z - o.z);
    // Guide the marker along designer waypoints first
    const via = o.via;
    let guiding = false;
    if (via && this.viaIndex < via.length) {
      const [vx, vz] = via[this.viaIndex];
      if (Math.hypot(player.x - vx, player.z - vz) < 5) this.viaIndex++;
      if (this.viaIndex < via.length) {
        this.marker.set(via[this.viaIndex][0], 1.5, via[this.viaIndex][1]);
        guiding = true;
      }
    }
    if (!guiding && o.type !== 'encounter') this.marker.set(o.x, 1.5, o.z);
    switch (o.type) {
      case 'reach':
        if (dist < o.r) this.complete();
        break;
      case 'exit':
        if (dist < 2.2) this.complete();
        break;
      case 'destroy': {
        this.updateText();
        const near = guiding ? null : this.hooks.nearestTag(o.tag, player);
        if (near) this.marker.set(near.x, near.y + 1.5, near.z);
        if (this.hooks.countTag(o.tag) === 0) {
          this.tagTotal = 0;
          this.complete();
        }
        break;
      }
      case 'encounter': {
        const e = this.encounters.get(o.id);
        if (!e) {
          this.complete();
          break;
        }
        if (!this.started) {
          if (!guiding) this.marker.set(e.trigger.x, 1.5, e.trigger.z);
          if (Math.hypot(player.x - e.trigger.x, player.z - e.trigger.z) < e.trigger.r) {
            this.started = true;
            this.wave = -1;
            this.waveWait = 0.3;
          }
          break;
        }
        this.markerActive = false;
        if (this.waveWait > 0) {
          this.waveWait -= dt;
          if (this.waveWait <= 0) {
            this.wave++;
            if (this.wave >= e.waves.length) {
              this.markerActive = true;
              this.complete();
              break;
            }
            for (const s of e.waves[this.wave]) this.hooks.spawnEnemy(s.type, s.x, s.z, e.id, true);
            this.hooks.waveStarted(this.wave + 1, e.waves.length);
            this.updateText();
          }
        } else if (this.hooks.aliveInGroup(e.id) === 0) {
          this.waveWait = this.wave + 1 >= e.waves.length ? 0.6 : 1.6;
        }
        break;
      }
      case 'boss':
        if (!this.bossStarted && dist < 30) {
          this.bossStarted = true;
          this.markerActive = false;
          this.hooks.startBoss();
        }
        if (this.bossStarted && this.hooks.bossDefeated()) this.complete();
        break;
    }
  }
}
