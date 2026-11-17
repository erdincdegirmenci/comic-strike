import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradientMap, INK, toon, addOutline } from '../fx/Toon.js';

/**
 * Harita verisinden (kutu listesi) görsel ve fizik dünyası oluşturur.
 * Performans için tüm kutular tek bir mesh'te birleştirilir:
 *  1) renkli toon mesh, 2) siyah kontur mesh'i, 3) ince kenar çizgileri → toplam 3 draw call.
 */
export function buildMap(map, scene, physics) {
  const colorGeos = [];
  const outlineGeos = [];
  const edgeGeos = [];
  const color = new THREE.Color();

  for (const b of map.boxes) {
    const w = b.max[0] - b.min[0];
    const h = b.max[1] - b.min[1];
    const d = b.max[2] - b.min[2];
    const cx = (b.min[0] + b.max[0]) / 2;
    const cy = (b.min[1] + b.max[1]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    const huge = w > 100 || d > 100;

    const g = new THREE.BoxGeometry(w, h, d);
    color.set(b.color);
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      cols[i * 3] = color.r;
      cols[i * 3 + 1] = color.g;
      cols[i * 3 + 2] = color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.deleteAttribute('uv');

    const minDim = Math.min(w, h, d);
    if (!huge && h > 0.05) {
      const t = minDim < 0.2 ? 0.025 : 0.06;
      const og = new THREE.BoxGeometry(w + t * 2, h + t * 2, d + t * 2);
      og.deleteAttribute('uv');
      og.deleteAttribute('normal');
      og.translate(cx, cy, cz);
      outlineGeos.push(og);
    }
    if (!huge && minDim > 0.15) {
      const eg = new THREE.EdgesGeometry(g);
      eg.translate(cx, cy, cz);
      edgeGeos.push(eg);
    }

    g.translate(cx, cy, cz);
    colorGeos.push(g);

    if (b.solid) physics.addBox(cx, cy, cz, w / 2, h / 2, d / 2);
  }

  const group = new THREE.Group();
  group.name = 'map';

  const mesh = new THREE.Mesh(mergeGeometries(colorGeos), new THREE.MeshToonMaterial({ vertexColors: true, gradientMap }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const outline = new THREE.Mesh(mergeGeometries(outlineGeos), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  group.add(outline);

  const edges = new THREE.LineSegments(mergeGeometries(edgeGeos), new THREE.LineBasicMaterial({ color: INK }));
  group.add(edges);

  for (const g of [...colorGeos, ...outlineGeos, ...edgeGeos]) g.dispose();

  if (map.water) addWater(group, map.water);
  addClouds(group);
  scene.add(group);
  return group;
}

/** Yarı saydam su yüzeyi + çizgi roman parıltıları */
function addWater(group, w) {
  const sx = w.max[0] - w.min[0];
  const sz = w.max[2] - w.min[2];
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(sx, sz),
    new THREE.MeshBasicMaterial({ color: w.color, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.set((w.min[0] + w.max[0]) / 2, w.max[1], (w.min[2] + w.max[2]) / 2);
  surface.renderOrder = 3;
  group.add(surface);
  const glint = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false });
  let seed = 5;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6 + rand() * 0.8, 0.08), glint);
    m.rotation.x = -Math.PI / 2;
    m.position.set(w.min[0] + 0.5 + rand() * (sx - 1), w.max[1] + 0.01, w.min[2] + 0.5 + rand() * (sz - 1));
    m.renderOrder = 4;
    group.add(m);
  }
}

/** Haritayı sahneden ve fizikten kaldırır */
export function disposeMap(group, scene, physics) {
  scene.remove(group);
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
  physics.clearMap();
}

/** Çizgi roman bulutları (birkaç küre + kontur) */
function addClouds(group) {
  const geo = new THREE.SphereGeometry(1, 14, 10);
  const mat = toon('#ffffff').clone();
  mat.fog = false;
  const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, fog: false });
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand() * 0.3;
    const r = 110 + rand() * 40;
    const cloud = new THREE.Group();
    cloud.position.set(Math.cos(a) * r, 45 + rand() * 25, Math.sin(a) * r);
    const puffs = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < puffs; j++) {
      const m = new THREE.Mesh(geo, mat);
      const s = 5 + rand() * 5;
      m.scale.set(s * 1.4, s, s);
      m.position.set((j - puffs / 2) * 7 + rand() * 3, rand() * 3, rand() * 4);
      addOutline(m, 0.08, outlineMat);
      cloud.add(m);
    }
    cloud.lookAt(0, cloud.position.y, 0);
    group.add(cloud);
  }
}
