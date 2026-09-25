import type { LevelDef } from '../types';
import { section } from '../patterns';

/** LEVEL 2 — THE GLASS CATHEDRAL. Huge glass, swinging chandeliers, first chain reactions. */
export const level2: LevelDef = {
  id: 1,
  name: 'The Glass Cathedral',
  subtitle: 'A cathedral of light, waiting to fall.',
  theme: 'cathedral',
  music: 'cathedral',
  accent: '#c6b8ff',
  baseSpeed: 11,
  startAmmo: 25,
  gravity: 9,
  sections: [
    section('The Nave', 210, { seed: 21 }, (b) => {
      b.large(40, 0, 4.5).crystal(52, -3, 6).crystal(52, 3, 6);
      b.gate(78, 0, 3, 6, 5);
      b.scatter(95, 5, 9, 4, 2, 7);
      b.gate(150, -2, 3, 3.6, 5).gate(150, 2, 3, 3.6, 5);
      b.arc(172, 6, 3, 4.5);
      b.gate(198, 0, 3.2, 6.5, 5.5, 0.2);
      b.music(60, 0.45);
    }),
    section('Chandeliers', 270, { seed: 22, checkpoint: true }, (b) => {
      b.hint(6, 'SWINGING GLASS', 'Time your shots');
      b.hanging(30, 0, 0.5, 0.3).crystal(44, -3, 5).crystal(44, 3, 5);
      b.hanging(66, -1, 0.6, 0.35).hanging(80, 1, 0.6, 0.35);
      b.special(100, 'timeCrystal', 0, 4.4).hint(90, 'CHRONO CRYSTAL', 'Shatter it to slow time');
      b.hanging(116, 0, 0.7, 0.4).hanging(122, -2.5, 0.4, 0.3, 3, 7.4, 2.4, 2.2).hanging(122, 2.5, 0.4, 0.3, 3, 7.4, 2.4, 2.2);
      b.slalom(140, 5, 10, 3, 4);
      b.hanging(200, 0, 0.8, 0.45);
      b.large(216, 0, 5).gate(236, 0, 3, 6, 5, -0.2).scatter(245, 3, 7, 3, 3, 6);
      b.music(120, 0.6);
    }),
    section('Rose Window', 280, { seed: 23, checkpoint: true, speed: 12 }, (b) => {
      b.arc(24, 8, 3.2, 4.2);
      b.hint(56, 'NOVA CORE', 'Its blast shatters everything nearby');
      b.cluster(78, 0, 3.4);
      b.gate(110, 0, 3, 6, 5);
      b.orbitRing(132, 5, 3, 0.8, 4.2);
      b.cluster(168, -1.5, 3.2);
      b.hanging(196, -1.4, 0.5, 0.35).hanging(196, 1.4, 0.5, 0.35, 3.4, 7.1, 3, 2.6);
      b.special(215, 'timeCrystal', 2.5, 5);
      b.arc(240, 6, 2.6, 4);
      b.gate(265, 0, 3.2, 6.5, 5.5);
      b.music(150, 0.75);
    }),
    section('The Great Collapse', 320, { seed: 24, checkpoint: true, speed: 12 }, (b) => {
      b.hint(4, 'THE GREAT COLLAPSE', 'Bring it all down', 3).tension(6).music(8, 0.9);
      b.crystal(30, -3, 4).crystal(30, 3, 4);
      b.explosiveWall(60, 4, 3, 3);
      b.scatter(80, 4, 8, 3.5, 2, 6);
      b.explosiveWall(130, 5, 3, 3);
      b.large(150, -3, 5).large(150, 3, 5);
      b.hanging(176, 0, 0.7, 0.45);
      b.explosiveWall(210, 5, 4, 3.6);
      b.arc(240, 8, 3.4, 4.4);
      b.explosiveWall(290, 6, 4, 3.6);
      b.pulse(292, 0xd4c8ff);
    }),
  ],
};
