import { button, el, fmt, formatTime } from './dom';
import type { MenuActions } from './MenuActions';
import type { Screen } from './UIManager';
import { LEVELS } from '../data/levels';
import { levelRecord, progress } from '../core/Settings';

export class LevelSelect implements Screen {
  el = el('div', 'dim');
  private grid = el('div', 'levels');

  constructor(private a: MenuActions) {
    this.el.append(el('div', 'screen-title', 'SELECT SECTOR'), el('div', 'screen-sub', 'Clear a sector to unlock the next'), this.grid);
    const back = el('div', 'row-btns');
    back.appendChild(button('Back', 'small', () => a.showScreen('menu')));
    this.el.appendChild(back);
  }

  onShow() {
    this.grid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const rec = levelRecord(i);
      const locked = i > progress.unlocked;
      const card = el('button', `level-card${locked ? ' locked' : ''}`);
      card.style.setProperty('--c', lv.accent);
      card.innerHTML = `
        <div class="num">${String(i + 1).padStart(2, '0')}</div>
        ${locked ? '<div class="lock">LOCKED</div>' : rec.completed ? '<div class="done">CLEARED</div>' : ''}
        <div class="name">${lv.name}</div>
        <div class="sub">${lv.subtitle}</div>
        <div class="stats">${rec.completed ? `Best <b>${fmt(rec.bestScore)}</b><br/>Accuracy <b>${Math.round(rec.bestAccuracy * 100)}%</b> · Combo <b>${rec.bestCombo}</b><br/>Time <b>${formatTime(rec.bestTime)}</b>` : locked ? 'Clear the previous sector' : 'Not yet cleared'}</div>`;
      if (!locked) card.addEventListener('click', () => this.a.startLevel(i));
      this.grid.appendChild(card);
    });
  }
}
