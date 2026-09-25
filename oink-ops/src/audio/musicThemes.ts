import type { MusicId } from '../world/Themes';

/**
 * Each track is described as data: tempo, scale, chord progression and step patterns.
 * The MusicManager sequences these live, fading layers in as combat intensity rises.
 * Drum strings are 16 steps: 'x' = hit, '-' = rest.
 */
export interface MusicTheme {
  bpm: number;
  root: number;
  scale: number[];
  chords: number[][];
  barsPerChord: number;
  pad: { type: OscillatorType; cutoff: number; vol: number };
  bass: { steps: (number | null)[]; type: OscillatorType; vol: number };
  drums: { kick: string; snare: string; hat: string; vol: number };
  arp: { steps: (number | null)[]; type: OscillatorType; vol: number; octave: number };
  lead?: { steps: (number | null)[]; type: OscillatorType; vol: number };
  layers: { arp: number; bass: number; kick: number; hat: number; snare: number; lead: number };
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXO = [0, 2, 4, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const _ = null;

export const MUSIC: Record<MusicId, MusicTheme> = {
  // Cheerful, bouncy — the title screen
  menu: {
    bpm: 104, root: 60, scale: MAJOR, barsPerChord: 1,
    chords: [[0, 2, 4], [3, 5, 7], [4, 6, 8], [0, 2, 4]],
    pad: { type: 'triangle', cutoff: 2200, vol: 0.05 },
    bass: { steps: [0, _, _, 4, _, _, 0, _, 0, _, _, 4, _, _, 2, _], type: 'triangle', vol: 0.14 },
    drums: { kick: 'x-------x-------', snare: '----x-------x---', hat: '--x---x---x---x-', vol: 0.3 },
    arp: { steps: [0, _, 2, 4, _, 2, 7, _, 4, _, 2, 4, _, 7, 9, _], type: 'square', vol: 0.03, octave: 1 },
    lead: { steps: [7, _, 9, _, 11, _, 9, 7, _, _, 4, _, 7, _, _, _], type: 'square', vol: 0.03 },
    layers: { arp: 0.0, bass: 0.1, kick: 0.2, hat: 0.3, snare: 0.35, lead: 0.5 },
  },
  // Fun adventure — ukulele-ish plucks and a whistley lead
  village: {
    bpm: 118, root: 62, scale: MAJOR, barsPerChord: 1,
    chords: [[0, 2, 4], [4, 6, 8], [5, 7, 9], [3, 5, 7]],
    pad: { type: 'triangle', cutoff: 1800, vol: 0.045 },
    bass: { steps: [0, _, _, _, 4, _, _, _, 0, _, _, 2, 4, _, _, _], type: 'triangle', vol: 0.16 },
    drums: { kick: 'x-------x-------', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-x-', vol: 0.32 },
    arp: { steps: [0, 2, 4, 2, 0, 2, 4, 7, 0, 2, 4, 2, 7, 4, 2, 4], type: 'triangle', vol: 0.035, octave: 1 },
    lead: { steps: [9, _, 7, _, 4, _, 7, _, 9, _, 11, _, 9, _, 7, _], type: 'sine', vol: 0.05 },
    layers: { arp: 0.0, bass: 0.1, kick: 0.35, hat: 0.5, snare: 0.6, lead: 0.25 },
  },
  // Energetic, playful — fast square leads
  candy: {
    bpm: 132, root: 64, scale: MIXO, barsPerChord: 1,
    chords: [[0, 2, 4], [6, 8, 10], [3, 5, 7], [4, 6, 8]],
    pad: { type: 'square', cutoff: 1400, vol: 0.035 },
    bass: { steps: [0, _, 0, _, 7, _, 0, _, 0, _, 0, _, 5, _, 7, _], type: 'square', vol: 0.1 },
    drums: { kick: 'x---x---x---x---', snare: '----x-------x-x-', hat: 'x-xxx-xxx-xxx-xx', vol: 0.36 },
    arp: { steps: [0, 4, 7, 11, 7, 4, 0, 4, 2, 6, 9, 13, 9, 6, 2, 6], type: 'square', vol: 0.03, octave: 1 },
    lead: { steps: [7, 7, _, 9, _, 7, _, 4, 5, _, 4, _, 2, _, 0, _], type: 'square', vol: 0.035 },
    layers: { arp: 0.0, bass: 0.1, kick: 0.3, hat: 0.45, snare: 0.55, lead: 0.3 },
  },
  // Adventure percussion — busy drums, dorian mood
  jungle: {
    bpm: 108, root: 57, scale: DORIAN, barsPerChord: 2,
    chords: [[0, 2, 4, 6], [3, 5, 7], [6, 8, 10], [4, 6, 8]],
    pad: { type: 'sawtooth', cutoff: 1100, vol: 0.045 },
    bass: { steps: [0, _, _, 0, _, _, 4, _, 0, _, _, 0, _, 3, _, _], type: 'sine', vol: 0.18 },
    drums: { kick: 'x--x--x---x--x--', snare: '---x-----x--x---', hat: 'x.xxx.xxx.xxx.xx'.replace(/\./g, '-'), vol: 0.4 },
    arp: { steps: [0, _, 4, _, 7, _, 4, _, 9, _, 7, _, 4, _, 2, _], type: 'triangle', vol: 0.04, octave: 1 },
    lead: { steps: [11, _, _, 9, _, _, 7, _, 9, _, _, 7, _, 4, _, _], type: 'sine', vol: 0.045 },
    layers: { arp: 0.05, bass: 0.1, kick: 0.2, hat: 0.3, snare: 0.45, lead: 0.4 },
  },
  // Electronic — minor synthwave
  city: {
    bpm: 124, root: 57, scale: MINOR, barsPerChord: 1,
    chords: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [6, 8, 10]],
    pad: { type: 'sawtooth', cutoff: 1600, vol: 0.05 },
    bass: { steps: [0, 0, 7, 0, 0, 7, 0, 0, 0, 0, 7, 0, 5, 0, 7, 0], type: 'sawtooth', vol: 0.09 },
    drums: { kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x---x---x---x-', vol: 0.42 },
    arp: { steps: [0, 2, 4, 7, 9, 7, 4, 2, 0, 2, 4, 7, 11, 9, 7, 4], type: 'sawtooth', vol: 0.025, octave: 1 },
    lead: { steps: [7, _, 9, _, 11, _, 9, _, 7, _, _, _, 4, _, 2, _], type: 'square', vol: 0.03 },
    layers: { arp: 0.0, bass: 0.1, kick: 0.25, hat: 0.4, snare: 0.5, lead: 0.55 },
  },
  // Epic cinematic — slow, heavy
  fortress: {
    bpm: 96, root: 50, scale: MINOR, barsPerChord: 2,
    chords: [[0, 2, 4], [5, 7, 9], [6, 8, 10], [4, 6, 8]],
    pad: { type: 'sawtooth', cutoff: 1300, vol: 0.06 },
    bass: { steps: [0, _, _, _, 0, _, _, _, 0, _, 0, _, 4, _, _, _], type: 'sawtooth', vol: 0.12 },
    drums: { kick: 'x-----x-x-------', snare: '----x-------x---', hat: '--x---x---x---x-', vol: 0.45 },
    arp: { steps: [0, _, 2, _, 4, _, 7, _, 4, _, 2, _, 0, _, _, _], type: 'triangle', vol: 0.04, octave: 1 },
    lead: { steps: [7, _, _, _, 8, _, 7, _, 5, _, _, _, 4, _, _, _], type: 'sawtooth', vol: 0.035 },
    layers: { arp: 0.0, bass: 0.15, kick: 0.3, hat: 0.5, snare: 0.4, lead: 0.6 },
  },
  boss: {
    bpm: 144, root: 45, scale: PHRYGIAN, barsPerChord: 1,
    chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [6, 8, 10]],
    pad: { type: 'sawtooth', cutoff: 1000, vol: 0.06 },
    bass: { steps: [0, 0, 12, 0, 0, 12, 0, 1, 0, 0, 12, 0, 1, 0, 12, 1], type: 'sawtooth', vol: 0.11 },
    drums: { kick: 'x--xx---x--x--x-', snare: '----x--x----x---', hat: 'xxxxxxxxxxxxxxxx', vol: 0.5 },
    arp: { steps: [0, 1, 4, 7, 8, 7, 4, 1, 0, 1, 4, 8, 12, 8, 4, 1], type: 'square', vol: 0.03, octave: 1 },
    lead: { steps: [8, _, 7, _, 5, _, 4, _, 5, _, 7, _, 8, _, 12, _], type: 'sawtooth', vol: 0.04 },
    layers: { arp: 0.0, bass: 0.0, kick: 0.2, hat: 0.35, snare: 0.45, lead: 0.7 },
  },
  victory: {
    bpm: 120, root: 60, scale: MAJOR, barsPerChord: 1,
    chords: [[0, 2, 4], [3, 5, 7], [4, 6, 8], [0, 2, 4, 7]],
    pad: { type: 'triangle', cutoff: 2400, vol: 0.05 },
    bass: { steps: [0, _, 4, _, 0, _, 4, _, 0, _, 4, _, 2, _, 4, _], type: 'triangle', vol: 0.14 },
    drums: { kick: 'x-------x-------', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-x-', vol: 0.3 },
    arp: { steps: [0, 2, 4, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2, 4, 7], type: 'square', vol: 0.03, octave: 1 },
    lead: { steps: [7, _, 7, 9, 11, _, 12, _, 11, _, 9, _, 7, _, _, _], type: 'square', vol: 0.04 },
    layers: { arp: 0.0, bass: 0.0, kick: 0.0, hat: 0.1, snare: 0.1, lead: 0.2 },
  },
};
