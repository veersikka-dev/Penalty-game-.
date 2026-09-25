# OINK OPS

*A small pig with a big blaster.*

OINK OPS is a cartoon third-person action shooter that runs in the browser. It stars **Trotter**, a cute pig who is also a serious little warrior. You blast your way through five hand-built worlds of silly robots:

- Robo Chickens
- Toast Bots
- Angry Carrots
- Bubble Bots
- the Big Bad Boar

Along the way you smash nearly everything, set off chain reactions, collect secrets, and finally take down **the Giant Bacon Machine**.

Every model, texture, animation, sound effect and song is generated procedurally at runtime. The game has no asset files.

---

## Quick start

Requires **Node.js 18+**.

```bash
cd oink-ops
npm install
npm run dev        # opens the game in your browser
```

Production build:

```bash
npm run build      # type-checks, then writes a static site to dist/
npm run preview    # serves dist/ locally
```

## Controls

| Input | Action |
|---|---|
| **W A S D** | Move |
| **Mouse** | Look / aim (click once to capture the mouse) |
| **Left click** | Shoot |
| **Right click** (hold) | Aim over the shoulder |
| **Space** | Jump |
| **Shift** | Sprint |
| **Q** | Dodge roll (brief invulnerability) |
| **C** / **Ctrl** | Crouch |
| **R** | Reload |
| **1 – 5** / **mouse wheel** | Switch weapon |
| **Esc** / **P** | Pause |
| **F** | Fullscreen |

## The game

- **Five worlds**, each with its own look, music, enemies and objectives:
  1. **Piggy Village:** the tutorial and a village defence, a generator puzzle, a windmill climb, and the Big Bad Boar.
  2. **Candy Factory:** a chocolate river crossed on moving platforms, factory-floor waves, sugar pumps to shut down, and the Sugar Rush.
  3. **The Jungle:** a rope bridge, a waterfall, climbable ruins, cursed idols to smash, and a temple guardian.
  4. **Robot City:** neon avenues, holograms, flying cars, relay sabotage, and Tower Square.
  5. **Pig Boss Fortress:** a lava moat and a courtyard siege, then the multi-phase **Giant Bacon Machine** on a collapsing arena.
- **Weapons:** you start with the **Bacon Blaster**. You earn the others by clearing worlds: the **Carrot Cannon** (explosive carrots), the **Egg Launcher** (bouncing eggs), the **Bubble Blaster** (traps enemies) and the **Piggy Pulse** (shockwave).
- **Power-ups:**
  - Golden Pig: temporary invincibility
  - Turbo Snout: a big speed boost
  - Bacon Rage: rapid fire
  - Piggy Shield: a protective bubble
  - Giant Pig: bigger size and double damage
- **Destruction:** crates, barrels, TNT, glass, crystals, signs, fences, hay, pumpkins, candy machines, vending machines, generators and cracked walls all break. Barrels and TNT set off chain reactions that knock enemies back and shower you with coins.
- **Combos:** quick kills and destruction chains raise your multiplier. Weak-point hits score **CRITICAL** bonuses, and you earn bonuses for stretches without taking damage.
- **Collectibles:** coins, 10 bacon tokens, 3 golden carrots and 1 secret star per world. Stars are hidden behind cracked walls.
- **Upgrades and customisation:** spend coins on permanent upgrades (health, damage, magazine size, reload speed, coin magnet) and on cosmetics: hats, glasses, backpacks, armour colours, body colours and blaster skins. There are also outfit presets: Cowboy, Astronaut, Ninja, Chef and Space Pig.
- **Saving:** progress, coins, unlocks, cosmetics, upgrades, high scores and settings are saved in `localStorage`. The loader validates every field, so a corrupted save can't crash the game.

## Architecture

```
src/
  main.ts                    Boot, WebGL check, loading screen, debug/QA hooks
  core/
    Game.ts                  Orchestrator: state machine, main loop, game rules, menu actions
    Session.ts               Score, combos, bonuses, per-run stats
    Settings.ts              Settings, quality profiles, validated save data
    Input.ts                 Keyboard/mouse, pointer lock with fallback
    Autopilot.ts             QA bot used for automated play-testing
    ErrorHandler.ts          Global error capture, WebGL detection
  render/
    Toon.ts                  Toon materials, stepped gradient, inverted-hull ink outlines
    Sky.ts                   Gradient sky dome, puffy clouds, mountain ring
  physics/Collision.ts       Walkable boxes, ramps, pits, moving platforms, push-out, raycasts
  player/
    PigModel.ts              Trotter's procedural rig (+ analytic two-bone IK)
    PigAnimator.ts           Procedural animation state blending, expressions, emotes, idle fidgets
    PlayerController.ts      Movement, jump (coyote time + buffer), dodge, crouch, health, power-ups
    ThirdPersonCamera.ts     Over-the-shoulder camera: lag, aim zoom, collision, shake, cinematics
  weapons/                   Weapon data, cartoon weapon models, inventory/ammo/reload/firing
  combat/                    Aiming + aim assist, hitscan, projectiles, explosions, shockwaves
  enemies/                   Enemy data, models, AI state machine, manager
  world/
    LevelBuilder.ts          Level construction: merged static scenery, colliders, gameplay data
    Props.ts                 Scenery library for all five themes
    Destructibles.ts         Breakable props, their models and colliders
    Pickups.ts               Coins (instanced, magnetised) and special pickups
    LevelDirector.ts         Objective chains, multi-wave encounters, gates, checkpoints
    BaconBoss.ts             The Giant Bacon Machine (phases, attacks, collapsing arena, finale)
    Themes.ts                Per-world sky, fog, light, palette, music and bloom
  destruction/               Instanced debris, particles, fracture geometry
  effects/                   Post-processing, screen effects, VFX toolkit, cartoon puffs, ambient motes
  audio/                     Procedural SFX, live music sequencer, per-world music themes
  materials/GlassMaterial.ts Cracking glass shader
  ui/                        HUD, menus, UI manager
  data/                      Worlds (level scripts), cosmetics, upgrades
```

### Main systems

- **Animation:** Trotter's pose is rebuilt every frame from smoothed blend weights, so transitions never snap:
  - idle → walk → run → sprint, with a piggy waddle
  - aim → shoot → recoil
  - jump → fall → land, with squash and stretch
  - hit → recover, plus dodge roll, crouch, celebrate, victory dance and death

  Both arms use two-bone IK so his hands always grip the weapon. His face has blinking eyelids, eyebrows and mouth shapes for expressions, and he shows emote bubbles (? ! ♥ ★). When idle he scratches his ear, inspects his weapon, looks around, yawns and sniffs.
- **Aiming:** a ray from the camera finds the point under the crosshair, and shots travel from the actual muzzle to that point. A gentle aim-assist cone, target highlighting, hit markers, critical hits on weak points and a target info panel make shots feel connected.
- **Enemy AI:** every enemy runs a finite-state machine with these states: IDLE, PATROL, DETECT, CHASE, ATTACK, SEARCH, RETREAT, STUNNED and DEAD. Line of sight is checked on a timer rather than every frame, movement steers around obstacles with feeler rays, stuck enemies recover, and they keep their distance from each other. Each type has its own attacks:
  - Chickens wind up and dash.
  - Carrots swarm and lunge.
  - Toast Bots strafe, lob toast and take cover.
  - Bubble Bots shield their allies.
  - The Boar charges (and gets stunned if it hits a wall), slams the ground, and has armour you shoot off to expose its battery.
- **Levels:** static scenery is merged by region and material into a small number of draw calls that can be frustum-culled, with ink outlines. Gameplay is described by objectives, encounters, gates and waypoints, so the objective marker always leads somewhere reachable.

## Performance notes

- **Pooling:** debris, particles, puffs, tracers, projectiles, rings, flares and lights are all pooled.
- **Instancing:** coins, debris and cartoon smoke puffs are instanced.
- **Static scenery** is merged per region and material.
- **Fixed light count:** the number of lights never changes during play, and shaders are precompiled while the game loads.
- **Quality profiles (LOW / MEDIUM / HIGH / ULTRA):** these control pixel ratio, shadow-map size (or shadows off), MSAA, bloom, and particle/debris caps. With **AUTO** on, quality steps down if the frame rate stays under about 42 fps.

## QA / automated testing

```
http://localhost:5173/?autoplay&god&world=0&fast=2   # bot plays world 1 (god mode, 2× simulation)
http://localhost:5173/?skip&world=3                  # jump straight into world 4
http://localhost:5173/?quality=low
```

In the browser console, `window.__oink` exposes `game`, `bot()`, `god()`, `fast(n)`, `world(i)`, `tp(x, z)` and `killAll()`. During development the bot played every world through to its results screen, including the full boss fight, with no runtime errors.

## Credits

Design, code, art, animation, audio and music: created with Claude Code.
Built with [three.js](https://threejs.org), the Web Audio API, TypeScript and Vite. No third-party assets are used.
