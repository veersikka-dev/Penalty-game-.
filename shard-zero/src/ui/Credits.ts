import { button, el } from './dom';
import { LOGO_HTML, type MenuActions } from './MenuActions';
import type { Screen } from './UIManager';

export class Credits implements Screen {
  el = el('div', 'dim');
  constructor(a: MenuActions) {
    const panel = el('div', 'panel');
    panel.style.textAlign = 'center';
    const logo = el('div', 'logo', LOGO_HTML);
    logo.style.fontSize = '34px';
    panel.append(
      logo,
      el('div', 'credits', `
        <h3>DESIGN · CODE · ART · AUDIO</h3>Created with Claude Code
        <h3>TECHNOLOGY</h3>Three.js · WebGL · Web Audio API · TypeScript · Vite
        <h3>MUSIC & SOUND</h3>Every note and shatter is synthesised live in your browser
        <h3>THANK YOU</h3>for playing`),
    );
    const row = el('div', 'row-btns');
    row.style.justifyContent = 'center';
    row.appendChild(button('Back', 'small', () => a.showScreen('menu')));
    panel.appendChild(row);
    this.el.appendChild(panel);
  }
}
