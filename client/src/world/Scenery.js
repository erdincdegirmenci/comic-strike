import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Sadece görünüm: gökyüzü geçişi, uzak ufuk siluetleri ve duvar afişleri. Fiziğe ve isabete etkisi yoktur.

const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Tepede koyulaşan gökyüzü kubbesi: ufukta saydamlaşıp haritanın gökyüzü rengine karışır */
function skyDome(top) {
  const geo = new THREE.SphereGeometry(300, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(top) } },
    vertexShader: 'varying float vH; void main(){ vH = position.y / 300.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uTop; varying float vH; void main(){ gl_FragColor = vec4(uTop, smoothstep(0.04, 0.75, vH) * 0.85);\n#include <colorspace_fragment>\n }',
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -1;
  return dome;
}

function paint(geo, color) {
  const c = new THREE.Color(color);
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(cols, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.deleteAttribute('uv');
  return g;
}

const THEMES = {
  city: { top: '#5f93c4', kind: 'buildings', colors: ['#8d93a3', '#a39a8f', '#7f8a99', '#b0a394'] },
  pool: { top: '#4f9fd1', kind: 'trees', colors: ['#6f9a6a', '#85a874', '#5d8560'] },
  frost: { top: '#6c9fc9', kind: 'mountains', colors: ['#9fb4c9', '#b8cbdc', '#8aa0b8'] },
  scrap: { top: '#c08a64', kind: 'cranes', colors: ['#8f7a6a', '#a6805c', '#77716b'] },
  station: { top: '#14163a', kind: 'stars', colors: ['#f4f1de', '#ffd23f', '#a8dadc'] },
  other: { top: '#5f93c4', kind: 'mountains', colors: ['#93a68a', '#a9b79b', '#7f9482'] },
};

/** Harita sınırlarının dışında, halka halinde uzak siluetler (tek mesh) */
function horizon(map, theme) {
  const geos = [];
  const rand = seeded(11);
  const base = Math.hypot(map.bounds.x, map.bounds.z) + 14;
  const pick = () => theme.colors[Math.floor(rand() * theme.colors.length)];
  const put = (geo, color, x, y, z, ry = 0) => {
    geo.rotateY(ry);
    geo.translate(x, y, z);
    geos.push(paint(geo, color));
  };
  if (theme.kind === 'stars') {
    for (let i = 0; i < 260; i++) {
      const a = rand() * Math.PI * 2;
      const e = 0.06 + rand() * 1.2;
      const s = 0.35 + rand() * 0.7;
      put(new THREE.OctahedronGeometry(s), pick(), Math.cos(a) * Math.cos(e) * 220, Math.sin(e) * 220, Math.sin(a) * Math.cos(e) * 220);
    }
    put(new THREE.SphereGeometry(26, 24, 16), '#5f7fa0', 120, 70, -150);
    put(new THREE.TorusGeometry(38, 2, 6, 48).rotateX(1.25), '#c9a35a', 120, 70, -150);
  } else {
    const count = theme.kind === 'mountains' ? 30 : 48;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand() * 0.1;
      const r = base + rand() * 28;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const color = pick();
      if (theme.kind === 'mountains') {
        const h = 16 + rand() * 24;
        const w = 14 + rand() * 12;
        put(new THREE.ConeGeometry(w, h, 6), color, x, h / 2 - 1, z, rand() * 3);
        put(new THREE.ConeGeometry(w * 0.32, h * 0.32, 6), '#eef2f4', x, h * 0.84 - 0.8, z);
      } else if (theme.kind === 'trees') {
        const h = 5 + rand() * 6;
        put(new THREE.CylinderGeometry(0.5, 0.7, h, 6), '#7a5a3c', x, h / 2, z);
        put(new THREE.IcosahedronGeometry(2.5 + rand() * 2.5), color, x, h + 1.5, z);
      } else if (theme.kind === 'cranes') {
        const h = 8 + rand() * 20;
        if (i % 4 === 0) {
          put(new THREE.BoxGeometry(1.4, h + 8, 1.4), '#c9a35a', x, (h + 8) / 2, z);
          put(new THREE.BoxGeometry(16, 1, 1), '#c9a35a', x, h + 8, z, rand() * 3);
        } else put(new THREE.CylinderGeometry(2 + rand() * 4, 3 + rand() * 4, h * 0.6, 8), color, x, h * 0.3, z);
      } else {
        const h = 10 + rand() * 24;
        const w = 7 + rand() * 7;
        const ry = -a + Math.PI / 2;
        put(new THREE.BoxGeometry(w, h, 5), color, x, h / 2, z, ry);
        // Pencere şeritleri (merkeze bakan yüzde)
        const k = (r - 2.6) / r;
        for (let y = 3; y < h - 2; y += 3.2) put(new THREE.BoxGeometry(w * 0.75, 1, 0.1), '#e8ddb8', x * k, y, z * k, ry);
      }
    }
  }
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  // Uzaktaki nesneler sis ile gökyüzüne karışır; yıldızlar sisten etkilenmez
  return new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: theme.kind !== 'stars' }));
}

const POSTERS = [
  ['ARANIYOR', 'BOT SAKAR', '#e9d9b0', '#7a3b2e'],
  ['BAM!', '', '#f2c14e', '#c4493d'],
  ['KAPOW!', '', '#7fb2d9', '#22384f'],
  ['COMIC STRIKE', 'SAYI #1', '#c4493d', '#f6efe0'],
  ['EĞİL!', 'KAFANA DİKKAT', '#9fb88a', '#26331f'],
  ['ZIPLA!', 'AMA DÜŞME', '#d9a0c4', '#3c1f33'],
];
let posterMats;
function posterMaterials() {
  posterMats ??= POSTERS.map(([title, sub, bg, ink]) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 320;
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 320);
    // Işın demeti
    g.fillStyle = 'rgba(255,255,255,0.28)';
    for (let i = 0; i < 12; i++) {
      g.beginPath();
      g.moveTo(128, 160);
      g.arc(128, 160, 260, (i / 12) * Math.PI * 2, ((i + 0.45) / 12) * Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#141414';
    g.lineWidth = 12;
    g.strokeRect(8, 8, 240, 304);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = ink;
    const fit = (text, y, size) => {
      g.font = `${size}px Bangers, Impact, sans-serif`;
      g.fillText(text, 128, y, 216);
    };
    fit(title, sub ? 120 : 160, 76);
    if (sub) fit(sub, 220, 40);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshLambertMaterial({ map });
  });
  return posterMats;
}

/** Düz ve önü açık duvar yüzlerine afiş yerleştir (her haritada aynı yerlere) */
function posters(map) {
  const out = new THREE.Group();
  const rand = seeded(23);
  const mats = posterMaterials();
  const inside = (x, y, z) => map.boxes.some((b) => x > b.min[0] && x < b.max[0] && y > b.min[1] && y < b.max[1] && z > b.min[2] && z < b.max[2]);
  const big = map.indoor ? 2.2 : 1; // dev odada afişler de dev
  const W = 1.2 * big;
  const H = 1.5 * big;
  const spots = [];
  for (const b of map.boxes) {
    if (b.glass || !b.solid || b.max[0] - b.min[0] > 100 || b.max[1] - b.min[1] < H + 0.8 || b.min[1] > 0.5) continue;
    for (const axis of [0, 2]) {
      const other = 2 - axis;
      const len = b.max[other] - b.min[other];
      if (len < W + 0.6) continue;
      for (const dir of [-1, 1]) {
        const face = (dir > 0 ? b.max[axis] : b.min[axis]) + dir * 0.03;
        for (let u = b.min[other] + W / 2 + 0.3; u <= b.max[other] - W / 2 - 0.3; u += 6) {
          const y = b.min[1] + (map.indoor ? 3.6 : 1.7);
          const at = (du, dy, out_ = 0) => {
            const p = [0, y + dy, 0];
            p[axis] = face + dir * out_;
            p[other] = u + du;
            return p;
          };
          // Afişin önü boş, arkası duvar olmalı
          let ok = true;
          for (const du of [-W / 2, 0, W / 2]) {
            for (const dy of [-H / 2, 0, H / 2]) {
              if (inside(...at(du, dy, 0.12)) || !inside(...at(du, dy, -0.08))) ok = false;
            }
          }
          const p = at(0, 0);
          if (ok && Math.abs(p[0]) < map.bounds.x && Math.abs(p[2]) < map.bounds.z) spots.push({ p, axis, dir, k: rand() });
        }
      }
    }
  }
  spots.sort((a, b) => a.k - b.k);
  const used = [];
  const geo = new THREE.PlaneGeometry(W, H);
  for (const s of spots) {
    if (used.length >= 16) break;
    if (used.some((o) => Math.hypot(o[0] - s.p[0], o[2] - s.p[2]) < 7 * big)) continue;
    used.push(s.p);
    const mesh = new THREE.Mesh(geo, mats[used.length % mats.length]);
    mesh.position.set(...s.p);
    mesh.rotation.y = s.axis === 0 ? (s.dir * Math.PI) / 2 : s.dir > 0 ? 0 : Math.PI;
    mesh.rotation.z = (rand() - 0.5) * 0.08;
    out.add(mesh);
  }
  return out;
}

export function addScenery(group, map) {
  group.add(posters(map));
  if (map.indoor) return;
  const theme = THEMES[map.id] ?? THEMES.other;
  group.add(skyDome(theme.top));
  group.add(horizon(map, theme));
}
