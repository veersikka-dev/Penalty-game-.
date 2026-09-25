import { el, fmt, ICONS } from './dom';

/**
 * Minimal in-game HUD. All writes are change-detected so the DOM is only touched
 * when values actually change.
 */
export class HUD {
  readonly root: HTMLElement;
  private levelEl = el('div', 'hud-level');
  private progFill = el('i');
  private progress = el('div', 'progress');
  private scoreVal = el('div', 'value', '0');
  private multEl = el('div', 'mult', 'x1');
  private comboEl = el('div', 'combo');
  private comboN = el('div', 'n', '0');
  private comboBar = el('i');
  private ammoWrap = el('div', 'hud-ammo');
  private ammoVal = el('div', 'value', '0');
  private ammoDelta = el('div', 'ammo-delta');
  private slowEl = el('div', 'special');
  private slowBar = el('i');
  private bonusEl = el('div', 'special');
  private bonusBar = el('i');
  private crosshair = el('div', 'crosshair');
  private hitmarker = el('div', 'hitmarker');
  private msg = el('div', 'message');
  private msgTimer = 0;
  private title = el('div', 'title-card');
  private popups = el('div', 'popups');
  private bossWrap = el('div', 'boss-bar');
  private bossLabel = el('div', 'label');
  private bossFill = el('i');
  private skipEl = el('div', 'skip', 'SPACE — SKIP INTRO');
  private crackSvg: SVGSVGElement;
  private aimNote = el('div', 'aim-note', 'Click to capture the mouse — Esc to pause');
  private shown = { score: -1, mult: '', combo: -1, ammo: -1, prog: -1, slow: -1, bonus: -1 };
  private displayScore = 0;
  private targetScore = 0;
  onPause: (() => void) | null = null;
  onFullscreen: (() => void) | null = null;

  constructor() {
    this.root = document.getElementById('hud')!;
    const top = el('div', 'hud-top');
    this.progress.appendChild(this.progFill);
    top.append(this.levelEl, this.progress);

    const score = el('div', 'hud-score');
    score.append(el('div', 'label', 'SCORE'), this.scoreVal, this.multEl);

    this.comboEl.append(this.comboN, el('div', 't', 'COMBO'), el('div', 'bar'));
    this.comboEl.querySelector('.bar')!.appendChild(this.comboBar);

    this.ammoWrap.append(el('div', 'label', 'SHARDS'), this.ammoVal, this.ammoDelta);

    const specials = el('div', 'specials');
    this.slowEl.append(el('span', '', 'CHRONO'), el('div', 'bar'));
    this.slowEl.querySelector('.bar')!.appendChild(this.slowBar);
    this.slowBar.style.background = '#ffd35a';
    this.bonusEl.append(el('span', '', 'PRISM x2'), el('div', 'bar'));
    this.bonusEl.querySelector('.bar')!.appendChild(this.bonusBar);
    this.bonusBar.style.background = '#ff4ad8';
    specials.append(this.slowEl, this.bonusEl);

    this.crosshair.innerHTML = `<svg viewBox="0 0 34 34"><g stroke="white" stroke-width="2" stroke-linecap="round"><line x1="17" y1="3" x2="17" y2="11"/><line x1="17" y1="23" x2="17" y2="31"/><line x1="3" y1="17" x2="11" y2="17"/><line x1="23" y1="17" x2="31" y2="17"/></g></svg><div class="dot"></div>`;

    this.msg.append(el('div', 'm1'), el('div', 'm2'));
    this.title.append(el('div', 'k'), el('div', 'n'), el('div', 's'));
    this.bossWrap.append(this.bossLabel, el('div', 'track'));
    this.bossWrap.querySelector('.track')!.appendChild(this.bossFill);

    const btns = el('div', 'hud-btns');
    const pause = el('button', 'icon-btn', ICONS.pause);
    pause.title = 'Pause (Esc)';
    pause.addEventListener('click', () => this.onPause?.());
    const fs = el('button', 'icon-btn', ICONS.fullscreen);
    fs.title = 'Fullscreen (F)';
    fs.addEventListener('click', () => this.onFullscreen?.());
    btns.append(pause, fs);
    btns.style.pointerEvents = 'auto';

    this.crackSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.crackSvg.classList.add('crack-overlay');
    this.crackSvg.setAttribute('preserveAspectRatio', 'none');
    this.crackSvg.setAttribute('viewBox', '0 0 100 100');

    this.root.append(this.crackSvg, top, score, this.comboEl, this.ammoWrap, specials, this.popups, this.crosshair, this.hitmarker, this.msg, this.title, this.bossWrap, this.skipEl, btns, this.aimNote);
  }

  setVisible(v: boolean) {
    this.root.classList.toggle('hidden', !v);
  }

  setLevel(text: string) {
    this.levelEl.textContent = text;
  }

  setProgressTicks(fracs: number[]) {
    this.progress.querySelectorAll('.tick').forEach((t) => t.remove());
    for (const f of fracs) {
      const t = el('div', 'tick');
      t.style.left = `${f * 100}%`;
      this.progress.appendChild(t);
    }
  }

  setProgress(p: number) {
    const v = Math.round(p * 1000);
    if (v === this.shown.prog) return;
    this.shown.prog = v;
    this.progFill.style.width = `${v / 10}%`;
  }

  setScore(n: number) {
    this.targetScore = n;
  }

  setMult(combo: number, bonus: number) {
    const key = `${combo}|${bonus}`;
    if (key === this.shown.mult) return;
    this.shown.mult = key;
    const total = combo * bonus;
    this.multEl.textContent = `x${total}`;
    this.multEl.classList.toggle('hot', combo > 1);
    this.multEl.classList.toggle('bonus', bonus > 1);
    this.bump(this.multEl);
  }

  setCombo(n: number, frac: number) {
    if (n !== this.shown.combo) {
      this.shown.combo = n;
      this.comboN.textContent = String(n);
      this.comboEl.classList.toggle('show', n >= 2);
      if (n >= 2) this.bump(this.comboN);
    }
    this.comboBar.style.width = `${Math.max(0, frac) * 100}%`;
  }

  setAmmo(n: number) {
    if (n === this.shown.ammo) return;
    const prev = this.shown.ammo;
    this.shown.ammo = n;
    this.ammoVal.textContent = String(n);
    this.ammoWrap.classList.toggle('low', n <= 5);
    if (prev >= 0 && n - prev > 1) this.ammoChange(n - prev);
  }

  ammoChange(delta: number) {
    this.ammoDelta.textContent = delta > 0 ? `+${delta}` : String(delta);
    this.ammoDelta.className = `ammo-delta ${delta > 0 ? 'up' : 'down'}`;
    void this.ammoDelta.offsetWidth;
    this.bump(this.ammoVal);
  }

  setSpecials(slow: number, bonus: number) {
    const s = Math.round(slow * 100), b = Math.round(bonus * 100);
    if (s !== this.shown.slow) {
      this.shown.slow = s;
      this.slowEl.classList.toggle('on', s > 0);
      this.slowBar.style.width = `${s}%`;
    }
    if (b !== this.shown.bonus) {
      this.shown.bonus = b;
      this.bonusEl.classList.toggle('on', b > 0);
      this.bonusBar.style.width = `${b}%`;
    }
  }

  setCrosshair(x: number | null, y: number | null) {
    if (x === null || y === null) {
      this.crosshair.style.left = '50%';
      this.crosshair.style.top = '50%';
    } else {
      this.crosshair.style.left = `${x}px`;
      this.crosshair.style.top = `${y}px`;
    }
    this.hitmarker.style.left = this.crosshair.style.left;
    this.hitmarker.style.top = this.crosshair.style.top;
  }
  setCrosshairVisible(v: boolean) {
    this.crosshair.style.opacity = v ? '1' : '0';
  }
  fire() {
    this.crosshair.classList.add('fire');
    setTimeout(() => this.crosshair.classList.remove('fire'), 70);
  }
  hit() {
    this.hitmarker.classList.remove('show');
    void this.hitmarker.offsetWidth;
    this.hitmarker.classList.add('show');
  }

  message(text: string, sub = '', duration = 3) {
    (this.msg.children[0] as HTMLElement).textContent = text;
    (this.msg.children[1] as HTMLElement).textContent = sub;
    this.msg.classList.add('show');
    this.msgTimer = duration;
  }

  titleCard(k: string, name: string, sub: string, color: string, duration = 3.2) {
    (this.title.children[0] as HTMLElement).textContent = k;
    (this.title.children[1] as HTMLElement).textContent = name;
    (this.title.children[2] as HTMLElement).textContent = sub;
    this.title.style.setProperty('--tc', color);
    this.title.classList.add('show');
    setTimeout(() => this.title.classList.remove('show'), duration * 1000);
  }

  popup(text: string, x: number, y: number, color = '#fff', big = false) {
    if (this.popups.childElementCount > 14) this.popups.firstElementChild?.remove();
    const p = el('div', big ? 'popup big' : 'popup', text);
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    if (!big) p.style.color = color;
    this.popups.appendChild(p);
    setTimeout(() => p.remove(), 950);
  }

  bossBar(visible: boolean, frac: number, label: string) {
    this.bossWrap.classList.toggle('show', visible);
    this.bossFill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    if (this.bossLabel.textContent !== label) this.bossLabel.textContent = label;
  }

  showSkip(v: boolean) {
    this.skipEl.classList.toggle('show', v);
  }
  showAimNote(v: boolean) {
    this.aimNote.classList.toggle('show', v);
  }

  /** Procedural cracked-screen overlay when the player crashes into glass. */
  crack() {
    const cx = 30 + Math.random() * 40;
    const cy = 30 + Math.random() * 40;
    let d = '';
    for (let i = 0; i < 14; i++) {
      let a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      let x = cx, y = cy;
      d += `M${x} ${y}`;
      const len = 20 + Math.random() * 50;
      for (let s = 0; s < 6; s++) {
        a += (Math.random() - 0.5) * 0.5;
        x += Math.cos(a) * (len / 6);
        y += Math.sin(a) * (len / 6);
        d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    }
    for (const r of [4, 9]) {
      d += ` M${cx + r} ${cy}`;
      for (let k = 1; k <= 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const rr = r * (0.8 + Math.random() * 0.4);
        d += ` L${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
      }
    }
    this.crackSvg.innerHTML = `<path d="${d}" fill="none" stroke="rgba(230,245,255,0.75)" stroke-width="0.18" vector-effect="non-scaling-stroke" style="stroke-width:1.4px;filter:drop-shadow(0 0 3px rgba(143,240,255,.8))"/>`;
    this.crackSvg.classList.add('show');
    setTimeout(() => this.crackSvg.classList.remove('show'), 80);
  }

  reset() {
    this.shown = { score: -1, mult: '', combo: -1, ammo: -1, prog: -1, slow: -1, bonus: -1 };
    this.displayScore = 0;
    this.targetScore = 0;
    this.scoreVal.textContent = '0';
    this.bossBar(false, 0, '');
    this.msg.classList.remove('show');
    this.popups.innerHTML = '';
  }

  private bump(e: HTMLElement) {
    e.classList.remove('pop');
    void e.offsetWidth;
    e.classList.add('pop');
  }

  update(dt: number) {
    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0) this.msg.classList.remove('show');
    }
    if (this.displayScore !== this.targetScore) {
      const diff = this.targetScore - this.displayScore;
      this.displayScore += Math.abs(diff) < 2 ? diff : diff * Math.min(1, dt * 10);
      const v = Math.round(this.displayScore);
      if (v !== this.shown.score) {
        this.shown.score = v;
        this.scoreVal.textContent = fmt(v);
      }
    }
  }
}
