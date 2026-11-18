import * as THREE from 'three';
import { part } from './Toon.js';

const BOX = new THREE.BoxGeometry(0.5, 0.3, 0.34);
const BAND = new THREE.BoxGeometry(0.52, 0.08, 0.36);
const BULLET = new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8);

/** Ölen oyuncuların düşürdüğü mermi kutuları: hafifçe zıplayıp döner */
export class Drops {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map();
    this.t = 0;
  }

  add(id, p) {
    if (this.items.has(id)) return;
    const g = new THREE.Group();
    g.add(part(BOX, '#5c6b3a', 0.025));
    const band = part(BAND, '#ffd23f', 0.015);
    g.add(band);
    for (let i = -1; i <= 1; i++) {
      const b = part(BULLET, '#ffbe0b', 0.01);
      b.position.set(i * 0.12, 0.22, 0);
      g.add(b);
    }
    g.position.set(p[0], p[1] + 0.35, p[2]);
    g.userData.baseY = p[1] + 0.35;
    g.userData.phase = Math.random() * 6;
    this.scene.add(g);
    this.items.set(id, g);
  }

  remove(id) {
    const g = this.items.get(id);
    if (!g) return null;
    this.scene.remove(g);
    this.items.delete(id);
    return g.position;
  }

  update(dt) {
    this.t += dt;
    for (const g of this.items.values()) {
      g.rotation.y += dt * 1.6;
      g.position.y = g.userData.baseY + Math.sin(this.t * 3 + g.userData.phase) * 0.08;
    }
  }

  clear() {
    for (const g of this.items.values()) this.scene.remove(g);
    this.items.clear();
  }
}
