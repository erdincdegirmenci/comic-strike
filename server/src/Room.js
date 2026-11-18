import {
  PLAYER, FLAG, FALL, CTF, FFA, PAD, isEnemy, DROP, MARK, CHARACTER_IDS, MODE_IDS, DEFAULT_MODE, FLAG_STATE, WEAPONS, WEAPON_ORDER, GRENADE, SPRAY, BUY_TIME, cleanLoadout, MATCH, SERVER_TICK_RATE, MAX_PLAYERS, MAX_PER_TEAM, MIN_PLAYERS_TO_START, INTERP_DELAY, TEAMS,
} from '@comic-strike/shared/constants.js';
import { stepGrenade, throwVelocity } from '@comic-strike/shared/grenade.js';
import { MSG } from '@comic-strike/shared/protocol.js';
import { MAPS, MAP_IDS, DEFAULT_MAP, solidsOf, flagBases } from '@comic-strike/shared/maps.js';
import { Player } from './Player.js';
import { castShot } from './HitScan.js';
import { BotSocket, BotBrain, botName } from './Bot.js';

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
    this.clouds = []; // aktif zehir bulutları
    this.drops = new Map(); // yerdeki mermi kutuları: id -> {id, p, until}
    this.nextDropId = 1;
    this.botSeq = 0;
    this.nextGid = 1;
    this.mapId = DEFAULT_MAP;
    this.mode = DEFAULT_MODE;
    this.flags = null; // CTF: { red: {state, pos, carrier, droppedAt}, blue: {...} }
    this.sprays = new Map(); // oyuncu id -> son sticker (sonradan katilanlar da gorsun)
    this.timer = setInterval(() => this.tick(), 1000 / SERVER_TICK_RATE);
  }

  get size() {
    return this.players.size;
  }

  get map() {
    return MAPS[this.mapId];
  }

  get solids() {
    return solidsOf(this.mapId);
  }

  get ctf() {
    return this.mode === 'ctf';
  }

  get ffa() {
    return this.mode === 'ffa';
  }

  /** Oyuncunun doğabileceği noktalar (Herkes Tek'te tüm haritaya dağılmış noktalar) */
  spawnPoints(p) {
    const s = this.map.spawns;
    if (this.ffa || p.team === 'ffa') return s.ffa ?? [...s.red, ...s.blue];
    return s[p.team];
  }

  /** Yeni gelen oyuncunun takımı */
  newTeam() {
    if (this.ffa) return 'ffa';
    return this.teamCount('red') <= this.teamCount('blue') ? 'red' : 'blue';
  }

  /** Mod değişince takımları ayarla: Herkes Tek'te herkes 'ffa', diğer modlarda kırmızı/mavi dengeli */
  assignTeams() {
    if (this.ffa) {
      for (const p of this.players.values()) p.team = 'ffa';
      return;
    }
    for (const p of this.players.values()) if (p.team !== 'red' && p.team !== 'blue') p.team = null;
    for (const p of this.players.values()) {
      if (!p.team) p.team = this.teamCount('red') <= this.teamCount('blue') ? 'red' : 'blue';
    }
  }

  get flagBases() {
    return flagBases(this.mapId);
  }

  get humans() {
    let n = 0;
    for (const p of this.players.values()) if (!p.isBot) n++;
    return n;
  }

  get scoreLimit() {
    if (this.ffa) return FFA.KILL_LIMIT;
    return this.ctf ? CTF.CAPTURE_LIMIT : MATCH.SCORE_LIMIT;
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

  addPlayer(socket, name, char, loadout) {
    const team = this.newTeam();
    const p = new Player(socket, name, team, char);
    p.loadout = cleanLoadout(loadout);
    this.players.set(p.id, p);
    if (!this.hostId) this.hostId = p.id;
    socket.join(this.code);
    socket.data.room = this;
    console.log(`[room ${this.code}] ${name} katıldı (${team})`);
    this.broadcastRoom();
    if (this.inMatch) {
      socket.emit(MSG.MATCH_START, this.matchInfo());
      for (const s of this.sprays.values()) socket.emit(MSG.SPRAYED, s);
      for (const d of this.drops.values()) socket.emit(MSG.DROP, { id: d.id, p: d.p });
      this.spawn(p);
    }
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    p.socket.leave(this.code);
    this.dropFlagOf(p, Date.now());
    this.players.delete(id);
    this.sprays.delete(id);
    console.log(`[room ${this.code}] ${p.name} ayrıldı`);
    // Odada sadece botlar kaldıysa oda kapanır
    if (this.humans === 0) {
      this.players.clear();
      return this.destroy();
    }
    if (this.hostId === id) this.hostId = [...this.players.values()].find((o) => !o.isBot).id;
    this.broadcastRoom();
  }

  // ---------------- Pratik botları ----------------

  onAddBot(id) {
    if (id !== this.hostId) return;
    if (!this.canJoin()) return this.notice(this.players.get(id), 'Oda dolu.');
    const team = this.newTeam();
    if (!this.ffa && this.teamCount(team) >= MAX_PER_TEAM) return this.notice(this.players.get(id), 'Takımlar dolu.');
    const n = this.botSeq++;
    const sock = new BotSocket(this.io, `bot-${this.code}-${n}`);
    const p = new Player(sock, botName(n), team, CHARACTER_IDS[n % CHARACTER_IDS.length]);
    p.ready = true;
    p.bot = new BotBrain(p, this);
    this.players.set(p.id, p);
    console.log(`[room ${this.code}] ${p.name} eklendi (${team})`);
    this.broadcastRoom();
    if (this.inMatch) this.spawn(p);
  }

  onRemoveBot(id) {
    if (id !== this.hostId) return;
    const bots = [...this.players.values()].filter((p) => p.isBot);
    if (!bots.length) return;
    // Kalabalık takımdan çıkar
    const big = this.teamCount('red') > this.teamCount('blue') ? 'red' : 'blue';
    const bot = this.ffa ? bots[bots.length - 1] : bots.reverse().find((b) => b.team === big) ?? bots[0];
    this.removePlayer(bot.id);
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
      map: this.mapId,
      mode: this.mode,
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
      map: this.mapId,
      mode: this.mode,
      flagBases: this.ctf ? flagBases(this.mapId) : null,
      roster: [...this.players.values()].map((p) => p.info()),
      scores: this.scores,
      scoreLimit: this.scoreLimit,
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
    if (!p || this.state !== 'lobby' || this.ffa || !TEAMS.includes(team) || p.team === team) return;
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

  onSetMap(id, mapId) {
    if (id !== this.hostId || this.state !== 'lobby' || !MAP_IDS.includes(mapId) || mapId === this.mapId) return;
    this.mapId = mapId;
    // Sadece Herkes Tek haritası: mod otomatik Herkes Tek olur
    if (MAPS[mapId].ffaOnly && !this.ffa) {
      this.mode = 'ffa';
      this.assignTeams();
    }
    this.broadcastRoom();
  }

  onSetMode(id, mode) {
    if (id !== this.hostId || this.state !== 'lobby' || !MODE_IDS.includes(mode) || mode === this.mode) return;
    this.mode = mode;
    this.assignTeams();
    // Herkes Tek'e özel harita diğer modlarda oynanmaz
    if (!this.ffa && this.map.ffaOnly) this.mapId = DEFAULT_MAP;
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
    this.clouds.length = 0;
    this.drops.clear();
    this.sprays.clear();
    this.resetFlags();
    for (const p of this.players.values()) p.resetStats();
    console.log(`[room ${this.code}] maç başladı (${this.size} oyuncu)`);
    this.emit(MSG.MATCH_START, this.matchInfo());
    const index = { red: 0, blue: 0, ffa: 0 };
    for (const p of this.players.values()) this.spawn(p, index[p.team]++);
    this.broadcastRoom();
  }

  // ---------------- Doğma ----------------

  pickSpawn(p) {
    const points = this.spawnPoints(p);
    const enemies = [...this.players.values()].filter((o) => o.alive && isEnemy(o, p));
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
    const points = this.spawnPoints(p);
    const sp = index !== undefined ? points[index % points.length] : this.pickSpawn(p);
    p.pos = [sp[0], sp[1], sp[2]];
    p.yaw = sp[3];
    p.pitch = 0;
    p.hp = PLAYER.MAX_HP;
    p.alive = true;
    p.life++;
    p.resetLoadout();
    if (p.isBot) {
      // Botlar mermi derdine düşmesin
      for (const k of Object.keys(p.reserve)) p.reserve[k] = 999;
      p.bot.onSpawn();
    }
    p.spawnedAt = now;
    p.respawnAt = 0;
    // Koruma, maç başındaki geri sayımda boşa gitmesin: sayım bitince başlar
    const protFrom = this.state === 'countdown' ? Math.max(now, this.countdownEnd) : now;
    p.protectedUntil = protFrom + PLAYER.SPAWN_PROTECTION;
    p.history.length = 0;
    p.lastInput = now;
    p.record(now);
    this.emit(MSG.RESPAWN, {
      id: p.id, p: p.pos, yaw: p.yaw, life: p.life, ammo: p.ammo, reserve: p.reserve, nades: p.nades, loadout: p.loadout, pr: p.protectedUntil - now,
    });
  }

  // ---------------- Oyun içi girdiler ----------------

  onInput(id, d) {
    const p = this.players.get(id);
    if (!p || !p.alive || !this.inMatch || !d || d.l !== p.life) return;
    if (!Array.isArray(d.p) || d.p.length !== 3 || !d.p.every(isNum) || !isNum(d.y) || !isNum(d.pi)) return;

    p.yaw = d.y;
    p.pitch = Math.max(-1.6, Math.min(1.6, d.pi));
    p.flags = (d.f | 0) & ~FLAG.PROTECTED; // koruma bayrağını sadece sunucu koyar
    if (this.state !== 'playing') return; // geri sayımda sadece bakış açısı

    const now = Date.now();
    const dt = Math.min(Math.max(now - p.lastInput, 16), 500) / 1000;
    const [x, y, z] = d.p;
    const horiz = Math.hypot(x - p.pos[0], z - p.pos[2]);
    const up = y - p.pos[1];
    const maxHoriz = PLAYER.RUN_SPEED * 1.35 * dt + 0.35;
    // Zıplama pedine basan oyuncu bir süre normalden hızlı yükselebilir
    if (this.onPad(p.pos) || this.onPad(d.p)) p.padUntil = now + 2500;
    const vUp = now < (p.padUntil ?? 0) ? PAD.MAX_VY : PLAYER.JUMP_VELOCITY;
    const maxUp = vUp * 1.3 * dt + 0.5;
    const B = this.map.bounds;
    const outside = Math.abs(x) > B.x + 0.5 || Math.abs(z) > B.z + 0.5 || y < B.minY || y > B.maxY;

    p.lastInput = now;
    if (horiz > maxHoriz || up > maxUp || outside) {
      // Şüpheli hareket: sunucudaki son geçerli konuma geri çek
      p.socket.emit(MSG.CORRECTION, { p: p.pos, l: p.life });
      return;
    }
    p.pos = [x, y, z];
    p.record(now);
  }

  /** Konum bir zıplama pedinin üstünde / yanında mı (sunucu hareket kontrolü için) */
  onPad(pos) {
    for (const pad of this.map.pads ?? []) {
      if (Math.hypot(pos[0] - pad.c[0], pos[2] - pad.c[2]) < pad.r + 1.2 && Math.abs(pos[1] - pad.c[1]) < 1.5) return true;
    }
    return false;
  }

  /** Düşme hasarı: istemci yere çarpma hızını bildirir, hasarı sunucu hesaplar (üst sınırlı) */
  onFall(id, d) {
    const p = this.players.get(id);
    if (!p || !p.alive || this.state !== 'playing' || !d || !isNum(d.v)) return;
    const now = Date.now();
    if (now - (p.lastFall ?? 0) < 400) return;
    p.lastFall = now;
    const v = Math.min(30, Math.abs(d.v));
    if (v <= FALL.SAFE_SPEED) return;
    const dmg = Math.min(FALL.MAX_DAMAGE, Math.round((v - FALL.SAFE_SPEED) * FALL.DAMAGE_PER_SPEED));
    if (dmg > 0) this.applyDamage(p, p, false, p.pos.map(r2), now, dmg, 'fall');
  }

  onReload(id) {
    const p = this.players.get(id);
    if (!p || !p.alive || p.reloadUntil) return;
    const w = WEAPONS[p.weapon];
    if (w.kind !== 'gun' || !(p.ammo[w.id] < w.MAG_SIZE) || !(p.reserve[w.id] > 0)) return;
    p.reloadUntil = Date.now() + w.RELOAD_TIME;
  }

  onSwitch(id, w) {
    const p = this.players.get(id);
    if (!p || typeof w !== 'string' || !WEAPONS[w] || p.weapon === w || !p.owns(w)) return;
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
      if (p.reloadUntil || !(p.ammo[w.id] > 0)) return;
      p.ammo[w.id]--;
      this.ammoFloor(p, w.id);
    }

    p.lastShot = now + (heavy ? w.HEAVY_INTERVAL : w.FIRE_INTERVAL) * 0.8;
    p.protectedUntil = 0; // ateş eden spawn korumasını kaybeder
    p.fired = true;

    // Lag compensation: hedefleri, atış yapanın gördüğü ana geri sar
    const rewind = now - Math.min(p.rtt + INTERP_DELAY, 400);
    const origin = [p.pos[0], p.pos[1] + p.eyeHeight, p.pos[2]];
    const targets = [];
    for (const o of this.players.values()) {
      if (o.alive && isEnemy(o, p)) {
        const past = o.posAt(rewind);
        targets.push({ player: o, pos: past.pos, crouch: past.crouch });
      }
    }
    const hit = castShot(origin, dir, this.solids, targets, w.RANGE);
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
    if (w.kind !== 'grenade' || !(p.nades[w.id] > 0) || now < p.lastShot) return;
    const dir = norm(d.d);
    if (!dir) return;
    p.nades[w.id]--;
    p.lastShot = now + w.FIRE_INTERVAL * 0.8;
    p.protectedUntil = 0;
    p.fired = true;

    const eye = [p.pos[0], p.pos[1] + p.eyeHeight, p.pos[2]];
    // Elden biraz ileride başlasın; duvarın dibindeysen gözden başla
    const wall = castShot(eye, dir, this.solids, [], 0.6);
    const ahead = Math.max(0, Math.min(0.5, wall.distance - 0.15));
    const o = [eye[0] + dir[0] * ahead, eye[1] + dir[1] * ahead - 0.1, eye[2] + dir[2] * ahead].map(r2);
    const v = throwVelocity(dir, typeof d.c === 'number' ? d.c : 1).map(r2);
    const g = { g: this.nextGid++, t: w.id, by: p, sim: { p: [...o], v: [...v] }, born: now, steps: 0 };
    this.grenades.push(g);
    this.emit(MSG.GRENADE, { g: g.g, t: g.t, id: p.id, o, v });
  }

  /** Silah seçimi: doğduktan sonra BUY_TIME içinde ve ateş etmeden hemen, yoksa sonraki doğuşta uygulanır */
  onSetLoadout(id, d) {
    const p = this.players.get(id);
    if (!p || !d) return;
    p.loadout = cleanLoadout(d);
    const now = Date.now();
    const canNow = p.alive && this.inMatch && !p.fired && (this.state === 'countdown' || now - p.spawnedAt < BUY_TIME);
    if (canNow) p.resetLoadout();
    p.socket.emit(MSG.LOADOUT, { loadout: p.loadout, ammo: p.ammo, reserve: p.reserve, nades: p.nades, now: canNow });
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
        stepGrenade(g.sim, this.solids);
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
    if (g.t === 'poison') {
      const w = WEAPONS.poison;
      this.clouds.push({ by: g.by, pos: at, until: now + w.DURATION, next: now + w.TICK });
      return;
    }
    if (g.t !== 'he' || this.state !== 'playing') return;
    const w = WEAPONS.he;
    const attacker = g.by;
    if (!this.players.has(attacker.id)) return; // atan oyuncu odadan çıktı
    const center = [at[0], at[1] + 0.2, at[2]];
    for (const v of this.players.values()) {
      if (!v.alive || (v !== attacker && !isEnemy(v, attacker))) continue;
      const chest = [v.pos[0], v.pos[1] + (v.crouching ? 0.6 : 0.95), v.pos[2]];
      const dx = chest[0] - center[0];
      const dy = chest[1] - center[1];
      const dz = chest[2] - center[2];
      const dist = Math.hypot(dx, dy, dz);
      if (dist >= w.RADIUS) continue;
      // Duvar arkasındakiler etkilenmez
      if (dist > 0.05) {
        const los = castShot(center, [dx / dist, dy / dist, dz / dist], this.solids, [], dist);
        if (los.distance < dist - 0.05) continue;
      }
      const dmg = Math.round(w.DAMAGE * (1 - dist / w.RADIUS));
      if (dmg > 0) this.applyDamage(attacker, v, false, chest.map(r2), now, dmg, 'he', at);
      if (this.state === 'ended') return;
    }
  }

  /** Zehir bulutları: içindeki rakiplere (ve atana) belirli aralıklarla hasar */
  updateClouds(now) {
    const w = WEAPONS.poison;
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      if (now >= c.until) {
        this.clouds.splice(i, 1);
        continue;
      }
      if (now < c.next) continue;
      c.next += w.TICK;
      if (this.state !== 'playing' || !this.players.has(c.by.id)) continue;
      for (const v of this.players.values()) {
        if (!v.alive || (v !== c.by && !isEnemy(v, c.by))) continue;
        const dx = v.pos[0] - c.pos[0];
        const dz = v.pos[2] - c.pos[2];
        const dy = v.pos[1] - c.pos[1];
        if (Math.hypot(dx, dz) > w.RADIUS || dy < -1.2 || dy > w.RADIUS * 0.8) continue;
        this.applyDamage(c.by, v, false, null, now, w.DAMAGE_TICK, 'poison', c.pos);
        if (this.state === 'ended') return;
      }
    }
  }

  applyDamage(attacker, victim, head, point, now, dmg, weapon, from = attacker.pos) {
    if (now < victim.protectedUntil) return;
    victim.hp = Math.max(0, victim.hp - dmg);
    const killed = victim.hp <= 0;
    const self = attacker === victim;
    if (!self) attacker.socket.emit(MSG.HIT, { v: victim.id, d: dmg, h: head, k: killed, pt: point });
    victim.socket.emit(MSG.DAMAGED, { hp: victim.hp, from, w: weapon });
    if (!killed) return;

    victim.alive = false;
    victim.deaths++;
    victim.respawnAt = now + PLAYER.RESPAWN_TIME;
    if (!self) {
      attacker.kills++;
      if (head) attacker.hs++;
      if (this.ffa) this.killReward(attacker, weapon);
      else if (!this.ctf) this.scores[attacker.team]++; // CTF'de puan sadece bayrakla gelir
    }
    this.dropFlagOf(victim, now);
    this.dropAmmo(victim, now);
    // kh: katilin kalan canı (ölüm kamerası için)
    this.emit(MSG.KILL, { k: attacker.id, v: victim.id, h: head, w: weapon, s: this.scores, kh: attacker.alive ? attacker.hp : 0 });
    if (!self && this.ffa && attacker.kills >= FFA.KILL_LIMIT) this.endMatch();
    else if (!self && !this.ctf && !this.ffa && this.scores[attacker.team] >= MATCH.SCORE_LIMIT) this.endMatch();
  }

  // ---------------- Herkes Tek: öldürme ödülü ----------------

  /** +25 can (en fazla MAX_HP) ve öldürdüğü silaha +1 şarjör (bıçak/bombaysa ana silaha) */
  killReward(p, weapon) {
    if (!p.alive) return;
    p.hp = Math.min(PLAYER.MAX_HP, p.hp + FFA.KILL_HP);
    const w = WEAPONS[weapon]?.kind === 'gun' && p.owns(weapon) ? weapon : p.loadout.primary;
    const mag = WEAPONS[w].MAG_SIZE;
    p.reserve[w] = Math.min(mag * FFA.MAX_MAGS, (p.reserve[w] ?? 0) + mag * FFA.KILL_MAGS);
    p.socket.emit(MSG.REWARD, { hp: p.hp, reserve: p.reserve, w, kill: 1 });
  }

  /** Herkes Tek'te şarjör hiç tamamen bitmez: şarjör ve yedek boşalınca bir şarjör yedek verilir */
  ammoFloor(p, w) {
    if (!this.ffa || p.ammo[w] > 0 || p.reserve[w] > 0) return;
    p.reserve[w] = WEAPONS[w].MAG_SIZE;
    p.socket.emit(MSG.REWARD, { reserve: p.reserve, w });
  }

  // ---------------- Mermi kutuları ----------------

  dropAmmo(victim, now) {
    if (victim.pos[1] < this.map.bounds.minY + 1) return;
    const d = { id: this.nextDropId++, p: [r2(victim.pos[0]), r2(victim.pos[1]), r2(victim.pos[2])], until: now + DROP.LIFETIME };
    this.drops.set(d.id, d);
    this.emit(MSG.DROP, { id: d.id, p: d.p });
  }

  /** Kutunun üstünden geçen, yedek mermisi eksik olan oyuncu alır */
  updateDrops(now) {
    for (const d of this.drops.values()) {
      if (now > d.until) {
        this.drops.delete(d.id);
        this.emit(MSG.PICKUP, { id: d.id, by: null });
        continue;
      }
      for (const p of this.players.values()) {
        if (!p.alive || Math.hypot(p.pos[0] - d.p[0], p.pos[2] - d.p[2]) > DROP.RADIUS || Math.abs(p.pos[1] - d.p[1]) > 1.8) continue;
        const guns = [p.loadout.primary, p.loadout.pistol];
        if (!guns.some((g) => p.reserve[g] < WEAPONS[g].RESERVE)) continue; // mermisi zaten tam
        for (const g of guns) p.reserve[g] = Math.min(WEAPONS[g].RESERVE, (p.reserve[g] ?? 0) + WEAPONS[g].MAG_SIZE * DROP.MAGS);
        this.drops.delete(d.id);
        this.emit(MSG.PICKUP, { id: d.id, by: p.id });
        p.socket.emit(MSG.PICKUP, { id: d.id, by: p.id, reserve: p.reserve });
        break;
      }
    }
  }

  // ---------------- Takıma işaret ----------------

  onMark(id, d) {
    const p = this.players.get(id);
    if (!p || !p.alive || !this.inMatch || this.ffa || !d || !isVec(d.p)) return;
    const now = Date.now();
    if (now - (p.lastMark ?? 0) < MARK.COOLDOWN * 0.8) return;
    const eye = [p.pos[0], p.pos[1] + p.eyeHeight, p.pos[2]];
    if (Math.hypot(d.p[0] - eye[0], d.p[1] - eye[1], d.p[2] - eye[2]) > MARK.RANGE + 5) return;
    p.lastMark = now;
    const msg = { id: p.id, p: d.p.map(r2), e: d.e ? 1 : 0 };
    for (const o of this.players.values()) if (o.team === p.team) o.socket.emit(MSG.MARKED, msg);
  }

  // ---------------- Bayrak kapmaca (CTF) ----------------

  resetFlags() {
    if (!this.ctf) {
      this.flags = null;
      return;
    }
    const bases = flagBases(this.mapId);
    this.flags = {};
    for (const t of TEAMS) this.flags[t] = { state: FLAG_STATE.BASE, pos: [...bases[t]], carrier: null, droppedAt: 0 };
  }

  flagEvent(team, ev, by) {
    this.emit(MSG.FLAG, { team, ev, by: by?.id ?? null, s: this.scores });
  }

  returnFlag(team, by = null) {
    const f = this.flags[team];
    f.state = FLAG_STATE.BASE;
    f.pos = [...flagBases(this.mapId)[team]];
    f.carrier = null;
    this.flagEvent(team, 'return', by);
  }

  /** Taşıyıcı öldü / çıktı: bayrak olduğu yere düşer */
  dropFlagOf(p, now) {
    if (!this.flags) return;
    for (const t of TEAMS) {
      const f = this.flags[t];
      if (f.state !== FLAG_STATE.CARRIED || f.carrier !== p) continue;
      f.carrier = null;
      if (p.pos[1] < this.map.bounds.minY + 1) {
        this.returnFlag(t);
        continue;
      }
      f.state = FLAG_STATE.DROPPED;
      f.pos = [p.pos[0], p.pos[1], p.pos[2]];
      f.droppedAt = now;
      this.flagEvent(t, 'drop', p);
    }
  }

  updateFlags(now) {
    if (!this.flags || this.state !== 'playing') return;
    const bases = flagBases(this.mapId);
    for (const t of TEAMS) {
      const f = this.flags[t];
      if (f.state === FLAG_STATE.CARRIED) {
        const c = f.carrier;
        if (!c || !c.alive || !this.players.has(c.id)) {
          this.dropFlagOf(c, now);
          continue;
        }
        f.pos = [c.pos[0], c.pos[1], c.pos[2]];
        // Sayı: taşıyıcı kendi üssünde ve kendi bayrağı yerinde
        const home = bases[c.team];
        const own = this.flags[c.team];
        if (own.state === FLAG_STATE.BASE && Math.hypot(c.pos[0] - home[0], c.pos[2] - home[2]) < CTF.CAPTURE_RADIUS
          && Math.abs(c.pos[1] - home[1]) < 2.5) {
          this.scores[c.team]++;
          c.caps = (c.caps ?? 0) + 1;
          f.state = FLAG_STATE.BASE;
          f.pos = [...bases[t]];
          f.carrier = null;
          this.flagEvent(t, 'capture', c);
          if (this.scores[c.team] >= CTF.CAPTURE_LIMIT) return this.endMatch();
        }
        continue;
      }
      if (f.state === FLAG_STATE.DROPPED && now - f.droppedAt > CTF.RETURN_TIME) {
        this.returnFlag(t);
        continue;
      }
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        if (Math.hypot(p.pos[0] - f.pos[0], p.pos[2] - f.pos[2]) > CTF.PICKUP_RADIUS || Math.abs(p.pos[1] - f.pos[1]) > 2) continue;
        if (p.team !== t) {
          // Rakip bayrağını kaptı (koruması biter)
          if (Object.values(this.flags).some((o) => o.carrier === p)) continue;
          f.state = FLAG_STATE.CARRIED;
          f.carrier = p;
          p.protectedUntil = 0;
          this.flagEvent(t, 'take', p);
          break;
        }
        if (f.state === FLAG_STATE.DROPPED) {
          // Kendi bayrağına dokundu: üssüne geri gönder
          this.returnFlag(t, p);
          break;
        }
      }
    }
  }

  flagSnapshot() {
    return TEAMS.map((t) => {
      const f = this.flags[t];
      return [f.state, f.carrier?.id ?? '', r2(f.pos[0]), r2(f.pos[1]), r2(f.pos[2])];
    });
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
          // Yedekten şarjöre aktar
          const take = Math.max(0, Math.min(w.MAG_SIZE - p.ammo[w.id], p.reserve[w.id] ?? 0));
          p.ammo[w.id] += take;
          p.reserve[w.id] = (p.reserve[w.id] ?? 0) - take;
          p.socket.emit(MSG.AMMO, { w: w.id, ammo: p.ammo[w.id], res: p.reserve[w.id] });
        }
      }
      if (!p.alive && this.state === 'playing' && (p.respawnAt === 0 || now >= p.respawnAt)) this.spawn(p);
    }
    for (const p of this.players.values()) if (p.bot && p.alive) p.bot.update(now, 1 / SERVER_TICK_RATE);
    if (this.state === 'playing') this.updateDrops(now);

    this.updateGrenades(now);
    if (this.state !== 'ended') this.updateClouds(now);
    if (this.state !== 'ended') this.updateFlags(now);
    if (this.state === 'ended') return; // bomba maçı bitirmiş olabilir
    if (this.state === 'playing' && now >= this.matchEnd) return this.endMatch();

    this.emit(MSG.SNAPSHOT, {
      t: now,
      st: this.state,
      tl: Math.min(MATCH.TIME_LIMIT, Math.max(0, this.matchEnd - now)),
      cd: Math.max(0, this.countdownEnd - now),
      s: [this.scores.red, this.scores.blue],
      f: this.flags ? this.flagSnapshot() : undefined,
      p: [...this.players.values()].map((p) => [
        p.id, r2(p.pos[0]), r2(p.pos[1]), r2(p.pos[2]), r3(p.yaw), r3(p.pitch),
        p.hp, p.alive ? 1 : 0, p.flags | (p.alive && now < p.protectedUntil ? FLAG.PROTECTED : 0), p.rtt, p.kills, p.deaths, WEAPON_ORDER.indexOf(p.weapon),
      ]),
    });
  }

  /** Maç sonu ödülleri: [{key, title, desc, id, name, value}] */
  awards() {
    const list = [...this.players.values()];
    const best = (key, tie = (a, b) => a.deaths - b.deaths) => {
      const c = list.filter((p) => p[key] > 0).sort((a, b) => b[key] - a[key] || tie(a, b))[0];
      return c ? { id: c.id, name: c.name, value: c[key] } : null;
    };
    const out = [];
    const add = (key, title, desc, w) => w && out.push({ key, title, desc, ...w });
    add('kills', 'TERMİNATÖR', 'En çok öldüren', best('kills'));
    add('hs', 'KESKİN NİŞANCI', 'En çok kafadan vuruş', best('hs'));
    if (this.ctf) add('caps', 'BAYRAK USTASI', 'En çok bayrak getiren', best('caps'));
    add('deaths', 'KURŞUN MIKNATISI', 'En çok ölen · mermiler onu çok seviyor', best('deaths', (a, b) => a.kills - b.kills));
    return out;
  }

  endMatch() {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.grenades.length = 0;
    this.clouds.length = 0;
    const { red, blue } = this.scores;
    let winner = red > blue ? 'red' : blue > red ? 'blue' : 'draw';
    let winnerId = null;
    if (this.ffa) {
      // Herkes Tek: en çok öldüren kazanır (eşitlikte az ölen)
      const top = [...this.players.values()].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      winner = top[0] && top[0].kills > 0 && !(top[1] && top[1].kills === top[0].kills && top[1].deaths === top[0].deaths) ? 'ffa' : 'draw';
      winnerId = winner === 'ffa' ? top[0].id : null;
    }
    console.log(`[room ${this.code}] maç bitti: ${winner} (${red}-${blue})`);
    this.drops.clear();
    this.emit(MSG.MATCH_END, {
      winner, winnerId, mode: this.mode, scores: this.scores, players: [...this.players.values()].map((p) => p.info()), awards: this.awards(),
    });
    for (const p of this.players.values()) {
      p.alive = false;
      p.ready = p.isBot; // botlar hep hazır
    }
    this.broadcastRoom();
    this.endTimer = setTimeout(() => {
      this.state = 'lobby';
      this.broadcastRoom();
    }, MATCH.END_SCREEN);
  }
}
