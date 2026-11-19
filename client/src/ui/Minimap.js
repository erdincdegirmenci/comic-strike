import { TEAM_INFO, FLAG_STATE, TEAMS } from '@comic-strike/shared/constants.js';

const PPM = 4; // haritanın önceden çizildiği çözünürlük (piksel / metre)
const RANGE = 30; // mini haritada görünen yarıçap (metre)
const SEEN_MS = 2500; // rakip ateş ettikten sonra bu kadar süre haritada görünür
const FPS = 30;

const hex = (c) => {
  const n = parseInt(String(c).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * Sol üstte, oyuncuyla birlikte dönen mini harita.
 * Harita bir kez kuşbakışı çizilir (yüksek kutular üstte, koyu); her karede sadece döndürülüp
 * üstüne takım arkadaşları, yeni ateş eden rakipler ve bayraklar çizilir. Maliyeti çok düşük.
 */
export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = 0;
    this.map = null;
    this.bg = null;
    this.last = 0;
  }

  setMap(map) {
    if (this.map === map) return;
    this.map = map;
    const B = map.bounds;
    const W = Math.ceil((B.x * 2 + 4) * PPM);
    const H = Math.ceil((B.z * 2 + 4) * PPM);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    this.ox = B.x + 2; // dünya (0,0) → kanvas (ox, oz) metre
    this.oz = B.z + 2;
    g.fillStyle = '#e8dcc0';
    g.fillRect(0, 0, W, H);
    // Kutular: alçaktan yükseğe (çatılar en üstte görünür)
    const boxes = map.boxes
      .filter((b) => b.max[0] - b.min[0] < 100 && b.max[2] - b.min[2] < 100 && b.max[1] > -0.5)
      .sort((a, b) => a.max[1] - b.max[1]);
    g.lineWidth = 1;
    for (const b of boxes) {
      const h = b.max[1];
      if (!b.solid && b.max[1] - b.min[1] > 0.1) continue; // havadaki süsler
      const [r, gg, bl] = hex(b.color);
      // Yükseldikçe koyulaşan ton (kâğıt rengine karışmış)
      const k = Math.min(1, Math.max(0, h) / 6);
      const mix = (v) => Math.round(v * 0.55 + 220 * 0.45 - k * 70);
      g.fillStyle = `rgb(${mix(r)}, ${mix(gg)}, ${mix(bl)})`;
      const x = (b.min[0] + this.ox) * PPM;
      const y = (b.min[2] + this.oz) * PPM;
      const w = (b.max[0] - b.min[0]) * PPM;
      const d = (b.max[2] - b.min[2]) * PPM;
      g.fillRect(x, y, w, d);
      if (b.solid && h > 0.6) {
        g.strokeStyle = 'rgba(58, 48, 41, 0.55)';
        g.strokeRect(x + 0.5, y + 0.5, w - 1, d - 1);
      }
    }
    if (map.water) {
      const w = map.water;
      g.fillStyle = 'rgba(110, 160, 180, 0.75)';
      g.fillRect((w.min[0] + this.ox) * PPM, (w.min[2] + this.oz) * PPM, (w.max[0] - w.min[0]) * PPM, (w.max[2] - w.min[2]) * PPM);
    }
    this.bg = c;
  }

  resize() {
    const s = Math.round(this.canvas.clientWidth || 170);
    if (s !== this.size) {
      this.size = s;
      this.canvas.width = s;
      this.canvas.height = s;
    }
  }

  /** game: Game (yerel oyuncu, uzak oyuncular, takım, bayraklar) */
  update(now, game) {
    if (!this.bg || now - this.last < 1000 / FPS) return;
    this.last = now;
    this.resize();
    const g = this.ctx;
    const S = this.size;
    const scale = S / 2 / RANGE; // piksel / metre
    const me = game.local.position;
    const yaw = game.local.yaw;
    g.clearRect(0, 0, S, S);
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(yaw); // bakış yönü hep yukarı
    g.scale(scale, scale);
    g.translate(-me.x, -me.z);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.bg, -this.ox, -this.oz, this.bg.width / PPM, this.bg.height / PPM);

    // Bayraklar (Bayrak Kap)
    const fs = game.mode === 'ctf' ? game.flagState : null;
    if (fs) {
      TEAMS.forEach((t, i) => {
        const [st, , x, , z] = fs[i];
        g.fillStyle = TEAM_INFO[t].color;
        g.strokeStyle = '#2f2721';
        g.lineWidth = 0.35;
        g.beginPath();
        g.moveTo(x, z - 1.4);
        g.lineTo(x + 1.3, z - 0.8);
        g.lineTo(x, z - 0.2);
        g.closePath();
        g.fill();
        g.stroke();
        if (st !== FLAG_STATE.BASE) {
          g.beginPath();
          g.arc(x, z, 1.2, 0, Math.PI * 2);
          g.stroke();
        }
      });
    }

    // Oyuncular: takım arkadaşları her zaman, rakipler yalnızca yeni ateş ettiyse
    const dot = 1.1 / (scale / 4);
    for (const r of game.remotes.values()) {
      if (!r.alive || !r.root.visible) continue;
      const enemy = game.isEnemy(r);
      if (enemy && !(now - (r.seenAt ?? -1e9) < SEEN_MS)) continue;
      const p = r.root.position;
      g.fillStyle = enemy ? '#b8473b' : TEAM_INFO[r.team]?.color ?? '#555';
      g.strokeStyle = enemy ? '#3a1410' : '#fffaf0';
      g.lineWidth = 0.35;
      g.beginPath();
      g.arc(p.x, p.z, Math.max(0.8, dot), 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.restore();

    // Ben: ortada yukarı bakan ok
    g.save();
    g.translate(S / 2, S / 2);
    g.fillStyle = game.alive ? '#fffaf0' : '#a89a88';
    g.strokeStyle = '#2f2721';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(6, 6);
    g.lineTo(0, 3);
    g.lineTo(-6, 6);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}
