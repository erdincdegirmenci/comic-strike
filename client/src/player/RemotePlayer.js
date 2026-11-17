import * as THREE from 'three';
import { TEAM_INFO } from '@comic-strike/shared/constants.js';
import { part, toon } from '../fx/Toon.js';

// Tüm oyuncuların paylaştığı geometriler
const G = {
  leg: new THREE.BoxGeometry(0.2, 0.62, 0.22),
  boot: new THREE.BoxGeometry(0.22, 0.16, 0.3),
  torso: new THREE.BoxGeometry(0.56, 0.54, 0.3),
  vest: new THREE.BoxGeometry(0.5, 0.36, 0.36),
  belt: new THREE.BoxGeometry(0.58, 0.08, 0.32),
  head: new THREE.SphereGeometry(0.2, 16, 12),
  helmet: new THREE.SphereGeometry(0.225, 16, 10),
  shades: new THREE.BoxGeometry(0.3, 0.07, 0.06),
  arm: new THREE.BoxGeometry(0.13, 0.13, 0.46),
  gun: new THREE.BoxGeometry(0.08, 0.11, 0.62),
  gunTop: new THREE.BoxGeometry(0.085, 0.06, 0.22),
  shadow: new THREE.CircleGeometry(0.42, 20),
};
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

function nameTexture(name, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.font = '40px Bangers, Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeStyle = '#141414';
  g.strokeText(name, 128, 34);
  g.fillStyle = color;
  g.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Diğer oyuncular: stilize karakter + ağdan gelen pozisyonların interpolasyonu. */
export class RemotePlayer {
  constructor(info, scene) {
    this.id = info.id;
    this.scene = scene;
    this.buffer = [];
    this.alive = null;
    this.lastEvent = 0;
    this.deadT = 0;
    this.walkPhase = 0;
    this.speed = 0;
    this.pitch = 0;
    this.prev = new THREE.Vector3();
    this.build();
    this.setInfo(info);
    scene.add(this.root);
  }

  build() {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.teamParts = [];
    this.darkParts = [];

    const legs = [];
    for (const sx of [-0.13, 0.13]) {
      const hip = new THREE.Group();
      hip.position.set(sx, 0.78, 0);
      const leg = part(G.leg, '#2b2d42', 0.025);
      leg.position.y = -0.31;
      const boot = part(G.boot, '#1d1d1d', 0.025);
      boot.position.set(0, -0.7, -0.03);
      hip.add(leg, boot);
      this.body.add(hip);
      legs.push(hip);
    }
    this.legs = legs;

    const torso = part(G.torso, '#888', 0.025);
    torso.position.y = 1.05;
    const vest = part(G.vest, '#444', 0.025);
    vest.position.set(0, 1.1, 0);
    const belt = part(G.belt, '#5a3a22', 0.02);
    belt.position.y = 0.8;
    this.body.add(torso, vest, belt);
    this.teamParts.push(torso);
    this.darkParts.push(vest);

    this.head = new THREE.Group();
    this.head.position.y = 1.5;
    const head = part(G.head, '#f1c27d', 0.025);
    const helmet = part(G.helmet, '#444', 0.025);
    helmet.position.y = 0.06;
    helmet.scale.y = 0.75;
    const shades = part(G.shades, '#141414', 0.015);
    shades.position.set(0, 0.01, -0.17);
    this.head.add(head, helmet, shades);
    this.body.add(this.head);
    this.darkParts.push(helmet);

    this.arms = new THREE.Group();
    this.arms.position.y = 1.25;
    const armR = part(G.arm, '#888', 0.02);
    armR.position.set(0.22, -0.08, -0.18);
    const armL = part(G.arm, '#888', 0.02);
    armL.position.set(-0.14, -0.1, -0.3);
    armL.rotation.y = 0.5;
    const gun = part(G.gun, '#2b2d42', 0.02);
    gun.position.set(0.08, -0.12, -0.5);
    const gunTop = part(G.gunTop, '#ff9f1c', 0.015);
    gunTop.position.set(0.08, -0.12, -0.66);
    this.gunTip = new THREE.Object3D();
    this.gunTip.position.set(0.08, -0.1, -0.84);
    this.arms.add(armR, armL, gun, gunTop, this.gunTip);
    this.body.add(this.arms);
    this.teamParts.push(armR, armL);

    this.body.traverse((o) => {
      if (o.isMesh && o.material !== undefined && o.material.isMeshToonMaterial) o.castShadow = true;
    });

    const shadow = new THREE.Mesh(G.shadow, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    this.root.add(shadow);
    this.shadow = shadow;

    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    this.tag.scale.set(1.3, 0.33, 1);
    this.tag.position.y = 2.1;
    this.tag.renderOrder = 15;
    this.root.add(this.tag);
  }

  setInfo(info) {
    this.name = info.name;
    if (this.team !== info.team || this.tagName !== info.name) {
      this.team = info.team;
      this.tagName = info.name;
      const t = TEAM_INFO[info.team];
      for (const p of this.teamParts) p.material = toon(t.color);
      for (const p of this.darkParts) p.material = toon(t.dark);
      this.tag.material.map?.dispose();
      this.tag.material.map = nameTexture(info.name, t.color);
      this.tag.material.needsUpdate = true;
    }
  }

  setFriendly(friendly) {
    this.tag.visible = friendly;
  }

  get visible() {
    return this.root.visible;
  }

  push(t, x, y, z, yaw, pitch, alive, flags) {
    if (this.alive === null) {
      this.alive = alive;
      this.root.visible = alive;
    } else if (this.alive !== alive && performance.now() - this.lastEvent > 1000) {
      // Olay kaçırıldıysa snapshot'a uy
      if (alive) this.respawn([x, y, z], yaw);
      else this.die();
    }
    const last = this.buffer[this.buffer.length - 1];
    if (last && t <= last.t) return;
    this.buffer.push({ t, x, y, z, yaw, pitch, flags });
    if (this.buffer.length > 40) this.buffer.shift();
  }

  die() {
    this.alive = false;
    this.deadT = 0;
    this.lastEvent = performance.now();
  }

  respawn(p, yaw) {
    this.alive = true;
    this.lastEvent = performance.now();
    this.buffer.length = 0;
    this.root.position.set(p[0], p[1], p[2]);
    this.prev.copy(this.root.position);
    this.root.rotation.y = yaw;
    this.body.rotation.set(0, 0, 0);
    this.root.visible = true;
  }

  update(renderT, dt) {
    if (this.alive === false) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.35);
      this.body.rotation.x = k * 1.45;
      this.shadow.visible = false;
      if (this.deadT > 2.5) this.root.visible = false;
      return;
    }
    this.shadow.visible = true;

    const buf = this.buffer;
    if (buf.length === 0) return;
    let a = buf[0];
    let b = buf[0];
    let k = 0;
    if (renderT >= buf[buf.length - 1].t) {
      a = b = buf[buf.length - 1];
    } else if (renderT > buf[0].t) {
      for (let i = 0; i < buf.length - 1; i++) {
        if (buf[i].t <= renderT && buf[i + 1].t >= renderT) {
          a = buf[i];
          b = buf[i + 1];
          k = (renderT - a.t) / (b.t - a.t || 1);
          break;
        }
      }
    }
    while (buf.length > 2 && buf[1].t < renderT - 250) buf.shift();

    this.root.position.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
    this.root.rotation.y = lerpAngle(a.yaw, b.yaw, k);
    this.pitch = a.pitch + (b.pitch - a.pitch) * k;

    // Animasyon
    const moved = Math.hypot(this.root.position.x - this.prev.x, this.root.position.z - this.prev.z);
    this.prev.copy(this.root.position);
    const speedNow = dt > 0 ? moved / dt : 0;
    this.speed += (speedNow - this.speed) * Math.min(1, dt * 10);
    const airborne = (b.flags & 4) !== 0;
    this.walkPhase += dt * this.speed * 2.4;
    const amp = airborne ? 0 : Math.min(1, this.speed / 4) * 0.7;
    this.legs[0].rotation.x = airborne ? -0.5 : Math.sin(this.walkPhase) * amp;
    this.legs[1].rotation.x = airborne ? 0.3 : -Math.sin(this.walkPhase) * amp;
    this.arms.rotation.x = this.pitch * 0.9;
    this.head.rotation.x = this.pitch * 0.5;
    this.body.rotation.x = 0;
  }

  muzzleWorld(target) {
    return this.gunTip.getWorldPosition(target);
  }

  dispose() {
    this.scene.remove(this.root);
    this.tag.material.map?.dispose();
    this.tag.material.dispose();
  }
}
