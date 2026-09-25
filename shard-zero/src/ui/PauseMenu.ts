import { button, el } from './dom';
import type { MenuActions } from './MenuActions';
import type { Screen } from './UIManager';

export class PauseMenu implements Screen {
  el = el('div', 'dim');
  private sub = el('div', 'screen-sub');

  constructor(a: MenuActions) {
    const panel = el('div', 'panel');
    panel.style.maxWidth = '420px';
    const list = el('div', 'menu-list');
    list.style.marginTop = '10px';
    list.append(
      button('Resume', 'primary', () => a.resume()),
      button('Restart checkpoint', '', () => a.retryCheckpoint()),
      button('Restart level', '', () => a.restartLevel()),
      button('Settings', '', () => a.openSettings('pause')),
      button('Main menu', '', () => a.toMenu()),
    );
    panel.append(el('div', 'screen-title', 'PAUSED'), this.sub, list);
    this.el.appendChild(panel);
  }

  onShow(data?: unknown) {
    this.sub.textContent = typeof data === 'string' ? data : 'Press Esc or Resume to continue';
  }
}
