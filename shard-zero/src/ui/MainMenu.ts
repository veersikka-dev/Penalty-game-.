import { button, el, fmt, ICONS } from './dom';
import { LOGO_HTML, type MenuActions } from './MenuActions';
import type { Screen } from './UIManager';
import { progress, levelRecord } from '../core/Settings';
import { LEVELS } from '../data/levels';

export class MainMenu implements Screen {
  el = el('div', 'menu-main soft');
  private foot = el('div', 'menu-foot');
  private playBtn: HTMLButtonElement;

  constructor(a: MenuActions) {
    const logo = el('div', 'logo', LOGO_HTML);
    const tag = el('div', 'tagline', 'break the silence');
    const list = el('div', 'menu-list');
    this.playBtn = button('Play', 'primary', () => a.play());
    list.append(
      this.playBtn,
      button('Levels', '', () => a.showScreen('levels')),
      button('Settings', '', () => a.openSettings('menu')),
      button('Credits', '', () => a.showScreen('credits')),
    );
    const corner = el('div', 'corner-btns');
    const fs = el('button', 'icon-btn', ICONS.fullscreen);
    fs.title = 'Fullscreen';
    fs.addEventListener('click', () => a.toggleFullscreen());
    corner.appendChild(fs);
    this.el.append(logo, tag, list, this.foot, corner);
  }

  onShow() {
    const total = LEVELS.reduce((s, _l, i) => s + levelRecord(i).bestScore, 0);
    const done = LEVELS.filter((_l, i) => levelRecord(i).completed).length;
    const next = Math.min(progress.unlocked, LEVELS.length - 1);
    this.playBtn.textContent = done === 0 ? 'Play' : done >= LEVELS.length ? 'Play again' : `Continue — ${LEVELS[next].name}`;
    this.foot.textContent = done ? `Sectors cleared ${done}/${LEVELS.length}  ·  Total best ${fmt(total)}` : 'Mouse to aim  ·  Click to fire  ·  Esc to pause';
  }
}
