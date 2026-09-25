import { el } from './dom';
import { LOGO_HTML } from './MenuActions';
import type { Screen } from './UIManager';

/** Shows real initialisation steps with a progress bar, then asks for a click (needed to start audio). */
export class LoadingScreen implements Screen {
  el = el('div', 'loading');
  private steps: HTMLElement[] = [];
  private bar = el('i');
  private enter = el('div', 'enter btn primary', 'CLICK TO ENTER');
  private note = el('div', 'hint-line', 'Best with headphones');

  constructor(labels: string[]) {
    this.el.append(el('div', 'logo', LOGO_HTML), el('div', 'tagline', 'break the silence'));
    const list = el('div', 'load-steps');
    for (const l of labels) {
      const d = el('div', '', `<span>${l}</span>`);
      this.steps.push(d);
      list.appendChild(d);
    }
    const barWrap = el('div', 'load-bar');
    barWrap.appendChild(this.bar);
    this.el.append(list, barWrap, this.enter, this.note);
    this.note.style.opacity = '0';
  }

  setStep(i: number, fraction: number) {
    this.steps.forEach((s, k) => {
      s.classList.toggle('done', k < i);
      s.classList.toggle('active', k === i);
    });
    this.bar.style.width = `${Math.round(fraction * 100)}%`;
  }

  complete(onEnter: () => void) {
    this.setStep(this.steps.length, 1);
    this.enter.classList.add('show');
    this.note.style.opacity = '1';
    this.enter.style.pointerEvents = 'auto';
    const go = () => {
      window.removeEventListener('keydown', key);
      this.el.removeEventListener('click', go);
      onEnter();
    };
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') go();
    };
    this.el.addEventListener('click', go);
    window.addEventListener('keydown', key);
  }

  fail(message: string) {
    this.enter.classList.remove('show');
    this.note.style.opacity = '1';
    this.note.textContent = message;
    this.note.style.color = '#ff8aa0';
  }
}
