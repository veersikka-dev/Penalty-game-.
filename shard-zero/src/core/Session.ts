import { clamp } from '../utils/MathUtils';

export const COMBO_WINDOW = 2.4;

/** Per-run scoring and resource rules: ammo, combo, multipliers, accuracy and stats. */
export class Session {
  score = 0;
  ammo = 0;
  combo = 0;
  comboTimer = 0;
  bestCombo = 0;
  /** Temporary multiplier from Prism crystals. */
  bonusMult = 1;
  bonusTime = 0;
  slowTime = 0;
  shots = 0;
  hitShots = 0;
  destroyed = 0;
  time = 0;
  ammoCollected = 0;
  crashes = 0;
  /** Consecutive shots that hit something. */
  streak = 0;

  reset(ammo: number) {
    this.score = 0;
    this.ammo = ammo;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.bonusMult = 1;
    this.bonusTime = 0;
    this.slowTime = 0;
    this.shots = 0;
    this.hitShots = 0;
    this.destroyed = 0;
    this.time = 0;
    this.ammoCollected = 0;
    this.crashes = 0;
    this.streak = 0;
  }

  /** x1 .. x5 based on combo length. */
  get comboMult() {
    return clamp(1 + Math.floor(this.combo / 4), 1, 5);
  }
  get totalMult() {
    return this.comboMult * this.bonusMult;
  }
  get accuracy() {
    return this.shots ? this.hitShots / this.shots : 1;
  }

  /** Registers a destroyed object; returns points awarded and whether the multiplier tier went up. */
  registerDestroy(base: number): { points: number; tierUp: boolean } {
    const before = this.comboMult;
    this.combo++;
    this.comboTimer = COMBO_WINDOW;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.destroyed++;
    const points = Math.round(base * this.totalMult);
    this.score += points;
    return { points, tierUp: this.comboMult > before };
  }

  addScore(points: number) {
    this.score += Math.round(points * this.bonusMult);
  }

  addAmmo(n: number) {
    this.ammo += n;
    this.ammoCollected += n;
  }

  breakCombo() {
    this.combo = 0;
    this.comboTimer = 0;
  }

  update(dt: number) {
    this.time += dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.bonusTime > 0) {
      this.bonusTime -= dt;
      if (this.bonusTime <= 0) this.bonusMult = 1;
    }
    if (this.slowTime > 0) this.slowTime -= dt;
  }
}
