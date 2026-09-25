import { button, el, fmt, formatTime } from './dom';
import type { MenuActions } from './MenuActions';
import type { Screen } from './UIManager';

export interface LevelResult {
  levelIndex: number;
  levelName: string;
  score: number;
  accuracy: number;
  destroyed: number;
  bestCombo: number;
  time: number;
  ammoEfficiency: number;
  newBest: boolean;
  isFinal: boolean;
}

export class LevelComplete implements Screen {
  el = el('div', 'dim');
  private panel = el('div', 'panel');

  constructor(private a: MenuActions) {
    this.el.appendChild(this.panel);
  }

  onShow(data?: unknown) {
    const r = data as LevelResult;
    this.panel.innerHTML = '';
    const title = el('div', 'screen-title', r.isFinal ? 'THE CORE IS SILENT' : 'SECTOR CLEARED');
    const sub = el('div', 'screen-sub', `${String(r.levelIndex + 1).padStart(2, '0')} · ${r.levelName}`);
    const score = el('div', 'big-score', '0');
    if (r.newBest) score.insertAdjacentHTML('beforeend', '');
    const scoreRow = el('div');
    scoreRow.append(score);
    const grid = el('div', 'stats-grid');
    const stats: [string, string][] = [
      ['Accuracy', `${Math.round(r.accuracy * 100)}%`],
      ['Destroyed', String(r.destroyed)],
      ['Best combo', String(r.bestCombo)],
      ['Time', formatTime(r.time)],
      ['Shard efficiency', `${Math.round(r.ammoEfficiency * 100)}%`],
    ];
    const statEls = stats.map(([k, v]) => {
      const s = el('div', 'stat', `<span>${k}</span><b>${v}</b>`);
      grid.appendChild(s);
      return s;
    });
    const row = el('div', 'row-btns');
    row.append(
      button(r.isFinal ? 'Continue' : 'Next sector', 'primary', () => (r.isFinal ? this.a.showScreen('ending') : this.a.nextLevel())),
      button('Replay', '', () => this.a.restartLevel()),
      button('Menu', '', () => this.a.toMenu()),
    );
    this.panel.append(title, sub, scoreRow, grid, row);

    // Count-up animation for the score, then reveal stats one by one
    const start = performance.now();
    const dur = 1200;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      score.textContent = fmt(r.score * e);
      if (k < 1) requestAnimationFrame(tick);
      else if (r.newBest) score.insertAdjacentHTML('beforeend', '<span class="badge">NEW HIGH SCORE</span>');
    };
    requestAnimationFrame(tick);
    statEls.forEach((s, i) => setTimeout(() => s.classList.add('in'), 500 + i * 140));
  }
}
