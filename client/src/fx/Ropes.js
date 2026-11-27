import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const ROPE = new THREE.CylinderGeometry(0.025, 0.025, 1, 6);
const TIP = new THREE.ConeGeometry(0.09, 0.2, 8);
const ROPE_MAT = new THREE.MeshBasicMaterial({ color: '#5a3a22' });
const TIP_MAT = new THREE.MeshBasicMaterial({ color: '#2f2721' });
const _from = new THREE.Vector3();
const _dir = new THREE.Vector3();

/** Kanca halatları: oyuncudan saplandığı noktaya uzanan ip ve ucundaki kanca */
export class Ropes {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map(); // oyuncu id -> {group, line, tip, to, from, born}
  }

  /** from(target): halatın oyuncudaki ucunu target'a yazar (her karede çağrılır); false dönerse gizlenir */
  add(id, to, from, ms) {
    this.remove(id);
    const group = new THREE.Group();
    const line = new THREE.Mesh(ROPE, ROPE_MAT);
    const tip = new THREE.Mesh(TIP, TIP_MAT);
    group.add(line, tip);
    this.scene.add(group);
    this.items.set(id, { group, line, tip, from, to: new THREE.Vector3(to[0] ?? to.x, to[1] ?? to.y, to[2] ?? to.z), until: performance.now() + ms });
  }

  remove(id) {
    const it = this.items.get(id);
    if (!it) return;
    this.scene.remove(it.group);
    this.items.delete(id);
  }

  clear() {
    for (const id of [...this.items.keys()]) this.remove(id);
  }

  update() {
    const now = performance.now();
    for (const [id, it] of this.items) {
      if (now > it.until) {
        this.remove(id);
        continue;
      }
      it.group.visible = it.from(_from) !== false;
      _dir.copy(it.to).sub(_from);
      const len = _dir.length();
      if (len < 0.01) continue;
      _dir.divideScalar(len);
      it.line.position.copy(_from).addScaledVector(_dir, len / 2);
      it.line.scale.y = len;
      it.line.quaternion.setFromUnitVectors(UP, _dir);
      it.tip.position.copy(it.to).addScaledVector(_dir, -0.08);
      it.tip.quaternion.copy(it.line.quaternion);
    }
  }
}
