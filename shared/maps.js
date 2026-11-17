// Harita listesi. Lobide host haritayı seçer; istemci ve sunucu aynı veriyi kullanır.
// Her harita: { id, name, boxes, spawns, bounds, sky, traction?, water? }
// Kırmızı takım -Z, mavi takım +Z tarafında; haritalar Z=0'a göre aynalanır.
import { CITY_ARENA } from './map.js';

/** Kutu ekleme yardımcıları (map.js ile aynı mantık) */
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
  return { boxes, box };
}

const spawnsFrom = (list, y = 0.1) => ({
  red: list.map(([x, z]) => [x, y, z, Math.PI]),
  blue: list.map(([x, z]) => [x, y, -z, 0]),
});

// ======================================================================
// POOL PARTY — ortada havuz, etrafında şezlonglar ve havuz evleri
// ======================================================================
function poolParty() {
  const { boxes, box } = builder();
  const C = {
    grass: '#8cb369', tile: '#f1e3c8', tile2: '#e7d3ad', poolFloor: '#4cc9f0', poolEdge: '#ffffff',
    wall: '#f4f1de', wallCap: '#e07a5f', house: '#ffb5a7', roof: '#3d405b', lounger: '#ff70a6',
    lounger2: '#ffd23f', towel: '#2a9d8f', board: '#ffffff', metal: '#adb5bd', palm: '#7f5539',
    leaf: '#40916c', red: '#e63946', blue: '#2a6fdb', bar: '#f4a259', window: '#25335e', door: '#5a3a22',
  };
  const PX = 7; // havuz yarı genişliği (X)
  const PZ = 9; // havuz yarı uzunluğu (Z)
  const DEPTH = 1.2;

  // Zemin: ortasında havuz boşluğu bırakan 4 parça (3 m kalın)
  box(-(80 + PX) / 2, 0, 80 - PX, 160, 3, C.grass, { y: -3, mirror: false });
  box((80 + PX) / 2, 0, 80 - PX, 160, 3, C.grass, { y: -3, mirror: false });
  box(0, -(80 + PZ) / 2, PX * 2, 80 - PZ, 3, C.grass, { y: -3 });
  // Fayans alan (dekor, zemin üstünde ince)
  // (havuz boşluğunu kapatmasın diye havuzun etrafında 4 parça)
  for (const sx of [-1, 1]) box(sx * (17 + PX) / 2, 0, 17 - PX, 48, 0.02, C.tile, { mirror: false, solid: false });
  box(0, -(24 + PZ) / 2, PX * 2, 24 - PZ, 0.02, C.tile, { solid: false });
  for (let x = -16; x <= 16; x += 4) box(x, -22, 2, 2, 0.025, C.tile2, { solid: false });
  // Havuz tabanı ve kenar şeridi
  box(0, 0, PX * 2, PZ * 2, 1, C.poolFloor, { y: -DEPTH - 1, mirror: false });
  box(0, -PZ - 0.25, PX * 2 + 1, 0.5, 0.06, C.poolEdge, { solid: false });
  for (const s of [-1, 1]) box(s * (PX + 0.25), 0, 0.5, PZ * 2 + 1, 0.06, C.poolEdge, { solid: false, mirror: false });
  // Havuzdan çıkış merdivenleri (iki uçta)
  box(0, -PZ + 0.6, 4, 1.2, DEPTH - 0.4, C.poolEdge, { y: -DEPTH }); // üst basamak
  box(0, -PZ + 1.8, 4, 1.2, DEPTH - 0.8, C.poolEdge, { y: -DEPTH }); // alt basamak
  // Atlama tahtaları
  for (const sx of [-1, 1]) {
    box(sx * 4.5, -PZ - 1.2, 0.8, 1.4, 0.6, C.metal);
    box(sx * 4.5, -PZ + 0.2, 0.7, 3.4, 0.12, C.board, { y: 0.6 });
  }

  // Sınır duvarları
  box(0, -25, 37, 1, 4, C.wall);
  box(0, -25, 37.6, 1.6, 0.35, C.wallCap, { y: 4 });
  for (const sx of [-1, 1]) {
    box(sx * 18, 0, 1, 51, 4, C.wall, { mirror: false });
    box(sx * 18, 0, 1.6, 51.6, 0.35, C.wallCap, { y: 4, mirror: false });
  }

  // Spawn alanları
  box(0, -21.5, 10, 4, 0.03, C.red, { solid: false, mirrorColor: C.blue });

  // Havuz evleri (köşelerde) + kapı/pencere dekoru
  for (const sx of [-1, 1]) {
    box(sx * 13.5, -19, 7, 6, 3.4, C.house);
    box(sx * 13.5, -19, 7.6, 6.6, 0.35, C.roof, { y: 3.4 });
    box(sx * 13.5, -15.95, 1.2, 0.1, 2.1, C.door, { solid: false });
    box(sx * 11.5, -15.95, 1.4, 0.1, 1, C.window, { solid: false, y: 1.3 });
    box(sx * 15.5, -15.95, 1.4, 0.1, 1, C.window, { solid: false, y: 1.3 });
  }
  // Havuz başındaki bar tezgahı (ortada, iki tarafı ayırır)
  for (const sx of [-1, 1]) {
    box(sx * 12.5, 0, 1.2, 6, 1.15, C.bar, { mirror: false });
    box(sx * 12.5, 0, 1.6, 6.4, 0.12, C.wallCap, { y: 1.15, mirror: false });
  }
  // Şezlonglar (alçak siper)
  for (const [x, z, col] of [[-10, -11, C.lounger], [-10, -7.5, C.lounger2], [10, -12, C.lounger2], [10, -6, C.lounger]]) {
    box(x, z, 1.9, 0.8, 0.45, col);
    box(x - 0.75, z, 0.4, 0.8, 0.5, col, { y: 0.45 });
    box(x + 0.2, z, 1, 0.7, 0.02, C.towel, { y: 0.45, solid: false });
  }
  // Şemsiyeler (direk + tente)
  for (const [x, z] of [[-8.5, -13.5], [8.5, -4], [-3.5, -16]]) {
    box(x, z, 0.12, 0.12, 2.6, C.metal);
    box(x, z, 2.6, 2.6, 0.2, C.lounger, { y: 2.6, solid: false });
    box(x, z, 1.6, 1.6, 0.2, C.poolEdge, { y: 2.8, solid: false });
  }
  // Palmiyeler (gövde siper, yapraklar dekor)
  for (const [x, z] of [[-16, -9], [16, -9], [-16, -3], [16, -2]]) {
    box(x, z, 0.5, 0.5, 4.5, C.palm, { mirror: false });
    box(x, z, 3, 0.6, 0.25, C.leaf, { y: 4.5, solid: false, mirror: false });
    box(x, z, 0.6, 3, 0.25, C.leaf, { y: 4.6, solid: false, mirror: false });
    box(x, -z, 0.5, 0.5, 4.5, C.palm, { mirror: false });
    box(x, -z, 3, 0.6, 0.25, C.leaf, { y: 4.5, solid: false, mirror: false });
    box(x, -z, 0.6, 3, 0.25, C.leaf, { y: 4.6, solid: false, mirror: false });
  }
  // Dondurma büfesi: spawn'dan spawn'a düz görüşü keser
  box(0, -14.5, 3.2, 1.6, 2.3, C.lounger2);
  box(0, -14.5, 3.8, 2.2, 0.25, C.lounger, { y: 2.3 });
  // Cankurtaran kulesi ve kasalar
  box(-6, -13, 1.2, 1.2, 1.8, C.metal);
  box(-6, -13, 1.6, 1.6, 0.25, C.red, { y: 1.8 });
  box(6, -19.5, 1.4, 1.4, 1.4, C.lounger2);
  box(4.8, -19.8, 0.9, 0.9, 0.9, C.towel);
  box(-6.5, -19, 2.5, 0.7, 1.2, C.wall);

  return {
    id: 'pool',
    name: 'POOL PARTY',
    boxes,
    spawns: spawnsFrom([[-3, -22], [0, -22.5], [3, -22], [-6, -21], [6, -21], [-1.5, -20.5], [1.5, -20.5], [0, -20]]),
    bounds: { x: 17.6, z: 24.6, minY: -3, maxY: 15 },
    sky: '#8ecae6',
    water: { min: [-PX, -DEPTH, -PZ], max: [PX, -0.3, PZ], color: '#4cc9f0' },
  };
}

// ======================================================================
// FROST ARENA — buz blokları, kar kaleleri, kaygan zemin
// ======================================================================
function frostArena() {
  const { boxes, box } = builder();
  const C = {
    snow: '#f1faee', snow2: '#dbe9f0', ice: '#a8dadc', ice2: '#90e0ef', deep: '#457b9d', rock: '#6c757d',
    wall: '#bde0fe', wallCap: '#ffffff', pine: '#2d6a4f', trunk: '#5a3a22', red: '#e63946', blue: '#2a6fdb',
    crate: '#c97b3d', flag: '#ffd23f',
  };
  box(0, 0, 160, 160, 1, C.snow, { y: -1, mirror: false });
  // Buzlu zemin şeridi (dekor) — orta alan
  box(0, 0, 22, 22, 0.02, C.ice2, { solid: false, mirror: false });

  // Sınır: buz duvarlar
  box(0, -29, 41, 1.2, 5, C.wall);
  box(0, -29, 41.8, 1.8, 0.4, C.wallCap, { y: 5 });
  for (const sx of [-1, 1]) {
    box(sx * 20, 0, 1.2, 59, 5, C.wall, { mirror: false });
    box(sx * 20, 0, 1.8, 59.8, 0.4, C.wallCap, { y: 5, mirror: false });
  }
  box(0, -25, 10, 4, 0.03, C.red, { solid: false, mirrorColor: C.blue });

  // Merkez: buz kristali anıtı + çevresinde alçak buz blokları
  box(0, 0, 4, 4, 1, C.deep, { mirror: false });
  box(0, 0, 2.4, 2.4, 3.6, C.ice, { y: 1, mirror: false });
  box(0, 0, 1.2, 1.2, 1.6, C.ice2, { y: 4.6, mirror: false });
  for (const [x, z] of [[-6, -3], [6, 3], [-6, 3], [6, -3]]) box(x, z, 2, 2, 1.3, C.ice, { mirror: false });

  // Kar kaleleri (L şeklinde duvarlar) — her takımın önünde iki tane
  for (const sx of [-1, 1]) {
    box(sx * 8, -15, 6, 1, 1.5, C.snow2);
    box(sx * 10.5, -13, 1, 5, 1.5, C.snow2);
    box(sx * 8, -15, 6.4, 1.4, 0.25, C.wallCap, { y: 1.5 });
  }
  // Orta koridoru kapatan büyük buz blokları (spawn'dan spawn'a görüşü keser)
  box(0, -10, 7, 1.6, 3, C.ice);
  box(-15, -6, 3, 3, 3, C.deep);
  box(15, -6, 3, 3, 3, C.deep);
  // Yan geçitler: buz kemer (üstü dekor)
  for (const sx of [-1, 1]) {
    box(sx * 16.5, -18, 1.2, 1.2, 3.5, C.ice);
    box(sx * 12.5, -18, 1.2, 1.2, 3.5, C.ice);
    box(sx * 14.5, -18, 5.2, 1.2, 0.8, C.ice2, { y: 3.5 });
  }
  // Kaya ve kasalar
  box(-4, -21, 2.2, 1.6, 1.2, C.rock);
  box(4.5, -20, 1.5, 1.5, 1.5, C.crate);
  box(5.8, -20.4, 1, 1, 0.9, C.crate);
  box(-12, -23, 1.6, 1.6, 1.6, C.crate);
  // Çam ağaçları (gövde siper, yapraklar dekor) — köşelerde
  for (const [x, z] of [[-17.5, -26], [17.5, -26], [-17.5, -1], [17.5, 1]]) {
    box(x, z, 0.5, 0.5, 1.5, C.trunk, { mirror: false });
    box(x, z, 2.4, 2.4, 1.6, C.pine, { y: 1.5, mirror: false });
    box(x, z, 1.6, 1.6, 1.4, C.pine, { y: 3.1, mirror: false });
    box(x, z, 0.8, 0.8, 1, C.snow, { y: 4.5, mirror: false, solid: false });
    box(x, -z, 0.5, 0.5, 1.5, C.trunk, { mirror: false });
    box(x, -z, 2.4, 2.4, 1.6, C.pine, { y: 1.5, mirror: false });
    box(x, -z, 1.6, 1.6, 1.4, C.pine, { y: 3.1, mirror: false });
    box(x, -z, 0.8, 0.8, 1, C.snow, { y: 4.5, mirror: false, solid: false });
  }
  // Bayrak direkleri
  box(0, -27.5, 0.15, 0.15, 4, C.rock);
  box(0.6, -27.5, 1.1, 0.05, 0.7, C.red, { y: 3.2, solid: false, mirrorColor: C.blue });

  return {
    id: 'frost',
    name: 'FROST ARENA',
    boxes,
    spawns: spawnsFrom([[-3, -26], [0, -26.5], [3, -26], [-6, -25], [6, -25], [-1.5, -24], [1.5, -24], [0, -23.5]]),
    bounds: { x: 19.6, z: 28.6, minY: -5, maxY: 15 },
    sky: '#cfe8f3',
    traction: 0.3, // buz: kaygan hareket
  };
}

export const MAPS = {
  city: { id: 'city', sky: '#8ecae6', ...CITY_ARENA, name: 'CITY ARENA' },
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
