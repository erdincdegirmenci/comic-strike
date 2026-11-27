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
  HOOK,
  STREAK,
  playerScore,
  REVENGE,
  GUN_LADDER,
  isSolo,
} from "@comic-strike/shared/constants.js";
import { solidsOf } from "@comic-strike/shared/maps.js";
import { stepGrenade, stepRocket } from "@comic-strike/shared/grenade.js";
import { trainCarry, trainSolids } from "@comic-strike/shared/train.js";
import { LocalPlayer } from "./player/LocalPlayer.js";
import { RemotePlayer } from "./player/RemotePlayer.js";
import { Weapon } from "./player/Weapon.js";
import { Effects } from "./fx/Effects.js";
import { part } from "./fx/Toon.js";
import { Trajectory } from "./fx/Trajectory.js";
import { Flags } from "./fx/Flags.js";
import { Drops } from "./fx/Drops.js";
import { Marks } from "./fx/Marks.js";
import { Ropes } from "./fx/Ropes.js";
import { Minimap } from "./ui/Minimap.js";

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const KILL_WORDS = ["KAPOW!", "BLAM!", "WHAM!", "ZAP!", "BOOM!", "POW!"];
const SLOT_KEYS = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 };
const NADE_GEO = {
  he: new THREE.SphereGeometry(0.1, 10, 8),
  smoke: new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10),
  poison: new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10),
  mine: new THREE.CylinderGeometry(0.17, 0.19, 0.07, 16),
  molotov: new THREE.CylinderGeometry(0.06, 0.075, 0.24, 10),
  bazooka: new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10), // roket (Y ekseni uçuş yönüne çevrilir)
  flash: new THREE.CylinderGeometry(0.07, 0.07, 0.22, 10),
  frost: new THREE.BoxGeometry(0.17, 0.17, 0.17),
};
const NADE_COLOR = { decoy: "#f4a261", he: "#52b788", smoke: "#adb5bd", poison: "#7cb518", mine: "#4a4e3a", molotov: "#9c6644", bazooka: "#5c6b3a", flash: "#e9ecef", frost: "#7fd3f5" };
const _yAxis = new THREE.Vector3(0, 1, 0);
// Ateş sesi: silaha göre
const SHOT_SOUND = { awp: "awp", shotgun: "shotgun", revolver: "revolver", cannon: "revolver" };
const MINE_LAMP = new THREE.SphereGeometry(0.035, 8, 6);
const MINE_LAMP_ON = new THREE.MeshBasicMaterial({ color: "#ff2b2b" });
const MINE_LAMP_OFF = new THREE.MeshBasicMaterial({ color: "#4a1010" });

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
    // Şarjör animasyonuyla senkron sesler
    this.weapon.onReloadStep = (step) => this.sfx.reloadStep(step);
    this.effects = new Effects(this.scene);
    this.trajectory = new Trajectory(this.scene);
    this.flags = new Flags(this.scene);
    this.drops = new Drops(this.scene);
    this.marks = new Marks(this.scene);
    this.ropes = new Ropes(this.scene);
    this.local.onHookEnd = () => {
      this.ropes.remove(this.myId);
      this.net.emit(MSG.UNHOOK);
    };
    this.minimap = new Minimap(document.getElementById("minimap"));
    this.deathLook = new THREE.Vector3();
    this.remotes = new Map();
    this.grenades = new Map();
    this.decoys = new Map(); // sahte kopyalar
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
    this.frozenUntil = 0; // donma bitişi (performance.now)
    this.blind = null; // flaş: {until, ms, k}
    this.nextHook = 0;
    this.lastSpraySound = 0;
    this.deathInfo = null; // ölüm ekranı: {w, dist}
    this.chatting = false; // sohbet kutusu açık: hareket / ateş yok
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
    on(MSG.DECOY, this.onDecoy);
    on(MSG.DECOY_END, this.onDecoyEnd);
    on(MSG.GUN, this.onGun);
    on(MSG.HOOKED, this.onHooked);
    on(MSG.FROZEN, this.onFrozen);
    on(MSG.BLIND, (d) => {
      if (!this.alive) return;
      const now = performance.now();
      // Süren daha güçlü bir körlüğü zayıfı ezmesin
      if (this.blind && this.blind.until > now + d.ms) return;
      this.blind = { until: now + d.ms, ms: d.ms, k: d.k };
      this.sfx.ring(d.ms / 1000, d.k);
    });
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
      a,
      rv,
      lv,
    ] of s.p) {
      this.stats.set(id, { k, d, a: a ?? 0, rv: rv ?? 0, lv: lv ?? 0, rtt });
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
      this.clearStatus();
      this.nextHook = 0;
      this.protectedUntil =
        performance.now() + (d.pr ?? PLAYER.SPAWN_PROTECTION);
      const kr = this.killerId ? this.remotes.get(this.killerId) : null;
      if (kr) kr.setFriendly(!isSolo(this.mode) && kr.team === this.team); // etiketi eski haline getir
      this.killerId = null;
      this.hud.respawn(null);
    } else {
      this.remotes.get(d.id)?.respawn(d.p, d.yaw);
    }
  }

  /** Donma, körlük ve kancayı temizle (doğuş / ölüm) */
  clearStatus() {
    this.frozenUntil = 0;
    this.blind = null;
    this.local.hook = null;
    this.ropes.remove(this.myId);
  }

  onFrozen(d) {
    if (!this.alive) return;
    const now = performance.now();
    if (now >= this.frozenUntil) this.sfx.ice(1);
    this.frozenUntil = now + d.ms;
    this.local.endHook();
    this.chargeStart = 0;
    const wp = this.weapon;
    wp.charge = 0;
    wp.scope = wp.resumeScope = 0;
    wp.aiming = false;
    wp.reloading = false;
  }

  /** Birinin kancası: halatı göster / kaldır. Kendi halatımız yerelde çizilir. */
  onHooked(d) {
    if (d.id === this.myId) {
      if (!d.p) this.local.endHook();
      return;
    }
    const r = this.remotes.get(d.id);
    if (!d.p || !r) return this.ropes.remove(d.id);
    this.ropes.add(d.id, d.p, (t) => {
      t.copy(r.root.position).y += 1.2;
      return r.alive !== false && r.visible;
    }, HOOK.MAX_TIME);
    const dist = r.root.position.distanceTo(this.camera.position);
    this.sfx.hook(Math.max(0, 1 - dist / 35));
  }

  /** F: kancayı bakılan yüzeye at (çekilirken tekrar basınca bırak) */
  throwHook(now) {
    if (this.local.hook) return this.local.endHook();
    if (now < this.nextHook) return;
    this.aim();
    const hit = this.physics.raycast(_eye, _fwd, HOOK.RANGE, this.local.collider);
    if (!hit) return; // menzilde tutunacak yer yok: bekleme süresi harcanmaz
    this.nextHook = now + HOOK.COOLDOWN;
    this.protectedUntil = 0;
    const p = [r2(hit.point.x), r2(hit.point.y), r2(hit.point.z)];
    this.local.startHook(hit.point);
    // Halatın bizdeki ucu: ekranın sol altı
    this.ropes.add(this.myId, p, (t) => {
      t.set(-0.28, -0.3, -0.5).applyQuaternion(this.camera.quaternion).add(this.camera.position);
    }, HOOK.MAX_TIME + 200);
    this.net.emit(MSG.HOOK, { p });
    this.sfx.hook(1);
  }

  onCorrection(d) {
    if (d.l === this.life) this.local.teleport(d.p);
  }

  onShot(d) {
    const r = this.remotes.get(d.id);
    if (r) r.seenAt = performance.now(); // ateş eden rakip mini haritada kısa süre görünür
    if (r && r.visible) r.muzzleWorld(_from);
    else _from.set(d.o[0], d.o[1] - 0.2, d.o[2]);
    const dist = _from.distanceTo(this.camera.position);
    if (d.w === "knife") {
      this.sfx.knife(Math.max(0, 1 - dist / 15));
      return;
    }
    for (const e of WEAPONS[d.w]?.SPRAY ? [] : (d.es ?? [d.e])) {
      _end.set(e[0], e[1], e[2]);
      this.effects.tracer(_from, _end);
    }
    if (WEAPONS[d.w]?.SPRAY) {
      _end.set(d.e[0], d.e[1], d.e[2]);
      _dir.set(d.e[0] - d.o[0], d.e[1] - d.o[1], d.e[2] - d.o[2]);
      const reach = _dir.length();
      _dir.normalize();
      this.effects.stream(_from, _dir, reach, WEAPONS[d.w].SPRAY === "ice");
      this.spraySound(d.w, Math.max(0, 1 - dist / 35) * 0.8);
      return;
    }
    this.effects.muzzle(_from);
    const loud = d.w === "awp" || d.w === "shotgun";
    const vol = Math.max(0, 1 - dist / (loud ? 140 : 90)) * 0.8;
    this.sfx[SHOT_SOUND[d.w] ?? "shot"](vol, dist > 25);
  }

  onHit(d) {
    this.hud.hitmarker(d.k);
    this.sfx.hit();
    if (d.pt && !this.weapon.def.SPRAY) this.effects.splat(d.pt);
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
    return isSolo(this.mode) || rp.team !== this.team;
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
    if (isSolo(this.mode) || now - this.lastMark < MARK.COOLDOWN) return; // Herkes Tek'te takım yok
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
    const soft = d.w === "poison" || d.w === "molotov" || d.w === "water" || !!WEAPONS[d.w]?.SPRAY;
    this.shake = Math.max(this.shake, soft ? 0.08 : 0.25);
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
    // Asist yapanlar: ölene son 5 sn içinde hasar veren diğer rakipler (silahlarıyla)
    const assists = (d.a ?? [])
      .map(([id, w]) => ({ p: this.roster.get(id), w }))
      .filter((x) => x.p);
    this.hud.killfeed(killer, victim, d.h, d.w, assists, d.tk === 1);
    if (assists.some((x) => x.p.id === this.myId)) this.hud.flagNotice("ASİST! +1", "good");

    const word = d.h
      ? "HEADSHOT!"
      : d.w === "knife"
        ? "SHANKED!"
        : d.w === "he"
          ? "KABOOM!"
          : d.w === "mine"
            ? "TIK-TAK-BOOM!"
          : d.w === "fall"
            ? "SPLAT!"
            : d.w === "water"
              ? "GLUB GLUB!"
            : d.w === "poison"
              ? "TOXIC!"
              : d.w === "molotov"
                ? "YANDI!"
                : d.w === "bazooka"
                  ? "KA-BOOM!"
                  : d.w === "shotgun"
                    ? "KA-CHUNK!"
                    : d.w === "flamer"
                      ? "KIZARDI!"
                      : d.w === "freezer"
                        ? "BUZ GİBİ!"
              : KILL_WORDS[Math.floor(Math.random() * KILL_WORDS.length)];
    const r = this.remotes.get(d.v);
    if (r) {
      r.die();
      this.effects.poof(r.root.position);
      _tmp.copy(r.root.position).y += 2;
      this.effects.word(_tmp, word);
    }
    // İntikam / ezeli düşman duyurusu seri duyurusundan önceliklidir (aynı yazı alanı)
    if (!this.announceRevenge(d, killer, victim))
      this.announceStreak(d, killer, victim);
    this.ropes.remove(d.v);
    if (d.v === this.myId) {
      this.clearStatus();
      const from = this.remotes.get(d.k);
      this.deathInfo = d.k !== d.v && from ? { w: d.w, dist: Math.round(from.root.position.distanceTo(this.local.position)) } : null;
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

  /** İntikam (herkese) ve ezeli düşman (sadece ilgili iki oyuncuya). Duyuru yapıldıysa true döner */
  announceRevenge(d, killer, victim) {
    const iKilled = d.k === this.myId;
    const iDied = d.v === this.myId;
    if (d.nm && iDied) this.nemeses.add(d.k);
    if (d.rv) {
      if (iKilled) this.nemeses.delete(d.v);
      const who = iKilled ? "SEN" : killer.name;
      this.hud.streak(
        "İNTİKAM!",
        `${who} ➜ ${victim.name} · +${REVENGE.BONUS} PUAN`,
        iKilled,
      );
      if (iKilled) this.sfx.streak(3);
      return true;
    }
    if (!d.nm || (!iKilled && !iDied)) return false;
    this.hud.streak(
      "EZELİ DÜŞMAN!",
      iDied
        ? `${killer.name} seni ${REVENGE.KILLS} kez vurdu · intikamını al!`
        : `${victim.name} artık intikam peşinde!`,
      true,
    );
    return true;
  }

  /** Seri öldürme duyurusu: art arda (ikili, üçlü...), ölmeden seri ve biten seri */
  announceStreak(d, killer, victim) {
    const multi = d.mk >= 2 ? STREAK.MULTI[Math.min(d.mk, 5)] : null;
    const row = STREAK.ROW[d.sr] ?? (d.sr > 10 && d.sr % 5 === 0 ? STREAK.ROW[10] : null);
    const mine = d.k === this.myId;
    const who = mine ? "SEN" : killer.name;
    let title = multi ?? row;
    let sub = multi && row ? `${who} · ${row} (${d.sr} SERİ)` : multi ? who : `${who} · ${d.sr} ÖLDÜRME SERİSİ`;
    if (!title && d.se >= STREAK.ENDED && d.k !== d.v) {
      title = "SERİ BİTTİ!";
      sub = `${who} ➜ ${victim.name} (${d.se} SERİ)`;
    }
    if (!title) return;
    this.hud.streak(title, sub, mine);
    if (mine) this.sfx.streak(Math.max(d.mk, Math.ceil(d.sr / 2)));
  }

  spraySound(id, volume) {
    const now = performance.now();
    // Her atışta ses üst üste binmesin
    if (now - this.lastSpraySound < 90) return;
    this.lastSpraySound = now;
    this.sfx[id === "freezer" ? "frost" : "flame"](volume);
  }

  onGrenade(d) {
    const mesh = part(
      NADE_GEO[d.t] ?? NADE_GEO.he,
      NADE_COLOR[d.t] ?? "#adb5bd",
      0.02,
    );
    mesh.position.set(d.o[0], d.o[1], d.o[2]);
    const rocket = !!WEAPONS[d.t]?.ROCKET;
    if (rocket) {
      // Roket: burnu kırmızı, uçuş yönüne bakar
      const nose = part(new THREE.ConeGeometry(0.07, 0.16, 10), "#c0392b", 0.015);
      nose.position.y = 0.32;
      mesh.add(nose);
      _tmp.set(d.v[0], d.v[1], d.v[2]).normalize();
      mesh.quaternion.setFromUnitVectors(_yAxis, _tmp);
    }
    let lamp = null;
    if (d.t === "mine") {
      // Kurulunca yanıp sönen kırmızı lamba (benim mayınımsa daha belirgin)
      lamp = new THREE.Mesh(MINE_LAMP, MINE_LAMP_OFF);
      lamp.position.set(0, 0.05, 0);
      mesh.add(lamp);
    }
    this.scene.add(mesh);
    this.grenades.set(d.g, {
      lamp,
      mine: d.t === "mine",
      mesh,
      sim: { p: [...d.o], v: [...d.v] },
      // age: maç ortasında katılınca sunucu yerdeki mayının yaşını yollar
      born: performance.now() - (d.age ?? 0),
      steps: Math.floor((d.age ?? 0) / 1000 / (1 / 60)),
      rocket,
      t: d.t,
      lastVy: d.v[1],
    });
    if (d.id !== this.myId && !d.age) {
      const dist = mesh.position.distanceTo(this.camera.position);
      if (rocket) this.sfx.rocket(Math.max(0, 1 - dist / 80));
      else if (dist < 20) this.sfx.throw();
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
    if (d.fz) {
      // Mayın söndü (süresi doldu / yeni mayın kuruldu): hasarsız küçük duman
      this.effects.poof(_tmp);
    } else if (d.t === "decoy") {
      this.effects.poof(_tmp);
    } else if (d.t === "flash") {
      this.effects.flashBurst(_tmp);
      this.sfx.flashbang(Math.max(0.05, 1 - dist / 60));
    } else if (d.t === "frost") {
      this.effects.frostBurst(_tmp, WEAPONS.frost.RADIUS);
      this.sfx.ice(Math.max(0.05, 1 - dist / 45));
    } else if (d.t === "molotov") {
      // Alev halısı (d.rem: maç ortasında katılana kalan süre)
      const w = WEAPONS.molotov;
      this.effects.fire(_tmp, w.RADIUS, (d.rem ?? w.DURATION) / 1000);
      if (!d.rem) this.sfx.fireBurst(Math.max(0.05, 1 - dist / 50));
    } else if (d.t === "he" || d.t === "mine" || d.t === "bazooka") {
      this.effects.explosion(_tmp);
      this.sfx.explosion(Math.max(0.05, 1 - dist / 70));
      if (dist < 14) this.shake = Math.max(this.shake, 0.5 * (1 - dist / 14));
    } else {
      const w = WEAPONS[d.t] ?? WEAPONS.smoke;
      this.effects.smoke(_tmp, w.RADIUS, (d.rem ?? w.DURATION) / 1000, d.t === "poison");
      if (!d.rem) this.sfx.smokePop(Math.max(0.05, 1 - dist / 50));
    }
  }

  // ---------------- Sahte Kopya ----------------

  onDecoy(d) {
    const friend = d.o === this.myId || (!isSolo(this.mode) && d.tm === this.team);
    // Rakipler gerçek oyuncudan ayırt edemesin; atan ve takımı "(KOPYA)" yazısını görür
    const r = new RemotePlayer(
      { id: `decoy-${d.id}`, name: friend ? `${d.n} (KOPYA)` : d.n, char: d.c, team: d.tm },
      this.scene,
    );
    r.setWeapon(d.w);
    r.push(0, d.p[0], d.p[1], d.p[2], d.yaw, 0, true, 0);
    r.setFriendly(friend);
    r.owner = d.o;
    this.decoys.set(d.id, r);
  }

  onDecoyEnd(d) {
    const r = this.decoys.get(d.id);
    if (!r) return;
    this.decoys.delete(d.id);
    this.effects.poof(r.root.position);
    if (d.by) {
      _tmp.copy(r.root.position).y += 2;
      this.effects.word(_tmp, "KANDIN!");
    }
    if (d.by === this.myId) this.hud.flagNotice("SAHTE KOPYAYMIŞ!", "bad");
    else if (d.by && r.owner === this.myId) this.hud.flagNotice("KOPYAN BİRİNİ KANDIRDI!", "good");
    r.dispose();
  }

  clearDecoys() {
    for (const r of this.decoys?.values() ?? []) r.dispose();
    this.decoys = new Map();
  }

  // ---------------- Silah Yarışı ----------------

  onGun(d) {
    if (!this.alive) return;
    this.weapon.reset(d.ammo, d.nades, d.loadout, d.reserve);
    this.chargeStart = 0;
    this.switchBackAt = 0;
    this.sfx.draw();
    const w = GUN_LADDER[d.level];
    this.hud.flagNotice(
      w === "knife" ? "SON SEVİYE: BIÇAKLA BİTİR!" : `SEVİYE ${d.level + 1} · ${WEAPONS[w].NAME}`,
      "good",
    );
  }

  // ---------------- Tren ----------------

  /** Sunucu saati tahmini (tren bu saate göre hareket eder) */
  get serverNow() {
    return Date.now() - (this.offset ?? 0);
  }

  /** Harita + (varsa) hareketli trenin şu anki kutuları: bomba / roket yörüngesi için */
  get liveSolids() {
    const t = this.world.map.train;
    return t ? this.solids.concat(trainSolids(t, this.serverNow)) : this.solids;
  }

  /** Treni güncel yerine getir; yerel oyuncu trendeyse onu da taşı */
  updateTrain() {
    const train = this.world.map.train;
    if (!train || !this.world.train) return;
    const t = this.serverNow;
    if (this.alive && this.state !== "ended" && this.trainT !== null) {
      const dx = trainCarry(train, this.local.position.toArray(), this.trainT, t);
      if (dx) this.local.shift(dx);
    }
    this.trainT = t;
    this.world.train.update(t);
    this.physics.step(); // çarpışma sorguları trenin yeni yerini görsün
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
    this.clearStatus();
    this.weapon.visible = false;
    this.weapon.scope = 0;
    const names = new Map([...this.roster.values()].map((p) => [p.id, p.name]));
    this.hud.end(d, this.team, names, this.myId);
    this.input.unlock();
  }

  // ---------------- Maç yaşam döngüsü ----------------

  start(info, myId) {
    if (this.active) {
      // Maç baştan başlıyor (oylama): sahnede kalan efektleri, bombaları ve kutuları temizle
      for (const g of this.grenades.values()) this.scene.remove(g.mesh);
      this.grenades.clear();
      this.effects.clear();
      this.trajectory.hide();
      this.drops.clear();
      this.marks.clear();
      this.ropes.clear();
      this.local.hook = null;
      for (const r of this.remotes.values()) r.die();
    }
    this.reset();
    this.nemeses = new Set(); // ezeli düşmanlarım (id)
    this.clearDecoys();
    this.trainT = null;
    this.world.load(info.map);
    this.solids = solidsOf(this.world.id);
    this.local.traction = this.world.map.traction ?? 1;
    this.local.gravity = this.world.map.gravity ?? 1;
    this.local.pads = this.world.map.pads ?? [];
    this.local.onPad = () => this.sfx.boing();
    this.active = true;
    this.input.gameActive = true;
    this.myId = myId;
    this.mode = info.mode ?? "tdm";
    this.ff = !!info.ff; // takım ateşi
    this.minimap.setMap(this.world.map);
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
    // Geri sayım sırasında shader'ları derle (maç ortasında ilk atış / ilk patlama takılmasın)
    if (!this.warmed) {
      this.warmed = true;
      this.effects.warmup(this.view.renderer, this.camera);
      this.weapon.warmup(this.view.renderer);
    }
  }

  stop() {
    this.active = false;
    this.input.gameActive = false;
    for (const r of this.remotes.values()) this.removeRemote(r);
    this.remotes.clear();
    for (const g of this.grenades.values()) this.scene.remove(g.mesh);
    this.grenades.clear();
    this.clearDecoys();
    this.effects.clear();
    this.trajectory.hide();
    this.flags.setup(null);
    this.drops.clear();
    this.marks.clear();
    this.ropes.clear();
    this.local.hook = null;
    this.frozenUntil = 0;
    this.blind = null;
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
        r.body3 = this.physics.addPlayerBody(); // çarpışma kapsülü
        this.remotes.set(p.id, r);
      } else r.setInfo(p);
      r.setFriendly(!isSolo(this.mode) && p.team === this.team);
    }
    for (const [id, r] of this.remotes) {
      if (!this.roster.has(id)) {
        this.removeRemote(r);
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
    // Sapma, ateşten ÖNCEKİ duruma göre hesaplanmalı: AWP ateş edince dürbün kapanıyor,
    // sonra hesaplanınca dürbünlü atış dürbünsüz sapmayla gidiyordu.
    const spread = this.spread();
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

    if (w.SPRAY) return this.fireSpray(w);

    this.sfx[w.ROCKET ? "rocket" : SHOT_SOUND[w.id] ?? "shot"](1);
    const l = this.local;
    const rk = this.weapon.aiming ? 0.7 : 1;
    const recoil = () => {
      l.pitch += w.RECOIL * rk * (0.6 + Math.random() * 0.4);
      l.yaw += (Math.random() - 0.5) * w.RECOIL * 0.6 * rk;
      l.clampPitch();
    };

    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * spread;
    _dir
      .copy(_fwd)
      .addScaledVector(_right, Math.cos(a) * r)
      .addScaledVector(_up, Math.sin(a) * r)
      .normalize();

    if (w.ROCKET) {
      // Roketi sunucu oluşturur ve herkese (bize de) yollar
      this.net.emit(MSG.SHOOT, { d: [r3(_dir.x), r3(_dir.y), r3(_dir.z)] });
      return recoil();
    }
    if (w.PELLETS) {
      // Pompalı: saçma yönlerini biz üretip yollarız; sunucu kontrol eder
      const ds = [];
      const base = _dir.clone();
      const right = new THREE.Vector3().crossVectors(base, _yAxis);
      if (right.lengthSq() < 1e-4) right.copy(_right); // tam yukarı / aşağı bakarken
      right.normalize();
      const up = new THREE.Vector3().crossVectors(right, base).normalize();
      for (let i = 0; i < w.PELLETS; i++) {
        const pa = Math.random() * Math.PI * 2;
        const pr = Math.sqrt(Math.random()) * w.PELLET_SPREAD;
        _dir.copy(base).addScaledVector(right, Math.cos(pa) * pr).addScaledVector(up, Math.sin(pa) * pr).normalize();
        ds.push([r3(_dir.x), r3(_dir.y), r3(_dir.z)]);
        this.shotVisual(w, i < 5);
      }
      this.net.emit(MSG.SHOOT, { d: [r3(base.x), r3(base.y), r3(base.z)], ds });
      return recoil();
    }
    this.shotVisual(w, true);
    this.net.emit(MSG.SHOOT, { d: [r3(_dir.x), r3(_dir.y), r3(_dir.z)] });
    recoil();
  }

  /** Alev / dondurucu: parçacık demeti (kimin etkilendiğini sunucu hesaplar) */
  fireSpray(w) {
    const hit = this.physics.raycast(_eye, _fwd, w.RANGE, this.local.collider);
    _from
      .copy(_eye)
      .addScaledVector(_right, 0.16 * this.weapon.side)
      .addScaledVector(_up, -0.15)
      .addScaledVector(_fwd, 0.55);
    this.effects.stream(_from, _fwd, hit ? hit.distance : w.RANGE, w.SPRAY === "ice");
    this.spraySound(w.id, 0.8);
    this.local.pitch += w.RECOIL * Math.random();
    this.local.clampPitch();
    this.net.emit(MSG.SHOOT, { d: [r3(_fwd.x), r3(_fwd.y), r3(_fwd.z)] });
  }

  /** Yerel atış görseli (_dir yönünde): duvar isabeti + iz. Oyuncu isabetini sunucu söyler. */
  shotVisual(w, tracer) {
    // Yerel görsel: duvar isabeti (oyuncu isabetini sunucu söyler)
    const hit = this.physics.raycast(_eye, _dir, w.RANGE, this.local.collider);
    let dist = hit ? hit.distance : w.RANGE;
    this.raycaster.set(_eye, _dir);
    this.raycaster.far = dist;
    const targets = [];
    for (const rp of this.remotes.values())
      if (rp.alive && rp.visible && (this.ff || this.isEnemy(rp))) targets.push(rp.body); // takım ateşinde arkadaşlar da
    for (const rp of this.decoys.values())
      if (rp.owner !== this.myId && (this.ff || this.isEnemy(rp))) targets.push(rp.body);
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
    if (tracer) this.effects.tracer(_from, _end);
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

  switchWeapon(id, now, quick = false) {
    if (this.weapon.switchTo(id, now, quick)) {
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
      this.sfx.reload(); // başlangıç sesi; şarjör çıkma/takılma sesleri animasyondan gelir
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
    // Q: son seçilen iki silah arasında hızlı geçiş (daha kısa çekme süresiyle)
    if (input.pressed("KeyQ")) {
      const target = wp.quickSwitchTarget;
      if (target) this.switchWeapon(target, now, true);
    }
    if (input.wheel) this.switchWeapon(wp.cycle(input.wheel > 0 ? 1 : -1), now);
    if (this.switchBackAt && now >= this.switchBackAt) {
      this.switchBackAt = 0;
      const back = wp.quickSwitchTarget ?? wp.loadout.primary;
      this.switchWeapon(back, now);
    }

    if (input.pressed("KeyF")) this.throwHook(now);
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
    const frozen = this.alive && performance.now() < this.frozenUntil;
    const controls = input.locked && this.alive && playing && !this.chatting && !frozen;
    if (frozen) this.local.velocity.x = this.local.velocity.z = 0;

    this.updateTrain();

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
    if (input.locked && this.state !== "ended" && this.mode !== "gun" && input.pressed("KeyB"))
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
    const train = this.world.map.train;
    const carry =
      train && ((p, at) => trainCarry(train, [p.x, p.y, p.z], at, this.serverNow));
    for (const r of this.remotes.values()) r.update(renderT, dt, carry);
    for (const r of this.decoys.values()) r.update(renderT, dt);
    this.updateBodies();
    this.flags.update(
      dt,
      (id) => this.remotes.get(id)?.root ?? null,
      this.myId,
    );
    this.drops.update(dt);
    this.marks.update(this.camera);
    this.ropes.update();
    this.effects.update(dt);
    this.updateHud(now);
    this.minimap.update(now, this);
  }

  removeRemote(r) {
    this.ropes.remove(r.id);
    if (r.body3) this.physics.removeBody(r.body3);
    r.body3 = null;
    r.dispose();
  }

  /**
   * Diğer oyuncuların çarpışma kapsüllerini ekrandaki konumlarına taşı. Yerel oyuncuyla zaten iç içe
   * olan (ör. aynı anda doğdular) kapsül o an kapatılır ki ayrılabilsinler; sonra yine katı olur.
   */
  updateBodies() {
    const me = this.local.position;
    const R2 = PLAYER.RADIUS * 2 - 0.02;
    const myTop = me.y + (this.local.crouching ? PLAYER.CROUCH_HEIGHT : PLAYER.HEIGHT);
    for (const r of this.remotes.values()) {
      const c = r.body3;
      if (!c) continue;
      const on = r.alive && r.root.visible && this.alive;
      if (!on) {
        if (c.isEnabled()) c.setEnabled(false);
        continue;
      }
      const p = r.root.position;
      const crouch = r.crouch > 0.5;
      const h = crouch ? PLAYER.CROUCH_HEIGHT : PLAYER.HEIGHT;
      const overlap =
        Math.hypot(p.x - me.x, p.z - me.z) < R2 && p.y < myTop && p.y + h > me.y;
      if (overlap) {
        if (c.isEnabled()) c.setEnabled(false);
        continue;
      }
      if (crouch !== c.userCrouch) {
        c.userCrouch = crouch;
        c.setHalfHeight(h / 2 - PLAYER.RADIUS);
      }
      c.setTranslation({ x: p.x, y: p.y + h / 2, z: p.z });
      if (!c.isEnabled()) c.setEnabled(true);
    }
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
      this.liveSolids,
      !!this.chargeStart,
    );
  }

  /** Sunucuyla aynı sabit adımlı fizikle bombaları ilerlet */
  updateGrenades(now) {
    const solids = this.liveSolids;
    for (const [gid, g] of this.grenades) {
      const target = Math.floor((now - g.born) / 1000 / (1 / 60));
      let n = 0;
      while (g.steps < target && n++ < 600) {
        g.steps++;
        if (g.rocket) {
          stepRocket(g.sim, solids);
          continue;
        }
        stepGrenade(g.sim, g.mine ? this.solids : solids);
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
      if (g.rocket) {
        // Roket arkasında duman izi bırakır
        if (g.sim.v[0] || g.sim.v[1] || g.sim.v[2]) this.effects.trail(g.mesh.position);
      } else if (g.mine) {
        // Mayın yere düz oturur; kurulduktan sonra lamba yanıp söner
        g.mesh.position.y -= 0.05;
        const armed = now - g.born > WEAPONS.mine.ARM;
        g.lamp.material = armed && Math.floor(now / 450) % 2 === 0 ? MINE_LAMP_ON : MINE_LAMP_OFF;
      } else g.mesh.rotation.x += Math.hypot(g.sim.v[0], g.sim.v[2]) * 0.05;
      // Sunucudan BOOM gelmezse (kopma vb.) temizle
      if (now - g.born > (g.mine ? WEAPONS.mine.LIFETIME + 3000 : g.rocket ? WEAPONS.bazooka.LIFETIME + 1000 : 6000)) {
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
        const m = Math.min(1, (this.deathT - 0.55) / 1.1);
        const ease = m * m * (3 - 2 * m);
        // Katilin omzunun arkasına uç ve onu takip et (araya duvar girerse yaklaş)
        const yaw = killer.root.rotation.y;
        _tmp.copy(killer.root.position);
        _tmp.y += 1.5;
        _dir.set(Math.sin(yaw) * 3 + Math.cos(yaw) * 0.7, 0.9, Math.cos(yaw) * 3 - Math.sin(yaw) * 0.7);
        let back = _dir.length();
        _dir.divideScalar(back);
        const wall = this.physics.raycast(_tmp, _dir, back, this.local.collider);
        if (wall) back = Math.max(0.4, wall.distance - 0.25);
        _end.copy(_tmp).addScaledVector(_dir, back);
        cam.position.lerp(_end, ease);
        // Katilin baktığı yöne doğru: ne gördüğü anlaşılsın
        _tmp.x -= Math.sin(yaw) * 2 * ease;
        _tmp.z -= Math.cos(yaw) * 2 * ease;
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
    if (this.mode === "gun") {
      const level = (id) => this.stats.get(id)?.lv ?? 0;
      let lead = null;
      for (const p of this.roster.values()) {
        if (p.id === this.myId) continue;
        if (!lead || level(p.id) > lead.lv) lead = { name: p.name, lv: level(p.id) };
      }
      const next = GUN_LADDER[level(this.myId) + 1];
      hud.setGunScores(level(this.myId) + 1, (lead?.lv ?? 0) + 1, lead?.name ?? "-", GUN_LADDER.length, next ? WEAPONS[next].NAME : "ZAFER");
    } else if (this.mode === "ffa") {
      // Herkes Tek: solda benim puanım, sağda en yüksek puanlı rakip
      const score = (id) => {
        const st = this.stats.get(id);
        return st
          ? playerScore({ kills: st.k, assists: st.a, deaths: st.d, revenges: st.rv })
          : 0;
      };
      let lead = null;
      for (const p of this.roster.values()) {
        if (p.id === this.myId) continue;
        const sc = score(p.id);
        if (!lead || sc > lead.sc) lead = { name: p.name, sc };
      }
      hud.setFfaScores(score(this.myId), lead?.sc ?? 0, lead?.name ?? "-", this.scoreLimit);
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
    const b = this.blind;
    // Flaş: önce tam beyaz, sürenin son yarısında yavaşça açılır
    hud.setBlind(this.alive && b && now < b.until ? b.k * Math.min(1, (b.until - now) / (b.ms * 0.55)) : 0);
    hud.setFrozen(this.alive && now < this.frozenUntil ? Math.ceil((this.frozenUntil - now) / 1000) : null);
    hud.setHook(this.alive && this.state !== "ended" ? Math.max(0, Math.ceil((this.nextHook - now) / 1000)) : null);
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
        this.deathInfo,
      );
    } else hud.respawn(null);

    const showBoard = this.input.down("Tab") && this.state !== "ended";
    if (showBoard) {
      const rows = [...this.roster.values()].map((p) => {
        const s = this.stats.get(p.id) ?? { k: 0, d: 0, a: 0, rtt: 0 };
        return {
          id: p.id,
          name: p.name,
          team: p.team,
          k: s.k,
          a: s.a,
          d: s.d,
          score:
            this.mode === "gun"
              ? (s.lv ?? 0) + 1
              : playerScore({
                  kills: s.k,
                  assists: s.a,
                  deaths: s.d,
                  revenges: s.rv,
                }),
          nemesis: this.nemeses.has(p.id),
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
