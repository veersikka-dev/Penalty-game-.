import type { MusicId } from '../data/types';

/**
 * Each track is described as data: tempo, scale, chord progression and step patterns.
 * The MusicManager sequences these live, adding layers as intensity rises.
 * Pattern strings are 16 steps: 'x' = hit, '-' = rest.
 */
export interface MusicTheme {
  bpm: number;
  root: number; // MIDI note of the tonic
  scale: number[];
  chords: number[][]; // scale-degree triads/sevenths, one per `barsPerChord` bars
  barsPerChord: number;
  pad: { type: OscillatorType; cutoff: number; vol: number };
  bass: { steps: (number | null)[]; type: OscillatorType; vol: number };
  drums: { kick: string; snare: string; hat: string; vol: number };
  arp: { steps: (number | null)[]; type: OscillatorType; vol: number; octave: number };
  lead?: { steps: (number | null)[]; type: OscillatorType; vol: number };
  /** Intensity thresholds at which each layer fades in. */
  layers: { arp: number; bass: number; kick: number; hat: number; snare: number; lead: number };
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const _ = null;

export const MUSIC: Record<MusicId, MusicTheme> = {
  menu: {
    bpm: 72, root: 50, scale: DORIAN, barsPerChord: 2,
    chords: [[0, 2, 4, 6], [3, 5, 7, 9], [5, 7, 9, 11], [4, 6, 8, 10]],
    pad: { type: 'sawtooth', cutoff: 900, vol: 0.07 },
    bass: { steps: [0, _, _, _, _, _, _, _, 0, _, _, _, _, _, _, _], type: 'sine', vol: 0.12 },
    drums: { kick: 'x---------------', snare: '----------------', hat: '----x-------x---', vol: 0.3 },
    arp: { steps: [0, _, 2, _, 4, _, 7, _, 4, _, 2, _, 7, _, 9, _], type: 'triangle', vol: 0.04, octave: 1 },
    layers: { arp: 0.0, bass: 0.2, kick: 2, hat: 2, snare: 2, lead: 2 },
  },
  awakening: {
    bpm: 96, root: 45, scale: MINOR, barsPerChord: 2,
    chords: [[0, 2, 4, 7], [5, 7, 9, 12], [3, 5, 7, 10], [4, 6, 8, 11]],
    pad: { type: 'sawtooth', cutoff: 1100, vol: 0.06 },
    bass: { steps: [0, _, _, 0, _, _, 0, _, 0, _, _, 0, _, _, 7, _], type: 'sawtooth', vol: 0.1 },
    drums: { kick: 'x-------x-------', snare: '----x-------x---', hat: '--x---x---x---x-', vol: 0.45 },
    arp: { steps: [0, 2, 4, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2, 4, 7], type: 'triangle', vol: 0.035, octave: 1 },
    lead: { steps: [7, _, _, _, 9, _, 7, _, 4, _, _, _, 2, _, _, _], type: 'sine', vol: 0.05 },
    layers: { arp: 0.1, bass: 0.3, kick: 0.4, hat: 0.55, snare: 0.65, lead: 0.85 },
  },
  cathedral: {
    bpm: 84, root: 52, scale: LYDIAN, barsPerChord: 2,
    chords: [[0, 2, 4, 6], [1, 3, 5, 7], [5, 7, 9, 11], [4, 6, 8, 10]],
    pad: { type: 'sawtooth', cutoff: 1600, vol: 0.06 },
    bass: { steps: [0, _, _, _, _, _, 4, _, 0, _, _, _, 5, _, _, _], type: 'sine', vol: 0.14 },
    drums: { kick: 'x-----x---x-----', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-x-', vol: 0.35 },
    arp: { steps: [0, 4, 7, 11, 14, 11, 7, 4, 2, 6, 9, 13, 9, 6, 2, 6], type: 'sine', vol: 0.045, octave: 1 },
    lead: { steps: [14, _, _, _, _, _, 11, _, 9, _, _, _, 7, _, 9, _], type: 'triangle', vol: 0.045 },
    layers: { arp: 0.05, bass: 0.3, kick: 0.45, hat: 0.6, snare: 0.7, lead: 0.8 },
  },
  industrial: {
    bpm: 118, root: 40, scale: PHRYGIAN, barsPerChord: 1,
    chords: [[0, 2, 4], [0, 2, 4], [1, 3, 5], [6, 8, 10]],
    pad: { type: 'square', cutoff: 700, vol: 0.05 },
    bass: { steps: [0, 0, _, 0, _, 0, 0, _, 0, _, 0, 0, _, 1, _, 0], type: 'sawtooth', vol: 0.12 },
    drums: { kick: 'x---x---x---x---', snare: '----x-------x-x-', hat: 'xxx-xxx-xxx-xxxx', vol: 0.5 },
    arp: { steps: [0, _, 7, _, 0, _, 8, _, 0, _, 7, _, 12, _, 8, _], type: 'square', vol: 0.03, octave: 1 },
    lead: { steps: [7, _, 8, _, 7, _, _, _, 5, _, 3, _, 1, _, _, _], type: 'sawtooth', vol: 0.035 },
    layers: { arp: 0.2, bass: 0.1, kick: 0.3, hat: 0.5, snare: 0.6, lead: 0.8 },
  },
  void: {
    bpm: 76, root: 47, scale: DORIAN, barsPerChord: 4,
    chords: [[0, 2, 4, 6, 8], [3, 5, 7, 9], [5, 7, 9, 11], [1, 3, 5, 7]],
    pad: { type: 'sawtooth', cutoff: 1300, vol: 0.075 },
    bass: { steps: [0, _, _, _, _, _, _, _, _, _, _, _, 4, _, _, _], type: 'sine', vol: 0.16 },
    drums: { kick: 'x-------------x-', snare: '--------x-------', hat: '------x-------x-', vol: 0.3 },
    arp: { steps: [0, _, _, 4, _, _, 7, _, _, 11, _, _, 14, _, 11, _], type: 'sine', vol: 0.05, octave: 2 },
    lead: { steps: [9, _, _, _, _, _, _, _, 7, _, _, _, 4, _, _, _], type: 'sine', vol: 0.05 },
    layers: { arp: 0.0, bass: 0.25, kick: 0.45, hat: 0.55, snare: 0.7, lead: 0.6 },
  },
  core: {
    bpm: 128, root: 45, scale: MINOR, barsPerChord: 1,
    chords: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]],
    pad: { type: 'sawtooth', cutoff: 1400, vol: 0.055 },
    bass: { steps: [0, _, 0, 0, _, 0, _, 0, 0, _, 0, 0, _, 0, 7, _], type: 'sawtooth', vol: 0.12 },
    drums: { kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x---x---x---x-', vol: 0.5 },
    arp: { steps: [0, 2, 4, 7, 9, 7, 4, 2, 0, 2, 4, 7, 11, 9, 7, 4], type: 'sawtooth', vol: 0.025, octave: 1 },
    lead: { steps: [7, _, 9, _, 11, _, 9, _, 7, _, _, _, 4, _, 2, _], type: 'square', vol: 0.03 },
    layers: { arp: 0.1, bass: 0.2, kick: 0.3, hat: 0.45, snare: 0.55, lead: 0.75 },
  },
  boss: {
    bpm: 140, root: 38, scale: PHRYGIAN, barsPerChord: 1,
    chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [6, 8, 10]],
    pad: { type: 'sawtooth', cutoff: 1000, vol: 0.06 },
    bass: { steps: [0, 0, 12, 0, 0, 12, 0, 1, 0, 0, 12, 0, 1, 0, 12, 1], type: 'sawtooth', vol: 0.12 },
    drums: { kick: 'x--xx---x--x--x-', snare: '----x--x----x---', hat: 'xxxxxxxxxxxxxxxx', vol: 0.55 },
    arp: { steps: [0, 1, 4, 7, 8, 7, 4, 1, 0, 1, 4, 8, 12, 8, 4, 1], type: 'square', vol: 0.03, octave: 1 },
    lead: { steps: [8, _, 7, _, 5, _, 4, _, 5, _, 7, _, 8, _, 12, _], type: 'sawtooth', vol: 0.04 },
    layers: { arp: 0.0, bass: 0.0, kick: 0.2, hat: 0.35, snare: 0.45, lead: 0.7 },
  },
};
