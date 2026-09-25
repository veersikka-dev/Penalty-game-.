import { el, fmt, ICONS } from './dom';
import type { PowerUpId } from '../combat/types';
import { WEAPON_ORDER, type WeaponId } from '../weapons/WeaponDefs';

const PIG_FACE = (mood: 'ok' | 'hurt' | 'low') => `
<svg viewBox="0 0 80 80">
  <path d="M14 22 L26 12 L24 30Z M66 22 L54 12 L56 30Z" fill="#f07c9a" stroke="#2b1d33" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="40" cy="44" r="28" fill="#ffa6bd" stroke="#2b1d33" stroke-width="3"/>
  <path d="M13 30 Q40 18 67 30" fill="none" stroke="#e8413c" stroke-width="6" stroke-linecap="round"/>
  ${mood === 'ok' ? '<circle cx="30" cy="40" r="5" fill="#2a1a3a"/><circle cx="50" cy="40" r="5" fill="#2a1a3a"/><circle cx="31.5" cy="38.5" r="1.6" fill="#fff"/><circle cx="51.5" cy="38.5" r="1.6" fill="#fff"/>'
      : mood === 'hurt' ? '<path d="M25 36 L35 42 M25 42 L35 36 M45 36 L55 42 M45 42 L55 36" stroke="#2a1a3a" stroke-width="3.5" stroke-linecap="round"/>'
      : '<circle cx="30" cy="41" r="5" fill="#2a1a3a"/><circle cx="50" cy="41" r="5" fill="#2a1a3a"/><path d="M24 33 L35 36 M56 33 L45 36" stroke="#2a1a3a" stroke-width="3" stroke-linecap="round"/><path d="M58 30 q4 6 0 9 q-4 -3 0 -9z" fill="#7fd4ff" stroke="#2b1d33" stroke-width="1.5"/>'}
  <ellipse cx="40" cy="54" rx="11" ry="8" fill="#f07c9a" stroke="#2b1d33" stroke-width="3"/>
  <ellipse cx="36" cy="54" rx="2" ry="3" fill="#7a2a44"/><ellipse cx="44" cy="54" rx="2" ry="3" fill="#7a2a44"/>
</svg>`;

const PU_ICON: Record<PowerUpId, string> = { golden: '★', turbo: '»', rage: '✹', shield: '◍', giant: '▲' };
const PU_COLOR: Record<PowerUpId, string> = { golden: '#ffd23f', turbo: '#4affb0', rage: '#ff4a3a', shield: '#7fe0ff', giant: '#b070ff' };

/**
 * Cartoon HUD. Every setter is change-detected so the DOM is only touched when
 * a value changes. World-anchored elements (marker, popups) are positioned from
 * projected screen coordinates supplied by the game each frame.
 */
export class HUD {
  readonly root: HTMLElement;
  private obj = el('div', 'hud-obj');
  private objK = el('div', 'k', 'OBJECTIVE');
  private objT = el('div', 't');
  private coinsEl = el('div', 'coin-chip hud-coins', '<span class="c"></span><span>0</span>');
  private scoreEl = el('div', 'score', '0');
  private comboEl = el('div', 'combo', 'x1');
  private comboBar = el('div', 'bar');
  private puWrap = el('div', 'powerups');
  private puEls = new Map<PowerUpId, HTMLElement>();
  private portrait = el('div', 'portrait', PIG_FACE('ok'));
  private hbar = el('div', 'hbar');
  private hLag = el('i', 'lag');
  private hFill = el('i', 'fill');
  private hShield = el('i', 'shield');
  private hNum = el('span', 'num', '100');
  private weapon = el('div', 'hud-weapon');
  private wName = el('div', 'wn');
  private ammo = el('div', 'ammo');
  private reload = el('div', 'reload', '<i></i>');
  private slots = el('div', 'slots');
  private cross = el('div', 'crosshair', '<i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="d"></i>');
  private ring = el('div', 'ring');
  private hit = el('div', 'hitmark');
  private target = el('div', 'target-info', '<div class="nm"></div><div class="hp"><i></i></div>');
  private dmg = el('div', 'dmg-ind');
  private dmgArcs: HTMLElement[] = [];
  private markerEl = el('div', 'marker', '<div class="gem"></div><div class="dist">0m</div>');
  private bossEl = el('div', 'boss-bar', '<div class="nm"></div><div class="tr"><i></i></div>');
  private bannerEl = el('div', 'banner', '<div class="b1"></div><div class="b2"></div>');
  private bannerT = 0;
  private hintEl = el('div', 'hint');
  private hintT = 0;
  private popups = el('div', 'popups');
  private hurtVig = el('div', 'vignette-hurt');
  private aimNote = el('div', 'aim-note', 'Click to capture the mouse');
  private shown: Record<string, string | number> = {};
  private displayScore = 0;
  private targetScore = 0;
  private portraitMood = 'ok';
  private portraitT = 0;
  onPause: (() => void) | null = null;
  onFullscreen: (() => void) | null = null;

  constructor() {
    this.root = document.getElementById('hud')!;
    this.obj.append(this.objK, this.objT);
    const tr = el('div', 'hud-top-right');
    tr.append(this.scoreEl, this.comboEl, this.puWrap);
    this.comboEl.appendChild(this.comboBar);
    this.hbar.append(this.hLag, this.hFill, this.hShield, this.hNum);
    const health = el('div', 'hud-health');
    health.append(this.portrait, this.hbar);
    this.weapon.append(this.wName, this.ammo, this.reload, this.slots);
    for (let i = 0; i < 8; i++) {
      const a = el('i');
      this.dmg.appendChild(a);
      this.dmgArcs.push(a);
    }
    const btns = el('div', 'hud-btns');
    const pause = el('button', 'icon-btn', ICONS.pause);
    pause.addEventListener('click', () => this.onPause?.());
    const fs = el('button', 'icon-btn', ICONS.fullscreen);
    fs.addEventListener('click', () => this.onFullscreen?.());
    btns.append(pause, fs);
    this.root.append(this.hurtVig, this.popups, this.markerEl, this.obj, this.coinsEl, tr, health, this.weapon, this.dmg, this.ring, this.cross, this.hit, this.target, this.bossEl, this.bannerEl, this.hintEl, btns, this.aimNote);
  }

  private set(key: string, v: string | number, fn: () => void) {
    if (this.shown[key] === v) return;
    this.shown[key] = v;
    fn();
  }

  setVisible(v: boolean) {
    this.root.classList.toggle('hidden', !v);
  }

  setObjective(text: string, flash = false) {
    this.set('obj', text, () => {
      this.objT.textContent = text;
      this.obj.style.display = text ? '' : 'none';
      const h = this.obj.getBoundingClientRect().height;
      this.coinsEl.style.setProperty('--oy', `${Math.max(60, h + 12)}px`);
    });
    if (flash) {
      this.obj.classList.remove('flash');
      void this.obj.offsetWidth;
      this.obj.classList.add('flash');
    }
  }

  setCoins(n: number) {
    this.set('coins', n, () => {
      (this.coinsEl.lastChild as HTMLElement).textContent = fmt(n);
    });
  }

  setScore(n: number) {
    this.targetScore = n;
  }

  setCombo(mult: number, combo: number, frac: number) {
    this.set('combo', `${mult}|${combo}`, () => {
      this.comboEl.firstChild!.textContent = `x${mult} COMBO`;
      this.comboEl.classList.toggle('show', combo >= 2);
      if (combo >= 2) {
        this.comboEl.classList.remove('bump');
        void this.comboEl.offsetWidth;
        this.comboEl.classList.add('bump');
      }
    });
    this.comboBar.style.width = `${Math.max(0, frac) * 100}%`;
  }

  setPowerups(list: [PowerUpId, number, number][]) {
    const active = new Set(list.map((l) => l[0]));
    for (const [id, e] of this.puEls) {
      if (!active.has(id)) {
        e.remove();
        this.puEls.delete(id);
      }
    }
    for (const [id, t, max] of list) {
      let e = this.puEls.get(id);
      if (!e) {
        e = el('div', 'pu', `<span>${PU_ICON[id]}</span>`);
        e.style.setProperty('--c', PU_COLOR[id]);
        this.puWrap.appendChild(e);
        this.puEls.set(id, e);
      }
      e.style.setProperty('--p', String(Math.round((t / max) * 100)));
    }
  }

  setHealth(hp: number, max: number, shield: number) {
    const f = Math.max(0, hp / max);
    this.set('hp', `${Math.round(hp)}|${max}|${Math.round(shield)}`, () => {
      this.hFill.style.width = `${f * 100}%`;
      this.hLag.style.width = `${f * 100}%`;
      this.hShield.style.width = `${Math.min(1, shield / 60) * 100}%`;
      this.hNum.textContent = String(Math.ceil(hp));
      this.hbar.classList.toggle('low', f < 0.3);
    });
    const mood = this.portraitT > 0 ? 'hurt' : f < 0.3 ? 'low' : 'ok';
    this.set('mood', mood, () => (this.portrait.innerHTML = PIG_FACE(mood as 'ok')));
  }

  hurt(dirAngle: number | null, amount: number) {
    this.portraitT = 0.5;
    this.portrait.classList.remove('hurt');
    void this.portrait.offsetWidth;
    this.portrait.classList.add('hurt');
    this.hurtVig.style.transition = 'none';
    this.hurtVig.style.opacity = String(Math.min(0.9, 0.3 + amount / 40));
    void this.hurtVig.offsetWidth;
    this.hurtVig.style.transition = 'opacity .6s';
    this.hurtVig.style.opacity = '0';
    if (dirAngle !== null) {
      const arc = this.dmgArcs.find((a) => a.style.opacity === '0' || !a.style.opacity) ?? this.dmgArcs[0];
      arc.style.transform = `rotate(${dirAngle}rad)`;
      arc.style.transition = 'none';
      arc.style.opacity = '1';
      void arc.offsetWidth;
      arc.style.transition = 'opacity 1s';
      arc.style.opacity = '0';
    }
  }

  setWeapon(name: string, mag: number, magSize: number, reserve: number | null, current: WeaponId, owned: Set<WeaponId>, reloadP: number) {
    this.set('wn', name, () => (this.wName.textContent = name.toUpperCase()));
    this.set('ammo', `${mag}|${magSize}|${reserve}`, () => {
      this.ammo.innerHTML = `<b>${mag}</b><small> / ${reserve === null ? '∞' : reserve}</small>`;
      this.weapon.classList.toggle('low', mag <= Math.max(2, magSize * 0.2));
    });
    this.set('slots', `${current}|${[...owned].join(',')}`, () => {
      this.slots.innerHTML = WEAPON_ORDER.map((w, i) => `<span class="${owned.has(w) ? 'own' : ''} ${w === current ? 'cur' : ''}">${i + 1}</span>`).join('');
    });
    const on = reloadP > 0;
    this.reload.classList.toggle('on', on);
    (this.reload.firstChild as HTMLElement).style.width = `${reloadP * 100}%`;
    this.ring.classList.toggle('on', on);
    this.ring.style.setProperty('--p', String(Math.round(reloadP * 100)));
  }

  setCrosshair(spread: number, onTarget: boolean, visible: boolean) {
    this.cross.style.setProperty('--s', `${Math.round(6 + spread)}px`);
    this.cross.classList.toggle('target', onTarget);
    this.cross.classList.toggle('hidden', !visible);
  }

  hitMarker(crit: boolean) {
    this.hit.classList.remove('show', 'crit');
    void this.hit.offsetWidth;
    this.hit.classList.add('show');
    if (crit) this.hit.classList.add('crit');
  }

  setTarget(name: string | null, frac: number) {
    this.set('tg', name ?? '', () => {
      this.target.classList.toggle('show', !!name);
      if (name) (this.target.firstChild as HTMLElement).textContent = name;
    });
    if (name) ((this.target.lastChild as HTMLElement).firstChild as HTMLElement).style.width = `${Math.max(0, frac) * 100}%`;
  }

  /** Objective marker; x/y in screen px, clamped to the edges when off-screen. */
  setMarker(visible: boolean, x = 0, y = 0, dist = 0) {
    this.markerEl.style.opacity = visible ? '1' : '0';
    if (!visible) return;
    this.markerEl.style.left = `${x}px`;
    this.markerEl.style.top = `${y}px`;
    this.set('md', Math.round(dist), () => ((this.markerEl.lastChild as HTMLElement).textContent = `${Math.round(dist)}m`));
  }

  bossBar(visible: boolean, frac: number, name: string) {
    this.bossEl.classList.toggle('show', visible);
    this.set('bn', name, () => ((this.bossEl.firstChild as HTMLElement).textContent = name));
    ((this.bossEl.lastChild as HTMLElement).firstChild as HTMLElement).style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  }

  banner(title: string, sub = '', dur = 2.2) {
    (this.bannerEl.firstChild as HTMLElement).textContent = title;
    (this.bannerEl.lastChild as HTMLElement).textContent = sub;
    this.bannerEl.classList.remove('show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
    this.bannerT = dur;
  }

  hint(html: string, dur = 4) {
    this.hintEl.innerHTML = html;
    this.hintEl.classList.add('show');
    this.hintT = dur;
  }

  popup(text: string, x: number, y: number, cls = '') {
    if (this.popups.childElementCount > 18) this.popups.firstElementChild?.remove();
    const p = el('div', `popup ${cls}`, text);
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    this.popups.appendChild(p);
    setTimeout(() => p.remove(), 950);
  }

  showAimNote(v: boolean) {
    this.aimNote.classList.toggle('show', v);
  }

  reset() {
    this.shown = {};
    this.displayScore = this.targetScore = 0;
    this.scoreEl.textContent = '0';
    this.popups.innerHTML = '';
    this.bossBar(false, 0, '');
    this.bannerEl.classList.remove('show');
    this.hintEl.classList.remove('show');
    for (const [, e] of this.puEls) e.remove();
    this.puEls.clear();
  }

  update(dt: number) {
    this.portraitT = Math.max(0, this.portraitT - dt);
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.bannerEl.classList.remove('show');
    }
    if (this.hintT > 0) {
      this.hintT -= dt;
      if (this.hintT <= 0) this.hintEl.classList.remove('show');
    }
    if (this.displayScore !== this.targetScore) {
      const d = this.targetScore - this.displayScore;
      this.displayScore += Math.abs(d) < 2 ? d : d * Math.min(1, dt * 10);
      this.set('score', Math.round(this.displayScore), () => (this.scoreEl.textContent = fmt(this.displayScore)));
    }
  }
}
