import { clamp, rand } from '../utils/MathUtils';

interface ToneOpts {
  freq: number;
  freqEnd?: number;
  type?: OscillatorType;
  dur: number;
  vol: number;
  attack?: number;
  at?: number;
  pan?: number;
  reverb?: number;
  detune?: number;
}
interface NoiseOpts {
  dur: number;
  vol: number;
  filter?: BiquadFilterType;
  freq: number;
  freqEnd?: number;
  q?: number;
  attack?: number;
  at?: number;
  pan?: number;
  reverb?: number;
}

/**
 * Procedural audio engine built on the Web Audio API. Every sound in the game is
 * synthesised at runtime, so there are no audio files to load or license.
 *
 * Graph: voices -> sfxBus / musicBus -> master -> compressor -> destination
 *        voices -> reverbSend -> convolver -> master
 */
export class AudioManager {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  reverbSend!: GainNode;
  private noiseBuf!: AudioBuffer;
  private recentGlass: number[] = [];
  ready = false;
  private volumes = { master: 0.8, music: 0.7, sfx: 0.9 };

  /** Creates the audio context. Safe to call before a user gesture (it starts suspended). */
  init(): boolean {
    if (this.ctx) return this.ready;
    try {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new C();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.connect(comp);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);

      // Algorithmic reverb impulse (stereo exponentially-decaying noise)
      const len = Math.floor(ctx.sampleRate * 2.6);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      const conv = ctx.createConvolver();
      conv.buffer = ir;
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0.55;
      this.reverbSend.connect(conv);
      conv.connect(this.master);

      const nlen = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, nlen, ctx.sampleRate);
      const nd = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;

      this.ready = true;
      this.applyVolumes();
    } catch (err) {
      console.warn('[SHARD//ZERO] Audio unavailable, continuing silently.', err);
      this.ready = false;
    }
    return this.ready;
  }

  /** Must be called from a user gesture to satisfy autoplay policies. */
  resume() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => undefined);
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setVolumes(master: number, music: number, sfx: number) {
    this.volumes = { master, music, sfx };
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ready || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master * this.volumes.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * this.volumes.music * 0.8, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx * this.volumes.sfx, t, 0.05);
  }

  // ---------------------------------------------------------------- primitives

  private output(node: AudioNode, pan = 0, reverb = 0, bus?: AudioNode) {
    const ctx = this.ctx!;
    let last: AudioNode = node;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      node.connect(p);
      last = p;
    }
    last.connect(bus ?? this.sfxBus);
    if (reverb > 0) {
      const s = ctx.createGain();
      s.gain.value = reverb;
      last.connect(s);
      s.connect(this.reverbSend);
    }
  }

  tone(o: ToneOpts, bus?: AudioNode) {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = o.at ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + o.dur);
    osc.connect(g);
    this.output(g, o.pan, o.reverb, bus);
    osc.start(t);
    osc.stop(t + a + o.dur + 0.05);
  }

  noise(o: NoiseOpts, bus?: AudioNode) {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = o.at ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? 'bandpass';
    f.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t + o.dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const a = o.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + o.dur);
    src.connect(f).connect(g);
    this.output(g, o.pan, o.reverb, bus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + a + o.dur + 0.05);
  }

  // ---------------------------------------------------------------- game sounds

  shoot() {
    this.tone({ freq: 1100, freqEnd: 180, type: 'sine', dur: 0.09, vol: 0.25 });
    this.tone({ freq: 90, freqEnd: 45, type: 'sine', dur: 0.08, vol: 0.35 });
    this.noise({ dur: 0.14, vol: 0.12, filter: 'highpass', freq: 3000, freqEnd: 900, q: 0.7 });
  }

  impact(pan = 0) {
    this.noise({ dur: 0.05, vol: 0.25, filter: 'bandpass', freq: 2400, q: 2, pan });
    this.tone({ freq: 520, freqEnd: 300, dur: 0.06, vol: 0.12, pan });
  }

  /** Throttles overlapping glass sounds so chain reactions don't clip. */
  private glassBudget(): number {
    const now = performance.now();
    this.recentGlass = this.recentGlass.filter((t) => now - t < 140);
    this.recentGlass.push(now);
    return clamp(1.3 - this.recentGlass.length * 0.18, 0.25, 1);
  }

  private tinkles(count: number, pan: number, spread: number, vol: number) {
    const t0 = this.now;
    for (let i = 0; i < count; i++) {
      const f = rand(2400, 8200);
      this.tone({ freq: f, freqEnd: f * rand(0.97, 1.01), type: 'sine', dur: rand(0.04, 0.3), vol: vol * rand(0.3, 1), at: t0 + Math.pow(Math.random(), 1.6) * spread, pan: pan + rand(-0.3, 0.3), reverb: 0.4 });
    }
  }

  glassSmall(pan = 0) {
    const b = this.glassBudget();
    this.noise({ dur: 0.22, vol: 0.32 * b, filter: 'highpass', freq: 3500, q: 0.6, pan, reverb: 0.3 });
    this.noise({ dur: 0.08, vol: 0.3 * b, filter: 'bandpass', freq: 1800, q: 1.2, pan });
    this.tinkles(Math.round(8 * b), pan, 0.35, 0.09 * b);
  }

  glassLarge(pan = 0) {
    const b = this.glassBudget();
    this.tone({ freq: 110, freqEnd: 40, type: 'sine', dur: 0.35, vol: 0.5 * b, pan });
    this.noise({ dur: 0.7, vol: 0.4 * b, filter: 'highpass', freq: 2200, freqEnd: 5000, q: 0.5, pan, reverb: 0.5 });
    this.noise({ dur: 0.18, vol: 0.4 * b, filter: 'bandpass', freq: 1200, q: 0.8, pan });
    this.tinkles(Math.round(18 * b), pan, 0.9, 0.08 * b);
  }

  /** Crystal shatter: a pitched chime that climbs with the combo. */
  crystal(pan = 0, step = 0) {
    const b = this.glassBudget();
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const note = 76 + scale[step % scale.length];
    const f = 440 * Math.pow(2, (note - 69) / 12);
    this.tone({ freq: f, type: 'sine', dur: 0.9, vol: 0.16 * b, pan, reverb: 0.7 });
    this.tone({ freq: f * 2, type: 'sine', dur: 0.5, vol: 0.06 * b, pan, reverb: 0.6 });
    this.tone({ freq: f * 3.01, type: 'triangle', dur: 0.3, vol: 0.04 * b, pan });
    this.noise({ dur: 0.18, vol: 0.2 * b, filter: 'highpass', freq: 5000, q: 0.5, pan });
    this.tinkles(Math.round(5 * b), pan, 0.25, 0.06 * b);
  }

  explosion(pan = 0) {
    this.noise({ dur: 1.2, vol: 0.7, filter: 'lowpass', freq: 1800, freqEnd: 90, q: 0.8, pan, reverb: 0.6 });
    this.tone({ freq: 70, freqEnd: 24, type: 'sine', dur: 0.9, vol: 0.8, pan });
    this.tone({ freq: 140, freqEnd: 40, type: 'sawtooth', dur: 0.25, vol: 0.15, pan });
    this.tinkles(14, pan, 0.8, 0.07);
  }

  crash() {
    this.glassLarge(0);
    this.tone({ freq: 60, freqEnd: 30, type: 'sine', dur: 0.6, vol: 0.9 });
    this.tone({ freq: 233, freqEnd: 180, type: 'sawtooth', dur: 0.4, vol: 0.1 });
    this.tone({ freq: 247, freqEnd: 190, type: 'sawtooth', dur: 0.4, vol: 0.1 });
  }

  combo(level: number) {
    const base = 72 + Math.min(level, 5) * 2;
    [0, 4, 7, 12].forEach((iv, i) => {
      this.tone({ freq: 440 * Math.pow(2, (base + iv - 69) / 12), type: 'triangle', dur: 0.18, vol: 0.09, at: this.now + i * 0.045, reverb: 0.4 });
    });
  }

  pickup() {
    this.tone({ freq: 880, freqEnd: 1760, type: 'sine', dur: 0.12, vol: 0.12, reverb: 0.3 });
    this.tone({ freq: 1320, freqEnd: 2640, type: 'sine', dur: 0.12, vol: 0.08, at: this.now + 0.06, reverb: 0.3 });
  }

  special(kind: 'time' | 'multiplier' | 'explosive') {
    if (kind === 'time') {
      this.tone({ freq: 1600, freqEnd: 120, type: 'sine', dur: 1.2, vol: 0.2, reverb: 0.8 });
      this.noise({ dur: 1.2, vol: 0.15, filter: 'bandpass', freq: 4000, freqEnd: 300, q: 3, reverb: 0.6 });
    } else if (kind === 'multiplier') {
      [0, 4, 7, 11, 14].forEach((iv, i) => this.tone({ freq: 440 * Math.pow(2, (79 + iv - 69) / 12), type: 'square', dur: 0.25, vol: 0.05, at: this.now + i * 0.05, reverb: 0.6 }));
    }
  }

  miss() {
    this.tone({ freq: 220, freqEnd: 160, type: 'triangle', dur: 0.12, vol: 0.06 });
  }

  lowAmmo() {
    this.tone({ freq: 660, type: 'square', dur: 0.06, vol: 0.05 });
    this.tone({ freq: 660, type: 'square', dur: 0.06, vol: 0.05, at: this.now + 0.12 });
  }

  uiHover() {
    this.tone({ freq: 2200, type: 'sine', dur: 0.03, vol: 0.04 });
  }
  uiClick() {
    this.tone({ freq: 1200, freqEnd: 1800, type: 'triangle', dur: 0.06, vol: 0.1 });
    this.tone({ freq: 2400, type: 'sine', dur: 0.05, vol: 0.05, at: this.now + 0.04 });
  }

  transition() {
    this.noise({ dur: 1.4, vol: 0.25, filter: 'bandpass', freq: 200, freqEnd: 6000, q: 1.5, attack: 0.9, reverb: 0.7 });
    this.tone({ freq: 60, freqEnd: 240, type: 'sawtooth', dur: 1.2, vol: 0.06, attack: 0.8, reverb: 0.5 });
  }

  powerUp() {
    this.tone({ freq: 55, freqEnd: 110, type: 'sawtooth', dur: 0.6, vol: 0.12, attack: 0.05, reverb: 0.6 });
    this.noise({ dur: 0.3, vol: 0.1, filter: 'bandpass', freq: 800, freqEnd: 3000, q: 4, reverb: 0.5 });
    this.tone({ freq: 1760, type: 'sine', dur: 0.4, vol: 0.05, at: this.now + 0.15, reverb: 0.8 });
  }

  checkpoint() {
    [0, 7, 12, 16].forEach((iv, i) => this.tone({ freq: 440 * Math.pow(2, (69 + iv - 69) / 12), type: 'sine', dur: 1.4, vol: 0.08, at: this.now + i * 0.07, reverb: 0.9 }));
  }

  bossRoar() {
    this.tone({ freq: 55, freqEnd: 38, type: 'sawtooth', dur: 2.4, vol: 0.3, attack: 0.3, reverb: 0.7 });
    this.tone({ freq: 58, freqEnd: 36, type: 'sawtooth', dur: 2.4, vol: 0.25, attack: 0.3, reverb: 0.7 });
    this.noise({ dur: 2.2, vol: 0.3, filter: 'lowpass', freq: 400, freqEnd: 120, q: 3, attack: 0.3, reverb: 0.8 });
  }
  bossHit(pan = 0) {
    this.tone({ freq: 180, freqEnd: 60, type: 'square', dur: 0.2, vol: 0.2, pan });
    this.noise({ dur: 0.25, vol: 0.3, filter: 'bandpass', freq: 900, q: 1, pan, reverb: 0.4 });
  }
  bossPhase() {
    this.explosion(0);
    this.tone({ freq: 40, freqEnd: 20, type: 'sine', dur: 1.8, vol: 0.9 });
    this.noise({ dur: 2, vol: 0.25, filter: 'bandpass', freq: 300, freqEnd: 5000, q: 2, attack: 1.2, reverb: 0.8 });
  }
  orbLaunch(pan = 0) {
    this.tone({ freq: 300, freqEnd: 900, type: 'sawtooth', dur: 0.25, vol: 0.06, pan, reverb: 0.4 });
  }

  gameOver() {
    [0, -3, -7, -12].forEach((iv, i) => this.tone({ freq: 440 * Math.pow(2, (64 + iv - 69) / 12), type: 'triangle', dur: 0.9, vol: 0.1, at: this.now + i * 0.22, reverb: 0.8 }));
  }

  victory() {
    [0, 4, 7, 12, 16, 19, 24].forEach((iv, i) => this.tone({ freq: 440 * Math.pow(2, (67 + iv - 69) / 12), type: 'triangle', dur: 1.6, vol: 0.08, at: this.now + i * 0.09, reverb: 0.9 }));
  }
}
