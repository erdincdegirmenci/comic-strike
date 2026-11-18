import * as THREE from "three";
import {
  WEAPONS,
  TEAM_INFO,
  DEFAULT_LOADOUT,
  SLOT_OF_CAT,
} from "@comic-strike/shared/constants.js";
import { part, toon } from "../fx/Toon.js";
import { starTexture } from "../fx/Effects.js";

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const SKIN = "#f1c27d";
const DEPLOY_TIME = 260; // ms: silah çekme süresi

/**
 * Birinci şahıs silah görünümü (viewmodel) ve silah durumu.
 * Oyuncunun seçtiği ana silah + tabanca + bomba ve herkeste olan bıçak.
 * HAND CANNON çekilirken parmakta döner. Ayarlardan sol/sağ el seçilebilir.
 * Duvarların içine girmemesi için ayrı bir sahnede, derinlik temizlenerek çizilir.
 */
export class Weapon {
  constructor(aspect) {
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight("#fff4dc", "#56627e", 1.6));
    const light = new THREE.DirectionalLight("#ffffff", 2.2);
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
    this.buildGrenade("he", "#52b788");
    this.buildGrenade("smoke", "#adb5bd");
    this.buildGrenade("poison", "#7cb518");
    this.buildCarbine();
    this.buildSmg();
    this.buildLmg();
    this.buildPopper();
    this.buildCannon();
    this.hand = 1; // 1 sağ el, -1 sol el

    this.flashLight = new THREE.PointLight("#ffd23f", 0, 2);

    this.visible = false;
    this.loadout = { ...DEFAULT_LOADOUT };
    this.current = this.loadout.primary;
    this.previous = "knife";
    this.ammo = {};
    this.reserve = {}; // yedek mermi (şarjör değiştirince buradan alınır)
    this.nades = {};
    this.reloading = false;
    this.reloadStart = 0;
    this.lastShot = 0;
    this.nextFire = 0;
    this.drawStart = 0;
    this.kick = 0;
    this.swing = 0;
    this.heavy = false;
    this.throwT = 0;
    this.charge = 0; // bomba basılı tutma (0..1): kol geriye çekilir
    this.scope = 0; // 0 kapalı, 1-2 dürbün seviyesi
    this.resumeScope = 0;
    this.bobT = 0;
    this.sway = new THREE.Vector2();
    this.sprint = 0;
    this.aiming = false; // sağ tık nişan (AWP dışı ateşli silahlar)
    this.adsT = 0; // nişan geçişi 0..1
    this.reset();
  }

  // ---------------- Modeller ----------------

  /** pivot verilirse silah parçaları o noktanın etrafında dönebilen bir gruba eklenir (tabanca çevirme) */
  model(id, pivot = null) {
    const g = new THREE.Group();
    g.visible = false;
    this.root.add(g);
    const m = { group: g, muzzle: null, mag: null, spin: null };
    if (pivot) {
      m.spin = new THREE.Group();
      m.spin.position.set(...pivot);
      g.add(m.spin);
    }
    const put = (parent, off, geo, color, x, y, z, rx, ry, rz, t) => {
      const mesh = part(geo, color, t);
      mesh.position.set(x - off[0], y - off[1], z - off[2]);
      mesh.rotation.set(rx, ry, rz);
      parent.add(mesh);
      return mesh;
    };
    // add: silah parçası (varsa dönen gruba) · fixed: el/kol (dönmez)
    m.add = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0, t = 0.006) =>
      put(m.spin ?? g, pivot ?? [0, 0, 0], geo, color, x, y, z, rx, ry, rz, t);
    m.fixed = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0, t = 0.006) =>
      put(g, [0, 0, 0], geo, color, x, y, z, rx, ry, rz, t);
    this.models[id] = m;
    return m;
  }

  muzzleFlash(m, z, y = 0.012) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: starTexture(),
        transparent: true,
        depthWrite: false,
      }),
    );
    s.position.set(0, y, z);
    s.scale.setScalar(0.22);
    s.visible = false;
    if (m.spin) s.position.sub(m.spin.position);
    (m.spin ?? m.group).add(s);
    m.muzzle = s;
  }

  buildRifle() {
    const m = this.model("rifle");
    m.add(B(0.07, 0.09, 0.36), "#2b2d42", 0, 0, 0); // gövde
    m.add(B(0.075, 0.07, 0.17), "#ff9f1c", 0, 0, -0.24); // el kundağı
    m.add(B(0.03, 0.035, 0.13), "#ff9f1c", 0, 0.06, -0.02); // nişangah rayı
    m.add(B(0.012, 0.03, 0.012), "#141414", 0, 0.09, -0.07); // arpacık
    m.add(
      new THREE.CylinderGeometry(0.016, 0.016, 0.24, 10),
      "#1b1b1b",
      0,
      0.012,
      -0.42,
      Math.PI / 2,
    );
    m.mag = m.add(B(0.05, 0.16, 0.08), "#3d405b", 0, -0.11, -0.05, -0.2);
    m.add(B(0.06, 0.08, 0.2), "#2b2d42", 0, -0.02, 0.25); // dipçik
    m.add(B(0.045, 0.11, 0.05), "#2b2d42", 0, -0.09, 0.1, 0.3); // kabza
    m.add(B(0.08, 0.08, 0.1), SKIN, 0.0, -0.085, 0.11); // sağ el
    m.add(B(0.085, 0.06, 0.1), SKIN, -0.01, -0.055, -0.24); // sol el
    this.sleeves.push(
      m.add(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.03, -0.12, 0.27, 0.2),
    );
    this.muzzleFlash(m, -0.58);
  }

  buildAwp() {
    const m = this.model("awp");
    const green = "#3a5a40";
    m.add(B(0.075, 0.1, 0.5), green, 0, 0, 0.02); // gövde
    m.add(B(0.07, 0.12, 0.26), green, 0, -0.02, 0.36); // dipçik
    m.add(B(0.07, 0.05, 0.1), "#141414", 0, 0.035, 0.46); // yanak desteği
    m.add(
      new THREE.CylinderGeometry(0.018, 0.022, 0.56, 10),
      "#1b1b1b",
      0,
      0.015,
      -0.5,
      Math.PI / 2,
    ); // uzun namlu
    m.add(
      new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10),
      "#1b1b1b",
      0,
      0.015,
      -0.8,
      Math.PI / 2,
    ); // namlu freni
    // Dürbün
    m.add(
      new THREE.CylinderGeometry(0.03, 0.03, 0.26, 12),
      "#141414",
      0,
      0.1,
      -0.02,
      Math.PI / 2,
    );
    m.add(
      new THREE.CylinderGeometry(0.042, 0.03, 0.06, 12),
      "#141414",
      0,
      0.1,
      -0.17,
      Math.PI / 2,
    );
    m.add(
      new THREE.CylinderGeometry(0.038, 0.03, 0.05, 12),
      "#141414",
      0,
      0.1,
      0.13,
      Math.PI / 2,
    );
    m.add(B(0.02, 0.05, 0.02), "#141414", 0, 0.06, -0.07);
    m.add(B(0.02, 0.05, 0.02), "#141414", 0, 0.06, 0.05);
    m.add(
      new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8),
      "#c0c0c0",
      0.06,
      0.03,
      0.08,
      0,
      0,
      Math.PI / 2,
    ); // kurma kolu
    m.mag = m.add(B(0.05, 0.08, 0.1), "#141414", 0, -0.08, 0.05);
    m.add(B(0.045, 0.11, 0.05), green, 0, -0.1, 0.2, 0.3); // kabza
    m.add(B(0.08, 0.08, 0.1), SKIN, 0.0, -0.095, 0.2);
    m.add(B(0.085, 0.06, 0.1), SKIN, -0.01, -0.06, -0.18);
    this.sleeves.push(
      m.add(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.03, -0.13, 0.36, 0.2),
    );
    this.muzzleFlash(m, -0.9, 0.015);
  }

  buildKnife() {
    const m = this.model("knife");
    m.add(B(0.04, 0.05, 0.14), "#2b2d42", 0, -0.02, 0.06); // sap
    m.add(B(0.07, 0.07, 0.015), "#ff9f1c", 0, -0.02, -0.015); // siper
    m.add(B(0.012, 0.055, 0.26), "#dfe7ef", 0, -0.005, -0.15); // bıçak
    m.add(B(0.013, 0.02, 0.2), "#9aa6b2", 0, 0.025, -0.13); // sırt
    m.add(B(0.08, 0.08, 0.1), SKIN, 0, -0.03, 0.08);
    this.sleeves.push(
      m.add(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.02, -0.06, 0.25, 0.2),
    );
    m.group.position.set(-0.03, 0.07, 0);
  }

  buildGrenade(id, color) {
    const m = this.model(id);
    if (id === "he")
      m.add(new THREE.SphereGeometry(0.055, 12, 10), color, 0, 0.02, -0.02);
    else
      m.add(
        new THREE.CylinderGeometry(0.045, 0.045, 0.13, 12),
        color,
        0,
        0.03,
        -0.02,
      );
    m.add(B(0.02, 0.03, 0.02), "#6c757d", 0, id === "he" ? 0.09 : 0.11, -0.02); // tapa
    m.add(
      new THREE.TorusGeometry(0.018, 0.005, 6, 12),
      "#ffd23f",
      0.025,
      id === "he" ? 0.1 : 0.12,
      -0.02,
      0,
      Math.PI / 2,
    );
    m.add(B(0.09, 0.08, 0.1), SKIN, 0, -0.04, 0.05);
    this.sleeves.push(
      m.add(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.02, -0.07, 0.24, 0.2),
    );
    m.group.position.set(-0.02, 0.06, 0);
  }

  /** Uzun tüfek iskeleti: gövde, namlu, dipçik, eller, kol */
  longGun(m, o) {
    m.add(B(0.07, 0.09, o.body), o.color, 0, 0, 0);
    m.add(
      new THREE.CylinderGeometry(0.015, 0.015, o.barrel, 10),
      "#1b1b1b",
      0,
      0.012,
      -o.body / 2 - o.barrel / 2 + 0.02,
      Math.PI / 2,
    );
    m.add(B(0.045, 0.11, 0.05), o.color, 0, -0.09, 0.1, 0.3); // kabza
    m.fixed(B(0.08, 0.08, 0.1), SKIN, 0, -0.085, 0.11);
    m.fixed(B(0.085, 0.06, 0.1), SKIN, -0.01, -0.055, -0.2);
    this.sleeves.push(
      m.fixed(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.03, -0.12, 0.27, 0.2),
    );
    this.muzzleFlash(m, -o.body / 2 - o.barrel + 0.02);
  }

  buildCarbine() {
    const m = this.model("carbine");
    this.longGun(m, { body: 0.38, barrel: 0.28, color: "#22223b" });
    m.add(B(0.075, 0.07, 0.17), "#4a4e69", 0, 0, -0.25); // el kundağı
    m.add(B(0.02, 0.05, 0.16), "#22223b", 0, 0.075, 0.0); // taşıma kolu
    m.add(B(0.02, 0.03, 0.02), "#22223b", 0, 0.05, -0.08);
    m.add(B(0.02, 0.03, 0.02), "#22223b", 0, 0.05, 0.07);
    m.add(B(0.012, 0.05, 0.012), "#141414", 0, 0.06, -0.31); // arpacık
    m.mag = m.add(B(0.045, 0.15, 0.07), "#2b2d42", 0, -0.11, -0.06, -0.12);
    m.add(B(0.05, 0.09, 0.2), "#4a4e69", 0, -0.02, 0.27); // dipçik
  }

  buildSmg() {
    const m = this.model("smg");
    this.longGun(m, { body: 0.3, barrel: 0.1, color: "#353535" });
    m.add(B(0.07, 0.06, 0.14), "#4f5d75", 0, -0.005, -0.18); // ön kundak
    m.mag = m.add(B(0.035, 0.18, 0.05), "#141414", 0, -0.12, -0.11, -0.3); // eğik şarjör
    m.add(B(0.015, 0.015, 0.2), "#555", 0, 0.0, 0.25); // tel dipçik
    m.add(B(0.015, 0.07, 0.015), "#555", 0, -0.03, 0.34);
    m.add(B(0.012, 0.04, 0.012), "#141414", 0, 0.06, -0.15);
    m.add(B(0.03, 0.03, 0.05), "#141414", 0, 0.06, 0.1);
  }

  buildLmg() {
    const m = this.model("lmg");
    this.longGun(m, { body: 0.46, barrel: 0.32, color: "#2b2d42" });
    m.add(B(0.085, 0.05, 0.36), "#3d405b", 0, 0.065, -0.02); // üst kapak
    m.add(B(0.09, 0.09, 0.18), "#4a4e69", 0, -0.005, -0.3); // ön kundak
    m.mag = m.add(B(0.1, 0.14, 0.13), "#5c6b3a", 0.02, -0.12, -0.06); // mermi kutusu
    for (let i = 0; i < 5; i++) {
      m.add(
        new THREE.CylinderGeometry(0.009, 0.009, 0.05, 6),
        "#ffbe0b",
        0.06,
        -0.06 + i * 0.022,
        -0.06 - i * 0.012,
        0,
        0,
        Math.PI / 2,
        0.003,
      );
    }
    m.add(B(0.06, 0.1, 0.2), "#2b2d42", 0, -0.02, 0.32); // dipçik
    m.add(B(0.012, 0.16, 0.012), "#555", 0.03, -0.09, -0.48, 0.5); // çatal ayak
    m.add(B(0.012, 0.16, 0.012), "#555", -0.03, -0.09, -0.48, 0.5);
    m.add(B(0.02, 0.05, 0.02), "#141414", 0, 0.11, -0.12);
  }

  /** Tabanca: el sabit, silah tetik noktası etrafında döner */
  pistol(id, o) {
    const m = this.model(id, [0, -0.03, 0.04]);
    m.add(B(0.05, 0.05, o.len), o.slide, 0, 0.02, -o.len / 2 + 0.06); // sürgü
    m.add(B(0.045, 0.035, o.len - 0.04), o.frame, 0, -0.02, -o.len / 2 + 0.07); // gövde
    m.add(B(0.042, 0.11, 0.055), o.grip, 0, -0.08, 0.06, 0.25); // kabza
    m.add(B(0.012, 0.025, 0.012), "#141414", 0, 0.055, -o.len + 0.08); // arpacık
    m.add(B(0.03, 0.02, 0.015), "#141414", 0, 0.05, 0.05); // gez
    m.add(B(0.006, 0.03, 0.03), "#141414", 0, -0.035, 0.01); // tetik
    if (o.port) m.add(B(0.052, 0.02, 0.06), "#141414", 0, 0.04, -0.05); // kovan çıkışı
    m.mag = m.add(B(0.036, 0.04, 0.045), "#141414", 0, -0.14, 0.075, 0.25);
    m.fixed(B(0.075, 0.08, 0.09), SKIN, 0, -0.075, 0.08);
    m.fixed(B(0.06, 0.06, 0.08), SKIN, -0.045, -0.09, 0.05); // destek eli
    this.sleeves.push(
      m.fixed(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.02, -0.11, 0.26, 0.25),
    );
    this.muzzleFlash(m, -o.len + 0.03, 0.02);
    m.group.position.set(-0.09, 0.14, -0.04);
    return m;
  }

  buildPopper() {
    this.pistol("popper", {
      len: 0.2,
      slide: "#3d405b",
      frame: "#2b2d42",
      grip: "#5a3a22",
    });
  }

  buildCannon() {
    const m = this.pistol("cannon", {
      len: 0.28,
      slide: "#c0c6cf",
      frame: "#9aa1ab",
      grip: "#2b2d42",
      port: true,
    });
    m.add(B(0.056, 0.03, 0.2), "#dfe7ef", 0, 0.05, -0.12); // geniş üst rampa
  }

  show(id) {
    for (const [k, m] of Object.entries(this.models))
      m.group.visible = k === id;
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

  /** Eldeki silahlar, yuva sırasıyla */
  get owned() {
    const l = this.loadout;
    return [l.primary, l.pistol, "knife", l.nade];
  }

  slotWeapon(slot) {
    return this.owned.find((id) => SLOT_OF_CAT[WEAPONS[id].cat] === slot);
  }

  setHand(h) {
    this.hand = h === "left" ? -1 : 1;
  }

  /** HUD için: elindeki silahın yedek mermisi (silah değilse null) */
  get reserveCount() {
    return this.def.kind === "gun" ? (this.reserve[this.current] ?? 0) : null;
  }

  /** Elindeki silahın hem şarjörü hem yedeği bitti mi */
  get dry() {
    return (
      this.def.kind === "gun" &&
      !(this.ammo[this.current] > 0) &&
      !(this.reserve[this.current] > 0)
    );
  }

  /** HUD için: elindeki silahın mermisi / bomba sayısı (bıçakta null) */
  get count() {
    if (this.def.kind === "gun") return this.ammo[this.current];
    if (this.def.kind === "grenade") return this.nades[this.current];
    return null;
  }

  has(id) {
    if (!WEAPONS[id] || !this.owned.includes(id)) return false;
    return WEAPONS[id].kind !== "grenade" || this.nades[id] > 0;
  }

  /** Doğuşta / silah seçimi uygulanınca: sunucunun verdiği mermi ve bombalarla */
  reset(ammo, nades, loadout, reserve) {
    if (loadout) this.loadout = { ...loadout };
    const l = this.loadout;
    this.ammo = {
      [l.primary]: ammo?.[l.primary] ?? WEAPONS[l.primary].MAG_SIZE,
      [l.pistol]: ammo?.[l.pistol] ?? WEAPONS[l.pistol].MAG_SIZE,
    };
    this.reserve = {
      [l.primary]: reserve?.[l.primary] ?? WEAPONS[l.primary].RESERVE ?? 0,
      [l.pistol]: reserve?.[l.pistol] ?? WEAPONS[l.pistol].RESERVE ?? 0,
    };
    this.nades = { [l.nade]: nades?.[l.nade] ?? WEAPONS[l.nade].COUNT };
    this.reloading = false;
    this.kick = 0;
    this.swing = 0;
    this.throwT = 0;
    this.lastShot = 0;
    this.nextFire = 0;
    this.scope = 0;
    this.resumeScope = 0;
    this.aiming = false;
    this.adsT = 0;
    this.current = l.primary;
    this.previous = l.pistol;
    this.drawStart = performance.now();
    this.show(this.current);
  }

  /** Silah değiştir. Değiştiyse true döner. */
  switchTo(id, now) {
    if (id === this.current || !WEAPONS[id] || !this.has(id)) return false;
    this.previous = this.current;
    this.current = id;
    this.reloading = false;
    this.scope = 0;
    this.resumeScope = 0;
    this.aiming = false;
    this.throwT = 0;
    this.swing = 0;
    this.drawStart = now;
    this.nextFire = Math.max(
      this.nextFire,
      now + (WEAPONS[id].DEPLOY ?? DEPLOY_TIME),
    );
    this.show(id);
    return true;
  }

  /** Tekerlek ile sıradaki/önceki silah */
  cycle(dir) {
    const list = this.owned;
    let i = list.indexOf(this.current);
    for (let n = 0; n < list.length; n++) {
      i = (i + dir + list.length) % list.length;
      if (this.has(list[i])) return list[i];
    }
    return this.current;
  }

  canFire(now) {
    if (!this.visible || this.reloading || now < this.nextFire) return false;
    const d = this.def;
    if (d.kind === "gun") return this.ammo[this.current] > 0;
    if (d.kind === "grenade") return this.nades[this.current] > 0;
    return true;
  }

  /** Bu silahın viewmodel'inde sağ/sol (ateş izi başlangıcı için) */
  get side() {
    return this.hand;
  }

  fire(now, heavy = false) {
    const d = this.def;
    this.lastShot = now;
    this.nextFire = now + (heavy ? d.HEAVY_INTERVAL : d.FIRE_INTERVAL);
    if (d.kind === "melee") {
      this.swing = 1;
      this.heavy = heavy;
      return;
    }
    this.ammo[this.current]--;
    this.kick =
      this.current === "awp" ? 1.6 : this.current === "cannon" ? 1.8 : 1;
    if (this.current === "awp" && this.scope > 0) {
      // Atıştan sonra dürbün kapanır, kurma bitince geri açılır
      this.resumeScope = this.ammo.awp > 0 ? this.scope : 0;
      this.scope = 0;
    }
    const m = this.models[this.current];
    m.muzzle.visible = true;
    m.muzzle.material.rotation = Math.random() * Math.PI;
    m.muzzle.scale.setScalar(
      (this.current === "awp" || this.current === "cannon" ? 0.3 : 0.18) +
        Math.random() * 0.1,
    );
    this.flashLight.intensity = 4;
  }

  throwNade(now) {
    this.nades[this.current]--;
    this.lastShot = now;
    this.nextFire = now + this.def.FIRE_INTERVAL;
    this.throwT = 1;
  }

  /** Bu silahla sağ tık nişan alınabilir mi (AWP'nin kendi dürbünü var) */
  get canAim() {
    return this.def.kind === "gun" && this.current !== "awp";
  }

  /** Dürbün seviyesini değiştir (sadece AWP) */
  toggleScope() {
    if (this.current !== "awp" || this.reloading) return;
    this.resumeScope = 0;
    this.scope = (this.scope + 1) % (this.def.ZOOM_FOV.length + 1);
  }

  startReload(now) {
    const d = this.def;
    if (
      d.kind !== "gun" ||
      this.reloading ||
      this.ammo[this.current] >= d.MAG_SIZE ||
      !(this.reserve[this.current] > 0)
    )
      return false;
    this.reloading = true;
    this.reloadStart = now;
    this.scope = 0;
    this.resumeScope = 0;
    return true;
  }

  update(dt, now, player, look) {
    const d = this.def;
    if (this.reloading && now - this.reloadStart >= d.RELOAD_TIME) {
      // Tahmin: yedekten şarjöre aktar (sunucunun AMMO mesajı kesin değeri getirir)
      this.reloading = false;
      const take = Math.max(
        0,
        Math.min(
          d.MAG_SIZE - this.ammo[this.current],
          this.reserve[this.current] ?? 0,
        ),
      );
      this.ammo[this.current] += take;
      this.reserve[this.current] = (this.reserve[this.current] ?? 0) - take;
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
    const amp =
      player.moving && player.onGround ? (player.running ? 1.6 : 1) : 0;
    this.bobT += dt * (player.running ? 13 : 9) * (amp > 0 ? 1 : 0);
    const bobX = Math.sin(this.bobT) * 0.012 * amp;
    const bobY = -Math.abs(Math.cos(this.bobT)) * 0.012 * amp;

    // Fare ile gecikmeli sallanma
    this.sway.x +=
      (THREE.MathUtils.clamp(-look.dx * 0.0004, -0.04, 0.04) - this.sway.x) *
      Math.min(1, dt * 10);
    this.sway.y +=
      (THREE.MathUtils.clamp(look.dy * 0.0004, -0.04, 0.04) - this.sway.y) *
      Math.min(1, dt * 10);

    this.kick = Math.max(0, this.kick - dt * (this.current === "awp" ? 4 : 9));
    this.swing = Math.max(0, this.swing - dt * (this.heavy ? 2.4 : 4.5));
    this.throwT = Math.max(0, this.throwT - dt * 3);
    this.sprint +=
      ((player.running && !this.reloading ? 1 : 0) - this.sprint) *
      Math.min(1, dt * 8);

    let reloadDip = 0;
    if (this.reloading)
      reloadDip = Math.sin(
        Math.min(1, (now - this.reloadStart) / d.RELOAD_TIME) * Math.PI,
      );
    const deploy = d.DEPLOY ?? DEPLOY_TIME;
    const drawK = Math.min(1, (now - this.drawStart) / deploy);
    // Çevirmeli tabanca aşağıdan gelmez, yerinde parmakta döner
    const draw = d.TWIRL ? Math.max(0, 1 - drawK * 4) * 0.4 : 1 - drawK;
    if (m.spin) {
      // Tetik etrafında 1 tam tur (yavaşlayarak durur)
      const e = 1 - (1 - drawK) ** 3;
      m.spin.rotation.x = d.TWIRL && drawK < 1 ? -Math.PI * 2 * e : 0;
    }

    // Bıçak savuruşu: sağdan sola kesik; ağır saldırıda ileri saplama
    const sw = Math.sin(this.swing * Math.PI);
    const swingX = this.heavy ? 0 : -sw * 0.12;
    const swingZ = this.heavy ? -sw * 0.14 : -sw * 0.05;
    const swingRotY = this.heavy ? 0 : sw * 0.9;
    const swingRotX = this.heavy ? -sw * 0.3 : 0;
    // Bomba fırlatma
    const th = Math.sin(this.throwT * Math.PI) - this.charge * 0.8; // şarjda kol geride, atınca ileri
    // Son bomba elden çıktıktan sonra el boş kalır (ardından önceki silaha geçilir)
    m.group.visible = !(
      this.def.kind === "grenade" &&
      this.nades[this.current] <= 0 &&
      this.throwT < 0.6
    );

    const air = player.onGround ? 0 : 0.015;
    const h = this.hand;
    // Nişan: silah ekranın ortasına, gez-arpacık hizasına gelir; sallantı azalır
    this.adsT +=
      ((this.aiming && !this.reloading ? 1 : 0) - this.adsT) *
      Math.min(1, dt * 14);
    const a = this.adsT;
    const calm = 1 - 0.8 * a;
    const pistol = d.cat === "pistol";
    const adsX = pistol ? 0.072 : 0; // tabanca modeli el içinde biraz solda duruyor
    const adsY = pistol ? -0.158 : -0.08;
    const adsZ = pistol ? -0.4 : -0.34;
    const hipX =
      (this.base.x + bobX - this.sprint * 0.06 + swingX) * h + this.sway.x;
    const hipY =
      this.base.y +
      bobY +
      this.sway.y -
      reloadDip * 0.12 -
      this.sprint * 0.04 +
      air -
      draw * 0.25 +
      th * 0.08;
    this.root.position.set(
      hipX + (adsX + (bobX * 0.2 + this.sway.x * 0.3) - hipX) * a,
      hipY + (adsY + (bobY * 0.2 + this.sway.y * 0.3) - draw * 0.25 - hipY) * a,
      this.base.z +
        this.kick * 0.06 * calm +
        swingZ -
        th * 0.15 +
        (adsZ - this.base.z) * a,
    );
    this.root.rotation.set(
      this.kick * 0.09 * calm -
        reloadDip * 0.5 -
        this.sprint * 0.25 +
        swingRotX -
        draw * 0.6 -
        th * 0.6,
      (this.sprint * 0.5 + swingRotY) * h * (1 - a),
      reloadDip * 0.6 * h,
    );
    if (m.mag) {
      if (m.magY === undefined) m.magY = m.mag.position.y;
      m.mag.position.y = m.magY - reloadDip * 0.12;
    }
  }
}
