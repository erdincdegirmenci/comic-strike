import * as THREE from 'three';
import { sketch } from '../fx/Toon.js';

const SKY = '#8ecae6';
const PARCHMENT = new THREE.Color('#ece2cb'); // gökyüzü / sis bu kâğıt rengine doğru soldurulur

/** Kâğıt dokusu: lif çizgileri + tanecikler (bir kez çizilir, ekranda tekrarlanır) */
function paperTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, S, S);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const img = g.getImageData(0, 0, S, S);
  // Sıcak, hafif sarımsı kâğıt; tanecikler çok ince
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 255 - rnd() * rnd() * 22;
    img.data[i] = v;
    img.data[i + 1] = v - 5;
    img.data[i + 2] = v - 16;
  }
  g.putImageData(img, 0, 0);
  // Kâğıt lifleri
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const a = rnd() * Math.PI;
    const l = 6 + rnd() * 18;
    g.strokeStyle = `rgba(140, 115, 80, ${0.04 + rnd() * 0.06})`;
    g.lineWidth = 0.6 + rnd();
    for (const ox of [0, -S, S]) {
      for (const oy of [0, -S, S]) {
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.quadraticCurveTo(x + ox + Math.cos(a) * l * 0.5 + 2, y + oy + Math.sin(a) * l * 0.5, x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
        g.stroke();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Ekranın üstüne çarpma (multiply) ile çizilen kâğıt dokusu + vinyet.
 * Eskiden CSS mix-blend-mode katmanıydı; tarayıcı bunu her karede ayrı bir yüzeyde
 * birleştiriyordu. Artık WebGL içinde tek bir üçgen çizimi.
 */
class PaperOverlay {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uPaper: { value: paperTexture() },
        uRes: { value: new THREE.Vector2(1, 1) },
        uPixelRatio: sketch.uPixelRatio,
        uBoil: sketch.uBoil,
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uPaper;
        uniform vec2 uRes;
        uniform float uPixelRatio;
        uniform float uBoil;
        varying vec2 vUv;
        void main() {
          // Kâğıt dokusu ekran pikseline sabit (kamera dönünce kaymaz)
          vec3 paper = texture2D(uPaper, gl_FragCoord.xy / uPixelRatio / 256.0).rgb;
          vec2 c = vUv - 0.5;
          c.x *= uRes.x / uRes.y;
          // Eski resim kenarları gibi hafif, sıcak vinyet
          float vig = 1.0 - smoothstep(0.5, 1.1, length(c)) * 0.22;
          gl_FragColor = vec4(paper * vig, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.SrcColorFactor,
    });
    // Tek büyük üçgen ekranı kaplar
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  setSize(w, h) {
    this.material.uniforms.uRes.value.set(w, h);
  }
}

/** WebGL renderer, sahne, kamera ve ışıklar. */
export class Renderer {
  constructor(canvas, settings) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.autoClear = false;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Gölgeyi sadece harita oluşturur ve harita hareket etmez: gölge haritası her karede değil,
    // yalnızca harita yüklenince / kalite değişince bir kez çizilir. (Oyuncuların altında yuvarlak gölge var.)
    this.renderer.shadowMap.autoUpdate = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 60, 200); // uzak yerler kâğıda karışır (hava perspektifi)

    this.camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.05, 400);
    this.camera.rotation.order = 'YXZ';

    // Yumuşak ışık: ortam ışığı güçlü, güneş zayıf → gölgeler açık ve sıcak (suluboya resim gibi)
    this.scene.add(new THREE.HemisphereLight('#fbf1dc', '#a39782', 2.5));
    const sun = new THREE.DirectionalLight('#fff1d8', 1.35);
    sun.position.set(30, 60, 18);
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 160 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.sun = sun;

    this.paper = new PaperOverlay();
    this.resizeListeners = [];
    this.applyQuality(settings.quality);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** Haritanın gökyüzü rengi, kâğıt rengine doğru soldurularak kullanılır */
  setSky(color) {
    this.scene.background.set(color).lerp(PARCHMENT, 0.6);
    this.scene.fog.color.copy(this.scene.background);
  }

  get aspect() {
    return window.innerWidth / window.innerHeight;
  }

  /** Harita değişince gölge haritasını bir kez yeniden çiz */
  refreshShadows() {
    this.renderer.shadowMap.needsUpdate = true;
  }

  applyQuality(quality) {
    const high = quality === 'high';
    // Yüksek DPI ekranlarda 2x çözünürlük piksel sayısını 4 katına çıkarıyordu; 1.5 ile sınırla
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 1.5 : 1));
    sketch.uPixelRatio.value = this.renderer.getPixelRatio();
    if (this.renderer.shadowMap.enabled !== high) {
      this.renderer.shadowMap.enabled = high;
      this.sun.castShadow = high;
      this.scene.traverse((o) => {
        if (o.material) o.material.needsUpdate = true;
      });
    }
    this.refreshShadows();
    this.resize();
  }

  onResize(fn) {
    this.resizeListeners.push(fn);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.paper.setSize(w, h);
    for (const fn of this.resizeListeners) fn(w / h);
  }

  render(overlay) {
    const r = this.renderer;
    r.clear();
    r.render(this.scene, this.camera);
    if (overlay?.visible) {
      r.clearDepth();
      r.render(overlay.scene, overlay.camera);
    }
    r.render(this.paper.scene, this.paper.camera);
  }
}
