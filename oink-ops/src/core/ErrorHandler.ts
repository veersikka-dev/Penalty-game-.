/** Central error handling: nothing should crash the game silently. */
let toastFn: ((msg: string) => void) | null = null;
let lastToast = 0;

export function setErrorToast(fn: (msg: string) => void) {
  toastFn = fn;
}

export function reportError(context: string, err: unknown) {
  console.error(`[OINK OPS] ${context}:`, err);
  const now = performance.now();
  if (toastFn && now - lastToast > 5000) {
    lastToast = now;
    toastFn('A glitch occurred — recovered automatically.');
  }
}

export function installGlobalErrorHandlers() {
  window.addEventListener('error', (e) => reportError('Uncaught error', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportError('Unhandled promise rejection', e.reason));
}

/** Runs an optional feature; if it throws, logs and returns the fallback so the core game continues. */
export function safely<T>(label: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    console.warn(`[OINK OPS] Optional feature "${label}" unavailable, continuing without it.`, err);
    return fallback;
  }
}

export function detectWebGL(): { ok: boolean; webgl2: boolean } {
  try {
    const c = document.createElement('canvas');
    const gl2 = c.getContext('webgl2');
    if (gl2) return { ok: true, webgl2: true };
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    return { ok: !!gl, webgl2: false };
  } catch {
    return { ok: false, webgl2: false };
  }
}
