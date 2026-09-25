export const COMBO_WINDOW = 3.2;

export interface ScoreEvent {
  points: number;
  label: string;
  combo: number;
  tierUp: boolean;
}

/**
 * Per-level run state: score, combo chains (kills + destruction), bonuses,
 * coins and collectibles picked up this run, and stats for the results screen.
 */
export class Session {
  score = 0;
  coins = 0;
  kills = 0;
  crits = 0;
  shots = 0;
  hits = 0;
  props = 0;
  deaths = 0;
  damageTaken = 0;
  time = 0;
  combo = 0;
  comboTimer = 0;
  bestCombo = 0;
  found: string[] = [];
  private noDamage = 0;
  private streakTier = 0;

  reset() {
    this.score = this.coins = this.kills = this.crits = this.shots = this.hits = this.props = this.deaths = 0;
    this.damageTaken = this.time = this.combo = this.comboTimer = this.bestCombo = 0;
    this.found = [];
    this.noDamage = 0;
    this.streakTier = 0;
  }

  get mult() {
    return Math.min(8, 1 + Math.floor(this.combo / 2));
  }
  get accuracy() {
    return this.shots ? Math.min(1, this.hits / this.shots) : 0;
  }

  private bump(): boolean {
    const before = this.mult;
    this.combo++;
    this.comboTimer = COMBO_WINDOW;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    return this.mult > before;
  }

  kill(base: number, weak: boolean): ScoreEvent {
    const tierUp = this.bump();
    this.kills++;
    let pts = base;
    let label = '';
    if (weak) {
      pts += 250;
      this.crits++;
      label = 'CRITICAL!';
    }
    pts = Math.round(pts * this.mult);
    this.score += pts;
    return { points: pts, label, combo: this.combo, tierUp };
  }

  prop(base: number, chained: boolean): ScoreEvent {
    const tierUp = this.bump();
    this.props++;
    const pts = Math.round(base * this.mult * (chained ? 2 : 1));
    this.score += pts;
    return { points: pts, label: chained ? 'CHAIN REACTION!' : '', combo: this.combo, tierUp };
  }

  bonus(points: number) {
    this.score += points;
  }

  hurt(amount: number) {
    this.damageTaken += amount;
    this.noDamage = 0;
    this.streakTier = 0;
  }

  /** Returns a bonus event when a no-damage milestone is reached. */
  update(dt: number): ScoreEvent | null {
    this.time += dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this.noDamage += dt;
    const tier = Math.floor(this.noDamage / 45);
    if (tier > this.streakTier) {
      this.streakTier = tier;
      const pts = Math.min(1500, 300 * tier);
      this.score += pts;
      return { points: pts, label: 'NO-DAMAGE BONUS!', combo: this.combo, tierUp: false };
    }
    return null;
  }
}
