# SHARD//ZERO

*Break the silence.*

SHARD//ZERO is a first-person arcade shooter that runs in the browser. You travel down a corridor of light and glass and shatter everything in your way. Each orb you fire costs one **shard**. Break crystals to win shards back. Leave glass standing and you crash into it. Run out of shards and the run is over.

There are five hand-built sectors, each with its own look, music and mechanics. The last one ends in a three-phase boss fight.

![levels](https://img.shields.io/badge/sectors-5-8ff0ff) ![engine](https://img.shields.io/badge/three.js-WebGL-a78bff) ![audio](https://img.shields.io/badge/audio-100%25%20procedural-ffd35a)

---

## Quick start

Requires **Node.js 18+**.

```bash
cd shard-zero
npm install
npm run dev        # starts the dev server and opens the game in your browser
```

Production build:

```bash
npm run build      # type-checks, then writes an optimised static site to dist/
npm run preview    # serves dist/ locally to check the build
```

`dist/` is fully static, so you can host it on any static web host (GitHub Pages, Netlify, itch.io and so on).

## Controls

| Input | Action |
|---|---|
| **Mouse** | Aim. Click once in the game to capture the mouse. |
| **Left click** | Fire an orb (costs 1 shard) |
| **Esc** / **P** | Pause (Esc also releases the mouse) |
| **F** | Toggle fullscreen |
| **Space** | Skip the intro |

If the browser refuses pointer lock, the game falls back to **cursor aim**: the crosshair follows your cursor.

## How to play

- **Shards are your ammo and your life.** Every shot costs one. When you hit zero, the run ends.
- **Crystals** (blue and teal) give shards back. Large crystals take 2 hits and give more.
- **Glass in your path** must be broken. Crashing into it costs **10 shards**. Glass off to the side is optional bonus score.
- **Combos:** break things quickly, one after another, to climb from x1 to x5. A missed shot breaks the combo.
- **Precision:** long shots, double and triple multi-kills, and streaks of 10 hits in a row all pay bonuses.
- **Special objects:**
  - **Chrono crystal** (gold): slows time for 4 seconds.
  - **Prism** (magenta): doubles your score for 10 seconds.
  - **Nova core** (red): explodes and sets off a chain reaction that destroys everything nearby.
- **Obstacle types:**
  - Reinforced barriers need 3 hits.
  - Hanging glass swings.
  - Some glass sways or moves towards you.
  - Shielded crystals hide behind orbiting plates.
- **Checkpoints** mark the start of each section. If you fail, you can retry from the last one.

### Sectors

| # | Sector | Identity | New mechanics |
|---|---|---|---|
| 01 | **The Awakening** | Black mirrored corridor, cold blue light | Shooting, crystals, glass, combos (includes the cinematic intro) |
| 02 | **The Glass Cathedral** | Mirrored pillars, stained light, floating geometry | Swinging glass, Chrono crystals, Nova chain reactions, "Great Collapse" walls |
| 03 | **Neon Industrial** | Pipes, grating, fans, rotating beacons | Reinforced barriers, moving glass, incoming objects, Prism multipliers |
| 04 | **The Void** | Open space, floating platforms, giant structures | Low gravity, orbiting crystals, shields, drifting glass |
| 05 | **The Core** | Living energy tunnel, blinding speed | Everything at once, then **THE HEART**, a three-phase boss |

Progress, unlocks, best scores, accuracy, best combo and best times are saved in `localStorage`. You can replay any sector you've cleared from **Levels**.

---

## Architecture

```
src/
  main.ts                 Boot: WebGL check, loading screen, error handling, QA hooks
  core/
    Game.ts               Orchestrator: state machine, main loop, game rules, menu actions
    Session.ts            Per-run rules: shards, combo, multipliers, accuracy, stats
    Settings.ts           Settings, quality profiles, progression (localStorage)
    Input.ts              Mouse/keyboard, pointer lock with cursor-aim fallback
    ErrorHandler.ts       Global error capture, optional-feature guards, WebGL detection
    Autopilot.ts          QA bot used for automated play-testing
  player/
    Player.ts             Rail movement, easing, stop-at (boss arena)
    CameraController.ts   Smoothed look, trauma shake, recoil, FOV, bob, roll
    ShootingSystem.ts     Pooled projectiles, swept collision, bounces, trails
  targets/
    TargetDefs.ts         Gameplay data for every object type (tuning lives here)
    Target.ts             Target state
    TargetFactory.ts      Pooled meshes/materials per kind
    TargetManager.ts      Motion, collision, crashes, chain reactions
  destruction/
    DestructionSystem.ts  Crack, then shatter; size-graded shards, sparks, dust
    FragmentSystem.ts     Instanced debris (about 13 draw calls for all fragments)
    ParticleSystem.ts     One-draw-call GPU point particles
    ShardGeometry.ts      Pre-generated glass slivers, crystal chunks, bipyramids
  world/
    Environment.ts        Chunk streaming, fog, fixed light rig, per-theme reflection maps
    LevelManager.ts       Section timeline, spawning, scripts, checkpoints
    Boss.ts               THE HEART: phases, weak points, shields, hunter orbs
    themes/               One file per environment (geometry, palette, lighting, bounds)
  materials/
    GlassMaterial.ts      Glass shader (fresnel, glowing edges, procedural cracks) + energy shader
  effects/
    PostFX.ts             Bloom + final pass (speed blur, CA, speed lines, vignette, grain)
    ScreenEffects.ts      Flashes, damage, desaturation, tint, fades
    VFXManager.ts         Pooled flash lights, shockwave rings, flares, bursts
    AmbientDust.ts        Camera-wrapped floating motes
  audio/
    AudioManager.ts       Procedural SFX, buses, reverb, volume control
    MusicManager.ts       Look-ahead sequencer with intensity layers, tension sweeps
    musicThemes.ts        Each sector's track described as data
  ui/                     HUD, loading screen, menus, level select, settings, results, ending
  data/
    types.ts              Level format types
    patterns.ts           Authoring DSL (gates, slaloms, walls, clusters, shields…)
    levels/level1-5.ts    The five sectors
```

### Adding a level

Levels are data. Create `src/data/levels/level6.ts` using the `section()` builder, then add it to `src/data/levels/index.ts`. Menus, unlocks and the level select pick it up automatically.

```ts
section('My Section', 250, { seed: 61, checkpoint: true, speed: 14 }, (b) => {
  b.hint(4, 'NEW IDEA', 'Explained here');
  b.gate(30);                          // glass blocking the path
  b.slalom(50, 6, 10, 2.4);            // procedural crystal slalom (seeded)
  b.cluster(120, 0, 3);                // Nova core surrounded by glass
  b.shielded(170, 0, 3.2, 3, 1.2);     // crystal behind orbiting shields
  b.explosiveWall(220, 5, 3);          // set piece
});
```

### Main systems

- **Destruction:** a hit writes the impact point into the glass shader, which draws radial cracks. About 60 ms later the object breaks into instanced shards. Shards are smaller near the impact point and bigger further away. Each one spins, bounces off the floor and shrinks away.
- **Collision:** swept sphere-vs-sphere and sphere-vs-box tests in each box's local frame, run in sub-steps, so fast shots never pass through thin glass.
- **Level system:** sections of relative spawn and script events are flattened into one timeline and streamed in ahead of the player. Seeded patterns give procedural variety that plays the same every time.
- **Audio:** every sound is synthesised with the Web Audio API, including the glass tinkles, the crystal chimes that climb in pitch with your combo, the boss roar and all six music tracks. There are no audio files.
- **Music:** a look-ahead scheduler runs each track's pad, bass, drums, arpeggio and lead layers. Layers fade in as intensity rises through a level. Big events trigger filter sweeps and bass hits.

## Performance notes

- **Pooling everywhere:** targets, projectiles, fragments, particles, rings, flares and lights are all reused. Nothing is allocated per frame in the hot paths.
- **Draw calls:** each environment chunk is pre-merged by material (about 5 to 10 draw calls). All debris is instanced (about 13 draw calls). All particles are a single draw call.
- **Fixed light count:** unused flash lights sit at zero intensity, so shaders never recompile in the middle of a level. All materials are also compiled during loading.
- **Quality profiles (LOW / MEDIUM / HIGH / ULTRA):** these control pixel ratio, MSAA, bloom resolution, particle and fragment caps, dust density and post effects. A sensible default is picked from the GPU. With **AUTO** on, the game steps quality down if the frame rate stays under about 42 fps.
- **Motion effects toggle:** reduces camera shake, bob, FOV changes and screen-space motion effects.
- The game pauses automatically when the window loses focus.

## Robustness

- A WebGL check at boot shows a clear message if WebGL isn't available.
- If post-processing fails, the game falls back to direct rendering.
- If audio can't start, the game runs silently rather than breaking.
- A lost GPU context pauses the game.
- Global error handlers log problems and show a small notice, and the main loop recovers from per-frame errors.

## QA / automated testing

The game includes a play-testing bot:

```
http://localhost:5173/?autoplay                 # bot plays from sector 1
http://localhost:5173/?autoplay&level=4&fast=3  # jump to sector 5, run the simulation 3x faster
http://localhost:5173/?quality=low              # force a quality profile
```

In the browser console, `window.__shard` exposes `game`, `autoplay()`, `fast(n)` and `level(i)`. During development, every sector was played through end to end by the bot at human-like accuracy (around 50–70%), and the boss was beaten, with no runtime errors.

## Credits

Design, code, visual effects, audio and music: created with Claude Code.
Built with [three.js](https://threejs.org), the Web Audio API, TypeScript and Vite.
All geometry, textures, sound and music are generated procedurally at runtime. No third-party assets are used.
