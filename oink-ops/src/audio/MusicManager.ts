import type { AudioManager } from './AudioManager';
import { MUSIC, type MusicTheme } from './musicThemes';
import type { MusicId } from '../world/Themes';
import { clamp } from '../utils/MathUtils';

type Layer = 'pad' | 'arp' | 'bass' | 'kick' | 'hat' | 'snare' | 'lead';
const LAYERS: Layer[] = ['pad', 'arp', 'bass', 'kick', 'hat', 'snare', 'lead'];

interface Track {
  id: MusicId;
  theme: MusicTheme;
  out: GainNode;
  filter: BiquadFilterNode;
  layers: Record<Layer, GainNode>;
  step: number;
  nextTime: number;
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/**
 * Live procedural music sequencer. Uses a look-ahead scheduler so timing stays tight
 * regardless of frame rate. Intensity (0..1) fades layers in and opens the filter.
 */
export class MusicManager {
  private track: Track | null = null;
  private timer: number | null = null;
  private intensity = 0;
  private targetIntensity = 0.3;
  private tensionUntil = 0;
  private ducked = false;

  constructor(private audio: AudioManager) {}

  get currentId(): MusicId | null {
    return this.track?.id ?? null;
  }

  play(id: MusicId, intensity = 0.3) {
    const a = this.audio;
    if (!a.ready || !a.ctx) return;
    if (this.track?.id === id) {
      this.setIntensity(intensity);
      return;
    }
    const ctx = a.ctx;
    const now = ctx.currentTime;
    // Fade out the previous track
    if (this.track) {
      const old = this.track;
      old.out.gain.cancelScheduledValues(now);
      old.out.gain.setValueAtTime(old.out.gain.value, now);
      old.out.gain.linearRampToValueAtTime(0.0001, now + 1.5);
      setTimeout(() => old.out.disconnect(), 1800);
    }
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.linearRampToValueAtTime(1, now + 1.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 18000;
    filter.Q.value = 0.8;
    filter.connect(out);
    out.connect(a.musicBus);
    const layers = {} as Record<Layer, GainNode>;
    for (const l of LAYERS) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(filter);
      layers[l] = g;
    }
    // Send a little of the musical layers to reverb for space
    const send = ctx.createGain();
    send.gain.value = 0.25;
    filter.connect(send);
    send.connect(a.reverbSend);

    this.track = { id, theme: MUSIC[id], out, filter, layers, step: 0, nextTime: now + 0.1 };
    this.intensity = intensity;
    this.targetIntensity = intensity;
    this.applyLayerGains(true);
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(fade = 1.5) {
    if (!this.track || !this.audio.ctx) return;
    const now = this.audio.ctx.currentTime;
    const old = this.track;
    old.out.gain.cancelScheduledValues(now);
    old.out.gain.setValueAtTime(old.out.gain.value, now);
    old.out.gain.linearRampToValueAtTime(0.0001, now + fade);
    setTimeout(() => old.out.disconnect(), fade * 1000 + 300);
    this.track = null;
  }

  setIntensity(v: number) {
    this.targetIntensity = clamp(v, 0, 1);
  }

  /** Sweeps the music into a muffled, tense state for a while then opens back up. */
  tension(duration = 2.5) {
    const a = this.audio;
    if (!this.track || !a.ctx) return;
    const f = this.track.filter.frequency;
    const now = a.ctx.currentTime;
    f.cancelScheduledValues(now);
    f.setValueAtTime(f.value, now);
    f.exponentialRampToValueAtTime(380, now + 0.4);
    f.setValueAtTime(380, now + duration);
    f.exponentialRampToValueAtTime(18000, now + duration + 0.8);
    this.tensionUntil = now + duration + 0.8;
  }

  /** A heavy downbeat used for major events. */
  impact() {
    const a = this.audio;
    if (!a.ready) return;
    a.tone({ freq: 120, freqEnd: 30, type: 'sine', dur: 0.9, vol: 0.9 }, a.musicBus);
    a.noise({ dur: 1.2, vol: 0.2, filter: 'lowpass', freq: 3000, freqEnd: 200, reverb: 0.6 }, a.musicBus);
  }

  duck(on: boolean) {
    const a = this.audio;
    if (!this.track || !a.ctx || this.ducked === on) return;
    this.ducked = on;
    const f = this.track.filter.frequency;
    const now = a.ctx.currentTime;
    f.cancelScheduledValues(now);
    f.setTargetAtTime(on ? 600 : 18000, now, 0.25);
  }

  update(dt: number) {
    if (!this.track) return;
    const prev = this.intensity;
    this.intensity += (this.targetIntensity - this.intensity) * Math.min(1, dt * 0.8);
    if (Math.abs(prev - this.intensity) > 0.002) this.applyLayerGains(false);
  }

  private applyLayerGains(immediate: boolean) {
    const tr = this.track;
    if (!tr || !this.audio.ctx) return;
    const now = this.audio.ctx.currentTime;
    const th = tr.theme.layers;
    const on = (thr: number) => clamp((this.intensity - thr) / 0.08 + 0.001, 0, 1);
    const values: Record<Layer, number> = {
      pad: 1,
      arp: on(th.arp),
      bass: on(th.bass),
      kick: on(th.kick),
      hat: on(th.hat),
      snare: on(th.snare),
      lead: on(th.lead),
    };
    for (const l of LAYERS) {
      if (immediate) tr.layers[l].gain.setValueAtTime(values[l], now);
      else tr.layers[l].gain.setTargetAtTime(values[l], now, 0.4);
    }
  }

  private schedule() {
    const a = this.audio;
    const tr = this.track;
    if (!tr || !a.ctx || a.ctx.state !== 'running') {
      if (tr && a.ctx) tr.nextTime = Math.max(tr.nextTime, a.ctx.currentTime + 0.05);
      return;
    }
    const stepDur = 60 / tr.theme.bpm / 4;
    // If the tab was throttled, skip ahead instead of scheduling a burst of notes
    if (tr.nextTime < a.ctx.currentTime - 0.2) tr.nextTime = a.ctx.currentTime + 0.05;
    while (tr.nextTime < a.ctx.currentTime + 0.15) {
      this.playStep(tr, tr.step, tr.nextTime, stepDur);
      tr.nextTime += stepDur;
      tr.step++;
    }
  }

  private degree(th: MusicTheme, d: number, octave = 0) {
    const n = th.scale.length;
    const oct = Math.floor(d / n);
    const idx = ((d % n) + n) % n;
    return th.root + th.scale[idx] + 12 * (oct + octave);
  }

  private playStep(tr: Track, step: number, t: number, stepDur: number) {
    const a = this.audio;
    const ctx = a.ctx!;
    const th = tr.theme;
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    const chord = th.chords[Math.floor(bar / th.barsPerChord) % th.chords.length];
    const L = tr.layers;
    const lvl = (l: Layer) => L[l].gain.value > 0.01 || this.targetIntensity > 0;

    // Pad: new chord at the start of each chord span
    if (s16 === 0 && bar % th.barsPerChord === 0) {
      const dur = stepDur * 16 * th.barsPerChord;
      for (const d of chord) {
        const f = mtof(this.degree(th, d, 0));
        for (const det of [-9, 9]) {
          const o = ctx.createOscillator();
          o.type = th.pad.type;
          o.frequency.value = f;
          o.detune.value = det;
          const flt = ctx.createBiquadFilter();
          flt.type = 'lowpass';
          flt.frequency.setValueAtTime(th.pad.cutoff * 0.5, t);
          flt.frequency.linearRampToValueAtTime(th.pad.cutoff * (0.7 + this.intensity * 0.8), t + dur * 0.5);
          flt.frequency.linearRampToValueAtTime(th.pad.cutoff * 0.5, t + dur);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(th.pad.vol / chord.length, t + Math.min(1.2, dur * 0.3));
          g.gain.setValueAtTime(th.pad.vol / chord.length, t + dur * 0.8);
          g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
          o.connect(flt).connect(g).connect(L.pad);
          o.start(t);
          o.stop(t + dur + 0.4);
        }
      }
    }

    const bassNote = th.bass.steps[s16];
    if (bassNote !== null && lvl('bass') && L.bass.gain.value > 0.01) {
      const m = this.degree(th, chord[0] + bassNote, -2);
      a.tone({ freq: mtof(m), type: th.bass.type, dur: stepDur * 1.6, vol: th.bass.vol, at: t }, this.lowpassed(L.bass, 700));
    }

    const dr = th.drums;
    if (dr.kick[s16] === 'x' && L.kick.gain.value > 0.01) a.tone({ freq: 150, freqEnd: 42, type: 'sine', dur: 0.22, vol: dr.vol, at: t }, L.kick);
    if (dr.snare[s16] === 'x' && L.snare.gain.value > 0.01) {
      a.noise({ dur: 0.16, vol: dr.vol * 0.5, filter: 'bandpass', freq: 1900, q: 0.7, at: t }, L.snare);
      a.tone({ freq: 190, freqEnd: 140, type: 'triangle', dur: 0.08, vol: dr.vol * 0.25, at: t }, L.snare);
    }
    if (dr.hat[s16] === 'x' && L.hat.gain.value > 0.01) a.noise({ dur: 0.035, vol: dr.vol * 0.22 * (s16 % 4 === 2 ? 1 : 0.6), filter: 'highpass', freq: 8000, q: 0.5, at: t }, L.hat);

    const arp = th.arp.steps[s16];
    if (arp !== null && L.arp.gain.value > 0.01) {
      const tones = chord;
      const d = tones[arp % tones.length] + Math.floor(arp / tones.length) * th.scale.length;
      const m = this.degree(th, d, th.arp.octave);
      a.tone({ freq: mtof(m), type: th.arp.type, dur: stepDur * 1.8, vol: th.arp.vol, at: t }, L.arp);
    }

    if (th.lead) {
      const ld = th.lead.steps[s16];
      if (ld !== null && L.lead.gain.value > 0.01 && bar % 2 === 1) {
        const m = this.degree(th, ld, 1);
        a.tone({ freq: mtof(m), type: th.lead.type, dur: stepDur * 3, vol: th.lead.vol, at: t, attack: 0.02 }, L.lead);
      }
    }
  }

  private lpCache = new WeakMap<GainNode, BiquadFilterNode>();
  private lowpassed(dest: GainNode, freq: number): AudioNode {
    let f = this.lpCache.get(dest);
    if (!f && this.audio.ctx) {
      f = this.audio.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq;
      f.connect(dest);
      this.lpCache.set(dest, f);
    }
    return f ?? dest;
  }
}
