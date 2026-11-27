import RAPIER from '@dimforge/rapier3d-compat';
import { PLAYER } from '@comic-strike/shared/constants.js';

// Çarpışma grupları: (üyelik << 16) | filtre. Harita her şeyle, diğer oyuncular yerel oyuncuyla çarpışır;
// ışın atışları (mermi izi, işaret, sticker) sadece haritaya bakar.
const G_MAP = 0x0001;
const G_PLAYER = 0x0002;
const PLAYER_GROUPS = ((G_PLAYER << 16) | 0xffff) >>> 0;
const MAP_ONLY_RAY = ((0xffff << 16) | G_MAP) >>> 0;
const HALF = PLAYER.HEIGHT / 2 - PLAYER.RADIUS;

/** Rapier fizik dünyası. Harita statik kutulardan oluşur; dinamik nesne yok. */
export class Physics {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.mapColliders = [];
  }

  addBox(x, y, z, hx, hy, hz) {
    const c = this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z));
    this.mapColliders.push(c);
    return c;
  }

  /** Harita değişirken eski haritanın kutularını kaldır */
  clearMap() {
    for (const c of this.mapColliders) this.world.removeCollider(c, false);
    this.mapColliders.length = 0;
  }

  step() {
    this.world.step();
  }

  /** Diğer bir oyuncunun gövdesi (kapsül): yerel oyuncu içinden geçemez */
  addPlayerBody() {
    const c = this.world.createCollider(RAPIER.ColliderDesc.capsule(HALF, PLAYER.RADIUS).setTranslation(0, -100, 0));
    c.setCollisionGroups(PLAYER_GROUPS);
    c.setEnabled(false);
    return c;
  }

  removeBody(c) {
    this.world.removeCollider(c, false);
  }

  /** Haritaya ışın atar. { distance, point, normal } veya null döner. */
  raycast(origin, dir, maxDist, excludeCollider) {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(ray, maxDist, true, undefined, MAP_ONLY_RAY, excludeCollider);
    if (!hit) return null;
    const d = hit.timeOfImpact ?? hit.toi;
    return {
      distance: d,
      point: { x: origin.x + dir.x * d, y: origin.y + dir.y * d, z: origin.z + dir.z * d },
      normal: hit.normal,
    };
  }
}
