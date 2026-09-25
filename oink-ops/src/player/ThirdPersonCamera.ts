import * as THREE from 'three';
import type { CollisionWorld } from '../physics/Collision';
import { clamp, damp, noise1 } from '../utils/MathUtils';

const _pivot = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _back = new THREE.Vector3();

/**
 * Over-the-shoulder follow camera. Mouse orbits yaw/pitch; the pivot trails the
 * pig with lag; aiming blends to a tighter shoulder view with lower FOV; sprinting
 * pulls back with wider FOV. A multi-ray probe keeps the camera out of walls.
 */
export class ThirdPersonCamera {
  readonly camera: THREE.PerspectiveCamera;
  yaw = Math.PI;
  pitch = -0.12;
  private targetYaw = Math.PI;
  private targetPitch = -0.12;
  sensitivity = 1;
  motion = true;
  aimW = 0;
  private sprintW = 0;
  private dist = 4.4;
  private pivot = new THREE.Vector3();
  private pivotInit = false;
  private trauma = 0;
  private fovKick = 0;
  private recoilPitch = 0;
  private recoilYaw = 0;
  private airOffset = 0;
  /** Extra zoom for cinematic moments (boss intro, victory). */
  cinematic: { pos: THREE.Vector3; look: THREE.Vector3; fov: number } | null = null;
  readonly forward = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.08, 1200);
  }

  look(dx: number, dy: number) {
    const s = 0.0023 * this.sensitivity * (1 - this.aimW * 0.4);
    this.targetYaw -= dx * s;
    this.targetPitch = clamp(this.targetPitch - dy * s, -1.1, 0.75);
  }

  setAngles(yaw: number, pitch: number) {
    this.yaw = this.targetYaw = yaw;
    this.pitch = this.targetPitch = pitch;
  }

  snapTo(target: THREE.Vector3) {
    this.pivot.copy(target);
    this.pivotInit = true;
  }

  shake(a: number) {
    this.trauma = Math.min(1, this.trauma + a);
  }
  kick(pitch: number, yaw: number, fov: number) {
    this.recoilPitch += pitch;
    this.recoilYaw += yaw;
    this.fovKick += fov;
  }

  update(dt: number, t: number, target: THREE.Vector3, opts: { aim: boolean; sprint: boolean; grounded: boolean; vy: number; scale: number }, world: CollisionWorld) {
    const cam = this.camera;
    if (this.cinematic) {
      cam.position.lerp(this.cinematic.pos, 1 - Math.exp(-3 * dt));
      cam.lookAt(this.cinematic.look);
      cam.fov = damp(cam.fov, this.cinematic.fov, 3, dt);
      cam.updateProjectionMatrix();
      cam.getWorldDirection(this.forward);
      return;
    }
    this.yaw = damp(this.yaw, this.targetYaw, 30, dt);
    this.pitch = damp(this.pitch, this.targetPitch, 30, dt);
    this.aimW = damp(this.aimW, opts.aim ? 1 : 0, 12, dt);
    this.sprintW = damp(this.sprintW, opts.sprint ? 1 : 0, 4, dt);
    this.recoilPitch = damp(this.recoilPitch, 0, 10, dt);
    this.recoilYaw = damp(this.recoilYaw, 0, 10, dt);
    this.fovKick = damp(this.fovKick, 0, 8, dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.8);

    // Pivot trails the pig (vertical lag makes jumps feel floaty-good)
    _pivot.set(target.x, target.y + 1.55 * opts.scale, target.z);
    if (!this.pivotInit) {
      this.pivot.copy(_pivot);
      this.pivotInit = true;
    }
    const lagXZ = 1 - Math.exp(-(18 + this.aimW * 20) * dt);
    const lagY = 1 - Math.exp(-(opts.grounded ? 12 : 5) * dt);
    this.pivot.x += (_pivot.x - this.pivot.x) * lagXZ;
    this.pivot.z += (_pivot.z - this.pivot.z) * lagXZ;
    this.pivot.y += (_pivot.y - this.pivot.y) * lagY;
    this.airOffset = damp(this.airOffset, opts.grounded ? 0 : clamp(-opts.vy * 0.03, -0.3, 0.4), 4, dt);

    const yaw = this.yaw + this.recoilYaw;
    const pitch = this.pitch + this.recoilPitch;
    _dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)); // look direction
    _right.set(-Math.cos(yaw), 0, Math.sin(yaw));
    let shoulder = (0.9 + this.aimW * 0.05) * (0.6 + opts.scale * 0.4);
    const baseDist = (4.6 + this.sprintW * 0.8) * (1 - this.aimW) + 2.3 * this.aimW;
    const wantDist = baseDist * (0.75 + opts.scale * 0.25);
    // Don't push the shoulder pivot into a wall beside the pig
    const side = world.raycast(this.pivot, _right, shoulder + 0.3, false);
    if (side) shoulder = Math.max(0, side.dist - 0.3);
    const pivot = _pivot.copy(this.pivot).addScaledVector(_right, shoulder);
    pivot.y += this.airOffset + this.aimW * 0.05;

    // Collision: probe a small fan of rays behind the pivot and pull in to the nearest hit
    _back.copy(_dir).negate();
    let allowed = wantDist;
    for (const [ox, oy] of [[0, 0], [0.22, 0.16], [-0.22, 0.16], [0.22, -0.16], [-0.22, -0.16]]) {
      const from = new THREE.Vector3().copy(pivot).addScaledVector(_right, ox);
      from.y += oy;
      const hit = world.raycast(from, _back, wantDist + 0.3, true);
      if (hit) allowed = Math.min(allowed, Math.max(0.5, hit.dist - 0.35));
    }
    // Pull in fast, ease back out slowly (no popping)
    this.dist = allowed < this.dist ? allowed : damp(this.dist, allowed, 3, dt);
    _desired.copy(pivot).addScaledVector(_back, this.dist);
    // never below the floor
    _desired.y = Math.max(_desired.y, (world.hasFloor ? world.floorY : -50) + 0.3);

    const shake = this.trauma * this.trauma * (this.motion ? 1 : 0.3);
    const ts = t * 24;
    cam.position.set(_desired.x + noise1(ts, 1) * 0.18 * shake, _desired.y + noise1(ts, 2) * 0.18 * shake, _desired.z + noise1(ts, 3) * 0.18 * shake);
    const lookAt = new THREE.Vector3().copy(pivot).addScaledVector(_dir, 10);
    cam.lookAt(lookAt);
    cam.rotateZ(noise1(ts, 4) * 0.03 * shake);

    const fov = 62 + (this.motion ? this.sprintW * 8 : this.sprintW * 2) - this.aimW * 14 + this.fovKick;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = damp(cam.fov, fov, 8, dt);
      cam.updateProjectionMatrix();
    }
    cam.getWorldDirection(this.forward);
  }

  /** Camera-relative basis on the ground plane for movement input. */
  basis(outFwd: THREE.Vector3, outRight: THREE.Vector3) {
    outFwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    outRight.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
  }
}
