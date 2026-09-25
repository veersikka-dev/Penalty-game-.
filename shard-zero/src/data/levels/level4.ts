import type { LevelDef } from '../types';
import { section } from '../patterns';

/** LEVEL 4 — THE VOID. Low gravity, orbiting crystals, shields, drifting glass in open space. */
export const level4: LevelDef = {
  id: 3,
  name: 'The Void',
  subtitle: 'Nothing holds you here.',
  theme: 'void',
  music: 'void',
  accent: '#6affe0',
  baseSpeed: 13,
  startAmmo: 25,
  gravity: 4,
  sections: [
    section('Drift', 230, { seed: 41 }, (b) => {
      b.hint(8, 'LOW GRAVITY', 'Your shots fly straighter out here');
      b.orbitRing(40, 4, 2.4, 0.7, 3);
      b.add({ at: 70, kind: 'panel', x: -6, y: 2.5, w: 3.6, h: 3, motion: { type: 'drift', vx: 1.4, vy: 0 } });
      b.crystal(84, 3, 5).crystal(90, -3, 1);
      b.orbitRing(110, 5, 3, -0.8, 3.4);
      b.swayGate(140, 3, 0.18, 3.4, 3);
      b.scatter(155, 5, 9, 4, 0, 6);
      b.add({ at: 210, kind: 'panel', x: 6, y: 2.5, w: 3.6, h: 3, motion: { type: 'drift', vx: -1.8, vy: 0 } });
      b.music(90, 0.5);
    }),
    section('Constellations', 290, { seed: 42, checkpoint: true, speed: 14 }, (b) => {
      b.hint(6, 'SHIELDED CORE', 'Shoot through the gaps in the orbiting shields');
      b.shielded(40, 0, 3.4, 3, 1.0);
      b.orbitRing(70, 6, 3.2, 1.0, 3.2);
      b.swayGate(96, 0, 0.1, 4, 3).add({ at: 96, kind: 'crystal', x: 0, y: 5.4 });
      b.shielded(126, -2.6, 3.4, 3, 1.2).shielded(126, 2.6, 3.4, 3, -1.2);
      b.add({ at: 160, kind: 'panel', x: 0, y: 2.5, w: 3.8, h: 3, motion: { type: 'sway', axis: 'y', amp: 2.4, freq: 0.3 } });
      b.special(180, 'multiplier', 0, 4);
      b.orbitRing(200, 6, 3.4, -1.2, 3.4).orbitRing(200, 3, 1.4, 1.6, 3.4);
      b.shielded(246, 0, 3.2, 4, 1.4);
      b.music(130, 0.65);
    }),
    section('Event Horizon', 300, { seed: 43, checkpoint: true, speed: 14 }, (b) => {
      b.approach(30, 'barrier', 0, 2.5, 5, 4, 3.3);
      b.add({ at: 44, kind: 'crystal', x: 0, y: 5, motion: { type: 'pendulum', length: 3, amp: 1, freq: 0.35 } });
      b.cluster(76, 0, 3.4);
      b.special(100, 'timeCrystal', -3, 4.5);
      b.orbitRing(120, 5, 2.8, 1.4, 3);
      b.approach(150, 'panel', -2, 2.5, 8, 3, 3).approach(150, 'panel', 2, 2.5, 8, 3, 3);
      b.scatter(164, 6, 7, 4, 0, 6);
      b.shielded(220, 0, 3.4, 4, 1.6, 2.1);
      b.explosiveWall(262, 5, 3, 3);
      b.music(160, 0.8);
    }),
    section('Singularity', 290, { seed: 44, checkpoint: true, speed: 15 }, (b) => {
      b.tension(4).hint(4, 'SINGULARITY', 'Hold on', 2.4).music(6, 0.9);
      b.orbitRing(30, 8, 3.6, 1.2, 3.4);
      b.approach(60, 'barrier', 0, 2.5, 6, 4.2, 3.4);
      b.shielded(90, -2.5, 3.2, 3, 1.5).shielded(90, 2.5, 3.2, 3, -1.5);
      b.special(114, 'multiplier', 0, 5).special(118, 'timeCrystal', 0, 1.6);
      b.add({ at: 140, kind: 'panel', x: 0, y: 2.5, w: 3.6, h: 3, motion: { type: 'orbit', radius: 1.2, speed: 1.6 } });
      b.scatter(150, 6, 7, 4, 0, 6);
      b.cluster(206, 0, 3.2);
      b.approach(236, 'panel', 0, 2.5, 10, 4, 3.4);
      b.orbitRing(258, 6, 3, -1.6, 3.2);
      b.explosiveWall(278, 5, 4, 3.4);
    }),
  ],
};
