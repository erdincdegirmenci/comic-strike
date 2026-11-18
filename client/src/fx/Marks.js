import * as THREE from 'three';
import { MARK } from '@comic-strike/shared/constants.js';

function markTexture(label, name, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  // Aşağıyı gösteren çizgi roman konuşma balonu
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(28, 20);
  g.lineTo(228, 20);
  g.lineTo(228, 130);
  g.lineTo(150, 130);
  g.lineTo(128, 176);
  g.lineTo(106, 130);
  g.lineTo(28, 130);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = '#141414';
  g.stroke();
  g.font = '58px Bangers, Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeText(label, 128, 70);
  g.fillStyle = '#ffffff';
  g.fillText(label, 128, 70);
  g.font = '30px Bangers, Impact, sans-serif';
  g.fillStyle = '#141414';
  g.fillText(name, 128, 112);
  // hedef noktası
  g.beginPath();
  g.arc(128, 222, 18, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.lineWidth = 6;
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Takıma işaret: işaretlenen noktada her yerden görünen balon ("BURADA!" / "DÜŞMAN!").
 * Her oyuncunun tek işareti olur; yenisi eskisinin yerini alır.
 */
export class Marks {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map(); // oyuncu id -> {sprite, until}
  }

  add(id, p, enemy, name, color) {
    this.remove(id);
    const mat = new THREE.SpriteMaterial({ map: markTexture(enemy ? 'DÜŞMAN!' : 'BURADA!', name, enemy ? '#e63946' : color), depthTest: false, transparent: true });
    const s = new THREE.Sprite(mat);
    s.center.set(0.5, 0.06); // balonun ucu işaretlenen noktada
    s.position.set(p[0], p[1], p[2]);
    s.renderOrder = 30;
    this.scene.add(s);
    this.items.set(id, { s, until: performance.now() + MARK.LIFETIME });
  }

  remove(id) {
    const m = this.items.get(id);
    if (!m) return;
    this.scene.remove(m.s);
    m.s.material.map.dispose();
    m.s.material.dispose();
    this.items.delete(id);
  }

  /** Kameraya uzaklıktan bağımsız sabit ekran boyutu, son saniyede solar */
  update(camera) {
    const now = performance.now();
    for (const [id, m] of this.items) {
      if (now > m.until) {
        this.remove(id);
        continue;
      }
      const d = m.s.position.distanceTo(camera.position);
      const k = Math.max(1, d * 0.12);
      m.s.scale.set(k, k, 1);
      m.s.material.opacity = Math.min(1, (m.until - now) / 800);
    }
  }

  clear() {
    for (const id of [...this.items.keys()]) this.remove(id);
  }
}
