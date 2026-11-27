import * as THREE from 'three';
import { SPRAY } from '@comic-strike/shared/constants.js';
import { sprayTexture } from './Sprays.js';

// Çizgi roman efektleri: yıldız patlamaları, mürekkep lekeleri, duman bulutları ve "KAPOW!" yazıları.
// Tüm dokular canvas ile çizilir, harici dosya yok.

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function starPath(g, cx, cy, spikes, outer, inner, jitter = 0) {
  g.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = (i % 2 ? inner : outer) * (1 + (Math.random() - 0.5) * jitter);
    const a = (i / (spikes * 2)) * Math.PI * 2;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}

/** El çizimi kontur: aynı şekli iki kez, biri kalın biri ince ve hafif kaymış çizer */
function sketchStroke(g, width, drawPath) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = '#141414';
  g.lineWidth = width;
  drawPath(0);
  g.stroke();
  g.lineWidth = Math.max(1.5, width * 0.45);
  g.save();
  g.translate((Math.random() - 0.5) * width * 0.6, (Math.random() - 0.5) * width * 0.6);
  drawPath(1);
  g.stroke();
  g.restore();
}

/** Titrek daire yolu (elle çizilmiş gibi, uçları üst üste biner) */
function wobblyCircle(g, cx, cy, r, wobble = 0.05, overlap = 0.12) {
  const n = 28;
  const ph = Math.random() * Math.PI * 2;
  g.beginPath();
  for (let i = 0; i <= n * (1 + overlap); i++) {
    const a = ph + (i / n) * Math.PI * 2;
    const rr = r * (1 + Math.sin(a * 3 + ph) * wobble * 0.5 + (Math.random() - 0.5) * wobble);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
}

let _star;
export function starTexture() {
  if (!_star) {
    _star = canvasTexture(128, 128, (g, s) => {
      starPath(g, s / 2, s / 2, 10, s * 0.46, s * 0.2, 0.25);
      g.fillStyle = '#ffd23f';
      g.fill();
      sketchStroke(g, 6, () => starPath(g, s / 2, s / 2, 10, s * 0.46, s * 0.2, 0.25));
      starPath(g, s / 2, s / 2, 10, s * 0.26, s * 0.12, 0.3);
      g.fillStyle = '#fffbe6';
      g.fill();
    });
  }
  return _star;
}

let _puff;
function puffTexture() {
  if (!_puff) {
    _puff = canvasTexture(128, 128, (g, s) => {
      wobblyCircle(g, s / 2, s / 2, s * 0.41, 0.06, 0);
      g.fillStyle = '#f4f4f4';
      g.fill();
      sketchStroke(g, 7, () => wobblyCircle(g, s / 2, s / 2, s * 0.41, 0.06));
      g.beginPath();
      g.arc(s * 0.58, s * 0.6, s * 0.22, 0.2, Math.PI * 0.9);
      g.lineWidth = 5;
      g.strokeStyle = '#bdbdbd';
      g.stroke();
    });
  }
  return _puff;
}

let _ink;
function inkTexture() {
  if (!_ink) {
    _ink = canvasTexture(128, 128, (g, s) => {
      let seed = 11;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      g.fillStyle = '#141414';
      for (let i = 0; i < 9; i++) {
        const a = rnd() * Math.PI * 2;
        const d = rnd() * s * 0.3;
        g.beginPath();
        g.arc(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, s * (0.06 + rnd() * 0.1), 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#d62828';
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.18, 0, Math.PI * 2);
      g.fill();
    });
  }
  return _ink;
}

let _decal;
function decalTexture() {
  if (!_decal) {
    _decal = canvasTexture(64, 64, (g, s) => {
      g.fillStyle = '#141414';
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.22, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#141414';
      g.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        g.beginPath();
        g.moveTo(s / 2, s / 2);
        g.lineTo(s / 2 + Math.cos(a) * s * 0.45, s / 2 + Math.sin(a) * s * 0.45);
        g.stroke();
      }
    });
  }
  return _decal;
}

let _smoke;
function smokeTexture() {
  if (!_smoke) {
    _smoke = canvasTexture(128, 128, (g, s) => {
      // Çizgi roman bulutu: birkaç iç içe daire, ince gri kontur
      const blobs = [[0.5, 0.52, 0.3], [0.32, 0.58, 0.2], [0.68, 0.58, 0.2], [0.42, 0.38, 0.2], [0.6, 0.4, 0.19]];
      g.fillStyle = '#7d7d7d';
      for (const [x, y, r] of blobs) {
        g.beginPath();
        g.arc(s * x, s * y, s * r + 3, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#d9d9d9';
      for (const [x, y, r] of blobs) {
        g.beginPath();
        g.arc(s * x, s * y, s * r, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#ececec';
      g.beginPath();
      g.arc(s * 0.44, s * 0.44, s * 0.12, 0, Math.PI * 2);
      g.fill();
      // Kurşun kalem gölge çizgileri
      g.strokeStyle = 'rgba(80, 80, 80, 0.45)';
      g.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        g.beginPath();
        g.moveTo(s * (0.3 + i * 0.05), s * 0.78);
        g.lineTo(s * (0.38 + i * 0.05), s * 0.62);
        g.stroke();
      }
    });
  }
  return _smoke;
}

let _fire;
function fireTexture() {
  if (!_fire) {
    _fire = canvasTexture(256, 256, (g, s) => {
      starPath(g, s / 2, s / 2, 12, s * 0.48, s * 0.26, 0.3);
      g.fillStyle = '#ff6d00';
      g.fill();
      sketchStroke(g, 8, () => starPath(g, s / 2, s / 2, 12, s * 0.48, s * 0.26, 0.3));
      starPath(g, s / 2, s / 2, 10, s * 0.32, s * 0.18, 0.3);
      g.fillStyle = '#ffd23f';
      g.fill();
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.12, 0, Math.PI * 2);
      g.fillStyle = '#fffbe6';
      g.fill();
    });
  }
  return _fire;
}

const wordCache = new Map();
const numCache = new Map();
/** Uçuşan hasar sayısı dokusu: kalın konturlu çizgi roman rakamı */
function numberTexture(text, color) {
  const key = text + color;
  if (!numCache.has(key)) {
    numCache.set(
      key,
      canvasTexture(256, 128, (g, w, h) => {
        g.font = '96px Bangers, Impact, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.lineWidth = 16;
        g.strokeStyle = '#141414';
        g.strokeText(text, w / 2, h / 2 + 4);
        g.fillStyle = color;
        g.fillText(text, w / 2, h / 2 + 4);
      }),
    );
  }
  return numCache.get(key);
}

function wordTexture(text, color) {
  const key = text + color;
  if (!wordCache.has(key)) {
    wordCache.set(
      key,
      canvasTexture(512, 256, (g, w, h) => {
        // Yassı patlama balonu (y ekseninde yarıya sıkıştırılmış yıldız)
        g.setTransform(1, 0, 0, 0.5, 0, h / 4);
        starPath(g, w / 2, h / 2, 14, 240, 165, 0.25);
        g.fillStyle = '#fff3b0';
        g.fill();
        sketchStroke(g, 10, () => starPath(g, w / 2, h / 2, 14, 240, 165, 0.25));
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.font = '110px Bangers, Impact, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.lineWidth = 16;
        g.strokeStyle = '#141414';
        g.strokeText(text, w / 2, h / 2 + 6);
        g.fillStyle = color;
        g.fillText(text, w / 2, h / 2 + 6);
      }),
    );
  }
  return wordCache.get(key);
}

const _p = new THREE.Vector3();

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.decals = [];
    this.decalIndex = 0;
    this.decalGeo = new THREE.PlaneGeometry(0.14, 0.14);
    this.decalMat = new THREE.MeshBasicMaterial({
      map: decalTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    // Havuzlar: efekt nesneleri ve materyalleri yeniden kullanılır. Eskiden her atışta yeni materyal
    // oluşturulup sonra dispose ediliyordu; son kullanıcı giden shader programı silinip bir sonraki
    // atışta yeniden derleniyordu (çatışma anında takılmalar).
    this.spritePool = [];
    this.tracerPool = [];
    this.scorchPool = [];
    this.scorchGeo = new THREE.CircleGeometry(1.4, 20);
    this.sprays = new Map(); // oyuncu id -> sticker mesh (her oyuncunun tek sticker'ı olur)
    this.sprayGeo = new THREE.PlaneGeometry(SPRAY.SIZE, SPRAY.SIZE);
    this.smokes = []; // {pos, radius, until}
    this.fires = []; // molotof alev halıları {pos, radius, until, acc}
  }

  /** Molotof: süre boyunca yerde yanan alev halısı */
  fire(pos, radius, seconds) {
    this.fires.push({ pos: new THREE.Vector3(pos.x, pos.y, pos.z), radius, until: performance.now() + seconds * 1000, acc: 0 });
    this.scorch(pos, seconds + 4, radius / 1.4);
    _p.set(pos.x, pos.y + 1.6, pos.z);
    this.word(_p, 'FWOOSH!', '#ff6d00');
  }

  /** Alev silahı / dondurucu püskürtmesi: from'dan dir yönünde reach metreye kadar parçacık demeti */
  stream(from, dir, reach, ice = false) {
    const life = 0.28;
    for (let i = 0; i < 5; i++) {
      const start = 0.15 + Math.random() * 0.5;
      _p.set(from.x + dir.x * start, from.y + dir.y * start, from.z + dir.z * start);
      // Parçacık ömrü boyunca duvarı / menzili geçmesin
      const speed = (Math.max(0.3, reach - start) / life) * (0.55 + Math.random() * 0.45);
      const j = speed * 0.17;
      const vel = new THREE.Vector3(dir.x * speed + (Math.random() - 0.5) * j, dir.y * speed + (Math.random() - 0.5) * j, dir.z * speed + (Math.random() - 0.5) * j);
      const size = 0.12 + Math.random() * 0.12;
      this.sprite(ice ? puffTexture() : fireTexture(), _p, size, size, life, { grow: 4.5, vel, color: ice ? '#9fe4ff' : 0xffffff, order: 9 });
    }
  }

  /** Flaş bombası patlaması: kısa, parlak yıldız */
  flashBurst(pos) {
    _p.set(pos.x, pos.y + 0.6, pos.z);
    this.sprite(starTexture(), _p, 4.5, 4.5, 0.35, { grow: 1.5, color: '#ffffff', order: 12 });
    _p.y += 1.4;
    this.word(_p, 'FLAŞ!', '#e2b65a');
  }

  /** Dondurma bombası: alana yayılan buz bulutu ve yerde buz izi */
  frostBurst(pos, radius) {
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * radius;
      _p.set(pos.x + Math.cos(a) * d, pos.y + 0.2 + Math.random() * 1.8, pos.z + Math.sin(a) * d);
      const vel = new THREE.Vector3(Math.cos(a) * 0.8, 0.2 + Math.random() * 0.4, Math.sin(a) * 0.8);
      const size = 0.8 + Math.random() * 0.9;
      this.sprite(i % 5 ? puffTexture() : starTexture(), _p, size, size, 0.7 + Math.random() * 0.8, { grow: 0.9, vel, color: '#a8e6ff', order: 9 });
    }
    _p.set(pos.x, pos.y + 1.8, pos.z);
    this.word(_p, 'BRRR!', '#3e8fc4');
  }

  /** Roket arkasındaki duman izi */
  trail(pos) {
    this.sprite(puffTexture(), pos, 0.35, 0.35, 0.6, { grow: 2, color: '#d8d0c4', order: 9 });
  }

  /** Yerde yanık izi (life sn, scale yarıçap çarpanı) */
  scorch(pos, life = 12, scale = 1) {
    let m = this.scorchPool.pop();
    if (!m) {
      m = new THREE.Mesh(this.scorchGeo, new THREE.MeshBasicMaterial({
        map: inkTexture(), color: '#333', transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
      }));
      m.rotation.x = -Math.PI / 2;
      this.scene.add(m);
    }
    m.visible = true;
    m.scale.setScalar(scale);
    m.rotation.z = Math.random() * Math.PI * 2;
    m.position.set(pos.x, pos.y + 0.02, pos.z);
    this.items.push({ obj: m, life, max: life, scorch: true, kind: 'scorch' });
  }

  /** Alev halılarından alev parçacıkları çıkar */
  updateFires(dt) {
    const now = performance.now();
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      const left = (f.until - now) / 1000;
      if (left <= 0) {
        this.fires.splice(i, 1);
        continue;
      }
      // Sona doğru alev seyrekleşir
      f.acc += dt * f.radius * f.radius * 3.2 * Math.min(1, left / 1.5);
      while (f.acc >= 1) {
        f.acc -= 1;
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * f.radius;
        _p.set(f.pos.x + Math.cos(a) * d, f.pos.y + 0.25, f.pos.z + Math.sin(a) * d);
        const size = 0.7 + Math.random() * 0.7;
        const vel = new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.2 + Math.random() * 1.2, (Math.random() - 0.5) * 0.4);
        this.sprite(Math.random() < 0.8 ? fireTexture() : puffTexture(), _p, size, size, 0.45 + Math.random() * 0.35, { grow: 0.6, vel, order: 9 });
      }
    }
  }

  /** Havuzdan bir sprite al (yoksa oluştur) */
  takeSprite() {
    let s = this.spritePool.pop();
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), transparent: true, depthWrite: false }));
      this.scene.add(s);
    }
    s.visible = true;
    return s;
  }

  sprite(tex, pos, sx, sy, life, o = {}) {
    const s = this.takeSprite();
    const mat = s.material;
    mat.map = tex;
    mat.depthTest = o.depthTest ?? true;
    mat.rotation = o.rot ?? Math.random() * Math.PI * 2;
    mat.opacity = 1;
    mat.color.set(o.color ?? 0xffffff);
    s.position.copy(pos);
    s.scale.set(sx, sy, 1);
    s.renderOrder = o.order ?? 10;
    const it = { obj: s, life, max: life, sx, sy, grow: o.grow ?? 0, vel: o.vel ?? null, pop: o.pop ?? false, kind: 'sprite' };
    this.items.push(it);
    return it;
  }

  /** Bitmiş efekti havuza geri koy */
  release(it) {
    it.obj.visible = false;
    if (it.kind === 'sprite') this.spritePool.push(it.obj);
    else if (it.kind === 'line') this.tracerPool.push(it.obj);
    else if (it.kind === 'scorch') this.scorchPool.push(it.obj);
  }

  impact(point, normal) {
    _p.set(point.x, point.y, point.z).addScaledVector(normal, 0.05);
    this.sprite(starTexture(), _p, 0.35, 0.35, 0.12, { grow: 1.5 });
    this.decal(point, normal);
  }

  decal(point, normal) {
    let m = this.decals[this.decalIndex];
    if (!m) {
      m = new THREE.Mesh(this.decalGeo, this.decalMat);
      this.decals[this.decalIndex] = m;
      this.scene.add(m);
    }
    this.decalIndex = (this.decalIndex + 1) % 64;
    m.position.set(point.x + normal.x * 0.01, point.y + normal.y * 0.01, point.z + normal.z * 0.01);
    _p.set(point.x + normal.x, point.y + normal.y, point.z + normal.z);
    m.lookAt(_p);
    m.rotateZ(Math.random() * Math.PI);
    m.visible = true;
  }

  splat(point) {
    _p.set(point[0] ?? point.x, point[1] ?? point.y, point[2] ?? point.z);
    this.sprite(inkTexture(), _p, 0.6, 0.6, 0.3, { grow: 1.2 });
  }

  muzzle(pos) {
    this.sprite(starTexture(), pos, 0.45, 0.45, 0.06);
  }

  /** Patlayıcı bomba */
  explosion(pos) {
    _p.set(pos.x, pos.y + 0.5, pos.z);
    this.sprite(fireTexture(), _p, 3.2, 3.2, 0.45, { grow: 1.6 });
    for (let i = 0; i < 10; i++) {
      _p.set(pos.x + (Math.random() - 0.5) * 2.5, pos.y + 0.3 + Math.random() * 2, pos.z + (Math.random() - 0.5) * 2.5);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 4, 1 + Math.random() * 2, (Math.random() - 0.5) * 4);
      this.sprite(i < 4 ? fireTexture() : puffTexture(), _p, 1.2, 1.2, 0.8 + Math.random() * 0.5, { grow: 1.8, vel });
    }
    _p.set(pos.x, pos.y + 2.4, pos.z);
    this.word(_p, 'KABOOM!', '#ff6d00');
    // Yerde yanık izi
    this.scorch(pos);
  }

  /** Sis bombası: süre boyunca görüşü kapatan bulut. poison=true ise yeşil zehir bulutu */
  smoke(pos, radius, seconds, poison = false) {
    const center = new THREE.Vector3(pos.x, pos.y, pos.z);
    this.smokes.push({ pos: center, radius, until: performance.now() + seconds * 1000, poison });
    const count = 34;
    for (let i = 0; i < count; i++) {
      // Yarım küre içinde rastgele noktalar
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * radius * 0.8;
      const h = 0.4 + Math.random() * radius * 0.65;
      _p.set(center.x + Math.cos(a) * d, center.y + h, center.z + Math.sin(a) * d);
      const size = 2.6 + Math.random() * 1.6;
      const life = seconds + Math.random() * 1.5;
      const it = this.sprite(smokeTexture(), _p, 0.1, 0.1, life, {
        order: 8,
        color: poison ? (Math.random() < 0.5 ? '#9bd94a' : '#b5e36b') : '#ffffff',
      });
      it.obj.material.opacity = 0;
      it.sx = size;
      it.sy = size;
      it.smoke = true;
      it.delay = (i / count) * 0.5;
    }
  }

  /** Kamera zehir bulutunun içinde mi? 0..1 */
  poisonDensity(pos) {
    return this.smokeDensity(pos, true);
  }

  /** Kamera sis bulutunun içinde mi? 0..1 yoğunluk (onlyPoison: sadece zehir bulutları) */
  smokeDensity(pos, onlyPoison = false) {
    const now = performance.now();
    let best = 0;
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      if (now > s.until) {
        this.smokes.splice(i, 1);
        continue;
      }
      if (onlyPoison && !s.poison) continue;
      const dx = pos.x - s.pos.x;
      const dz = pos.z - s.pos.z;
      const dy = Math.max(0, pos.y - s.pos.y - s.radius * 0.6);
      const d = Math.hypot(dx, dy, dz) / s.radius;
      const fade = Math.min(1, (s.until - now) / 2000);
      best = Math.max(best, Math.min(1, (1.05 - d) * 3) * fade);
    }
    return Math.max(0, best);
  }

  /** Karaktere özel duvar sticker'ı */
  spray(id, charId, point, normal, from = null) {
    let m = this.sprays.get(id);
    if (!m) {
      m = new THREE.Mesh(this.sprayGeo, new THREE.MeshBasicMaterial({
        transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, opacity: 0.92,
      }));
      m.renderOrder = 2;
      this.scene.add(m);
      this.sprays.set(id, m);
    }
    m.material.map = sprayTexture(charId);
    m.material.needsUpdate = true;
    m.position.set(point[0] + normal[0] * 0.02, point[1] + normal[1] * 0.02, point[2] + normal[2] * 0.02);
    // Yere/tavana sıkılırsa yukarı yönü değiştir (lookAt dejenere olmasın)
    if (Math.abs(normal[1]) > 0.9) {
      // Yazının üstü, sıkan oyuncudan uzağa baksın
      const dx = from ? point[0] - from.x : 0;
      const dz = from ? point[2] - from.z : -1;
      const len = Math.hypot(dx, dz) || 1;
      m.up.set(dx / len, 0, dz / len);
    } else m.up.set(0, 1, 0);
    _p.set(m.position.x + normal[0], m.position.y + normal[1], m.position.z + normal[2]);
    m.lookAt(_p);
    m.visible = true;
  }

  tracer(from, to) {
    let l = this.tracerPool.pop();
    if (!l) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#fff3b0', transparent: true }));
      l.frustumCulled = false; // iki noktalı çizgi; sınır küresini her seferinde hesaplamaya gerek yok
      l.renderOrder = 9;
      this.scene.add(l);
    }
    const a = l.geometry.attributes.position;
    a.setXYZ(0, from.x, from.y, from.z);
    a.setXYZ(1, to.x, to.y, to.z);
    a.needsUpdate = true;
    l.material.opacity = 1;
    l.visible = true;
    this.items.push({ obj: l, life: 0.07, max: 0.07, line: true, kind: 'line' });
  }

  poof(pos) {
    for (let i = 0; i < 6; i++) {
      _p.set(pos.x + (Math.random() - 0.5) * 0.8, pos.y + 0.5 + Math.random() * 0.8, pos.z + (Math.random() - 0.5) * 0.8);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.8 + Math.random(), (Math.random() - 0.5) * 1.5);
      this.sprite(puffTexture(), _p, 0.6, 0.6, 0.7, { grow: 1.4, vel });
    }
  }

  /** Vurulan rakibin üstünde yükselip kaybolan hasar sayısı. scale: kameraya uzaklığa göre büyütme */
  damageNumber(pos, dmg, head, kill, scale = 1) {
    const text = `-${dmg}${head ? '!' : ''}`;
    const color = kill ? '#c4493d' : head ? '#ffd23f' : '#ffffff';
    const k = (head || kill ? 1.35 : 1) * scale;
    _p.set(pos.x + (Math.random() - 0.5) * 0.5 * scale, pos.y, pos.z + (Math.random() - 0.5) * 0.5 * scale);
    this.sprite(numberTexture(text, color), _p, 0.9 * k, 0.45 * k, 0.85, {
      depthTest: false,
      rot: (Math.random() - 0.5) * 0.3,
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.4 * scale, 1.1 * scale, 0),
      order: 21,
      pop: true,
    });
  }

  word(pos, text, color = '#c4493d') {
    this.sprite(wordTexture(text, color), pos, 2.4, 1.2, 0.9, {
      depthTest: false,
      rot: (Math.random() - 0.5) * 0.4,
      vel: new THREE.Vector3(0, 0.9, 0),
      order: 20,
      pop: true,
    });
  }

  update(dt) {
    this.updateFires(dt);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      const k = 1 - Math.max(0, it.life) / it.max;
      if (it.line) {
        it.obj.material.opacity = Math.max(0, it.life / it.max);
      } else if (it.scorch) {
        it.obj.material.opacity = 0.6 * Math.min(1, it.life / 3);
      } else if (it.smoke) {
        const age = it.max - it.life - it.delay;
        const grow = Math.min(1, Math.max(0, age) / 0.8);
        const s = 0.3 + 0.7 * (1 - (1 - grow) * (1 - grow));
        it.obj.scale.set(it.sx * s, it.sy * s, 1);
        it.obj.material.opacity = age < 0 ? 0 : Math.max(0, Math.min(0.97, age / 0.5, it.life / 2.5));
        it.obj.position.y += dt * 0.03;
      } else {
        let s = 1 + it.grow * k;
        if (it.pop) s = k < 0.15 ? 0.4 + (k / 0.15) * 0.75 : 1.15 - Math.min(0.15, (k - 0.15) * 0.5);
        it.obj.scale.set(it.sx * s, it.sy * s, 1);
        it.obj.material.opacity = it.pop ? (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1) : 1 - k * k;
        if (it.vel) it.obj.position.addScaledVector(it.vel, dt);
      }
      if (it.life <= 0) {
        this.release(it);
        // Sıra önemli değil: sondakini buraya taşı (splice'tan ucuz)
        const last = this.items.pop();
        if (last !== it) this.items[i] = last;
      }
    }
  }

  /**
   * Maç başında efektlerin shader'larını önceden derle: ilk atışta / ilk patlamada
   * derleme yüzünden oluşan takılmayı önler. Havuzlar da önceden doldurulur.
   */
  warmup(renderer, camera) {
    const temp = [];
    for (let i = 0; i < 24; i++) temp.push({ obj: this.takeSprite(), kind: 'sprite' });
    _p.set(0, -100, 0);
    this.tracer(_p, _p);
    this.explosion(_p);
    this.decal(_p, { x: 0, y: 1, z: 0 });
    for (const o of this.items) o.obj.visible = true;
    renderer.compile(this.scene, camera);
    // Dokuları da GPU'ya şimdi yükle (ilk patlamada büyük doku yüklemesi takılma yapmasın)
    const texs = new Set([smokeTexture(), puffTexture(), inkTexture(), starTexture(), fireTexture(), decalTexture()]);
    for (const it of this.items) if (it.obj.material.map) texs.add(it.obj.material.map);
    for (const w of ['HEADSHOT!', 'SHANKED!', 'KAPOW!']) texs.add(wordTexture(w, '#c4493d'));
    for (const t of texs) renderer.initTexture(t);
    for (const it of temp) this.release(it);
    for (const it of this.items) this.release(it);
    this.items.length = 0;
    for (const d of this.decals) if (d) d.visible = false;
  }

  clear() {
    for (const it of this.items) this.release(it);
    this.items.length = 0;
    this.smokes.length = 0;
    this.fires.length = 0;
    for (const m of this.sprays.values()) {
      this.scene.remove(m);
      m.material.dispose();
    }
    this.sprays.clear();
    for (const d of this.decals) if (d) d.visible = false;
  }
}
