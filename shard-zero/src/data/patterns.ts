import type { Motion, ScriptEvent, SectionDef, SpawnEvent, TargetKind } from './types';
import { Rng } from '../utils/MathUtils';

/**
 * Small authoring DSL for level sections. Designers place hand-made set pieces and
 * mix in seeded procedural patterns; the result is plain SectionDef data.
 */
export class SectionBuilder {
  events: SpawnEvent[] = [];
  script: ScriptEvent[] = [];
  constructor(public rng: Rng) {}

  add(ev: SpawnEvent) {
    this.events.push(ev);
    return this;
  }

  // ---- single objects
  crystal(at: number, x = 0, y = 3, motion?: Motion) {
    return this.add({ at, kind: 'crystal', x, y, motion });
  }
  large(at: number, x = 0, y = 3.2, motion?: Motion) {
    return this.add({ at, kind: 'crystalLarge', x, y, motion });
  }
  special(at: number, kind: TargetKind, x = 0, y = 3.4, motion?: Motion) {
    return this.add({ at, kind, x, y, motion });
  }
  gate(at: number, x = 0, y = 2.5, w = 4, h = 3.2, tilt = 0) {
    return this.add({ at, kind: 'panel', x, y, w, h, tilt });
  }
  /** Optional off-path glass for bonus points. */
  sidePanel(at: number, side: number, y = 2.8, w = 2.4, h = 3) {
    return this.add({ at, kind: 'panel', x: side * 3.7, y, w, h });
  }
  barrier(at: number, hp = 3, x = 0, y = 2.5, w = 4.2, h = 3.4) {
    return this.add({ at, kind: 'barrier', x, y, w, h, hp });
  }
  hanging(at: number, x = 0, amp = 0.55, freq = 0.32, length = 3.4, pivotY = 7.1, w = 3, h = 2.6) {
    return this.add({ at, kind: 'hanging', x, y: pivotY, w, h, motion: { type: 'pendulum', length, amp, freq, phase: this.rng.range(0, 6) } });
  }
  swayGate(at: number, amp = 2.4, freq = 0.22, w = 3.2, h = 3, y = 2.5) {
    return this.add({ at, kind: 'panel', x: 0, y, w, h, motion: { type: 'sway', axis: 'x', amp, freq, phase: this.rng.range(0, 6) } });
  }
  swayCrystal(at: number, axis: 'x' | 'y', amp: number, freq: number, x = 0, y = 3, kind: TargetKind = 'crystal') {
    return this.add({ at, kind, x, y, motion: { type: 'sway', axis, amp, freq, phase: this.rng.range(0, 6) } });
  }
  approach(at: number, kind: TargetKind, x: number, y: number, speed: number, w?: number, h?: number) {
    return this.add({ at, kind, x, y, w, h, motion: { type: 'approach', speed } });
  }

  // ---- procedural patterns
  slalom(at: number, count: number, spacing: number, amp = 2.2, y = 3) {
    const s = this.rng.sign();
    for (let i = 0; i < count; i++) this.crystal(at + i * spacing, s * (i % 2 ? amp : -amp), y + this.rng.range(-0.6, 0.8));
    return this;
  }
  scatter(at: number, count: number, spacing: number, xr = 3, y0 = 1.5, y1 = 5) {
    for (let i = 0; i < count; i++) this.crystal(at + i * spacing + this.rng.range(-2, 2), this.rng.range(-xr, xr), this.rng.range(y0, y1));
    return this;
  }
  arc(at: number, n: number, radius: number, cy = 3.2, kind: TargetKind = 'crystal') {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.add({ at: at + (i % 2) * 0.5, kind, x: Math.cos(a) * radius, y: cy + Math.sin(a) * radius * 0.8 });
    }
    return this;
  }
  orbitRing(at: number, n: number, radius: number, speed: number, cy = 3.2, x = 0) {
    for (let i = 0; i < n; i++) this.add({ at, kind: 'rotator', x, y: cy, motion: { type: 'orbit', radius, speed, phase: (i / n) * Math.PI * 2 } });
    return this;
  }
  /** Grid of glass forming a wall; the centre cells block the path. */
  wall(at: number, cols: number, rows: number, pw = 2, ph = 1.7, cy = 2.8) {
    const gap = 0.08;
    const x0 = -((cols - 1) * (pw + gap)) / 2;
    const y0 = cy - ((rows - 1) * (ph + gap)) / 2;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) this.add({ at, kind: 'panel', x: x0 + c * (pw + gap), y: y0 + r * (ph + gap), w: pw, h: ph });
    return this;
  }
  /** A wall with a Nova core in front — one good shot brings the whole thing down. */
  explosiveWall(at: number, cols = 4, rows = 3, cy = 2.9) {
    this.wall(at, cols, rows, 2, 1.7, cy);
    return this.add({ at: at - 1.2, kind: 'explosive', x: this.rng.range(-1.5, 1.5), y: cy + this.rng.range(-0.6, 0.6) });
  }
  cluster(at: number, x = 0, y = 3) {
    this.add({ at, kind: 'explosive', x, y });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.add({ at: at + 0.3, kind: 'panel', x: x + Math.cos(a) * 2.2, y: y + Math.sin(a) * 1.8, w: 1.3, h: 1.3, tilt: a });
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      this.crystal(at + 1, x + Math.cos(a) * 3.4, y + Math.sin(a) * 2.2);
    }
    return this;
  }
  shielded(at: number, x = 0, y = 3.2, plates = 3, speed = 1.1, radius = 1.9) {
    this.large(at, x, y);
    for (let i = 0; i < plates; i++) this.add({ at: at - 1.4, kind: 'shieldPlate', x, y, w: 1.8, h: 1.3, motion: { type: 'orbit', radius, speed, phase: (i / plates) * Math.PI * 2 } });
    return this;
  }

  // ---- scripting
  hint(at: number, text: string, sub?: string, duration = 3.2) {
    this.script.push({ at, action: 'hint', text, sub, duration });
    return this;
  }
  speed(at: number, value: number) {
    this.script.push({ at, action: 'speed', value });
    return this;
  }
  music(at: number, intensity: number) {
    this.script.push({ at, action: 'music', intensity });
    return this;
  }
  tension(at: number) {
    this.script.push({ at, action: 'tension' });
    return this;
  }
  pulse(at: number, color: number) {
    this.script.push({ at, action: 'pulse', color });
    return this;
  }
  boss(at: number) {
    this.script.push({ at, action: 'boss' });
    return this;
  }
}

export function section(name: string, length: number, opts: { checkpoint?: boolean; speed?: number; seed: number }, build: (b: SectionBuilder) => void): SectionDef {
  const b = new SectionBuilder(new Rng(opts.seed));
  if (opts.speed) b.speed(0, opts.speed);
  build(b);
  return { name, length, checkpoint: opts.checkpoint, speed: opts.speed, events: b.events, script: b.script };
}
