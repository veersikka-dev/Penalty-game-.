import * as THREE from 'three';
import type { FinalUniforms } from './PostFX';
import { damp } from '../utils/MathUtils';

/**
 * Holds decaying screen-space effect state (flashes, aberration pulses, damage)
 * and drives both the post shader uniforms and the DOM fade layer.
 */
export class ScreenEffects {
  private flashAmt = 0;
  private flashColor = new THREE.Color(1, 1, 1);
  private ca = 0;
  private damage = 0;
  desat = 0;
  private desatTarget = 0;
  speed = 0;
  motion = true;
  post = true;
  tint = new THREE.Color(1, 1, 1);
  private tintTarget = new THREE.Color(1, 1, 1);
  private fadeEl: HTMLElement;
  private fadeResolve: (() => void) | null = null;

  constructor(private u: FinalUniforms) {
    this.fadeEl = document.getElementById('fade')!;
  }

  flash(color: THREE.ColorRepresentation, amount: number) {
    this.flashColor.set(color);
    this.flashAmt = Math.max(this.flashAmt, amount);
  }
  pulseCA(amount: number) {
    this.ca = Math.max(this.ca, amount);
  }
  hurt() {
    this.damage = 1;
    this.pulseCA(1.2);
  }
  setDesat(v: number) {
    this.desatTarget = v;
  }
  setTint(c: THREE.ColorRepresentation) {
    this.tintTarget.set(c);
  }

  /** Fades the DOM overlay to black (1) or clear (0). Resolves when complete. */
  fade(to: number, seconds: number, color = '#000'): Promise<void> {
    this.fadeEl.style.background = color;
    this.fadeEl.style.transition = `opacity ${seconds}s ease`;
    // force style flush so the transition applies
    void this.fadeEl.offsetWidth;
    this.fadeEl.style.opacity = String(to);
    this.fadeResolve?.();
    return new Promise((res) => {
      this.fadeResolve = res;
      setTimeout(() => {
        if (this.fadeResolve === res) this.fadeResolve = null;
        res();
      }, seconds * 1000 + 30);
    });
  }

  update(dt: number) {
    this.flashAmt = damp(this.flashAmt, 0, 7, dt);
    this.ca = damp(this.ca, 0, 5, dt);
    this.damage = damp(this.damage, 0, 2.2, dt);
    this.desat = damp(this.desat, this.desatTarget, 3, dt);
    this.tint.lerp(this.tintTarget, 1 - Math.exp(-2 * dt));
    const m = this.motion ? 1 : 0.25;
    this.u.uFlash.value = this.flashAmt;
    this.u.uFlashColor.value.copy(this.flashColor);
    this.u.uCA.value = this.post ? (0.12 + this.ca) * m : 0;
    this.u.uDamage.value = this.damage * 0.6;
    this.u.uDesat.value = this.desat;
    this.u.uSpeed.value = this.post ? this.speed * m : 0;
    this.u.uLines.value = this.post ? Math.max(0, this.speed - 0.35) * 1.4 * m : 0;
    this.u.uTint.value.copy(this.tint);
  }
}
