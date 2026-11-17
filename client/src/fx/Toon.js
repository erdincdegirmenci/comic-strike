import * as THREE from 'three';

// Çizgi roman görünümü: 3 tonlu toon gölgelendirme + kalın siyah kontur ("inverted hull").

export const INK = 0x141414;

export const gradientMap = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

const cache = new Map();

/** Renge göre paylaşılan toon materyal */
export function toon(color) {
  const key = String(color);
  if (!cache.has(key)) cache.set(key, new THREE.MeshToonMaterial({ color, gradientMap }));
  return cache.get(key);
}

export const outlineMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

const _size = new THREE.Vector3();

/**
 * Merkezli, dışbükey bir geometriye (kutu, küre, silindir) kontur ekler.
 * Konturu, arka yüzleri çizilen biraz büyütülmüş siyah bir kopya oluşturur.
 */
export function addOutline(mesh, thickness = 0.03, material = outlineMaterial) {
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  geo.boundingBox.getSize(_size);
  const o = new THREE.Mesh(geo, material);
  o.scale.set(
    1 + (2 * thickness) / Math.max(_size.x, 1e-3),
    1 + (2 * thickness) / Math.max(_size.y, 1e-3),
    1 + (2 * thickness) / Math.max(_size.z, 1e-3),
  );
  o.raycast = () => {}; // konturlar isabet testine girmesin
  mesh.add(o);
  return o;
}

/** Kısayol: toon materyalli + konturlu parça */
export function part(geometry, color, thickness = 0.03) {
  const m = new THREE.Mesh(geometry, toon(color));
  addOutline(m, thickness);
  return m;
}
