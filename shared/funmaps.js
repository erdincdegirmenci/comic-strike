// Eğlence haritaları: tek fikre dayalı haritalar (keskin nişancı düellosu, AWP nişan arenası,
// avlu çatışması, uzay istasyonu). Hepsi özgün tasarım; renkleri el çizimi / suluboya görünümüne uygun soluk tonlar.
// Kırmızı takım -Z, mavi takım +Z tarafında; haritalar Z=0'a göre aynalanır.
// builder: maps.js'teki kutu yardımcıları (bkz. builder()).
// Hatırlatma: karakter 0.4 m'ye kadar basamağı kendiliğinden çıkar, zıplama ~1.1 m, çömelince 1.15 m'lik boşluktan geçer.

const spawnsFrom = (list, y = 0.1) => ({
  red: list.map(([x, z]) => [x, y, z, Math.PI]),
  blue: list.map(([x, z]) => [x, y, -z, 0]),
});
const flagsFrom = (x, z, y = 0.1) => ({ red: [x, y, z], blue: [x, y, -z] });

/** Dört yanı kapatan sınır duvarları + zemin */
function arena(box, BX, BZ, h, ground, wall) {
  box(0, 0, 400, 400, 1, ground, { y: -1, mirror: false });
  box(0, -BZ - 0.25, BX * 2 + 1, 0.5, h, wall); // aynalanınca +Z duvarı da olur
  box(-BX - 0.25, 0, 0.5, BZ * 2 + 1, h, wall, { mirror: false });
  box(BX + 0.25, 0, 0.5, BZ * 2 + 1, h, wall, { mirror: false });
}

/** Duvara asılı nişan tahtası (görünüm): xz konumu, yüzün yönü 'z' (duvar Z'ye dik) veya 'x' */
function target(box, x, z, y, axis = 'z', s = 2.2) {
  const t = 0.04;
  const rings = [
    [s, '#efe6d2'],
    [s * 0.72, '#b5483c'],
    [s * 0.46, '#efe6d2'],
    [s * 0.22, '#b5483c'],
  ];
  rings.forEach(([w, c], i) => {
    const off = (i + 1) * 0.02;
    const yy = y - w / 2;
    if (axis === 'z') box(x, z + (z < 0 ? off : -off), w, t, w, c, { y: yy, solid: false, mirror: false });
    else box(x + (x < 0 ? off : -off), z, t, w, w, c, { y: yy, solid: false, mirror: false });
  });
}

// ======================================================================
// NİŞANCI DÜELLOSU — uzun, açık bir vadi. Sadece AWP (+ tabanca, bıçak). Uzun menzil.
// Her üssün önünde kum torbası hattı, köşelerde yüksek nişancı kuleleri, sol kanatta çatısına
// çıkılan yıkık ev, sağ kanatta basamaklı tepe, ortada yıkık kemer ve dağınık kayalar.
// ======================================================================
export function sniperDuel(builder) {
  const { boxes, pads, box, rect, tower, hut } = builder();
  const C = {
    ground: '#d8c8a4',
    ground2: '#cbb993',
    path: '#cdb98f',
    wall: '#9c8b74',
    cap: '#6e6152',
    sand: '#bfa77c',
    sand2: '#ad9469',
    rock: '#8f8c84',
    rock2: '#a39f95',
    wood: '#8a6a4b',
    roof: '#5b6270',
    plaster: '#d9ccb2',
    red: '#a2483c',
    blue: '#4d6b8a',
    grass: '#9aa67a',
  };
  const BX = 22;
  const BZ = 56;
  arena(box, BX, BZ, 6, C.ground, C.wall);
  box(0, -BZ - 0.25, BX * 2 + 1, 0.6, 0.3, C.cap, { y: 6 });

  // Ortadaki toprak yol (sadece görünüm)
  box(0, 0, 5, BZ * 2 - 8, 0.02, C.path, { mirror: false, solid: false });

  // Üs: arka duvarda takım renginde bayrak şeridi, köşelerde barınaklar
  box(0, -BZ + 0.15, 10, 0.2, 3, C.red, { y: 1.2, mirrorColor: C.blue, solid: false });
  for (const sx of [-1, 1]) {
    box(sx * 17, -BZ + 4, 6, 7, 3.4, C.wall);
    box(sx * 17, -BZ + 4, 6.4, 7.4, 0.3, C.roof, { y: 3.4 });
  }

  // Kum torbası hattı: ayakta üstünden ateş edilir, çömelince saklanılır; arada geçiş boşlukları
  for (const [a, b] of [[-14, -8], [-4, 4], [8, 14]]) {
    rect(a, b, -44.4, -43.6, 0, 1.0, C.sand);
    rect(a + 0.2, b - 0.2, -44.3, -43.7, 1.0, 0.12, C.sand2);
  }

  // Köşe nişancı kuleleri (merdiveni üs tarafında, çatılı)
  for (const sx of [-1, 1]) {
    const x = sx * 18;
    tower(x, -36, 3, 4.2, C.wood, { rail: C.cap, stairColor: C.wood });
    box(x, -36, 3.4, 3.4, 0.25, C.roof, { y: 6.8 });
    for (const px of [-1, 1]) for (const pz of [-1, 1]) box(x + px * 1.55, -36 + pz * 1.55, 0.15, 0.15, 2.6, C.wood, { y: 4.2 });
  }

  // Sol kanat: çatısına çıkılan yıkık ev (pencereler orta sahaya bakar)
  hut(-14, -26, 7, 5, 3, C.plaster, {
    doors: [{ side: 's', at: 1.5 }, { side: 'e', at: 0 }],
    windows: [{ side: 'n', at: -1.6 }, { side: 'n', at: 1.6 }],
    roof: C.roof,
    roofStairs: 'w',
    capColor: C.cap,
  });

  // Sağ kanat: basamaklı tepe (yürüyerek çıkılır), üstünde kaya siperi
  for (let i = 0; i < 5; i++) box(13, -22, 9 - i * 1.6, 7 - i * 1.2, 0.4, i % 2 ? C.grass : C.ground2, { y: i * 0.4 });
  box(13.3, -22.4, 1.6, 1.0, 1.1, C.rock, { y: 2.0 });

  // Orta saha: kayalar ve alçak duvarlar (yarım siper)
  box(-5.5, -16, 2.2, 1.8, 2.2, C.rock);
  box(-5.2, -16.2, 1.4, 1.2, 0.6, C.rock2, { y: 2.2 });
  box(4, -12, 1.6, 2.4, 1.6, C.rock2);
  box(-1.5, -19, 3, 0.8, 1.1, C.sand);
  box(10, -9, 3.2, 0.8, 1.1, C.sand);
  box(-12, -9, 1.6, 1.6, 2.6, C.rock);
  box(2.5, -7.5, 1.2, 1.2, 1.2, C.rock2);
  box(-5, -5, 3.5, 0.6, 1.0, C.cap);
  box(-17, -14, 2.4, 0.8, 1.1, C.sand);
  box(18, -12, 1.8, 1.8, 2.0, C.rock);
  box(6, -31, 2.6, 0.8, 1.1, C.sand);
  box(-4, -34, 1.4, 1.4, 1.6, C.rock2);

  // Tam ortada yıkık kemer: iki ayak + üst kiriş (altından geçilir), yanlarda yıkık duvarlar
  box(-2.6, 0, 1, 1.2, 3.2, C.wall, { mirror: false });
  box(2.6, 0, 1, 1.2, 3.2, C.wall, { mirror: false });
  box(0, 0, 6.6, 1.2, 0.6, C.cap, { y: 3.2, mirror: false });
  box(-9, 0, 5, 0.7, 1.2, C.wall, { mirror: false });
  box(9, 0, 5, 0.7, 1.2, C.wall, { mirror: false });
  box(-17.5, 0, 3, 0.7, 2.2, C.wall, { mirror: false });
  box(17.5, 0, 3, 0.7, 2.2, C.wall, { mirror: false });

  // Ot öbekleri (görünüm)
  for (const [x, z] of [[-15, -11], [15, -3], [-7, -22], [4, -24], [10, -16], [-15, -1], [-9, -40], [9, -39]]) {
    box(x, z, 1.4, 1.1, 0.35, C.grass, { solid: false });
  }

  const list = [[-8, -50], [-4, -51], [0, -50], [4, -51], [8, -50], [-6, -47.5], [6, -47.5], [0, -47]];
  return {
    id: 'sniper',
    name: 'NİŞANCI DÜELLOSU',
    desc: 'SADECE AWP · UZUN MENZİL',
    forceLoadout: { primary: 'awp' },
    boxes,
    pads,
    spawns: spawnsFrom(list),
    flags: flagsFrom(0, -53.5),
    bounds: { x: BX - 0.6, z: BZ - 0.6, minY: -5, maxY: 24 },
    sky: '#e7dcc1',
  };
}

// ======================================================================
// NİŞAN ARENASI — klasik "AWP haritası": SADECE AWP.
// Her takım arkada yükseltilmiş bir balkonda doğar (önünde siper), balkondan iki merdivenle inilir.
// Ortada kapılı ve iki pencereli bölme duvar (pencerelerden nişan alınır), iki yanda açık koridorlar,
// köşelerde nişancı kuleleri; aradaki sandıklar zıplayıp bakmak (jump-peek) için.
// ======================================================================
export function aimArena(builder) {
  const { boxes, pads, box, rect, wall, stairs, tower } = builder();
  const C = {
    ground: '#d3c8b2',
    tile: '#c6baa1',
    wall: '#b9a98b',
    wall2: '#a89878',
    cap: '#7b6a55',
    plat: '#a99b80',
    crate: '#9b7653',
    band: '#5f4a36',
    wood: '#8a6a4b',
    sand: '#bfa77c',
    stone: '#a19a8c',
    pillar: '#9e3b2f',
    red: '#a2483c',
    blue: '#4d6b8a',
  };
  const BX = 18;
  const BZ = 34;
  const PH = 1.6; // balkon yüksekliği
  arena(box, BX, BZ, 5, C.ground, C.wall);
  box(0, -BZ - 0.25, BX * 2 + 1, 0.7, 0.25, C.cap, { y: 5 });
  box(-BX - 0.25, 0, 0.7, BZ * 2 + 1, 0.25, C.cap, { y: 5, mirror: false });
  box(BX + 0.25, 0, 0.7, BZ * 2 + 1, 0.25, C.cap, { y: 5, mirror: false });

  // Zemin karoları (görünüm): dama deseni
  for (let x = -16; x <= 16; x += 4) {
    for (let z = -24; z <= -2; z += 4) box(x + ((z / 4) % 2 ? 2 : 0), z, 2, 2, 0.02, C.tile, { solid: false });
  }

  // Doğuş balkonu + ön siper (merdiven ağızlarında boşluk)
  rect(-BX, BX, -BZ, -27, 0, PH, C.plat);
  box(0, -27.1, BX * 2, 0.2, 0.05, C.red, { y: PH, solid: false, mirrorColor: C.blue });
  for (const [a, b] of [[-BX, -7.4], [-4.6, 4.6], [7.4, BX]]) {
    rect(a, b, -27.4, -27, PH, 0.95, C.sand);
  }
  for (const sx of [-1, 1]) stairs(sx * 6, -21, 'z', -1, 2.4, 6, PH, C.stone);
  // Balkonda alçak sandıklar (çömelip saklanmak için)
  for (const sx of [-1, 1]) {
    box(sx * 10, -29.2, 1.1, 1.1, 1.0, C.crate, { y: PH });
    box(sx * 15.5, -31, 1.6, 1.6, 1.4, C.crate, { y: PH });
  }
  box(0, -BZ + 0.15, 8, 0.2, 2.2, C.red, { y: PH + 1, mirrorColor: C.blue, solid: false });

  // Köşe nişancı kuleleri (balkonun önünde, merdiven balkon tarafında)
  for (const sx of [-1, 1]) tower(sx * 14.5, -17, 3, 3.4, C.wood, { rail: C.cap, stairColor: C.wood });

  // Sandıklar
  const crate = (x, z, s, h = s, o = {}) => {
    box(x, z, s, s, h, C.crate, o);
    box(x, z, s + 0.04, s + 0.04, 0.12, C.band, { ...o, y: (o.y ?? 0) + h * 0.5 - 0.06, solid: false });
  };
  for (const sx of [-1, 1]) {
    crate(sx * 9, -13, 1.6);
    box(sx * 3.5, -17, 3, 0.7, 1.0, C.stone); // çömelme siperi
    box(sx * 15.5, -8, 2, 2, 2.4, C.crate); // uzun sandık
    box(sx * 7, -6, 2.5, 0.8, 1.1, C.sand); // kum torbası
  }
  // Jump-peek yığını: önce küçük sandığa, sonra üstüne
  crate(0, -11, 1.2, 0.9);
  crate(0.3, -11.4, 1.0, 0.8, { y: 0.9 });

  // Orta bölme duvar: ortada kapı, iki pencere; iki yanda açık koridorlar
  wall(
    'z',
    0,
    -14,
    14,
    3,
    [
      { a: -1.1, b: 1.1, y0: 0, y1: 2.4 },
      { a: -8, b: -6, y0: 1.15, y1: 1.85 },
      { a: 6, b: 8, y0: 1.15, y1: 1.85 },
    ],
    C.wall2,
    { mirror: false },
  );
  box(0, 0, 28.6, 0.6, 0.2, C.cap, { y: 3, mirror: false });
  box(-14, 0, 0.9, 0.9, 3.4, C.pillar, { mirror: false });
  box(14, 0, 0.9, 0.9, 3.4, C.pillar, { mirror: false });
  // Koridorlarda tek sandık (yarım siper)
  crate(-16.3, 2.5, 1.2);
  crate(16.3, -2.5, 1.2);

  // Duvarlarda nişan tahtaları (görünüm)
  for (const x of [-11, 11]) target(box, x, -BZ, 3.6, 'z', 1.8);
  for (const x of [-11, 11]) target(box, x, BZ, 3.6, 'z', 1.8);
  for (const z of [-12, 12]) target(box, -BX, z, 3.4, 'x');
  for (const z of [-12, 12]) target(box, BX, z, 3.4, 'x');

  const list = [[-12, -31.5], [-8, -32.5], [-4, -31], [0, -32.5], [4, -31], [8, -32.5], [12, -31.5], [0, -29.5]];
  return {
    id: 'aim',
    name: 'NİŞAN ARENASI',
    forceLoadout: { primary: 'awp' },
    boxes,
    pads,
    spawns: spawnsFrom(list, PH + 0.1),
    flags: flagsFrom(0, -33.2, PH + 0.1),
    bounds: { x: BX - 0.6, z: BZ - 0.6, minY: -5, maxY: 20 },
    sky: '#e9dfc8',
  };
}

// ======================================================================
// AVLU — iki geleneksel ev karşılıklı; aradaki avluda kuyu ve havuz, pazar tezgâhları, ağaçlar, at arabası.
// Evlerin içinden geçilir, dış merdivenle çatıya çıkılır (çatıda siper var). İki yanda sütunlu revaklar.
// ======================================================================
export function courtyard(builder) {
  const { boxes, pads, box, hut } = builder();
  const C = {
    ground: '#d6c8a8',
    stone: '#c3b597',
    plaster: '#ece3cf',
    base: '#9c9488',
    pillar: '#9e3b2f',
    roof: '#5a606b',
    wood: '#8a6a4b',
    wood2: '#a7845e',
    floor: '#9a7a58',
    cloth: '#6f9a8d',
    cloth2: '#c9a24f',
    jar: '#7d5a40',
    trunk: '#6b5440',
    leaf: '#7f9a6a',
    leaf2: '#93ab7c',
    well: '#8f8a80',
    water: '#7fa7b5',
    lantern: '#c0503d',
    hay: '#d1b25a',
    red: '#a2483c',
    blue: '#4d6b8a',
  };
  const BX = 22;
  const BZ = 32;
  arena(box, BX, BZ, 3.4, C.ground, C.base);
  box(0, -BZ - 0.25, BX * 2 + 1.4, 0.9, 0.3, C.roof, { y: 3.4 });
  box(-BX - 0.25, 0, 0.9, BZ * 2 + 1.4, 0.3, C.roof, { y: 3.4, mirror: false });
  box(BX + 0.25, 0, 0.9, BZ * 2 + 1.4, 0.3, C.roof, { y: 3.4, mirror: false });

  // Avlu taş yolları (görünüm)
  box(0, 0, 3, 40, 0.02, C.stone, { mirror: false, solid: false });
  box(0, 0, 30, 3, 0.02, C.stone, { mirror: false, solid: false });

  // Ev: avluya bakan iki kapı + pencere, arkada kapı (doğuş bahçesine), doğu yüzünde çatı merdiveni
  hut(0, -23, 14, 6, 3.2, C.plaster, {
    doors: [{ side: 'n', at: -3.5 }, { side: 'n', at: 3.5 }, { side: 's', at: 0, w: 1.6 }],
    windows: [{ side: 'n', at: 0, w: 1.6 }, { side: 'w', at: 0 }],
    roof: C.roof,
    floor: C.floor,
    roofStairs: 'e',
    stairColor: C.stone,
    capColor: C.base,
  });
  // Saçak ve kırmızı sütunlar (ön cephe)
  box(0, -19.6, 14.4, 1.4, 0.2, C.roof, { y: 3.3 });
  for (const x of [-6.4, -1.7, 1.7, 6.4]) box(x, -19.1, 0.3, 0.3, 3.3, C.pillar);
  // İç: masa, sandık
  box(-4.4, -24.3, 2, 1, 0.8, C.wood);
  box(4.6, -24.5, 1.2, 1.2, 1.2, C.wood2);
  // Kapı fenerleri (görünüm)
  for (const x of [-3.5, 3.5]) box(x + 1.1, -19.4, 0.35, 0.35, 0.5, C.lantern, { y: 2.3, solid: false });

  // Orta: kuyu + etrafında alçak havuz kenarı (köşelerden geçilir)
  box(0, 0, 2.2, 2.2, 0.9, C.well, { mirror: false });
  box(-0.95, 0, 0.2, 0.2, 2.2, C.wood, { mirror: false });
  box(0.95, 0, 0.2, 0.2, 2.2, C.wood, { mirror: false });
  box(0, 0, 2.6, 1.4, 0.15, C.roof, { y: 2.2, mirror: false });
  box(0, 0, 6.4, 6.4, 0.03, C.water, { mirror: false, solid: false });
  box(0, -3.4, 5, 0.5, 0.6, C.stone);
  box(-3.4, 0, 0.5, 5, 0.6, C.stone, { mirror: false });
  box(3.4, 0, 0.5, 5, 0.6, C.stone, { mirror: false });

  // İki yanda sütunlu revaklar: üstü kapalı, yan duvara yaslı koridor
  for (const sx of [-1, 1]) {
    box(sx * 19.6, 0, 5, 30, 0.25, C.roof, { y: 3.1, mirror: false });
    for (let z = -14; z <= 14; z += 4) box(sx * 17.3, z, 0.45, 0.45, 3.1, C.pillar, { mirror: false });
    for (const z of [-10, 2]) box(sx * 17.3, z + 2, 0.6, 1.8, 0.8, C.stone, { mirror: false }); // saksılık
    for (const z of [-6, 6]) box(sx * 20.5, z, 0.9, 0.9, 1.1, C.jar, { mirror: false }); // küpler
  }

  // Pazar tezgâhları: masa + direkler + tente
  const stall = (x, z, cloth) => {
    box(x, z, 3.2, 1.2, 0.9, C.wood);
    box(x, z, 3.2, 1.2, 0.1, C.wood2, { y: 0.9, solid: false });
    box(x - 0.5, z, 0.5, 0.5, 0.35, C.jar, { y: 1.0 });
    box(x + 0.6, z, 0.7, 0.5, 0.25, C.cloth2, { y: 1.0 });
    for (const dx of [-1.55, 1.55]) box(x + dx, z + 0.7, 0.12, 0.12, 2.4, C.wood);
    box(x, z + 0.2, 3.6, 1.9, 0.08, cloth, { y: 2.4 });
  };
  stall(-10, -8, C.cloth);
  stall(10, -8, C.cloth2);

  // At arabası (saman yüklü) ve fıçılar
  box(-7, -13, 3.2, 1.6, 0.5, C.wood, { y: 0.6 });
  box(-7, -13, 2.8, 1.3, 0.8, C.hay, { y: 1.1 });
  for (const dx of [-1, 1]) box(-7 + dx * 1.1, -13, 0.25, 1.9, 0.9, C.trunk);
  for (const [x, z] of [[-14.5, -16], [-13.6, -16.6], [13.4, -17], [6, -4], [-6, -3.5], [9, -14]]) box(x, z, 0.9, 0.9, 1.1, C.jar);
  box(13, -3, 2.4, 1.4, 1.3, C.wood2); // sandık yığını
  box(13.2, -3, 1.2, 1.2, 1.1, C.wood, { y: 1.3 });

  // Ağaçlar: gövde + iki katlı yaprak (yapraklar havada, altından geçilir)
  const tree = (x, z) => {
    box(x, z, 0.5, 0.5, 3.4, C.trunk);
    box(x, z, 3.2, 3.2, 1.4, C.leaf, { y: 3.0, solid: false });
    box(x + 0.3, z - 0.2, 2.2, 2.2, 1.0, C.leaf2, { y: 4.2, solid: false });
  };
  tree(-12.5, -12);
  tree(13, -11);
  tree(-8, -2);

  // Doğuş bahçesi: takım renkli yaygı ve çit
  box(0, -29.4, 10, 2.2, 0.03, C.red, { solid: false, mirrorColor: C.blue });
  for (const sx of [-1, 1]) box(sx * 15, -27, 0.6, 5, 1.2, C.leaf);

  const list = [[-5, -29], [-2.5, -30], [0, -29], [2.5, -30], [5, -29], [-11, -29], [11, -29.5], [-8.5, -30.5]];
  return {
    id: 'yard',
    name: 'AVLU',
    boxes,
    pads,
    spawns: spawnsFrom(list),
    flags: flagsFrom(0, -30.8),
    bounds: { x: BX - 0.6, z: BZ - 0.6, minY: -5, maxY: 18 },
    sky: '#ebe1ca',
  };
}

// ======================================================================
// SIFIR YERÇEKİMİ — büyük uzay istasyonu (düşük yerçekimi: zıplama ~2 kat yüksek, düşüş yavaş).
// Her takım arkadaki kalkış hangarında, mekiğin yanında doğar. Hangardan üç yol çıkar:
//  · Sol koridor → A bölgesi: KONTROL MERKEZİ (komuta güvertesi, konsol sıraları, dev ekran, iç balkon)
//  · Orta → atrium → CAM KORİDOR (kurşun geçirmez cam; dışında hidroponik bahçe ve kriyo deposu görünür)
//  · Sağ koridor → B bölgesi: REAKTÖR ODASI (dev reaktör çekirdeği, etrafında yüksek halka iskele, soğutma tankları)
// Yollar arasında içinden geçilen yaşam modülü (sol) ve laboratuvar (sağ); atriumdaki itme pedleri modül çatılarına atar.
// Cam koridorun ortasındaki yan kapılar A ve B'ye kısa bağlantı verir. A ve B, Z=0'da ortalandığı için iki takıma eşit uzaklıktadır.
// ======================================================================
export function spaceStation(builder) {
  const { boxes, pads, box, rect, wall, stairs, hut, pad } = builder();
  const C = {
    floor: '#b8c0cc',
    floor2: '#a6afbd',
    floorMid: '#c9d3df',
    hull: '#8d99ae',
    hull2: '#77849b',
    trim: '#4a5468',
    panel: '#d9dee6',
    panel2: '#c3cad6',
    deck: '#9aa5b8',
    space: '#1d2440',
    star: '#f4f1de',
    hazard: '#d9b84a',
    dark: '#2b2f3a',
    accent: '#e07a3f',
    screen: '#5fb8c9',
    screen2: '#8fd3df',
    screenDark: '#2f5d6b',
    holo: '#7fe0ee',
    core: '#58c4d6',
    glow: '#b4eef5',
    glass: '#a8d8e8',
    pipe: '#a07c58',
    tank: '#c9ced6',
    cargo: '#c0503d',
    cargo2: '#4d6b8a',
    cargo3: '#6f9a6a',
    crate: '#9b7653',
    plant: '#6f9a5a',
    plant2: '#8fb86f',
    planter: '#7a6a58',
    grow: '#b07fd0',
    bunk: '#6c7a91',
    sheet: '#e8e1d2',
    locker: '#9aa5b8',
    led: '#7cc47a',
    ledRed: '#d0503d',
    red: '#b5483c',
    blue: '#4d6b8a',
  };
  const BX = 42;
  const BZ = 60;
  const H = 9; // gövde duvarı
  const RH = 6; // A / B oda duvarı

  // ---------------- Zemin ve gövde ----------------
  box(0, 0, 400, 400, 1, C.floor, { y: -1, mirror: false });
  box(0, -BZ - 0.25, BX * 2 + 1, 0.5, H, C.hull);
  box(-BX - 0.25, 0, 0.5, BZ * 2 + 1, H, C.hull, { mirror: false });
  box(BX + 0.25, 0, 0.5, BZ * 2 + 1, H, C.hull, { mirror: false });
  box(0, -BZ - 0.25, BX * 2 + 1.4, 0.9, 0.4, C.trim, { y: H });
  box(-BX - 0.25, 0, 0.9, BZ * 2 + 1.4, 0.4, C.trim, { y: H, mirror: false });
  box(BX + 0.25, 0, 0.9, BZ * 2 + 1.4, 0.4, C.trim, { y: H, mirror: false });
  // Zemin plakaları (görünüm)
  for (let x = -40; x <= 40; x += 4) box(x, 0, 0.08, BZ * 2, 0.012, C.floor2, { mirror: false, solid: false });
  for (let z = -58; z <= -2; z += 4) box(0, z, BX * 2, 0.08, 0.012, C.floor2, { solid: false });
  // Duvar dibi şeridi
  box(0, -BZ + 0.08, BX * 2, 0.12, 0.5, C.trim, { solid: false });
  box(-BX + 0.08, 0, 0.12, BZ * 2, 0.5, C.trim, { solid: false, mirror: false });
  box(BX - 0.08, 0, 0.12, BZ * 2, 0.5, C.trim, { solid: false, mirror: false });

  // Lomboz: uzaya bakan pencere (lacivert, birkaç yıldız)
  const STARS = [[-0.7, 0.4], [0.5, -0.3], [0.1, 0.5], [-0.3, -0.5], [0.8, 0.3]];
  const porthole = (x, z, side) => {
    // side: 'x-' / 'x+' yan duvarlar, 'z' arka duvar (aynalanır)
    const o = { solid: false, y: 3.4 };
    if (side === 'z') {
      box(x, z + 0.04, 3, 0.08, 2.2, C.trim, { ...o, y: 3.3 });
      box(x, z + 0.1, 2.6, 0.08, 1.8, C.space, o);
      for (const [a, b] of STARS) box(x + a, z + 0.16, 0.1, 0.04, 0.1, C.star, { solid: false, y: 4.25 + b });
    } else {
      const s = side === 'x-' ? 1 : -1;
      box(x + s * 0.04, z, 0.08, 3, 2.2, C.trim, { ...o, y: 3.3 });
      box(x + s * 0.1, z, 0.08, 2.6, 1.8, C.space, o);
      for (const [a, b] of STARS) box(x + s * 0.16, z + a, 0.04, 0.1, 0.1, C.star, { solid: false, y: 4.25 + b });
    }
  };
  for (const x of [-30, -14, 14, 30]) porthole(x, -BZ, 'z');
  for (const z of [-52, -36, -24]) {
    porthole(-BX, z, 'x-');
    porthole(BX, z, 'x+');
  }

  // ---------------- Kalkış hangarı (doğuş) ----------------
  const DOORS = [[-37, -29], [-6, 6], [29, 37]];
  wall('z', -46, -BX, BX, 7, DOORS.map(([a, b]) => ({ a, b, y0: 0, y1: 4.2 })), C.hull2);
  for (const [a, b] of DOORS) {
    box((a + b) / 2, -46, b - a + 0.6, 0.45, 0.35, C.hazard, { y: 4.2, solid: false });
    box(a - 0.3, -46, 0.5, 0.5, 4.2, C.trim);
    box(b + 0.3, -46, 0.5, 0.5, 4.2, C.trim);
  }
  // Takım şeridi ve iniş alanı çizgileri
  box(0, -BZ + 0.15, 16, 0.2, 1.2, C.red, { y: 5.4, mirrorColor: C.blue, solid: false });
  for (const [x, z, w, d] of [[0, -59, 18, 0.25], [0, -48.5, 18, 0.25], [-9, -53.75, 0.25, 10.5], [9, -53.75, 0.25, 10.5]]) {
    box(x, z, w, d, 0.02, C.hazard, { solid: false });
  }
  // Mekik: gövde, burun, kokpit camı, kanatlar, kuyruk, motorlar, iniş ayakları
  box(0, -55, 6, 8, 2.6, C.panel, { y: 0.8 });
  box(0, -55, 6.2, 1, 0.3, C.accent, { y: 2.6, solid: false });
  box(0, -50.4, 4, 1.4, 1.9, C.panel, { y: 1.0 });
  box(0, -49.65, 3, 0.12, 0.8, C.screenDark, { y: 2.0, solid: false });
  for (const sx of [-1, 1]) {
    box(sx * 4.6, -56, 3.2, 4, 0.3, C.panel2, { y: 1.4 });
    box(sx * 6, -56.8, 0.3, 2.2, 0.6, C.accent, { y: 1.7 });
    box(sx * 1.6, -59.3, 1.3, 0.7, 1.3, C.trim, { y: 1.2 });
    for (const sz of [-1, 1]) box(sx * 2.2, -55 + sz * 3, 0.4, 0.4, 0.8, C.trim);
  }
  box(0, -58.5, 0.4, 1.8, 2.2, C.accent, { y: 3.4 });
  // Hangar sandıkları ve yakıt varilleri
  const crate = (x, z, s, h = s, o = {}) => {
    box(x, z, s, s, h, C.crate, o);
    box(x, z, s + 0.04, s + 0.04, 0.12, C.dark, { ...o, y: (o.y ?? 0) + h * 0.5 - 0.06, solid: false });
  };
  crate(-24, -52, 1.6);
  crate(-24.3, -52.2, 1.1, 1.1, { y: 1.6 });
  crate(-21.6, -52.6, 1.2);
  crate(24, -50, 1.6);
  crate(26, -55, 1.2);
  for (const [x, z] of [[-35, -56], [-36.2, -56.6], [35.5, -57], [36.6, -56.2]]) box(x, z, 1, 1, 1.4, C.core);
  // Hava kilidi kapıları (görünüm) ve yan konsollar
  box(-BX + 0.15, -53, 0.2, 3, 3.4, C.hazard, { solid: false });
  box(BX - 0.15, -53, 0.2, 3, 3.4, C.hazard, { solid: false });
  box(-38, -49, 2.4, 1, 1, C.panel);
  box(-38, -49.4, 2.2, 0.1, 0.7, C.screen, { y: 1, solid: false });

  // ---------------- Sol yaşam modülü (yollar arası, içinden geçilir) ----------------
  hut(-16, -31, 14, 22, 4.2, C.panel, {
    doors: [{ side: 'w', at: -5 }, { side: 'w', at: 6 }, { side: 'e', at: 0, w: 1.8 }, { side: 's', at: 0 }],
    windows: [{ side: 'e', at: -6 }, { side: 'e', at: 6 }, { side: 'w', at: 0.5 }, { side: 'n', at: -3 }, { side: 'n', at: 3 }],
    roof: C.hull2,
    floor: C.floor2,
  });
  // Ranzalar, dolaplar, yemek masası
  for (const z of [-40.6, -37.2]) {
    box(-21.3, z, 2.6, 1.4, 0.7, C.bunk);
    box(-21.3, z, 2.4, 1.2, 0.08, C.sheet, { y: 0.7, solid: false });
    box(-21.3, z, 2.6, 1.4, 0.15, C.bunk, { y: 1.9 });
    box(-22.5, z, 0.15, 1.4, 1.9, C.trim);
  }
  for (let i = 0; i < 4; i++) box(-10.4, -40.5 + i * 1.05, 0.8, 1, 2.2, C.locker);
  box(-16, -27, 3.2, 1.6, 0.85, C.trim);
  box(-16, -25.6, 3, 0.5, 0.45, C.panel2);
  box(-16, -28.4, 3, 0.5, 0.45, C.panel2);
  box(-20.5, -21, 3, 1, 1, C.panel2); // mutfak tezgâhı
  box(-20.5, -21.4, 2.6, 0.1, 0.5, C.screen, { y: 1.3, solid: false });

  // ---------------- Sağ laboratuvar modülü ----------------
  hut(16, -31, 14, 22, 4.2, C.panel, {
    doors: [{ side: 'e', at: -5 }, { side: 'e', at: 6 }, { side: 'w', at: 0, w: 1.8 }, { side: 's', at: 0 }],
    windows: [{ side: 'w', at: -6 }, { side: 'w', at: 6 }, { side: 'e', at: 0.5 }, { side: 'n', at: -3 }, { side: 'n', at: 3 }],
    roof: C.hull2,
    floor: C.floor2,
  });
  // Deney tezgâhları, numune tüpleri (cam), robot kol
  for (const z of [-38, -33]) {
    box(16, z, 7, 1.2, 0.95, C.panel2);
    for (const dx of [-2.4, -0.8, 0.8, 2.4]) {
      box(16 + dx, z, 0.6, 0.6, 0.9, C.glass, { y: 0.95, glass: true });
      box(16 + dx, z, 0.4, 0.4, 0.5, dx < 0 ? C.plant2 : C.core, { y: 1.0, solid: false });
    }
  }
  box(13, -24.5, 1.2, 1.2, 0.8, C.trim); // robot kol tabanı
  box(13, -24.5, 0.35, 0.35, 1.6, C.accent, { y: 0.8 });
  box(13.8, -24.5, 1.6, 0.3, 0.3, C.accent, { y: 2.3, solid: false });
  box(21.5, -21, 1, 3, 2.2, C.locker);

  // ---------------- Atrium (orta yolun başı) ----------------
  box(0, -36, 2, 2, 1.1, C.trim);
  box(0, -36, 1.5, 1.5, 1.8, C.holo, { y: 1.1, solid: false }); // hologram
  for (const sx of [-1, 1]) {
    box(sx * 5.5, -30, 1, 3, 0.5, C.panel2); // bank
    box(sx * 6, -41, 2, 2, 0.8, C.planter);
    box(sx * 6, -41, 1.6, 1.6, 1.4, C.plant, { y: 0.8, solid: false });
  }
  // İtme pedleri: modül çatılarına fırlatır (düşük yerçekiminde)
  pad(-4.5, -27, [-7, 11, 0]);
  pad(4.5, -27, [7, 11, 0]);

  // ---------------- Yan koridorlar (A ve B yolları) ----------------
  // Sol: kargo konteynerleri (önlerindeki sandıktan üstlerine çıkılır)
  box(-36, -39, 5, 2.4, 2.6, C.cargo);
  box(-36, -39, 5.1, 0.2, 0.2, C.dark, { y: 1.3, solid: false });
  crate(-32.7, -39.6, 1.2);
  box(-29.5, -30, 2.4, 5, 2.6, C.cargo2);
  crate(-29.5, -26.8, 1.2);
  box(-39.5, -24, 2.6, 2.6, 2.6, C.cargo3);
  crate(-26, -19.5, 1.4);
  box(-41.4, -32, 0.6, 26, 0.5, C.pipe, { y: 2.2, solid: false });
  box(-41.4, -32, 0.6, 26, 0.5, C.pipe, { y: 3.0, solid: false });
  // Sağ: yakıt tankları ve borular
  for (const z of [-40, -34]) {
    box(38.5, z, 3, 3, 4, C.tank);
    box(38.5, z, 3.1, 3.1, 0.3, C.accent, { y: 1.2, solid: false });
    box(38.5, z, 3.1, 3.1, 0.3, C.accent, { y: 3.0, solid: false });
  }
  box(37, -37, 0.5, 3, 0.5, C.pipe, { y: 3.4, solid: false });
  crate(31, -28, 1.6);
  crate(33.4, -22.5, 1.2);
  box(27, -36, 1.6, 3, 1.1, C.hull2); // alçak siper
  box(41.4, -30, 0.6, 30, 0.5, C.pipe, { y: 2.6, solid: false });

  // ---------------- Cam koridor (orta) ----------------
  const PIL = [-22, -18, -14, -10, -6, -2, 2, 6, 10, 14, 18, 22];
  for (const sx of [-1, 1]) {
    const x = sx * 3.5;
    for (const z of PIL) box(x, z, 0.45, 0.45, 4.2, C.trim, { mirror: false });
    for (let i = 0; i < PIL.length - 1; i++) {
      const a = PIL[i];
      const b = PIL[i + 1];
      if (a === -2) continue; // ortada A / B bağlantı kapısı
      box(x, (a + b) / 2, 0.12, b - a - 0.45, 4, C.glass, { glass: true, mirror: false });
      box(x, (a + b) / 2, 0.3, b - a - 0.45, 0.3, C.trim, { mirror: false }); // alt çerçeve
    }
    box(x, 0, 0.45, 4.4, 0.6, C.trim, { y: 3.6, mirror: false }); // kapı lentosu
    box(x, 0, 0.5, 4, 0.2, C.hazard, { y: 3.4, solid: false, mirror: false });
    box(sx * 3.15, 0, 0.12, 44, 0.06, C.screen2, { solid: false, mirror: false }); // zemin ışık şeridi
  }
  // Cam tavan ve kirişler
  for (let i = 0; i < PIL.length - 1; i++) {
    const a = PIL[i];
    const b = PIL[i + 1];
    box(0, (a + b) / 2, 7.4, b - a - 0.3, 0.12, C.glass, { y: 4.2, glass: true, mirror: false });
  }
  for (const z of PIL) box(0, z, 7.4, 0.3, 0.3, C.trim, { y: 4.2, mirror: false });
  box(0, 0, 3, 44, 0.02, C.floorMid, { solid: false, mirror: false }); // koridor halısı
  // Koridor içi siperler (aynalı)
  box(-1.7, -10, 1.6, 1, 1.1, C.hull2);
  box(1.8, -17, 1.4, 1.4, 1.1, C.crate);

  // Bağlantı yolları (koridor ↔ A / B) ve bahçe duvarları.
  // Bahçelerin iki kapısı var (yaklaşma alanına ve bağlantı yoluna): düşük yerçekiminde içine
  // atlayan kapalı kalmasın, ayrıca koridorun yanında ara yol olsun.
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -13.85 : 3.75;
    const x1 = sx < 0 ? -3.75 : 13.85;
    const mid = (x0 + x1) / 2;
    // Pencere dış tarafta, kapı koridorun yanında
    const win = sx < 0 ? [-12.3, -6.6] : [6.6, 12.3];
    const door = sx < 0 ? [-5.8, -4.2] : [4.2, 5.8];
    const open = [{ a: win[0], b: win[1], y0: 1, y1: 3 }, { a: door[0], b: door[1], y0: 0, y1: 2.6 }];
    const wc = (win[0] + win[1]) / 2;
    const ww = win[1] - win[0];
    for (const z of [-2.2, -14]) {
      wall('z', z, x0, x1, 4.2, open, C.hull2);
      box(wc, z, ww, 0.1, 2, C.glass, { y: 1, glass: true });
      box((door[0] + door[1]) / 2, z, door[1] - door[0] + 0.3, 0.4, 0.25, C.hazard, { y: 2.6, solid: false });
      box(mid, z, x1 - x0, 0.6, 0.25, C.trim, { y: 4.2 });
    }
  }
  // Sol bahçe: hidroponik yataklar, mor büyütme lambaları, küçük ağaç
  for (const z of [-11.5, -8.2, -5]) {
    box(-9.5, z, 6, 1.2, 0.7, C.planter);
    for (let x = -12; x <= -6.8; x += 1.7) box(x, z, 1.1, 0.9, 0.7, (x * 10) % 2 ? C.plant : C.plant2, { y: 0.7, solid: false });
    box(-9.5, z, 6, 0.2, 0.1, C.grow, { y: 3.2, solid: false });
  }
  box(-12.9, -12.9, 0.4, 0.4, 2.4, C.planter);
  box(-12.4, -12.4, 2, 2, 1.4, C.plant2, { y: 2.2, solid: false });
  // Sağ bahçe: kriyo kapsülleri (cam) ve gaz tüpleri
  for (const x of [6.5, 9, 11.5]) {
    box(x, -11.5, 1.4, 1.4, 0.3, C.trim);
    box(x, -11.5, 1.2, 1.2, 2.2, C.glass, { y: 0.3, glass: true });
    box(x, -11.5, 0.6, 0.6, 1.6, C.glow, { y: 0.5, solid: false });
  }
  for (const x of [6, 8, 10, 12]) box(x, -5, 0.9, 0.9, 1.8, x % 4 ? C.tank : C.accent);

  // ---------------- A BÖLGESİ: KONTROL MERKEZİ ----------------
  const AX0 = -BX;
  const AX1 = -14;
  wall('z', -14, AX0, AX1, RH, [{ a: -35, b: -30, y0: 0, y1: 3.6 }, { a: -20, b: -17.5, y0: 0, y1: 3 }], C.hull2);
  wall('x', AX1, -14, 14, RH, [{ a: -2, b: 2, y0: 0, y1: 3.6 }], C.hull2, { mirror: false });
  box((AX0 + AX1) / 2, -14, AX1 - AX0, 0.7, 0.3, C.trim, { y: RH });
  box(AX1, 0, 0.7, 28.6, 0.3, C.trim, { y: RH, mirror: false });
  box(-32.5, -14, 5.4, 0.45, 0.3, C.hazard, { y: 3.6, solid: false });
  // "A" levhası (kapı üstünde)
  box(-32.5, -14.3, 1.6, 0.1, 1.6, C.accent, { y: 4.1, solid: false });
  box(-32.5, -14.36, 0.25, 0.04, 1.2, C.panel, { y: 4.3, solid: false });
  // Komuta güvertesi (ortada, iki yandan merdiven) + hologram masa + koltuk
  box(-27, 0, 8, 6, 1.2, C.deck, { mirror: false });
  box(-27, 0, 8.2, 6.2, 0.1, C.hazard, { y: 1.15, solid: false, mirror: false });
  stairs(-27, -6, 'z', 1, 3, 3, 1.2, C.panel2);
  box(-27, 0, 3, 2, 0.9, C.trim, { y: 1.2, mirror: false });
  box(-27, 0, 2.6, 1.6, 1.3, C.holo, { y: 2.1, solid: false, mirror: false });
  box(-30, 0, 1, 1, 1.1, C.accent, { y: 1.2, mirror: false });
  // Konsol sıraları (ekranlı) ve sandalyeler
  for (const x of [-37, -32, -22, -17.5]) {
    box(x, -8.5, 3.4, 1, 1, C.panel);
    box(x, -8.95, 3.2, 0.12, 0.8, C.screen, { y: 1, solid: false });
    box(x - 0.8, -8.9, 0.8, 0.06, 0.3, C.screen2, { y: 1.3, solid: false });
    box(x, -7.4, 0.7, 0.7, 0.55, C.trim);
  }
  // Batı duvarında dev ekran (grafikler)
  box(-BX + 0.1, 0, 0.15, 16, 4.6, C.screenDark, { y: 1.4, solid: false, mirror: false });
  box(-BX + 0.2, -4, 0.05, 5, 2.4, C.screen, { y: 2.4, solid: false, mirror: false });
  box(-BX + 0.2, 3, 0.05, 6, 1, C.screen2, { y: 4.2, solid: false, mirror: false });
  box(-BX + 0.2, 3, 0.05, 6, 1, C.screen, { y: 2.6, solid: false, mirror: false });
  // Sütunlar ve sunucu dolapları (yanıp sönen ledler)
  for (const x of [-34, -21]) box(x, -5, 0.8, 0.8, RH, C.trim);
  for (const [x, w] of [[-38.6, 2.6], [-25, 5]]) {
    box(x, -13.3, w, 1, 2.6, C.dark);
    for (let i = 0; i < w / 0.6 - 1; i++) box(x - w / 2 + 0.5 + i * 0.6, -12.78, 0.12, 0.04, 0.12, i % 3 ? C.led : C.ledRed, { y: 1.6 + (i % 2) * 0.4, solid: false });
  }
  // İç balkon (doğu duvarı boyunca, iki uçta merdiven)
  rect(-17, -14.15, -10.5, 10.5, 2.8, 0.25, C.deck, { mirror: false });
  rect(-17.2, -17, -9, 9, 3.05, 0.9, C.trim, { mirror: false });
  stairs(-15.6, -13.6, 'z', 1, 2.6, 3.1, 2.8, C.panel2);
  box(-17, -10.3, 0.25, 0.25, 2.8, C.trim); // balkon ayakları
  box(-17, -3, 0.25, 0.25, 2.8, C.trim);

  // ---------------- B BÖLGESİ: REAKTÖR ODASI ----------------
  const BX0 = 14;
  const BX1 = BX;
  wall('z', -14, BX0, BX1, RH, [{ a: 30, b: 35, y0: 0, y1: 3.6 }, { a: 17.5, b: 20, y0: 0, y1: 3 }], C.hull2);
  wall('x', BX0, -14, 14, RH, [{ a: -2, b: 2, y0: 0, y1: 3.6 }], C.hull2, { mirror: false });
  box((BX0 + BX1) / 2, -14, BX1 - BX0, 0.7, 0.3, C.trim, { y: RH });
  box(BX0, 0, 0.7, 28.6, 0.3, C.trim, { y: RH, mirror: false });
  box(32.5, -14, 5.4, 0.45, 0.3, C.hazard, { y: 3.6, solid: false });
  // "B" levhası
  box(32.5, -14.3, 1.6, 0.1, 1.6, C.core, { y: 4.1, solid: false });
  box(32.2, -14.36, 0.25, 0.04, 1.2, C.panel, { y: 4.3, solid: false });
  // Reaktör: basamaklı taban, çekirdek, parlayan halkalar, koruma sütunları, kapak
  const RX = 28;
  box(RX, 0, 10, 10, 0.4, C.trim, { mirror: false });
  box(RX, 0, 8, 8, 0.4, C.deck, { y: 0.4, mirror: false });
  for (let i = 0; i < 10; i++) box(RX - 4.5 + i, -5.05, 0.5, 0.12, 0.02, i % 2 ? C.hazard : C.dark, { y: 0.4, solid: false });
  box(RX, 0, 3.6, 3.6, 13, C.core, { y: 0.8, mirror: false });
  for (const y of [2, 4.6, 7.2, 9.8, 12.4]) box(RX, 0, 4.4, 4.4, 0.35, C.glow, { y, solid: false, mirror: false });
  for (const sx of [-1, 1]) box(RX + sx * 3, -3, 0.6, 0.6, 10, C.trim, { y: 0.8 });
  box(RX, 0, 7, 7, 0.5, C.trim, { y: 10.8, mirror: false });
  // Halka iskele (y = 4): reaktörün çevresinde, ortası açık
  const RY = 4;
  rect(20, 36, -8, -3.5, RY, 0.25, C.deck);
  rect(20, 24.5, -3.5, 3.5, RY, 0.25, C.deck, { mirror: false });
  rect(31.5, 36, -3.5, 3.5, RY, 0.25, C.deck, { mirror: false });
  rect(20, 36, -8, -7.8, RY + 0.25, 0.9, C.trim); // dış korkuluk
  rect(20, 20.2, -8, 8, RY + 0.25, 0.9, C.trim, { mirror: false });
  rect(35.8, 36, -8, -6.6, RY + 0.25, 0.9, C.trim);
  rect(35.8, 36, -4.4, 4.4, RY + 0.25, 0.9, C.trim, { mirror: false });
  for (const [x, z] of [[20.3, -7.7], [35.7, -7.7], [20.3, -3.8], [35.7, -3.8]]) box(x, z, 0.35, 0.35, RY, C.trim);
  stairs(40.5, -5.5, 'x', -1, 2, 4.5, RY + 0.25, C.panel2); // iki uçta (aynalı) merdiven
  // Soğutma tankları, borular, kontrol konsolu, siperler
  for (const [x, z] of [[16.4, -8], [39.5, -11]]) {
    box(x, z, 2.4, 2.4, 5, C.tank);
    box(x, z, 2.5, 2.5, 0.3, C.core, { y: 1.5, solid: false });
    box(x, z, 2.5, 2.5, 0.3, C.core, { y: 3.5, solid: false });
  }
  box(22, -8, 9, 0.45, 0.45, C.pipe, { y: 6.2, solid: false });
  box(33.5, -11, 11, 0.45, 0.45, C.pipe, { y: 6.6, solid: false });
  box(17.6, -5, 1, 3, 1, C.panel);
  box(18.15, -5, 0.1, 2.8, 0.7, C.screen, { y: 1, solid: false });
  crate(34, -11.5, 1.4);
  crate(23, -11.5, 1.2);
  box(RX, -12, 4, 0.8, 1.1, C.hull2);
  // Uyarı ışıkları (duvarlarda)
  for (const x of [22, 38]) box(x, -13.8, 0.4, 0.15, 0.4, C.ledRed, { y: 5, solid: false });

  // ---------------- Doğuş noktaları ve bayraklar ----------------
  const list = [[-16, -52], [-12, -49], [-9, -55], [9, -55], [12, -49], [16, -52], [-19, -57], [19, -57]];
  return {
    id: 'station',
    name: 'SIFIR YERÇEKİMİ',
    indoor: true,
    gravity: 0.5, // düşük yerçekimi
    boxes,
    pads,
    spawns: spawnsFrom(list),
    flags: flagsFrom(-12, -57),
    bounds: { x: BX - 0.6, z: BZ - 0.6, minY: -5, maxY: 30 },
    sky: '#1a2140',
  };
}
