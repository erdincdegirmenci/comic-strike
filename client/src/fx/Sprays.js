import * as THREE from 'three';
import { CHARACTERS } from '@comic-strike/shared/constants.js';

// Her karakterin kendine özel duvar sticker'ı (T tuşu). Hepsi canvas ile çizilir, harici dosya yok.

const INK = '#141414';

function star(g, cx, cy, spikes, outer, inner) {
  g.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}

function fillStroke(g, fill, width = 10) {
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = width;
  g.strokeStyle = INK;
  g.lineJoin = 'round';
  g.stroke();
}

function label(g, s, text, color, y = 0.84, size = 0.2) {
  g.font = `${Math.round(s * size)}px Bangers, Impact, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = s * 0.05;
  g.strokeStyle = INK;
  g.strokeText(text, s / 2, s * y);
  g.fillStyle = color;
  g.fillText(text, s / 2, s * y);
}

/** Sprey boya damlaları */
function drips(g, s, color, seed) {
  let x = seed;
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  g.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const px = s * (0.25 + rnd() * 0.5);
    const len = s * (0.05 + rnd() * 0.1);
    const top = s * (0.6 + rnd() * 0.1);
    g.fillRect(px, top, s * 0.018, len);
    g.beginPath();
    g.arc(px + s * 0.009, top + len, s * 0.016, 0, Math.PI * 2);
    g.fill();
  }
}

const DRAW = {
  // Kaptan Max: yıldız + maskeli yüz
  max(g, s, c) {
    star(g, s / 2, s * 0.42, 9, s * 0.4, s * 0.26);
    fillStroke(g, c.color, s * 0.03);
    g.beginPath();
    g.arc(s / 2, s * 0.42, s * 0.17, 0, Math.PI * 2);
    fillStroke(g, '#f1c27d', s * 0.025);
    g.beginPath();
    g.ellipse(s / 2, s * 0.39, s * 0.16, s * 0.05, 0, 0, Math.PI * 2);
    g.fillStyle = c.accent;
    g.fill();
    g.fillStyle = '#fff';
    for (const dx of [-0.06, 0.06]) {
      g.beginPath();
      g.arc(s / 2 + s * dx, s * 0.39, s * 0.022, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(s / 2, s * 0.46, s * 0.07, 0.15 * Math.PI, 0.85 * Math.PI);
    g.lineWidth = s * 0.018;
    g.strokeStyle = INK;
    g.stroke();
  },
  // Ziggy Zap: daire + şimşek
  ziggy(g, s, c) {
    g.beginPath();
    g.arc(s / 2, s * 0.42, s * 0.36, 0, Math.PI * 2);
    fillStroke(g, c.color, s * 0.03);
    g.beginPath();
    const p = [[0.56, 0.1], [0.32, 0.46], [0.48, 0.46], [0.4, 0.76], [0.7, 0.36], [0.53, 0.36], [0.64, 0.1]];
    for (const [x, y] of p) g.lineTo(s * x, s * y);
    g.closePath();
    fillStroke(g, c.accent, s * 0.025);
  },
  // Roxy: kalp + öpücük
  roxy(g, s, c) {
    const cx = s / 2;
    const cy = s * 0.36;
    const r = s * 0.34;
    g.beginPath();
    g.moveTo(cx, cy + r * 0.95);
    g.bezierCurveTo(cx - r * 1.4, cy + r * 0.1, cx - r * 0.9, cy - r * 0.95, cx, cy - r * 0.35);
    g.bezierCurveTo(cx + r * 0.9, cy - r * 0.95, cx + r * 1.4, cy + r * 0.1, cx, cy + r * 0.95);
    g.closePath();
    fillStroke(g, c.color, s * 0.03);
    // dudak
    g.beginPath();
    g.ellipse(cx, cy + s * 0.04, s * 0.1, s * 0.045, 0, 0, Math.PI * 2);
    fillStroke(g, '#d00000', s * 0.015);
    g.beginPath();
    g.moveTo(cx - s * 0.1, cy + s * 0.04);
    g.lineTo(cx + s * 0.1, cy + s * 0.04);
    g.lineWidth = s * 0.012;
    g.stroke();
    g.beginPath();
    g.arc(cx + s * 0.16, cy - s * 0.14, s * 0.035, 0, Math.PI * 2);
    g.fillStyle = c.accent;
    g.fill();
  },
  // Mr. Bones: kurukafa
  bones(g, s, c) {
    const cx = s / 2;
    // çapraz kemikler
    g.save();
    g.translate(cx, s * 0.45);
    for (const a of [0.7, -0.7]) {
      g.save();
      g.rotate(a);
      g.beginPath();
      g.roundRect(-s * 0.4, -s * 0.035, s * 0.8, s * 0.07, s * 0.03);
      fillStroke(g, c.color, s * 0.02);
      for (const ex of [-0.4, 0.4]) {
        for (const ey of [-0.04, 0.04]) {
          g.beginPath();
          g.arc(s * ex, s * ey, s * 0.04, 0, Math.PI * 2);
          fillStroke(g, c.color, s * 0.02);
        }
      }
      g.restore();
    }
    g.restore();
    g.beginPath();
    g.arc(cx, s * 0.36, s * 0.22, 0, Math.PI * 2);
    fillStroke(g, c.color, s * 0.03);
    g.beginPath();
    g.roundRect(cx - s * 0.12, s * 0.46, s * 0.24, s * 0.14, s * 0.03);
    fillStroke(g, c.color, s * 0.025);
    g.fillStyle = INK;
    for (const dx of [-0.085, 0.085]) {
      g.beginPath();
      g.arc(cx + s * dx, s * 0.36, s * 0.06, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.moveTo(cx, s * 0.43);
    g.lineTo(cx - s * 0.03, s * 0.49);
    g.lineTo(cx + s * 0.03, s * 0.49);
    g.fill();
    g.lineWidth = s * 0.012;
    g.strokeStyle = INK;
    for (const dx of [-0.06, 0, 0.06]) {
      g.beginPath();
      g.moveTo(cx + s * dx, s * 0.52);
      g.lineTo(cx + s * dx, s * 0.6);
      g.stroke();
    }
  },
};

/** Karakterin sticker'ını verilen canvas boyutunda çizer */
export function drawSpray(charId, size = 256) {
  const c = CHARACTERS[charId] ?? CHARACTERS.max;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  drips(g, size, c.color, 7 + charId.length * 13);
  DRAW[c.id](g, size, c);
  label(g, size, c.tag, c.accent === INK ? c.color : c.accent === '#ffffff' ? '#fff' : c.accent);
  return canvas;
}

const cache = new Map();
export function sprayTexture(charId) {
  if (!cache.has(charId)) {
    const t = new THREE.CanvasTexture(drawSpray(charId, 256));
    t.colorSpace = THREE.SRGBColorSpace;
    cache.set(charId, t);
  }
  return cache.get(charId);
}
