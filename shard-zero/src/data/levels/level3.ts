import type { LevelDef } from '../types';
import { section } from '../patterns';

/** LEVEL 3 — NEON INDUSTRIAL. Reinforced barriers, moving glass, incoming objects, multipliers. */
export const level3: LevelDef = {
  id: 2,
  name: 'Neon Industrial',
  subtitle: 'The machine never sleeps.',
  theme: 'industrial',
  music: 'industrial',
  accent: '#ff7a3a',
  baseSpeed: 12,
  startAmmo: 25,
  gravity: 10,
  sections: [
    section('Intake', 220, { seed: 31 }, (b) => {
      b.crystal(24, -2, 3).crystal(30, 2, 3.5);
      b.hint(40, 'REINFORCED BARRIER', 'Three hits to break through');
      b.barrier(62);
      b.slalom(78, 5, 9, 2.4);
      b.hint(122, 'MOVING GLASS', 'Lead your shots');
      b.swayGate(140, 2.2, 0.2);
      b.crystal(154, 0, 4.8).crystal(160, -3, 2).crystal(160, 3, 2);
      b.swayGate(182, 2.4, 0.26);
      b.barrier(206, 3, 0, 2.5, 4.2, 3.4);
      b.music(80, 0.5);
    }),
    section('Assembly Line', 270, { seed: 32, checkpoint: true, speed: 13 }, (b) => {
      b.swayCrystal(20, 'y', 1.6, 0.3, -2.5, 3.2).swayCrystal(20, 'y', 1.6, 0.3, 2.5, 3.2);
      b.special(46, 'multiplier', 0, 4.4).hint(36, 'PRISM MULTIPLIER', 'Double score for 10 seconds');
      for (let i = 0; i < 6; i++) b.swayCrystal(60 + i * 5, 'x', 3, 0.3, 0, 2.5 + (i % 3) * 0.9);
      b.swayGate(104, 2.6, 0.28, 3, 3);
      b.barrier(126);
      b.large(140, -2.5, 4).large(140, 2.5, 4);
      b.swayGate(164, 2.2, 0.32).swayGate(172, 2.2, 0.32);
      b.scatter(186, 5, 8, 3.2, 1.5, 5.5);
      b.barrier(236, 3).crystal(250, 0, 3);
      b.music(120, 0.65);
    }),
    section('Furnace', 290, { seed: 33, checkpoint: true, speed: 13 }, (b) => {
      b.hint(6, 'INCOMING', 'Some objects come to you');
      b.approach(40, 'panel', 0, 2.5, 7, 3.8, 3.2);
      b.crystal(50, -3, 4).crystal(56, 3, 4);
      b.approach(80, 'crystal', -2, 3.5, 5).approach(84, 'crystal', 2, 3.5, 5);
      b.cluster(110, 0, 3.2);
      b.barrier(140, 3).special(150, 'timeCrystal', 0, 4.5);
      b.approach(172, 'panel', -1.6, 2.5, 8, 3, 3).approach(172, 'panel', 1.6, 2.5, 8, 3, 3);
      b.slalom(186, 6, 8, 2.8);
      b.cluster(240, 1.5, 3);
      b.approach(268, 'barrier', 0, 2.5, 5, 4, 3.3);
      b.music(150, 0.8);
    }),
    section('Pressure', 270, { seed: 34, checkpoint: true, speed: 14 }, (b) => {
      b.tension(4).hint(4, 'PRESSURE RISING', undefined, 2.4).music(6, 0.9);
      b.special(26, 'multiplier', -2.5, 4.2).special(26, 'timeCrystal', 2.5, 4.2);
      b.swayGate(50, 2.6, 0.34).barrier(66, 3);
      b.hanging(86, 0, 0.7, 0.45, 3.2, 6.8);
      b.scatter(96, 5, 7, 3, 1.5, 5.5);
      b.cluster(140, -1, 3.2).cluster(162, 1.5, 3);
      b.approach(190, 'panel', 0, 2.6, 9, 4, 3.4);
      b.swayCrystal(200, 'x', 3, 0.4, 0, 4.4, 'crystalLarge');
      b.barrier(226, 3, -1.5, 2.5, 3, 3.3).barrier(226, 2, 1.5, 2.5, 3, 3.3);
      b.explosiveWall(254, 4, 3, 3);
    }),
  ],
};
