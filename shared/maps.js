// Harita listesi. Lobide host haritayı seçer; istemci ve sunucu aynı veriyi kullanır.
// Her harita: { id, name, boxes, spawns, flags (CTF üsleri), bounds, sky, traction?, water? }
// Kırmızı takım -Z, mavi takım +Z tarafında; haritalar Z=0'a göre aynalanır.
import { CITY_ARENA } from './map.js';

/** Kutu ekleme yardımcıları ve hazır yapılar (kulübe, merdiven, duvar). */
function builder() {
  const boxes = [];
  const add = (min, max, color, solid) => boxes.push({ min, max, color, solid });
  /** cx/cz merkez, w (X), d (Z), h yükseklik, o.y taban; o.mirror=false ise aynalanmaz */
  const box = (cx, cz, w, d, h, color, o = {}) => {
    const y = o.y ?? 0;
    const solid = o.solid ?? true;
    add([cx - w / 2, y, cz - d / 2], [cx + w / 2, y + h, cz + d / 2], color, solid);
    if (o.mirror ?? true) add([cx - w / 2, y, -cz - d / 2], [cx + w / 2, y + h, -cz + d / 2], o.mirrorColor ?? color, solid);
  };
  /** İki köşesiyle verilen kutu */
  const rect = (xa, xb, za, zb, y, h, color, o = {}) => {
    const x0 = Math.min(xa, xb);
    const x1 = Math.max(xa, xb);
    const z0 = Math.min(za, zb);
    const z1 = Math.max(za, zb);
    if (x1 - x0 < 0.01 || z1 - z0 < 0.01 || h < 0.01) return;
    box((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h, color, { ...o, y });
  };

  const T = 0.3;
  /**
   * Boşluklu duvar. axis='z': Z sabit (=at), X boyunca from..to; axis='x': tersi.
   * openings: [{a, b, y0, y1}] kapı / pencere boşlukları.
   */
  const wall = (axis, at, from, to, h, openings, color, o = {}) => {
    const cuts = [from, to, ...openings.flatMap((op) => [op.a, op.b])].filter((v) => v >= from && v <= to).sort((a, b) => a - b);
    const seg = (a, b, y0, y1) => {
      if (axis === 'z') rect(a, b, at - T / 2, at + T / 2, y0, y1 - y0, color, o);
      else rect(at - T / 2, at + T / 2, a, b, y0, y1 - y0, color, o);
    };
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i];
      const b = cuts[i + 1];
      if (b - a < 0.01) continue;
      const op = openings.find((q) => (a + b) / 2 > q.a && (a + b) / 2 < q.b);
      if (!op) seg(a, b, 0, h);
      else {
        seg(a, b, 0, op.y0);
        seg(a, b, op.y1, h);
      }
    }
  };

  /**
   * Düz merdiven: (x, z) başlangıç kenarının ortası, along='x'|'z' yönünde dir (+1/-1) doğru çıkar.
   * Basamak yüksekliği en fazla 0.4 m (karakter otomatik çıkar).
   */
  const stairs = (x, z, along, dir, width, run, rise, color, o = {}) => {
    const y0 = o.y ?? 0;
    const n = Math.ceil(rise / 0.4);
    const depth = run / n;
    for (let i = 0; i < n; i++) {
      const top = ((i + 1) * rise) / n;
      const a = i * depth * dir;
      const b = (i + 1) * depth * dir;
      if (along === 'z') rect(x - width / 2, x + width / 2, z + a, z + b, y0, top, color, o);
      else rect(x + a, x + b, z - width / 2, z + width / 2, y0, top, color, o);
    }
  };

  /**
   * İçine girilebilen kulübe. doors / windows: [{side:'n'|'s'|'e'|'w', at}] (at: yüzün ortasına göre kayma)
   * n = +Z yüzü, s = -Z, e = +X, w = -X. roofStairs: 'e' | 'w' → o yüzde dışarıdan çatıya merdiven + siper.
   */
  const hut = (cx, cz, w, d, h, color, opt = {}) => {
    const o = { mirror: opt.mirror };
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    const open = { n: [], s: [], e: [], w: [] };
    const centerOf = (side) => (side === 'n' || side === 's' ? cx : cz);
    for (const dr of opt.doors ?? []) {
      const c = centerOf(dr.side) + (dr.at ?? 0);
      const dw = dr.w ?? 1.4;
      open[dr.side].push({ a: c - dw / 2, b: c + dw / 2, y0: 0, y1: Math.min(2.4, h - 0.3) });
    }
    for (const wn of opt.windows ?? []) {
      const c = centerOf(wn.side) + (wn.at ?? 0);
      const ww = wn.w ?? 1.2;
      open[wn.side].push({ a: c - ww / 2, b: c + ww / 2, y0: wn.y0 ?? 1.05, y1: Math.min(wn.y1 ?? 2.0, h - 0.3) });
    }
    if (opt.floor) box(cx, cz, w - 0.4, d - 0.4, 0.02, opt.floor, { ...o, solid: false });
    wall('z', z1 - T / 2, x0, x1, h, open.n, color, o);
    wall('z', z0 + T / 2, x0, x1, h, open.s, color, o);
    wall('x', x0 + T / 2, z0 + T, z1 - T, h, open.w, color, o);
    wall('x', x1 - T / 2, z0 + T, z1 - T, h, open.e, color, o);
    const RT = 0.3;
    box(cx, cz, w + 0.3, d + 0.3, RT, opt.roof ?? '#3d405b', { ...o, y: h });
    if (!opt.roofStairs) return;
    // Dış merdiven: seçilen X yüzünde, +Z ucundan -Z'ye doğru çıkar; çatıda alçak siper (merdiven ucunda boşluk)
    const top = h + RT;
    const sgn = opt.roofStairs === 'e' ? 1 : -1;
    const sx = sgn > 0 ? x1 : x0;
    const ox = sgn > 0 ? x0 : x1;
    stairs(sx + sgn * 0.75, z1, 'z', -1, 1.2, d - 0.3, top, opt.stairColor ?? '#cfcfcf', o);
    const P = 0.7;
    const cap = opt.capColor ?? opt.roof ?? '#3d405b';
    box(cx, z0 + 0.1, w, 0.2, P, cap, { ...o, y: top });
    box(cx, z1 - 0.1, w, 0.2, P, cap, { ...o, y: top });
    box(ox - sgn * 0.1, cz, 0.2, d - 0.4, P, cap, { ...o, y: top });
    rect(sx - sgn * 0.2, sx, z0 + 1.6, z1 - 0.2, top, P, cap, o); // çıkış boşluğu -Z ucunda
  };

  /** Etrafı korkuluklu yüksek platform + merdiven (kule). stairsFrom: 's' → -Z tarafından çıkılır */
  const tower = (cx, cz, size, height, color, opt = {}) => {
    const o = { mirror: opt.mirror };
    const half = size / 2;
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(cx + px * (half - 0.15), cz + pz * (half - 0.15), 0.3, 0.3, height, opt.post ?? color, o);
    box(cx, cz, size, size, 0.25, color, { ...o, y: height - 0.25 });
    const rail = opt.rail ?? '#ffffff';
    const R = 0.9;
    box(cx, cz + half - 0.08, size, 0.16, R, rail, { ...o, y: height });
    box(cx - half + 0.08, cz, 0.16, size, R, rail, { ...o, y: height });
    box(cx + half - 0.08, cz, 0.16, size, R, rail, { ...o, y: height });
    // -Z kenarında merdiven boşluğu: kenarın iki yanında kısa korkuluk
    const side = (size - 1.5) / 2; // ortada 1.5 m merdiven boşluğu
    if (side > 0.05) {
      box(cx - half + side / 2, cz - half + 0.08, side, 0.16, R, rail, { ...o, y: height });
      box(cx + half - side / 2, cz - half + 0.08, side, 0.16, R, rail, { ...o, y: height });
    }
    const run = height * 1.3;
    stairs(cx, cz - half - run, 'z', 1, 1.2, run, height, opt.stairColor ?? color, o);
  };

  return { boxes, box, rect, wall, stairs, hut, tower };
}

const spawnsFrom = (list, y = 0.1) => ({
  red: list.map(([x, z]) => [x, y, z, Math.PI]),
  blue: list.map(([x, z]) => [x, y, -z, 0]),
});
const flagsFrom = (x, z, y = 0.1) => ({ red: [x, y, z], blue: [x, y, -z] });

// ======================================================================
// POOL PARTY — ortada havuz; köşelerde çatısına çıkılan havuz evleri, kaydırak kuleleri,
// çit labirenti, soyunma kabinleri, yan barlar. Bayrak her takımın arka bahçesinde.
// ======================================================================
function poolParty() {
  const { boxes, box, rect, hut, tower } = builder();
  const C = {
    grass: '#8cb369', tile: '#f1e3c8', tile2: '#e7d3ad', poolFloor: '#4cc9f0', poolEdge: '#ffffff',
    wall: '#f4f1de', wallCap: '#e07a5f', house: '#ffb5a7', house2: '#a8dadc', roof: '#3d405b', lounger: '#ff70a6',
    lounger2: '#ffd23f', towel: '#2a9d8f', board: '#ffffff', metal: '#adb5bd', palm: '#7f5539',
    leaf: '#40916c', hedge: '#52b788', hedgeTop: '#74c69d', red: '#e63946', blue: '#2a6fdb', bar: '#f4a259',
    slide: '#ff9f1c', cabin: '#bde0fe', cabinDoor: '#ffafcc', raft: '#ff70a6', crate: '#c97b3d', planter: '#b5838d',
  };
  const PX = 7; // havuz yarı genişliği (X)
  const PZ = 9; // havuz yarı uzunluğu (Z)
  const DEPTH = 1.2;
  const BX = 22; // sınır duvarı X
  const BZ = 30; // sınır duvarı Z

  // Zemin: ortasında havuz boşluğu bırakan 4 parça (3 m kalın)
  box(-(100 + PX) / 2, 0, 100 - PX, 200, 3, C.grass, { y: -3, mirror: false });
  box((100 + PX) / 2, 0, 100 - PX, 200, 3, C.grass, { y: -3, mirror: false });
  box(0, -(100 + PZ) / 2, PX * 2, 100 - PZ, 3, C.grass, { y: -3 });
  // Fayans alan (dekor)
  for (const sx of [-1, 1]) box(sx * (19 + PX) / 2, 0, 19 - PX, 56, 0.02, C.tile, { mirror: false, solid: false });
  box(0, -(28 + PZ) / 2, PX * 2, 28 - PZ, 0.02, C.tile, { solid: false });
  for (let x = -16; x <= 16; x += 4) box(x, -21, 2, 2, 0.025, C.tile2, { solid: false });
  // Havuz tabanı, kenar şeridi, merdivenler, şişme bot (havuz içinde siper)
  box(0, 0, PX * 2, PZ * 2, 1, C.poolFloor, { y: -DEPTH - 1, mirror: false });
  box(0, -PZ - 0.25, PX * 2 + 1, 0.5, 0.06, C.poolEdge, { solid: false });
  for (const s of [-1, 1]) box(s * (PX + 0.25), 0, 0.5, PZ * 2 + 1, 0.06, C.poolEdge, { solid: false, mirror: false });
  box(0, -PZ + 0.6, 4, 1.2, DEPTH - 0.4, C.poolEdge, { y: -DEPTH });
  box(0, -PZ + 1.8, 4, 1.2, DEPTH - 0.8, C.poolEdge, { y: -DEPTH });
  for (const s of [-1, 1]) {
    // yan merdivenler: havuzdan iki yana da çıkılabilsin
    box(s * (PX - 0.6), -3, 1.2, 2.4, DEPTH - 0.4, C.poolEdge, { y: -DEPTH });
    box(s * (PX - 1.8), -3, 1.2, 2.4, DEPTH - 0.8, C.poolEdge, { y: -DEPTH });
  }
  box(-3, -4.5, 3, 1.4, 0.6, C.raft, { y: -DEPTH });
  box(3.5, -1.2, 1.6, 1.6, 0.6, C.lounger2, { y: -DEPTH });
  // Atlama tahtaları
  for (const sx of [-1, 1]) {
    box(sx * 4.5, -PZ - 1.2, 0.8, 1.4, 0.6, C.metal);
    box(sx * 4.5, -PZ + 0.2, 0.7, 3.4, 0.12, C.board, { y: 0.6 });
  }

  // Sınır duvarları
  box(0, -BZ, BX * 2 + 1, 1, 4, C.wall);
  box(0, -BZ, BX * 2 + 1.6, 1.6, 0.35, C.wallCap, { y: 4 });
  for (const sx of [-1, 1]) {
    box(sx * BX, 0, 1, BZ * 2 + 1, 4, C.wall, { mirror: false });
    box(sx * BX, 0, 1.6, BZ * 2 + 1.6, 0.35, C.wallCap, { y: 4, mirror: false });
  }

  // Üs: spawn alanı ve bayrak yeri (bayrak çiçekliklerle çevrili)
  box(0, -26, 14, 5, 0.03, C.red, { solid: false, mirrorColor: C.blue });
  box(0, -28.2, 3, 2, 0.04, C.wallCap, { solid: false });
  for (const sx of [-1, 1]) {
    box(sx * 2.8, -28.2, 1.2, 2.4, 1.1, C.planter);
    box(sx * 2.8, -28.2, 1, 2.2, 0.4, C.hedge, { y: 1.1, solid: false });
  }
  // Duşlar (spawn önü siper)
  for (const sx of [-1, 1]) {
    box(sx * 5.5, -21.5, 2.6, 0.3, 2.1, C.house2);
    box(sx * 5.5, -21.5, 0.15, 0.15, 2.6, C.metal);
  }

  // Köşelerde havuz evleri: içine girilir, dıştan çatıya çıkılır (keskin nişancı yeri)
  for (const sx of [-1, 1]) {
    hut(sx * 16, -24.5, 8, 6, 3.4, C.house, {
      roof: C.roof, floor: '#e9c46a', roofStairs: sx > 0 ? 'e' : 'w', stairColor: C.poolEdge, capColor: C.wallCap,
      doors: [{ side: 'n', at: -sx * 1.5 }, { side: sx > 0 ? 'w' : 'e', at: 0.5 }],
      windows: [{ side: 'n', at: sx * 2 }, { side: 's', at: 0 }],
    });
    box(sx * 16 + sx * 1.8, -24.2, 1.2, 2, 1, C.crate); // içeride sandık
  }

  // Kaydırak kuleleri (her takımın sol önünde): yüksek platform + havuza inen kaydırak (dekor)
  tower(-10.5, -15.5, 3, 3.6, C.slide, { rail: C.poolEdge, stairColor: C.poolEdge, post: C.metal });
  for (let i = 0; i < 5; i++) box(-9 + i * 0.45, -14.2 + i * 0.75, 1, 0.9, 0.12, C.slide, { y: 3.3 - i * 0.75, solid: false });
  // Karşı tarafta cankurtaran kulesi (alçak platform)
  tower(10.5, -15, 2.4, 2, C.red, { rail: C.poolEdge, stairColor: C.poolEdge, post: C.metal });

  // Yan barlar (ortada, iki takım arasında): içine girilir, tezgah arkası siper
  for (const sx of [-1, 1]) {
    hut(sx * 17.5, 0, 6, 9, 3, C.bar, {
      mirror: false, roof: C.wallCap, floor: C.tile2,
      doors: [{ side: 'n', at: 0 }, { side: 's', at: 0 }, { side: sx > 0 ? 'w' : 'e', at: 0, w: 3.2 }],
      windows: [{ side: sx > 0 ? 'e' : 'w', at: 0, w: 2.4 }],
    });
    box(sx * 18.3, 0, 1, 4, 1.1, C.wall, { mirror: false }); // tezgah
    box(sx * 12, 0, 1.2, 5, 1.15, C.bar, { mirror: false }); // havuz başı tezgah
    box(sx * 12, 0, 1.6, 5.4, 0.12, C.wallCap, { y: 1.15, mirror: false });
  }

  // Çit labirenti (yanlarda uzun siperler)
  for (const sx of [-1, 1]) {
    box(sx * 14, -12.5, 0.8, 4, 2.3, C.hedge);
    box(sx * 14, -6.8, 0.8, 3, 2.3, C.hedge);
    box(sx * 16.6, -9.5, 4.4, 0.8, 2.3, C.hedge);
    box(sx * 14, -12.5, 0.9, 4.1, 0.15, C.hedgeTop, { y: 2.3, solid: false });
    box(sx * 16.6, -9.5, 4.5, 0.9, 0.15, C.hedgeTop, { y: 2.3, solid: false });
  }
  // Soyunma kabinleri (yan duvar boyunca, içine saklanılır)
  for (const sx of [-1, 1]) {
    for (const z of [-17.5, -15]) {
      const x = sx * 20.2;
      box(x, z - 1.05, 2.2, 0.15, 2.3, C.cabin);
      box(x, z + 1.05, 2.2, 0.15, 2.3, C.cabin);
      box(x + sx * 1.05, z, 0.15, 2.25, 2.3, C.cabin);
      box(x, z, 2.3, 2.3, 0.15, C.cabinDoor, { y: 2.3 });
    }
  }

  // Şezlonglar (alçak siper)
  for (const [x, z, col] of [[-10, -9.5, C.lounger], [-10, -6.5, C.lounger2], [9.5, -10, C.lounger2], [9.5, -6, C.lounger]]) {
    box(x, z, 1.9, 0.8, 0.45, col);
    box(x - 0.75, z, 0.4, 0.8, 0.5, col, { y: 0.45 });
    box(x + 0.2, z, 1, 0.7, 0.02, C.towel, { y: 0.45, solid: false });
  }
  // Şemsiyeler
  for (const [x, z] of [[8, -4], [-3.5, -17.5], [4, -18.5]]) {
    box(x, z, 0.12, 0.12, 2.6, C.metal);
    box(x, z, 2.6, 2.6, 0.2, C.lounger, { y: 2.6, solid: false });
    box(x, z, 1.6, 1.6, 0.2, C.poolEdge, { y: 2.8, solid: false });
  }
  // Palmiyeler (gövde siper)
  for (const [x, z] of [[-20, -6], [20, -5], [-8, -23], [8.5, -23.5]]) {
    box(x, z, 0.5, 0.5, 4.5, C.palm);
    box(x, z, 3, 0.6, 0.25, C.leaf, { y: 4.5, solid: false });
    box(x, z, 0.6, 3, 0.25, C.leaf, { y: 4.6, solid: false });
  }
  // Dondurma büfesi: spawn'dan spawn'a düz görüşü keser
  box(0, -14.5, 3.2, 1.6, 2.3, C.lounger2);
  box(0, -14.5, 3.8, 2.2, 0.25, C.lounger, { y: 2.3 });
  for (const sx of [-1, 1]) box(sx * 2.6, -14.8, 1.6, 1, 2, C.cabin); // büfe yanındaki dolaplar
  // Kasalar / şişme oyuncak yığınları
  box(6, -19.5, 1.4, 1.4, 1.4, C.lounger2);
  box(4.8, -19.8, 0.9, 0.9, 0.9, C.towel);
  box(-6.5, -18.5, 2.5, 0.7, 1.2, C.wall);
  box(-15, -19.8, 1.4, 1.4, 1.3, C.crate);
  box(15.5, -19.5, 1.2, 1.2, 1.2, C.crate);
  box(3, -11.5, 1.2, 1.2, 1, C.crate);

  return {
    id: 'pool',
    name: 'POOL PARTY',
    boxes,
    spawns: spawnsFrom([[-3, -25.5], [0, -25], [3, -25.5], [-6, -26.5], [6, -26.5], [-1.5, -23.8], [1.5, -23.8], [-4.5, -24]]),
    flags: flagsFrom(0, -28.2),
    bounds: { x: BX - 0.4, z: BZ - 0.4, minY: -3, maxY: 15 },
    sky: '#8ecae6',
    water: { min: [-PX, -DEPTH, -PZ], max: [PX, -0.3, PZ], color: '#4cc9f0' },
    // Havuza düşen botlar için çıkış merdivenleri: [havuz içindeki nokta, dışarıdaki nokta]
    botExits: [
      [[0, -PZ + 2.6], [0, -PZ - 1.5]], [[0, PZ - 2.6], [0, PZ + 1.5]],
      [[-PX + 2.6, -3], [-PX - 1.5, -3]], [[PX - 2.6, -3], [PX + 1.5, -3]],
      [[-PX + 2.6, 3], [-PX - 1.5, 3]], [[PX - 2.6, 3], [PX + 1.5, 3]],
    ],
  };
}

// ======================================================================
// FROST ARENA — her takımın bayrağı surlarla çevrili buz kalesinde; surların üstünde yürünür.
// Yanlarda içine girilen kütük kulübeler (çatıya çıkılır), igloolar, kar siperleri, kar aracı.
// ======================================================================
function frostArena() {
  const { boxes, box, rect, hut, stairs } = builder();
  const C = {
    snow: '#f1faee', snow2: '#dbe9f0', ice: '#a8dadc', ice2: '#90e0ef', deep: '#457b9d', rock: '#6c757d',
    wall: '#bde0fe', wallCap: '#ffffff', fort: '#cde7f5', fortTop: '#e9f5fb', pine: '#2d6a4f', trunk: '#5a3a22',
    red: '#e63946', blue: '#2a6fdb', crate: '#c97b3d', flag: '#ffd23f', log: '#8d5b3a', logRoof: '#5a3a22',
    igloo: '#f8fbff', cat: '#ff9f1c', catDark: '#3d405b', glass: '#9bd1e5',
  };
  const BX = 24;
  const BZ = 32;
  box(0, 0, 200, 200, 1, C.snow, { y: -1, mirror: false });
  // Donmuş göl (dekor) — orta alan
  box(0, 0, 26, 20, 0.02, C.ice2, { solid: false, mirror: false });

  // Sınır: buz duvarlar
  box(0, -BZ, BX * 2 + 1.2, 1.2, 5, C.wall);
  box(0, -BZ, BX * 2 + 2, 1.8, 0.4, C.wallCap, { y: 5 });
  for (const sx of [-1, 1]) {
    box(sx * BX, 0, 1.2, BZ * 2 + 1.2, 5, C.wall, { mirror: false });
    box(sx * BX, 0, 1.8, BZ * 2 + 2, 0.4, C.wallCap, { y: 5, mirror: false });
  }

  // ---- Buz kalesi (üs): ön sur kapılı, yan surlarda geçit; surların üstüne merdivenle çıkılır ----
  const FZ = -22; // ön surun merkezi
  const FW = 1.4; // sur kalınlığı (üstünde yürünür)
  const FH = 3; // sur yüksekliği
  const FX = 10; // yan surların X'i
  const gate = 2.2; // ön kapı yarı genişliği
  rect(-FX - FW / 2, -gate, FZ - FW / 2, FZ + FW / 2, 0, FH, C.fort);
  rect(gate, FX + FW / 2, FZ - FW / 2, FZ + FW / 2, 0, FH, C.fort);
  rect(-gate, gate, FZ - FW / 2, FZ + FW / 2, 2.5, FH - 2.5, C.fort); // kapı kemeri (üstünden geçilir)
  for (const sx of [-1, 1]) {
    // yan sur: arkada sınır duvarına kadar, ortasında geçit
    const x0 = sx * FX - FW / 2;
    const x1 = sx * FX + FW / 2;
    rect(x0, x1, -BZ + 0.6, -28.2, 0, FH, C.fort);
    rect(x0, x1, -26.2, FZ - FW / 2, 0, FH, C.fort);
    rect(x0, x1, -28.2, -26.2, 2.5, FH - 2.5, C.fort);
    // mazgallar (dış kenarda)
    for (let z = -30; z <= -23; z += 1.6) rect(sx * (FX + FW / 2) - sx * 0.25, sx * (FX + FW / 2), z - 0.4, z + 0.4, FH, 0.7, C.fortTop);
    // içeriden sura çıkan merdiven (ön surun dibine)
    stairs(sx * 7.6, -28.5, 'z', 1, 1.3, 5.8, FH, C.fortTop);
  }
  for (let x = -FX + 0.4; x <= FX - 0.4; x += 1.6) {
    if (Math.abs(x) < 0.5) continue;
    rect(x - 0.4, x + 0.4, FZ + FW / 2 - 0.25, FZ + FW / 2, FH, 0.7, C.fortTop);
  }
  // Kale içi: bayrak kaidesi + siper buz blokları
  box(0, -29, 2.6, 2.6, 0.12, C.deep);
  box(-4, -23.4, 1.6, 1.2, 1.2, C.ice);
  box(4.2, -23.6, 2.2, 1, 1.1, C.ice);
  box(0, FZ - FW / 2 - 0.25, 10, 4, 0.03, C.red, { solid: false, mirrorColor: C.blue }); // spawn alanı (dekor)
  // Kale önü: kapıyı koruyan kar siperleri
  for (const sx of [-1, 1]) {
    box(sx * 4, -18.3, 3.4, 0.9, 1.3, C.snow2);
    box(sx * 4, -18.3, 3.7, 1.2, 0.2, C.wallCap, { y: 1.3 });
  }

  // ---- Kütük kulübeler (köşelerde): içine girilir, çatıya çıkılır ----
  for (const sx of [-1, 1]) {
    hut(sx * 17.5, -21, 7, 5.5, 3.2, C.log, {
      roof: C.logRoof, floor: '#c9a27e', roofStairs: sx > 0 ? 'e' : 'w', stairColor: C.log, capColor: C.logRoof,
      doors: [{ side: 'n', at: -sx * 1.4 }, { side: sx > 0 ? 'w' : 'e', at: 0.8 }],
      windows: [{ side: 'n', at: sx * 1.8 }, { side: 's', at: 0 }],
    });
    box(sx * 18.5, -21.5, 1.1, 1.1, 1, C.crate);
  }

  // ---- İgloolar: alçak, içine saklanılır ----
  for (const [x, z] of [[-11.5, -11.5], [12, -13.5]]) {
    hut(x, z, 4.4, 4.4, 2.2, C.igloo, {
      roof: C.igloo, floor: C.snow2,
      doors: [{ side: 'n', at: 0, w: 1.2 }],
      windows: [{ side: x < 0 ? 'w' : 'e', at: 0, w: 0.8, y0: 1.1, y1: 1.7 }],
    });
    box(x, z, 3.4, 3.4, 0.4, C.igloo, { y: 2.5, solid: false });
    box(x, z, 2, 2, 0.35, C.igloo, { y: 2.9, solid: false });
    box(x, z + 2.6, 1.6, 1, 1.6, C.snow2, { y: 0, solid: false }); // giriş tüneli (dekor)
  }

  // ---- Orta alan ----
  // Buz kristali anıtı + çevresinde alçak buz blokları
  box(0, 0, 4, 4, 1, C.deep, { mirror: false });
  box(0, 0, 2.4, 2.4, 3.6, C.ice, { y: 1, mirror: false });
  box(0, 0, 1.2, 1.2, 1.6, C.ice2, { y: 4.6, mirror: false });
  for (const [x, z] of [[-6, -3], [6, 3], [-6, 3], [6, -3]]) box(x, z, 2, 2, 1.3, C.ice, { mirror: false });
  // Orta koridoru kapatan büyük buz blokları (spawn'dan spawn'a görüşü keser)
  box(0, -10, 7, 1.6, 3, C.ice);
  box(-16, -5, 3, 3, 3, C.deep);
  box(16.5, -6, 2.5, 4, 3.4, C.deep);
  // Buz sütunları (yanlarda koşu yollarında siper)
  for (const [x, z] of [[-20, -14], [-8, -6.5], [9, -8], [20, -11]]) box(x, z, 1.4, 1.4, 2.8, C.ice2);
  // Kar siperleri (L şeklinde)
  for (const sx of [-1, 1]) {
    box(sx * 6, -14.8, 4.5, 1, 1.4, C.snow2);
    box(sx * 8.3, -13.5, 1, 3.6, 1.4, C.snow2);
    box(sx * 6, -14.8, 4.8, 1.3, 0.2, C.wallCap, { y: 1.4 });
  }
  // Kar aracı (araba gibi siper)
  box(-17, -10.5, 2.2, 4.4, 1.2, C.cat, { y: 0.4 });
  box(-17, -11, 2, 2.2, 0.8, C.glass, { y: 1.6 });
  for (const sx of [-1, 1]) box(-17 + sx * 1.05, -10.5, 0.35, 4.6, 0.6, C.catDark, { solid: false });
  // Kaya ve kasalar
  box(-3.5, -16.5, 2.2, 1.6, 1.2, C.rock);
  box(13.5, -4.5, 1.5, 1.5, 1.5, C.crate);
  box(14.7, -4.9, 1, 1, 0.9, C.crate);
  box(-12.5, -18, 1.6, 1.6, 1.6, C.crate);
  // Çam ağaçları (gövde siper, yapraklar dekor)
  for (const [x, z] of [[-21, -27], [21, -27], [-21, -2], [21, -1], [-6.5, -20], [7, -20.5]]) {
    box(x, z, 0.5, 0.5, 1.5, C.trunk);
    box(x, z, 2.4, 2.4, 1.6, C.pine, { y: 1.5 });
    box(x, z, 1.6, 1.6, 1.4, C.pine, { y: 3.1 });
    box(x, z, 0.8, 0.8, 1, C.snow, { y: 4.5, solid: false });
  }

  return {
    id: 'frost',
    name: 'FROST ARENA',
    boxes,
    spawns: spawnsFrom([[-3, -25.8], [0, -25.5], [3, -25.8], [-5.5, -27], [5.5, -27], [-2, -27.5], [2, -27.5], [0, -24.5]]),
    flags: flagsFrom(0, -29),
    bounds: { x: BX - 0.6, z: BZ - 0.6, minY: -5, maxY: 15 },
    sky: '#cfe8f3',
    traction: 0.3, // buz: kaygan hareket
  };
}

export const MAPS = {
  city: { id: 'city', sky: '#8ecae6', flags: flagsFrom(0, -40.4), ...CITY_ARENA, name: 'CITY ARENA' },
  pool: poolParty(),
  frost: frostArena(),
};
export const MAP_IDS = Object.keys(MAPS);
export const DEFAULT_MAP = 'city';

const solidCache = new Map();
/** Haritanın katı kutuları (isabet testi ve bomba fiziği için) */
export function solidsOf(id) {
  if (!solidCache.has(id)) solidCache.set(id, (MAPS[id] ?? MAPS[DEFAULT_MAP]).boxes.filter((b) => b.solid));
  return solidCache.get(id);
}

/** CTF bayrak üsleri { red: [x,y,z], blue: [x,y,z] } */
export function flagBases(id) {
  return (MAPS[id] ?? MAPS[DEFAULT_MAP]).flags;
}
