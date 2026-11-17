import * as THREE from 'three';
import { WEAPONS } from '@comic-strike/shared/constants.js';
import { Weapon } from '../player/Weapon.js';
import { toon } from '../fx/Toon.js';

const HIDE = new Set(['#f1c27d', '#e63946']); // el (ten) ve kol (takım rengi) parçaları önizlemede gizlenir

/**
 * Silah seçim ekranında 3 boyutlu, kendi etrafında dönen silah önizlemesi.
 * Modeller oyunun kendi silah modellerinden (Weapon) kopyalanır; eller ve kollar gizlenir.
 */
export class WeaponPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null; // ilk gösterimde oluşturulur
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#fff4dc', '#56627e', 1.8));
    const light = new THREE.DirectionalLight('#ffffff', 2.4);
    light.position.set(2, 3, 2);
    this.scene.add(light);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 20);
    this.camera.position.set(0, 0.3, 1.5);
    this.camera.lookAt(0, 0, 0);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.source = null;
    this.current = null;
    this.running = false;
    this.angle = 0;
    this.hideMats = new Set([...HIDE].map((c) => toon(c)));
  }

  show(id) {
    if (!WEAPONS[id]) return;
    if (!this.source) this.source = new Weapon(1); // sadece modelleri için
    if (this.current === id) return;
    this.current = id;
    this.pivot.clear();
    const model = this.source.models[id].group.clone(true);
    model.visible = true;
    model.position.set(0, 0, 0);
    model.traverse((o) => {
      if (o.isMesh && this.hideMats.has(o.material)) o.visible = false;
      if (o.isSprite || o.isLight) o.visible = false;
      if (o.rotation && o.parent === model && o.isGroup) o.rotation.set(0, 0, 0); // dönen tabanca grubu düz dursun
    });
    // Ortala ve çerçeveye sığdır
    const box = new THREE.Box3();
    model.traverse((o) => {
      if (o.isMesh && o.visible) box.expandByObject(o);
    });
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    model.position.sub(center);
    holder.add(model);
    holder.scale.setScalar(1.35 / Math.max(size.x, size.y, size.z, 0.01));
    holder.rotation.z = 0.12;
    this.pivot.add(holder);
    this.angle = -0.6;
  }

  start() {
    if (this.running) return;
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.angle += dt * 1.1;
      this.pivot.rotation.y = this.angle;
      const w = this.canvas.clientWidth || 300;
      const h = this.canvas.clientHeight || 170;
      if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio())) {
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
  }
}
