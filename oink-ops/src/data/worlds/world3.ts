import type { WorldDef } from './types';
import { bigMushroom, brokenPillar, fern, giantLeafPlant, palm, rock, ropeBridge, ruinBlock, scatter, vine, waterfall } from '../../world/Props';

/**
 * WORLD 3 — JUNGLE. A river crossing by rope bridge, a waterfall, overgrown
 * ruins with climbable blocks, three cursed idols, and a boar in the temple court.
 */
export const world3: WorldDef = {
  id: 2,
  theme: 'jungle',
  name: 'The Jungle',
  subtitle: 'Ancient ruins. Angry vegetables.',
  accent: '#6ee7b7',
  size: 72,
  reward: 'bubble',
  build(b) {
    const P = b.theme.palette;
    b.ground();
    b.spawnAt(0, 64, Math.PI);
    b.path([[0, 68], [4, 50], [10, 40], [10, 28], [2, 16], [0, -20], [0, -40], [0, -66]], 4);

    // ---- River with a rope bridge and a waterfall
    b.pit(0, 34, 144, 7);
    ropeBridge(b, 10, 34, 11, false, 0.6);
    waterfall(b, -44, 44, 14, 10, 0);
    for (const [x, z] of [[-30, 40], [30, 42], [-20, 28], [36, 26]]) rock(b, x, z, 1.4);
    b.special('token', -44, 30, 0, 'w3t1');
    b.enemy('carrot', 14, 50);
    b.enemy('carrot', -4, 52);
    b.enemy('carrot', 6, 56);
    b.coinLine(10, 44, 10, 24, 8, 0.4);

    // ---- Ruins (vertical climbing area)
    ruinBlock(b, -22, 10, 8, 8, 3);
    b.stairs(-22, 16.5, 4, 5, 3, 8, '-z', P.stone);
    ruinBlock(b, -22, 4, 4, 4, 5.4);
    b.stairs(-16.75, 4, 3, 6.5, 5.4, 13, '-x', P.stone);
    b.prop('generator', -22, 4, { y: 5.4, tag: 'idol' });
    b.special('carrot', -24.5, 12.5, 3, 'w3c1');
    ruinBlock(b, 26, 6, 10, 10, 2);
    b.stairs(26, 12.5, 4, 3, 2, 5, '-z', P.stone);
    ruinBlock(b, 26, 4, 5, 5, 4.2);
    b.stairs(21.5, 4, 3, 4, 4.2, 10, 'x', P.stone);
    b.prop('generator', 27, 3, { y: 4.2, tag: 'idol' });
    b.special('token', 30, 9, 2, 'w3t2');
    for (const [x, z, h] of [[-8, 14, 4], [8, 18, 3], [-12, -2, 5], [12, -4, 3.5], [-4, -10, 2.5]]) brokenPillar(b, x, z, h);
    for (const [x, z] of [[-8, 8], [8, 6]]) vine(b, x, 6, z, 4);
    b.prop('pot', -4, 12);
    b.prop('pot', 4, 10);
    b.prop('pot', 5, 11.3);
    b.prop('mushroom', -14, 18);
    b.prop('mushroom', 16, 14);
    b.prop('barrel', 2, 0);
    b.prop('barrel', 3.2, -1);
    b.encounter({
      id: 'ruins',
      trigger: { x: 0, z: 12, r: 10 },
      waves: [
        [{ type: 'carrot', x: -10, z: 4 }, { type: 'carrot', x: 10, z: 4 }, { type: 'carrot', x: -6, z: 0 }, { type: 'carrot', x: 6, z: 0 }, { type: 'carrot', x: -12, z: 18 }, { type: 'carrot', x: 12, z: 18 }],
        [{ type: 'toast', x: -8, z: -4 }, { type: 'toast', x: 8, z: -6 }, { type: 'chicken', x: 0, z: -8 }, { type: 'carrot', x: -14, z: 8 }, { type: 'carrot', x: 14, z: 8 }],
      ],
    });
    b.special('health', 0, 20);
    b.special('turbo', -30, 24);

    // ---- Third idol: on a mossy island south of the temple wall
    ruinBlock(b, 0, -12, 6, 6, 1.4);
    b.stairs(0, -7, 4, 3, 1.4, 4, '-z', P.stone);
    b.prop('generator', 0, -12, { y: 1.4, tag: 'idol' });
    b.enemy('toast', -6, -14);
    b.enemy('chicken', 6, -12);
    // temple wall + gate
    b.platform(-38, -22, 66, 3, 5, P.stone, 0x5ab04a);
    b.platform(38, -22, 66, 3, 5, P.stone, 0x5ab04a);
    b.gate('temple', 0, -22, 10);
    b.special('ammo', 12, -16);

    // ---- Temple court and stepped pyramid
    ruinBlock(b, 0, -54, 20, 12, 2);
    ruinBlock(b, 0, -56, 14, 8, 4);
    ruinBlock(b, 0, -57, 8, 5, 6);
    b.stairs(0, -46, 5, 4, 2, 5, '-z', P.stone);
    b.stairs(0, -50.5, 4, 3, 4, 10, '-z', P.stone);
    b.stairs(0, -53.5, 3, 3, 6, 14, '-z', P.stone);
    b.special('star', 0, -57, 6, 'w3star');
    for (const [x, z] of [[-14, -34], [14, -34], [-16, -44], [16, -44]]) brokenPillar(b, x, z, 4.5);
    b.prop('tnt', -8, -38);
    b.prop('barrel', 9, -40);
    b.prop('barrel', 10, -41.2);
    b.special('golden', -12, -30);
    b.special('health', 12, -30);
    b.encounter({
      id: 'temple',
      trigger: { x: 0, z: -32, r: 9 },
      waves: [
        [{ type: 'boar', x: 0, z: -42 }, { type: 'carrot', x: -10, z: -40 }, { type: 'carrot', x: 10, z: -40 }],
        [{ type: 'toast', x: -12, z: -44 }, { type: 'toast', x: 12, z: -44 }, { type: 'chicken', x: -6, z: -40 }, { type: 'chicken', x: 6, z: -40 }, { type: 'bubble', x: 0, z: -46 }],
      ],
    });
    b.exit(-20, -62);

    // ---- Hidden cave behind the waterfall cliff (east)
    b.platform(52, -40, 4, 1.5, 4, P.stone, 0x5ab04a);
    b.platform(60, -40, 4, 1.5, 4, P.stone, 0x5ab04a);
    b.platform(50.75, -46, 1.5, 11, 4, P.stone, 0x5ab04a);
    b.platform(61.25, -46, 1.5, 11, 4, P.stone, 0x5ab04a);
    b.platform(56, -52, 12, 1.5, 4, P.stone, 0x5ab04a);
    b.prop('crackedWall', 56, -40, { w: 4, h: 3.8 });
    b.special('carrot', 56, -46, 0, 'w3c2');
    b.coinRing(56, -46, 2.2, 8);
    b.special('carrot', 36, -60, 0, 'w3c3');
    for (const [id, x, z] of [['w3t3', -50, 10], ['w3t4', 50, 20], ['w3t5', -40, -40], ['w3t6', 44, -10], ['w3t7', -60, 60], ['w3t8', 60, 60], ['w3t9', 20, -60], ['w3t10', -30, -60]] as const) b.special('token', x, z, 0, id);

    const keep: [number, number, number][] = [[10, 34, 8], [0, 10, 18], [-22, 8, 10], [26, 5, 10], [0, -12, 7], [0, -40, 22], [56, -46, 9], [-44, 46, 12], [0, 60, 6], [-20, -62, 5]];
    for (let z = -60; z <= 64; z += 8) keep.push([z > 20 ? 8 : 0, z, 4]);
    scatter(b, -70, 40, 70, 70, 26, ['palm', 'fern', 'rock', 'palm'], keep);
    scatter(b, -70, -18, -30, 30, 18, ['palm', 'fern', 'mushroom'], keep);
    scatter(b, 34, -18, 70, 30, 18, ['palm', 'fern', 'mushroom'], keep);
    scatter(b, -70, -70, -26, -26, 14, ['palm', 'fern'], keep);
    scatter(b, 26, -70, 70, -26, 12, ['palm', 'fern'], keep);
    for (const [x, z] of [[-40, 20], [40, 16], [-50, -10], [50, -30]]) giantLeafPlant(b, x, z, 1.4);
    for (const [x, z] of [[-34, -8], [36, -2]]) bigMushroom(b, x, z, 1.5);
    fern(b, -6, 24);
    palm(b, 20, 56, 1.3);

    b.objective({ type: 'reach', text: 'Cross the rope bridge', x: 10, z: 26, r: 5, via: [[10, 42]] });
    b.objective({ type: 'encounter', id: 'ruins', text: 'Survive the ambush in the ruins!', x: 0, z: 12, checkpoint: { x: 4, z: 22 } });
    b.objective({ type: 'destroy', tag: 'idol', text: 'Smash the cursed idols', x: 0, z: -12, openGate: 'temple', checkpoint: { x: 0, z: -4 } });
    b.objective({ type: 'encounter', id: 'temple', text: 'Defeat the temple guardian!', x: 0, z: -32, checkpoint: { x: 0, z: -26 } });
    b.objective({ type: 'exit', text: 'Hop into the exit portal', x: -20, z: -62 });
  },
};
