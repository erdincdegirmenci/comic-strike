import {
  PLAYER, WEAPONS, WEAPON_ORDER, GRENADE, SPRAY, MATCH, SERVER_TICK_RATE, MAX_PLAYERS, MAX_PER_TEAM, MIN_PLAYERS_TO_START, INTERP_DELAY, TEAMS,
} from '@comic-strike/shared/constants.js';
import { stepGrenade, throwVelocity } from '@comic-strike/shared/grenade.js';
import { MSG } from '@comic-strike/shared/protocol.js';
import { CITY_ARENA } from '@comic-strike/shared/map.js';
import { Player } from './Player.js';
import { castShot } from './HitScan.js';

const SOLIDS = CITY_ARENA.boxes.filter((b) => b.solid);
const BOUNDS = CITY_ARENA.bounds;
const MIN_PLAYERS = Number(process.env.MIN_PLAYERS) || MIN_PLAYERS_TO_START;

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const norm = (v) => {
  const len = Math.hypot(v[0], v[1], v[2]);
  return len < 0.5 ? null : [v[0] / len, v[1] / len, v[2] / len];
};

/**
 * Bir oda = bir lobi + bir maç.
 * Durumlar: lobby → countdown → playing → ended → lobby
 * Hasar, ölüm, skor ve atış doğrulaması burada yapılır (server authoritative).
 */
export class Room {
  constructor(code, io, isPublic, onEmpty) {
    this.code = code;
    this.io = io;
    this.isPublic = isPublic;
    this.onEmpty = onEmpty;
    this.players = new Map();
    this.hostId = null;
    this.state = 'lobby';
    this.scores = { red: 0, blue: 0 };
    this.countdownEnd = 0;
    this.matchEnd = 0;
    this.lastPing = 0;
    this.endTimer = null;
    this.grenades = [];
    this.nextGid = 1;
    this.sprays = new Map(); // oyuncu id -> son sticker (sonradan katilanlar da gorsun)
    this.timer = setInterval(() => this.tick(), 1000 / SERVER_TICK_RATE);
  }

  get size() {
    return this.players.size;
  }

  get inMatch() {
    return this.state === 'countdown' || this.state === 'playing';
  }

  teamCount(team) {
    let n = 0;
    for (const p of this.players.values()) if (p.team === team) n++;
    return n;
  }

  canJoin() {
    return this.size < MAX_PLAYERS;
  }

  emit(event, data) {
    this.io.to(this.code).emit(event, data);
  }

  // ---------------- Üyelik ----------------

  addPlayer(socket, name, char) {
    const team = this.teamCount('red') <= this.teamCount('blue') ? 'red' : 'blue';
    const p = new Player(socket, name, team, char);
    this.players.set(p.id, p);
    if (!this.hostId) this.hostId = p.id;
    socket.join(this.code);
    socket.data.room = this;
    console.log(`[room ${this.code}] ${name} katıldı (${team})`);
    this.broadcastRoom();
    if (this.inMatch) {
      socket.emit(MSG.MATCH_START, this.matchInfo());
      for (const s of this.sprays.values()) socket.emit(MSG.SPRAYED, s);
      this.spawn(p);
    }
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    p.socket.leave(this.code);
    this.players.delete(id);
    this.sprays.delete(id);
    console.log(`[room ${this.code}] ${p.name} ayrıldı`);
    if (this.size === 0) return this.destroy();
    if (this.hostId === id) this.hostId = this.players.keys().next().value;
    this.broadcastRoom();
  }

  destroy() {
    clearInterval(this.timer);
    clearTimeout(this.endTimer);
    this.onEmpty();
  }

  roomInfo() {
    return {
      code: this.code,
      hostId: this.hostId,
      state: this.state,
      isPublic: this.isPublic,
      scores: this.scores,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      maxPerTeam: MAX_PER_TEAM,
      players: [...this.players.values()].map((p) => p.info()),
    };
  }

  broadcastRoom() {
    this.emit(MSG.ROOM_STATE, this.roomInfo());
  }

  matchInfo() {
    const now = Date.now();
    return {
      roster: [...this.players.values()].map((p) => p.info()),
      scores: this.scores,
      scoreLimit: MATCH.SCORE_LIMIT,
      timeLeft: Math.min(MATCH.TIME_LIMIT, Math.max(0, this.matchEnd - now)),
      countdown: Math.max(0, this.countdownEnd - now),
    };
  }

  notice(p, text) {
    p?.socket.emit(MSG.NOTICE, text);
  }

  // ---------------- Lobi ----------------

  onSetTeam(id, team) {
    const p = this.players.get(id);
    if (!p || this.state !== 'lobby' || !TEAMS.includes(team) || p.team === team) return;
    if (this.teamCount(team) >= MAX_PER_TEAM) return this.notice(p, 'Bu takım dolu.');
    p.team = team;
    p.ready = false;
    this.broadcastRoom();
  }

  onSetReady(id, ready) {
    const p = this.players.get(id);
    if (!p || this.state !== 'lobby') return;
    p.ready = !!ready;
    this.broadcastRoom();
  }

  onStartMatch(id) {
    const host = this.players.get(id);
    if (!host || id !== this.hostId || this.state !== 'lobby') return;
    const list = [...this.players.values()];
    if (list.length < MIN_PLAYERS) return this.notice(host, `En az ${MIN_PLAYERS} oyuncu gerekli.`);
    if (list.some((p) => p.id !== this.hostId && !p.ready)) return this.notice(host, 'Herkes hazır değil.');
    this.startMatch();
  }

  startMatch() {
    const now = Date.now();
    this.state = 'countdown';
    this.countdownEnd = now + MATCH.COUNTDOWN;
    this.matchEnd = this.countdownEnd + MATCH.TIME_LIMIT;
    this.scores = { red: 0, blue: 0 };
    this.grenades.length = 0;
    this.sprays.clear();
    for (const p of this.players.values()) p.resetStats();
    console.log(`[room ${this.code}] maç başladı (${this.size} oyuncu)`);
    this.emit(MSG.MATCH_START, this.matchInfo());
    const index = { red: 0, blue: 0 };
    for (const p of this.players.values()) this.spawn(p, index[p.team]++);
    this.broadcastRoom();
  }

  // ---------------- Doğma ----------------

  pickSpawn(p) {
    const points = CITY_ARENA.spawns[p.team];
    const enemies = [...this.players.values()].filter((o) => o.alive && o.team !== p.team);
    if (enemies.length === 0) return points[Math.floor(Math.random() * points.length)];
    let best = points[0];
    let bestScore = -1;
    for (const sp of points) {
      let nearest = Infinity;
      for (const e of enemies) nearest = Math.min(nearest, Math.hypot(e.pos[0] - sp[0], e.pos[2] - sp[2]));
      const score = nearest + Math.random() * 4;
      if (score > bestScore) {
        bestScore = score;
        best = sp;
      }
    }
    return best;
  }

  spawn(p, index) {
    const now = Date.now();
    const points = CITY_ARENA.spawns[p.team];
    const sp = index !== undefined ? points[index % points.length] : this.pickSpawn(p);
    p.pos = [sp[0], sp[1], sp[2]];
    p.yaw = sp[3];
    p.pitch = 0;
    p.hp = PLAYER.MAX_HP;
    p.alive = true;
    p.life++;
    p.resetLoadout();
    p.respawnAt = 0;
    p.protectedUntil = now + PLAYER.SPAWN_PROTECTION;
    p.history.length = 0;
    p.lastInput = now;
    p.record(now);
    this.emit(MSG.RESPAWN, { id: p.id, p: p.pos, yaw: p.yaw, life: p.life, ammo: p.ammo, nades: p.nades });
  }

  // ---------------- Oyun içi girdiler ----------------

  onInput(id, d) {
    const p = this.players.get(id);
    if (!p || !p.alive || !this.inMatch || !d || d.l !== p.life) return;
    if (!Array.isArray(d.p) || d.p.length !== 3 || !d.p.every(isNum) || !isNum(d.y) || !isNum(d.pi)) return;

    p.yaw = d.y;
    p.pitch = Math.max(-1.6, Math.min(1.6, d.pi));
    p.flags = d.f | 0;
    if (this.state !== 'playing') return; // geri sayımda sadece bakış açısı

    const now = Date.now();
    const dt = Math.min(Math.max(now - p.lastInput, 16), 500) / 1000;
    const [x, y, z] = d.p;
    const horiz = Math.hypot(x - p.pos[0], z - p.pos[2]);
    const up = y - p.pos[1];
    const maxHoriz = PLAYER.RUN_SPEED * 1.35 * dt + 0.35;
    const maxUp = PLAYER.JUMP_VELOCITY * 1.3 * dt + 0.5;
    const outside = Math.abs(x) > BOUNDS.x + 0.5 || Math.abs(z) > BOUNDS.z + 0.5 || y < BOUNDS.minY || y > BOUNDS.maxY;

    p.lastInput = now;
    if (horiz > maxHoriz || up > maxUp || outside) {
      // Şüpheli hareket: sunucudaki son geçerli konuma geri çek
      p.socket.emit(MSG.CORRECTION, { p: p.pos, l: p.life });
      return;
    }
    p.pos = [x, y, z];
    p.record(now);
  }

  onReload(id) {
    const p = this.players.get(id);
    if (!p || !p.alive || p.reloadUntil) return;
    const w = WEAPONS[p.weapon];
    if (w.kind !== 'gun' || p.ammo[w.id] >= w.MAG_SIZE) return;
    p.reloadUntil = Date.now() + w.RELOAD_TIME;
  }

  onSwitch(id, w) {
    const p = this.players.get(id);
    if (!p || typeof w !== 'string' || !WEAPONS[w] || p.weapon === w) return;
    p.weapon = w;
    p.reloadUntil = 0; // silah değişince şarjör değiştirme iptal
  }

  onShoot(id, d) {
    const p = this.players.get(id);
    if (!p || !p.alive || this.state !== 'playing' || !d || !isVec(d.d)) return;
    const w = WEAPONS[p.weapon];
    if (w.kind === 'grenade') return;
    const now = Date.now();
    const heavy = w.kind === 'melee' && d.h === 1;
    if (now < p.lastShot) return; // ateş hızı kontrolü (lastShot = bir sonraki izinli an)
    const dir = norm(d.d);
    if (!dir) return;
    if (w.kind === 'gun') {
      if (p.reloadUntil || p.ammo[w.id] <= 0) return;
      p.ammo[w.id]--;
    }

    p.lastShot = now + (heavy ? w.HEAVY_INTERVAL : w.FIRE_INTERVAL) * 0.8;
    p.protectedUntil = 0; // ateş eden spawn korumasını kaybeder

    // Lag compensation: hedefleri, atış yapanın gördüğü ana geri sar
    const rewind = now - Math.min(p.rtt + INTERP_DELAY, 400);
    const origin = [p.pos[0], p.pos[1] + p.eyeHeight, p.pos[2]];
    const targets = [];
    for (const o of this.players.values()) {
      if (o !== p && o.alive && o.team !== p.team) {
        const past = o.posAt(rewind);
        targets.push({ player: o, pos: past.pos, crouch: past.crouch });
      }
    }
    const hit = castShot(origin, dir, SOLIDS, targets, w.RANGE);
    const end = hit.point.map(r2);

    p.socket.to(this.code).emit(MSG.SHOT, { id: p.id, o: origin.map(r2), e: end, w: w.id });
    if (!hit.player) return;
    const base = heavy ? w.HEAVY_DAMAGE : w.DAMAGE;
    const dmg = Math.round(base * (hit.head ? w.HEADSHOT_MULT : 1));
    this.applyDamage(p, hit.player, hit.head, end, now, dmg, w.id);
  }

  onThrow(id, d) {
    const p = this.players.get(id);
    if (!p || !p.alive || this.state !== 'playing' || !d || !isVec(d.d)) return;
    const w = WEAPONS[p.weapon];
    const now = Date.now();
    if (w.kind !== 'grenade' || p.nades[w.id] <= 0 || now < p.lastShot) return;
    const dir = norm(d.d);
    if (!dir) return;
    p.nades[w.id]--;
    p.lastShot = now + w.FIRE_INTERVAL * 0.8;
    p.protectedUntil = 0;

    const eye = [p.pos[0], p.pos[1] + p.eyeHeight, p.pos[2]];
    // Elden biraz ileride başlasın; duvarın dibindeysen gözden başla
    const wall = castShot(eye, dir, SOLIDS, [], 0.6);
    const ahead = Math.max(0, Math.min(0.5, wall.distance - 0.15));
    const o = [eye[0] + dir[0] * ahead, eye[1] + dir[1] * ahead - 0.1, eye[2] + dir[2] * ahead].map(r2);
    const v = throwVelocity(dir).map(r2);
    const g = { g: this.nextGid++, t: w.id, by: p, sim: { p: [...o], v: [...v] }, born: now, steps: 0 };
    this.grenades.push(g);
    this.emit(MSG.GRENADE, { g: g.g, t: g.t, id: p.id, o, v });
  }

  onSpray(id, d) {
    const p = this.players.get(id);
    if (!p || !p.alive || !this.inMatch || !d || !isVec(d.p) || !isVec(d.n)) return;
    const now = Date.now();
    if (now - p.lastSpray < SPRAY.COOLDOWN * 0.8) return;
    const n = norm(d.n);
    if (!n) return;
    const eye = [p.pos[0], p.pos[1] + p.eyeHeight, p.pos[2]];
    if (Math.hypot(d.p[0] - eye[0], d.p[1] - eye[1], d.p[2] - eye[2]) > SPRAY.RANGE + 1.5) return;
    p.lastSpray = now;
    const s = { id: p.id, c: p.char, p: d.p.map(r3), n: n.map(r3) };
    this.sprays.set(p.id, s);
    this.emit(MSG.SPRAYED, s);
  }

  updateGrenades(now) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      const target = Math.floor((now - g.born) / 1000 / GRENADE.STEP);
      while (g.steps < target) {
        stepGrenade(g.sim, SOLIDS);
        g.steps++;
      }
      if (now - g.born < WEAPONS[g.t].FUSE) continue;
      this.grenades.splice(i, 1);
      this.explode(g, now);
      if (this.state === 'ended') return;
    }
  }

  explode(g, now) {
    const at = g.sim.p.map(r2);
    this.emit(MSG.BOOM, { g: g.g, t: g.t, p: at });
    if (g.t !== 'he' || this.state !== 'playing') return;
    const w = WEAPONS.he;
    const attacker = g.by;
    if (!this.players.has(attacker.id)) return; // atan oyuncu odadan çıktı
    const center = [at[0], at[1] + 0.2, at[2]];
    for (const v of this.players.values()) {
      if (!v.alive || (v !== attacker && v.team === attacker.team)) continue;
      const chest = [v.pos[0], v.pos[1] + (v.crouching ? 0.6 : 0.95), v.pos[2]];
      const dx = chest[0] - center[0];
      const dy = chest[1] - center[1];
      const dz = chest[2] - center[2];
      const dist = Math.hypot(dx, dy, dz);
      if (dist >= w.RADIUS) continue;
      // Duvar arkasındakiler etkilenmez
      if (dist > 0.05) {
        const los = castShot(center, [dx / dist, dy / dist, dz / dist], SOLIDS, [], dist);
        if (los.distance < dist - 0.05) continue;
      }
      const dmg = Math.round(w.DAMAGE * (1 - dist / w.RADIUS));
      if (dmg > 0) this.applyDamage(attacker, v, false, chest.map(r2), now, dmg, 'he', at);
      if (this.state === 'ended') return;
    }
  }

  applyDamage(attacker, victim, head, point, now, dmg, weapon, from = attacker.pos) {
    if (now < victim.protectedUntil) return;
    victim.hp = Math.max(0, victim.hp - dmg);
    const killed = victim.hp <= 0;
    const self = attacker === victim;
    if (!self) attacker.socket.emit(MSG.HIT, { v: victim.id, d: dmg, h: head, k: killed, pt: point });
    victim.socket.emit(MSG.DAMAGED, { hp: victim.hp, from });
    if (!killed) return;

    victim.alive = false;
    victim.deaths++;
    victim.respawnAt = now + PLAYER.RESPAWN_TIME;
    if (!self) {
      attacker.kills++;
      this.scores[attacker.team]++;
    }
    this.emit(MSG.KILL, { k: attacker.id, v: victim.id, h: head, w: weapon, s: this.scores });
    if (!self && this.scores[attacker.team] >= MATCH.SCORE_LIMIT) this.endMatch();
  }

  // ---------------- Döngü ----------------

  tick() {
    const now = Date.now();

    if (now - this.lastPing > 2000) {
      this.lastPing = now;
      for (const p of this.players.values()) {
        const sent = Date.now();
        p.socket.timeout(2000).emit(MSG.SPING, (err) => {
          if (!err) p.rtt = Math.min(500, Date.now() - sent);
        });
      }
    }

    if (!this.inMatch) return;
    if (this.state === 'countdown' && now >= this.countdownEnd) this.state = 'playing';

    for (const p of this.players.values()) {
      if (p.reloadUntil && now >= p.reloadUntil) {
        p.reloadUntil = 0;
        const w = WEAPONS[p.weapon];
        if (w.kind === 'gun') {
          p.ammo[w.id] = w.MAG_SIZE;
          p.socket.emit(MSG.AMMO, { w: w.id, ammo: p.ammo[w.id] });
        }
      }
      if (!p.alive && this.state === 'playing' && (p.respawnAt === 0 || now >= p.respawnAt)) this.spawn(p);
    }

    this.updateGrenades(now);
    if (this.state === 'ended') return; // bomba maçı bitirmiş olabilir
    if (this.state === 'playing' && now >= this.matchEnd) return this.endMatch();

    this.emit(MSG.SNAPSHOT, {
      t: now,
      st: this.state,
      tl: Math.min(MATCH.TIME_LIMIT, Math.max(0, this.matchEnd - now)),
      cd: Math.max(0, this.countdownEnd - now),
      s: [this.scores.red, this.scores.blue],
      p: [...this.players.values()].map((p) => [
        p.id, r2(p.pos[0]), r2(p.pos[1]), r2(p.pos[2]), r3(p.yaw), r3(p.pitch),
        p.hp, p.alive ? 1 : 0, p.flags, p.rtt, p.kills, p.deaths, WEAPON_ORDER.indexOf(p.weapon),
      ]),
    });
  }

  endMatch() {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.grenades.length = 0;
    const { red, blue } = this.scores;
    const winner = red > blue ? 'red' : blue > red ? 'blue' : 'draw';
    console.log(`[room ${this.code}] maç bitti: ${winner} (${red}-${blue})`);
    this.emit(MSG.MATCH_END, { winner, scores: this.scores, players: [...this.players.values()].map((p) => p.info()) });
    for (const p of this.players.values()) {
      p.alive = false;
      p.ready = false;
    }
    this.broadcastRoom();
    this.endTimer = setTimeout(() => {
      this.state = 'lobby';
      this.broadcastRoom();
    }, MATCH.END_SCREEN);
  }
}
