// Eğlence haritaları: küçük, hızlı, tek fikre dayalı haritalar (keskin nişancı düellosu, nişan arenası,
// avlu çatışması, dev oda). Hepsi özgün tasarım; renkleri el çizimi / suluboya görünümüne uygun soluk tonlar.
// Kırmızı takım -Z, mavi takım +Z tarafında; haritalar Z=0'a göre aynalanır.
// builder: maps.js'teki kutu yardımcıları (bkz. builder()).

const spawnsFrom = (list, y = 0.1) => ({
  red: list.map(([x, z]) => [x, y, z, Math.PI]),
  blue: list.map(([x, z]) => [x, y, -z, 0]),
});
const flagsFrom = (x, z, y = 0.1) => ({ red: [x, y, z], blue: [x, y, -z] });

/** Dört yanı kapatan sınır duvarları + zemin */
function arena(box, BX, BZ, h, ground, wall) {
  box(0, 0, 200, 200, 1, ground, { y: -1, mirror: false });
  box(0, -BZ - 0.25, BX * 2 + 1, 0.5, h, wall); // aynalanınca +Z duvarı da olur
  box(-BX - 0.25, 0, 0.5, BZ * 2 + 1, h, wall, { mirror: false });
  box(BX + 0.25, 0, 0.5, BZ * 2 + 1, h, wall, { mirror: false });
}

// ======================================================================
// NİŞANCI DÜELLOSU — uzun, açık bir vadi. Sadece AWP (+ tabanca, bıçak).
// Her takımın önünde çömelince saklanılan kum torbası siperi, iki yanda nişancı kuleleri,
// ortada dağınık kayalar, alçak duvarlar ve yıkık bir kemer.
// ======================================================================
export function sniperDuel(builder) {
  const { boxes, pads, box, rect, tower } = builder();
  const C = {
    ground: '#d8c8a4',
    path: '#cdb98f',
    wall: '#9c8b74',
    cap: '#6e6152',
    sand: '#bfa77c',
    sand2: '#ad9469',
    rock: '#8f8c84',
    rock2: '#a39f95',
    wood: '#8a6a4b',
    roof: '#5b6270',
    red: '#a2483c',
    blue: '#4d6b8a',
    grass: '#9aa67a',
  };
  const BX = 14;
  const BZ = 38;
  arena(box, BX, BZ, 4.5, C.ground, C.wall);
  box(0, -BZ - 0.25, BX * 2 + 1, 0.6, 0.3, C.cap, { y: 4.5 });

  // Ortadaki toprak yol (sadece görünüm)
  box(0, 0, 4, BZ * 2 - 6, 0.02, C.path, { mirror: false, solid: false });

  // Üs: arka duvarda takım renginde bayrak şeridi ve barınak
  box(0, -BZ + 0.15, 8, 0.2, 2.6, C.red, { y: 1, mirrorColor: C.blue, solid: false });
  box(-10.5, -BZ + 3, 5, 6, 3, C.wall); // köşe barınakları (dolu)
  box(10.5, -BZ + 3, 5, 6, 3, C.wall);
  box(-10.5, -BZ + 3, 5.4, 6.4, 0.3, C.roof, { y: 3 });
  box(10.5, -BZ + 3, 5.4, 6.4, 0.3, C.roof, { y: 3 });

  // Kum torbası siperi: ayakta üstünden ateş edilir, çömelince saklanılır; arada geçiş boşlukları
  for (const [a, b] of [[-8, -3.2], [-1.6, 1.6], [3.2, 8]]) {
    rect(a, b, -27.4, -26.6, 0, 1.0, C.sand);
    rect(a + 0.2, b - 0.2, -27.3, -26.7, 1.0, 0.12, C.sand2);
  }

  // Yan nişancı kuleleri (merdiveni üs tarafında)
  tower(-11, -20, 3, 3.2, C.wood, { rail: C.cap, stairColor: C.wood });
  tower(11, -20, 3, 3.2, C.wood, { rail: C.cap, stairColor: C.wood });
  box(-11, -20, 3.4, 3.4, 0.25, C.roof, { y: 5.6 });
  box(11, -20, 3.4, 3.4, 0.25, C.roof, { y: 5.6 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(-11 + sx * 1.55, -20 + sz * 1.55, 0.15, 0.15, 2.4, C.wood, { y: 3.2 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(11 + sx * 1.55, -20 + sz * 1.55, 0.15, 0.15, 2.4, C.wood, { y: 3.2 });

  // Orta saha: kayalar ve alçak duvarlar (yarım siper)
  box(-5.5, -16, 2.2, 1.8, 2.2, C.rock);
  box(-5.2, -16.2, 1.4, 1.2, 0.6, C.rock2, { y: 2.2 });
  box(6, -13, 1.6, 2.4, 1.6, C.rock2);
  box(-1.5, -19, 3, 0.8, 1.1, C.sand);
  box(9, -8, 3.2, 0.8, 1.1, C.sand);
  box(-9, -7, 1.6, 1.6, 2.6, C.rock);
  box(2.5, -7.5, 1.2, 1.2, 1.2, C.rock2);
  box(-4, -4, 3.5, 0.6, 1.0, C.cap);

  // Tam ortada yıkık kemer: iki ayak + üst kiriş (altından geçilir), yanlarda alçak duvar
  box(-2.6, 0, 1, 1.2, 3.2, C.wall, { mirror: false });
  box(2.6, 0, 1, 1.2, 3.2, C.wall, { mirror: false });
  box(0, 0, 6.6, 1.2, 0.6, C.cap, { y: 3.2, mirror: false });
  box(-8, 0, 4, 0.7, 1.2, C.wall, { mirror: false });
  box(8, 0, 4, 0.7, 1.2, C.wall, { mirror: false });

  // Ot öbekleri (görünüm)
  for (const [x, z] of [[-12, -11], [12, -3], [-7, -22], [4, -24], [10, -16], [-12, -1]]) {
    box(x, z, 1.4, 1.1, 0.35, C.grass, { solid: false });
  }

  const list = [[-6, -33], [-3, -34], [0, -33], [3, -34], [6, -33], [-4.5, -31], [4.5, -31], [0, -30.5]];
  return {
    id: 'sniper',
    name: 'NİŞANCI DÜELLOSU',
    desc: 'SADECE AWP',
    forceLoadout: { primary: 'awp' },
    boxes,
    pads,
    spawns: spawnsFrom(list),
    flags: flagsFrom(0, -35.5),
    bounds: { x: BX - 0.6, z: BZ - 0.6, minY: -5, maxY: 20 },
    sky: '#e7dcc1',
  };
}

// ======================================================================
// NİŞAN ARENASI — küçük, simetrik bir taş avlu. Birkaç sandık ve sütun; hızlı ve yakın çatışma.
// ======================================================================
export function aimArena(builder) {
  const { boxes, pads, box } = builder();
  const C = {
    ground: '#d3c8b2',
    tile: '#c6baa1',
    wall: '#b9a98b',
    cap: '#7b6a55',
    crate: '#9b7653',
    crate2: '#b08a62',
    band: '#5f4a36',
    pillar: '#9e3b2f',
    stone: '#a19a8c',
    red: '#a2483c',
    blue: '#4d6b8a',
  };
  const BX = 12;
  const BZ = 18;
  arena(box, BX, BZ, 3.6, C.ground, C.wall);
  box(0, -BZ - 0.25, BX * 2 + 1, 0.7, 0.25, C.cap, { y: 3.6 });
  box(-BX - 0.25, 0, 0.7, BZ * 2 + 1, 0.25, C.cap, { y: 3.6, mirror: false });
  box(BX + 0.25, 0, 0.7, BZ * 2 + 1, 0.25, C.cap, { y: 3.6, mirror: false });

  // Zemin karoları (görünüm): dama deseni
  for (let x = -10; x <= 10; x += 4) {
    for (let z = -16; z <= -2; z += 4) box(x + ((z / 4) % 2 ? 2 : 0), z, 2, 2, 0.02, C.tile, { solid: false });
  }
  // Takım renkli doğuş şeridi
  box(0, -16.6, 10, 1.2, 0.03, C.red, { solid: false, mirrorColor: C.blue });

  // Sandıklar
  const crate = (x, z, s, h = s, o = {}) => {
    box(x, z, s, s, h, C.crate, o);
    box(x, z, s + 0.04, s + 0.04, 0.12, C.band, { ...o, y: (o.y ?? 0) + h * 0.5 - 0.06, solid: false });
  };
  crate(-6, -6, 2);
  crate(6, -6, 2);
  crate(-6.2, -6.1, 1.2, 1.2, { y: 2 });
  crate(-9, -11, 1.5);
  crate(9, -11, 1.5);
  crate(0, -10, 1.2);
  box(-2.5, -10, 2.6, 0.7, 1.0, C.stone);
  box(3, -13, 0.7, 2.4, 1.0, C.stone);

  // Ortada kırmızı sütunlar ve alçak taş duvar
  box(0, 0, 1.4, 1.4, 3.6, C.pillar, { mirror: false });
  box(0, 0, 1.8, 1.8, 0.3, C.cap, { mirror: false });
  box(-6, 0, 0.9, 0.9, 3.6, C.pillar, { mirror: false });
  box(6, 0, 0.9, 0.9, 3.6, C.pillar, { mirror: false });
  box(-3, 0, 2, 0.6, 1.0, C.stone, { mirror: false });
  box(3, 0, 2, 0.6, 1.0, C.stone, { mirror: false });
  crate(-9.5, -2.5, 1.3);

  const list = [[-6, -15.5], [-3, -16], [0, -15.5], [3, -16], [6, -15.5], [-8.5, -14.5], [8.5, -14.5], [0, -13.5]];
  return {
    id: 'aim',
    name: 'NİŞAN ARENASI',
    boxes,
    pads,
    spawns: spawnsFrom(list),
    flags: flagsFrom(0, -16.5),
    bounds: { x: BX - 0.6, z: BZ - 0.6, minY: -5, maxY: 15 },
    sky: '#e9dfc8',
  };
}

// ======================================================================
// AVLU — iki geleneksel ev karşılıklı; aradaki avluda kuyu, pazar tezgâhları, ağaçlar ve fıçılar.
// Evlerin içinden geçilir; kapı ve pencerelerden avluya ateş edilir.
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
    lantern: '#c0503d',
    red: '#a2483c',
    blue: '#4d6b8a',
  };
  const BX = 16;
  const BZ = 24;
  arena(box, BX, BZ, 3, C.ground, C.base);
  box(0, -BZ - 0.25, BX * 2 + 1.4, 0.9, 0.3, C.roof, { y: 3 });
  box(-BX - 0.25, 0, 0.9, BZ * 2 + 1.4, 0.3, C.roof, { y: 3, mirror: false });
  box(BX + 0.25, 0, 0.9, BZ * 2 + 1.4, 0.3, C.roof, { y: 3, mirror: false });

  // Avlu taş yolu (görünüm)
  box(0, 0, 3, 30, 0.02, C.stone, { mirror: false, solid: false });
  box(0, 0, 22, 3, 0.02, C.stone, { mirror: false, solid: false });

  // Karşılıklı evler: avluya bakan iki kapı + pencere, arkada kapı (doğuş bahçesine)
  hut(0, -16.5, 13, 6, 3.2, C.plaster, {
    doors: [{ side: 'n', at: -3.5 }, { side: 'n', at: 3.5 }, { side: 's', at: 0, w: 1.6 }],
    windows: [{ side: 'n', at: 0, w: 1.6 }, { side: 'e', at: 0 }, { side: 'w', at: 0 }],
    roof: C.roof,
    floor: C.floor,
  });
  // Saçak ve kırmızı sütunlar (ön cephe)
  box(0, -13.1, 14.4, 1.4, 0.2, C.roof, { y: 3.3 });
  for (const x of [-6.2, -1.7, 1.7, 6.2]) box(x, -12.6, 0.3, 0.3, 3.3, C.pillar);
  // İç: masa, sandık
  box(-4.2, -17.8, 2, 1, 0.8, C.wood);
  box(4.5, -18, 1.2, 1.2, 1.2, C.wood2);
  // Kapı fenerleri (görünüm)
  for (const x of [-3.5, 3.5]) box(x + 1.1, -12.9, 0.35, 0.35, 0.5, C.lantern, { y: 2.3, solid: false });

  // Kuyu (orta)
  box(0, 0, 2.2, 2.2, 0.9, C.well, { mirror: false });
  box(-0.95, 0, 0.2, 0.2, 2.2, C.wood, { mirror: false });
  box(0.95, 0, 0.2, 0.2, 2.2, C.wood, { mirror: false });
  box(0, 0, 2.6, 1.4, 0.15, C.roof, { y: 2.2, mirror: false });

  // Pazar tezgâhları: masa + direkler + tente
  const stall = (x, z, cloth) => {
    box(x, z, 3.2, 1.2, 0.9, C.wood);
    box(x, z, 3.2, 1.2, 0.1, C.wood2, { y: 0.9, solid: false });
    box(x - 0.5, z, 0.5, 0.5, 0.35, C.jar, { y: 1.0 });
    box(x + 0.6, z, 0.7, 0.5, 0.25, C.cloth2, { y: 1.0 });
    for (const dx of [-1.55, 1.55]) box(x + dx, z + 0.7, 0.12, 0.12, 2.4, C.wood);
    box(x, z + 0.2, 3.6, 1.9, 0.08, cloth, { y: 2.4 });
  };
  stall(-9, -6, C.cloth);
  stall(9, -6, C.cloth2);

  // Fıçılar ve küpler
  for (const [x, z] of [[-13.5, -9], [-12.6, -9.6], [13.4, -10], [5, -3.5], [-5.5, -2.5]]) box(x, z, 0.9, 0.9, 1.1, C.jar);
  box(12, -2, 2.4, 1.4, 1.3, C.wood2); // sandık yığını
  box(12.2, -2, 1.2, 1.2, 1.1, C.wood, { y: 1.3 });

  // Ağaçlar: gövde + iki katlı yaprak (yapraklar havada, altından geçilir)
  const tree = (x, z) => {
    box(x, z, 0.5, 0.5, 3.4, C.trunk);
    box(x, z, 3.2, 3.2, 1.4, C.leaf, { y: 3.0, solid: false });
    box(x + 0.3, z - 0.2, 2.2, 2.2, 1.0, C.leaf2, { y: 4.2, solid: false });
  };
  tree(-11, -16);
  tree(11, -15);
  tree(-6.5, -1.6);

  // Doğuş bahçesi işareti (takım renkli yaygı)
  box(0, -21.8, 8, 2.2, 0.03, C.red, { solid: false, mirrorColor: C.blue });

  const list = [[-5, -21.5], [-2.5, -22.3], [0, -21.5], [2.5, -22.3], [5, -21.5], [-10, -21.5], [10, -21.5], [-7.5, -22.5]];
  return {
    id: 'yard',
    name: 'AVLU',
    boxes,
    pads,
    spawns: spawnsFrom(list),
    flags: flagsFrom(0, -22.8),
    bounds: { x: BX - 0.6, z: BZ - 0.6, minY: -5, maxY: 15 },
    sky: '#ebe1ca',
  };
}

// ======================================================================
// DEV ODA — oyuncular minicik: dev bir masanın altında ve çevresinde savaşırlar.
// Kitap yığını merdivenlerle masanın üstüne çıkılır; kupalar, kalemler, oyuncak küpler siper olur.
// ======================================================================
export function giantRoom(builder) {
  const { boxes, pads, box, stairs } = builder();
  const C = {
    floor: '#b99a72',
    plank: '#a88a63',
    wall: '#ebe2cd',
    skirting: '#7a5a3c',
    leg: '#6e4f34',
    top: '#8c6845',
    book1: '#8d4a3a',
    book2: '#4f6b78',
    book3: '#c2a15a',
    book4: '#6b7f5a',
    pages: '#f1e8d2',
    mug: '#e8e1d2',
    mug2: '#6f9a8d',
    coffee: '#5a3e2b',
    pencil: '#d6a84a',
    pencilTip: '#3a3530',
    eraser: '#c98a80',
    block1: '#b5524a',
    block2: '#5f7fa0',
    block3: '#d1b25a',
    rug: '#a65d4f',
    rug2: '#c6a271',
    red: '#a2483c',
    blue: '#4d6b8a',
  };
  const BX = 20;
  const BZ = 30;
  arena(box, BX, BZ, 14, C.floor, C.wall);
  // Süpürgelik
  box(0, -BZ + 0.1, BX * 2, 0.2, 0.8, C.skirting);
  box(-BX + 0.1, 0, 0.2, BZ * 2, 0.8, C.skirting, { mirror: false });
  box(BX - 0.1, 0, 0.2, BZ * 2, 0.8, C.skirting, { mirror: false });
  // Parke çizgileri (görünüm)
  for (let x = -18; x <= 18; x += 3) box(x, 0, 0.06, BZ * 2, 0.012, C.plank, { mirror: false, solid: false });
  // Halı (ortada)
  box(0, 0, 26, 18, 0.03, C.rug, { mirror: false, solid: false });
  box(0, 0, 23, 15, 0.035, C.rug2, { mirror: false, solid: false });

  // Dev masa: dört ayak + tabla (altından rahatça geçilir)
  const TY = 7;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * 8.6, sz * 5.4, 1.2, 1.2, TY, C.leg, { mirror: false });
  box(0, 0, 20, 12.4, 0.8, C.top, { y: TY, mirror: false });
  const TOP = TY + 0.8;

  // Kitap yığını merdiven: masanın yan kenarına çıkar (aynalanınca karşı tarafta da var)
  stairs(11.2, -15, 'z', 1, 2, 9, TOP, C.book1);
  // Kitap sırtları (görünüm): basamakların yanında renkli şeritler
  for (let i = 0; i < 20; i++) {
    const z = -15 + i * 0.45 + 0.22;
    const col = [C.book2, C.book3, C.book4, C.pages][i % 4];
    box(12.25, z, 0.08, 0.42, ((i + 1) * TOP) / 20, col);
  }
  // Masanın üstü: kupa, kalem, açık kitap
  box(-5, -2.5, 2.6, 2.6, 3.2, C.mug, { y: TOP });
  box(-5, -2.5, 2.2, 2.2, 0.05, C.coffee, { y: TOP + 3.2, solid: false });
  box(-6.6, -2.5, 0.5, 1.4, 1.8, C.mug, { y: TOP + 0.7 }); // kulp
  box(3, 1.5, 9, 0.6, 0.6, C.pencil, { y: TOP, mirror: false });
  box(7.9, 1.5, 0.8, 0.45, 0.45, C.pencilTip, { y: TOP + 0.08, mirror: false, solid: false });
  box(-1.8, 1.5, 0.8, 0.62, 0.62, C.eraser, { y: TOP, mirror: false });
  box(1.5, -3.5, 7, 4.5, 0.4, C.pages, { y: TOP, mirror: false });
  box(1.5, -3.5, 7.3, 4.8, 0.15, C.book2, { y: TOP - 0.1, mirror: false, solid: false });

  // Yerde: dev kitaplar (yatık), oyuncak küpler, kupa, kalemler
  box(-13, -12, 6, 4, 1.0, C.book2);
  box(-13, -12, 5.6, 3.6, 0.1, C.pages, { y: 1.0, solid: false });
  box(-12.6, -12.3, 4, 3, 0.9, C.book3, { y: 1.0 });
  const block = (x, z, s, col, y = 0) => box(x, z, s, s, s, col, { y });
  block(5, -11, 2.4, C.block1);
  block(7.6, -12.2, 2.4, C.block2);
  block(6.2, -11.6, 2.2, C.block3, 2.4);
  block(-6, -20, 2, C.block2);
  box(15.8, -2.6, 2.8, 2.8, 3.4, C.mug2);
  box(15.8, -2.6, 2.4, 2.4, 0.05, C.coffee, { y: 3.4, solid: false });
  box(-16, 0, 0.7, 14, 0.7, C.pencil, { mirror: false }); // yere düşmüş kalem (üstünden atlanır)
  box(-16, 7.3, 0.5, 0.6, 0.5, C.pencilTip, { y: 0.1, mirror: false });
  box(2, -20, 9, 0.8, 0.8, C.book4); // alçak kitap siperi

  const list = [[-6, -27], [-3, -27.5], [0, -27], [3, -27.5], [6, -27], [-10, -26.5], [10, -26.5], [0, -24.5]];
  return {
    id: 'giant',
    name: 'DEV ODA',
    indoor: true,
    boxes,
    pads,
    spawns: spawnsFrom(list),
    flags: flagsFrom(0, -28.2),
    bounds: { x: BX - 0.6, z: BZ - 0.6, minY: -5, maxY: 24 },
    sky: '#efe6d2',
  };
}
