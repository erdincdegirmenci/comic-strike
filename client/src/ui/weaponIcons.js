import * as THREE from 'three';

const W = 192; // ikon dokusu (CSS'te ~3 kat küçük gösterilir: keskin kalsın)
const H = 64;

// Render hedefi doğrusal renk uzayında; ekrana sRGB olarak çevirmek için tablo
const SRGB = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB[i] = Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
}

/** Nesne ve tüm ataları görünür mü */
function shown(o, root) {
  for (let p = o; p && p !== root.parent; p = p.parent) if (!p.visible) return false;
  return true;
}

/**
 * Öldürme akışındaki silah resimleri: oyunun kendi 3B silah modelleri yandan, el ve kol olmadan,
 * bir kez çizilip PNG'ye çevrilir. { silahId: dataURL } döner. Açılışta bir kez çalışır (birkaç ms).
 * weapon: birinci şahıs Weapon (modelleri ve kol parçaları için), hide: gizlenecek materyaller (ten rengi)
 */
export function makeWeaponIcons(renderer, weapon, hide = []) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff6e4', '#9a8f7c', 2.6));
  const sun = new THREE.DirectionalLight('#ffffff', 1.2);
  sun.position.set(3, 4, 1);
  scene.add(sun);
  // Kamera +X'ten bakar: namlu (-Z) ekranın sağına düşer (öldüren → ölen yönünde)
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  cam.position.set(5, 0, 0);
  cam.lookAt(0, 0, 0);
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  const hidden = new Set([...hide, ...weapon.sleeves.map((s) => s.material)]);

  const prevTarget = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);

  const buf = new Uint8Array(W * H * 4);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const out = {};

  for (const [id, m] of Object.entries(weapon.models)) {
    const model = m.group.clone(true);
    model.visible = true;
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.traverse((o) => {
      if (o.isMesh && hidden.has(o.material)) o.visible = false;
      if (o.isSprite || o.isLight) o.visible = false;
      if (o.isGroup && o !== model) o.rotation.set(0, 0, 0); // dönen tabanca grubu düz
    });
    scene.add(model);
    model.updateMatrixWorld(true);
    box.makeEmpty();
    model.traverse((o) => {
      if (o.isMesh && o.visible && shown(o, model)) {
        o.geometry.computeBoundingBox();
        box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      }
    });
    box.getSize(size);
    box.getCenter(center);
    model.position.sub(center);
    // Ekranda yatay eksen Z (silah boyu), dikey eksen Y
    const aspect = W / H;
    const half = Math.max(size.z / 2, (size.y / 2) * aspect) * 1.12;
    cam.left = -half;
    cam.right = half;
    cam.top = half / aspect;
    cam.bottom = -half / aspect;
    cam.updateProjectionMatrix();

    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    // Y eksenini çevir + sRGB
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * W * 4;
      const dst = y * W * 4;
      for (let x = 0; x < W * 4; x += 4) {
        const a = buf[src + x + 3];
        img.data[dst + x] = SRGB[buf[src + x]];
        img.data[dst + x + 1] = SRGB[buf[src + x + 1]];
        img.data[dst + x + 2] = SRGB[buf[src + x + 2]];
        img.data[dst + x + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    out[id] = canvas.toDataURL('image/png');
    scene.remove(model);
  }

  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  rt.dispose();
  return out;
}
