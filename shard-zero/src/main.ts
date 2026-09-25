import './styles/main.css';
import { Game } from './core/Game';
import { LoadingScreen } from './ui/LoadingScreen';
import { detectWebGL, installGlobalErrorHandlers, setErrorToast } from './core/ErrorHandler';
import { settings, type Quality } from './core/Settings';

installGlobalErrorHandlers();

const params = new URLSearchParams(location.search);
const uiRoot = document.getElementById('ui')!;
const fade = document.getElementById('fade')!;
const loading = new LoadingScreen(['Initializing renderer', 'Loading environment', 'Loading audio', 'Loading visual effects', 'Preparing sectors']);
loading.el.classList.add('screen', 'visible');
uiRoot.appendChild(loading.el);
fade.style.opacity = '0';

async function boot() {
  const gl = detectWebGL();
  if (!gl.ok) {
    loading.fail('WebGL is not available in this browser. Try an up-to-date Chrome, Edge, Firefox or Safari with hardware acceleration enabled.');
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
  (window as unknown as { __shard: unknown }).__shard = {
    game,
    autoplay: (on = true) => (game.autopilot.enabled = on),
    fast: (n = 4) => (game.simSteps = n),
    level: (i: number) => game.startLevel(i),
  };
  try {
    await game.init(document.getElementById('app')!, loading);
  } catch (err) {
    console.error('[SHARD//ZERO] Failed to start', err);
    loading.fail(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  game.settingsChanged();

  const enter = () => {
    loading.el.classList.remove('visible');
    setTimeout(() => loading.el.remove(), 700);
    game.enter();
    const lv = params.get('level');
    if (params.has('autoplay')) {
      game.autopilot.enabled = true;
      game.simSteps = Math.max(1, parseInt(params.get('fast') ?? '1', 10) || 1);
      setTimeout(() => game.startLevel(lv ? parseInt(lv, 10) : 0), 300);
    } else if (lv) setTimeout(() => game.startLevel(parseInt(lv, 10)), 300);
  };
  if (params.has('autoplay')) enter();
  else loading.complete(enter);
}

boot();
