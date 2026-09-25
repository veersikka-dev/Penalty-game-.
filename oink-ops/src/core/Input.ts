/**
 * Keyboard + mouse with pointer lock. Tracks held keys, per-frame key presses,
 * both mouse buttons, wheel and mouse deltas. If pointer lock is refused the
 * game still works: the camera turns with raw cursor movement while a button is held.
 */
export class Input {
  locked = false;
  dx = 0;
  dy = 0;
  wheel = 0;
  left = false;
  right = false;
  leftPressed = false;
  rightPressed = false;
  enabled = true;
  private held = new Set<string>();
  private pressed = new Set<string>();
  onLockChange: ((locked: boolean) => void) | null = null;
  private lastX = -1;
  private lastY = -1;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        if (Math.abs(e.movementX) < 300 && Math.abs(e.movementY) < 300) {
          this.dx += e.movementX;
          this.dy += e.movementY;
        }
      } else if (this.left || this.right) {
        if (this.lastX >= 0) {
          this.dx += e.clientX - this.lastX;
          this.dy += e.clientY - this.lastY;
        }
      }
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) {
        this.left = true;
        this.leftPressed = true;
      } else if (e.button === 2) {
        this.right = true;
        this.rightPressed = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.left = false;
      else if (e.button === 2) this.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => (this.wheel += Math.sign(e.deltaY)), { passive: true });
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.held.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => {
      this.held.clear();
      this.left = this.right = false;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.onLockChange?.(this.locked);
    });
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => undefined);
    } catch {
      /* cursor fallback */
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  down(code: string) {
    return this.enabled && this.held.has(code);
  }
  wasPressed(code: string) {
    return this.pressed.has(code);
  }

  /** Movement axes from WASD / arrows: x = strafe right, y = forward. */
  axes() {
    let x = 0;
    let y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  }

  endFrame() {
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
    this.leftPressed = false;
    this.rightPressed = false;
    this.pressed.clear();
  }
}
