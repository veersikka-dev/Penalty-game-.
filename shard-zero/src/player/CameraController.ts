import * as THREE from 'three';
import { clamp, damp, noise1 } from '../utils/MathUtils';

/**
 * First-person camera: smoothed mouse look, trauma-based shake, recoil, speed-driven
 * FOV, subtle bob and sway, and a roll that leans into fast turns.
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = 0;
  targetYaw = 0;
  targetPitch = 0;
  private roll = 0;
  private trauma = 0;
  private fovKick = 0;
  private recoil = 0;
  private accelPull = 0;
  private prevYaw = 0;
  baseFov = 74;
  extraFov = 0;
  extraRoll = 0;
  sensitivity = 1;
  motion = true;
  maxYaw = 1.15;
  maxPitch = 0.85;
  /** Optional cinematic look target that overrides mouse look (menu attract mode, ending). */
  cinematic: { yaw: number; pitch: number } | null = null;
  readonly forward = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.05, 900);
    this.camera.rotation.order = 'YXZ';
  }

  addLook(dx: number, dy: number) {
    const s = 0.0021 * this.sensitivity;
    this.targetYaw = clamp(this.targetYaw - dx * s, -this.maxYaw, this.maxYaw);
    this.targetPitch = clamp(this.targetPitch - dy * s, -this.maxPitch, this.maxPitch);
  }

  /** Cursor-aim fallback: the view leans gently toward the cursor. */
  setCursorLean(nx: number, ny: number) {
    this.targetYaw = -nx * 0.22;
    this.targetPitch = ny * 0.14;
  }

  addTrauma(a: number) {
    this.trauma = Math.min(1, this.trauma + a);
  }
  kick(fov: number, recoil: number) {
    this.fovKick += fov;
    this.recoil += recoil;
  }

  resetLook() {
    this.yaw = this.targetYaw = 0;
    this.pitch = this.targetPitch = 0;
    this.roll = 0;
    this.trauma = 0;
  }

  update(dt: number, t: number, pos: THREE.Vector3, speed: number, accel: number) {
    const ty = this.cinematic ? this.cinematic.yaw : this.targetYaw;
    const tp = this.cinematic ? this.cinematic.pitch : this.targetPitch;
    const lam = this.cinematic ? 2 : 24;
    this.yaw = damp(this.yaw, ty, lam, dt);
    this.pitch = damp(this.pitch, tp, lam, dt);
    const yawVel = dt > 0 ? (this.yaw - this.prevYaw) / dt : 0;
    this.prevYaw = this.yaw;
    const m = this.motion ? 1 : 0.3;
    this.roll = damp(this.roll, clamp(-yawVel * 0.025, -0.08, 0.08) * m + this.extraRoll * m, 6, dt);

    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    const shake = this.trauma * this.trauma * m;
    const ts = t * 22;
    const ox = noise1(ts, 1) * 0.22 * shake;
    const oy = noise1(ts, 2) * 0.22 * shake;
    const rz = noise1(ts, 3) * 0.05 * shake;
    const rx = noise1(ts, 4) * 0.03 * shake;
    const ry = noise1(ts, 5) * 0.03 * shake;

    const bob = this.motion ? Math.sin(t * (4 + speed * 0.3)) * 0.028 * Math.min(1, speed / 10) : 0;
    const sway = this.motion ? Math.sin(t * 0.55) * 0.12 : 0;
    this.accelPull = damp(this.accelPull, clamp(accel * 0.04, -0.6, 0.6) * m, 3, dt);

    this.camera.position.set(pos.x + sway + ox, pos.y + bob + oy, pos.z + this.accelPull);
    this.recoil = damp(this.recoil, 0, 12, dt);
    this.camera.rotation.set(this.pitch + this.recoil + rx, this.yaw + ry, this.roll + rz);

    this.fovKick = damp(this.fovKick, 0, 6, dt);
    const speedFov = this.motion ? clamp((speed - 8) * 0.75, 0, 13) : clamp((speed - 8) * 0.2, 0, 3);
    const target = this.baseFov + speedFov + this.fovKick * m + this.extraFov;
    if (Math.abs(this.camera.fov - target) > 0.01) {
      this.camera.fov = damp(this.camera.fov, target, 5, dt);
      this.camera.updateProjectionMatrix();
    }
    this.camera.getWorldDirection(this.forward);
  }
}
