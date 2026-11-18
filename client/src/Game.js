import * as THREE from "three";
import { MSG } from "@comic-strike/shared/protocol.js";
import {
  PLAYER,
  GRENADE,
  WEAPONS,
  WEAPON_ORDER,
  SPRAY,
  CLIENT_SEND_RATE,
  INTERP_DELAY,
  TEAM_INFO,
  ADS,
  FALL,
  FLAG_STATE,
  TEAMS,
  MARK,
} from "@comic-strike/shared/constants.js";
import { solidsOf } from "@comic-strike/shared/maps.js";
import { stepGrenade } from "@comic-strike/shared/grenade.js";
import { LocalPlayer } from "./player/LocalPlayer.js";
import { RemotePlayer } from "./player/RemotePlayer.js";
import { Weapon } from "./player/Weapon.js";
import { Effects } from "./fx/Effects.js";
import { part } from "./fx/Toon.js";
import { Trajectory } from "./fx/Trajectory.js";
import { Flags } from "./fx/Flags.js";
import { Drops } from "./fx/Drops.js";
import { Marks } from "./fx/Marks.js";

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const KILL_WORDS = ["KAPOW!", "BLAM!", "WHAM!", "ZAP!", "BOOM!", "POW!"];
const SLOT_KEYS = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 };
const NADE_GEO = {
  he: new THREE.SphereGeometry(0.1, 10, 8),
  smoke: new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10),
  poison: new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10),
};
const NADE_COLOR = { he: "#52b788", smoke: "#adb5bd", poison: "#7cb518" };

const _eye = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _end = new THREE.Vector3();
const _from = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, "YXZ");
const _mat = new THREE.Matrix4();

/**
 * Bir maçın istemci tarafı: yerel oyuncu, diğer oyuncular, silah, efektler, HUD ve ağ olayları.
 * Harita ve renderer maçlar arasında korunur; Game sadece maç durumunu yönetir.
 */
export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // view, physics, input, sfx, hud, net, settings, world
    this.scene = this.view.scene;
    this.camera = this.view.camera;
    this.local = new LocalPlayer(this.physics);
    this.weapon = new Weapon(this.view.aspect);
    this.view.onResize((a) => this.weapon.setAspect(a));
    this.effects = new Effects(this.scene);
    this.trajectory = new Trajectory(this.scene);
    this.flags = new Flags(this.scene);
    this.drops = new Drops(this.scene);
    this.marks = new Marks(this.scene);
    this.deathLook = new THREE.Vector3();
    this.remotes = new Map();
    this.grenades = new Map();
    this.raycaster = new THREE.Raycaster();
    this.active = false;
    this.reset();
    this.bindNet();
  }

  reset() {
    this.myId = null;
    this.team = "red";
    this.roster = new Map();
    this.alive = false;
    this.life = 0;
    this.hp = PLAYER.MAX_HP;
    this.state = "countdown";
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
    this.killedBy = "";
    this.stats = new Map();
    this.myPing = 0;
    this.shake = 0;
    this.lastSpray = -Infinity;
    this.switchBackAt = 0;
    this.chargeStart = 0; // bomba basılı tutuluyorsa başlangıç anı
    this.fov = null;
    this.protectedUntil = 0; // doğuş koruması bitiş anı (performance.now)
    this.mode = "tdm";
    this.flagState = null; // CTF: snapshot'taki bayrak durumu
    this.killerId = null; // ölüm kamerası: bizi öldüren
    this.killerHp = 0;
    this.lastMark = 0;
  }

  // ---------------- Ağ olayları ----------------

  bindNet() {
    const on = (event, fn) =>
      this.net.on(event, (d) => this.active && fn.call(this, d));
    on(MSG.SNAPSHOT, this.onSnapshot);
    on(MSG.RESPAWN, this.onRespawn);
    on(MSG.CORRECTION, this.onCorrection);
    on(MSG.SHOT, this.onShot);
    on(MSG.HIT, this.onHit);
    on(MSG.DAMAGED, this.onDamaged);
    on(MSG.KILL, this.onKill);
    on(MSG.LOADOUT, (d) => {
      // Silah seçimi hemen uygulandıysa yeni silahları eline al
      if (d.now && this.alive) {
        this.weapon.reset(d.ammo, d.nades, d.loadout, d.reserve);
        this.switchBackAt = 0;
        this.sfx.draw();
      }
      this.onLoadout?.(d);
    });
    on(MSG.AMMO, (d) => {
      const w = d.w ?? this.weapon.current;
      this.weapon.ammo[w] = d.ammo;
      if (d.res !== undefined) this.weapon.reserve[w] = d.res;
      if (w === this.weapon.current) this.weapon.reloading = false;
    });
    on(MSG.GRENADE, this.onGrenade);
    on(MSG.BOOM, this.onBoom);
    on(MSG.SPRAYED, this.onSprayed);
    on(MSG.MATCH_END, this.onMatchEnd);
    on(MSG.FLAG, this.onFlag);
    on(MSG.MARKED, this.onMarked);
    on(MSG.DROP, (d) => this.drops.add(d.id, d.p));
    on(MSG.PICKUP, this.onPickup);
    on(MSG.REWARD, this.onReward);
  }

  onSnapshot(s) {
    const sample = Date.now() - s.t;
    if (this.offset === null) this.offset = sample;
    else
      this.offset +=
        (sample - this.offset) * (sample < this.offset ? 0.3 : 0.03);

    if (this.state === "countdown" && s.st === "playing")
      this.fightUntil = performance.now() + 900;
    if (this.state !== "ended") this.state = s.st;
    if (s.st === "countdown") this.countdownEnd = performance.now() + s.cd;
    this.scores = { red: s.s[0], blue: s.s[1] };
    if (s.f) {
      this.flagState = s.f;
      this.flags.setState(s.f);
    }
    this.timeLeft = s.tl;
    this.timeStamp = performance.now();

    for (const [
      id,
      x,
      y,
      z,
      yaw,
      pitch,
      hp,
      alive,
      flags,
      rtt,
      k,
      d,
      w,
    ] of s.p) {
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
      this.weapon.reset(d.ammo, d.nades, d.loadout, d.reserve);
      this.local.resetStamina();
      this.weapon.visible = true;
      this.switchBackAt = 0;
      this.protectedUntil =
        performance.now() + (d.pr ?? PLAYER.SPAWN_PROTECTION);
      const kr = this.killerId ? this.remotes.get(this.killerId) : null;
      if (kr) kr.setFriendly(this.mode !== "ffa" && kr.team === this.team); // etiketi eski haline getir
      this.killerId = null;
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
    if (d.w === "knife") {
      this.sfx.knife(Math.max(0, 1 - dist / 15));
      return;
    }
    _end.set(d.e[0], d.e[1], d.e[2]);
    this.effects.tracer(_from, _end);
    this.effects.muzzle(_from);
    const vol = Math.max(0, 1 - dist / (d.w === "awp" ? 140 : 90)) * 0.8;
    if (d.w === "awp") this.sfx.awp(vol, dist > 25);
    else this.sfx.shot(vol, dist > 25);
  }

  onHit(d) {
    this.hud.hitmarker(d.k);
    this.sfx.hit();
    if (d.pt) this.effects.splat(d.pt);
    // Uçuşan hasar sayısı: rakibin başının biraz üstünde
    const r = this.remotes.get(d.v);
    if (r && r.visible)
      _tmp.copy(r.root.position).setY(r.root.position.y + 2.0);
    else if (d.pt) _tmp.set(d.pt[0], d.pt[1] + 0.4, d.pt[2]);
    else return;
    const dist = _tmp.distanceTo(this.camera.position);
    this.effects.damageNumber(
      _tmp,
      d.d,
      d.h,
      d.k,
      Math.max(1, Math.min(4, dist * 0.14)),
    );
  }

  /** Takım arkadaşının (veya kendi) işareti */
  onMarked(d) {
    const who = this.roster.get(d.id);
    const name = d.id === this.myId ? "SEN" : (who?.name ?? "?");
    this.marks.add(d.id, d.p, d.e === 1, name, TEAM_INFO[this.team].color);
    this.sfx.mark();
  }

  /** Herkes Tek: öldürme ödülü (+can, +şarjör) ya da şarjör bitmesin diye verilen yedek */
  onReward(d) {
    if (d.reserve) Object.assign(this.weapon.reserve, d.reserve);
    if (d.hp) this.hp = d.hp;
    if (d.kill) {
      this.hud.flagNotice("+25 CAN · +1 ŞARJÖR", "good");
      this.sfx.pickup();
    }
  }

  /** Bu uzak oyuncu bize rakip mi (Herkes Tek'te herkes) */
  isEnemy(rp) {
    return this.mode === "ffa" || rp.team !== this.team;
  }

  onPickup(d) {
    const pos = this.drops.remove(d.id);
    if (d.by === this.myId && d.reserve) {
      Object.assign(this.weapon.reserve, d.reserve);
      this.sfx.pickup();
      this.hud.flagNotice("+ MERMİ", "good");
    } else if (pos && d.by && pos.distanceTo(this.camera.position) < 12)
      this.sfx.pickup();
  }

  /** E / orta tık: baktığın yeri takıma işaretle (rakip oyuncuya bakıyorsan "DÜŞMAN!") */
  mark(now) {
    if (this.mode === "ffa" || now - this.lastMark < MARK.COOLDOWN) return; // Herkes Tek'te takım yok
    this.aim();
    const hit = this.physics.raycast(
      _eye,
      _fwd,
      MARK.RANGE,
      this.local.collider,
    );
    const far = hit ? hit.distance : MARK.RANGE;
    this.raycaster.set(_eye, _fwd);
    this.raycaster.far = far;
    const targets = [];
    for (const rp of this.remotes.values())
      if (rp.alive && rp.visible && this.isEnemy(rp)) targets.push(rp.body);
    const ph = targets.length
      ? this.raycaster.intersectObjects(targets, true)[0]
      : null;
    let p;
    let e = 0;
    if (ph) {
      p = ph.point;
      e = 1;
    } else if (hit) p = hit.point;
    else return; // gökyüzü
    this.lastMark = now;
    this.net.emit(MSG.MARK, { p: [r2(p.x), r2(p.y), r2(p.z)], e });
  }

  onDamaged(d) {
    this.hp = d.hp;
    this.shake = Math.max(this.shake, d.w === "poison" ? 0.08 : 0.25);
    this.sfx.hurt();
    // Hasar yönü: saldırganın bize göre açısı
    const dx = d.from[0] - this.local.position.x;
    const dz = d.from[2] - this.local.position.z;
    // Düşme hasarında yön yok (kaynak kendi konumumuz)
    const angle =
      Math.hypot(dx, dz) < 0.3 ? null : Math.atan2(dx, -dz) + this.local.yaw;
    this.hud.damage(angle);
  }

  onKill(d) {
    this.scores = d.s;
    const killer = this.roster.get(d.k) ?? { name: "?", team: "red" };
    const victim = this.roster.get(d.v) ?? { name: "?", team: "blue" };
    this.hud.killfeed(killer, victim, d.h, d.w);

    const word = d.h
      ? "HEADSHOT!"
      : d.w === "knife"
        ? "SHANKED!"
        : d.w === "he"
          ? "KABOOM!"
          : d.w === "fall"
            ? "SPLAT!"
            : d.w === "poison"
              ? "TOXIC!"
              : KILL_WORDS[Math.floor(Math.random() * KILL_WORDS.length)];
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
      this.weapon.aiming = false;
      this.chargeStart = 0;
      this.protectedUntil = 0;
      this.trajectory.hide();
      this.killedBy = d.k === d.v ? "" : killer.name;
      this.killerId = d.k === d.v ? null : d.k;
      // Ölüm kamerasında katilin isim etiketi görünsün
      const kr = this.killerId ? this.remotes.get(this.killerId) : null;
      if (kr) kr.tag.visible = true;
      this.killerHp = d.kh ?? 0;
      this.camera.getWorldDirection(_dir);
      this.deathLook.copy(this.camera.position).addScaledVector(_dir, 5);
      this.respawnAt = performance.now() + PLAYER.RESPAWN_TIME;
    }
    if (d.k === this.myId && d.v !== this.myId) {
      this.hud.pop(word);
      this.sfx.kill();
    }
  }

  onGrenade(d) {
    const mesh = part(
      NADE_GEO[d.t] ?? NADE_GEO.he,
      NADE_COLOR[d.t] ?? "#adb5bd",
      0.02,
    );
    mesh.position.set(d.o[0], d.o[1], d.o[2]);
    this.scene.add(mesh);
    this.grenades.set(d.g, {
      mesh,
      sim: { p: [...d.o], v: [...d.v] },
      born: performance.now(),
      steps: 0,
      t: d.t,
      lastVy: d.v[1],
    });
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
    if (d.t === "he") {
      this.effects.explosion(_tmp);
      this.sfx.explosion(Math.max(0.05, 1 - dist / 70));
      if (dist < 14) this.shake = Math.max(this.shake, 0.5 * (1 - dist / 14));
    } else {
      const w = WEAPONS[d.t] ?? WEAPONS.smoke;
      this.effects.smoke(_tmp, w.RADIUS, w.DURATION / 1000, d.t === "poison");
      this.sfx.smokePop(Math.max(0.05, 1 - dist / 50));
    }
  }

  onSprayed(d) {
    const from =
      d.id === this.myId
        ? this.local.position
        : this.remotes.get(d.id)?.root.position;
    this.effects.spray(d.id, d.c, d.p, d.n, from);
    if (d.id !== this.myId) {
      _tmp.set(d.p[0], d.p[1], d.p[2]);
      if (_tmp.distanceTo(this.camera.position) < 12) this.sfx.spray();
    }
  }

  /** Bayrak olayı (CTF): duyuru + ses */
  onFlag(d) {
    if (d.s) this.scores = d.s;
    const mine = d.team === this.team; // olay bizim bayrağımızla mı ilgili
    const who = d.by ? (this.roster.get(d.by)?.name ?? "?") : "";
    const me = d.by === this.myId;
    const enemyName = TEAM_INFO[d.team].name;
    let text = "";
    let good = !mine;
    switch (d.ev) {
      case "take":
        text = me
          ? "BAYRAĞI KAPTIN! ÜSSÜNE GÖTÜR!"
          : mine
            ? `${who} BAYRAĞIMIZI ÇALDI!`
            : `${who} ${enemyName} BAYRAĞINI KAPTI!`;
        break;
      case "drop":
        text = mine
          ? "BAYRAĞIMIZ DÜŞTÜ — GERİ AL!"
          : `${enemyName} BAYRAĞI YERE DÜŞTÜ!`;
        good = !mine;
        break;
      case "return":
        text = mine
          ? "BAYRAĞIMIZ ÜSSE DÖNDÜ"
          : `${enemyName} BAYRAĞI ÜSSÜNE DÖNDÜ`;
        good = mine;
        break;
      case "capture": {
        // Bayrağı getiren takım, bayrağın sahibinin rakibidir
        text = mine
          ? "RAKİP SAYI ALDI!"
          : me
            ? "SAYI! BAYRAĞI GETİRDİN!"
            : `${who} SAYIYI GETİRDİ!`;
        this.sfx.capture(!mine);
        this.hud.flagNotice(text, mine ? "bad" : "good");
        if (!mine) this.hud.pop("CAPTURE!");
        return;
      }
      default:
        return;
    }
    this.sfx.flag(good);
    this.hud.flagNotice(text, good ? "good" : "bad");
  }

  onMatchEnd(d) {
    this.state = "ended";
    this.weapon.visible = false;
    this.weapon.scope = 0;
    const names = new Map([...this.roster.values()].map((p) => [p.id, p.name]));
    this.hud.end(d, this.team, names, this.myId);
    this.input.unlock();
  }

  // ---------------- Maç yaşam döngüsü ----------------

  start(info, myId) {
    this.reset();
    this.world.load(info.map);
    this.solids = solidsOf(this.world.id);
    this.local.traction = this.world.map.traction ?? 1;
    this.local.pads = this.world.map.pads ?? [];
    this.local.onPad = () => this.sfx.boing();
    this.active = true;
    this.input.gameActive = true;
    this.myId = myId;
    this.mode = info.mode ?? "tdm";
    this.syncRoster(info.roster);
    this.scores = info.scores;
    this.scoreLimit = info.scoreLimit;
    this.timeLeft = info.timeLeft;
    this.state = info.countdown > 0 ? "countdown" : "playing";
    this.mode = info.mode ?? "tdm";
    this.flags.setup(this.mode === "ctf" ? info.flagBases : null);
    this.hud.setMode(this.mode);
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
    this.trajectory.hide();
    this.flags.setup(null);
    this.drops.clear();
    this.marks.clear();
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
      r.setFriendly(this.mode !== "ffa" && p.team === this.team);
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
    this.weapon.setHand(this.settings.hand);
  }

  // ---------------- Atış ----------------

  spread() {
    const l = this.local;
    const w = this.weapon.def;
    const scoped = this.weapon.scope > 0;
    let s;
    const ground = l.onGround;
    if (!ground) s = w.SPREAD_AIR;
    else if (scoped) s = l.moving ? w.SPREAD_SCOPED_MOVE : w.SPREAD_SCOPED;
    else if (l.running) s = w.SPREAD_RUN;
    else if (l.moving) s = w.SPREAD_MOVE;
    else s = w.SPREAD_BASE;
    if (l.crouching && ground) s *= 0.7;
    // Sağ tık nişan: yerdeyken çok daha isabetli (koşarken nişan alınamaz, koşu sapması geçerli)
    if (ground && this.weapon.aiming)
      s *= ADS.SPREAD_MULT * (l.moving ? 1.6 : 1);
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
    this.protectedUntil = 0; // ateş eden doğuş korumasını kaybeder (sunucuyla aynı)
    this.weapon.fire(now, heavy);
    this.aim();

    if (w.kind === "melee") {
      this.sfx.knife(1);
      _dir.copy(_fwd);
      const hit = this.physics.raycast(
        _eye,
        _dir,
        w.RANGE,
        this.local.collider,
      );
      if (hit) {
        this.effects.impact(hit.point, hit.normal);
        this.sfx.stab();
      }
      this.net.emit(MSG.SHOOT, {
        d: [r3(_dir.x), r3(_dir.y), r3(_dir.z)],
        h: heavy ? 1 : 0,
      });
      return;
    }

    if (this.weapon.current === "awp") this.sfx.awp(1);
    else this.sfx.shot(1);

    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * this.spread();
    _dir
      .copy(_fwd)
      .addScaledVector(_right, Math.cos(a) * r)
      .addScaledVector(_up, Math.sin(a) * r)
      .normalize();

    // Yerel görsel: duvar isabeti (oyuncu isabetini sunucu söyler)
    const hit = this.physics.raycast(_eye, _dir, w.RANGE, this.local.collider);
    let dist = hit ? hit.distance : w.RANGE;
    this.raycaster.set(_eye, _dir);
    this.raycaster.far = dist;
    const targets = [];
    for (const rp of this.remotes.values())
      if (rp.alive && rp.visible && this.isEnemy(rp)) targets.push(rp.body);
    const ph = targets.length
      ? this.raycaster.intersectObjects(targets, true)[0]
      : null;
    if (ph) dist = ph.distance;
    else if (hit) this.effects.impact(hit.point, hit.normal);

    _end.copy(_eye).addScaledVector(_dir, dist);
    _from
      .copy(_eye)
      .addScaledVector(_right, 0.16 * this.weapon.side)
      .addScaledVector(_up, -0.14)
      .addScaledVector(_fwd, 0.5);
    this.effects.tracer(_from, _end);

    this.net.emit(MSG.SHOOT, { d: [r3(_dir.x), r3(_dir.y), r3(_dir.z)] });

    // Geri tepme
    const l = this.local;
    const rk = this.weapon.aiming ? 0.7 : 1;
    l.pitch += w.RECOIL * rk * (0.6 + Math.random() * 0.4);
    l.yaw += (Math.random() - 0.5) * w.RECOIL * 0.6 * rk;
    l.clampPitch();
  }

  get charge() {
    return this.chargeStart
      ? Math.min(
          1,
          (performance.now() - this.chargeStart) / GRENADE.CHARGE_TIME,
        )
      : 0;
  }

  throwGrenade(now) {
    const id = this.weapon.current;
    const c = r2(this.charge);
    this.chargeStart = 0;
    this.weapon.charge = 0;
    this.protectedUntil = 0;
    this.weapon.throwNade(now);
    this.sfx.throw();
    this.aim();
    this.net.emit(MSG.THROW, { d: [r3(_fwd.x), r3(_fwd.y), r3(_fwd.z)], c });
    // Bu bombadan kalmadıysa elindeki önceki silaha dön
    if (this.weapon.nades[id] <= 0) this.switchBackAt = now + 450;
  }

  spray(now) {
    if (now - this.lastSpray < SPRAY.COOLDOWN) return;
    this.aim();
    const hit = this.physics.raycast(
      _eye,
      _fwd,
      SPRAY.RANGE,
      this.local.collider,
    );
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
      this.chargeStart = 0;
      this.weapon.charge = 0;
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

    // Silah seçimi: 1 ana · 2 tabanca · 3 bıçak · 4 bomba, fare tekeri, Q (son silah)
    for (const [key, slot] of Object.entries(SLOT_KEYS)) {
      if (input.pressed(key)) {
        const id = wp.slotWeapon(slot);
        if (id) this.switchWeapon(id, now);
      }
    }
    if (input.pressed("KeyQ"))
      this.switchWeapon(wp.has(wp.previous) ? wp.previous : "knife", now);
    if (input.wheel) this.switchWeapon(wp.cycle(input.wheel > 0 ? 1 : -1), now);
    if (this.switchBackAt && now >= this.switchBackAt) {
      this.switchBackAt = 0;
      const back =
        wp.has(wp.previous) && WEAPONS[wp.previous].kind !== "grenade"
          ? wp.previous
          : wp.loadout.primary;
      this.switchWeapon(back, now);
    }

    if (input.pressed("KeyT")) this.spray(now);
    if (input.pressed("KeyE") || input.middleClicked) this.mark(now);

    const w = wp.def;
    if (input.pressed("KeyR")) this.reload(now);

    // Sağ tık: AWP'de dürbün, bıçakta ağır saldırı
    if (input.rightClicked && w.id === "awp") {
      wp.toggleScope();
      this.sfx.scope();
    }
    if (
      w.kind === "melee" &&
      input.rightDown &&
      !input.mouseDown &&
      wp.canFire(now)
    )
      this.fire(now, true);
    // Sağ tık basılı: nişan al (AWP dışındaki ateşli silahlar)
    wp.aiming = wp.canAim && input.rightDown && !wp.reloading;

    if (w.kind === "grenade") {
      // Basılı tut: güç dolar; bırakınca at. Sağ tık iptal eder.
      if (!this.chargeStart && input.mouseClicked && wp.canFire(now))
        this.chargeStart = now;
      if (this.chargeStart) {
        if (input.rightClicked) this.chargeStart = 0;
        else if (!input.mouseDown) this.throwGrenade(now);
      }
      wp.charge = this.charge;
      return;
    }
    this.chargeStart = 0;
    wp.charge = 0;

    const trigger = w.AUTO ? input.mouseDown : input.mouseClicked;
    if (trigger) {
      if (wp.canFire(now)) this.fire(now);
      else if (
        input.mouseClicked &&
        w.kind === "gun" &&
        wp.ammo[w.id] === 0 &&
        !wp.reloading
      ) {
        this.sfx.empty();
        this.reload(now);
      }
    }
    if (
      w.kind === "gun" &&
      wp.ammo[w.id] === 0 &&
      !wp.reloading &&
      now - wp.lastShot > 300
    )
      this.reload(now);
  }

  // ---------------- Kare güncellemesi ----------------

  update(dt) {
    const now = performance.now();
    const input = this.input;
    const playing = this.state === "playing";
    const controls = input.locked && this.alive && playing;

    const look = input.locked
      ? input.consumeMouse()
      : (input.consumeMouse(), { dx: 0, dy: 0 });
    if (this.alive && this.state !== "ended") {
      // Dürbünde hassasiyet yakınlaştırmaya göre düşer
      const zoom = Math.min(1, this.camera.fov / this.settings.fov);
      this.local.look(look.dx, look.dy, this.settings.sensitivity * zoom);
      this.local.speedMult = this.weapon.def.SPEED_MULT;
      this.local.scoped = this.weapon.scope > 0;
      this.local.aiming = this.weapon.aiming;
      this.local.update(dt, input, controls);
      // Yere sert iniş: düşme hasarını sunucu hesaplar
      if (this.local.landed > FALL.SAFE_SPEED && playing) {
        this.net.emit(MSG.FALL, { v: r2(this.local.landed) });
        this.shake = Math.max(this.shake, 0.2);
      }
      this.local.landed = 0;
    }

    if (controls) this.handleWeaponInput(now);
    else this.weapon.aiming = false;
    this.updateTrajectory(controls);
    if (input.locked && this.state !== "ended" && input.pressed("KeyB"))
      this.onBuyMenu?.();
    this.weapon.update(dt, now, this.local, look);

    // Girdiyi sunucuya gönder (saniyede CLIENT_SEND_RATE)
    if (this.alive && this.state !== "ended") {
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
    this.flags.update(
      dt,
      (id) => this.remotes.get(id)?.root ?? null,
      this.myId,
    );
    this.drops.update(dt);
    this.marks.update(this.camera);
    this.effects.update(dt);
    this.updateHud(now);
  }

  /** Elinde bomba varken nereye düşeceğini göster */
  updateTrajectory(controls) {
    const wp = this.weapon;
    if (
      !controls ||
      wp.def.kind !== "grenade" ||
      !(wp.nades[wp.current] > 0) ||
      wp.throwT > 0
    ) {
      this.trajectory.hide();
      return;
    }
    this.aim();
    // Sunucudaki başlangıç noktasıyla aynı: gözden biraz ileride, duvarın dibindeysen gözden
    const wall = this.physics.raycast(_eye, _fwd, 0.6, this.local.collider);
    const ahead = Math.max(
      0,
      Math.min(0.5, (wall ? wall.distance : 0.6) - 0.15),
    );
    const o = [
      _eye.x + _fwd.x * ahead,
      _eye.y + _fwd.y * ahead - 0.1,
      _eye.z + _fwd.z * ahead,
    ];
    const d = [r3(_fwd.x), r3(_fwd.y), r3(_fwd.z)];
    this.trajectory.show(
      o,
      d,
      r2(this.charge),
      wp.current,
      this.solids,
      !!this.chargeStart,
    );
  }

  /** Sunucuyla aynı sabit adımlı fizikle bombaları ilerlet */
  updateGrenades(now) {
    for (const [gid, g] of this.grenades) {
      const target = Math.floor((now - g.born) / 1000 / (1 / 60));
      let n = 0;
      while (g.steps < target && n++ < 600) {
        stepGrenade(g.sim, this.solids);
        g.steps++;
        // Sekme sesi: dikey hız yön değiştirdiyse
        if (g.lastVy < -2 && g.sim.v[1] > 0) {
          _tmp.set(g.sim.p[0], g.sim.p[1], g.sim.p[2]);
          this.sfx.bounce(
            Math.max(0, 1 - _tmp.distanceTo(this.camera.position) / 25),
          );
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
      // Ölüm kamerası: önce yere düş, sonra seni vuran oyuncuya dön
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 0.5);
      cam.position.set(
        l.position.x,
        l.position.y + PLAYER.EYE - k * 1.2,
        l.position.z,
      );
      const killer = this.killerId ? this.remotes.get(this.killerId) : null;
      if (
        killer &&
        killer.visible &&
        this.deathT > 0.55 &&
        this.state !== "ended"
      ) {
        const m = Math.min(1, (this.deathT - 0.55) / 0.7);
        const ease = m * m * (3 - 2 * m);
        cam.position.y += ease * 1.5; // ruh gibi biraz yüksel
        _tmp.copy(killer.root.position);
        _tmp.y += 1.3;
        this.deathLook.lerp(_tmp, Math.min(1, dt * (2 + ease * 8)));
        cam.lookAt(this.deathLook);
        cam.rotation.z = 0.6 * (1 - ease);
      } else cam.rotation.set(l.pitch * (1 - k) + k * 0.3, l.yaw, k * 0.6);
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.06;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
    }

    // Dürbün / nişan yakınlaştırması, hızlı koşuda hafif FOV açılması
    const wp = this.weapon;
    const scope = this.alive ? wp.scope : 0;
    let fov;
    if (scope > 0) fov = WEAPONS.awp.ZOOM_FOV[scope - 1];
    else {
      const ads = this.alive ? wp.adsT : 0;
      const sprint = this.alive ? wp.sprint : 0;
      fov =
        this.settings.fov *
        (1 - (1 - ADS.FOV_MULT) * ads) *
        (1 + 0.08 * sprint);
    }
    if (this.fov === null || Math.abs(fov - this.fov) > 0.01) {
      this.fov = fov;
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }

  updateHud(now) {
    const hud = this.hud;
    const wp = this.weapon;
    hud.setHealth(this.alive ? this.hp : 0);
    hud.setAmmo(wp.def, wp.count, wp.reloading, wp.reserveCount);
    hud.setStamina(
      this.alive && this.state !== "ended"
        ? this.local.stamina / PLAYER.STAMINA_MAX
        : null,
      this.local.exhausted,
    );
    hud.setPoison(
      this.alive ? this.effects.poisonDensity(this.camera.position) : 0,
    );
    hud.setWeapons(
      wp.current,
      wp.owned,
      wp.nades,
      this.alive && this.state !== "ended",
    );
    if (this.mode === "ffa") {
      // Herkes Tek: solda benim öldürmelerim, sağda lider (lider bensem ikinci)
      let lead = null;
      for (const p of this.roster.values()) {
        if (p.id === this.myId) continue;
        const k = this.stats.get(p.id)?.k ?? 0;
        if (!lead || k > lead.k) lead = { name: p.name, k };
      }
      hud.setFfaScores(
        this.stats.get(this.myId)?.k ?? 0,
        lead?.k ?? 0,
        lead?.name ?? "-",
        this.scoreLimit,
      );
    } else
      hud.setScores(
        this.scores.red,
        this.scores.blue,
        this.scoreLimit,
        this.mode,
      );
    if (this.mode === "ctf" && this.flagState) {
      const st = TEAMS.map((t, i) => this.flagState[i][0]);
      const carrying = this.flagState.some(
        (f) => f[0] === FLAG_STATE.CARRIED && f[1] === this.myId,
      );
      const ownHome = st[TEAMS.indexOf(this.team)] === FLAG_STATE.BASE;
      hud.setFlags(st, this.alive && carrying, ownHome);
    } else hud.setFlags(null);
    hud.setPing(this.myPing);
    const elapsed = this.state === "playing" ? now - this.timeStamp : 0;
    hud.setTime(this.timeLeft - elapsed);
    const scoped = this.alive && wp.scope > 0;
    hud.setScope(scoped);
    hud.setCharge(this.alive && this.chargeStart ? this.charge : 0);
    hud.setLowHealth(
      this.alive &&
        this.state !== "ended" &&
        this.hp > 0 &&
        this.hp < PLAYER.MAX_HP * 0.15,
    );
    hud.setSmoke(this.effects.smokeDensity(this.camera.position));
    // Nişangah açıklığı yumuşak değişsin (yürü/koş/dur geçişlerinde zıplamasın)
    const gap = wp.def.kind === "gun" ? 5 + this.spread() * 500 : 3;
    this.chGap =
      this.chGap === undefined
        ? gap
        : this.chGap +
          (gap - this.chGap) *
            Math.min(1, ((now - (this.chAt ?? now)) / 1000) * 14);
    this.chAt = now;
    hud.setCrosshair(this.chGap);
    // AWP'de dürbünsüz nişangah yok (CS gibi); dürbünün kendi çizgileri var
    hud.setCrosshairVisible(
      this.alive && this.state !== "ended" && wp.current !== "awp",
    );

    if (this.state === "countdown") {
      const n = Math.max(1, Math.ceil((this.countdownEnd - now) / 1000));
      if (n !== this.lastCount) {
        this.lastCount = n;
        this.sfx.countdown(false);
      }
      hud.center(String(n), "count");
    } else if (now < this.fightUntil) {
      if (this.lastCount !== 0) {
        this.lastCount = 0;
        this.sfx.countdown(true);
      }
      hud.center("FIGHT!", "fight");
    } else hud.center("");

    // Doğuş koruması geri sayımı
    const prot =
      this.alive && this.state === "playing" && now < this.protectedUntil;
    hud.setProtection(
      prot ? Math.ceil((this.protectedUntil - now) / 1000) : null,
    );

    if (!this.alive && this.state === "playing") {
      hud.respawn(
        Math.max(0, Math.ceil((this.respawnAt - now) / 1000)),
        this.killedBy,
        this.killerHp,
      );
    } else hud.respawn(null);

    const showBoard = this.input.down("Tab") && this.state !== "ended";
    if (showBoard) {
      const rows = [...this.roster.values()].map((p) => {
        const s = this.stats.get(p.id) ?? { k: 0, d: 0, rtt: 0 };
        return {
          id: p.id,
          name: p.name,
          team: p.team,
          k: s.k,
          d: s.d,
          rtt: s.rtt,
          bot: p.bot,
        };
      });
      hud.scoreboard(true, rows, this.myId, this.scores, this.mode);
    } else hud.scoreboard(false);
  }

  get teamColor() {
    return TEAM_INFO[this.team].color;
  }
}
