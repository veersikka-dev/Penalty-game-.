import type { WorldDef } from './types';
import { banner, castleWall, spikes, torch, tower } from '../../world/Props';

/**
 * WORLD 5 — THE PIG BOSS FORTRESS. Cross the lava moat, storm the courtyard,
 * break the two arena seals, then face the Giant Bacon Machine on a floor
 * that collapses beneath you.
 */
export const world5: WorldDef = {
  id: 4,
  theme: 'fortress',
  name: 'Pig Boss Fortress',
  subtitle: 'Something enormous is sizzling inside.',
  accent: '#ff8a5a',
  size: 70,
  build(b) {
    const P = b.theme.palette;
    b.ground();
    b.spawnAt(0, 64, Math.PI);
    b.path([[0, 68], [0, 30], [0, -18]], 6);

    // ---- Lava moat with a stone bridge and moving side platforms
    b.pit(0, 42, 140, 8);
    b.platform(0, 42, 6, 11, 0.4, P.stone, 0x7a6a60);
    for (const s of [-1, 1]) {
      torch(b, s * 3.4, 48, 0.4);
      torch(b, s * 3.4, 36, 0.4);
    }
    b.movingPlatform([[-24, 0, 48], [-24, 0, 36]], 4, 4, 3.5, 0x6a5048, 0x8a7064);
    b.movingPlatform([[24, 0, 36], [24, 0, 48]], 4, 4, 3.5, 0x6a5048, 0x8a7064);
    b.coinLine(-24, 47, -24, 37, 5, 0.4);
    b.coinLine(24, 37, 24, 47, 5, 0.4);
    b.special('carrot', 24, 42, 0.4, 'w5c1');
    b.special('ammo', 6, 58);
    b.special('health', -6, 58);
    b.enemy('toast', 0, 52);
    b.enemy('chicken', 8, 56);
    b.enemy('chicken', -8, 56);

    // ---- Outer wall with gatehouse opening
    castleWall(b, -37, 30, 66, true, 7);
    castleWall(b, 37, 30, 66, true, 7);
    tower(b, -6, 30, 2.4, 11);
    tower(b, 6, 30, 2.4, 11);
    banner(b, -6, 9, 32.6, 0);
    banner(b, 6, 9, 32.6, 0);
    tower(b, -60, 30, 3.5, 12);
    tower(b, 60, 30, 3.5, 12);

    // ---- Courtyard
    for (const [x, z] of [[-20, 20], [20, 20], [-20, 0], [20, 0]]) {
      b.platform(x, z, 4, 4, 1.2, P.stone, 0x7a6a60);
      torch(b, x, z, 1.2);
    }
    spikes(b, -34, 12, 6, 3);
    spikes(b, 34, 8, 6, 3);
    for (const [x, z] of [[-8, 18], [8, 22], [-10, 4], [10, 2], [0, 12]]) b.prop('crate', x, z);
    for (const [x, z] of [[-14, 12], [14, 14], [-4, 26], [4, -4]]) b.prop('barrel', x, z);
    b.prop('tnt', 0, 6);
    b.special('rage', -26, 26);
    b.special('turbo', 26, 26);
    b.encounter({
      id: 'gatehouse',
      trigger: { x: 0, z: 20, r: 10 },
      waves: [
        [{ type: 'chicken', x: -14, z: 8 }, { type: 'chicken', x: 14, z: 8 }, { type: 'chicken', x: 0, z: 2 }, { type: 'chicken', x: -6, z: 14 }, { type: 'carrot', x: -18, z: 14 }, { type: 'carrot', x: 18, z: 14 }, { type: 'carrot', x: 0, z: 0 }],
        [{ type: 'toast', x: -16, z: 4 }, { type: 'toast', x: 16, z: 4 }, { type: 'toast', x: 0, z: -2 }, { type: 'bubble', x: 0, z: 6 }],
        [{ type: 'boar', x: 0, z: 0 }, { type: 'chicken', x: -12, z: 2 }, { type: 'chicken', x: 12, z: 2 }],
      ],
    });
    b.special('health', 0, 26);
    b.special('shield', -12, -6);

    // ---- Seals guarding the arena gate
    b.platform(-32, -2, 8, 8, 2, P.stone, 0x7a6a60);
    b.stairs(-32, 4.5, 4, 5, 2, 5, '-z', P.stone);
    b.prop('generator', -32, -3, { y: 2, tag: 'seal' });
    b.platform(32, -2, 8, 8, 2, P.stone, 0x7a6a60);
    b.stairs(32, 4.5, 4, 5, 2, 5, '-z', P.stone);
    b.prop('generator', 32, -3, { y: 2, tag: 'seal' });
    b.enemy('toast', -30, 2);
    b.enemy('toast', 30, 2);
    b.enemy('carrot', -36, 6);
    b.enemy('carrot', 36, 6);
    castleWall(b, -41, -12, 58, true, 7);
    castleWall(b, 41, -12, 58, true, 7);
    b.gate('arena', 0, -12, 24);
    banner(b, -14, 8, -10.6, 0, 0x5a2a4a);
    banner(b, 14, 8, -10.6, 0, 0x5a2a4a);

    // ---- Boss arena: raised stone floor over lava; the outer ring collapses in phase 4
    const cx = 0, cz = -42;
    b.pit(cx, cz - 16, 40, 8);
    b.pit(cx, cz + 16, 40, 8);
    b.pit(cx - 16, cz, 8, 24);
    b.pit(cx + 16, cz, 8, 24);
    b.platform(cx, cz, 24, 24, 0.4, 0x6a5a54, 0x8a7a70);
    for (const x of [-16, -8, 0, 8, 16]) {
      b.arenaTile(cx + x, cz - 16, 8, 8, 0.4, 0x6a5a54, 0x8a7a70);
      b.arenaTile(cx + x, cz + 16, 8, 8, 0.4, 0x6a5a54, 0x8a7a70);
    }
    for (const z of [-8, 0, 8]) {
      b.arenaTile(cx - 16, cz + z, 8, 8, 0.4, 0x6a5a54, 0x8a7a70);
      b.arenaTile(cx + 16, cz + z, 8, 8, 0.4, 0x6a5a54, 0x8a7a70);
    }
    b.data.bossArena = { x: cx, z: cz };
    castleWall(b, cx - 22, cz, 44, false, 9);
    castleWall(b, cx + 22, cz, 44, false, 9);
    castleWall(b, cx, cz - 22, 46, true, 9);
    for (const [x, z] of [[-22, -20], [22, -20], [-22, -64], [22, -64]]) tower(b, x, z, 3, 14);
    for (const [x, z] of [[-12, -20.5], [12, -20.5]]) torch(b, x, z);
    b.special('health', -8, -34, 0.4);
    b.special('health', 8, -34, 0.4);
    b.special('ammo', 0, -18);
    b.exit(0, -16);

    // ---- Collectibles
    for (const [id, x, z] of [['w5t1', -50, 60], ['w5t2', 50, 58], ['w5t3', -52, 16], ['w5t4', 52, 14], ['w5t5', -24, 24], ['w5t6', 24, 24], ['w5t7', -50, -4], ['w5t8', 50, -4], ['w5t9', 0, 30], ['w5t10', -40, 60]] as const) b.special('token', x, z, 0, id);
    b.special('carrot', -32, -3, 2, 'w5c2');
    b.special('carrot', 32, -6, 2, 'w5c3');
    // secret: cracked wall in the west tower base leads to a tiny vault
    b.platform(-54, 12, 1.5, 4, 4, P.stone);
    b.platform(-54, 20, 1.5, 4, 4, P.stone);
    b.platform(-62, 10, 16, 1.5, 4, P.stone);
    b.platform(-62, 22, 16, 1.5, 4, P.stone);
    b.prop('crackedWall', -54, 16, { w: 4, h: 3.8, rot: Math.PI / 2 });
    b.special('star', -62, 16, 0, 'w5star');

    b.objective({ type: 'reach', text: 'Cross the lava moat', x: 0, z: 34, r: 5 });
    b.objective({ type: 'encounter', id: 'gatehouse', text: 'Storm the fortress courtyard!', x: 0, z: 20, checkpoint: { x: 0, z: 26 } });
    b.objective({ type: 'destroy', tag: 'seal', text: 'Break the arena seals', x: 0, z: -2, openGate: 'arena', checkpoint: { x: 0, z: -4 } });
    b.objective({ type: 'boss', text: 'Defeat the Giant Bacon Machine!', x: cx, z: cz + 10, checkpoint: { x: 0, z: -22 }, via: [[0, -8]] });
    b.objective({ type: 'exit', text: 'Hop into the exit portal — you did it!', x: 0, z: -16 });
  },
};
