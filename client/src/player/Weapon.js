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
const QUICK_DEPLOY = 0.65; // Q ile hızlı geçişte çekme süresi çarpanı

// Şarjör değiştirme animasyonunun evreleri (reload süresinin oranı olarak)
const RL = {
  HAND_OFF: 0.08, // destek eli kundaktan ayrılır
  OUT_START: 0.1, // eski şarjör yuvadan kayar
  OUT_END: 0.22,
  DROP_END: 0.42, // eski şarjör düşüp kaybolur
  NEW_START: 0.3, // yeni şarjör elde aşağıdan gelir
  NEW_ALIGN: 0.58, // yuvanın hemen altında hizalanır
  INSERT: 0.7, // yuvaya oturur ("klik" + silah sarsılır)
  HAND_BACK: 0.84, // el kundağa döner
};
const smooth = (a, b, t) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const _down = new THREE.Vector3();

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
    this.buildMine();
    this.buildMolotov();
    this.buildRevolver();
    this.buildShotgun();
    this.buildBazooka();
    this.buildCarbine();
    this.buildSmg();
    this.buildLmg();
    this.buildPopper();
    this.buildCannon();
    this.buildSprayer("flamer", { body: "#5a3a22", tank: "#c4493d", nozzle: "#2b2b2b", tip: "#ff9f1c" });
    this.buildSprayer("freezer", { body: "#3e6c9c", tank: "#a8e6ff", nozzle: "#dfe7ef", tip: "#e8fbff" });
    this.buildGrenade("flash", "#e9ecef");
    this.buildGrenade("frost", "#7fd3f5");
    this.computeAdsHeights();
    this.hand = 1; // 1 sağ el, -1 sol el

    this.flashLight = new THREE.PointLight("#ffd23f", 0, 2);

    this.visible = false;
    this.loadout = { ...DEFAULT_LOADOUT };
    this.current = this.loadout.primary;
    this.previous = "knife";
    this.history = []; // son seçilen silahlar (en yeni başta): Q bu ikisi arasında geçiş yapar
    this.onReloadStep = null; // şarjör çıktı / takıldı anlarında çağrılır (ses)
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
      const mesh = part(geo, color, t, "view");
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
    m.support = m.add(B(0.085, 0.06, 0.1), SKIN, -0.01, -0.055, -0.24); // sol el
    this.sleeves.push(
      m.add(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.03, -0.12, 0.27, 0.2),
    );
    this.muzzleFlash(m, -0.58);
    this.reloadRig(m);
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
    m.support = m.add(B(0.085, 0.06, 0.1), SKIN, -0.01, -0.06, -0.18);
    this.sleeves.push(
      m.add(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.03, -0.13, 0.36, 0.2),
    );
    this.muzzleFlash(m, -0.9, 0.015);
    this.reloadRig(m);
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

  /**
   * Her ateşli silah için nişan (ADS) yüksekliği: modelin tüm köşeleri ekranın ortasındaki
   * artı işaretinin en az ADS_MARGIN (oran, ~3°) altında kalacak şekilde silahın ne kadar
   * aşağıda durması gerektiğini hesaplar. Modeller dururken bir kez çalışır.
   */
  computeAdsHeights() {
    this.adsY = {};
    const s = this.root.scale.y;
    const v = new THREE.Vector3();
    const mat = new THREE.Matrix4();
    for (const [id, m] of Object.entries(this.models)) {
      const w = WEAPONS[id];
      if (!w || w.kind !== "gun" || w.ZOOM_FOV) continue; // AWP dürbün kullanır
      const adsZ = w.cat === "pistol" ? Weapon.ADS_Z_PISTOL : Weapon.ADS_Z;
      let best = Infinity;
      m.group.traverse((o) => {
        if (!o.isMesh || !o.geometry?.attributes?.position) return;
        mat.identity();
        for (let p = o; p && p !== this.root; p = p.parent) {
          p.updateMatrix();
          mat.premultiply(p.matrix);
        }
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(mat);
          const depth = adsZ + v.z * s; // kameradan uzaklık (negatif)
          if (depth > -0.02) continue; // kameranın hemen dibindeki kol/el parçaları
          best = Math.min(best, Weapon.ADS_MARGIN * depth - v.y * s);
        }
      });
      if (Number.isFinite(best)) this.adsY[id] = best;
    }
  }

  /** Mayın: yassı disk, üstünde kırmızı lamba ve basınç düğmesi */
  buildMine() {
    const m = this.model("mine");
    m.add(new THREE.CylinderGeometry(0.075, 0.085, 0.035, 16), "#4a4e3a", 0, 0.02, -0.03);
    m.add(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), "#2b2d22", 0, 0.045, -0.03);
    m.add(new THREE.SphereGeometry(0.012, 8, 6), "#ff2b2b", 0.045, 0.042, -0.03);
    m.add(B(0.09, 0.08, 0.1), SKIN, 0, -0.04, 0.05);
    this.sleeves.push(
      m.add(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.02, -0.07, 0.24, 0.2),
    );
    m.group.position.set(-0.02, 0.06, 0);
  }

  /** Molotof: kahverengi şişe, ağzında yanan bez */
  buildMolotov() {
    const m = this.model("molotov");
    m.add(new THREE.CylinderGeometry(0.035, 0.04, 0.11, 12), "#9c6644", 0, 0.02, -0.02);
    m.add(new THREE.CylinderGeometry(0.014, 0.02, 0.06, 10), "#8a5a3b", 0, 0.1, -0.02);
    m.add(B(0.028, 0.045, 0.028), "#efe6d2", 0, 0.145, -0.02, 0, 0, 0.3); // bez
    m.add(B(0.03, 0.03, 0.03), "#ff9f1c", 0.005, 0.18, -0.02, 0.4, 0.3, 0.6); // alev
    m.add(B(0.09, 0.08, 0.1), SKIN, 0, -0.04, 0.05);
    this.sleeves.push(
      m.add(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.02, -0.07, 0.24, 0.2),
    );
    m.group.position.set(-0.02, 0.04, 0);
  }

  /** Kovboy tabancası: uzun namlu, döner silindir, ahşap kabza; çekilirken parmakta döner */
  buildRevolver() {
    const m = this.model("revolver", [0, -0.03, 0.04]);
    m.add(new THREE.CylinderGeometry(0.013, 0.013, 0.24, 10), "#9aa1ab", 0, 0.03, -0.17, Math.PI / 2); // namlu
    m.add(B(0.024, 0.014, 0.22), "#7d838c", 0, 0.012, -0.16); // namlu altı
    m.add(new THREE.CylinderGeometry(0.032, 0.032, 0.065, 6), "#7d838c", 0, 0.018, -0.015, Math.PI / 2); // silindir
    m.add(B(0.036, 0.05, 0.1), "#5f6670", 0, 0.012, 0.03); // gövde
    m.add(B(0.012, 0.03, 0.02), "#2b2d42", 0, 0.05, 0.075, -0.5); // horoz
    m.add(B(0.04, 0.11, 0.05), "#8a5a3b", 0, -0.07, 0.085, 0.45); // ahşap kabza
    m.add(B(0.006, 0.03, 0.03), "#141414", 0, -0.03, 0.03); // tetik
    m.add(B(0.008, 0.02, 0.01), "#141414", 0, 0.052, -0.28); // arpacık
    m.fixed(B(0.075, 0.08, 0.09), SKIN, 0, -0.075, 0.09);
    m.support = m.fixed(B(0.06, 0.06, 0.08), SKIN, -0.045, -0.09, 0.06);
    this.sleeves.push(
      m.fixed(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.02, -0.11, 0.27, 0.25),
    );
    this.muzzleFlash(m, -0.29, 0.03);
    m.group.position.set(-0.09, 0.14, -0.04);
  }

  /** Pompalı: kısa kalın namlu, altında tüp, ahşap pompa kolu ve dipçik */
  buildShotgun() {
    const m = this.model("shotgun");
    this.longGun(m, { body: 0.32, barrel: 0.4, color: "#3a3a3a" });
    m.add(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 10), "#2b2b2b", 0, -0.025, -0.33, Math.PI / 2); // tüp
    m.pump = m.add(B(0.07, 0.06, 0.16), "#8a5a3b", 0, -0.025, -0.3); // pompa
    m.pumpRest = m.pump.position.z;
    m.add(B(0.06, 0.1, 0.24), "#8a5a3b", 0, -0.03, 0.27, -0.12); // ahşap dipçik
    m.add(B(0.012, 0.02, 0.012), "#c9a24f", 0, 0.035, -0.54); // boncuk arpacık
  }

  /** Bazuka: omuzda uzun tüp, önünde roket başı, yanında nişangâh */
  buildBazooka() {
    const m = this.model("bazooka");
    m.add(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 14), "#5c6b3a", 0, 0.03, -0.12, Math.PI / 2); // tüp
    m.add(new THREE.CylinderGeometry(0.075, 0.06, 0.08, 14), "#4a5530", 0, 0.03, 0.36, Math.PI / 2); // arka ağız
    m.add(new THREE.CylinderGeometry(0.068, 0.068, 0.05, 14), "#3d4628", 0, 0.03, -0.55, Math.PI / 2); // ön bilezik
    m.add(new THREE.ConeGeometry(0.05, 0.1, 12), "#c0392b", 0, 0.03, -0.62, -Math.PI / 2); // roket başı
    m.add(B(0.02, 0.05, 0.05), "#2b2d42", -0.07, 0.07, -0.25); // nişangâh
    m.add(B(0.04, 0.1, 0.05), "#2b2d42", 0, -0.07, 0.02, 0.2); // kabza
    m.add(B(0.04, 0.09, 0.05), "#2b2d42", 0, -0.07, -0.28, 0.2); // ön tutamak
    m.add(new THREE.CylinderGeometry(0.062, 0.062, 0.06, 14), "#d1b25a", 0, 0.03, 0.15, Math.PI / 2); // sarı şerit
    m.fixed(B(0.08, 0.08, 0.1), SKIN, 0, -0.1, 0.03);
    m.support = m.fixed(B(0.085, 0.07, 0.1), SKIN, -0.01, -0.1, -0.28);
    this.sleeves.push(
      m.fixed(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.03, -0.15, 0.2, 0.2),
    );
    this.muzzleFlash(m, -0.66, 0.03);
    m.group.position.set(0, 0.02, 0.04);
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
    m.support = m.fixed(B(0.085, 0.06, 0.1), SKIN, -0.01, -0.055, -0.2);
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
    this.reloadRig(m);
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
    this.reloadRig(m);
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
    this.reloadRig(m, 0.9);
  }

  /** Alev silahı / dondurucu: kalın gövde, altında tüp (tank), ağzı genişleyen meme */
  buildSprayer(id, c) {
    const m = this.model(id);
    this.longGun(m, { body: 0.34, barrel: 0.22, color: c.body });
    m.add(new THREE.CylinderGeometry(0.055, 0.055, 0.26, 12), c.tank, 0.01, -0.07, -0.14, Math.PI / 2); // tank
    m.add(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 12), "#2b2d42", 0.01, -0.07, -0.14, Math.PI / 2); // kuşak
    m.add(new THREE.CylinderGeometry(0.042, 0.022, 0.1, 12), c.nozzle, 0, 0.012, -0.39, -Math.PI / 2); // meme
    m.add(new THREE.SphereGeometry(0.016, 8, 6), c.tip, 0, 0.012, -0.45); // pilot ucu
    m.add(B(0.02, 0.03, 0.12), "#2b2d42", 0, 0.065, -0.02); // üst tutamak
    m.add(B(0.06, 0.08, 0.16), c.body, 0, -0.02, 0.24); // dipçik
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
    m.support = m.fixed(B(0.06, 0.06, 0.08), SKIN, -0.045, -0.09, 0.05); // destek eli
    this.sleeves.push(
      m.fixed(B(0.1, 0.1, 0.26), TEAM_INFO.red.color, 0.02, -0.11, 0.26, 0.25),
    );
    this.muzzleFlash(m, -o.len + 0.03, 0.02);
    m.group.position.set(-0.09, 0.14, -0.04);
    this.reloadRig(m, 0.75);
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

  /**
   * Şarjör değiştirme animasyonu için parçalar: elde tutulan yeni şarjör (eldeki şarjörün kopyası + el).
   * Eski şarjör (m.mag) yuvadan kayıp düşer, yeni şarjör aşağıdan gelip yuvaya oturur.
   * handScale: elin şarjöre göre boyutu (tabancada küçük)
   */
  reloadRig(m, handScale = 1) {
    if (!m.mag) return;
    const mag = m.mag;
    m.magRest = mag.position.clone();
    m.magRot = mag.rotation.clone();
    const fresh = mag.clone(true);
    fresh.visible = false;
    if (!mag.geometry.boundingBox) mag.geometry.computeBoundingBox();
    const size = mag.geometry.boundingBox.getSize(new THREE.Vector3());
    // Yeni şarjörü tutan el: şarjörün alt ucunu kavrar, arkasında kol
    const k = handScale;
    const hand = part(B(0.075 * k, 0.07 * k, 0.09 * k), SKIN, 0.006, "view");
    hand.position.set(-0.012, -size.y / 2 - 0.02 * k, 0);
    const cuff = part(B(0.09 * k, 0.09 * k, 0.2 * k), TEAM_INFO.red.color, 0.006, "view");
    cuff.position.set(-0.03 * k, -size.y / 2 - 0.07 * k, 0.1 * k);
    cuff.rotation.x = 0.6;
    this.sleeves.push(cuff);
    fresh.add(hand, cuff);
    mag.parent.add(fresh);
    m.freshMag = fresh;
    m.magLen = size.y;
  }

  /** Şarjör animasyonunu sıfırla (silah değişince / iptal) */
  resetMag(m) {
    if (!m?.magRest) return;
    m.mag.position.copy(m.magRest);
    m.mag.rotation.copy(m.magRot);
    m.mag.visible = true;
    m.freshMag.visible = false;
    if (m.support) m.support.visible = true;
    m.reloadPhase = 0;
  }

  /**
   * Reload ilerlemesine (t: 0..1) göre eski şarjörü, yeni şarjörü ve destek elini konumlandırır.
   * Geriye silahın sarsılma miktarını döner (şarjör oturduğunda kısa bir darbe).
   */
  animateMag(m, t) {
    if (!m.magRest) return 0;
    const mag = m.mag;
    const fresh = m.freshMag;
    // Şarjörün kendi "aşağı" yönü (tabancada kabza eğik)
    _down.set(0, -1, 0).applyEuler(m.magRot);
    const L = m.magLen;

    // Destek eli kundaktan ayrılıp yeni şarjörü getirir
    if (m.support) m.support.visible = t < RL.HAND_OFF || t > RL.HAND_BACK;

    // Eski şarjör: önce yuvadan aşağı kayar, sonra dönerek düşer
    if (t < RL.OUT_START) {
      mag.visible = true;
      mag.position.copy(m.magRest);
      mag.rotation.copy(m.magRot);
    } else if (t < RL.DROP_END) {
      mag.visible = true;
      const slide = smooth(RL.OUT_START, RL.OUT_END, t) * L * 0.9;
      const ft = Math.max(0, t - RL.OUT_END) / (RL.DROP_END - RL.OUT_END);
      mag.position.copy(m.magRest).addScaledVector(_down, slide);
      mag.position.y -= ft * ft * 0.55;
      mag.position.x += ft * 0.05;
      mag.rotation.set(m.magRot.x - ft * 1.4, m.magRot.y, m.magRot.z + ft * 0.6);
    } else {
      // Yeni şarjör takılınca asıl şarjör yerinde görünür
      mag.visible = t >= RL.INSERT;
      mag.position.copy(m.magRest);
      mag.rotation.copy(m.magRot);
    }

    // Yeni şarjör: aşağıdan gelir, yuvanın altında hizalanır, iterek takılır
    fresh.visible = t >= RL.NEW_START && t < RL.INSERT;
    if (fresh.visible) {
      const come = smooth(RL.NEW_START, RL.NEW_ALIGN, t);
      const push = smooth(RL.NEW_ALIGN, RL.INSERT, t);
      const gap = (1 - come) * 0.42 + (1 - push) * L * 0.55;
      fresh.position.copy(m.magRest).addScaledVector(_down, gap);
      fresh.position.x -= (1 - come) * 0.08;
      fresh.position.z += (1 - come) * 0.06;
      fresh.rotation.set(m.magRot.x + (1 - come) * 0.7, m.magRot.y, m.magRot.z - (1 - come) * 0.5);
    }

    // Olaylar (ses): şarjör çıktı, takıldı
    const phase = t >= RL.INSERT ? 2 : t >= RL.OUT_START ? 1 : 0;
    if (phase > (m.reloadPhase ?? 0)) {
      m.reloadPhase = phase;
      this.onReloadStep?.(phase === 1 ? "out" : "in");
    }

    // Şarjör oturduğunda kısa darbe (avuçla vurma)
    return t > RL.INSERT ? Math.max(0, 1 - (t - RL.INSERT) / 0.08) : 0;
  }

  /** Tüm silah modellerinin shader'larını önceden derle (ilk silah değişiminde takılma olmasın) */
  warmup(renderer) {
    const shown = Object.values(this.models).map((m) => m.group.visible);
    for (const m of Object.values(this.models)) {
      m.group.visible = true;
      if (m.muzzle) m.muzzle.visible = true;
    }
    renderer.compile(this.scene, this.camera);
    Object.values(this.models).forEach((m, i) => {
      m.group.visible = shown[i];
      if (m.muzzle) m.muzzle.visible = false;
    });
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
    for (const s of this.sleeves) s.material = toon(TEAM_INFO[team].color, "view");
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
    for (const m of Object.values(this.models)) this.resetMag(m);
    this.current = l.primary;
    this.previous = l.pistol;
    this.history = [l.primary, l.pistol];
    this.deployTime = null;
    this.drawStart = performance.now();
    this.show(this.current);
  }

  /** Silah değiştir. Değiştiyse true döner. */
  switchTo(id, now, quick = false) {
    if (id === this.current || !WEAPONS[id] || !this.has(id)) return false;
    this.resetMag(this.models[this.current]);
    this.previous = this.current;
    this.current = id;
    // Son seçilen silahlar: en yeni başta, tekrarsız
    this.history = [id, ...this.history.filter((w) => w !== id)].slice(0, 4);
    this.reloading = false;
    this.scope = 0;
    this.resumeScope = 0;
    this.aiming = false;
    this.throwT = 0;
    this.swing = 0;
    const deploy = (WEAPONS[id].DEPLOY ?? DEPLOY_TIME) * (quick ? QUICK_DEPLOY : 1);
    this.drawStart = now;
    this.deployTime = deploy;
    this.nextFire = Math.max(this.nextFire, now + deploy);
    this.show(id);
    return true;
  }

  /**
   * Q: son seçilen iki silah arasında geçiş. Elindekinden önce seçtiğin ve hâlâ kullanılabilir olan
   * silahı döner (bombası bittiyse bir öncekine bakar; hiçbiri yoksa sıradaki silah).
   */
  get quickSwitchTarget() {
    for (const id of this.history) if (id !== this.current && this.has(id)) return id;
    for (const id of this.owned) if (id !== this.current && this.has(id)) return id;
    return null;
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
    this.kick = d.KICK ?? 1;
    if (d.SPRAY) return; // püskürtmede namlu patlaması yok (parçacıkları Effects çizer)
    if (this.current === "awp" && this.scope > 0) {
      // Atıştan sonra dürbün kapanır, kurma bitince geri açılır
      this.resumeScope = this.ammo.awp > 0 ? this.scope : 0;
      this.scope = 0;
    }
    const m = this.models[this.current];
    m.muzzle.visible = true;
    m.muzzle.material.rotation = Math.random() * Math.PI;
    m.muzzle.scale.setScalar(
      ((d.KICK ?? 1) > 1.5 ? 0.3 : 0.18) +
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

    // Reload: silah yana yatar (şarjör yuvası görünsün), şarjör değiştirme animasyonu oynar
    let reloadDip = 0;
    let slap = 0;
    if (this.reloading) {
      const rt = Math.min(1, (now - this.reloadStart) / d.RELOAD_TIME);
      reloadDip = smooth(0, 0.14, rt) * (1 - smooth(0.82, 1, rt));
      slap = this.animateMag(m, rt);
    } else if (m.reloadPhase || (m.freshMag && m.freshMag.visible)) this.resetMag(m);
    if (m.pump) {
      // Pompalı: her atıştan sonra pompa kolu geri çekilip ileri itilir
      const pt = this.lastShot ? (now - this.lastShot) / d.FIRE_INTERVAL : 1;
      const pk = pt > 0.3 && pt < 0.85 ? Math.sin(((pt - 0.3) / 0.55) * Math.PI) : 0;
      m.pump.position.z = m.pumpRest + pk * 0.08;
    }
    const deploy = this.deployTime ?? d.DEPLOY ?? DEPLOY_TIME;
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
    // Nişan alınca silahın en üst noktası artı işaretinin biraz altında kalır: hedefi ve nişangâhı kapatmaz
    const adsZ = pistol ? Weapon.ADS_Z_PISTOL : Weapon.ADS_Z;
    const adsY = this.adsY[this.current] ?? (pistol ? -0.205 : -0.12);
    const hipX =
      (this.base.x + bobX - this.sprint * 0.06 + swingX) * h + this.sway.x;
    const hipY =
      this.base.y +
      bobY +
      this.sway.y -
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
        this.sprint * 0.25 +
        swingRotX -
        draw * 0.6 -
        th * 0.6,
      (this.sprint * 0.5 + swingRotY) * h * (1 - a),
      0,
    );
    if (reloadDip > 0) {
      // Reload duruşu: silah ortaya doğru kalkar ve yana yatar, şarjör yuvası görünür
      const P = pistol ? Weapon.RELOAD_POSE_PISTOL : Weapon.RELOAD_POSE;
      this.root.position.x += P.x * h * reloadDip;
      this.root.position.y += P.y * reloadDip;
      this.root.position.z += P.z * reloadDip;
      this.root.rotation.x += P.rx * reloadDip;
      this.root.rotation.y += P.ry * h * reloadDip;
      this.root.rotation.z += P.rz * h * reloadDip;
    }
    if (slap > 0) {
      // Şarjör oturunca silah yukarı sarsılır
      this.root.position.y += slap * 0.025;
      this.root.rotation.x += slap * 0.12;
    }
  }
}

// Reload sırasında silahın aldığı poz (konum: metre, dönüş: radyan; x/ry/rz sol elde aynalanır)
Weapon.RELOAD_POSE = { x: -0.08, y: 0.14, z: -0.05, rx: 0.18, ry: 0.3, rz: -0.7 };
Weapon.RELOAD_POSE_PISTOL = { x: -0.06, y: -0.02, z: -0.04, rx: 0.35, ry: 0.25, rz: -0.6 };
// Nişan (ADS) pozu: silahın kameradan uzaklığı ve artı işaretinin altında bırakılacak pay (y/z oranı ≈ 3°)
Weapon.ADS_Z = -0.34;
Weapon.ADS_Z_PISTOL = -0.42;
Weapon.ADS_MARGIN = 0.05;
