import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PLAYER } from '@comic-strike/shared/constants.js';

const CENTER = PLAYER.HEIGHT / 2; // kapsül merkezi, ayak noktasından yukarı
const HALF = PLAYER.HEIGHT / 2 - PLAYER.RADIUS;
const BASE_SENS = 0.0022;

/**
 * Yerel oyuncu: Rapier kinematik karakter kontrolcüsü ile hareket.
 * Hareket istemcide anında hesaplanır (client prediction); sunucu kontrol eder ve gerekirse düzeltir.
 */
export class LocalPlayer {
  constructor(physics) {
    this.physics = physics;
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(HALF, PLAYER.RADIUS).setTranslation(0, 50, 0),
    );
    this.kcc = physics.world.createCharacterController(0.02);
    this.kcc.enableAutostep(0.45, 0.2, false);
    this.kcc.enableSnapToGround(0.3);
    this.kcc.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.kcc.setSlideEnabled(true);

    this.position = new THREE.Vector3(0, 50, 0); // ayak noktası
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.grounded = false;
    this.moving = false;
    this.running = false;
  }

  teleport(p, yaw) {
    this.position.set(p[0], p[1], p[2]);
    this.collider.setTranslation({ x: p[0], y: p[1] + CENTER, z: p[2] });
    this.velocity.set(0, 0, 0);
    if (yaw !== undefined) {
      this.yaw = yaw;
      this.pitch = 0;
    }
  }

  look(dx, dy, sensitivity) {
    const s = BASE_SENS * sensitivity;
    this.yaw -= dx * s;
    this.pitch -= dy * s;
    this.clampPitch();
  }

  clampPitch() {
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
  }

  get flags() {
    return (this.moving ? 1 : 0) | (this.running ? 2 : 0) | (this.grounded ? 0 : 4);
  }

  update(dt, input, enabled) {
    let fwd = 0;
    let side = 0;
    if (enabled) {
      fwd = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
      side = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    }
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // ileri = (-sin, -cos), sağ = (cos, -sin)
    let wx = -sin * fwd + cos * side;
    let wz = -cos * fwd - sin * side;
    const len = Math.hypot(wx, wz);
    if (len > 0) {
      wx /= len;
      wz /= len;
    }

    this.running = enabled && len > 0 && (input.down('ShiftLeft') || input.down('ShiftRight'));
    const speed = this.running ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED;

    if (this.grounded || len > 0) {
      const k = Math.min(1, (this.grounded ? 14 : 2.5) * dt);
      this.velocity.x += (wx * speed - this.velocity.x) * k;
      this.velocity.z += (wz * speed - this.velocity.z) * k;
    }

    if (enabled && this.grounded && input.pressed('Space')) {
      this.velocity.y = PLAYER.JUMP_VELOCITY;
      this.grounded = false;
    }
    this.velocity.y -= PLAYER.GRAVITY * dt;

    const desired = { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt };
    this.kcc.computeColliderMovement(this.collider, desired);
    const mv = this.kcc.computedMovement();
    const t = this.collider.translation();
    const nx = t.x + mv.x;
    const ny = t.y + mv.y;
    const nz = t.z + mv.z;
    this.collider.setTranslation({ x: nx, y: ny, z: nz });

    this.grounded = this.kcc.computedGrounded();
    if (this.grounded && this.velocity.y < 0) this.velocity.y = 0;
    if (this.velocity.y > 0 && mv.y < desired.y * 0.5) this.velocity.y = 0; // tavana çarptı

    this.position.set(nx, ny - CENTER, nz);
    this.moving = Math.hypot(this.velocity.x, this.velocity.z) > 0.6;
  }

  eye(target) {
    return target.set(this.position.x, this.position.y + PLAYER.EYE, this.position.z);
  }
}
