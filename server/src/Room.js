import {
  PLAYER, WEAPON, MATCH, SERVER_TICK_RATE, MAX_PLAYERS, MAX_PER_TEAM, MIN_PLAYERS_TO_START, INTERP_DELAY, TEAMS,
} from '@comic-strike/shared/constants.js';
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

  addPlayer(socket, name) {
    const team = this.teamCount('red') <= this.teamCount('blue') ? 'red' : 'blue';
    const p = new Player(socket, name, team);
    this.players.set(p.id, p);
    if (!this.hostId) this.hostId = p.id;
    socket.join(this.code);
    socket.data.room = this;
    console.log(`[room ${this.code}] ${name} katıldı (${team})`);
    this.broadcastRoom();
    if (this.inMatch) {
      socket.emit(MSG.MATCH_START, this.matchInfo());
      this.spawn(p);
    }
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    p.socket.leave(this.code);
    this.players.delete(id);
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
    p.ammo = WEAPON.MAG_SIZE;
    p.reloadUntil = 0;
    p.respawnAt = 0;
    p.protectedUntil = now + PLAYER.SPAWN_PROTECTION;
    p.history.length = 0;
    p.lastInput = now;
    p.record(now);
    this.emit(MSG.RESPAWN, { id: p.id, p: p.pos, yaw: p.yaw, life: p.life, ammo: p.ammo });
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
    if (!p || !p.alive || p.reloadUntil || p.ammo >= WEAPON.MAG_SIZE) return;
    p.reloadUntil = Date.now() + WEAPON.RELOAD_TIME;
  }

  onShoot(id, d) {
    const p = this.players.get(id);
    if (!p || !p.alive || this.state !== 'playing' || !d || !Array.isArray(d.d) || d.d.length !== 3 || !d.d.every(isNum)) return;
    const now = Date.now();
    if (p.reloadUntil || p.ammo <= 0) return;
    if (now - p.lastShot < WEAPON.FIRE_INTERVAL * 0.8) return; // ateş hızı kontrolü

    const len = Math.hypot(d.d[0], d.d[1], d.d[2]);
    if (len < 0.5) return;
    const dir = [d.d[0] / len, d.d[1] / len, d.d[2] / len];

    p.lastShot = now;
    p.ammo--;
    p.protectedUntil = 0; // ateş eden spawn korumasını kaybeder

    // Lag compensation: hedefleri, atış yapanın gördüğü ana geri sar
    const rewind = now - Math.min(p.rtt + INTERP_DELAY, 400);
    const origin = [p.pos[0], p.pos[1] + PLAYER.EYE, p.pos[2]];
    const targets = [];
    for (const o of this.players.values()) {
      if (o !== p && o.alive && o.team !== p.team) targets.push({ player: o, pos: o.posAt(rewind) });
    }
    const hit = castShot(origin, dir, SOLIDS, targets, WEAPON.RANGE);
    const end = hit.point.map(r2);

    p.socket.to(this.code).emit(MSG.SHOT, { id: p.id, o: origin.map(r2), e: end });
    if (hit.player) this.applyDamage(p, hit.player, hit.head, end, now);
  }

  applyDamage(attacker, victim, head, point, now) {
    if (now < victim.protectedUntil) return;
    const dmg = WEAPON.DAMAGE * (head ? WEAPON.HEADSHOT_MULT : 1);
    victim.hp = Math.max(0, victim.hp - dmg);
    const killed = victim.hp <= 0;
    attacker.socket.emit(MSG.HIT, { v: victim.id, d: dmg, h: head, k: killed, pt: point });
    victim.socket.emit(MSG.DAMAGED, { hp: victim.hp, from: attacker.pos });
    if (!killed) return;

    victim.alive = false;
    victim.deaths++;
    victim.respawnAt = now + PLAYER.RESPAWN_TIME;
    attacker.kills++;
    this.scores[attacker.team]++;
    this.emit(MSG.KILL, { k: attacker.id, v: victim.id, h: head, s: this.scores });
    if (this.scores[attacker.team] >= MATCH.SCORE_LIMIT) this.endMatch();
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
        p.ammo = WEAPON.MAG_SIZE;
        p.socket.emit(MSG.AMMO, { ammo: p.ammo });
      }
      if (!p.alive && this.state === 'playing' && (p.respawnAt === 0 || now >= p.respawnAt)) this.spawn(p);
    }

    if (this.state === 'playing' && now >= this.matchEnd) return this.endMatch();

    this.emit(MSG.SNAPSHOT, {
      t: now,
      st: this.state,
      tl: Math.min(MATCH.TIME_LIMIT, Math.max(0, this.matchEnd - now)),
      cd: Math.max(0, this.countdownEnd - now),
      s: [this.scores.red, this.scores.blue],
      p: [...this.players.values()].map((p) => [
        p.id, r2(p.pos[0]), r2(p.pos[1]), r2(p.pos[2]), r3(p.yaw), r3(p.pitch),
        p.hp, p.alive ? 1 : 0, p.flags, p.rtt, p.kills, p.deaths,
      ]),
    });
  }

  endMatch() {
    if (this.state === 'ended') return;
    this.state = 'ended';
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
