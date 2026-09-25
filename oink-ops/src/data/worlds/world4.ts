import type { WorldDef } from './types';
import { flyingCars, hologram, neonSign, skyscraper, streetLamp } from '../../world/Props';

/**
 * WORLD 4 — ROBOT CITY. Neon avenues between skyscrapers, a plaza battle,
 * three relay towers to sabotage, and a final stand in Tower Square.
 */
export const world4: WorldDef = {
  id: 3,
  theme: 'city',
  name: 'Robot City',
  subtitle: 'Neon lights, flying cars, zero pigs allowed.',
  accent: '#9b7bff',
  size: 74,
  reward: 'pulse',
  build(b) {
    const P = b.theme.palette;
    b.ground();
    b.spawnAt(0, 66, Math.PI);
    b.path([[0, 72], [0, -72]], 12, 0x2a2a3a);
    b.path([[-72, 30], [72, 30]], 9, 0x2a2a3a);
    b.path([[-72, -6], [72, -6]], 8, 0x2a2a3a);
    // lane stripes
    for (let z = 64; z > -70; z -= 6) b.add(b.rbox(0.3, 0.04, 2.4, 0.05), 0xffe04a, [0, 0.05, z], [0, 0, 0], [1, 1, 1], 0, false);

    // ---- Skyscraper blocks (leave avenues at x≈0, z≈30, z≈-6)
    const blocks: [number, number, number, number, number][] = [
      [-18, 52, 14, 14, 26], [18, 54, 14, 12, 34], [-40, 54, 14, 14, 20], [40, 52, 14, 14, 30],
      [-18, 12, 14, 18, 30], [18, 12, 14, 18, 22], [-44, 12, 16, 18, 36],
      [-18, -26, 14, 26, 40], [18, -28, 14, 22, 28], [44, -30, 16, 20, 34],
    ];
    blocks.forEach(([x, z, w, d, h], i) => skyscraper(b, x, z, w, d, h, i));
    // a low building with a climbable rooftop (relay on top)
    b.platform(44, 12, 16, 16, 3.5, P.primary[2], 0x3a3a54);
    b.stairs(44, 1.5, 4, 5, 3.5, 9, 'z', 0x6a6a84);
    neonSign(b, -11, 12, 52, Math.PI / 2, 'OINK', '#ff5ac8');
    neonSign(b, 11, 16, 54, -Math.PI / 2, 'BOLTS', '#3affd8');
    neonSign(b, -11, 10, 12, Math.PI / 2, 'TOAST 24/7', '#ffe04a', 5);
    neonSign(b, 11, 11, 12, -Math.PI / 2, 'ROBO', '#7a8aff');
    neonSign(b, -11, 14, -26, Math.PI / 2, 'NO PIGS', '#ff4a4a', 5);
    neonSign(b, 11, 12, -28, -Math.PI / 2, 'CHROME', '#3affd8', 5);
    for (let z = 60; z > -66; z -= 14) {
      streetLamp(b, -6.5, z);
      streetLamp(b, 6.5, z - 7, 0xff5ac8);
    }
    flyingCars(b, 0, 30, 28, 14, 5);
    flyingCars(b, 0, -48, 22, 16, 4);

    // ---- Main street
    for (const [x, z] of [[-4, 58], [4, 50], [-3, 44]]) b.prop('vending', x, z, { rot: x < 0 ? Math.PI / 2 : -Math.PI / 2 });
    b.prop('barrel', 3, 42);
    b.prop('barrel', 4.1, 41);
    b.prop('crate', -4, 38);
    b.enemy('chicken', 0, 46);
    b.enemy('toast', 3, 40);
    b.coinLine(0, 62, 0, 40, 9);
    b.special('ammo', -6, 60);
    b.special('token', -30, 64, 0, 'w4t1');

    // ---- Plaza fight
    hologram(b, 0, 30);
    for (const [x, z] of [[-8, 26], [8, 34], [-10, 34], [10, 26]]) b.prop('vending', x, z);
    for (const [x, z] of [[-14, 30], [14, 30]]) b.prop('tnt', x, z);
    b.prop('glass', -26, 36, { w: 4, h: 3 });
    b.prop('glass', 26, 24, { w: 4, h: 3 });
    b.special('health', 22, 36);
    b.special('rage', -22, 24);
    b.encounter({
      id: 'plaza',
      trigger: { x: 0, z: 30, r: 12 },
      waves: [
        [{ type: 'chicken', x: -18, z: 30 }, { type: 'chicken', x: 18, z: 30 }, { type: 'chicken', x: 0, z: 22 }, { type: 'toast', x: -12, z: 22 }, { type: 'toast', x: 12, z: 38 }],
        [{ type: 'bubble', x: 0, z: 20 }, { type: 'bubble', x: 20, z: 32 }, { type: 'carrot', x: -20, z: 28 }, { type: 'carrot', x: -20, z: 34 }, { type: 'carrot', x: 20, z: 26 }, { type: 'carrot', x: 20, z: 36 }],
        [{ type: 'toast', x: -16, z: 22 }, { type: 'toast', x: 16, z: 22 }, { type: 'toast', x: 0, z: 40 }, { type: 'chicken', x: -8, z: 20 }, { type: 'chicken', x: 8, z: 20 }],
      ],
    });

    // ---- Relays
    b.prop('generator', -30, -6, { tag: 'relay' });
    b.prop('generator', 58, -4, { tag: 'relay' });
    b.prop('generator', 0, -20, { tag: 'relay' });
    b.enemy('toast', -34, -2);
    b.enemy('chicken', -26, -10);
    b.enemy('bubble', 54, 0);
    b.enemy('chicken', 60, -10);
    b.enemy('carrot', 4, -18);
    b.enemy('carrot', -4, -22);
    b.enemy('toast', 0, -14);
    b.special('ammo', 30, -4);
    b.special('token', 52, 18, 3.5, 'w4t2');
    b.special('carrot', 50, 6, 3.5, 'w4c1');
    b.special('token', -60, -6, 0, 'w4t3');
    b.special('token', 64, -6, 0, 'w4t4');
    // barricade + gate into Tower Square
    b.platform(-40, -40, 68, 2, 3.2, 0x5a5a74, 0x3affd8);
    b.platform(40, -40, 68, 2, 3.2, 0x5a5a74, 0x3affd8);
    b.gate('tower', 0, -40, 12);

    // ---- Tower Square
    hologram(b, 0, -56, 0xff5ac8);
    for (const [x, z] of [[-12, -48], [12, -50], [-8, -62], [10, -62]]) b.prop('vending', x, z);
    for (const [x, z] of [[-18, -54], [18, -56]]) b.prop('barrel', x, z);
    b.prop('tnt', 0, -48);
    b.special('golden', -20, -62);
    b.special('shield', 20, -62);
    b.special('health', 0, -66);
    b.encounter({
      id: 'square',
      trigger: { x: 0, z: -48, r: 10 },
      waves: [
        [{ type: 'boar', x: 0, z: -60 }, { type: 'bubble', x: -12, z: -58 }, { type: 'bubble', x: 12, z: -58 }],
        [{ type: 'toast', x: -16, z: -60 }, { type: 'toast', x: 16, z: -60 }, { type: 'chicken', x: -8, z: -56 }, { type: 'chicken', x: 8, z: -56 }, { type: 'carrot', x: -4, z: -64 }, { type: 'carrot', x: 4, z: -64 }, { type: 'carrot', x: 0, z: -58 }],
      ],
    });
    b.exit(24, -66);
    for (const [id, x, z] of [['w4t5', -64, 44], ['w4t6', 64, 40], ['w4t7', -30, -60], ['w4t8', 30, -54], ['w4t9', -60, 30], ['w4t10', 60, -66]] as const) b.special('token', x, z, 0, id);
    b.special('carrot', -62, 64, 0, 'w4c2');
    b.special('carrot', 62, -48, 0, 'w4c3');
    // secret: cracked wall into a sealed alley
    b.platform(-60, -28, 1.5, 4, 4, 0x5a5a74);
    b.platform(-60, -20, 1.5, 4, 4, 0x5a5a74);
    b.platform(-67, -18, 14, 1.5, 4, 0x5a5a74);
    b.platform(-67, -30, 14, 1.5, 4, 0x5a5a74);
    b.prop('crackedWall', -60, -24, { w: 4, h: 3.8, rot: Math.PI / 2 });
    b.special('star', -66, -24, 0, 'w4star');

    b.objective({ type: 'reach', text: 'Head down the neon avenue', x: 0, z: 40, r: 5 });
    b.objective({ type: 'encounter', id: 'plaza', text: 'Win the plaza brawl!', x: 0, z: 30, checkpoint: { x: 0, z: 36 } });
    b.objective({ type: 'destroy', tag: 'relay', text: 'Sabotage the relay towers', x: 0, z: -20, openGate: 'tower', checkpoint: { x: 0, z: -6 }, via: [[0, 20], [0, -2]] });
    b.objective({ type: 'encounter', id: 'square', text: 'Take back Tower Square!', x: 0, z: -48, checkpoint: { x: 0, z: -44 }, via: [[0, -30]] });
    b.objective({ type: 'exit', text: 'Hop into the exit portal', x: 24, z: -66 });
  },
};
