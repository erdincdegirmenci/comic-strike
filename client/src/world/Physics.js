import RAPIER from '@dimforge/rapier3d-compat';

/** Rapier fizik dünyası. Harita statik kutulardan oluşur; dinamik nesne yok. */
export class Physics {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.mapColliders = [];
  }

  addBox(x, y, z, hx, hy, hz) {
    this.mapColliders.push(this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z)));
  }

  /** Harita değişirken eski haritanın kutularını kaldır */
  clearMap() {
    for (const c of this.mapColliders) this.world.removeCollider(c, false);
    this.mapColliders.length = 0;
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
