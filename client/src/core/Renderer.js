import * as THREE from 'three';

const SKY = '#8ecae6';

/** WebGL renderer, sahne, kamera ve ışıklar. */
export class Renderer {
  constructor(canvas, settings) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.autoClear = false;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 80, 220);

    this.camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.05, 400);
    this.camera.rotation.order = 'YXZ';

    this.scene.add(new THREE.HemisphereLight('#fff4dc', '#56627e', 1.5));
    const sun = new THREE.DirectionalLight('#ffffff', 2.4);
    sun.position.set(30, 60, 18);
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 160 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.sun = sun;

    this.resizeListeners = [];
    this.applyQuality(settings.quality);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setSky(color) {
    this.scene.background.set(color);
    this.scene.fog.color.set(color);
  }

  get aspect() {
    return window.innerWidth / window.innerHeight;
  }

  applyQuality(quality) {
    const high = quality === 'high';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1));
    if (this.renderer.shadowMap.enabled !== high) {
      this.renderer.shadowMap.enabled = high;
      this.sun.castShadow = high;
      this.scene.traverse((o) => {
        if (o.material) o.material.needsUpdate = true;
      });
    }
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
  }
}
