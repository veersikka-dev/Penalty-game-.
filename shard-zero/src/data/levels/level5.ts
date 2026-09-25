import type { LevelDef } from '../types';
import { section } from '../patterns';

/** LEVEL 5 — THE CORE. Fastest, densest level, ending in the multi-phase boss encounter. */
export const level5: LevelDef = {
  id: 4,
  name: 'The Core',
  subtitle: 'At the heart of everything, a light that must break.',
  theme: 'core',
  music: 'core',
  accent: '#ffb040',
  baseSpeed: 15,
  startAmmo: 26,
  gravity: 9,
  boss: true,
  sections: [
    section('Ignition', 230, { seed: 51 }, (b) => {
      b.slalom(24, 6, 8, 2.4, 2.8);
      b.gate(80, 0, 2.5, 4, 3.4, 0.4);
      b.orbitRing(100, 5, 2.6, 1.2, 2.6);
      b.barrier(130, 2);
      b.special(142, 'multiplier', 0, 4.4);
      for (let i = 0; i < 8; i++) b.crystal(156 + i * 4, Math.sin(i * 0.9) * 3, 2.5 + Math.cos(i * 0.9) * 1.8);
      b.gate(206, -1.6, 2.5, 3, 3.3).gate(206, 1.6, 2.5, 3, 3.3);
      b.music(80, 0.55);
    }),
    section('Overload', 270, { seed: 52, checkpoint: true, speed: 16 }, (b) => {
      b.swayGate(26, 2.4, 0.35).approach(46, 'crystalLarge', 0, 3.4, 5);
      b.shielded(76, 0, 2.8, 3, 1.4, 1.9);
      b.cluster(106, 0, 2.6);
      b.hanging(136, 0, 0.6, 0.45, 2.6, 5.6, 3, 2.4);
      b.orbitRing(150, 6, 3, -1.3, 2.6);
      b.approach(180, 'barrier', 0, 2.5, 5, 4, 3.3);
      b.special(194, 'timeCrystal', 0, 4.6);
      b.scatter(204, 6, 6, 3.4, 0, 5);
      b.explosiveWall(254, 4, 3, 2.6);
      b.music(130, 0.75);
    }),
    section('Heart of the Machine', 250, { seed: 53, checkpoint: true, speed: 17 }, (b) => {
      b.tension(4).hint(4, 'HEART OF THE MACHINE', 'It knows you are here', 2.6).music(6, 0.9);
      b.special(26, 'multiplier', -2.5, 3.8).special(26, 'timeCrystal', 2.5, 3.8);
      b.swayGate(50, 2.6, 0.4).swayGate(62, 2.6, 0.4);
      b.orbitRing(80, 8, 3.2, 1.5, 2.6);
      b.approach(110, 'panel', -1.6, 2.5, 9, 3, 3.3).approach(110, 'panel', 1.6, 2.5, 9, 3, 3.3);
      b.cluster(140, 0, 2.6);
      b.barrier(168, 3);
      b.shielded(190, -2.4, 2.8, 3, 1.6, 1.8).shielded(190, 2.4, 2.8, 3, -1.6, 1.8);
      b.explosiveWall(232, 5, 3, 2.6);
    }),
    section('The Core', 220, { seed: 54, checkpoint: true }, (b) => {
      b.boss(0);
      b.crystal(20, -2, 3).crystal(26, 2, 3).large(40, 0, 3);
    }),
  ],
};
