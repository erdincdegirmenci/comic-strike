import * as THREE from 'three';
import { MSG } from '@comic-strike/shared/protocol.js';
import { PLAYER, WEAPON, CLIENT_SEND_RATE, INTERP_DELAY, TEAM_INFO } from '@comic-strike/shared/constants.js';
import { LocalPlayer } from './player/LocalPlayer.js';
import { RemotePlayer } from './player/RemotePlayer.js';
import { Weapon } from './player/Weapon.js';
import { Effects } from './fx/Effects.js';

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const KILL_WORDS = ['KAPOW!', 'BLAM!', 'WHAM!', 'ZAP!', 'BOOM!', 'POW!'];

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
      this.weapon.ammo = d.ammo;
      this.weapon.reloading = false;
    });
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

    for (const [id, x, y, z, yaw, pitch, hp, alive, flags, rtt, k, d] of s.p) {
      this.stats.set(id, { k, d, rtt });
      if (id === this.myId) {
        this.hp = hp;
        this.myPing = rtt;
        continue;
      }
      this.remotes.get(id)?.push(s.t, x, y, z, yaw, pitch, alive === 1, flags);
    }
  }

  onRespawn(d) {
    if (d.id === this.myId) {
      this.local.teleport(d.p, d.yaw);
      this.life = d.life;
      this.alive = true;
      this.hp = PLAYER.MAX_HP;
      this.deathT = 0;
      this.weapon.reset(d.ammo);
      this.weapon.visible = true;
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
    _end.set(d.e[0], d.e[1], d.e[2]);
    this.effects.tracer(_from, _end);
    this.effects.muzzle(_from);
    const dist = _from.distanceTo(this.camera.position);
    this.sfx.shot(Math.max(0, 1 - dist / 90) * 0.8, dist > 25);
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
    this.hud.killfeed(killer, victim, d.h);

    const r = this.remotes.get(d.v);
    if (r) {
      r.die();
      this.effects.poof(r.root.position);
      _tmp.copy(r.root.position).y += 2;
      this.effects.word(_tmp, d.h ? 'HEADSHOT!' : KILL_WORDS[Math.floor(Math.random() * KILL_WORDS.length)]);
    }
    if (d.v === this.myId) {
      this.alive = false;
      this.weapon.visible = false;
      this.killedBy = killer.name;
      this.respawnAt = performance.now() + PLAYER.RESPAWN_TIME;
    }
    if (d.k === this.myId) {
      this.hud.pop(d.h ? 'HEADSHOT!' : KILL_WORDS[Math.floor(Math.random() * KILL_WORDS.length)]);
      this.sfx.kill();
    }
  }

  onMatchEnd(d) {
    this.state = 'ended';
    this.weapon.visible = false;
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
    this.effects.clear();
    this.weapon.visible = false;
    this.hud.hide();
    this.local.teleport([0, 50, 0]);
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
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
  }

  // ---------------- Atış ----------------

  spread() {
    const l = this.local;
    if (!l.grounded) return WEAPON.SPREAD_AIR;
    if (l.running) return WEAPON.SPREAD_RUN;
    if (l.moving) return WEAPON.SPREAD_MOVE;
    return WEAPON.SPREAD_BASE;
  }

  fire(now) {
    this.weapon.fire(now);
    this.sfx.shot(1);

    const l = this.local;
    l.eye(_eye);
    _euler.set(l.pitch, l.yaw, 0);
    _mat.makeRotationFromEuler(_euler);
    _right.setFromMatrixColumn(_mat, 0);
    _up.setFromMatrixColumn(_mat, 1);
    _fwd.setFromMatrixColumn(_mat, 2).negate();

    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * this.spread();
    _dir.copy(_fwd).addScaledVector(_right, Math.cos(a) * r).addScaledVector(_up, Math.sin(a) * r).normalize();

    // Yerel görsel: duvar isabeti (oyuncu isabetini sunucu söyler)
    const hit = this.physics.raycast(_eye, _dir, WEAPON.RANGE, this.local.collider);
    let dist = hit ? hit.distance : WEAPON.RANGE;
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
    l.pitch += WEAPON.RECOIL * (0.6 + Math.random() * 0.4);
    l.yaw += (Math.random() - 0.5) * WEAPON.RECOIL * 0.6;
    l.clampPitch();
  }

  reload(now) {
    if (this.weapon.startReload(now)) {
      this.net.emit(MSG.RELOAD);
      this.sfx.reload();
    }
  }

  // ---------------- Kare güncellemesi ----------------

  update(dt) {
    const now = performance.now();
    const input = this.input;
    const playing = this.state === 'playing';
    const controls = input.locked && this.alive && playing;

    const look = input.locked ? input.consumeMouse() : (input.consumeMouse(), { dx: 0, dy: 0 });
    if (this.alive && this.state !== 'ended') {
      this.local.look(look.dx, look.dy, this.settings.sensitivity);
      this.local.update(dt, input, controls);
    }

    if (controls) {
      if (input.pressed('KeyR')) this.reload(now);
      if (input.mouseDown) {
        if (this.weapon.canFire(now)) this.fire(now);
        else if (input.mouseClicked && this.weapon.ammo === 0 && !this.weapon.reloading) {
          this.sfx.empty();
          this.reload(now);
        }
      }
      if (this.weapon.ammo === 0 && !this.weapon.reloading && now - this.weapon.lastShot > 300) this.reload(now);
    }
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

    this.updateCamera(dt);

    const renderT = Date.now() - (this.offset ?? 0) - INTERP_DELAY;
    for (const r of this.remotes.values()) r.update(renderT, dt);
    this.effects.update(dt);
    this.updateHud(now);
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
  }

  updateHud(now) {
    const hud = this.hud;
    hud.setHealth(this.alive ? this.hp : 0);
    hud.setAmmo(this.weapon.ammo, this.weapon.reloading);
    hud.setScores(this.scores.red, this.scores.blue, this.scoreLimit);
    hud.setPing(this.myPing);
    const elapsed = this.state === 'playing' ? now - this.timeStamp : 0;
    hud.setTime(this.timeLeft - elapsed);
    hud.setCrosshair(5 + this.spread() * 500);
    hud.setCrosshairVisible(this.alive && this.state !== 'ended');

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
