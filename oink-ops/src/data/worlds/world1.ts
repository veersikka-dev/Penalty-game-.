import type { WorldDef } from './types';
import { barn, bush, fenceRow, field, flowers, house, pine, rock, scatter, tree, well, windmill } from '../../world/Props';

/**
 * WORLD 1 — PIGGY VILLAGE. The vertical slice: teaches movement, jumping,
 * shooting, aiming, reloading and destruction, then escalates to a village
 * defence, a generator puzzle, a climb, and the Big Bad Boar.
 * North is -Z. The player starts at the southern farm.
 */
export const world1: WorldDef = {
  id: 0,
  theme: 'village',
  name: 'Piggy Village',
  subtitle: 'The robots have come for the bacon.',
  accent: '#ff8fb1',
  size: 70,
  reward: 'carrot',
  build(b) {
    const P = b.theme.palette;
    b.ground();
    b.spawnAt(0, 60, Math.PI);

    // ---- Paths
    b.path([[0, 66], [0, 46], [0, 32], [0, 20], [0, 4], [0, -10], [-6, -26], [-18, -40], [-10, -54], [0, -64]], 4.2);
    b.path([[0, 18], [-18, 16], [-34, 14]], 3);
    b.path([[0, 20], [20, 24], [36, 30]], 3);
    b.path([[0, -12], [14, -22], [22, -28]], 3);

    // ---- Southern farm (start + tutorial)
    field(b, -26, 50, 16, 11);
    field(b, 24, 58, 10, 6, 0xff8a3a);
    barn(b, -32, 30, Math.PI / 2);
    fenceRow(b, -18, 44, -34, 44);
    fenceRow(b, -18, 56, -18, 44);
    fenceRow(b, 16, 62, 16, 52);
    fenceRow(b, 16, 52, 32, 52);
    // a low fence across the path — the jump tutorial
    fenceRow(b, -6, 44, 6, 44);
    b.prop('sign', -3.5, 58, { rot: 0.3 });
    b.prop('crate', -3, 51);
    b.prop('crate', 3.2, 50);
    b.prop('crate', 3.2, 51.3, { y: 1.2 });
    b.prop('hay', -5, 47);
    b.prop('barrel', 7, 40);
    b.prop('barrel', 8.2, 41.2);
    b.prop('pumpkin', -7, 38);
    b.prop('pumpkin', -8.2, 36.8);
    b.coinLine(0, 56, 0, 47, 6);
    b.coinLine(0, 41, 0, 34, 5);
    b.special('turbo', -10, 56);
    b.special('token', -30, 58, 0, 'w1t1');
    b.special('carrot', -26, 50, 0.3, 'w1c1'); // in the cornfield
    // pond with lily rocks
    b.pit(26, 42, 10, 8);
    rock(b, 20, 38, 1.2);
    rock(b, 32, 46, 1);
    b.special('token', 26, 36, 0, 'w1t2');

    // ---- Village square
    house(b, -15, 26, Math.PI / 2, 6, 5, 0);
    house(b, 15, 26, -Math.PI / 2, 6, 5, 1);
    house(b, -15, 12, Math.PI / 2, 6, 5, 2);
    house(b, 15, 12, -Math.PI / 2, 6, 5, 3);
    house(b, -26, 20, Math.PI / 2, 7, 5, 4);
    well(b, 0, 18);
    flowers(b, -5, 24, 10, 1.5);
    flowers(b, 5, 12, 10, 1.5);
    for (const [x, z, t] of [[-7, 27, 'crate'], [-7.8, 25.8, 'crate'], [7, 28, 'barrel'], [8, 10, 'hay'], [-8, 9, 'pumpkin'], [6.5, 9, 'crate'], [-9, 18, 'barrel'], [9, 18, 'crate'], [9, 19.3, 'crate']] as const) {
      b.prop(t, x, z, { y: z === 19.3 ? 1.2 : 0 });
    }
    b.prop('lamp', -6, 32);
    b.prop('lamp', 6, 32);
    b.prop('lamp', -6, 5);
    b.prop('lamp', 6, 5);
    b.coinRing(0, 18, 4.5, 10);
    b.special('health', 11, 32);
    b.special('rage', -11, 6);
    b.special('token', -22, 30, 0, 'w1t3');
    b.encounter({
      id: 'square',
      trigger: { x: 0, z: 22, r: 9 },
      waves: [
        [{ type: 'carrot', x: -10, z: 9 }, { type: 'carrot', x: 10, z: 9 }, { type: 'carrot', x: -9, z: 30 }, { type: 'carrot', x: 9, z: 30 }],
        [{ type: 'chicken', x: -9, z: 18 }, { type: 'chicken', x: 9, z: 18 }, { type: 'chicken', x: 0, z: 7 }, { type: 'carrot', x: -6, z: 30 }, { type: 'carrot', x: 6, z: 30 }],
      ],
    });

    // ---- Village wall with the generator-locked north gate
    const wallC = 0x9ab070;
    b.platform(-37.5, -4, 65, 2.2, 3.2, wallC, 0x6ac04a);
    b.platform(37.5, -4, 65, 2.2, 3.2, wallC, 0x6ac04a);
    for (let x = -68; x <= 68; x += 6) if (Math.abs(x) > 6) bush(b, x, -2.2, 1);
    b.gate('north', 0, -4, 10);
    // generator A — west hill, guarded by carrots
    b.platform(-38, 14, 10, 10, 2.4, P.stone, 0x7ad85a);
    b.stairs(-38, 21.5, 4, 5, 2.4, 6, '-z', P.stone);
    b.prop('generator', -38, 13, { y: 2.4, tag: 'gen' });
    b.prop('crate', -41, 11, { y: 2.4 });
    b.enemy('carrot', -34, 8);
    b.enemy('carrot', -42, 20);
    b.enemy('carrot', -30, 18);
    // generator B — east orchard, guarded by chickens
    for (const [x, z] of [[34, 22], [44, 24], [48, 34], [38, 40], [30, 34]]) tree(b, x, z, 1.2);
    b.prop('generator', 40, 30, { tag: 'gen' });
    b.enemy('chicken', 36, 26);
    b.enemy('chicken', 44, 30);
    b.prop('barrel', 42, 27);
    b.special('token', 48, 26, 0, 'w1t4');
    b.special('carrot', -37, 23.5, 0, 'w1c2'); // tucked behind barn
    b.coinLine(-20, 16, -30, 15, 5);
    b.coinLine(20, 25, 32, 29, 5);

    // ---- North: windmill hill (vertical climb)
    b.platform(26, -28, 18, 16, 1.4, P.stone, 0x7ad85a);
    b.ramp(14.5, -28, 5, 6, 0, 1.4, 'x', P.wood);
    b.platform(28, -26, 9, 8, 3.2, P.stone, 0x7ad85a, 0);
    b.stairs(21.5, -25, 3, 4, 3.2, 8, 'x', P.stone);
    windmill(b, 31, -33, Math.PI);
    b.special('shield', 28, -26, 3.2);
    b.special('carrot', 30.5, -23.5, 3.2, 'w1c3');
    b.coinLine(16, -28, 22, -28, 4, 1.4);
    b.coinRing(28, -26, 2.5, 8, 3.2);
    b.enemy('chicken', 20, -18);
    b.enemy('chicken', 34, -20);
    b.special('token', 36, -32, 1.4, 'w1t5');

    // ---- Boar paddock (NW)
    fenceRow(b, -34, -32, -26, -32);
    fenceRow(b, -14, -32, -6, -32);
    fenceRow(b, -34, -32, -34, -56);
    fenceRow(b, -6, -32, -6, -46);
    fenceRow(b, -34, -56, -14, -56);
    for (const [x, z] of [[-28, -38], [-12, -50], [-24, -52]]) b.prop('hay', x, z, { rot: 0.5 });
    b.prop('barrel', -18, -44);
    b.prop('barrel', -19.2, -45);
    b.prop('barrel', -28, -46);
    b.prop('tnt', -11, -40);
    b.special('golden', -2, -34);
    b.special('health', -30, -36);
    b.encounter({
      id: 'boar',
      trigger: { x: -20, z: -40, r: 10 },
      waves: [
        [{ type: 'boar', x: -20, z: -50 }, { type: 'carrot', x: -28, z: -48 }, { type: 'carrot', x: -12, z: -48 }],
        [{ type: 'carrot', x: -26, z: -36 }, { type: 'carrot', x: -14, z: -36 }, { type: 'chicken', x: -20, z: -52 }],
      ],
    });
    b.special('token', -32, -54, 0, 'w1t6');

    // ---- Secret: a cracked wall hides a little grotto with a star
    rock(b, 48, -44, 1.6);
    rock(b, 62, -58, 1.8);
    b.platform(52.25, -46.5, 2.5, 1.2, 3, P.stone);
    b.platform(57.75, -46.5, 2.5, 1.2, 3, P.stone);
    b.platform(50.5, -52, 1.5, 9, 3, P.stone);
    b.platform(59.5, -52, 1.5, 9, 3, P.stone);
    b.platform(55, -57.5, 10, 1.5, 3, P.stone);
    b.prop('crackedWall', 55, -46.5, { w: 3.5, h: 3 });
    b.special('star', 55, -52, 0, 'w1star');
    b.coinRing(55, -52, 1.8, 6);

    // ---- Exit
    b.exit(0, -64);
    b.special('token', -8, -62, 0, 'w1t7');
    b.special('token', 10, -58, 0, 'w1t8');
    b.special('token', -50, 0, 0, 'w1t9');
    b.special('token', 60, 10, 0, 'w1t10');

    // ---- Nature everywhere else
    const keep: [number, number, number][] = [[0, 18, 18], [0, 60, 8], [-26, 50, 10], [26, 42, 7], [-32, 30, 8], [-38, 14, 8], [40, 30, 6], [26, -28, 12], [-20, -44, 16], [55, -52, 9], [0, -62, 6], [0, 0, 6]];
    for (let i = -60; i <= 60; i += 10) keep.push([0, i, 4]);
    scatter(b, -68, 34, -40, 68, 18, ['tree', 'pine', 'bush', 'flowers'], keep);
    scatter(b, 34, 0, 68, 68, 18, ['tree', 'bush', 'flowers', 'rock'], keep);
    scatter(b, -68, -68, -38, 0, 22, ['pine', 'tree', 'bush', 'rock'], keep);
    scatter(b, 40, -68, 68, -8, 16, ['pine', 'tree', 'rock'], keep);
    scatter(b, -20, 34, 20, 68, 10, ['flowers', 'grass', 'bush'], keep);
    scatter(b, -30, -30, 12, -8, 10, ['tree', 'flowers', 'grass'], keep);
    for (let i = 0; i < 6; i++) pine(b, -8 + i * 3.2 - 30, -66, 1.3);

    // ---- Objectives
    b.objective({ type: 'reach', text: 'Head into Piggy Village', x: 0, z: 30, r: 6 });
    b.objective({ type: 'encounter', id: 'square', text: 'Defend the village square!', x: 0, z: 22, checkpoint: { x: 0, z: 22 } });
    b.objective({ type: 'destroy', tag: 'gen', text: 'Destroy the barrier generators', x: -38, z: 14, openGate: 'north', checkpoint: { x: 0, z: 6 }, via: [[-26, 24], [-38, 26]] });
    b.objective({ type: 'reach', text: 'Climb Windmill Hill', x: 28, z: -26, r: 3, via: [[0, -10], [12, -28], [20, -24]], checkpoint: { x: 26, z: -28 } });
    b.objective({ type: 'encounter', id: 'boar', text: 'Defeat the Big Bad Boar!', x: -20, z: -40, via: [[8, -30], [-6, -30]], checkpoint: { x: -10, z: -28 } });
    b.objective({ type: 'exit', text: 'Hop into the exit portal', x: 0, z: -64 });
  },
};
