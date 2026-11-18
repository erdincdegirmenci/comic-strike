import * as THREE from 'three';
import { TEAMS, TEAM_INFO, FLAG_STATE, CTF } from '@comic-strike/shared/constants.js';
import { part, toon, INK } from './Toon.js';

const _q = new THREE.Vector3();

/**
 * Bayrak kapmaca (CTF) görselleri: her takımın üssünde zemin halkası, dalgalanan bayrak
 * ve bayrağın yerini her yerden belli eden ışık sütunu. Bayrak taşınırken taşıyıcının sırtında durur.
 */
export class Flags {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'flags';
    this.group.visible = false;
    scene.add(this.group);
    this.items = null;
    this.t = 0;
  }

  /** bases: { red:[x,y,z], blue:[x,y,z] } veya null (CTF değil) */
  setup(bases) {
    this.clear();
    if (!bases) return;
    this.items = {};
    for (const team of TEAMS) {
      const color = TEAM_INFO[team].color;
      const b = bases[team];
      // Üs: zemin halkası + kaide (dekor, fizik yok)
      const base = new THREE.Group();
      base.position.set(b[0], b[1] - 0.08, b[2]);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(CTF.CAPTURE_RADIUS - 0.18, CTF.CAPTURE_RADIUS, 40),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(CTF.CAPTURE_RADIUS - 0.18, 40),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.05;
      const pedestal = part(new THREE.CylinderGeometry(0.45, 0.55, 0.16, 16), '#e9ecef', 0.03);
      pedestal.position.y = 0.08;
      base.add(ring, disc, pedestal);
      this.group.add(base);

      // Bayrak: direk + dalgalanan kumaş + tepe topu
      const flag = new THREE.Group();
      const pole = part(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 8), '#5a3a22', 0.02);
      pole.position.y = 1.15;
      const knob = part(new THREE.SphereGeometry(0.08, 10, 8), '#ffd23f', 0.02);
      knob.position.y = 2.33;
      const clothGeo = new THREE.PlaneGeometry(1.05, 0.68, 10, 1);
      clothGeo.translate(0.525, 0, 0);
      const cloth = new THREE.Mesh(clothGeo, toon(color).clone());
      cloth.material.side = THREE.DoubleSide;
      cloth.position.set(0.04, 1.88, 0);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.05, 0.68).translate(0.525, 0, 0)), new THREE.LineBasicMaterial({ color: INK }));
      cloth.add(edge);
      flag.add(pole, knob, cloth);
      this.group.add(flag);

      // Işık sütunu: haritanın her yerinden bayrağın nerede olduğu görünür
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 40, 12, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
      );
      beam.position.y = 20;
      beam.renderOrder = 5;
      const beamHolder = new THREE.Group();
      beamHolder.add(beam);
      this.group.add(beamHolder);

      flag.position.set(b[0], b[1] - 0.05, b[2]);
      beamHolder.position.copy(flag.position);
      this.items[team] = { base, flag, cloth, clothGeo, beamHolder, state: FLAG_STATE.BASE, carrier: '', pos: [...b], basePos: b };
    }
    this.group.visible = true;
  }

  /** Snapshot: [[state, carrierId, x, y, z] (red), [...] (blue)] */
  setState(list) {
    if (!this.items) return;
    TEAMS.forEach((team, i) => {
      const f = this.items[team];
      const [state, carrier, x, y, z] = list[i];
      f.state = state;
      f.carrier = carrier;
      f.pos = [x, y, z];
    });
  }

  /** carrierRoot(id): taşıyıcının sahnedeki kök nesnesi (uzak oyuncu) ya da null; myId: yerel oyuncu */
  update(dt, carrierRoot, myId) {
    if (!this.items) return;
    this.t += dt;
    for (const team of TEAMS) {
      const f = this.items[team];
      const { flag, beamHolder } = f;
      flag.visible = true;
      beamHolder.visible = true;
      flag.rotation.set(0, 0, 0);
      flag.scale.setScalar(1);
      if (f.state === FLAG_STATE.CARRIED) {
        if (f.carrier === myId) {
          // Bayrak bende: birinci şahısta göstermiyoruz (HUD söyler)
          flag.visible = false;
          beamHolder.visible = false;
        } else {
          const root = carrierRoot(f.carrier);
          if (root && root.visible) {
            // Sırtında, hafif eğik
            _q.set(0.18, 0.55, 0.28).applyAxisAngle(THREE.Object3D.DEFAULT_UP, root.rotation.y);
            flag.position.copy(root.position).add(_q);
            flag.rotation.set(0.25, root.rotation.y + Math.PI / 2, 0);
            flag.scale.setScalar(0.75);
          } else flag.position.set(f.pos[0], f.pos[1] + 0.6, f.pos[2]);
        }
      } else if (f.state === FLAG_STATE.DROPPED) {
        flag.position.set(f.pos[0], f.pos[1] - 0.05, f.pos[2]);
        flag.rotation.z = 0.5; // yere düşmüş gibi eğik
      } else {
        flag.position.set(f.basePos[0], f.basePos[1] - 0.05, f.basePos[2]);
      }
      beamHolder.position.set(flag.position.x, f.state === FLAG_STATE.CARRIED ? flag.position.y + 1.5 : flag.position.y, flag.position.z);
      // Kumaş dalgalanması
      const pos = f.clothGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setZ(i, Math.sin(x * 5 - this.t * 7 + (team === 'red' ? 0 : 1.7)) * 0.07 * x);
      }
      pos.needsUpdate = true;
    }
  }

  clear() {
    if (!this.items) return;
    for (const f of Object.values(this.items)) {
      for (const o of [f.base, f.flag, f.beamHolder]) {
        this.group.remove(o);
        o.traverse((m) => {
          if (m.geometry) m.geometry.dispose();
        });
      }
    }
    this.items = null;
    this.group.visible = false;
  }
}
