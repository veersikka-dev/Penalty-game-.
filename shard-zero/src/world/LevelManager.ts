import type { LevelDef, ScriptEvent, SpawnEvent } from '../data/types';

interface FlatSpawn { abs: number; ev: SpawnEvent }
interface FlatScript { abs: number; ev: ScriptEvent }

export interface LevelHooks {
  spawn(ev: SpawnEvent, z: number): void;
  script(ev: ScriptEvent): void;
  enterSection(index: number, checkpoint: boolean): void;
}

/**
 * Turns a LevelDef (sections of relative spawn + script events) into an absolute
 * timeline, streams spawns ahead of the player, fires scripts and tracks checkpoints.
 */
export class LevelManager {
  level: LevelDef | null = null;
  private spawns: FlatSpawn[] = [];
  private scripts: FlatScript[] = [];
  sectionStarts: number[] = [];
  totalLength = 0;
  private spawnIdx = 0;
  private scriptIdx = 0;
  section = -1;

  load(level: LevelDef) {
    this.level = level;
    this.spawns = [];
    this.scripts = [];
    this.sectionStarts = [];
    let offset = 0;
    for (const s of level.sections) {
      this.sectionStarts.push(offset);
      for (const ev of s.events) this.spawns.push({ abs: offset + ev.at, ev });
      for (const ev of s.script ?? []) this.scripts.push({ abs: offset + ev.at, ev });
      offset += s.length;
    }
    this.totalLength = offset;
    this.spawns.sort((a, b) => a.abs - b.abs);
    this.scripts.sort((a, b) => a.abs - b.abs);
    this.resetTo(0);
  }

  /** Rewinds/fast-forwards the timeline, e.g. when restarting from a checkpoint. */
  resetTo(distance: number) {
    this.spawnIdx = this.spawns.findIndex((s) => s.abs >= distance);
    if (this.spawnIdx < 0) this.spawnIdx = this.spawns.length;
    this.scriptIdx = this.scripts.findIndex((s) => s.abs >= distance);
    if (this.scriptIdx < 0) this.scriptIdx = this.scripts.length;
    this.section = this.sectionIndexAt(distance) - 1;
  }

  sectionIndexAt(distance: number) {
    let idx = 0;
    for (let i = 0; i < this.sectionStarts.length; i++) if (distance >= this.sectionStarts[i]) idx = i;
    return idx;
  }

  get checkpointSections(): number[] {
    return this.level ? this.level.sections.map((s, i) => (s.checkpoint || i === 0 ? i : -1)).filter((i) => i >= 0) : [];
  }

  progress(distance: number) {
    return this.totalLength ? Math.min(1, distance / this.totalLength) : 0;
  }

  update(distance: number, spawnAhead: number, hooks: LevelHooks) {
    if (!this.level) return;
    const sec = this.sectionIndexAt(distance);
    if (sec !== this.section) {
      for (let i = this.section + 1; i <= sec; i++) hooks.enterSection(i, !!this.level.sections[i].checkpoint);
      this.section = sec;
    }
    while (this.spawnIdx < this.spawns.length && this.spawns[this.spawnIdx].abs <= distance + spawnAhead) {
      const s = this.spawns[this.spawnIdx++];
      hooks.spawn(s.ev, -s.abs);
    }
    while (this.scriptIdx < this.scripts.length && this.scripts[this.scriptIdx].abs <= distance) {
      hooks.script(this.scripts[this.scriptIdx++].ev);
    }
  }
}
