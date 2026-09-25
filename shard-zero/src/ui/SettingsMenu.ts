import { button, el } from './dom';
import type { MenuActions } from './MenuActions';
import type { Screen } from './UIManager';
import { settings, saveSettings, type Quality, QUALITY_ORDER } from '../core/Settings';

export class SettingsMenu implements Screen {
  el = el('div', 'dim');
  private body = el('div');

  constructor(private a: MenuActions) {
    const panel = el('div', 'panel');
    panel.append(el('div', 'screen-title', 'SETTINGS'), el('div', 'screen-sub', 'Changes apply instantly'), this.body);
    const row = el('div', 'row-btns');
    row.append(button('Back', 'small', () => a.closeSettings()), button('Reset progress', 'small', () => {
      if (confirm('Erase all progress and high scores?')) a.resetProgress();
    }));
    panel.appendChild(row);
    this.el.appendChild(panel);
  }

  private slider(label: string, get: () => number, set: (v: number) => void, min: number, max: number, step: number, fmtV: (v: number) => string) {
    const row = el('div', 'setting');
    const val = el('div', 'val', fmtV(get()));
    const input = el('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(get());
    input.addEventListener('input', () => {
      set(parseFloat(input.value));
      val.textContent = fmtV(get());
      saveSettings();
      this.a.settingsChanged();
    });
    row.append(el('label', '', label), input, val);
    return row;
  }

  private toggle(label: string, get: () => boolean, set: (v: boolean) => void) {
    const row = el('div', 'setting');
    const t = el('button', `toggle${get() ? ' on' : ''}`);
    t.addEventListener('click', () => {
      set(!get());
      t.classList.toggle('on', get());
      saveSettings();
      this.a.settingsChanged();
    });
    row.append(el('label', '', label), t, el('div'));
    return row;
  }

  onShow() {
    const pct = (v: number) => `${Math.round(v * 100)}`;
    this.body.innerHTML = '';
    this.body.append(
      this.slider('Master volume', () => settings.master, (v) => (settings.master = v), 0, 1, 0.01, pct),
      this.slider('Music', () => settings.music, (v) => (settings.music = v), 0, 1, 0.01, pct),
      this.slider('Effects', () => settings.sfx, (v) => (settings.sfx = v), 0, 1, 0.01, pct),
      this.slider('Mouse sensitivity', () => settings.sensitivity, (v) => (settings.sensitivity = v), 0.2, 3, 0.05, (v) => v.toFixed(2)),
    );
    const q = el('div', 'setting');
    const seg = el('div', 'seg');
    const render = () => {
      seg.innerHTML = '';
      for (const level of QUALITY_ORDER) {
        const b = el('button', !settings.autoQuality && settings.quality === level ? 'on' : '', level.toUpperCase());
        b.addEventListener('click', () => {
          settings.quality = level as Quality;
          settings.autoQuality = false;
          saveSettings();
          this.a.settingsChanged();
          render();
        });
        seg.appendChild(b);
      }
      const auto = el('button', settings.autoQuality ? 'on' : '', `AUTO${settings.autoQuality ? ' · ' + settings.quality.toUpperCase() : ''}`);
      auto.addEventListener('click', () => {
        settings.autoQuality = true;
        saveSettings();
        this.a.settingsChanged();
        render();
      });
      seg.appendChild(auto);
    };
    render();
    q.append(el('label', '', 'Graphics'), seg, el('div'));
    this.body.append(q, this.toggle('Motion effects', () => settings.motion, (v) => (settings.motion = v)));
  }
}
