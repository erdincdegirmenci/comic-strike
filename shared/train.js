// Hareketli oyuncak tren (Dev Oda). Konumu sadece zamandan hesaplanır: sunucu ve istemci aynı kodu kullanır,
// bu yüzden trenin yerini ağdan göndermek gerekmez.
// Harita verisi: train: { z, from, to, speed, dwell } → tren X ekseninde, vagon merkezi from..to arasında gidip gelir.

const FLOOR = 0.35; // vagon tabanının üstü (karakter kendiliğinden çıkar)
const WALL = 1.3; // pencere altı duvar: ayakta göz (1.55) pencereden görür, çömelen (1.15) tamamen saklanır
const SILL = FLOOR + WALL;
const HEAD = FLOOR + 1.9; // pencere üstü / tavan altı
const HALF_L = 3.5; // vagon yarı uzunluğu
const HALF_W = 1.3; // vagon yarı genişliği
const NOSE = 6.1; // lokomotifin ucu (vagon merkezinden)

/** Yerel koordinatlar: u = ray boyunca, v = rayın yanı. [u0, u1, v0, v1, y0, y1, renk] */
const PARTS = (() => {
  const red = '#b5524a';
  const blue = '#5f7fa0';
  const yellow = '#d1b25a';
  const green = '#6f9a6a';
  const dark = '#3a3530';
  const out = [];
  const add = (u0, u1, v0, v1, y0, y1, c) => out.push([u0, u1, v0, v1, y0, y1, c]);
  add(-HALF_L, HALF_L, -HALF_W, HALF_W, 0.1, FLOOR, dark); // taban
  for (const s of [-1, 1]) {
    const v0 = s < 0 ? -HALF_W : HALF_W - 0.15;
    const v1 = v0 + 0.15;
    // Yan duvarlar: ortada kapı (1.6 m)
    add(-HALF_L, -0.8, v0, v1, FLOOR, SILL, yellow);
    add(0.8, HALF_L, v0, v1, FLOOR, SILL, yellow);
    // Pencere direkleri
    for (const u of [-HALF_L, -2.15, -0.98, 0.8, 1.97, HALF_L - 0.18]) add(u, u + 0.18, v0, v1, SILL, HEAD, green);
  }
  // Uç duvarlar ve pencereleri
  for (const u of [-HALF_L, HALF_L - 0.15]) {
    add(u, u + 0.15, -HALF_W + 0.15, HALF_W - 0.15, FLOOR, SILL, yellow);
    add(u, u + 0.15, -0.09, 0.09, SILL, HEAD, green);
  }
  add(-HALF_L - 0.15, HALF_L + 0.1, -HALF_W - 0.15, HALF_W + 0.15, HEAD, HEAD + 0.18, red); // tavan
  // Lokomotif (dolu gövde)
  add(HALF_L + 0.1, NOSE, -1.1, 1.1, 0.1, 1.5, red);
  add(HALF_L + 0.1, HALF_L + 1.1, -1.15, 1.15, 1.5, 2.5, blue); // makinist kabini
  add(NOSE - 0.8, NOSE - 0.3, -0.25, 0.25, 1.5, 2.4, dark); // baca
  return out;
})();

/** Tekerlekler sadece görünüm (çarpışmaz): [u, v] merkezleri */
export const TRAIN_WHEELS = [-2.6, -1.3, 1.3, 2.6, 4.3, 5.4].flatMap((u) => [[u, -HALF_W - 0.1], [u, HALF_W + 0.1]]);

/** t (ms, sunucu saati) anında vagon merkezinin X konumu: uçlarda dwell sn bekler, arada yumuşak hızlanır */
export function trainX(train, t) {
  const len = train.to - train.from;
  const travel = len / train.speed;
  const leg = train.dwell + travel;
  let s = (t / 1000) % (leg * 2);
  const back = s >= leg;
  if (back) s -= leg;
  const k = Math.max(0, Math.min(1, (s - train.dwell) / travel));
  const e = k * k * (3 - 2 * k);
  return back ? train.to - len * e : train.from + len * e;
}

/** Yerel koordinatlı parçalar (görünüm için) */
export const trainParts = () => PARTS;

/** t anındaki çarpışma kutuları (harita kutularıyla aynı biçim) */
export function trainSolids(train, t) {
  const x = trainX(train, t);
  return PARTS.map(([u0, u1, v0, v1, y0, y1]) => ({ min: [x + u0, y0, train.z + v0], max: [x + u1, y1, train.z + v1] }));
}

/** pos (ayak noktası) t anında trenin içinde / üstünde / uçlarının dibinde mi */
export function onTrain(train, pos, t) {
  const u = pos[0] - trainX(train, t);
  const v = pos[2] - train.z;
  return u > -HALF_L - 0.4 && u < NOSE + 0.4 && Math.abs(v) < HALF_W + 0.1 && pos[1] > -0.2 && pos[1] < 3.4;
}

/** t0 → t1 arasında pos'taki oyuncunun trenle birlikte X'te ne kadar kayacağı (trende değilse 0) */
export function trainCarry(train, pos, t0, t1) {
  return onTrain(train, pos, t0) ? trainX(train, t1) - trainX(train, t0) : 0;
}
