import type { AudioManager } from '../audio/AudioManager';

export interface Screen {
  el: HTMLElement;
  onShow?(data?: unknown): void;
  onHide?(): void;
}

/** Owns every full-screen menu; shows one at a time with a cross-fade and plays UI sounds. */
export class UIManager {
  readonly root: HTMLElement;
  private screens = new Map<string, Screen>();
  current: string | null = null;

  constructor(private audio: AudioManager) {
    this.root = document.getElementById('ui')!;
    let lastHover: Element | null = null;
    this.root.addEventListener('mouseover', (e) => {
      const b = (e.target as HTMLElement).closest('button, .level-card:not(.locked)');
      if (b && b !== lastHover) this.audio.uiHover();
      lastHover = b;
    });
    this.root.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button, .level-card:not(.locked)')) this.audio.uiClick();
    }, true);
  }

  register(name: string, screen: Screen) {
    screen.el.classList.add('screen');
    this.root.appendChild(screen.el);
    this.screens.set(name, screen);
  }

  show(name: string, data?: unknown) {
    if (this.current && this.current !== name) this.hideCurrent();
    const s = this.screens.get(name);
    if (!s) return;
    this.current = name;
    s.onShow?.(data);
    requestAnimationFrame(() => s.el.classList.add('visible'));
  }

  hideCurrent() {
    if (!this.current) return;
    const s = this.screens.get(this.current);
    s?.el.classList.remove('visible');
    s?.onHide?.();
    this.current = null;
  }

  get(name: string) {
    return this.screens.get(name);
  }
}
