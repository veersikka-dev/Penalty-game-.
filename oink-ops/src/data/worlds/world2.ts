import type { WorldDef } from './types';
import { candyCane, candyMachine, cupcakeHouse, factoryWall, gumdrop, lollipop, pipe, scatter } from '../../world/Props';

/**
 * WORLD 2 — CANDY FACTORY. Cross a chocolate river on moving platforms, fight on
 * the factory floor, shut down three sugar pumps, then survive the Sugar Rush.
 */
export const world2: WorldDef = {
  id: 1,
  theme: 'candy',
  name: 'Candy Factory',
  subtitle: 'Sweet, sticky and full of toasters.',
  accent: '#ff9ad8',
  size: 68,
  reward: 'egg',
  build(b) {
    const P = b.theme.palette;
    b.ground();
    b.spawnAt(0, 60, Math.PI);
    b.path([[0, 66], [0, 34]], 5);
    b.path([[0, 12], [0, -40], [0, -64]], 5);

    // ---- Entrance yard
    for (const z of [58, 50, 42]) {
      lollipop(b, -6, z, 1.1);
      lollipop(b, 6, z - 4, 1.1);
    }
    cupcakeHouse(b, -26, 52, 1);
    cupcakeHouse(b, 26, 50, 0.9);
    candyCane(b, -12, 38, 1);
    candyCane(b, 12, 38, 1);
    for (const [x, z] of [[-4, 46], [4, 44], [-10, 52], [10, 56]]) b.prop('candyJar', x, z);
    b.prop('gumball', 16, 44);
    b.prop('crate', -16, 44);
    b.prop('barrel', -18, 46);
    b.coinLine(0, 58, 0, 40, 8);
    b.enemy('toast', 4, 40);
    b.enemy('toast', -8, 44);
    b.special('ammo', 12, 58);
    b.special('token', -30, 60, 0, 'w2t1');
    b.special('token', 34, 40, 0, 'w2t2');

    // ---- Factory wall + chocolate river with moving platforms
    factoryWall(b, -36.5, 30, 63, 2, 7);
    factoryWall(b, 36.5, 30, 63, 2, 7);
    b.pit(0, 20, 136, 7);
    b.movingPlatform([[-6, 0, 27], [-6, 0, 13]], 4, 4, 4, 0xff6aa8, 0xffe0f0);
    b.movingPlatform([[6, 0, 13], [6, 0, 27]], 4, 4, 4, 0x6ad8ff, 0xe0f8ff);
    b.movingPlatform([[-30, 0, 27], [-30, 0, 13]], 4, 4, 3, 0xffe04a, 0xfff8d0);
    b.coinLine(-30, 26, -30, 14, 5, 0.4);
    b.special('carrot', -30, 20, 0.4, 'w2c1');

    // ---- Factory floor
    candyMachine(b, -18, 2, 0);
    candyMachine(b, 18, -4, 0);
    candyMachine(b, -12, -22, Math.PI / 2);
    candyMachine(b, 16, -24, Math.PI / 2);
    pipe(b, -40, 8, 40, 8, 8);
    pipe(b, -40, -16, 40, -16, 9, 0x6ad8ff);
    for (const [x, z] of [[-6, 6], [7, 4], [-4, -10], [6, -12]]) b.prop('gumball', x, z);
    for (const [x, z] of [[-24, -8], [24, 6], [-2, -28], [26, -14]]) b.prop('tnt', x, z);
    for (const [x, z] of [[-9, 0], [10, -2], [-26, 10], [28, -2]]) b.prop('candyJar', x, z);
    b.prop('barrel', 3, -18);
    b.prop('barrel', 4.2, -19);
    b.prop('barrel', -8, -16);
    // raised catwalk on the west side
    b.platform(-58, -8, 4, 34, 3, 0xc080ff, 0xffe0f0);
    b.stairs(-58, 11.5, 4, 5, 3, 8, '-z', 0xc080ff);
    b.coinLine(-58, 6, -58, -22, 10, 3);
    b.special('rage', -58, -24, 3);
    b.special('token', -58, 0, 3, 'w2t3');
    b.encounter({
      id: 'floor',
      trigger: { x: 0, z: 0, r: 11 },
      waves: [
        [{ type: 'toast', x: -12, z: -10 }, { type: 'toast', x: 12, z: -12 }, { type: 'chicken', x: -8, z: 6 }, { type: 'chicken', x: 8, z: 8 }, { type: 'chicken', x: 0, z: -14 }],
        [{ type: 'bubble', x: 0, z: -18 }, { type: 'chicken', x: -10, z: -6 }, { type: 'chicken', x: 10, z: -6 }, { type: 'carrot', x: -14, z: 4 }, { type: 'carrot', x: 14, z: 4 }, { type: 'carrot', x: 0, z: 10 }],
        [{ type: 'toast', x: -14, z: -16 }, { type: 'toast', x: 14, z: -18 }, { type: 'bubble', x: 0, z: -24 }, { type: 'chicken', x: 0, z: 8 }],
      ],
    });
    b.special('health', 22, 8);
    b.special('shield', -22, -14);

    // ---- Sugar pumps (puzzle) + vault gate
    b.prop('generator', -44, -10, { tag: 'pump' });
    b.prop('generator', 44, -12, { tag: 'pump' });
    b.prop('generator', 0, -32, { tag: 'pump' });
    b.enemy('chicken', -40, -6);
    b.enemy('toast', -46, -16);
    b.enemy('chicken', 40, -8);
    b.enemy('carrot', 46, -16);
    b.enemy('carrot', 42, -18);
    factoryWall(b, -36.5, -38, 63, 2, 7);
    factoryWall(b, 36.5, -38, 63, 2, 7);
    b.gate('vault', 0, -38, 10);
    b.special('token', -50, -20, 0, 'w2t4');
    b.special('token', 52, -4, 0, 'w2t5');
    b.special('carrot', 50, -30, 0, 'w2c2');
    b.special('ammo', -40, -24);
    b.special('ammo', 38, -24);

    // ---- Sugar Rush arena
    for (const [x, z] of [[-14, -48], [14, -50], [-10, -58], [12, -60]]) gumdrop(b, x, z, 1.4);
    for (const [x, z] of [[-18, -44], [18, -44]]) candyCane(b, x, z, 1.2);
    for (const [x, z] of [[-6, -46], [6, -54], [-8, -56]]) b.prop('gumball', x, z);
    b.prop('tnt', 0, -50);
    b.special('golden', 16, -56);
    b.special('health', -16, -58);
    b.encounter({
      id: 'rush',
      trigger: { x: 0, z: -48, r: 10 },
      waves: [
        [{ type: 'carrot', x: -12, z: -56 }, { type: 'carrot', x: 12, z: -56 }, { type: 'carrot', x: -8, z: -60 }, { type: 'carrot', x: 8, z: -60 }, { type: 'carrot', x: 0, z: -62 }],
        [{ type: 'chicken', x: -12, z: -58 }, { type: 'chicken', x: 12, z: -58 }, { type: 'chicken', x: 0, z: -60 }, { type: 'toast', x: -8, z: -62 }, { type: 'toast', x: 8, z: -62 }],
        [{ type: 'bubble', x: -10, z: -60 }, { type: 'bubble', x: 10, z: -60 }, { type: 'toast', x: -14, z: -62 }, { type: 'toast', x: 14, z: -62 }, { type: 'chicken', x: -4, z: -58 }, { type: 'chicken', x: 4, z: -58 }],
      ],
    });
    b.exit(0, -63);
    b.special('token', 30, -50, 0, 'w2t6');
    b.special('token', -30, -60, 0, 'w2t7');
    b.special('token', 20, 20, 0.4, 'w2t8');
    b.special('token', -50, 40, 0, 'w2t9');
    b.special('token', 50, 60, 0, 'w2t10');

    // ---- Secret grotto: cracked wafer wall
    b.platform(-62, 46, 4, 1.5, 3.5, P.stone, 0xff9ac8);
    b.platform(-54, 46, 4, 1.5, 3.5, P.stone, 0xff9ac8);
    b.platform(-63.25, 51, 1.5, 9, 3.5, P.stone, 0xff9ac8);
    b.platform(-52.75, 51, 1.5, 9, 3.5, P.stone, 0xff9ac8);
    b.platform(-58, 56, 12, 1.5, 3.5, P.stone, 0xff9ac8);
    b.prop('crackedWall', -58, 46, { w: 4, h: 3.5 });
    b.special('star', -58, 51, 0, 'w2star');
    b.special('carrot', -56, 53, 0, 'w2c3');

    const keep: [number, number, number][] = [[0, 50, 9], [0, 0, 24], [-58, -8, 6], [0, -52, 14], [-58, 51, 9], [-44, -10, 6], [44, -12, 6]];
    scatter(b, -66, 34, -32, 66, 16, ['lolly', 'gumdrop'], keep);
    scatter(b, 32, 34, 66, 66, 16, ['lolly', 'gumdrop'], keep);
    scatter(b, -66, -66, -24, -40, 10, ['gumdrop', 'lolly'], keep);
    scatter(b, 24, -66, 66, -40, 10, ['gumdrop', 'lolly'], keep);

    b.objective({ type: 'reach', text: 'Enter the Candy Factory', x: 0, z: 33, r: 5 });
    b.objective({ type: 'reach', text: 'Ride across the chocolate river', x: 0, z: 9, r: 5, via: [[-6, 28]] });
    b.objective({ type: 'encounter', id: 'floor', text: 'Clear the factory floor!', x: 0, z: 0, checkpoint: { x: 0, z: 6 } });
    b.objective({ type: 'destroy', tag: 'pump', text: 'Shut down the sugar pumps', x: 0, z: -32, openGate: 'vault', checkpoint: { x: 0, z: -30 } });
    b.objective({ type: 'encounter', id: 'rush', text: 'Survive the Sugar Rush!', x: 0, z: -48, checkpoint: { x: 0, z: -42 } });
    b.objective({ type: 'exit', text: 'Hop into the exit portal', x: 0, z: -63 });
  },
};
