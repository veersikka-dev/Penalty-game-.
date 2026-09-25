import type { LevelDef } from '../types';
import { section } from '../patterns';

/** LEVEL 1 — THE AWAKENING. Teaches shooting, crystals, glass, combos. Generous and slow. */
export const level1: LevelDef = {
  id: 0,
  name: 'The Awakening',
  subtitle: 'Something stirs in the dark.',
  theme: 'awakening',
  music: 'awakening',
  accent: '#5fd4ff',
  baseSpeed: 9,
  startAmmo: 25,
  gravity: 9,
  sections: [
    section('Awakening', 170, { seed: 11 }, (b) => {
      b.large(72, 0, 3.2).hint(38, 'CLICK TO FIRE', 'Aim with your mouse', 4);
      b.crystal(100, -2, 3).crystal(112, 2, 3.4).crystal(126, 0, 2.6);
      b.hint(98, 'CRYSTALS RESTORE SHARDS', 'Each orb you fire costs one shard');
      b.crystal(150, -1.5, 4).crystal(156, 1.5, 4).music(90, 0.35);
    }),
    section('First Light', 230, { seed: 12, checkpoint: true }, (b) => {
      b.hint(4, 'BREAK THE GLASS', 'Crashing into glass costs 10 shards');
      b.gate(30);
      b.slalom(48, 6, 12, 2.2);
      b.gate(128, 0, 2.6, 4.4, 3.4);
      b.sidePanel(146, -1).sidePanel(146, 1).crystal(150, 0, 4.6);
      b.scatter(165, 4, 9, 2.6);
      b.gate(212, 0, 2.5, 5, 3.4, 0.25);
      b.music(100, 0.5);
    }),
    section('Resonance', 270, { seed: 13, checkpoint: true }, (b) => {
      b.hint(6, 'CHAIN HITS FOR COMBOS', 'Break things quickly to raise your multiplier');
      for (let i = 0; i < 5; i++) b.crystal(26 + i * 4, -3 + i * 1.5, 3 + Math.sin(i) * 0.6);
      b.gate(60, 0, 2.5, 4, 3.2);
      b.large(82, -2.4, 3.6).large(82, 2.4, 3.6).hint(72, 'LARGE CRYSTALS', 'Take two hits — and give more shards');
      b.gate(110, -1.6, 2.5, 3, 3.2).gate(110, 1.6, 2.5, 3, 3.2);
      b.swayCrystal(130, 'x', 2.5, 0.22, 0, 3.2).swayCrystal(142, 'x', 2.5, 0.22, 0, 4.2);
      b.arc(170, 6, 2.6, 3.4);
      b.gate(200, 0, 2.6, 4.6, 3.4, -0.3);
      b.slalom(215, 4, 10, 2.4);
      b.gate(258);
      b.music(120, 0.65);
    }),
    section('Threshold', 250, { seed: 14, checkpoint: true, speed: 10 }, (b) => {
      b.gate(20, 0, 2.5, 3.6, 3.2, 0.5).crystal(34, -2.5, 4).crystal(34, 2.5, 4);
      b.gate(56, 0, 2.5, 3.6, 3.2, -0.5).large(70, 0, 4.4);
      b.scatter(84, 5, 8, 3);
      b.gate(132, -1.5, 2.5, 3, 3.3).gate(132, 1.5, 2.5, 3, 3.3);
      b.slalom(146, 4, 9, 2);
      b.hint(170, 'THE THRESHOLD', 'Break through to the light', 2.6).tension(172).music(172, 0.85);
      b.wall(196, 3, 2, 2.3, 1.8, 2.8);
      b.crystal(212, -3, 5).crystal(212, 3, 5).crystal(222, 0, 3);
    }),
  ],
};
