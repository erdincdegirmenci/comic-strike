// Harita listesi. Lobide host haritayı seçer; istemci ve sunucu aynı veriyi kullanır.
// Her harita: { id, name, boxes, spawns, flags (CTF üsleri), bounds, sky, traction?, water? }
// Kırmızı takım -Z, mavi takım +Z tarafında; haritalar Z=0'a göre aynalanır.
import { CITY_ARENA } from './map.js';

/** Kutu ekleme yardımcıları ve hazır yapılar (kulübe, merdiven, duvar). */
function builder(defaults = {}) {
  const boxes = [];
  const pads = [];
  const MIRROR = defaults.mirror ?? true; // takım haritaları Z=0'a göre aynalanır; Herkes Tek haritası aynalanmaz
  const add = (min, max, color, solid) => boxes.push({ min, max, color, solid });
  /** cx/cz merkez, w (X), d (Z), h yükseklik, o.y taban; o.mirror=false ise aynalanmaz */
  const box = (cx, cz, w, d, h, color, o = {}) => {
    const y = o.y ?? 0;
    const solid = o.solid ?? true;
    add([cx - w / 2, y, cz - d / 2], [cx + w / 2, y + h, cz + d / 2], color, solid);
    if (o.mirror ?? MIRROR) add([cx - w / 2, y, -cz - d / 2], [cx + w / 2, y + h, -cz + d / 2], o.mirrorColor ?? color, solid);
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
    const base = o.base ?? 0; // duvarın taban yüksekliği (üst katlar için)
    const seg = (a, b, y0, y1) => {
      if (axis === 'z') rect(a, b, at - T / 2, at + T / 2, base + y0, y1 - y0, color, o);
      else rect(at - T / 2, at + T / 2, a, b, base + y0, y1 - y0, color, o);
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
    const o = { mirror: opt.mirror, base: opt.y ?? 0 };
    const yb = opt.y ?? 0; // kulübenin taban yüksekliği (çatıdaki kulübeler için)
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
    if (opt.floor) box(cx, cz, w - 0.4, d - 0.4, 0.02, opt.floor, { mirror: opt.mirror, y: yb, solid: false });
    wall('z', z1 - T / 2, x0, x1, h, open.n, color, o);
    wall('z', z0 + T / 2, x0, x1, h, open.s, color, o);
    wall('x', x0 + T / 2, z0 + T, z1 - T, h, open.w, color, o);
    wall('x', x1 - T / 2, z0 + T, z1 - T, h, open.e, color, o);
    const RT = 0.3;
    box(cx, cz, w + 0.3, d + 0.3, RT, opt.roof ?? '#3d405b', { mirror: opt.mirror, y: yb + h });
    if (!opt.roofStairs) return;
    // Dış merdiven: seçilen X yüzünde, +Z ucundan -Z'ye doğru çıkar; çatıda alçak siper (merdiven ucunda boşluk)
    const top = yb + h + RT;
    const sgn = opt.roofStairs === 'e' ? 1 : -1;
    const sx = sgn > 0 ? x1 : x0;
    const ox = sgn > 0 ? x0 : x1;
    stairs(sx + sgn * 0.75, z1, 'z', -1, 1.2, d - 0.3, top, opt.stairColor ?? '#cfcfcf', o);
    const P = 0.7;
    const cap = opt.capColor ?? opt.roof ?? '#3d405b';
    box(cx, z0 + 0.1, w, 0.2, P, cap, { ...o, y: top });
    box(cx, z1 - 0.1, w, 0.2, P, cap, { ...o, y: top });
    // karşı kenar siperi; opt.roofGap = [z0, z1] verilirse orada boşluk (köprü bağlantısı)
    const g = opt.roofGap;
    if (g) {
      rect(ox - sgn * 0.2, ox, z0 + 0.2, g[0], top, P, cap, o);
      rect(ox - sgn * 0.2, ox, g[1], z1 - 0.2, top, P, cap, o);
    } else box(ox - sgn * 0.1, cz, 0.2, d - 0.4, P, cap, { ...o, y: top });
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

  /**
   * Zıplama pedi: (cx, cz) merkez, y zemin yüksekliği, r yarıçap, v = [vx, vy, vz] fırlatma hızı.
   * Aynalanırsa karşı taraftaki pedin Z hızı ters çevrilir.
   */
  const pad = (cx, cz, v, o = {}) => {
    const y = o.y ?? 0;
    const r = o.r ?? 1;
    pads.push({ c: [cx, y, cz], r, v });
    if (o.mirror ?? MIRROR) pads.push({ c: [cx, y, -cz], r, v: [v[0], v[1], -v[2]] });
  };

  /** Eğilerek geçilen delik: duvarın içinde 1.25 m yüksekliğinde boşluk (ayakta geçilmez, çömelince geçilir) */
  const CRAWL = 1.25;

  return { boxes, pads, box, rect, wall, stairs, hut, tower, pad, CRAWL };
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
  const { boxes, pads, box, rect, hut, tower, pad, CRAWL } = builder();
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
    // çitlerde eğilerek geçilen kemerler
    box(sx * 14, -13.85, 0.8, 1.3, 2.3, C.hedge);
    box(sx * 14, -11.15, 0.8, 1.3, 2.3, C.hedge);
    box(sx * 14, -12.5, 0.8, 1.4, 2.3 - CRAWL, C.hedge, { y: CRAWL });
    box(sx * 14, -6.8, 0.8, 3, 2.3, C.hedge);
    rect(sx * 14.4, sx * 15.9, -9.9, -9.1, 0, 2.3, C.hedge);
    rect(sx * 17.3, sx * 18.8, -9.9, -9.1, 0, 2.3, C.hedge);
    rect(sx * 15.9, sx * 17.3, -9.9, -9.1, CRAWL, 2.3 - CRAWL, C.hedge);
    box(sx * 14, -12.5, 0.9, 4.1, 0.15, C.hedgeTop, { y: 2.3, solid: false });
    box(sx * 16.6, -9.5, 4.5, 0.9, 0.15, C.hedgeTop, { y: 2.3, solid: false });
    // zıplama pedleri: havuz evinin çatısına ve ortadaki barın çatısına
    pad(sx * 13, -19.3, [sx * 1.48, 16.25, -3.85]);
    pad(sx * 11, -4, [sx * 5.75, 12.5, 3.45]);
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
    pads,
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
  const { boxes, pads, box, rect, hut, stairs, pad, CRAWL } = builder();
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
    rect(x0, x1, -BZ + 0.6, -30.9, 0, FH, C.fort);
    rect(x0, x1, -29.7, -28.2, 0, FH, C.fort);
    rect(x0, x1, -30.9, -29.7, CRAWL, FH - CRAWL, C.fort); // kaleye gizli giriş: eğilerek geçilen delik
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

  // Zıplama pedleri: kulübe çatılarına ve ortadaki büyük buz bloğunun üstüne
  for (const sx of [-1, 1]) pad(sx * 14, -16.5, [sx * 2.6, 16, -3.35]);
  pad(0, -13, [0, 12, 3.9]);

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
    pads,
    spawns: spawnsFrom([[-3, -25.8], [0, -25.5], [3, -25.8], [-5.5, -27], [5.5, -27], [-2, -27.5], [2, -27.5], [0, -24.5]]),
    flags: flagsFrom(0, -29),
    bounds: { x: BX - 0.6, z: BZ - 0.6, minY: -5, maxY: 15 },
    sky: '#cfe8f3',
    traction: 0.3, // buz: kaygan hareket
  };
}

// ======================================================================
// HURDALIK — en büyük harita, tüm modlarda oynanır (aynalanmaz).
// Takım modlarında kırmızı güneyde (-Z), mavi kuzeyde (+Z) doğar; bayraklar iki uçta.
// Ortada yüksek platform ve iki yanına uzanan köprüler, doğuda içine girilen depo,
// batıda iskele, kuzeyde konteyner sahası, güneyde boru rafı ve iki katlı ofis,
// güneybatıda basamaklı hurda tepesi. Zıplama pedleri ve eğilerek geçilen yerler her bölgede.
// ======================================================================
function scrapyard() {
  const { boxes, pads, box, rect, wall, stairs, hut, tower, pad, CRAWL } = builder({ mirror: false });
  const C = {
    dirt: '#c2a878', dirt2: '#b39a6b', concrete: '#cfcfcf', concrete2: '#adb5bd', metal: '#6c757d', dark: '#3d405b',
    rust: '#b5651d', yellow: '#ffd23f', wall: '#8d99ae', wallCap: '#5c677d', crate: '#c97b3d', tire: '#1d1d1d',
    ware: '#e9c46a', wareRoof: '#7f5539', office: '#a8dadc', officeRoof: '#457b9d', pipe: '#e76f51', pipe2: '#2a9d8f',
    scaf: '#f4a261', junk: '#8d8d8d', junk2: '#6b705c', car1: '#3a86ff', car2: '#ff006e', glass: '#9bd1e5',
    cont: ['#e63946', '#2a9d8f', '#457b9d', '#f4a261', '#8338ec', '#52b788'],
  };
  const B = 40;

  // Zemin ve sınır duvarları
  box(0, 0, 220, 220, 1, C.dirt, { y: -1 });
  for (const [x, z, w, d] of [[-14, 12, 9, 7], [22, -10, 8, 10], [-26, 14, 10, 8], [12, 30, 12, 5]]) box(x, z, w, d, 0.02, C.dirt2, { solid: false });
  for (const s of [-1, 1]) {
    box(0, s * B, B * 2 + 1.2, 1.2, 6, C.wall);
    box(0, s * B, B * 2 + 2, 1.8, 0.4, C.wallCap, { y: 6 });
    box(s * B, 0, 1.2, B * 2 + 1.2, 6, C.wall);
    box(s * B, 0, 1.8, B * 2 + 2, 0.4, C.wallCap, { y: 6 });
  }

  /** Konteyner: uzun kenarı X ya da Z boyunca; açık uçlar tünel olur. y > 0 ise tabanı vardır (altından eğilerek geçilir / üst üste) */
  const container = (cx, cz, alongX, color, o = {}) => {
    const L = 6;
    const W = 2.5;
    const H = 2.6;
    const T = 0.18;
    const y = o.y ?? 0;
    const open = o.open ?? 'both'; // 'both' | 'none' | 'start' | 'end'
    const [hx, hz] = alongX ? [L / 2, W / 2] : [W / 2, L / 2];
    const x0 = cx - hx;
    const x1 = cx + hx;
    const z0 = cz - hz;
    const z1 = cz + hz;
    if (alongX) {
      rect(x0, x1, z0, z0 + T, y, H, color);
      rect(x0, x1, z1 - T, z1, y, H, color);
      if (open === 'none' || open === 'end') rect(x0, x0 + T, z0, z1, y, H, color);
      if (open === 'none' || open === 'start') rect(x1 - T, x1, z0, z1, y, H, color);
    } else {
      rect(x0, x0 + T, z0, z1, y, H, color);
      rect(x1 - T, x1, z0, z1, y, H, color);
      if (open === 'none' || open === 'end') rect(x0, x1, z0, z0 + T, y, H, color);
      if (open === 'none' || open === 'start') rect(x0, x1, z1 - T, z1, y, H, color);
    }
    rect(x0, x1, z0, z1, y + H - T, T, color); // tavan
    if (y > 0) rect(x0, x1, z0, z1, y, T, C.dark); // taban
    // oluklu yüzey çizgileri (dekor)
    for (let k = -2; k <= 2; k++) {
      if (alongX) rect(cx + k * 1.1 - 0.05, cx + k * 1.1 + 0.05, z0 - 0.03, z1 + 0.03, y + 0.2, H - 0.4, C.dark, { solid: false });
      else rect(x0 - 0.03, x1 + 0.03, cz + k * 1.1 - 0.05, cz + k * 1.1 + 0.05, y + 0.2, H - 0.4, C.dark, { solid: false });
    }
  };
  const crate = (x, z, s, h, y = 0) => box(x, z, s, s, h, C.crate, { y });
  const barrier = (x, z, w, d) => box(x, z, w, d, 1.15, C.concrete);
  const tires = (x, z) => {
    box(x, z, 1.1, 1.1, 0.45, C.tire);
    box(x, z, 1.1, 1.1, 0.45, C.tire, { y: 0.45 });
  };
  /** Hurda araba (siper) */
  const junkCar = (x, z, alongX, color) => {
    const [w, d] = alongX ? [4.2, 2] : [2, 4.2];
    box(x, z, w, d, 0.9, color, { y: 0.3 });
    box(x, z, alongX ? 2.2 : 1.8, alongX ? 1.8 : 2.2, 0.6, C.glass, { y: 1.2 });
    box(x, z, w + 0.1, d + 0.1, 0.3, C.tire, { solid: false });
  };

  // ---------------- MERKEZ: yüksek platform (üstü 4 m) ----------------
  const HUB = 6;
  const TOP = 4;
  rect(-HUB, HUB, -HUB, HUB, TOP - 0.3, 0.3, C.concrete2);
  for (const x of [-HUB + 0.5, 0, HUB - 0.5]) for (const z of [-HUB + 0.5, HUB - 0.5]) {
    if (x === 0) continue;
    box(x, z, 0.8, 0.8, TOP - 0.3, C.metal);
  }
  // köşe korkulukları (kenarların çoğu açık: pedden ve köprülerden çıkılır)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    rect(sx * HUB, sx * (HUB - 2.2), sz * (HUB - 0.15), sz * HUB, TOP, 0.9, C.yellow);
    rect(sx * (HUB - 0.15), sx * HUB, sz * HUB, sz * (HUB - 2.2), TOP, 0.9, C.yellow);
  }
  // platform üstü siper sandıkları ve altındaki sandıklar
  crate(-2.2, 1.6, 1.4, 1.2, TOP);
  crate(2.4, -1.8, 1.4, 1.2, TOP);
  box(0, 0, 3, 0.6, 1.1, C.concrete, { y: TOP });
  crate(-2.5, -2, 1.5, 1.4);
  crate(2.2, 2.4, 1.2, 1.1);
  barrier(0, 0, 0.6, 3);
  // kuzey ve güney merdivenleri
  stairs(0, -HUB - 5.2, 'z', 1, 2.2, 5.2, TOP, C.concrete);
  stairs(0, HUB + 5.2, 'z', -1, 2.2, 5.2, TOP, C.concrete);
  // pedler: kuzeydoğudan ve güneybatıdan platforma
  pad(10, 2.6, [-6, 14, 0]);
  pad(-10, -2.6, [6, 14, 0]);

  // Köprüler: platformdan doğudaki deponun çatısına ve batıdaki iskeleye (z -1..1, üstü 4 m)
  for (const s of [-1, 1]) {
    const a = s * HUB;
    const b = s * 21;
    rect(a, b, -1.1, 1.1, TOP - 0.25, 0.25, C.scaf);
    rect(a, b, -1.1, -0.95, TOP, 0.9, C.yellow);
    rect(a, b, 0.95, 1.1, TOP, 0.9, C.yellow);
    for (let x = 9; x <= 18; x += 4.5) box(s * x, 0, 0.4, 0.4, TOP - 0.25, C.metal);
  }

  // ---------------- DOĞU: depo (içine girilir; içte eğilerek geçilen havalandırma deliği) ----------------
  const WX = 26;
  hut(WX, 0, 10, 14, TOP - 0.3, C.ware, {
    roof: C.wareRoof, floor: C.dirt2, roofStairs: 'e', stairColor: C.concrete, capColor: C.wareRoof, roofGap: [-1.2, 1.2],
    doors: [{ side: 'w', at: -4.5 }, { side: 'w', at: 4.5 }, { side: 'n', at: -2 }, { side: 's', at: 2 }],
    windows: [{ side: 'n', at: 2.5 }, { side: 's', at: -2.5 }],
  });
  // iç bölme duvarı: ortada eğilerek geçilen delik, kuzeyde normal kapı
  wall('x', WX, -7 + 0.3, 7 - 0.3, TOP - 0.3, [{ a: -0.7, b: 0.7, y0: 0, y1: CRAWL }, { a: 3.2, b: 4.8, y0: 0, y1: 2.4 }], C.ware);
  crate(WX - 3, -4, 1.4, 1.3);
  crate(WX - 2.6, -2.4, 1, 0.9);
  crate(WX + 3, 3, 1.5, 1.5);
  crate(WX + 3.2, -4.5, 1.2, 2.2);
  box(WX + 3.8, -1.6, 0.8, 2.6, 1.1, C.metal); // tezgah

  // ---------------- BATI: iskele platformu (üstü 4 m) + altında konteyner tüneli ----------------
  const SX = -25;
  rect(SX - 4, SX + 4, -4, 4, TOP - 0.25, 0.25, C.scaf);
  for (const x of [SX - 3.8, SX + 3.8]) for (const z of [-3.8, 3.8]) box(x, z, 0.4, 0.4, TOP - 0.25, C.metal);
  rect(SX - 4, SX + 4, 3.85, 4, TOP, 0.9, C.yellow);
  rect(SX - 4, SX - 3.85, -4, 4, TOP, 0.9, C.yellow);
  rect(SX - 4, SX - 1, -4, -3.85, TOP, 0.9, C.yellow);
  rect(SX + 1, SX + 4, -4, -3.85, TOP, 0.9, C.yellow);
  stairs(SX, -4 - 5.2, 'z', 1, 1.8, 5.2, TOP, C.scaf);
  container(SX, 0, true, C.cont[1]); // iskelenin altında açık uçlu tünel
  crate(SX - 2, 5.5, 1.3, 1.2);

  // ---------------- KUZEY: konteyner sahası ----------------
  container(-14, 20, true, C.cont[0]);
  container(-6, 20, true, C.cont[2], { open: 'end' });
  container(2, 20, true, C.cont[3]);
  container(8, 22, false, C.cont[4], { open: 'none' }); // üst üste iki konteyner
  container(8, 22, false, C.cont[5], { open: 'none', y: 2.6 });
  pad(8, 17, [0, 16, 3]); // istifin tepesine
  // parkur: sandıklardan konteynerin üstüne zıpla
  crate(-6, 15.6, 1.4, 1);
  crate(-6, 17.1, 1.4, 2);
  // havada duran konteyner: altından eğilerek geçilir
  container(-22, 28, true, C.cont[3], { y: CRAWL, open: 'both' });
  for (const x of [-24.9, -19.1]) for (const z of [26.85, 29.15]) box(x, z, 0.25, 0.25, CRAWL, C.metal);
  container(-30, 20, false, C.cont[0], { open: 'start' });
  container(18, 32, true, C.cont[2], { open: 'none' });
  container(-8, 33, false, C.cont[5]);
  tower(22, 22, 3, 5, C.metal, { rail: C.yellow, stairColor: C.metal }); // gözcü kulesi
  junkCar(-17, 13, true, C.car1);
  tires(2, 14.5);
  tires(14, 15);
  barrier(-30, 12, 3, 0.6);
  crate(28, 30, 1.6, 1.6);
  crate(29.4, 31.2, 1, 0.9);
  crate(34, 15, 1.6, 1.6);

  // ---------------- GÜNEY: boru rafı (altından eğilerek geçilir, üstünde yürünür) ----------------
  const RZ = -20;
  rect(-24, 4, RZ - 1.2, RZ + 1.2, CRAWL, 0.3, C.metal);
  for (let x = -23.5; x <= 4; x += 5.5) for (const z of [RZ - 1.05, RZ + 1.05]) box(x, z, 0.3, 0.3, CRAWL, C.dark);
  for (const [z, col] of [[RZ - 0.6, C.pipe], [RZ + 0.6, C.pipe2]]) rect(-24, 4, z - 0.25, z + 0.25, CRAWL + 0.3, 0.5, col, { solid: false });
  stairs(-26.6, RZ, 'x', 1, 2.2, 2.6, CRAWL + 0.3, C.metal); // batı ucundan rafa çıkış
  pad(-10, RZ - 3, [0, 9, 4.5]); // rafın üstüne
  pad(-10, RZ + 3, [0, 9, -4.5]);

  // İki katlı ofis: zemin kat + çatıda ikinci kulübe
  hut(19, -26, 12, 9, 3.2, C.office, {
    roof: C.officeRoof, floor: C.concrete2, roofStairs: 'e', stairColor: C.concrete, capColor: C.officeRoof,
    doors: [{ side: 'n', at: -3 }, { side: 'w', at: 1.5 }],
    windows: [{ side: 'n', at: 2.5 }, { side: 'w', at: -2.5 }, { side: 's', at: -3 }, { side: 's', at: 3 }],
  });
  hut(17.5, -26.8, 5, 4.5, 2.6, C.office, {
    y: 3.5, roof: C.officeRoof,
    doors: [{ side: 'n', at: 0 }], windows: [{ side: 'w', at: 0 }, { side: 's', at: 0 }],
  });
  crate(16, -28, 1.2, 1.1);
  box(21.5, -24, 2.5, 1, 0.9, C.wareRoof); // masa
  pad(11, -18, [3.2, 14.5, -4.2]); // ofis çatısına

  // ---------------- GÜNEYBATI: basamaklı hurda tepesi ----------------
  const HX = -28;
  const HZ = -29;
  for (let i = 0; i < 8; i++) {
    const s = 10 - i * 1.15;
    box(HX, HZ, s, s, 0.4 * (i + 1), i % 2 ? C.junk : C.junk2);
  }
  tires(HX + 6, HZ - 3);
  junkCar(-14, -31, false, C.car2);
  junkCar(-34, -14, true, C.car1);

  // ---------------- Doğu kuzey / güney: ezici makine ve köşe sığınakları ----------------
  box(32, 24, 5, 5, 4.2, C.rust);
  box(32, 24, 5.6, 5.6, 0.4, C.dark, { y: 4.2 });
  stairs(32, 17.6, 'z', 1, 1.6, 3.6, 4.6, C.metal); // makinenin üstüne merdiven
  for (const [x, z, door, crawl] of [[33, -34, 'n', 'w'], [-34, 34, 's', 'e']]) {
    // köşe sığınağı: bir kapı, diğer yanda eğilerek girilen delik
    hut(x, z, 6, 5, 2.6, C.concrete, {
      roof: C.wallCap, doors: [{ side: door, at: 0 }], windows: [{ side: crawl, at: 0, w: 1.2, y0: 0, y1: CRAWL }],
    });
  }
  // dağınık siperler
  barrier(14, -8, 0.6, 3.5);
  barrier(-14, 8, 0.6, 3.5);
  barrier(-15, -10, 3.5, 0.6);
  barrier(15, 11, 3.5, 0.6);
  tires(-34, 2);
  tires(36, -6);
  crate(-36, -6, 1.6, 1.6);
  crate(36, 8, 1.6, 1.6);
  crate(4, -33, 1.6, 1.6);
  crate(5.4, -34.2, 1, 0.9);
  junkCar(28, -12, false, C.car2);
  junkCar(-4, 30, true, C.car1);

  // Doğuş noktaları: haritanın her yerine dağılmış, ortaya bakar
  const pts = [
    [-34, 0], [35, -2], [0, 36], [0, -36], [-18, 35], [17, 36], [-33, -22], [31, 11], [-12, -34], [12, -36],
    [-35, 25], [36, -20], [-3, -15], [3, 15], [-15, 3], [15, -3],
  ];
  const ffa = pts.map(([x, z]) => [x, 0.1, z, Math.atan2(x, z)]); // yaw: ortaya dön
  // Takım modları: kırmızı güney ucu, mavi kuzey ucu
  const red = [[-8, -36], [-4, -37], [0, -36], [-6, -34], [-2, -34.5], [2, -34], [-10, -37.5], [8, -37.5]];
  const blue = [[8, 36], [4, 37], [0, 36], [6, 34], [2, 34.5], [-2, 34], [10, 37.5], [-4, 37.5]];
  box(-2.5, -30.5, 11, 0.8, 2.2, C.concrete); // doğuş önü siper duvarları (iki uç birbirini görmesin)
  box(4, 30.5, 9, 0.8, 2.2, C.concrete);
  box(-2.5, -30.5, 11.3, 1, 0.15, C.wallCap, { y: 2.2, solid: false });
  box(4, 30.5, 9.3, 1, 0.15, C.wallCap, { y: 2.2, solid: false });
  box(-1, -37, 18, 4, 0.03, '#e63946', { solid: false }); // doğuş alanları (dekor)
  box(3, 36, 18, 4, 0.03, '#2a6fdb', { solid: false });

  return {
    id: 'scrap',
    name: 'HURDALIK',
    boxes,
    pads,
    spawns: {
      ffa,
      red: red.map(([x, z]) => [x, 0.1, z, Math.PI]),
      blue: blue.map(([x, z]) => [x, 0.1, z, 0]),
    },
    flags: { red: [0, 0.1, -38.2], blue: [2, 0.1, 38.2] },
    bounds: { x: B - 0.6, z: B - 0.6, minY: -5, maxY: 20 },
    sky: '#f6bd60',
  };
}

export const MAPS = {
  city: { id: 'city', sky: '#8ecae6', flags: flagsFrom(0, -40.4), ...CITY_ARENA, name: 'CITY ARENA' },
  pool: poolParty(),
  frost: frostArena(),
  scrap: scrapyard(),
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
