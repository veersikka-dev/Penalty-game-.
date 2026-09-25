import * as THREE from 'three';
import type { Game } from './Game';
import type { Damageable } from '../combat/types';

export interface BotControl {
  move: { x: number; y: number };
  aim: boolean;
  fire: boolean;
  jump: boolean;
  sprint: boolean;
  dir: THREE.Vector3;
}

const _v = new THREE.Vector3();

/**
 * QA play-testing bot (enable with ?autoplay or window.__oink.bot()). It follows the
 * objective marker, steers around obstacles with feeler rays, jumps when blocked or
 * stuck, and fights: it targets the nearest visible enemy / boss / objective prop,
 * turns the camera onto it and fires in bursts.
 */
export class Autopilot {
  enabled = false;
  control: BotControl = { move: { x: 0, y: 0 }, aim: false, fire: false, jump: false, sprint: false, dir: new THREE.Vector3(0, 0, -1) };
  private stuckT = 0;
  private lastPos = new THREE.Vector3();
  private sideT = 0;
  private side = 1;
  private target: Damageable | null = null;
  private retarget = 0;

  think(g: Game, dt: number) {
    const c = this.control;
    const p = g.player.pos;
    c.jump = false;
    // ---- choose a target
    this.retarget -= dt;
    if (this.retarget <= 0 || (this.target && !this.target.alive)) {
      this.retarget = 0.3;
      this.target = null;
      let best = Infinity;
      const eye = _v.copy(p).setY(p.y + 1.3);
      const consider = (t: Damageable, maxD: number, bias = 0) => {
        if (!t.alive || !t.shapes.length) return;
        const s = t.shapes.find((sh) => sh.weak) ?? t.shapes[0];
        const d = s.c.distanceTo(p) + bias;
        if (d < maxD && d < best && !g.world.blocked(eye, s.c)) {
          best = d;
          this.target = t;
        }
      };
      for (const e of g.enemies.list) consider(e, 34);
      if (g.boss?.active && g.boss.alive) consider(g.boss, 60, -10);
      const obj = g.director.current;
      if (obj?.type === 'destroy') for (const pr of g.props.list) if (pr.tag === obj.tag) consider(pr, 30, 5);
      for (const pr of g.props.list) if (pr.type === 'crackedWall') consider(pr, 12, 8);
    }
    // ---- aim & fire
    if (this.target) {
      const s = this.target.shapes.find((sh) => sh.weak && (this.target!.kind !== 'boss' || true)) ?? this.target.shapes[0];
      const camPos = g.cam.camera.position;
      _v.subVectors(s.c, camPos).normalize();
      const yaw = Math.atan2(_v.x, _v.z);
      const pitch = Math.asin(Math.max(-0.99, Math.min(0.99, _v.y)));
      g.cam.setAngles(yaw, pitch);
      c.dir.copy(_v);
      c.aim = true;
      c.fire = true;
    } else {
      c.aim = false;
      c.fire = false;
    }
    // ---- movement toward the objective marker
    const m = g.director.markerActive ? g.director.marker : null;
    const dest = new THREE.Vector3();
    if (m) dest.copy(m);
    else if (this.target) dest.copy(this.target.position);
    else dest.copy(p);
    const to = new THREE.Vector3(dest.x - p.x, 0, dest.z - p.z);
    let dist = to.length();
    if (this.target && this.target.kind !== 'prop') {
      // in combat: keep a fighting distance and strafe
      const td = this.target.position.distanceTo(p);
      if (!m || td < 16) {
        to.set(this.target.position.x - p.x, 0, this.target.position.z - p.z);
        dist = to.length();
        this.sideT -= dt;
        if (this.sideT <= 0) {
          this.sideT = 1.2 + Math.random();
          this.side *= -1;
        }
        const perp = new THREE.Vector3(-to.z, 0, to.x).normalize().multiplyScalar(this.side);
        if (td < 7) to.negate();
        else if (td < 13) to.set(0, 0, 0);
        to.normalize().add(perp.multiplyScalar(0.9));
        dist = 5;
      }
    }
    if (dist > 0.8) {
      to.normalize();
      // feeler avoidance
      const eye = new THREE.Vector3(p.x, p.y + 0.6, p.z);
      let chosen = to.clone();
      for (const a of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) {
        const d = new THREE.Vector3(to.x * Math.cos(a) - to.z * Math.sin(a), 0, to.x * Math.sin(a) + to.z * Math.cos(a));
        const hit = g.world.raycast(eye, d, 2.2, false);
        if (!hit) {
          chosen = d;
          break;
        }
        // low obstacle: jump over it
        if (a === 0 && hit.box && hit.box.max.y - p.y < 1.3) c.jump = true;
      }
      const yaw = g.cam.yaw;
      const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
      c.move = { x: chosen.dot(right), y: chosen.dot(fwd) };
      // look where we walk when nothing needs shooting
      if (!this.target) {
        let dy = Math.atan2(chosen.x, chosen.z) - g.cam.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        g.cam.setAngles(g.cam.yaw + dy * Math.min(1, dt * 4), -0.15);
      }
      c.sprint = !this.target && dist > 10;
    } else c.move = { x: 0, y: 0 };
    // stuck detection → hop and sidestep
    this.stuckT += dt;
    if (this.stuckT > 1.4) {
      if (p.distanceTo(this.lastPos) < 1 && dist > 2) {
        c.jump = true;
        c.move = { x: this.side, y: 0.3 };
        this.side *= -1;
      }
      this.lastPos.copy(p);
      this.stuckT = 0;
    }
  }
}
