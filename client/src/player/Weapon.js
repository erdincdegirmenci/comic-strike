import * as THREE from 'three';
import { WEAPON, TEAM_INFO } from '@comic-strike/shared/constants.js';
import { part, toon } from '../fx/Toon.js';
import { starTexture } from '../fx/Effects.js';

/**
 * Birinci şahıs silah görünümü (viewmodel).
 * Duvarların içine girmemesi için ayrı bir sahnede, derinlik temizlenerek çizilir.
 */
export class Weapon {
  constructor(aspect) {
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#fff4dc', '#56627e', 1.6));
    const light = new THREE.DirectionalLight('#ffffff', 2.2);
    light.position.set(1, 2, 1);
    this.scene.add(light);

    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.01, 10);
    this.root = new THREE.Group();
    this.base = new THREE.Vector3(0.2, -0.22, -0.48);
    this.root.position.copy(this.base);
    this.root.scale.setScalar(0.8);
    this.scene.add(this.root);
    this.build();

    this.visible = false;
    this.ammo = WEAPON.MAG_SIZE;
    this.reloading = false;
    this.reloadStart = 0;
    this.lastShot = 0;
    this.kick = 0;
    this.bobT = 0;
    this.sway = new THREE.Vector2();
    this.sprint = 0;
  }

  build() {
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const t = 0.006;
    const gun = new THREE.Group();
    this.gun = gun;
    this.root.add(gun);

    const add = (geo, color, x, y, z, rx = 0, ry = 0) => {
      const m = part(geo, color, t);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, 0);
      gun.add(m);
      return m;
    };
    add(B(0.07, 0.09, 0.36), '#2b2d42', 0, 0, 0); // gövde
    add(B(0.075, 0.07, 0.17), '#ff9f1c', 0, 0, -0.24); // el kundağı
    add(B(0.03, 0.035, 0.13), '#ff9f1c', 0, 0.06, -0.02); // nişangah rayı
    add(B(0.012, 0.03, 0.012), '#141414', 0, 0.09, -0.07); // arpacık
    const barrel = add(new THREE.CylinderGeometry(0.016, 0.016, 0.24, 10), '#1b1b1b', 0, 0.012, -0.42, Math.PI / 2);
    barrel.castShadow = false;
    this.mag = add(B(0.05, 0.16, 0.08), '#3d405b', 0, -0.11, -0.05, -0.2);
    add(B(0.06, 0.08, 0.2), '#2b2d42', 0, -0.02, 0.25); // dipçik
    add(B(0.045, 0.11, 0.05), '#2b2d42', 0, -0.09, 0.1, 0.3); // kabza

    // Eller ve kollar
    add(B(0.08, 0.08, 0.1), '#f1c27d', 0.0, -0.085, 0.11); // sağ el
    add(B(0.085, 0.06, 0.1), '#f1c27d', -0.01, -0.055, -0.24); // sol el
    this.sleeves = [add(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.03, -0.12, 0.27, 0.2)];

    // Namlu ağzı alevi
    this.muzzle = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), transparent: true, depthWrite: false }));
    this.muzzle.position.set(0, 0.012, -0.58);
    this.muzzle.scale.setScalar(0.22);
    this.muzzle.visible = false;
    gun.add(this.muzzle);
    this.flashLight = new THREE.PointLight('#ffd23f', 0, 2);
    this.flashLight.position.copy(this.muzzle.position);
    gun.add(this.flashLight);
  }

  setTeam(team) {
    for (const s of this.sleeves) s.material = toon(TEAM_INFO[team].color);
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  reset(ammo = WEAPON.MAG_SIZE) {
    this.ammo = ammo;
    this.reloading = false;
    this.kick = 0;
    this.lastShot = 0;
  }

  canFire(now) {
    return this.visible && !this.reloading && this.ammo > 0 && now - this.lastShot >= WEAPON.FIRE_INTERVAL;
  }

  fire(now) {
    this.ammo--;
    this.lastShot = now;
    this.kick = 1;
    this.muzzle.visible = true;
    this.muzzle.material.rotation = Math.random() * Math.PI;
    this.muzzle.scale.setScalar(0.18 + Math.random() * 0.1);
    this.flashLight.intensity = 4;
  }

  startReload(now) {
    if (this.reloading || this.ammo >= WEAPON.MAG_SIZE) return false;
    this.reloading = true;
    this.reloadStart = now;
    return true;
  }

  update(dt, now, player, look) {
    if (this.reloading && now - this.reloadStart >= WEAPON.RELOAD_TIME) {
      this.reloading = false;
      this.ammo = WEAPON.MAG_SIZE;
    }
    if (now - this.lastShot > 45) {
      this.muzzle.visible = false;
      this.flashLight.intensity = 0;
    }

    // Yürüme sallantısı
    const amp = player.moving && player.grounded ? (player.running ? 1.6 : 1) : 0;
    this.bobT += dt * (player.running ? 13 : 9) * (amp > 0 ? 1 : 0);
    const bobX = Math.sin(this.bobT) * 0.012 * amp;
    const bobY = -Math.abs(Math.cos(this.bobT)) * 0.012 * amp;

    // Fare ile gecikmeli sallanma
    this.sway.x += (THREE.MathUtils.clamp(-look.dx * 0.0004, -0.04, 0.04) - this.sway.x) * Math.min(1, dt * 10);
    this.sway.y += (THREE.MathUtils.clamp(look.dy * 0.0004, -0.04, 0.04) - this.sway.y) * Math.min(1, dt * 10);

    this.kick = Math.max(0, this.kick - dt * 9);
    this.sprint += ((player.running && !this.reloading ? 1 : 0) - this.sprint) * Math.min(1, dt * 8);

    let reloadDip = 0;
    if (this.reloading) reloadDip = Math.sin(Math.min(1, (now - this.reloadStart) / WEAPON.RELOAD_TIME) * Math.PI);

    const air = player.grounded ? 0 : 0.015;
    this.root.position.set(
      this.base.x + bobX + this.sway.x - this.sprint * 0.06,
      this.base.y + bobY + this.sway.y - reloadDip * 0.12 - this.sprint * 0.04 + air,
      this.base.z + this.kick * 0.06,
    );
    this.root.rotation.set(this.kick * 0.09 - reloadDip * 0.5 - this.sprint * 0.25, this.sprint * 0.5, reloadDip * 0.6);
    this.mag.position.y = -0.11 - reloadDip * 0.12;
  }
}
