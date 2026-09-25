import './styles/main.css';
import { Game } from './core/Game';
import { LoadingScreen } from './ui/Menus';
import { detectWebGL, installGlobalErrorHandlers, setErrorToast } from './core/ErrorHandler';
import { settings, type Quality } from './core/Settings';
import * as THREE from 'three';

installGlobalErrorHandlers();

const params = new URLSearchParams(location.search);
const uiRoot = document.getElementById('ui')!;
const fade = document.getElementById('fade')!;
const loading = new LoadingScreen();
loading.el.classList.add('screen', 'visible');
uiRoot.appendChild(loading.el);
fade.style.opacity = '0';

async function boot() {
  const gl = detectWebGL();
  if (!gl.ok) {
    loading.fail('WebGL is not available. Try an up-to-date Chrome, Edge, Firefox or Safari with hardware acceleration enabled.');
    return;
  }
  const q = params.get('quality') as Quality | null;
  if (q && ['low', 'medium', 'high', 'ultra'].includes(q)) {
    settings.quality = q;
    settings.autoQuality = false;
  }
  const game = new Game();
  setErrorToast((m) => game.toast(m));
  // Debug / QA handle
  (window as unknown as { __oink: unknown }).__oink = {
    game,
    THREE,
    bot: (on = true) => (game.autopilot.enabled = on),
    god: (on = true) => (game.player.godMode = on),
    fast: (n = 3) => (game.simSteps = n),
    world: (i: number) => game.startWorld(i),
    tp: (x: number, z: number) => {
      game.player.pos.set(x, game.world.groundAt(x, z, 50).y, z);
      game.player.vel.set(0, 0, 0);
    },
    killAll: () => {
      for (const e of game.enemies.list) if (e.alive) e.takeDamage({ amount: 99999, point: e.pos.clone(), dir: new THREE.Vector3(0, 0, 1), knockback: 0, weak: false, source: 'player' });
    },
  };
  try {
    await game.init(document.getElementById('app')!, loading);
  } catch (err) {
    console.error('[OINK OPS] Failed to start', err);
    loading.fail(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  game.settingsChanged();
  const enter = () => {
    loading.el.classList.remove('visible');
    setTimeout(() => loading.el.remove(), 600);
    game.enter();
    const w = params.get('world');
    if (params.has('autoplay')) {
      game.autopilot.enabled = true;
      game.player.godMode = params.has('god');
      game.simSteps = Math.max(1, parseInt(params.get('fast') ?? '1', 10) || 1);
      setTimeout(() => game.startWorld(w ? parseInt(w, 10) : 0), 200);
    } else if (w) setTimeout(() => game.startWorld(parseInt(w, 10)), 200);
  };
  if (params.has('autoplay') || params.has('skip')) enter();
  else loading.complete(enter);
}

boot();
