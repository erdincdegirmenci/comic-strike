// CITY ARENA — harita tamamen kutulardan oluşur.
// Her kutu: { min:[x,y,z], max:[x,y,z], color, solid }
// solid=true kutular hem istemci fiziğinde hem sunucu isabet testinde kullanılır.
// Kırmızı takım -Z, mavi takım +Z tarafında. Harita Z=0'a göre aynalanır, iki taraf eşittir.

const COL = {
  ground: '#565b69',
  sidewalk: '#c2b9a7',
  wall: '#9c7b63',
  wallCap: '#4a3b31',
  roof: '#3d405b',
  window: '#25335e',
  shop: '#3f6e8c',
  door: '#5a3a22',
  b1: '#f4a259',
  b2: '#8cb369',
  b3: '#f4d35e',
  b4: '#e07a5f',
  b5: '#81b29a',
  b6: '#c8a2c8',
  crate: '#c97b3d',
  sand: '#b59f6b',
  concrete: '#cfcfcf',
  metal: '#6c757d',
  gold: '#ffbe0b',
  lamp: '#fff3b0',
  line: '#ffd23f',
  red: '#e63946',
  blue: '#2a6fdb',
  car1: '#3a86ff',
  car2: '#ff006e',
  tire: '#1d1d1d',
  carGlass: '#9bd1e5',
  barrel: '#d62828',
  skyline: ['#7d8597', '#8d99ae', '#6c7a92', '#9aa5b8'],
};

const boxes = [];

function add(min, max, color, solid) {
  boxes.push({ min, max, color, solid });
}

/** Kutu ekle. cx/cz merkez, w (X), d (Z), h yükseklik. y = taban yüksekliği. */
function box(cx, cz, w, d, h, color, o = {}) {
  const y = o.y ?? 0;
  const solid = o.solid ?? true;
  const mirror = o.mirror ?? true;
  add([cx - w / 2, y, cz - d / 2], [cx + w / 2, y + h, cz + d / 2], color, solid);
  if (mirror) add([cx - w / 2, y, -cz - d / 2], [cx + w / 2, y + h, -cz + d / 2], o.mirrorColor ?? color, solid);
}

/** Pencereli bina + kaldırım + çatı kenarı */
function building(cx, cz, w, d, h, color) {
  box(cx, cz, w + 3, d + 3, 0.15, COL.sidewalk);
  box(cx, cz, w, d, h, color);
  box(cx, cz, w + 0.5, d + 0.5, 0.45, COL.roof, { y: h });

  const rows = [];
  for (let y = 3.3; y + 1.5 < h - 0.5; y += 2.8) rows.push(y);
  const deco = { solid: false };

  // Z'ye bakan yüzler
  for (const s of [-1, 1]) {
    const z = cz + s * (d / 2 + 0.04);
    let i = 0;
    for (let x = cx - w / 2 + 1.6; x <= cx + w / 2 - 1.59; x += 2.6, i++) {
      for (const y of rows) box(x, z, 1.2, 0.12, 1.5, COL.window, { ...deco, y });
      if (i % 3 === 1) box(x, z, 1.2, 0.12, 2.2, COL.door, { ...deco, y: 0.15 });
      else box(x, z, 1.7, 0.12, 1.2, COL.shop, { ...deco, y: 0.9 });
    }
  }
  // X'e bakan yüzler
  for (const s of [-1, 1]) {
    const x = cx + s * (w / 2 + 0.04);
    for (let z = cz - d / 2 + 1.6; z <= cz + d / 2 - 1.59; z += 2.6) {
      for (const y of rows) box(x, z, 0.12, 1.2, 1.5, COL.window, { ...deco, y });
      box(x, z, 0.12, 1.7, 1.2, COL.shop, { ...deco, y: 0.9 });
    }
  }
}

function crate(cx, cz, s, h) {
  box(cx, cz, s, s, h, COL.crate);
}

/** Araba: gövde + kabin + tekerlekler. alongZ=true ise Z yönünde uzanır. */
function car(cx, cz, alongZ, color) {
  const [w, d] = alongZ ? [2, 4.2] : [4.2, 2];
  const [cw, cd] = alongZ ? [1.8, 2.2] : [2.2, 1.8];
  box(cx, cz, w, d, 0.9, color, { y: 0.3 });
  box(cx, cz, cw, cd, 0.65, COL.carGlass, { y: 1.2 });
  const tx = w / 2 - 0.15;
  const tz = d / 2 - 0.6;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const ox = alongZ ? sx * tx : sx * (w / 2 - 0.6);
    const oz = alongZ ? sz * tz : sz * (d / 2 - 0.15);
    box(cx + ox, cz + oz, alongZ ? 0.3 : 0.65, alongZ ? 0.65 : 0.3, 0.6, COL.tire, { solid: false });
  }
}

function lamp(cx, cz) {
  box(cx, cz, 0.18, 0.18, 4.2, COL.metal);
  box(cx, cz, 0.5, 0.5, 0.3, COL.lamp, { y: 4.2, solid: false });
}

// ---------------- ZEMİN VE SINIRLAR ----------------
box(0, 0, 160, 160, 1, COL.ground, { y: -1, mirror: false });
box(0, -42.5, 59, 1, 7, COL.wall);
box(0, -42.5, 59.6, 1.6, 0.4, COL.wallCap, { y: 7 });
for (const sx of [-1, 1]) {
  box(sx * 28.5, 0, 1, 86, 7, COL.wall, { mirror: false });
  box(sx * 28.5, 0, 1.6, 86.6, 0.4, COL.wallCap, { y: 7, mirror: false });
}

// Uzaktaki şehir silüeti (yalnızca görsel)
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let x = -70; x <= 70; x += 9) {
  const h = 10 + rand() * 22;
  box(x, -56 - rand() * 8, 7 + rand() * 3, 8, h, COL.skyline[Math.floor(rand() * 4)], { solid: false });
}
for (let z = -40; z <= 0; z += 10) {
  for (const sx of [-1, 1]) {
    const h = 9 + rand() * 20;
    box(sx * (42 + rand() * 6), z, 8, 8 + rand() * 2, h, COL.skyline[Math.floor(rand() * 4)], { solid: false });
  }
}

// Yol çizgileri
for (let z = -40; z <= -11; z += 4) {
  box(-9.5, z, 0.18, 2, 0.02, COL.line, { solid: false });
  box(9.5, z, 0.18, 2, 0.02, COL.line, { solid: false });
}

// Spawn alanları
box(0, -38, 12, 5, 0.03, COL.red, { solid: false, mirrorColor: COL.blue });

// ---------------- BİNALAR (kırmızı yarı, aynalanır) ----------------
building(-19.5, -21.5, 11, 5, 9, COL.b1); // sol blok A
building(-19.5, -12.5, 11, 5, 7, COL.b2); // sol blok B (aradaki geçit 4m)
building(19.5, -25, 11, 6, 11, COL.b4); // sağ blok A
building(19.5, -15, 11, 6, 8, COL.b5); // sağ blok B
building(0, -19, 10, 6, 5, COL.b3); // orta blok
building(-22, -38.5, 12, 7, 6, COL.b6); // spawn köşe binaları
building(22, -38.5, 12, 7, 6, COL.b1);

// ---------------- SİPERLER ----------------
box(-6, -31, 4, 0.6, 1.2, COL.concrete);
box(6, -31, 4, 0.6, 1.2, COL.concrete);
box(-9.5, -17, 3, 0.8, 1.1, COL.sand);
box(9.5, -20, 3, 0.8, 1.1, COL.sand);
crate(-8, -6, 1.6, 1.6);
crate(-9.6, -6.3, 1.0, 0.9);
crate(12, -4.5, 1.6, 1.6);
crate(-20, -30, 1.6, 1.6);
crate(-18.5, -30.2, 1.0, 0.9);
crate(20, -31, 1.6, 1.6);
box(-26.5, -27, 0.8, 0.8, 1.0, COL.barrel);
box(26.5, -9, 0.8, 0.8, 1.0, COL.barrel);
car(-3.5, -10.5, true, COL.car1);
car(7, -8, false, COL.car2);
lamp(-6.8, -12);
lamp(6.8, -12);
lamp(-13.5, -31);
lamp(13.5, -31);

// Meydan: anıt (ortada, aynalanmaz) ve yan siperler
box(0, 0, 7, 7, 0.4, COL.concrete, { mirror: false });
box(0, 0, 3, 3, 1.6, COL.concrete, { y: 0.4, mirror: false });
box(0, 0, 1.2, 1.2, 3.2, COL.metal, { y: 2.0, mirror: false });
box(0, 0, 1.8, 1.8, 0.4, COL.gold, { y: 5.2, mirror: false });
box(-14, 0, 0.6, 4, 1.2, COL.concrete, { mirror: false });
box(14, 0, 0.6, 4, 1.2, COL.concrete, { mirror: false });
// Gazete büfeleri: spawn'dan spawn'a görüş hattını keser
box(-8, 0, 5, 1.6, 2.6, COL.b4, { mirror: false });
box(-8, 0, 5.6, 2.4, 0.3, COL.roof, { y: 2.6, mirror: false });
box(9.5, 0, 4, 1.6, 2.6, COL.b2, { mirror: false });
box(9.5, 0, 4.6, 2.4, 0.3, COL.roof, { y: 2.6, mirror: false });

// ---------------- SPAWN NOKTALARI ----------------
const RED_SPAWNS = [[-6, -38], [-2, -39], [2, -39], [6, -38], [-10, -36.5], [10, -36.5], [-4, -35], [4, -35]];

export const CITY_ARENA = {
  name: 'City Arena',
  boxes,
  // [x, y, z, yaw]  — yaw=π → +Z'ye bakar
  spawns: {
    red: RED_SPAWNS.map(([x, z]) => [x, 0.1, z, Math.PI]),
    blue: RED_SPAWNS.map(([x, z]) => [x, 0.1, -z, 0]),
  },
  bounds: { x: 27.6, z: 41.6, minY: -5, maxY: 20 },
};
