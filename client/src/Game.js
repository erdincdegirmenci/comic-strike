import * as THREE from 'three';
import { MSG } from '@comic-strike/shared/protocol.js';
import {
  PLAYER, WEAPONS, WEAPON_ORDER, SPRAY, CLIENT_SEND_RATE, INTERP_DELAY, TEAM_INFO,
} from '@comic-strike/shared/constants.js';
import { CITY_ARENA } from '@comic-strike/shared/map.js';
import { stepGrenade } from '@comic-strike/shared/grenade.js';
import { LocalPlayer } from './player/LocalPlayer.js';
import { RemotePlayer } from './player/RemotePlayer.js';
import { Weapon } from './player/Weapon.js';
import { Effects } from './fx/Effects.js';
import { part } from './fx/Toon.js';

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const KILL_WORDS = ['KAPOW!', 'BLAM!', 'WHAM!', 'ZAP!', 'BOOM!', 'POW!'];
const SOLIDS = CITY_ARENA.boxes.filter((b) => b.solid);
const SLOT_KEYS = { Digit1: 'rifle', Digit2: 'awp', Digit3: 'knife', Digit4: 'he', Digit5: 'smoke' };
const NADE_GEO = {
  he: new THREE.SphereGeometry(0.1, 10, 8),
  smoke: new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10),
};

const _eye = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _end = new THREE.Vector3();
const _from = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _mat = new THREE.Matrix4();

/**
 * Bir maçın istemci tarafı: yerel oyuncu, diğer oyuncular, silah, efektler, HUD ve ağ olayları.
 * Harita ve renderer maçlar arasında korunur; Game sadece maç durumunu yönetir.
 */
export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // view, physics, input, sfx, hud, net, settings
    this.scene = this.view.scene;
    this.camera = this.view.camera;
    this.local = new LocalPlayer(this.physics);
    this.weapon = new Weapon(this.view.aspect);
    this.view.onResize((a) => this.weapon.setAspect(a));
    this.effects = new Effects(this.scene);
    this.remotes = new Map();
    this.grenades = new Map();
    this.raycaster = new THREE.Raycaster();
    this.active = false;
    this.reset();
    this.bindNet();
  }

  reset() {
    this.myId = null;
    this.team = 'red';
    this.roster = new Map();
    this.alive = false;
    this.life = 0;
    this.hp = PLAYER.MAX_HP;
    this.state = 'countdown';
    this.scores = { red: 0, blue: 0 };
    this.scoreLimit = 30;
    this.timeLeft = 0;
    this.timeStamp = performance.now();
    this.countdownEnd = 0;
    this.lastCount = -1;
    this.fightUntil = 0;
    this.offset = null;
    this.sendAcc = 0;
    this.deathT = 0;
    this.respawnAt = 0;
    this.killedBy = '';
    this.stats = new Map();
    this.myPing = 0;
    this.shake = 0;
    this.lastSpray = -Infinity;
    this.switchBackAt = 0;
    this.fov = null;
  }

  // ---------------- Ağ olayları ----------------

  bindNet() {
    const on = (event, fn) => this.net.on(event, (d) => this.active && fn.call(this, d));
    on(MSG.SNAPSHOT, this.onSnapshot);
    on(MSG.RESPAWN, this.onRespawn);
    on(MSG.CORRECTION, this.onCorrection);
    on(MSG.SHOT, this.onShot);
    on(MSG.HIT, this.onHit);
    on(MSG.DAMAGED, this.onDamaged);
    on(MSG.KILL, this.onKill);
    on(MSG.AMMO, (d) => {
      const w = d.w ?? 'rifle';
      this.weapon.ammo[w] = d.ammo;
      if (w === this.weapon.current) this.weapon.reloading = false;
    });
    on(MSG.GRENADE, this.onGrenade);
    on(MSG.BOOM, this.onBoom);
    on(MSG.SPRAYED, this.onSprayed);
    on(MSG.MATCH_END, this.onMatchEnd);
  }

  onSnapshot(s) {
    const sample = Date.now() - s.t;
    if (this.offset === null) this.offset = sample;
    else this.offset += (sample - this.offset) * (sample < this.offset ? 0.3 : 0.03);

    if (this.state === 'countdown' && s.st === 'playing') this.fightUntil = performance.now() + 900;
    if (this.state !== 'ended') this.state = s.st;
    if (s.st === 'countdown') this.countdownEnd = performance.now() + s.cd;
    this.scores = { red: s.s[0], blue: s.s[1] };
    this.timeLeft = s.tl;
    this.timeStamp = performance.now();

    for (const [id, x, y, z, yaw, pitch, hp, alive, flags, rtt, k, d, w] of s.p) {
      this.stats.set(id, { k, d, rtt });
      if (id === this.myId) {
        this.hp = hp;
        this.myPing = rtt;
        continue;
      }
      const r = this.remotes.get(id);
      if (!r) continue;
      r.push(s.t, x, y, z, yaw, pitch, alive === 1, flags);
      r.setWeapon(WEAPON_ORDER[w]);
    }
  }

  onRespawn(d) {
    if (d.id === this.myId) {
      this.local.teleport(d.p, d.yaw);
      this.life = d.life;
      this.alive = true;
      this.hp = PLAYER.MAX_HP;
      this.deathT = 0;
      this.weapon.reset(d.ammo, d.nades);
      this.weapon.visible = true;
      this.switchBackAt = 0;
      this.hud.respawn(null);
    } else {
      this.remotes.get(d.id)?.respawn(d.p, d.yaw);
    }
  }

  onCorrection(d) {
    if (d.l === this.life) this.local.teleport(d.p);
  }

  onShot(d) {
    const r = this.remotes.get(d.id);
    if (r && r.visible) r.muzzleWorld(_from);
    else _from.set(d.o[0], d.o[1] - 0.2, d.o[2]);
    const dist = _from.distanceTo(this.camera.position);
    if (d.w === 'knife') {
      this.sfx.knife(Math.max(0, 1 - dist / 15));
      return;
    }
    _end.set(d.e[0], d.e[1], d.e[2]);
    this.effects.tracer(_from, _end);
    this.effects.muzzle(_from);
    const vol = Math.max(0, 1 - dist / (d.w === 'awp' ? 140 : 90)) * 0.8;
    if (d.w === 'awp') this.sfx.awp(vol, dist > 25);
    else this.sfx.shot(vol, dist > 25);
  }

  onHit(d) {
    this.hud.hitmarker(d.k);
    this.sfx.hit();
    if (d.pt) this.effects.splat(d.pt);
  }

  onDamaged(d) {
    this.hp = d.hp;
    this.shake = 0.25;
    this.sfx.hurt();
    // Hasar yönü: saldırganın bize göre açısı
    const dx = d.from[0] - this.local.position.x;
    const dz = d.from[2] - this.local.position.z;
    const angle = Math.atan2(dx, -dz) + this.local.yaw;
    this.hud.damage(angle);
  }

  onKill(d) {
    this.scores = d.s;
    const killer = this.roster.get(d.k) ?? { name: '?', team: 'red' };
    const victim = this.roster.get(d.v) ?? { name: '?', team: 'blue' };
    this.hud.killfeed(killer, victim, d.h, d.w);

    const word = d.h ? 'HEADSHOT!' : d.w === 'knife' ? 'SHANKED!' : d.w === 'he' ? 'KABOOM!' : KILL_WORDS[Math.floor(Math.random() * KILL_WORDS.length)];
    const r = this.remotes.get(d.v);
    if (r) {
      r.die();
      this.effects.poof(r.root.position);
      _tmp.copy(r.root.position).y += 2;
      this.effects.word(_tmp, word);
    }
    if (d.v === this.myId) {
      this.alive = false;
      this.weapon.visible = false;
      this.weapon.scope = 0;
      this.killedBy = d.k === d.v ? '' : killer.name;
      this.respawnAt = performance.now() + PLAYER.RESPAWN_TIME;
    }
    if (d.k === this.myId && d.v !== this.myId) {
      this.hud.pop(word);
      this.sfx.kill();
    }
  }

  onGrenade(d) {
    const mesh = part(NADE_GEO[d.t], d.t === 'he' ? '#52b788' : '#adb5bd', 0.02);
    mesh.position.set(d.o[0], d.o[1], d.o[2]);
    this.scene.add(mesh);
    this.grenades.set(d.g, { mesh, sim: { p: [...d.o], v: [...d.v] }, born: performance.now(), steps: 0, t: d.t, lastVy: d.v[1] });
    if (d.id !== this.myId) {
      const dist = mesh.position.distanceTo(this.camera.position);
      if (dist < 20) this.sfx.throw();
    }
  }

  onBoom(d) {
    const g = this.grenades.get(d.g);
    if (g) {
      this.scene.remove(g.mesh);
      this.grenades.delete(d.g);
    }
    _tmp.set(d.p[0], d.p[1], d.p[2]);
    const dist = _tmp.distanceTo(this.camera.position);
    if (d.t === 'he') {
      this.effects.explosion(_tmp);
      this.sfx.explosion(Math.max(0.05, 1 - dist / 70));
      if (dist < 14) this.shake = Math.max(this.shake, 0.5 * (1 - dist / 14));
    } else {
      this.effects.smoke(_tmp, WEAPONS.smoke.RADIUS, WEAPONS.smoke.DURATION / 1000);
      this.sfx.smokePop(Math.max(0.05, 1 - dist / 50));
    }
  }

  onSprayed(d) {
    const from = d.id === this.myId ? this.local.position : this.remotes.get(d.id)?.root.position;
    this.effects.spray(d.id, d.c, d.p, d.n, from);
    if (d.id !== this.myId) {
      _tmp.set(d.p[0], d.p[1], d.p[2]);
      if (_tmp.distanceTo(this.camera.position) < 12) this.sfx.spray();
    }
  }

  onMatchEnd(d) {
    this.state = 'ended';
    this.weapon.visible = false;
    this.weapon.scope = 0;
    const names = new Map([...this.roster.values()].map((p) => [p.id, p.name]));
    this.hud.end(d, this.team, names);
    this.input.unlock();
  }

  // ---------------- Maç yaşam döngüsü ----------------

  start(info, myId) {
    this.reset();
    this.active = true;
    this.input.gameActive = true;
    this.myId = myId;
    this.syncRoster(info.roster);
    this.scores = info.scores;
    this.scoreLimit = info.scoreLimit;
    this.timeLeft = info.timeLeft;
    this.state = info.countdown > 0 ? 'countdown' : 'playing';
    this.countdownEnd = performance.now() + info.countdown;
    this.weapon.visible = false;
    this.applySettings();
    this.hud.show();
  }

  stop() {
    this.active = false;
    this.input.gameActive = false;
    for (const r of this.remotes.values()) r.dispose();
    this.remotes.clear();
    for (const g of this.grenades.values()) this.scene.remove(g.mesh);
    this.grenades.clear();
    this.effects.clear();
    this.weapon.visible = false;
    this.weapon.scope = 0;
    this.hud.hide();
    this.local.teleport([0, 50, 0]);
    this.applySettings();
  }

  syncRoster(players) {
    this.roster = new Map(players.map((p) => [p.id, p]));
    const me = this.roster.get(this.myId);
    if (me) this.team = me.team;
    this.weapon.setTeam(this.team);
    for (const p of players) {
      if (p.id === this.myId) continue;
      let r = this.remotes.get(p.id);
      if (!r) {
        r = new RemotePlayer(p, this.scene);
        this.remotes.set(p.id, r);
      } else r.setInfo(p);
      r.setFriendly(p.team === this.team);
    }
    for (const [id, r] of this.remotes) {
      if (!this.roster.has(id)) {
        r.dispose();
        this.remotes.delete(id);
      }
    }
  }

  applySettings() {
    this.fov = null; // updateCamera FOV'u yeniden uygular
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
  }

  // ---------------- Atış ----------------

  spread() {
    const l = this.local;
    const w = this.weapon.def;
    const scoped = this.weapon.scope > 0;
    let s;
    if (!l.grounded) s = w.SPREAD_AIR;
    else if (scoped) s = l.moving ? w.SPREAD_SCOPED_MOVE : w.SPREAD_SCOPED;
    else if (l.running) s = w.SPREAD_RUN;
    else if (l.moving) s = w.SPREAD_MOVE;
    else s = w.SPREAD_BASE;
    if (l.crouching && l.grounded) s *= 0.7;
    return s;
  }

  /** Bakış yönü eksenleri (_right, _up, _fwd) ve göz konumu (_eye) */
  aim() {
    const l = this.local;
    l.eye(_eye);
    _euler.set(l.pitch, l.yaw, 0);
    _mat.makeRotationFromEuler(_euler);
    _right.setFromMatrixColumn(_mat, 0);
    _up.setFromMatrixColumn(_mat, 1);
    _fwd.setFromMatrixColumn(_mat, 2).negate();
  }

  fire(now, heavy = false) {
    const w = this.weapon.def;
    this.weapon.fire(now, heavy);
    this.aim();

    if (w.kind === 'melee') {
      this.sfx.knife(1);
      _dir.copy(_fwd);
      const hit = this.physics.raycast(_eye, _dir, w.RANGE, this.local.collider);
      if (hit) {
        this.effects.impact(hit.point, hit.normal);
        this.sfx.stab();
      }
      this.net.emit(MSG.SHOOT, { d: [r3(_dir.x), r3(_dir.y), r3(_dir.z)], h: heavy ? 1 : 0 });
      return;
    }

    if (this.weapon.current === 'awp') this.sfx.awp(1);
    else this.sfx.shot(1);

    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * this.spread();
    _dir.copy(_fwd).addScaledVector(_right, Math.cos(a) * r).addScaledVector(_up, Math.sin(a) * r).normalize();

    // Yerel görsel: duvar isabeti (oyuncu isabetini sunucu söyler)
    const hit = this.physics.raycast(_eye, _dir, w.RANGE, this.local.collider);
    let dist = hit ? hit.distance : w.RANGE;
    this.raycaster.set(_eye, _dir);
    this.raycaster.far = dist;
    const targets = [];
    for (const rp of this.remotes.values()) if (rp.alive && rp.visible && rp.team !== this.team) targets.push(rp.body);
    const ph = targets.length ? this.raycaster.intersectObjects(targets, true)[0] : null;
    if (ph) dist = ph.distance;
    else if (hit) this.effects.impact(hit.point, hit.normal);

    _end.copy(_eye).addScaledVector(_dir, dist);
    _from.copy(_eye).addScaledVector(_right, 0.16).addScaledVector(_up, -0.14).addScaledVector(_fwd, 0.5);
    this.effects.tracer(_from, _end);

    this.net.emit(MSG.SHOOT, { d: [r3(_dir.x), r3(_dir.y), r3(_dir.z)] });

    // Geri tepme
    const l = this.local;
    l.pitch += w.RECOIL * (0.6 + Math.random() * 0.4);
    l.yaw += (Math.random() - 0.5) * w.RECOIL * 0.6;
    l.clampPitch();
  }

  throwGrenade(now) {
    const id = this.weapon.current;
    this.weapon.throwNade(now);
    this.sfx.throw();
    this.aim();
    this.net.emit(MSG.THROW, { d: [r3(_fwd.x), r3(_fwd.y), r3(_fwd.z)] });
    // Bu bombadan kalmadıysa elindeki önceki silaha dön
    if (this.weapon.nades[id] <= 0) this.switchBackAt = now + 450;
  }

  spray(now) {
    if (now - this.lastSpray < SPRAY.COOLDOWN) return;
    this.aim();
    const hit = this.physics.raycast(_eye, _fwd, SPRAY.RANGE, this.local.collider);
    if (!hit) return;
    this.lastSpray = now;
    this.sfx.spray();
    const n = hit.normal;
    this.net.emit(MSG.SPRAY, {
      p: [r3(hit.point.x), r3(hit.point.y), r3(hit.point.z)],
      n: [r3(n.x), r3(n.y), r3(n.z)],
    });
  }

  switchWeapon(id, now) {
    if (this.weapon.switchTo(id, now)) {
      this.net.emit(MSG.SWITCH, id);
      this.sfx.draw();
      this.switchBackAt = 0;
    }
  }

  reload(now) {
    if (this.weapon.startReload(now)) {
      this.net.emit(MSG.RELOAD);
      this.sfx.reload();
    }
  }

  handleWeaponInput(now) {
    const input = this.input;
    const wp = this.weapon;

    // Silah seçimi: 1-5, fare tekeri, Q (son silah)
    for (const [key, id] of Object.entries(SLOT_KEYS)) if (input.pressed(key)) this.switchWeapon(id, now);
    if (input.pressed('KeyQ')) this.switchWeapon(wp.has(wp.previous) ? wp.previous : 'knife', now);
    if (input.wheel) this.switchWeapon(wp.cycle(input.wheel > 0 ? 1 : -1), now);
    if (this.switchBackAt && now >= this.switchBackAt) {
      this.switchBackAt = 0;
      const back = wp.has(wp.previous) && WEAPONS[wp.previous].kind !== 'grenade' ? wp.previous : 'rifle';
      this.switchWeapon(back, now);
    }

    if (input.pressed('KeyT')) this.spray(now);

    const w = wp.def;
    if (input.pressed('KeyR')) this.reload(now);

    // Sağ tık: AWP'de dürbün, bıçakta ağır saldırı
    if (input.rightClicked && w.id === 'awp') {
      wp.toggleScope();
      this.sfx.scope();
    }
    if (w.kind === 'melee' && input.rightDown && !input.mouseDown && wp.canFire(now)) this.fire(now, true);

    if (w.kind === 'grenade') {
      if (input.mouseClicked && wp.canFire(now)) this.throwGrenade(now);
      return;
    }

    const trigger = w.AUTO ? input.mouseDown : input.mouseClicked;
    if (trigger) {
      if (wp.canFire(now)) this.fire(now);
      else if (input.mouseClicked && w.kind === 'gun' && wp.ammo[w.id] === 0 && !wp.reloading) {
        this.sfx.empty();
        this.reload(now);
      }
    }
    if (w.kind === 'gun' && wp.ammo[w.id] === 0 && !wp.reloading && now - wp.lastShot > 300) this.reload(now);
  }

  // ---------------- Kare güncellemesi ----------------

  update(dt) {
    const now = performance.now();
    const input = this.input;
    const playing = this.state === 'playing';
    const controls = input.locked && this.alive && playing;

    const look = input.locked ? input.consumeMouse() : (input.consumeMouse(), { dx: 0, dy: 0 });
    if (this.alive && this.state !== 'ended') {
      // Dürbünde hassasiyet yakınlaştırmaya göre düşer
      const zoom = this.camera.fov / this.settings.fov;
      this.local.look(look.dx, look.dy, this.settings.sensitivity * zoom);
      this.local.speedMult = this.weapon.def.SPEED_MULT;
      this.local.scoped = this.weapon.scope > 0;
      this.local.update(dt, input, controls);
    }

    if (controls) this.handleWeaponInput(now);
    this.weapon.update(dt, now, this.local, look);

    // Girdiyi sunucuya gönder (saniyede CLIENT_SEND_RATE)
    if (this.alive && this.state !== 'ended') {
      this.sendAcc += dt;
      if (this.sendAcc >= 1 / CLIENT_SEND_RATE) {
        this.sendAcc = 0;
        const p = this.local.position;
        this.net.emit(MSG.INPUT, {
          l: this.life,
          p: [r2(p.x), r2(p.y), r2(p.z)],
          y: r3(this.local.yaw),
          pi: r3(this.local.pitch),
          f: this.local.flags,
        });
      }
    }

    this.updateGrenades(now);
    this.updateCamera(dt);

    const renderT = Date.now() - (this.offset ?? 0) - INTERP_DELAY;
    for (const r of this.remotes.values()) r.update(renderT, dt);
    this.effects.update(dt);
    this.updateHud(now);
  }

  /** Sunucuyla aynı sabit adımlı fizikle bombaları ilerlet */
  updateGrenades(now) {
    for (const [gid, g] of this.grenades) {
      const target = Math.floor((now - g.born) / 1000 / (1 / 60));
      let n = 0;
      while (g.steps < target && n++ < 600) {
        stepGrenade(g.sim, SOLIDS);
        g.steps++;
        // Sekme sesi: dikey hız yön değiştirdiyse
        if (g.lastVy < -2 && g.sim.v[1] > 0) {
          _tmp.set(g.sim.p[0], g.sim.p[1], g.sim.p[2]);
          this.sfx.bounce(Math.max(0, 1 - _tmp.distanceTo(this.camera.position) / 25));
        }
        g.lastVy = g.sim.v[1];
      }
      g.mesh.position.set(g.sim.p[0], g.sim.p[1], g.sim.p[2]);
      g.mesh.rotation.x += Math.hypot(g.sim.v[0], g.sim.v[2]) * 0.05;
      // Sunucudan BOOM gelmezse (kopma vb.) temizle
      if (now - g.born > 6000) {
        this.scene.remove(g.mesh);
        this.grenades.delete(gid);
      }
    }
  }

  updateCamera(dt) {
    const l = this.local;
    const cam = this.camera;
    if (this.alive) {
      l.eye(cam.position);
      cam.rotation.set(l.pitch, l.yaw, 0);
    } else {
      // Ölüm kamerası: yere düş ve yana yatır
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 0.5);
      cam.position.set(l.position.x, l.position.y + PLAYER.EYE - k * 1.2, l.position.z);
      cam.rotation.set(l.pitch * (1 - k) + k * 0.3, l.yaw, k * 0.6);
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.06;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
    }

    // Dürbün yakınlaştırması
    const scope = this.alive ? this.weapon.scope : 0;
    const fov = scope > 0 ? WEAPONS.awp.ZOOM_FOV[scope - 1] : this.settings.fov;
    if (fov !== this.fov) {
      this.fov = fov;
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }

  updateHud(now) {
    const hud = this.hud;
    const wp = this.weapon;
    hud.setHealth(this.alive ? this.hp : 0);
    hud.setAmmo(wp.def, wp.count, wp.reloading);
    hud.setWeapons(wp.current, wp.nades, this.alive && this.state !== 'ended');
    hud.setScores(this.scores.red, this.scores.blue, this.scoreLimit);
    hud.setPing(this.myPing);
    const elapsed = this.state === 'playing' ? now - this.timeStamp : 0;
    hud.setTime(this.timeLeft - elapsed);
    const scoped = this.alive && wp.scope > 0;
    hud.setScope(scoped);
    hud.setSmoke(this.effects.smokeDensity(this.camera.position));
    hud.setCrosshair(wp.def.kind === 'gun' ? 5 + this.spread() * 500 : 3);
    // AWP'de dürbünsüz nişangah yok (CS gibi); dürbünün kendi çizgileri var
    hud.setCrosshairVisible(this.alive && this.state !== 'ended' && wp.current !== 'awp');

    if (this.state === 'countdown') {
      const n = Math.max(1, Math.ceil((this.countdownEnd - now) / 1000));
      if (n !== this.lastCount) {
        this.lastCount = n;
        this.sfx.countdown(false);
      }
      hud.center(String(n), 'count');
    } else if (now < this.fightUntil) {
      if (this.lastCount !== 0) {
        this.lastCount = 0;
        this.sfx.countdown(true);
      }
      hud.center('FIGHT!', 'fight');
    } else hud.center('');

    if (!this.alive && this.state === 'playing') {
      hud.respawn(Math.max(0, Math.ceil((this.respawnAt - now) / 1000)), this.killedBy);
    } else hud.respawn(null);

    const showBoard = this.input.down('Tab') && this.state !== 'ended';
    if (showBoard) {
      const rows = [...this.roster.values()].map((p) => {
        const s = this.stats.get(p.id) ?? { k: 0, d: 0, rtt: 0 };
        return { id: p.id, name: p.name, team: p.team, k: s.k, d: s.d, rtt: s.rtt };
      });
      hud.scoreboard(true, rows, this.myId, this.scores);
    } else hud.scoreboard(false);
  }

  get teamColor() {
    return TEAM_INFO[this.team].color;
  }
}
