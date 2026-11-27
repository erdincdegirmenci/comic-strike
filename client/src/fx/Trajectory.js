import * as THREE from 'three';
import { GRENADE, WEAPONS } from '@comic-strike/shared/constants.js';
import { stepGrenade, throwVelocity } from '@comic-strike/shared/grenade.js';

const MAX_DOTS = 48;
const DOT_EVERY = 3; // kaç fizik adımında bir nokta
const _m = new THREE.Matrix4();
// Bombanın fitil süresince ulaşabileceği en uzak mesafe (yatay / yukarı / aşağı), metre.
// Bunun dışındaki kutular yörüngeye hiç değemez; elemek sonucu değiştirmez, sadece hızlandırır.
const REACH_XZ = 32;
const REACH_UP = 14;
const REACH_DOWN = 70;
const REFILTER_DIST = 2; // oyuncu bu kadar yer değiştirince yakın kutu listesi yenilenir

/**
 * Bomba / sis atış önizlemesi: elinde bomba varken atılacağı yörüngeyi noktalarla,
 * patlayacağı yeri ve etki alanını halka ile gösterir.
 * Sunucuyla aynı fizik (shared/grenade.js) kullanıldığı için önizleme gerçek atışla aynıdır.
 */
export class Trajectory {
  constructor(scene) {
    this.scene = scene;
    this.dotMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthTest: false, depthWrite: false });
    this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), this.dotMat, MAX_DOTS);
    this.dots.frustumCulled = false;
    this.dots.renderOrder = 20;

    this.marker = new THREE.Group();
    this.marker.renderOrder = 20;
    const flat = (geo, mat) => {
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 20;
      this.marker.add(m);
      return m;
    };
    this.areaMat = new THREE.MeshBasicMaterial({ color: '#e63946', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
    this.edgeMat = new THREE.MeshBasicMaterial({ color: '#e63946', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    this.area = flat(new THREE.CircleGeometry(1, 40), this.areaMat);
    this.edge = flat(new THREE.RingGeometry(0.94, 1, 48), this.edgeMat);
    this.center = flat(new THREE.RingGeometry(0.16, 0.3, 20), new THREE.MeshBasicMaterial({
      color: '#141414', transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    }));

    this.visible = false;
    this.dots.visible = false;
    this.marker.visible = false;
    scene.add(this.dots, this.marker);
    this.near = null; // yörüngeye değebilecek kutular
    this.nearFor = null; // { solids, x, y, z }
  }

  /** Haritanın yalnızca bombanın erişebileceği kısmındaki kutular (her karede ~600 yerine birkaç düzine) */
  nearSolids(o, solids) {
    const f = this.nearFor;
    if (
      f &&
      f.solids === solids &&
      Math.abs(o[0] - f.x) < REFILTER_DIST &&
      Math.abs(o[1] - f.y) < REFILTER_DIST &&
      Math.abs(o[2] - f.z) < REFILTER_DIST
    )
      return this.near;
    const m = REFILTER_DIST;
    const x0 = o[0] - REACH_XZ - m, x1 = o[0] + REACH_XZ + m;
    const z0 = o[2] - REACH_XZ - m, z1 = o[2] + REACH_XZ + m;
    const y0 = o[1] - REACH_DOWN - m, y1 = o[1] + REACH_UP + m;
    this.near = solids.filter(
      (b) => b.max[0] > x0 && b.min[0] < x1 && b.max[2] > z0 && b.min[2] < z1 && b.max[1] > y0 && b.min[1] < y1,
    );
    this.nearFor = { solids, x: o[0], y: o[1], z: o[2] };
    return this.near;
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.dots.visible = false;
    this.marker.visible = false;
  }

  /**
   * origin: atış başlangıcı [x,y,z] (sunucudaki hesapla aynı), dir: bakış yönü (normalize),
   * charge: basılı tutma oranı (0..1), type: 'he' | 'smoke', charging: şu an basılı mı
   */
  show(origin, dir, charge, type, solids, charging) {
    const w = WEAPONS[type];
    const v = throwVelocity(dir, charge).map((x) => Math.round(x * 100) / 100);
    const g = { p: origin.map((x) => Math.round(x * 100) / 100), v };
    const steps = Math.floor(w.FUSE / 1000 / GRENADE.STEP);
    solids = this.nearSolids(origin, solids);
    let n = 0;
    for (let i = 1; i <= steps; i++) {
      stepGrenade(g, solids);
      // İlk birkaç nokta kameraya çok yakın, atla
      if (i > 4 && i % DOT_EVERY === 0 && n < MAX_DOTS) {
        _m.makeTranslation(g.p[0], g.p[1], g.p[2]);
        this.dots.setMatrixAt(n++, _m);
      }
    }
    this.dots.count = n;
    this.dots.instanceMatrix.needsUpdate = true;

    const color = type === 'he' ? '#e63946' : type === 'poison' ? '#7cb518' : type === 'mine' ? '#ff6d00' : type === 'molotov' ? '#f4a261' : type === 'frost' ? '#4cc9f0' : type === 'flash' ? '#ffd23f' : '#8d99ae';
    this.areaMat.color.set(color);
    this.edgeMat.color.set(color);
    this.dotMat.color.set(charging ? '#ffd23f' : '#ffffff');
    this.dotMat.opacity = charging ? 0.95 : 0.55;
    const r = w.RADIUS;
    this.area.scale.setScalar(r);
    this.edge.scale.setScalar(r);
    this.marker.position.set(g.p[0], g.p[1] - GRENADE.RADIUS + 0.03, g.p[2]);

    this.visible = true;
    this.dots.visible = true;
    this.marker.visible = true;
  }

  dispose() {
    this.scene.remove(this.dots, this.marker);
  }
}
