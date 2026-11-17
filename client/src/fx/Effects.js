import * as THREE from 'three';

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

let _star;
export function starTexture() {
  if (!_star) {
    _star = canvasTexture(128, 128, (g, s) => {
      starPath(g, s / 2, s / 2, 10, s * 0.46, s * 0.2);
      g.fillStyle = '#ffd23f';
      g.fill();
      g.lineWidth = 6;
      g.strokeStyle = '#141414';
      g.stroke();
      starPath(g, s / 2, s / 2, 10, s * 0.26, s * 0.12);
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
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
      g.fillStyle = '#f4f4f4';
      g.fill();
      g.lineWidth = 7;
      g.strokeStyle = '#141414';
      g.stroke();
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

const wordCache = new Map();
function wordTexture(text, color) {
  const key = text + color;
  if (!wordCache.has(key)) {
    wordCache.set(
      key,
      canvasTexture(512, 256, (g, w, h) => {
        // Yassı patlama balonu (y ekseninde yarıya sıkıştırılmış yıldız)
        g.setTransform(1, 0, 0, 0.5, 0, h / 4);
        starPath(g, w / 2, h / 2, 14, 250, 170, 0.25);
        g.fillStyle = '#fff3b0';
        g.fill();
        g.lineWidth = 10;
        g.strokeStyle = '#141414';
        g.stroke();
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
    this.tracerMat = new THREE.LineBasicMaterial({ color: '#fff3b0', transparent: true });
  }

  sprite(tex, pos, sx, sy, life, o = {}) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: o.depthTest ?? true,
      rotation: o.rot ?? Math.random() * Math.PI * 2,
    });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.scale.set(sx, sy, 1);
    s.renderOrder = o.order ?? 10;
    this.scene.add(s);
    this.items.push({ obj: s, life, max: life, sx, sy, grow: o.grow ?? 0, vel: o.vel ?? null, pop: o.pop ?? false });
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

  tracer(from, to) {
    const g = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const l = new THREE.Line(g, this.tracerMat.clone());
    l.renderOrder = 9;
    this.scene.add(l);
    this.items.push({ obj: l, life: 0.07, max: 0.07, line: true });
  }

  poof(pos) {
    for (let i = 0; i < 6; i++) {
      _p.set(pos.x + (Math.random() - 0.5) * 0.8, pos.y + 0.5 + Math.random() * 0.8, pos.z + (Math.random() - 0.5) * 0.8);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.8 + Math.random(), (Math.random() - 0.5) * 1.5);
      this.sprite(puffTexture(), _p, 0.6, 0.6, 0.7, { grow: 1.4, vel });
    }
  }

  word(pos, text, color = '#e63946') {
    this.sprite(wordTexture(text, color), pos, 2.4, 1.2, 0.9, {
      depthTest: false,
      rot: (Math.random() - 0.5) * 0.4,
      vel: new THREE.Vector3(0, 0.9, 0),
      order: 20,
      pop: true,
    });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      const k = 1 - Math.max(0, it.life) / it.max;
      if (it.line) {
        it.obj.material.opacity = Math.max(0, it.life / it.max);
      } else {
        let s = 1 + it.grow * k;
        if (it.pop) s = k < 0.15 ? 0.4 + (k / 0.15) * 0.75 : 1.15 - Math.min(0.15, (k - 0.15) * 0.5);
        it.obj.scale.set(it.sx * s, it.sy * s, 1);
        it.obj.material.opacity = it.pop ? (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1) : 1 - k * k;
        if (it.vel) it.obj.position.addScaledVector(it.vel, dt);
      }
      if (it.life <= 0) {
        this.scene.remove(it.obj);
        it.obj.material.dispose();
        if (it.line) it.obj.geometry.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const it of this.items) {
      this.scene.remove(it.obj);
      it.obj.material.dispose();
      if (it.line) it.obj.geometry.dispose();
    }
    this.items.length = 0;
    for (const d of this.decals) if (d) d.visible = false;
  }
}
