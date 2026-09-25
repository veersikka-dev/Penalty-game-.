import { button, el } from './dom';
import { LOGO_HTML, type MenuActions } from './MenuActions';
import type { Screen } from './UIManager';

export class Ending implements Screen {
  el = el('div', 'dim');
  constructor(a: MenuActions) {
    const wrap = el('div');
    wrap.style.textAlign = 'center';
    wrap.style.maxWidth = '640px';
    const logo = el('div', 'logo', LOGO_HTML);
    logo.style.fontSize = 'clamp(36px, 6vw, 70px)';
    wrap.append(
      logo,
      el('div', 'tagline', 'the silence is broken'),
      el('div', 'credits', `<p style="margin-top:34px">The Heart has shattered. Light spills through the hollow core, and for the first time, the machine is quiet.</p><p>Every sector remains open. Chase higher scores, cleaner combos, perfect accuracy.</p>`),
    );
    const row = el('div', 'row-btns');
    row.style.justifyContent = 'center';
    row.append(button('Main menu', 'primary', () => a.toMenu()), button('Credits', '', () => a.showScreen('credits')));
    wrap.appendChild(row);
    this.el.appendChild(wrap);
  }
}
