/**
 * Mouse/keyboard input with pointer lock. If pointer lock is unavailable or refused,
 * the game falls back to "cursor aim" mode where the crosshair follows the cursor.
 */
export class Input {
  locked = false;
  /** Cursor position in normalised device coordinates (-1..1). */
  cursorX = 0;
  cursorY = 0;
  dx = 0;
  dy = 0;
  firePressed = false;
  mouseDown = false;
  private pressed = new Set<string>();
  onLockChange: ((locked: boolean) => void) | null = null;
  enabled = true;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        // Guard against the huge spikes some browsers emit on lock
        if (Math.abs(e.movementX) < 400 && Math.abs(e.movementY) < 400) {
          this.dx += e.movementX;
          this.dy += e.movementY;
        }
      } else {
        this.cursorX = (e.clientX / window.innerWidth) * 2 - 1;
        this.cursorY = -((e.clientY / window.innerHeight) * 2 - 1);
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.enabled) return;
      this.mouseDown = true;
      this.firePressed = true;
      if (!this.locked) {
        this.cursorX = (e.clientX / window.innerWidth) * 2 - 1;
        this.cursorY = -((e.clientY / window.innerHeight) * 2 - 1);
      }
    });
    window.addEventListener('mouseup', () => (this.mouseDown = false));
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.pressed.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      this.locked = false;
    });
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => undefined);
    } catch {
      /* fallback to cursor aim */
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  wasPressed(code: string) {
    return this.pressed.has(code);
  }

  /** Clears per-frame edge state. Call once at the end of every frame. */
  endFrame() {
    this.dx = 0;
    this.dy = 0;
    this.firePressed = false;
    this.pressed.clear();
  }
}
