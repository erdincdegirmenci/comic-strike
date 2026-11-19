// ======================================================================
// DEV ODA — SADECE HERKES TEK. Oyuncular minicik; dev bir çocuk odasında herkes herkese karşı.
// Harita aynalanmaz; doğuş noktaları odanın her yerine dağılmıştır.
//  · Ortada dev masa: iki yandan kitap merdiveniyle üstüne çıkılır (kupa, kalemlik, açık kitap siper olur)
//  · Kuzey duvarında iki katlı kitaplık: alt rafa kitap merdiveniyle, üst rafa raftaki küçük kitap merdiveniyle
//  · Köşede dev yatak: altına çömelerek saklanılır, üstüne trambolinle (ya da oyuncak sandığından) çıkılır
//  · Oyuncak kale: kapısı, alçak sürünme deliği, ortada merdivenli kule
//  · Kanepe: altına çömelerek girilir, oturağına trambolinle fırlanır
//  · Karton kutu kalesi, oyuncak tren, lastik ördek, dev küpler, toplar, oyuncak araba
// builder: maps.js'teki kutu yardımcıları (bkz. builder()).
// ======================================================================
export function toyRoom(builder) {
  const { boxes, pads, box, rect, stairs, hut, pad } = builder({ mirror: false });
  const C = {
    floor: '#b99a72',
    plank: '#a88a63',
    wall: '#ebe2cd',
    wall2: '#e2d5ba',
    skirting: '#7a5a3c',
    leg: '#6e4f34',
    top: '#8c6845',
    shelf: '#7d5a3c',
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
    red: '#b5524a',
    blue: '#5f7fa0',
    yellow: '#d1b25a',
    green: '#6f9a6a',
    orange: '#d9844a',
    purple: '#8a6f9e',
    bedFrame: '#8a6a4b',
    mattress: '#efe6d2',
    blanket: '#7fa0c0',
    blanket2: '#a9c2d9',
    pillow: '#f6efe0',
    sofa: '#a65d4f',
    sofa2: '#bf7a68',
    cardboard: '#c8a271',
    cardboard2: '#b08a5b',
    rail: '#4a4038',
    sleeper: '#8a6a4b',
    rug: '#a65d4f',
    rug2: '#c6a271',
    duck: '#e8c547',
    beak: '#e07a3f',
    glass: '#a8d8e8',
    curtain: '#9fb88a',
    lamp: '#f2d98a',
    dark: '#3a3530',
  };
  const B = 30; // oda yarı genişliği (60 x 60 m)
  const WH = 18;

  // ---------------- Zemin ve duvarlar ----------------
  box(0, 0, 400, 400, 1, C.floor, { y: -1 });
  box(0, -B - 0.25, B * 2 + 1, 0.5, WH, C.wall);
  box(0, B + 0.25, B * 2 + 1, 0.5, WH, C.wall);
  box(-B - 0.25, 0, 0.5, B * 2 + 1, WH, C.wall2);
  box(B + 0.25, 0, 0.5, B * 2 + 1, WH, C.wall2);
  box(0, -B + 0.1, B * 2, 0.2, 0.8, C.skirting);
  box(0, B - 0.1, B * 2, 0.2, 0.8, C.skirting);
  box(-B + 0.1, 0, 0.2, B * 2, 0.8, C.skirting);
  box(B - 0.1, 0, 0.2, B * 2, 0.8, C.skirting);
  for (let x = -27; x <= 27; x += 3) box(x, 0, 0.06, B * 2, 0.012, C.plank, { solid: false });
  // Ortada halı
  box(0, 0, 32, 24, 0.03, C.rug, { solid: false });
  box(0, 0, 29, 21, 0.035, C.rug2, { solid: false });
  // Güney duvarında perdeli dev pencere (görünüm)
  box(-6, B - 0.1, 16, 0.12, 9, '#cfe8f3', { y: 5, solid: false });
  box(-6, B - 0.16, 16.4, 0.06, 0.4, C.shelf, { y: 9.3, solid: false });
  box(-6, B - 0.16, 0.3, 0.06, 9, C.shelf, { y: 5, solid: false });
  box(-15, B - 0.25, 2.4, 0.15, 12, C.curtain, { y: 3, solid: false });
  box(3, B - 0.25, 2.4, 0.15, 12, C.curtain, { y: 3, solid: false });

  // ---------------- Dev masa (orta) ----------------
  const TY = 7;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * 8.6, sz * 5.4, 1.2, 1.2, TY, C.leg);
  box(0, 0, 20, 12.4, 0.8, C.top, { y: TY });
  const TOP = TY + 0.8;
  // İki yandan kitap yığını merdiveni
  stairs(11.2, -15, 'z', 1, 2, 9, TOP, C.book1);
  stairs(-11.2, 15, 'z', -1, 2, 9, TOP, C.book2);
  for (let i = 0; i < 20; i++) {
    const h = ((i + 1) * TOP) / 20;
    box(12.25, -15 + i * 0.45 + 0.22, 0.08, 0.42, h, [C.book2, C.book3, C.book4, C.pages][i % 4], { solid: false });
    box(-12.25, 15 - i * 0.45 - 0.22, 0.08, 0.42, h, [C.book1, C.book3, C.pages, C.book4][i % 4], { solid: false });
  }
  // Masanın üstü: kupa, kalemlik, kalem, silgi, açık kitap, oyuncak küpler
  box(-5, -2.5, 2.6, 2.6, 3.2, C.mug, { y: TOP });
  box(-5, -2.5, 2.2, 2.2, 0.05, C.coffee, { y: TOP + 3.2, solid: false });
  box(-6.6, -2.5, 0.5, 1.4, 1.8, C.mug, { y: TOP + 0.7 });
  box(6, 3.5, 2.4, 2.4, 3.6, C.mug2, { y: TOP }); // kalemlik
  for (const [dx, dz, col] of [[-0.5, 0.3, C.red], [0.4, -0.4, C.blue], [0.2, 0.6, C.yellow]]) box(6 + dx, 3.5 + dz, 0.35, 0.35, 2.4, col, { y: TOP + 3.6, solid: false });
  box(1, 2, 9, 0.6, 0.6, C.pencil, { y: TOP });
  box(5.9, 2, 0.8, 0.45, 0.45, C.pencilTip, { y: TOP + 0.08, solid: false });
  box(-2.8, 3.8, 0.9, 0.7, 0.7, C.eraser, { y: TOP });
  box(1.5, -3.5, 7, 4.5, 0.4, C.pages, { y: TOP });
  box(1.5, -3.5, 7.3, 4.8, 0.15, C.book2, { y: TOP - 0.1, solid: false });
  box(-8, 4, 1.4, 1.4, 1.4, C.red, { y: TOP });
  box(-8.6, 2.6, 1.2, 1.2, 1.2, C.yellow, { y: TOP });

  // ---------------- Kitaplık (kuzey duvarı, iki katlı) ----------------
  const SH1 = 3.0;
  const SH2 = 6.5;
  rect(-24, 0, -B, -27, SH1, 0.35, C.shelf);
  rect(-24, -9, -B, -27, SH2, 0.35, C.shelf);
  box(-24.2, -28.5, 0.4, 3, 11, C.shelf);
  box(0.2, -28.5, 0.4, 3, SH1 + 0.35, C.shelf);
  stairs(7.5, -28.5, 'x', -1, 2, 7.5, SH1 + 0.35, C.book3); // yerden alt rafa
  stairs(-2, -28.7, 'x', -1, 1.4, 6.5, SH2 - SH1, C.book4, { y: SH1 + 0.35 }); // alt raftan üst rafa
  // Raflardaki kitaplar (siper; aralarından geçilir)
  const books = (x0, n, y, maxH) => {
    for (let i = 0; i < n; i++) {
      const col = [C.book1, C.book2, C.book3, C.book4][(i + Math.round(Math.abs(x0))) % 4];
      box(x0 + i * 0.55, -29.2, 0.5, 1.6, maxH - (i % 3) * 0.35, col, { y });
    }
  };
  for (const x of [-22, -16, -11]) books(x, 3, SH1 + 0.35, 2.4);
  for (const x of [-22.5, -17, -12]) books(x, 3, SH2 + 0.35, 2.6);
  box(-20, -29, 1.8, 1.8, 1.6, C.duck, { y: SH2 + 0.35 }); // rafta lastik ördek
  box(-20, -29.4, 1.1, 1.1, 1.0, C.duck, { y: SH2 + 1.95 });
  box(-20, -30.1, 0.5, 0.4, 0.25, C.beak, { y: SH2 + 2.3, solid: false });

  // ---------------- Dev yatak (kuzeydoğu köşesi) ----------------
  // Ayaklar 1.3 m: altına sadece çömelerek girilir (saklambaç). Üstüne trambolin ya da oyuncak sandığı ile.
  const BED = { x0: 17, x1: 29.6, z0: -29.6, z1: -14 };
  const LEG = 1.3;
  for (const x of [BED.x0 + 0.4, BED.x1 - 0.4]) for (const z of [BED.z0 + 0.4, BED.z1 - 0.4]) rect(x - 0.4, x + 0.4, z - 0.4, z + 0.4, 0, LEG, C.bedFrame);
  rect(BED.x0, BED.x1, BED.z0, BED.z1, LEG, 0.5, C.bedFrame);
  rect(BED.x0 + 0.2, BED.x1 - 0.2, BED.z0 + 0.2, BED.z1 - 0.2, LEG + 0.5, 1.2, C.mattress);
  const BTOP = LEG + 1.7;
  rect(BED.x0, BED.x1, BED.z0 - 0.1, BED.z0 + 0.4, 0, 7, C.bedFrame); // başlık
  box(23.3, -27.6, 8, 2.6, 0.9, C.pillow, { y: BTOP });
  rect(BED.x0 + 0.1, BED.x1 - 0.1, -24.5, BED.z1 - 0.1, BTOP, 0.35, C.blanket);
  for (const z of [-22, -19, -16]) rect(BED.x0 + 0.1, BED.x1 - 0.1, z - 0.6, z + 0.6, BTOP + 0.35, 0.3, C.blanket2);
  rect(BED.x0 - 0.05, BED.x0 + 0.1, -24.5, BED.z1, LEG + 0.5, 1.5, C.blanket, { solid: false }); // sarkan yorgan
  box(23, -14, 6, 0.6, 0.02, C.dark, { y: 0.01, solid: false }); // yatak altı gölgesi
  // Oyuncak sandığı basamakları ve trambolin
  box(13, -10.5, 2, 2, 0.9, C.red);
  box(14.6, -12.2, 2, 2, 1.8, C.blue);
  box(16, -13.6, 1.8, 1.8, 2.7, C.yellow);
  pad(13, -19, [8, 14, -1]);
  // Yatağın üstünde peluş ayı (siper)
  box(26, -21, 2.2, 1.8, 2.0, C.orange, { y: BTOP + 0.35 });
  box(26, -21, 1.6, 1.4, 1.4, C.orange, { y: BTOP + 2.35 });
  for (const dx of [-0.6, 0.6]) box(26 + dx, -21, 0.5, 0.4, 0.5, C.orange, { y: BTOP + 3.75, solid: false });

  // ---------------- Oyuncak kale (güneybatı) ----------------
  const K = { x0: -27, x1: -13.5, z0: 10, z1: 27 };
  const KH = 3.2;
  const kcol = (i) => [C.red, C.blue, C.yellow, C.green][i % 4];
  // Duvarlar: doğuda kapı, kuzeyde sürünme deliği
  const kwall = (axis, at, a, b, gaps) => {
    const cuts = [a, ...gaps.flatMap((g) => [g[0], g[1]]), b];
    for (let i = 0; i < cuts.length - 1; i++) {
      const [p, q] = [cuts[i], cuts[i + 1]];
      const g = gaps.find((gg) => gg[0] === p);
      if (g) {
        // boşluk: üstünde lento (kapı 2.4, sürünme deliği 1.25)
        if (axis === 'z') rect(p, q, at - 0.4, at + 0.4, g[2], KH - g[2], kcol(i));
        else rect(at - 0.4, at + 0.4, p, q, g[2], KH - g[2], kcol(i));
        continue;
      }
      if (axis === 'z') rect(p, q, at - 0.4, at + 0.4, 0, KH, kcol(i));
      else rect(at - 0.4, at + 0.4, p, q, 0, KH, kcol(i));
    }
  };
  kwall('z', K.z0, K.x0, K.x1, [[-21, -19.6, 1.25]]);
  kwall('z', K.z1, K.x0, K.x1, []);
  kwall('x', K.x0, K.z0, K.z1, []);
  kwall('x', K.x1, K.z0, K.z1, [[17.3, 19.7, 2.4]]);
  // Mazgallar (görünüm) ve köşe kuleleri
  for (let x = K.x0 + 0.6; x < K.x1; x += 1.6) {
    box(x, K.z0, 0.7, 0.8, 0.6, C.yellow, { y: KH, solid: false });
    box(x, K.z1, 0.7, 0.8, 0.6, C.yellow, { y: KH, solid: false });
  }
  for (const [x, z] of [[K.x0, K.z0], [K.x1, K.z0], [K.x0, K.z1], [K.x1, K.z1]]) {
    box(x, z, 2.6, 2.6, 4.6, C.blue);
    box(x, z, 2.8, 2.8, 0.6, C.red, { y: 4.6, solid: false });
  }
  // İç kule: iki yandan merdivenle çıkılan, mazgallı seyir yeri
  box(-19.5, 18.5, 4, 4, 2.4, C.yellow);
  stairs(-19.5, 14, 'z', 1, 2, 2.5, 2.4, C.red);
  stairs(-19.5, 23, 'z', -1, 2, 2.5, 2.4, C.blue);
  for (const [dx, dz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) box(-19.5 + dx, 18.5 + dz, 0.6, 0.6, 0.7, C.green, { y: 2.4 });
  box(-19.5, 18.5, 0.15, 0.15, 3, C.dark, { y: 2.4, solid: false }); // bayrak direği
  box(-18.8, 18.5, 1.2, 0.08, 0.8, C.red, { y: 4.4, solid: false });
  // Bahçede oyuncak askerler (küçük siperler)
  for (const [x, z] of [[-24, 13], [-15, 24.5], [-24.5, 24]]) {
    box(x, z, 0.8, 0.8, 1.2, C.green);
    box(x, z, 0.6, 0.6, 0.5, C.pillow, { y: 1.2, solid: false });
  }

  // ---------------- Kanepe (doğu duvarı) ----------------
  // Ayaklar 1.3 m: altına çömelerek girilir. Oturağa trambolinle.
  const S = { x0: 23, x1: 29.6, z0: 2, z1: 20 };
  for (const z of [S.z0 + 0.4, S.z1 - 0.4]) for (const x of [S.x0 + 0.4, S.x1 - 0.4]) rect(x - 0.4, x + 0.4, z - 0.4, z + 0.4, 0, LEG, C.leg);
  rect(S.x0, S.x1, S.z0, S.z1, LEG, 1.3, C.sofa);
  for (const z of [5, 11, 17]) rect(S.x0 + 0.2, S.x1 - 2.2, z - 2.8, z + 2.8, LEG + 1.3, 0.4, C.sofa2); // minderler
  rect(S.x1 - 2, S.x1, S.z0, S.z1, LEG + 1.3, 3.2, C.sofa); // sırtlık
  rect(S.x0, S.x1, S.z0 - 1.4, S.z0, 0, 4, C.sofa); // kolçaklar
  rect(S.x0, S.x1, S.z1, S.z1 + 1.4, 0, 4, C.sofa);
  pad(19, 11, [8, 14, 0]);
  box(24.5, 8, 2.2, 2.2, 1.4, C.pillow, { y: LEG + 1.7 }); // yastık
  // Abajur
  box(27, 24, 1.6, 1.6, 0.3, C.dark);
  box(27, 24, 0.3, 0.3, 9, C.dark, { y: 0.3 });
  box(27, 24, 3, 3, 2.4, C.lamp, { y: 9.3, solid: false });

  // ---------------- Karton kutu kalesi (güneydoğu) ----------------
  hut(9, 21.5, 9, 7, 3.4, C.cardboard, {
    doors: [{ side: 's', at: -1.5 }, { side: 'w', at: 0 }, { side: 'n', at: 2 }],
    windows: [{ side: 'e', at: 0, w: 1.6 }, { side: 's', at: 2, w: 1.2 }],
    roof: C.cardboard2,
  });
  box(9, 21.5, 9.6, 0.4, 0.8, C.cardboard2, { y: 3.4, solid: false }); // açık kapak
  box(15.5, 26, 2.4, 2.4, 2.4, C.cardboard);
  box(15.5, 26, 2.5, 0.3, 0.02, '#c4a04a', { y: 2.4, solid: false }); // bant
  box(2.8, 26.5, 1.8, 1.8, 1.8, C.cardboard2);

  // ---------------- Oyuncak tren (masanın çevresinde ray) ----------------
  const TX = 14.5;
  const TZ = 10.5;
  for (const s of [-1, 1]) {
    box(s * TX, 0, 0.12, TZ * 2, 0.06, C.rail, { solid: false });
    box(s * (TX - 0.9), 0, 0.12, TZ * 2, 0.06, C.rail, { solid: false });
    box(0, s * TZ, TX * 2, 0.12, 0.06, C.rail, { solid: false });
    box(0, s * (TZ - 0.9), TX * 2, 0.12, 0.06, C.rail, { solid: false });
  }
  for (let z = -9; z <= 9; z += 1.5) box(-TX + 0.45, z, 1.5, 0.3, 0.03, C.sleeper, { solid: false });
  // Lokomotif ve vagonlar (siper)
  const lx = -TX + 0.45;
  box(lx, -4, 1.5, 3.4, 1.4, C.red, { y: 0.2 });
  box(lx, -2.9, 1.5, 1.4, 1.2, C.blue, { y: 1.6 });
  box(lx, -5.2, 0.5, 0.5, 1.0, C.dark, { y: 1.6 });
  box(lx, 0.2, 1.4, 3, 1.2, C.yellow, { y: 0.2 });
  box(lx, 3.8, 1.4, 3, 1.2, C.green, { y: 0.2 });
  for (const z of [-5, -3, -0.8, 1.2, 2.8, 4.8]) box(lx, z, 1.7, 0.5, 0.5, C.dark, { y: 0.05, solid: false });

  // ---------------- Dağınık oyuncaklar ----------------
  const block = (x, z, s, col, y = 0) => box(x, z, s, s, s, col, { y });
  block(-6, -18, 2.4, C.red);
  block(-3.4, -19.2, 2.4, C.blue);
  block(-4.8, -18.6, 2.2, C.yellow, 2.4);
  block(4, 16, 2, C.green);
  block(-2, 20, 1.6, C.purple);
  block(19, -4, 1.8, C.orange);
  block(-27, -12, 2.2, C.blue);
  // Toplar (küp)
  box(-18, -7, 2.8, 2.8, 2.8, C.red);
  box(-18, -7, 2.9, 0.4, 0.4, C.pillow, { y: 1.2, solid: false });
  box(-24, 3, 2, 2, 2, C.yellow);
  // Lastik ördek (yerde)
  box(-6, 24, 3, 2.2, 2, C.duck);
  box(-6.6, 24, 1.6, 1.6, 1.6, C.duck, { y: 2 });
  box(-7.7, 24, 0.7, 0.8, 0.3, C.beak, { y: 2.6, solid: false });
  // Oyuncak araba
  box(8, -21, 5, 2.6, 1.3, C.blue, { y: 0.5 });
  box(7.6, -21, 2.6, 2.2, 1, C.glass, { y: 1.8, glass: true });
  for (const dx of [-1.6, 1.6]) for (const dz of [-1.2, 1.2]) box(8 + dx, -21 + dz, 1.1, 0.5, 1, C.dark);
  // Yerde dev kitap ve kızma birader tahtası (görünüm)
  box(-20, -14, 6, 4, 1.0, C.book2);
  box(-20, -14, 5.6, 3.6, 0.1, C.pages, { y: 1.0, solid: false });
  box(-19.6, -14.3, 4, 3, 0.9, C.book3, { y: 1.0 });
  box(4, 7.5, 5, 5, 0.04, C.pillow, { solid: false });
  for (const [dx, dz, col] of [[-1.8, -1.8, C.red], [1.8, -1.8, C.blue], [-1.8, 1.8, C.yellow], [1.8, 1.8, C.green]]) box(4 + dx, 7.5 + dz, 1.2, 1.2, 0.05, col, { solid: false });

  // ---------------- Doğuş noktaları (her yere dağılmış) ----------------
  const ffa = [
    [0, -22, 0], [-20, 0, -Math.PI / 2], [20, -6, Math.PI / 2], [1, 20, Math.PI], [-21, -21, -Math.PI / 4],
    [21, 24, Math.PI], [-8, 26, Math.PI], [-27, -5, -Math.PI / 2], [6, -26, 0], [16, 8, Math.PI / 2],
    [-9, -10, 0], [3, -10, 0], [-24, 19, Math.PI / 2], [12, 14, Math.PI],
  ].map(([x, z, yaw]) => [x, 0.1, z, yaw]);
  return {
    id: 'giant',
    name: 'DEV ODA',
    ffaOnly: true,
    indoor: true,
    boxes,
    pads,
    spawns: { ffa, red: ffa.slice(0, 7), blue: ffa.slice(7) },
    flags: { red: [0, 0.1, -22], blue: [1, 0.1, 20] },
    bounds: { x: B - 0.6, z: B - 0.6, minY: -5, maxY: 28 },
    sky: '#efe6d2',
  };
}
