import { button, el, fmt, formatTime, ICONS } from './dom';
import type { Screen } from './UIManager';
import { save, settings, saveSettings, worldRecord, QUALITY_ORDER, type Quality, persist } from '../core/Settings';
import { COSMETICS, COSMETIC_CATS, OUTFITS, isFree, type CosmeticCat, type Cosmetic } from '../data/cosmetics';
import { UPGRADES } from '../data/upgrades';
import { WEAPONS, type WeaponId } from '../weapons/WeaponDefs';
import type { WorldDef } from '../data/worlds/types';

export interface MenuActions {
  play(): void;
  startWorld(i: number): void;
  resume(): void;
  restart(): void;
  respawn(): void;
  toMenu(): void;
  nextWorld(): void;
  show(name: string): void;
  openSettings(from: string): void;
  closeSettings(): void;
  toggleFullscreen(): void;
  settingsChanged(): void;
  loadoutChanged(): void;
  upgradesChanged(): void;
  customizeView(on: boolean): void;
  resetSave(): void;
  worlds: WorldDef[];
}

export const LOGO = '<div class="logo"><span class="l1">OINK<span class="snout">!</span></span><span class="l2">OPS</span></div>';
const coinChip = (n: number) => `<span class="coin-chip"><span class="c"></span><span>${fmt(n)}</span></span>`;
const starChip = (n: number) => `<span class="coin-chip"><span class="s">★</span><span>${n}</span></span>`;
export const starsFound = () => save.found.filter((f) => f.endsWith('star')).length;

// ------------------------------------------------------------------ loading
export class LoadingScreen implements Screen {
  el = el('div', 'loading');
  private bar = el('i');
  private step = el('div', 'load-step', 'Waking up Trotter…');
  private enter = el('div', 'enter');
  constructor() {
    const logo = el('div', '', LOGO);
    const wrap = el('div', 'load-bar');
    wrap.appendChild(this.bar);
    this.el.append(logo, el('div', 'tagline', 'A small pig with a big blaster.'), wrap, this.step, this.enter);
  }
  setStep(label: string, f: number) {
    this.step.textContent = label;
    this.bar.style.width = `${Math.round(f * 100)}%`;
  }
  complete(onEnter: () => void) {
    this.setStep('Ready to oink!', 1);
    const b = button('▶  PRESS TO PLAY', 'big sun', () => onEnter());
    this.enter.appendChild(b);
    this.enter.classList.add('show');
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        window.removeEventListener('keydown', key);
        onEnter();
      }
    };
    window.addEventListener('keydown', key);
  }
  fail(msg: string) {
    this.step.textContent = msg;
    this.step.style.color = '#fff';
    this.step.style.maxWidth = '640px';
    this.step.style.textAlign = 'center';
  }
}

// ------------------------------------------------------------------ main menu
export class MainMenu implements Screen {
  el = el('div', 'menu-main');
  private foot = el('div', 'menu-foot');
  private play: HTMLButtonElement;
  constructor(a: MenuActions) {
    const list = el('div', 'menu-list pop-in');
    this.play = button('▶  PLAY', 'big sun', () => a.play());
    list.append(
      this.play,
      button('🗺  LEVELS', 'sky', () => a.show('worlds')),
      button('⬆  UPGRADES', 'mint', () => a.show('upgrades')),
      button('🎩  CUSTOMIZE', 'grape', () => a.show('customize')),
      button('⚙  SETTINGS', 'cream', () => a.openSettings('menu')),
    );
    const corner = el('div', 'corner');
    const fs = el('button', 'icon-btn', ICONS.fullscreen);
    fs.addEventListener('click', () => a.toggleFullscreen());
    corner.append(button('Credits', 'small cream', () => a.show('credits')), fs);
    const logo = el('div', 'pop-in', LOGO);
    logo.style.transitionDelay = '0.05s';
    this.el.append(logo, el('div', 'tagline pop-in', 'A small pig with a big blaster.'), list, this.foot, corner);
  }
  onShow() {
    const done = Object.values(save.worlds).filter((w) => w.completed).length;
    this.play.textContent = done === 0 ? '▶  PLAY' : '▶  CONTINUE';
    this.foot.innerHTML = `${coinChip(save.coins)} ${starChip(starsFound())}`;
  }
}

// ------------------------------------------------------------------ world select
export class WorldSelect implements Screen {
  el = el('div', 'dim');
  private grid = el('div', 'worlds');
  constructor(private a: MenuActions) {
    const title = el('div', 'panel-title pop-in', 'CHOOSE A WORLD');
    title.style.margin = '0';
    this.el.append(title, this.grid, el('div', 'row'));
    (this.el.lastChild as HTMLElement).appendChild(button('◀  BACK', 'cream', () => a.show('menu')));
  }
  onShow() {
    this.grid.innerHTML = '';
    this.a.worlds.forEach((w, i) => {
      const rec = worldRecord(i);
      const locked = i > save.unlocked;
      const tokens = save.found.filter((f) => f.startsWith(`w${i + 1}t`)).length;
      const carrots = save.found.filter((f) => f.startsWith(`w${i + 1}c`)).length;
      const star = save.found.includes(`w${i + 1}star`);
      const c = el('button', `world-card pop-in${locked ? ' locked' : ''}`);
      c.style.setProperty('--c', w.accent);
      c.innerHTML = `${locked ? '<div class="lock">LOCKED</div>' : ''}
        <div class="n">${i + 1}</div><div class="name">${w.name}</div><div class="sub">${w.subtitle}</div>
        <div class="stats">🥓 ${tokens}/10 &nbsp; 🥕 ${carrots}/3 &nbsp; ${star ? '★' : '☆'}<br/>${rec.completed ? `Best ${fmt(rec.bestScore)} · ${formatTime(rec.bestTime)}` : locked ? 'Clear the previous world' : 'Not cleared yet'}</div>`;
      if (!locked) c.addEventListener('click', () => this.a.startWorld(i));
      this.grid.appendChild(c);
    });
  }
}

// ------------------------------------------------------------------ upgrades
export class UpgradesScreen implements Screen {
  el = el('div', 'dim');
  private body = el('div', 'grid-cards');
  private coins = el('div', 'row');
  constructor(private a: MenuActions) {
    const p = el('div', 'panel pop-in');
    p.append(el('div', 'panel-title', 'UPGRADES'), el('div', 'panel-sub', 'Spend coins to make Trotter tougher. Upgrades are permanent!'), this.coins, this.body);
    const row = el('div', 'row');
    row.appendChild(button('◀  BACK', 'cream', () => a.show('menu')));
    p.appendChild(row);
    this.el.appendChild(p);
  }
  onShow() {
    this.coins.innerHTML = coinChip(save.coins);
    this.coins.style.marginTop = '0';
    this.coins.style.marginBottom = '14px';
    this.body.innerHTML = '';
    for (const u of UPGRADES) {
      const lvl = save.upgrades[u.id] ?? 0;
      const maxed = lvl >= u.costs.length;
      const cost = maxed ? 0 : u.costs[lvl];
      const card = el('div', 'card');
      card.innerHTML = `<div class="ico">${u.icon}</div><div class="t">${u.name}</div><div class="d">${u.desc}</div><div class="pips">${u.costs.map((_c, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>`;
      const b = button(maxed ? 'MAXED' : `BUY · ${cost}`, `small ${maxed ? 'cream' : 'sun'}`, () => {
        if (maxed || save.coins < cost) return;
        save.coins -= cost;
        save.upgrades[u.id] = lvl + 1;
        persist();
        this.a.upgradesChanged();
        this.onShow();
      });
      b.disabled = maxed || save.coins < cost;
      card.appendChild(b);
      this.body.appendChild(card);
    }
  }
}

// ------------------------------------------------------------------ customize
export class CustomizeScreen implements Screen {
  el = el('div', 'customize');
  private tabs = el('div', 'tabs');
  private body = el('div', 'grid-cards');
  private coins = el('div', 'row');
  private cat: CosmeticCat = 'hat';
  constructor(private a: MenuActions) {
    const p = el('div', 'panel pop-in');
    p.append(el('div', 'panel-title', 'CUSTOMIZE'), this.coins, this.tabs, this.body);
    const outfits = el('div', 'outfits');
    for (const o of OUTFITS) {
      outfits.appendChild(button(o.name, 'small grape', () => {
        const all = Object.values(o.loadout).every((id) => this.owned(COSMETICS.find((c) => c.id === id)!));
        if (!all) {
          this.flash('Unlock every piece of this outfit first!');
          return;
        }
        Object.assign(save.loadout, o.loadout);
        persist();
        this.a.loadoutChanged();
        this.render();
      }));
    }
    const row = el('div', 'row');
    row.appendChild(button('◀  BACK', 'cream', () => a.show('menu')));
    p.append(el('div', 'panel-sub', 'Outfits'), outfits, row);
    (p.children[p.children.length - 3] as HTMLElement).style.margin = '14px 0 0';
    this.el.appendChild(p);
  }
  private owned(c: Cosmetic) {
    return isFree(c) || save.owned.includes(c.id);
  }
  private flash(msg: string) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }
  onShow() {
    this.a.customizeView(true);
    this.render();
  }
  onHide() {
    this.a.customizeView(false);
  }
  private render() {
    this.coins.innerHTML = `${coinChip(save.coins)} ${starChip(starsFound())}`;
    this.coins.style.margin = '0 0 12px';
    this.tabs.innerHTML = '';
    for (const c of COSMETIC_CATS) {
      const t = el('button', `tab${c.id === this.cat ? ' on' : ''}`, c.name);
      t.addEventListener('click', () => {
        this.cat = c.id;
        this.render();
      });
      this.tabs.appendChild(t);
    }
    this.body.innerHTML = '';
    for (const c of COSMETICS.filter((k) => k.cat === this.cat)) {
      const owned = this.owned(c);
      const equipped = save.loadout[c.cat] === c.id;
      const needStars = (c.stars ?? 0) > starsFound();
      const b = el('button', `item${equipped ? ' equipped' : ''}${owned ? '' : ' locked'}`);
      b.innerHTML = `<div class="t">${c.name}</div>${c.color !== undefined ? `<div class="sw" style="background:#${c.color.toString(16).padStart(6, '0')}"></div>` : ''}<div class="p">${equipped ? '✔ Equipped' : owned ? 'Tap to wear' : needStars ? `★ ${c.stars} stars needed` : `🪙 ${c.price}${c.stars ? ` + ★${c.stars}` : ''}`}</div>`;
      b.addEventListener('click', () => {
        if (!owned) {
          if (needStars) return this.flash(`Find ${c.stars} secret stars to unlock this!`);
          if (save.coins < c.price) return this.flash('Not enough coins — go smash some robots!');
          save.coins -= c.price;
          save.owned.push(c.id);
        }
        save.loadout[c.cat] = c.id;
        persist();
        this.a.loadoutChanged();
        this.render();
      });
      this.body.appendChild(b);
    }
  }
}

// ------------------------------------------------------------------ settings
export class SettingsScreen implements Screen {
  el = el('div', 'dim');
  private body = el('div');
  constructor(private a: MenuActions) {
    const p = el('div', 'panel pop-in');
    p.style.maxWidth = '640px';
    p.append(el('div', 'panel-title', 'SETTINGS'), this.body);
    const row = el('div', 'row');
    row.append(button('◀  BACK', 'cream', () => a.closeSettings()), button('Reset save', 'small cream', () => {
      if (confirm('Erase all progress, coins and unlocks?')) a.resetSave();
    }));
    p.appendChild(row);
    this.el.appendChild(p);
  }
  private slider(label: string, get: () => number, set: (v: number) => void, min: number, max: number, step: number, show: (v: number) => string) {
    const r = el('div', 'setting');
    const v = el('div', 'val', show(get()));
    const i = el('input');
    Object.assign(i, { type: 'range', min: String(min), max: String(max), step: String(step), value: String(get()) });
    i.addEventListener('input', () => {
      set(parseFloat(i.value));
      v.textContent = show(get());
      saveSettings();
      this.a.settingsChanged();
    });
    r.append(el('span', '', label), i, v);
    return r;
  }
  private toggle(label: string, get: () => boolean, set: (v: boolean) => void) {
    const r = el('div', 'setting');
    const t = el('button', `toggle${get() ? ' on' : ''}`);
    t.addEventListener('click', () => {
      set(!get());
      t.classList.toggle('on', get());
      saveSettings();
      this.a.settingsChanged();
    });
    r.append(el('span', '', label), t, el('span'));
    return r;
  }
  onShow() {
    const pct = (v: number) => `${Math.round(v * 100)}`;
    this.body.innerHTML = '';
    this.body.append(
      this.slider('Master volume', () => settings.master, (v) => (settings.master = v), 0, 1, 0.01, pct),
      this.slider('Music', () => settings.music, (v) => (settings.music = v), 0, 1, 0.01, pct),
      this.slider('Sound effects', () => settings.sfx, (v) => (settings.sfx = v), 0, 1, 0.01, pct),
      this.slider('Mouse sensitivity', () => settings.sensitivity, (v) => (settings.sensitivity = v), 0.2, 3, 0.05, (v) => v.toFixed(2)),
    );
    const q = el('div', 'setting');
    const seg = el('div', 'seg');
    const render = () => {
      seg.innerHTML = '';
      for (const lv of QUALITY_ORDER) {
        const b = el('button', !settings.autoQuality && settings.quality === lv ? 'on' : '', lv.toUpperCase());
        b.addEventListener('click', () => {
          settings.quality = lv as Quality;
          settings.autoQuality = false;
          saveSettings();
          this.a.settingsChanged();
          render();
        });
        seg.appendChild(b);
      }
      const auto = el('button', settings.autoQuality ? 'on' : '', `AUTO${settings.autoQuality ? ` (${settings.quality.toUpperCase()})` : ''}`);
      auto.addEventListener('click', () => {
        settings.autoQuality = true;
        saveSettings();
        this.a.settingsChanged();
        render();
      });
      seg.appendChild(auto);
    };
    render();
    q.append(el('span', '', 'Graphics'), seg, el('span'));
    this.body.append(q, this.toggle('Motion effects', () => settings.motion, (v) => (settings.motion = v)), this.toggle('Invert mouse Y', () => settings.invertY, (v) => (settings.invertY = v)));
  }
}

// ------------------------------------------------------------------ pause
export class PauseScreen implements Screen {
  el = el('div', 'dim');
  private sub = el('div', 'panel-sub');
  constructor(a: MenuActions) {
    const p = el('div', 'panel pop-in');
    p.style.maxWidth = '420px';
    const list = el('div', 'menu-list');
    list.style.alignItems = 'stretch';
    list.style.marginTop = '6px';
    list.append(
      button('▶  RESUME', 'sun', () => a.resume()),
      button('⟲  LAST CHECKPOINT', 'sky', () => a.respawn()),
      button('↻  RESTART LEVEL', 'mint', () => a.restart()),
      button('⚙  SETTINGS', 'cream', () => a.openSettings('pause')),
      button('⌂  MAIN MENU', 'cream', () => a.toMenu()),
    );
    for (const b of list.children) (b as HTMLElement).style.minWidth = '0';
    p.append(el('div', 'panel-title', 'PAUSED'), this.sub, list);
    this.el.appendChild(p);
  }
  onShow(data?: unknown) {
    this.sub.textContent = typeof data === 'string' ? data : 'Take a breather, little pig.';
  }
}

// ------------------------------------------------------------------ results
export interface Results {
  world: number;
  name: string;
  score: number;
  time: number;
  kills: number;
  accuracy: number;
  bestCombo: number;
  coins: number;
  found: string[];
  newBest: boolean;
  reward: WeaponId | null;
  final: boolean;
}

export class ResultsScreen implements Screen {
  el = el('div', 'dim');
  private p = el('div', 'panel pop-in');
  constructor(private a: MenuActions) {
    this.el.appendChild(this.p);
  }
  onShow(data?: unknown) {
    const r = data as Results;
    this.p.innerHTML = '';
    const score = el('div', 'big-score', '0');
    const grid = el('div', 'stats-grid');
    const tokens = r.found.filter((f) => f.includes('t')).filter((f) => /w\dt/.test(f)).length;
    const carrots = r.found.filter((f) => /w\dc/.test(f)).length;
    const star = r.found.some((f) => f.endsWith('star'));
    const stats: [string, string][] = [
      ['Time', formatTime(r.time)],
      ['Robots bonked', String(r.kills)],
      ['Accuracy', `${Math.round(r.accuracy * 100)}%`],
      ['Best combo', `x${r.bestCombo}`],
      ['Coins', `🪙 ${r.coins}`],
      ['Secrets', `🥓${tokens} 🥕${carrots} ${star ? '★' : ''}`],
    ];
    const els = stats.map(([k, v]) => {
      const s = el('div', 'stat', `<span>${k}</span><b>${v}</b>`);
      grid.appendChild(s);
      return s;
    });
    this.p.append(el('div', 'panel-title', r.final ? 'VICTORY!' : 'LEVEL CLEAR!'), el('div', 'panel-sub', `World ${r.world + 1} · ${r.name}`), score, grid);
    if (r.reward) this.p.appendChild(el('div', 'reward', `<span class="badge">NEW WEAPON: ${WEAPONS[r.reward].name.toUpperCase()}!</span>`));
    const row = el('div', 'row');
    row.append(
      button(r.final ? '★  THE END' : '▶  NEXT WORLD', 'big sun', () => (r.final ? this.a.show('ending') : this.a.nextWorld())),
      button('↻  REPLAY', 'mint', () => this.a.restart()),
      button('⌂  MENU', 'cream', () => this.a.toMenu()),
    );
    this.p.appendChild(row);
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 1200);
      score.textContent = fmt(r.score * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
      else if (r.newBest) score.insertAdjacentHTML('beforeend', ' <span class="badge">NEW BEST!</span>');
    };
    requestAnimationFrame(tick);
    els.forEach((s, i) => setTimeout(() => s.classList.add('in'), 400 + i * 120));
  }
}

// ------------------------------------------------------------------ credits & ending
export class CreditsScreen implements Screen {
  el = el('div', 'dim');
  constructor(a: MenuActions) {
    const p = el('div', 'panel pop-in');
    p.style.maxWidth = '520px';
    p.append(el('div', 'panel-title', 'CREDITS'), el('div', 'credits', `
      <div style="transform:scale(.55);margin:-20px 0 -26px">${LOGO}</div>
      <h3>Starring</h3>Trotter the Warrior Pig
      <h3>Design · Code · Art · Audio</h3>Made with Claude Code
      <h3>Built with</h3>three.js · Web Audio · TypeScript · Vite
      <h3>Every model, texture, sound and song</h3>is generated live in your browser. No pigs were harmed.`));
    const row = el('div', 'row');
    row.appendChild(button('◀  BACK', 'cream', () => a.show('menu')));
    p.appendChild(row);
    this.el.appendChild(p);
  }
}

export class EndingScreen implements Screen {
  el = el('div', 'dim');
  constructor(a: MenuActions) {
    const p = el('div', 'panel pop-in');
    p.style.maxWidth = '600px';
    p.append(el('div', 'panel-title', 'THE END!'), el('div', 'credits', `
      <p>The Giant Bacon Machine lies in a sizzling heap. Piggy Village is safe, the candy flows again, and every robot chicken has been politely unplugged.</p>
      <p>Trotter adjusts his headband, blows the smoke off his Bacon Blaster… and goes looking for a snack.</p>
      <p><b>Every world stays open.</b> Chase high scores, find every 🥓, 🥕 and ★, and dress to impress.</p>`));
    const row = el('div', 'row');
    row.append(button('⌂  MAIN MENU', 'big sun', () => a.toMenu()), button('🎩  CUSTOMIZE', 'grape', () => a.show('customize')));
    p.appendChild(row);
    this.el.appendChild(p);
  }
}
