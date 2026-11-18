import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PLAYER, FLAG, ADS } from '@comic-strike/shared/constants.js';

const CENTER = PLAYER.HEIGHT / 2; // kapsül merkezi, ayak noktasından yukarı
const HALF = PLAYER.HEIGHT / 2 - PLAYER.RADIUS;
const C_CENTER = PLAYER.CROUCH_HEIGHT / 2;
const C_HALF = PLAYER.CROUCH_HEIGHT / 2 - PLAYER.RADIUS;
const _up = { x: 0, y: 1, z: 0 };
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
    this.crouching = false;
    this.crouchT = 0; // 0 ayakta, 1 çömelmiş (göz yüksekliği yumuşak geçiş)
    this.speedMult = 1; // elindeki silaha göre (AWP yavaşlatır)
    this.traction = 1; // haritaya göre zemin tutuşu (buz < 1)
    this.scoped = false; // AWP dürbünü
    this.aiming = false; // sağ tık nişan (diğer silahlar)
    this.stamina = PLAYER.STAMINA_MAX;
    this.exhausted = false; // stamina bitti: MIN_TO_SPRINT'e kadar koşulamaz
    this.landed = 0; // bu karede yere sert çarptıysa çarpma hızı (m/s), Game okuyup sıfırlar
  }

  get center() {
    return this.crouching ? C_CENTER : CENTER;
  }

  setCrouch(on) {
    if (on === this.crouching) return;
    if (!on) {
      // Kalkmadan önce başın üstünde yer var mı?
      const head = { x: this.position.x, y: this.position.y + PLAYER.CROUCH_HEIGHT - 0.05, z: this.position.z };
      if (this.physics.raycast(head, _up, PLAYER.HEIGHT - PLAYER.CROUCH_HEIGHT + 0.1, this.collider)) return;
    }
    this.crouching = on;
    this.collider.setHalfHeight(on ? C_HALF : HALF);
    this.collider.setTranslation({ x: this.position.x, y: this.position.y + this.center, z: this.position.z });
  }

  teleport(p, yaw) {
    this.position.set(p[0], p[1], p[2]);
    if (this.crouching) {
      this.crouching = false;
      this.collider.setHalfHeight(HALF);
    }
    this.crouchT = 0;
    this.collider.setTranslation({ x: p[0], y: p[1] + CENTER, z: p[2] });
    this.velocity.set(0, 0, 0);
    this.landed = 0;
    if (yaw !== undefined) {
      this.yaw = yaw;
      this.pitch = 0;
    }
  }

  resetStamina() {
    this.stamina = PLAYER.STAMINA_MAX;
    this.exhausted = false;
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
    return (this.moving ? FLAG.MOVING : 0) | (this.running ? FLAG.RUNNING : 0) | (this.grounded ? 0 : FLAG.AIR)
      | (this.crouching ? FLAG.CROUCH : 0) | (this.scoped || this.aiming ? FLAG.SCOPED : 0);
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

    this.setCrouch(enabled && (input.down('ControlLeft') || input.down('ControlRight') || input.down('KeyC')));
    this.crouchT += ((this.crouching ? 1 : 0) - this.crouchT) * Math.min(1, dt * 14);
    // Hızlı koşu (Shift): sadece ileri/yana giderken; nişan alırken veya çömelirken koşulmaz
    const wantRun = enabled && fwd >= 0 && len > 0 && !this.crouching && !this.scoped && !this.aiming
      && (input.down('ShiftLeft') || input.down('ShiftRight'));
    this.running = wantRun && !this.exhausted && this.stamina > 0;
    // Stamina: koşarken azalır, dururken hızlı, yürürken yavaş dolar
    if (this.running) {
      this.stamina = Math.max(0, this.stamina - PLAYER.STAMINA_DRAIN * dt);
      if (this.stamina <= 0) this.exhausted = true;
    } else {
      const regen = len > 0 ? PLAYER.STAMINA_REGEN_MOVE : PLAYER.STAMINA_REGEN_IDLE;
      this.stamina = Math.min(PLAYER.STAMINA_MAX, this.stamina + regen * dt);
      if (this.stamina >= PLAYER.STAMINA_MIN_TO_SPRINT) this.exhausted = false;
    }
    let speed = this.running ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED;
    if (this.crouching) speed = PLAYER.CROUCH_SPEED;
    else if (this.scoped) speed *= 0.55;
    else if (this.aiming) speed *= ADS.SPEED_MULT;
    speed *= this.speedMult;

    if (this.grounded || len > 0) {
      const k = Math.min(1, (this.grounded ? 14 * this.traction : 2.5) * dt);
      this.velocity.x += (wx * speed - this.velocity.x) * k;
      this.velocity.z += (wz * speed - this.velocity.z) * k;
    }

    if (enabled && this.grounded && !this.crouching && input.pressed('Space')) {
      this.stamina = Math.max(0, this.stamina - PLAYER.STAMINA_JUMP);
      this.velocity.y = PLAYER.JUMP_VELOCITY;
      this.grounded = false;
    }
    this.velocity.y -= PLAYER.GRAVITY * dt;

    const wasGrounded = this.grounded;
    const fallSpeed = -this.velocity.y;
    const desired = { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt };
    this.kcc.computeColliderMovement(this.collider, desired);
    const mv = this.kcc.computedMovement();
    const t = this.collider.translation();
    const nx = t.x + mv.x;
    const ny = t.y + mv.y;
    const nz = t.z + mv.z;
    this.collider.setTranslation({ x: nx, y: ny, z: nz });

    this.grounded = this.kcc.computedGrounded();
    // Yere sert iniş → düşme hasarı için bildir
    if (!wasGrounded && this.grounded && fallSpeed > 0) this.landed = Math.max(this.landed, fallSpeed);
    if (this.grounded && this.velocity.y < 0) this.velocity.y = 0;
    if (this.velocity.y > 0 && mv.y < desired.y * 0.5) this.velocity.y = 0; // tavana çarptı

    this.position.set(nx, ny - this.center, nz);
    this.moving = Math.hypot(this.velocity.x, this.velocity.z) > 0.6;
  }

  eye(target) {
    const eye = PLAYER.EYE + (PLAYER.CROUCH_EYE - PLAYER.EYE) * this.crouchT;
    return target.set(this.position.x, this.position.y + eye, this.position.z);
  }
}
