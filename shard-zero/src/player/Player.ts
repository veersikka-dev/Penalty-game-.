import * as THREE from 'three';
import { clamp, damp } from '../utils/MathUtils';

/** The player rides a rail down -Z. Speed eases towards a target; can decelerate to a stop point. */
export class Player {
  distance = 0;
  speed = 0;
  targetSpeed = 10;
  accel = 0;
  eyeHeight = 2.5;
  /** If set, the player smoothly brakes to rest at this distance (boss arena). */
  stopAt: number | null = null;
  readonly position = new THREE.Vector3(0, 2.5, 0);
  readonly velocity = new THREE.Vector3();

  reset(distance: number, speed: number) {
    this.distance = distance;
    this.speed = speed;
    this.targetSpeed = speed;
    this.stopAt = null;
    this.accel = 0;
    this.position.set(0, this.eyeHeight, -distance);
  }

  update(dt: number) {
    let desired = this.targetSpeed;
    if (this.stopAt !== null) desired = clamp((this.stopAt - this.distance) * 0.6, 0, this.targetSpeed);
    const prev = this.speed;
    this.speed = damp(this.speed, desired, 1.6, dt);
    this.accel = dt > 0 ? (this.speed - prev) / dt : 0;
    this.distance += this.speed * dt;
    this.position.set(0, this.eyeHeight, -this.distance);
    this.velocity.set(0, 0, -this.speed);
  }
}
