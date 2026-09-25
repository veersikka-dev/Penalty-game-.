import { button, el, fmt } from './dom';
import type { MenuActions } from './MenuActions';
import type { Screen } from './UIManager';

export class GameOver implements Screen {
  el = el('div', 'dim');
  private score = el('div', 'big-score');
  private sub = el('div', 'screen-sub');

  constructor(a: MenuActions) {
    const panel = el('div', 'panel');
    panel.style.maxWidth = '480px';
    const title = el('div', 'screen-title', 'SHARDS DEPLETED');
    title.style.color = '#ff8aa0';
    const list = el('div', 'menu-list');
    list.style.marginTop = '8px';
    list.append(
      button('Retry from checkpoint', 'primary', () => a.retryCheckpoint()),
      button('Restart level', '', () => a.restartLevel()),
      button('Main menu', '', () => a.toMenu()),
    );
    panel.append(title, this.sub, this.score, list);
    this.el.appendChild(panel);
  }

  onShow(data?: unknown) {
    const d = data as { score: number; section: string };
    this.score.textContent = fmt(d.score);
    this.sub.textContent = `Lost in ${d.section}`;
  }
}
