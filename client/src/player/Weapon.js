import * as THREE from 'three';
import { WEAPONS, WEAPON_ORDER, TEAM_INFO } from '@comic-strike/shared/constants.js';
import { part, toon } from '../fx/Toon.js';
import { starTexture } from '../fx/Effects.js';

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const SKIN = '#f1c27d';
const DEPLOY_TIME = 260; // ms: silah çekme süresi

/**
 * Birinci şahıs silah görünümü (viewmodel) ve silah durumu.
 * Silahlar: INK-47 (otomatik), AWP (dürbünlü, tek atış), bıçak, patlayıcı ve sis bombası.
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

    this.sleeves = [];
    this.models = {};
    this.buildRifle();
    this.buildAwp();
    this.buildKnife();
    this.buildGrenade('he', '#52b788');
    this.buildGrenade('smoke', '#adb5bd');

    this.flashLight = new THREE.PointLight('#ffd23f', 0, 2);

    this.visible = false;
    this.current = 'rifle';
    this.previous = 'knife';
    this.ammo = { rifle: WEAPONS.rifle.MAG_SIZE, awp: WEAPONS.awp.MAG_SIZE };
    this.nades = { he: WEAPONS.he.COUNT, smoke: WEAPONS.smoke.COUNT };
    this.reloading = false;
    this.reloadStart = 0;
    this.lastShot = 0;
    this.nextFire = 0;
    this.drawStart = 0;
    this.kick = 0;
    this.swing = 0;
    this.heavy = false;
    this.throwT = 0;
    this.scope = 0; // 0 kapalı, 1-2 dürbün seviyesi
    this.resumeScope = 0;
    this.bobT = 0;
    this.sway = new THREE.Vector2();
    this.sprint = 0;
    this.show('rifle');
  }

  // ---------------- Modeller ----------------

  model(id) {
    const g = new THREE.Group();
    g.visible = false;
    this.root.add(g);
    const m = { group: g, muzzle: null, mag: null };
    m.add = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0, t = 0.006) => {
      const mesh = part(geo, color, t);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      g.add(mesh);
      return mesh;
    };
    this.models[id] = m;
    return m;
  }

  muzzleFlash(m, z, y = 0.012) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), transparent: true, depthWrite: false }));
    s.position.set(0, y, z);
    s.scale.setScalar(0.22);
    s.visible = false;
    m.group.add(s);
    m.muzzle = s;
  }

  buildRifle() {
    const m = this.model('rifle');
    m.add(B(0.07, 0.09, 0.36), '#2b2d42', 0, 0, 0); // gövde
    m.add(B(0.075, 0.07, 0.17), '#ff9f1c', 0, 0, -0.24); // el kundağı
    m.add(B(0.03, 0.035, 0.13), '#ff9f1c', 0, 0.06, -0.02); // nişangah rayı
    m.add(B(0.012, 0.03, 0.012), '#141414', 0, 0.09, -0.07); // arpacık
    m.add(new THREE.CylinderGeometry(0.016, 0.016, 0.24, 10), '#1b1b1b', 0, 0.012, -0.42, Math.PI / 2);
    m.mag = m.add(B(0.05, 0.16, 0.08), '#3d405b', 0, -0.11, -0.05, -0.2);
    m.add(B(0.06, 0.08, 0.2), '#2b2d42', 0, -0.02, 0.25); // dipçik
    m.add(B(0.045, 0.11, 0.05), '#2b2d42', 0, -0.09, 0.1, 0.3); // kabza
    m.add(B(0.08, 0.08, 0.1), SKIN, 0.0, -0.085, 0.11); // sağ el
    m.add(B(0.085, 0.06, 0.1), SKIN, -0.01, -0.055, -0.24); // sol el
    this.sleeves.push(m.add(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.03, -0.12, 0.27, 0.2));
    this.muzzleFlash(m, -0.58);
  }

  buildAwp() {
    const m = this.model('awp');
    const green = '#3a5a40';
    m.add(B(0.075, 0.1, 0.5), green, 0, 0, 0.02); // gövde
    m.add(B(0.07, 0.12, 0.26), green, 0, -0.02, 0.36); // dipçik
    m.add(B(0.07, 0.05, 0.1), '#141414', 0, 0.035, 0.46); // yanak desteği
    m.add(new THREE.CylinderGeometry(0.018, 0.022, 0.56, 10), '#1b1b1b', 0, 0.015, -0.5, Math.PI / 2); // uzun namlu
    m.add(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10), '#1b1b1b', 0, 0.015, -0.8, Math.PI / 2); // namlu freni
    // Dürbün
    m.add(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 12), '#141414', 0, 0.1, -0.02, Math.PI / 2);
    m.add(new THREE.CylinderGeometry(0.042, 0.03, 0.06, 12), '#141414', 0, 0.1, -0.17, Math.PI / 2);
    m.add(new THREE.CylinderGeometry(0.038, 0.03, 0.05, 12), '#141414', 0, 0.1, 0.13, Math.PI / 2);
    m.add(B(0.02, 0.05, 0.02), '#141414', 0, 0.06, -0.07);
    m.add(B(0.02, 0.05, 0.02), '#141414', 0, 0.06, 0.05);
    m.add(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8), '#c0c0c0', 0.06, 0.03, 0.08, 0, 0, Math.PI / 2); // kurma kolu
    m.mag = m.add(B(0.05, 0.08, 0.1), '#141414', 0, -0.08, 0.05);
    m.add(B(0.045, 0.11, 0.05), green, 0, -0.1, 0.2, 0.3); // kabza
    m.add(B(0.08, 0.08, 0.1), SKIN, 0.0, -0.095, 0.2);
    m.add(B(0.085, 0.06, 0.1), SKIN, -0.01, -0.06, -0.18);
    this.sleeves.push(m.add(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.03, -0.13, 0.36, 0.2));
    this.muzzleFlash(m, -0.9, 0.015);
  }

  buildKnife() {
    const m = this.model('knife');
    m.add(B(0.04, 0.05, 0.14), '#2b2d42', 0, -0.02, 0.06); // sap
    m.add(B(0.07, 0.07, 0.015), '#ff9f1c', 0, -0.02, -0.015); // siper
    m.add(B(0.012, 0.055, 0.26), '#dfe7ef', 0, -0.005, -0.15); // bıçak
    m.add(B(0.013, 0.02, 0.2), '#9aa6b2', 0, 0.025, -0.13); // sırt
    m.add(B(0.08, 0.08, 0.1), SKIN, 0, -0.03, 0.08);
    this.sleeves.push(m.add(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.02, -0.06, 0.25, 0.2));
    m.group.position.set(-0.03, 0.07, 0);
  }

  buildGrenade(id, color) {
    const m = this.model(id);
    if (id === 'he') m.add(new THREE.SphereGeometry(0.055, 12, 10), color, 0, 0.02, -0.02);
    else m.add(new THREE.CylinderGeometry(0.045, 0.045, 0.13, 12), color, 0, 0.03, -0.02);
    m.add(B(0.02, 0.03, 0.02), '#6c757d', 0, id === 'he' ? 0.09 : 0.11, -0.02); // tapa
    m.add(new THREE.TorusGeometry(0.018, 0.005, 6, 12), '#ffd23f', 0.025, id === 'he' ? 0.1 : 0.12, -0.02, 0, Math.PI / 2);
    m.add(B(0.09, 0.08, 0.1), SKIN, 0, -0.04, 0.05);
    this.sleeves.push(m.add(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.02, -0.07, 0.24, 0.2));
    m.group.position.set(-0.02, 0.06, 0);
  }

  show(id) {
    for (const [k, m] of Object.entries(this.models)) m.group.visible = k === id;
    const m = this.models[id];
    if (m.muzzle) {
      m.group.add(this.flashLight);
      this.flashLight.position.copy(m.muzzle.position);
    }
  }

  setTeam(team) {
    for (const s of this.sleeves) s.material = toon(TEAM_INFO[team].color);
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  // ---------------- Durum ----------------

  get def() {
    return WEAPONS[this.current];
  }

  /** HUD için: elindeki silahın mermisi / bomba sayısı (bıçakta null) */
  get count() {
    if (this.def.kind === 'gun') return this.ammo[this.current];
    if (this.def.kind === 'grenade') return this.nades[this.current];
    return null;
  }

  has(id) {
    return WEAPONS[id].kind !== 'grenade' || this.nades[id] > 0;
  }

  reset(ammo, nades) {
    this.ammo = { rifle: ammo?.rifle ?? WEAPONS.rifle.MAG_SIZE, awp: ammo?.awp ?? WEAPONS.awp.MAG_SIZE };
    this.nades = { he: nades?.he ?? WEAPONS.he.COUNT, smoke: nades?.smoke ?? WEAPONS.smoke.COUNT };
    this.reloading = false;
    this.kick = 0;
    this.swing = 0;
    this.throwT = 0;
    this.lastShot = 0;
    this.nextFire = 0;
    this.scope = 0;
    this.resumeScope = 0;
    this.current = 'rifle';
    this.previous = 'knife';
    this.drawStart = performance.now();
    this.show('rifle');
  }

  /** Silah değiştir. Değiştiyse true döner. */
  switchTo(id, now) {
    if (id === this.current || !WEAPONS[id] || !this.has(id)) return false;
    this.previous = this.current;
    this.current = id;
    this.reloading = false;
    this.scope = 0;
    this.resumeScope = 0;
    this.throwT = 0;
    this.swing = 0;
    this.drawStart = now;
    this.nextFire = Math.max(this.nextFire, now + DEPLOY_TIME);
    this.show(id);
    return true;
  }

  /** Tekerlek ile sıradaki/önceki silah */
  cycle(dir) {
    let i = WEAPON_ORDER.indexOf(this.current);
    for (let n = 0; n < WEAPON_ORDER.length; n++) {
      i = (i + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length;
      if (this.has(WEAPON_ORDER[i])) return WEAPON_ORDER[i];
    }
    return this.current;
  }

  canFire(now) {
    if (!this.visible || this.reloading || now < this.nextFire) return false;
    const d = this.def;
    if (d.kind === 'gun') return this.ammo[this.current] > 0;
    if (d.kind === 'grenade') return this.nades[this.current] > 0;
    return true;
  }

  fire(now, heavy = false) {
    const d = this.def;
    this.lastShot = now;
    this.nextFire = now + (heavy ? d.HEAVY_INTERVAL : d.FIRE_INTERVAL);
    if (d.kind === 'melee') {
      this.swing = 1;
      this.heavy = heavy;
      return;
    }
    this.ammo[this.current]--;
    this.kick = this.current === 'awp' ? 1.6 : 1;
    if (this.current === 'awp' && this.scope > 0) {
      // Atıştan sonra dürbün kapanır, kurma bitince geri açılır
      this.resumeScope = this.ammo.awp > 0 ? this.scope : 0;
      this.scope = 0;
    }
    const m = this.models[this.current];
    m.muzzle.visible = true;
    m.muzzle.material.rotation = Math.random() * Math.PI;
    m.muzzle.scale.setScalar((this.current === 'awp' ? 0.3 : 0.18) + Math.random() * 0.1);
    this.flashLight.intensity = 4;
  }

  throwNade(now) {
    this.nades[this.current]--;
    this.lastShot = now;
    this.nextFire = now + this.def.FIRE_INTERVAL;
    this.throwT = 1;
  }

  /** Dürbün seviyesini değiştir (sadece AWP) */
  toggleScope() {
    if (this.current !== 'awp' || this.reloading) return;
    this.resumeScope = 0;
    this.scope = (this.scope + 1) % (this.def.ZOOM_FOV.length + 1);
  }

  startReload(now) {
    const d = this.def;
    if (d.kind !== 'gun' || this.reloading || this.ammo[this.current] >= d.MAG_SIZE) return false;
    this.reloading = true;
    this.reloadStart = now;
    this.scope = 0;
    this.resumeScope = 0;
    return true;
  }

  update(dt, now, player, look) {
    const d = this.def;
    if (this.reloading && now - this.reloadStart >= d.RELOAD_TIME) {
      this.reloading = false;
      this.ammo[this.current] = d.MAG_SIZE;
    }
    if (this.resumeScope && now >= this.nextFire) {
      this.scope = this.resumeScope;
      this.resumeScope = 0;
    }
    const m = this.models[this.current];
    if (m.muzzle && now - this.lastShot > 45) m.muzzle.visible = false;
    if (now - this.lastShot > 45) this.flashLight.intensity = 0;

    // Dürbün açıkken silah görünmez (ekranda dürbün maskesi var)
    this.root.visible = this.scope === 0;

    // Yürüme sallantısı
    const amp = player.moving && player.grounded ? (player.running ? 1.6 : 1) : 0;
    this.bobT += dt * (player.running ? 13 : 9) * (amp > 0 ? 1 : 0);
    const bobX = Math.sin(this.bobT) * 0.012 * amp;
    const bobY = -Math.abs(Math.cos(this.bobT)) * 0.012 * amp;

    // Fare ile gecikmeli sallanma
    this.sway.x += (THREE.MathUtils.clamp(-look.dx * 0.0004, -0.04, 0.04) - this.sway.x) * Math.min(1, dt * 10);
    this.sway.y += (THREE.MathUtils.clamp(look.dy * 0.0004, -0.04, 0.04) - this.sway.y) * Math.min(1, dt * 10);

    this.kick = Math.max(0, this.kick - dt * (this.current === 'awp' ? 4 : 9));
    this.swing = Math.max(0, this.swing - dt * (this.heavy ? 2.4 : 4.5));
    this.throwT = Math.max(0, this.throwT - dt * 3);
    this.sprint += ((player.running && !this.reloading ? 1 : 0) - this.sprint) * Math.min(1, dt * 8);

    let reloadDip = 0;
    if (this.reloading) reloadDip = Math.sin(Math.min(1, (now - this.reloadStart) / d.RELOAD_TIME) * Math.PI);
    const draw = 1 - Math.min(1, (now - this.drawStart) / DEPLOY_TIME); // silah çekilirken aşağıdan gelir

    // Bıçak savuruşu: sağdan sola kesik; ağır saldırıda ileri saplama
    const sw = Math.sin(this.swing * Math.PI);
    const swingX = this.heavy ? 0 : -sw * 0.12;
    const swingZ = this.heavy ? -sw * 0.14 : -sw * 0.05;
    const swingRotY = this.heavy ? 0 : sw * 0.9;
    const swingRotX = this.heavy ? -sw * 0.3 : 0;
    // Bomba fırlatma
    const th = Math.sin(this.throwT * Math.PI);
    // Son bomba elden çıktıktan sonra el boş kalır (ardından önceki silaha geçilir)
    m.group.visible = !(this.def.kind === 'grenade' && this.nades[this.current] <= 0 && this.throwT < 0.6);

    const air = player.grounded ? 0 : 0.015;
    this.root.position.set(
      this.base.x + bobX + this.sway.x - this.sprint * 0.06 + swingX,
      this.base.y + bobY + this.sway.y - reloadDip * 0.12 - this.sprint * 0.04 + air - draw * 0.25 + th * 0.08,
      this.base.z + this.kick * 0.06 + swingZ - th * 0.15,
    );
    this.root.rotation.set(
      this.kick * 0.09 - reloadDip * 0.5 - this.sprint * 0.25 + swingRotX - draw * 0.6 - th * 0.6,
      this.sprint * 0.5 + swingRotY,
      reloadDip * 0.6,
    );
    if (m.mag) m.mag.position.y = (this.current === 'awp' ? -0.08 : -0.11) - reloadDip * 0.12;
  }
}
