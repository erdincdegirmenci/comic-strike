import * as THREE from 'three';
import { trainParts, trainSolids, trainX, TRAIN_WHEELS } from '@comic-strike/shared/train.js';
import { part, toon } from '../fx/Toon.js';

/**
 * Hareketli oyuncak tren: görünüm + çarpışma kutuları. Konum shared/train.js'ten (sunucu saatiyle) hesaplanır.
 * Dönen { group, update(t) } nesnesi her karede güncellenir.
 */
export function createTrain(train, physics) {
  const group = new THREE.Group();
  group.name = 'train';
  const colliders = [];
  const start = trainSolids(train, 0);
  trainParts().forEach(([u0, u1, v0, v1, y0, y1, color], i) => {
    const mesh = part(new THREE.BoxGeometry(u1 - u0, y1 - y0, v1 - v0), color, 0.025);
    mesh.position.set((u0 + u1) / 2, (y0 + y1) / 2, (v0 + v1) / 2);
    group.add(mesh);
    const b = start[i];
    colliders.push(physics.addBox((b.min[0] + b.max[0]) / 2, (y0 + y1) / 2, (b.min[2] + b.max[2]) / 2, (u1 - u0) / 2, (y1 - y0) / 2, (v1 - v0) / 2));
  });
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.18, 14);
  wheelGeo.rotateX(Math.PI / 2);
  const wheels = TRAIN_WHEELS.map(([u, v]) => {
    const wheel = part(wheelGeo, '#3a3530', 0.025);
    wheel.position.set(u, 0.38, v);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.2), toon('#d1b25a'));
    wheel.add(spoke);
    group.add(wheel);
    return wheel;
  });
  group.position.z = train.z;

  const update = (t) => {
    const x = trainX(train, t);
    if (x === group.position.x) return;
    group.position.x = x;
    for (const w of wheels) w.rotation.z = -x / 0.38;
    trainParts().forEach(([u0, u1, v0, v1, y0, y1], i) => {
      colliders[i].setTranslation({ x: x + (u0 + u1) / 2, y: (y0 + y1) / 2, z: train.z + (v0 + v1) / 2 });
    });
  };
  update(Date.now());
  return { group, update };
}
