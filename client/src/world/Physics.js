import RAPIER from '@dimforge/rapier3d-compat';

/** Rapier fizik dünyası. Harita statik kutulardan oluşur; dinamik nesne yok. */
export class Physics {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  }

  addBox(x, y, z, hx, hy, hz) {
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z));
  }

  step() {
    this.world.step();
  }

  /** Haritaya ışın atar. { distance, point, normal } veya null döner. */
  raycast(origin, dir, maxDist, excludeCollider) {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(ray, maxDist, true, undefined, undefined, excludeCollider);
    if (!hit) return null;
    const d = hit.timeOfImpact ?? hit.toi;
    return {
      distance: d,
      point: { x: origin.x + dir.x * d, y: origin.y + dir.y * d, z: origin.z + dir.z * d },
      normal: hit.normal,
    };
  }
}
