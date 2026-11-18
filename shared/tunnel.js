// Yer altı tünelleri: zemin levhasında merdivenli giriş delikleri ve altından geçen koridorlar.
// Haritalar zemini 1 m kalınlığında bir levha olarak kurar (y -1..0); tünelin tavanı bu levhadır.
// Tünel kutuları aynalanmaz: iki takımın tarafını birbirine bağlayan tünel tek parça tanımlanır.

export const TUNNEL = {
  FLOOR: -3.2, // tünel zemini (tavan levhanın altı -1 → 2.2 m boşluk)
  WIDTH: 3, // koridor iç genişliği
  WALL: 0.3,
  STAIR_W: 2.2, // merdiven ve giriş deliği genişliği
  STEP: 0.4, // basamak yüksekliği (karakter otomatik çıkar)
};

/**
 * Tünel kutularını üretir. box(cx, cz, w, d, h, color, {y, solid, mirror}) harita kutu fonksiyonu.
 * o = { axis: 'x' | 'z', at, from, to, stairs: ['start', 'end'], depth (basamak derinliği, 0.5),
 *       gaps: [[a, b]] (kavşak için duvar boşlukları, eksen boyunca), color, wall, lamp }
 * Dönüş: zeminde açılacak delikler [{x0, x1, z0, z1}] (carve ile uygulanır).
 */
export function addTunnel(box, o) {
  const T = TUNNEL;
  const F = T.FLOOR;
  const W = T.WIDTH;
  const n = Math.round(-F / T.STEP);
  const depth = o.depth ?? 0.5;
  const run = n * depth;
  const ends = o.stairs ?? ['start', 'end'];
  const from = Math.min(o.from, o.to);
  const to = Math.max(o.from, o.to);
  const along = o.axis;
  const nm = { mirror: false };
  const col = o.color ?? '#8d99ae';
  const wallCol = o.wall ?? '#5c677d';
  // eksen boyunca [a,b], diğer eksende [c0,c1] olan kutu
  const put = (a, b, c0, c1, y, h, color, solid = true) => {
    if (b - a < 0.01 || c1 - c0 < 0.01 || h < 0.01) return;
    if (along === 'z') box((c0 + c1) / 2, (a + b) / 2, c1 - c0, b - a, h, color, { ...nm, y, solid });
    else box((a + b) / 2, (c0 + c1) / 2, b - a, c1 - c0, h, color, { ...nm, y, solid });
  };
  const c = o.at;
  const L0 = from - T.WALL;
  const L1 = to + T.WALL;
  // taban
  put(L0, L1, c - W / 2 - T.WALL, c + W / 2 + T.WALL, F - 0.4, 0.4, col);
  // yan duvarlar (kavşak boşluklarıyla)
  const gaps = (o.gaps ?? []).slice().sort((p, q) => p[0] - q[0]);
  for (const side of [-1, 1]) {
    const w0 = side < 0 ? c - W / 2 - T.WALL : c + W / 2;
    const w1 = w0 + T.WALL;
    let a = L0;
    for (const [g0, g1] of gaps) {
      put(a, g0, w0, w1, F, -1 - F, wallCol);
      a = g1;
    }
    put(a, L1, w0, w1, F, -1 - F, wallCol);
  }
  // uç duvarları
  put(L0, from, c - W / 2, c + W / 2, F, -1 - F, wallCol);
  put(to, L1, c - W / 2, c + W / 2, F, -1 - F, wallCol);
  // tavan lambaları (dekor)
  for (let a = from + 3; a < to - 2; a += 6) put(a - 0.6, a + 0.6, c - 0.15, c + 0.15, -1.08, 0.08, o.lamp ?? '#fff3b0', false);
  // yer gösterici çizgi (dekor)
  put(from, to, c - 0.08, c + 0.08, F, 0.02, '#ffd23f', false);

  const holes = [];
  const sw = T.STAIR_W / 2;
  const OPEN = 0.9; // delik merdiven dibinden bu kadar ileri uzar (inerken baş tavana çarpmasın)
  for (const e of ends) {
    // merdiven: tünel zemininden yukarı, uca doğru çıkar; en üst basamak zeminle aynı hizada
    for (let i = 0; i < n; i++) {
      const top = F + (i + 1) * T.STEP;
      const a = e === 'start' ? from + run - (i + 1) * depth : to - run + i * depth;
      put(a, a + depth, c - sw, c + sw, F, top - F, o.stairColor ?? col);
    }
    const a = e === 'start' ? from : to - run - OPEN;
    const len = run + OPEN;
    if (along === 'z') holes.push({ x0: c - sw, x1: c + sw, z0: a, z1: a + len });
    else holes.push({ x0: a, x1: a + len, z0: c - sw, z1: c + sw });
    // Korkuluk: deliğin iki yanında ve dip ucunda (girilen tek yer merdivenin tepesi; en üst basamak zeminle aynı hizada)
    const rail = o.rail ?? '#ffd23f';
    const r0 = e === 'start' ? from + depth : to - run - OPEN;
    const r1 = e === 'start' ? from + run + OPEN : to - depth;
    put(r0, r1, c - sw - 0.1, c - sw, 0, 1, rail);
    put(r0, r1, c + sw, c + sw + 0.1, 0, 1, rail);
    const endA = e === 'start' ? from + run + OPEN : to - run - OPEN - 0.1;
    put(endA, endA + 0.1, c - sw - 0.1, c + sw + 0.1, 0, 1, rail);
  }
  return holes;
}

/**
 * Zemin seviyesindeki kutuları (zemin levhası, kaldırım, dekor) deliklerden keser.
 * Sadece tamamen -1..0.6 arasındaki kutular kesilir; binalar vb. etkilenmez. boxes yerinde güncellenir.
 */
export function carve(boxes, holes) {
  if (!holes.length) return boxes;
  const out = [];
  for (const b of boxes) {
    if (b.min[1] < -1.01 || b.max[1] > 0.6) {
      out.push(b);
      continue;
    }
    let pieces = [b];
    for (const h of holes) {
      const next = [];
      for (const p of pieces) {
        const [x0, , z0] = p.min;
        const [x1, , z1] = p.max;
        if (h.x1 <= x0 || h.x0 >= x1 || h.z1 <= z0 || h.z0 >= z1) {
          next.push(p);
          continue;
        }
        const mk = (ax0, ax1, az0, az1) => {
          if (ax1 - ax0 > 0.001 && az1 - az0 > 0.001) next.push({ ...p, min: [ax0, p.min[1], az0], max: [ax1, p.max[1], az1] });
        };
        mk(x0, h.x0, z0, z1); // sol
        mk(h.x1, x1, z0, z1); // sağ
        const cx0 = Math.max(x0, h.x0);
        const cx1 = Math.min(x1, h.x1);
        mk(cx0, cx1, z0, h.z0); // ön
        mk(cx0, cx1, h.z1, z1); // arka
      }
      pieces = next;
    }
    out.push(...pieces);
  }
  boxes.length = 0;
  boxes.push(...out);
  return boxes;
}

/** Botlar için tünel çıkışları: [tünel içindeki merdiven dibi, merdiven tepesinin dışı] */
export function tunnelExits(o) {
  const T = TUNNEL;
  const n = Math.round(-T.FLOOR / T.STEP);
  const run = n * (o.depth ?? 0.5);
  const from = Math.min(o.from, o.to);
  const to = Math.max(o.from, o.to);
  const out = [];
  for (const e of o.stairs ?? ['start', 'end']) {
    const bottom = e === 'start' ? from + run + 0.8 : to - run - 0.8;
    const top = e === 'start' ? from + (o.depth ?? 0.5) / 2 : to - (o.depth ?? 0.5) / 2;
    // [içerideki nokta, dışarıdaki nokta, içerinin zemin yüksekliği]
    out.push(o.axis === 'z' ? [[o.at, bottom], [o.at, top], T.FLOOR] : [[bottom, o.at], [top, o.at], T.FLOOR]);
  }
  return out;
}
