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
const pads = [];

/** Zıplama pedi (aynalanır: karşı taraftaki pedin Z hızı ters) */
function pad(cx, cz, v, o = {}) {
  const y = o.y ?? 0;
  const r = o.r ?? 1;
  pads.push({ c: [cx, y, cz], r, v });
  if (o.mirror ?? true) pads.push({ c: [cx, y, -cz], r, v: [v[0], v[1], -v[2]] });
}

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

const WALL_T = 0.3;

/**
 * Duvar: from..to aralığında, openings = [{a, b, y0, y1}] boşlukları (kapı/pencere) bırakarak.
 * axis='z' ise duvar Z sabit, X boyunca uzanır; axis='x' ise tersi.
 */
function wall(axis, at, from, to, h, openings, color) {
  const cuts = [from, to, ...openings.flatMap((o) => [o.a, o.b])].filter((v) => v >= from && v <= to).sort((a, b) => a - b);
  const seg = (a, b, y0, y1, col = color, solid = true) => {
    if (y1 - y0 < 0.01) return;
    const mid = (a + b) / 2;
    if (axis === 'z') box(mid, at, b - a, WALL_T, y1 - y0, col, { y: y0, solid });
    else box(at, mid, WALL_T, b - a, y1 - y0, col, { y: y0, solid });
  };
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i];
    const b = cuts[i + 1];
    if (b - a < 0.01) continue;
    const op = openings.find((o) => (a + b) / 2 > o.a && (a + b) / 2 < o.b);
    if (!op) {
      seg(a, b, 0, h);
      continue;
    }
    seg(a, b, 0, op.y0);
    seg(a, b, op.y1, h);
    // pencere pervazı (dekor)
    if (op.y0 > 0) {
      if (axis === 'z') box((a + b) / 2, at, b - a + 0.1, WALL_T + 0.16, 0.08, COL.wallCap, { y: op.y0 - 0.08, solid: false });
      else box(at, (a + b) / 2, WALL_T + 0.16, b - a + 0.1, 0.08, COL.wallCap, { y: op.y0 - 0.08, solid: false });
    }
  }
}

/**
 * İçine girilebilen ev: kapılar, gerçek pencere boşlukları (içeriden AWP ile oynanabilir),
 * dışarıda çatıya çıkan merdiven ve çatıda alçak siper duvarı.
 * stairs: +1 ise merdiven evin +X yüzünde, -1 ise -X yüzünde. Merdiven +Z ucundan başlayıp -Z'ye doğru çıkar.
 */
function house(cx, cz, w, d, h, color, stairs) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const z0 = cz - d / 2;
  const z1 = cz + d / 2;
  const T = WALL_T;
  box(cx, cz, w + 3, d + 3, 0.15, COL.sidewalk);
  box(cx, cz, w - 0.6, d - 0.6, 0.02, COL.door, { y: 0.15, solid: false }); // iç zemin

  const win = (c) => ({ a: c - 0.7, b: c + 0.7, y0: 1.05, y1: 2.2 });
  const door = { a: cx - 0.75, b: cx + 0.75, y0: 0, y1: 2.5 };
  // Ön/arka: kapı + iki pencere
  for (const z of [z0 + T / 2, z1 - T / 2]) wall('z', z, x0, x1, h, [door, win(cx - w / 4 - 0.4), win(cx + w / 4 + 0.4)], color);
  // Yanlar: pencere
  for (const x of [x0 + T / 2, x1 - T / 2]) wall('x', x, z0 + T, z1 - T, h, [win(cz)], color);
  // Çatı + kenar şeridi
  const RT = 0.3;
  box(cx, cz, w, d, RT, COL.roof, { y: h });
  // Çatıda alçak siper duvarı (merdiven tarafında boşluk)
  const top = h + RT;
  const P = 0.7;
  box(cx, z0 + 0.1, w, 0.2, P, COL.wallCap, { y: top });
  box(cx, z1 - 0.1, w, 0.2, P, COL.wallCap, { y: top });
  const sx = stairs > 0 ? x1 : x0; // merdiven tarafı
  const ox = stairs > 0 ? x0 : x1; // karşı taraf
  box(ox + (stairs > 0 ? 0.1 : -0.1), cz, 0.2, d - 0.4, P, COL.wallCap, { y: top });
  box(sx - (stairs > 0 ? 0.1 : -0.1), cz + 0.9, 0.2, d - 2.2, P, COL.wallCap, { y: top }); // çıkış boşluğu z0 ucunda
  // İçeride siper
  box(cx + w / 4, cz, 1.2, 1.2, 1.1, COL.crate);
  box(cx - w / 4, cz + 0.5, 2, 0.6, 0.9, COL.crate);

  // Dış merdiven: her basamak ≤ 0.42 m (karakter otomatik çıkar)
  const n = Math.ceil(top / 0.42);
  const depth = (d - 0.2) / n;
  const stairX = sx + stairs * 0.6;
  for (let i = 0; i < n; i++) {
    const st = ((i + 1) * top) / n;
    box(stairX, z1 - 0.1 - (i + 0.5) * depth, 1.2, depth, st, COL.concrete);
  }
  // Merdiven korkuluğu (dekor)
  box(stairX + stairs * 0.62, cz, 0.06, d - 0.2, 0.06, COL.metal, { y: top + 0.9, solid: false });
}

/** İki köşesi verilen yatay dikdörtgen kutu (ayna dahil) */
function rect(xa, xb, za, zb, y, h, color, o = {}) {
  const x0 = Math.min(xa, xb);
  const x1 = Math.max(xa, xb);
  const z0 = Math.min(za, zb);
  const z1 = Math.max(za, zb);
  if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return;
  box((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h, color, { ...o, y });
}

/**
 * İçine girilebilen apartman: dışı building() ile aynı görünür (pencereler, dükkanlar),
 * içi tek katlı yüksek bir merdiven boşluğu. Uzun duvar boyunca çıkan merdiven çatıdaki
 * kapaktan çatıya açılır. Kapılar: sokağa bakan X yüzünde ve meydana bakan Z yüzünde.
 * Merdiven her zaman haritanın dış kenarına doğru çıkar (cx'in işaretine göre).
 */
function apartment(cx, cz, w, d, h, color) {
  const T = WALL_T;
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const z0 = cz - d / 2; // merdiven bu duvar boyunca
  const z1 = cz + d / 2; // ön kapı bu yüzde
  const out = Math.sign(cx) || 1; // merdivenin çıktığı yön (+1: +X)
  const xin = out > 0 ? x0 : x1; // sokağa bakan yüz
  const xout = out > 0 ? x1 : x0;
  const ROOF_T = 0.45;
  const top = h + ROOF_T;

  box(cx, cz, w + 3, d + 3, 0.15, COL.sidewalk);
  box(cx, cz, w - 0.6, d - 0.6, 0.02, COL.door, { y: 0.15, solid: false }); // iç zemin

  // Kapılar
  const frontX = cx - out * (w / 4); // ön yüz kapısı (sokak tarafına yakın)
  const sideZ = cz + 0.55; // sokak yüzü kapısı (merdiven bandından uzakta)
  const doorW = 1.6;
  wall('z', z1 - T / 2, x0, x1, h, [{ a: frontX - doorW / 2, b: frontX + doorW / 2, y0: 0, y1: 2.5 }], color);
  wall('z', z0 + T / 2, x0, x1, h, [], color);
  wall('x', xin + out * T / 2, z0 + T, z1 - T, h, [{ a: sideZ - doorW / 2, b: sideZ + doorW / 2, y0: 0, y1: 2.5 }], color);
  wall('x', xout - out * T / 2, z0 + T, z1 - T, h, [], color);
  // Kapı üstü saçak (dekor)
  box(frontX, z1 + 0.15, doorW + 0.5, 0.5, 0.12, COL.wallCap, { y: 2.55, solid: false });
  box(xin - out * 0.15, sideZ, 0.5, doorW + 0.5, 0.12, COL.wallCap, { y: 2.55, solid: false });

  // Merdiven: z0 duvarı boyunca, sokak tarafından dış tarafa doğru çıkar; son basamak çatı seviyesinde
  const SW = 1.3; // merdiven genişliği
  const zb0 = z0 + T;
  const zb1 = zb0 + SW;
  const LANDING = 1.2; // sokak kapısının önünde merdivene yaklaşmak için boşluk
  const len = w - 2 * T - LANDING;
  const n = Math.ceil((top - 0.15) / 0.4);
  const depth = len / n;
  const xs = xin + out * (T + LANDING); // ilk basamağın başladığı x
  let holeFrom = null; // çatıda kafa boşluğu açılacak yerin başlangıcı
  for (let i = 0; i < n; i++) {
    const st = 0.15 + ((i + 1) * (top - 0.15)) / n;
    const a = xs + out * i * depth;
    rect(a, a + out * depth, zb0, zb1, 0, st, COL.concrete);
    // Basamağın üstünde ayakta duran oyuncunun kafası çatıya değiyorsa buradan itibaren çatı açık
    if (holeFrom === null && st + 1.95 > h) holeFrom = a - out * depth; // bir basamak pay
  }
  // Merdiven korkuluğu (dekor)
  box(cx + out * LANDING / 2, zb1 + 0.04, len, 0.06, 0.06, COL.metal, { y: top * 0.5 + 0.9, solid: false });

  // Çatı: merdivenin üstünde kapak boşluğu bırakan parçalar
  const rx0 = x0 - 0.25;
  const rx1 = x1 + 0.25;
  const rinAt = out > 0 ? rx0 : rx1;
  rect(rx0, rx1, zb1, z1 + 0.25, h, ROOF_T, COL.roof); // merdiven bandının önü
  rect(rx0, rx1, z0 - 0.25, zb0, h, ROOF_T, COL.roof); // merdiven bandının arkası
  rect(rinAt, holeFrom, zb0, zb1, h, ROOF_T, COL.roof); // bandın kapalı kısmı
  rect(xout - out * T, xout + out * 0.25, zb0, zb1, h, ROOF_T, COL.roof); // dış duvarın üstü
  // Çatı kapağı çevresinde alçak korkuluk (kapağa düşmeyi zorlaştırır, sokak tarafı açık)
  // (merdivenin çıktığı son 1.4 m açık: oradan çatıya çıkılır)
  const railEnd = xout - out * (T + 1.4);
  if ((railEnd - holeFrom) * out > 0.3) rect(holeFrom, railEnd, zb1 + 0.02, zb1 + 0.14, top, 0.5, COL.wallCap);
  rect(holeFrom - out * 0.12, holeFrom, zb0, zb1, top, 0.5, COL.wallCap);
  // Çatı kenarında alçak siper (ön ve iki yan)
  box(cx, z1 + 0.15, w + 0.5, 0.2, 0.6, COL.wallCap, { y: top });
  box(rinAt + out * 0.1, cz + 0.1, 0.2, d + 0.3, 0.6, COL.wallCap, { y: top });

  // Cephe süsleri (kapıların üstüne gelmeyecek şekilde)
  const rows = [];
  for (let y = 3.3; y + 1.5 < h - 0.5; y += 2.8) rows.push(y);
  const deco = { solid: false };
  for (const s of [-1, 1]) {
    const z = s > 0 ? z1 + 0.04 : z0 - 0.04;
    let i = 0;
    for (let x = cx - w / 2 + 1.6; x <= cx + w / 2 - 1.59; x += 2.6, i++) {
      for (const y of rows) box(x, z, 1.2, 0.12, 1.5, COL.window, { ...deco, y });
      if (s > 0 && Math.abs(x - frontX) < 1.7) continue;
      box(x, z, 1.7, 0.12, 1.2, COL.shop, { ...deco, y: 0.9 });
    }
  }
  for (const s of [-1, 1]) {
    const x = s > 0 ? x1 + 0.04 : x0 - 0.04;
    for (let z = cz - d / 2 + 1.6; z <= cz + d / 2 - 1.59; z += 2.6) {
      for (const y of rows) box(x, z, 0.12, 1.2, 1.5, COL.window, { ...deco, y });
      if (s === -out && Math.abs(z - sideZ) < 1.7) continue; // sokak yüzündeki kapı
      box(x, z, 0.12, 1.7, 1.2, COL.shop, { ...deco, y: 0.9 });
    }
  }
  // İçeride siper sandığı
  crate(cx - out * 1.2, z1 - 1.1, 1.1, 1.0);
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
apartment(-19.5, -12.5, 11, 5, 7, COL.b2); // sol blok B (aradaki geçit 4m): içinden merdivenle çatıya çıkılır
building(19.5, -25, 11, 6, 11, COL.b4); // sağ blok A
apartment(19.5, -15, 11, 6, 8, COL.b5); // sağ blok B: içinden merdivenle çatıya çıkılır
house(0, -19, 10, 6, 5, COL.b3, 1); // orta blok: içine girilir, çatıya çıkılır
house(-22, -38.5, 12, 7, 6, COL.b6, 1); // spawn köşe evleri: içine girilir, çatıya çıkılır
house(22, -38.5, 12, 7, 6, COL.b1, -1);

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

// ---------------- ZIPLAMA PEDLERİ VE EĞİLEREK GEÇİLEN YERLER ----------------
const CRAWL = 1.25; // ayakta geçilmez, çömelince geçilir
// Tır dorsesi: altından eğilerek geçilir, üstüne pedle çıkılır
box(9.5, -27, 7, 2.6, 1.95, '#e76f51', { y: CRAWL });
box(9.5, -27, 7.08, 2.68, 0.18, COL.gold, { y: CRAWL + 1.2, solid: false });
for (const x of [6.7, 7.6, 11.4, 12.3]) for (const z of [-28.15, -25.85]) box(x, z, 0.75, 0.3, 0.8, COL.tire, { y: 0.15, solid: false });
box(6.3, -27, 0.15, 2, CRAWL, COL.metal, { solid: false }); // dorse ayağı (dekor)
pad(9.5, -31, [0, 12, 4.4]); // dorsenin üstüne
// Ara sokağı kapatan duvar: ortasında eğilerek geçilen delik
wall('x', -14.8, -19, -15, 2.6, [{ a: -17.6, b: -16.4, y0: 0, y1: CRAWL }], COL.wall);
// Ortadaki evin çatısına ped
pad(-8.5, -19, [4.8, 16.75, 0]);

// ---------------- SPAWN NOKTALARI ----------------
const RED_SPAWNS = [[-6, -38], [-2, -39], [2, -39], [6, -38], [-10, -36.5], [10, -36.5], [-4, -35], [4, -35]];

export const CITY_ARENA = {
  name: 'City Arena',
  boxes,
  pads,
  // [x, y, z, yaw]  — yaw=π → +Z'ye bakar
  spawns: {
    red: RED_SPAWNS.map(([x, z]) => [x, 0.1, z, Math.PI]),
    blue: RED_SPAWNS.map(([x, z]) => [x, 0.1, -z, 0]),
  },
  bounds: { x: 27.6, z: 41.6, minY: -5, maxY: 20 },
};
