import {
  PLAYER,
  WEAPONS,
  FLAG,
  FLAG_STATE,
  TEAMS,
  isEnemy,
} from "@comic-strike/shared/constants.js";
import { castShot } from "./HitScan.js";

// Sunucu tarafında çalışan pratik botları.
// Sunucuda oyuncu fiziği yok; botlar için harita kutularıyla basit bir çarpışmalı hareket burada yapılır:
// gövde kutulara girmez, 0.45 m'ye kadar basamağa çıkar, boşluğa düşer.

const R = PLAYER.RADIUS;
const BODY = PLAYER.HEIGHT;
const STEP = 0.45;
const NAMES = [
  "Bot Bıçkın",
  "Bot Sakar",
  "Bot Uykucu",
  "Bot Kuzen",
  "Bot Fırtına",
  "Bot Pinpon",
  "Bot Turşu",
  "Bot Şaşkın",
];

/** Bot için sahte socket: Room kodu oyuncu socket'i gibi kullanabilsin diye */
export class BotSocket {
  constructor(io, id) {
    this.io = io;
    this.id = id;
    this.data = {};
    this.isBot = true;
  }

  emit() {}

  join() {}

  leave() {}

  /** Botun ateşi vb. odadaki herkese gitsin */
  to(room) {
    return this.io.to(room);
  }

  timeout() {
    return { emit: (_ev, cb) => typeof cb === "function" && cb(null) };
  }
}

export function botName(i) {
  return NAMES[i % NAMES.length];
}

/** Ayak noktası (x,y,z) ile gövde kutuları çakışıyor mu (basamak yüksekliğinin üstü) */
function hitsBody(solids, x, y, z) {
  const y0 = y + STEP;
  const y1 = y + BODY;
  for (const b of solids) {
    if (
      x + R > b.min[0] &&
      x - R < b.max[0] &&
      z + R > b.min[2] &&
      z - R < b.max[2] &&
      y1 > b.min[1] &&
      y0 < b.max[1]
    )
      return true;
  }
  return false;
}

/** Ayağın altındaki en yüksek zemin (y+STEP'ten alçak kutuların tepesi) */
function groundBelow(solids, x, y, z) {
  let g = -Infinity;
  const lim = y + STEP;
  for (const b of solids) {
    if (
      x + R * 0.7 > b.min[0] &&
      x - R * 0.7 < b.max[0] &&
      z + R * 0.7 > b.min[2] &&
      z - R * 0.7 < b.max[2] &&
      b.max[1] <= lim + 1e-3 &&
      b.max[1] > g
    )
      g = b.max[1];
  }
  return g;
}

// ---------------- Yol bulma (A*) ----------------
// Her harita için 1 m'lik ızgara: zemin katında bir oyuncunun durabileceği hücreler.
// Havuz gibi çukurlar (zemin < -0.5) yürünmez sayılır, botlar içine düşüp takılmasın.
const CELL = 1;
const grids = new Map();

function hitsBodyR(solids, x, y, z, r) {
  const y0 = y + STEP;
  const y1 = y + BODY;
  for (const b of solids) {
    if (
      x + r > b.min[0] &&
      x - r < b.max[0] &&
      z + r > b.min[2] &&
      z - r < b.max[2] &&
      y1 > b.min[1] &&
      y0 < b.max[1]
    )
      return true;
  }
  return false;
}

function gridFor(mapId, map, solids) {
  if (grids.has(mapId)) return grids.get(mapId);
  const B = map.bounds;
  const nx = Math.ceil((B.x * 2) / CELL);
  const nz = Math.ceil((B.z * 2) / CELL);
  const ok = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = -B.x + (i + 0.5) * CELL;
      const z = -B.z + (j + 0.5) * CELL;
      const gy = groundBelow(solids, x, 0, z);
      ok[j * nx + i] =
        gy > -0.3 && !hitsBodyR(solids, x, gy, z, R + 0.1) ? 1 : 0; // çukur/tünel girişi yürünmez
    }
  }
  const g = { nx, nz, ok, B };
  grids.set(mapId, g);
  return g;
}

const cellOf = (g, x, z) => [
  Math.max(0, Math.min(g.nx - 1, Math.floor((x + g.B.x) / CELL))),
  Math.max(0, Math.min(g.nz - 1, Math.floor((z + g.B.z) / CELL))),
];
const centerOf = (g, i, j) => [
  -g.B.x + (i + 0.5) * CELL,
  -g.B.z + (j + 0.5) * CELL,
];

/** En yakın yürünebilir hücre */
function nearestOk(g, i, j) {
  if (g.ok[j * g.nx + i]) return [i, j];
  for (let r = 1; r < 8; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const a = i + di;
        const b = j + dj;
        if (a >= 0 && b >= 0 && a < g.nx && b < g.nz && g.ok[b * g.nx + a])
          return [a, b];
      }
    }
  }
  return null;
}

/** İki nokta arasındaki düz çizgi tamamen yürünebilir hücrelerden mi geçiyor */
function lineOk(g, ax, az, bx, bz) {
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 0.01) return true;
  const n = Math.ceil(len / 0.3);
  // gövde genişliği kadar iki yandan da kontrol et
  const px = (-(bz - az) / len) * 0.45;
  const pz = ((bx - ax) / len) * 0.45;
  for (let k = 1; k <= n; k++) {
    const x = ax + ((bx - ax) * k) / n;
    const z = az + ((bz - az) * k) / n;
    for (const o of [0, 1, -1]) {
      const [i, j] = cellOf(g, x + px * o, z + pz * o);
      if (!g.ok[j * g.nx + i]) return false;
    }
  }
  return true;
}

/** A*: hücre merkezlerinden oluşan yol ([x,z] listesi) ya da null */
function findPath(g, from, to) {
  const s = nearestOk(g, ...cellOf(g, from[0], from[2]));
  const t = nearestOk(g, ...cellOf(g, to[0], to[2]));
  if (!s || !t) return null;
  const N = g.nx * g.nz;
  const start = s[1] * g.nx + s[0];
  const goal = t[1] * g.nx + t[0];
  const gScore = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = []; // [f, idx]
  const push = (f, idx) => {
    heap.push([f, idx]);
    let k = heap.length - 1;
    while (k > 0) {
      const par = (k - 1) >> 1;
      if (heap[par][0] <= heap[k][0]) break;
      [heap[par], heap[k]] = [heap[k], heap[par]];
      k = par;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  const h = (idx) =>
    Math.hypot((idx % g.nx) - t[0], Math.floor(idx / g.nx) - t[1]);
  gScore[start] = 0;
  push(h(start), start);
  let iter = 0;
  while (heap.length && iter++ < 20000) {
    const [, cur] = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const ci = cur % g.nx;
    const cj = Math.floor(cur / g.nx);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = ci + di;
        const b = cj + dj;
        if (a < 0 || b < 0 || a >= g.nx || b >= g.nz) continue;
        const n = b * g.nx + a;
        if (!g.ok[n] || closed[n]) continue;
        if (di && dj && (!g.ok[cj * g.nx + a] || !g.ok[b * g.nx + ci]))
          continue; // köşe kesme yok
        const ng = gScore[cur] + (di && dj ? 1.414 : 1);
        if (ng < gScore[n]) {
          gScore[n] = ng;
          came[n] = cur;
          push(ng + h(n), n);
        }
      }
    }
  }
  if (came[goal] === -1 && goal !== start) return null;
  const path = [];
  for (let c = goal; c !== -1 && c !== start; c = came[c])
    path.push(centerOf(g, c % g.nx, Math.floor(c / g.nx)));
  path.reverse();
  return path;
}

const now = () => Date.now();
const angleTo = (dx, dz) => Math.atan2(-dx, -dz); // istemcideki yaw ile aynı (ileri = -Z)

/** Bir botun beyni. Room.tick içinde her sunucu adımında update çağrılır. */
export class BotBrain {
  constructor(player, room) {
    this.p = player;
    this.room = room;
    this.vy = 0;
    this.goal = null; // geçici hedef (takılınca)
    this.goalUntil = 0;
    this.stuckT = 0;
    this.progAt = 0; // ilerleme kontrolü
    this.progDist = Infinity;
    this.path = null; // A* yolu
    this.pathFor = null; // yolun hedefi
    this.repathAt = 0;
    this.seenAt = 0; // hedefi ilk gördüğü an (tepki süresi)
    this.target = null;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.strafeFlip = 0;
    this.skill = 0.6 + Math.random() * 0.3; // nişan becerisi
    this.role = Math.random() < 0.3 ? "defend" : "attack"; // CTF'de
  }

  onSpawn() {
    this.pitExit = null;
    this.climbing = null;
    this.vy = 0;
    this.goal = null;
    this.target = null;
    this.stuckT = 0;
    this.path = null;
  }

  /** Hedefe giden yoldaki sıradaki ara nokta */
  waypoint(now, dest) {
    const p = this.p;
    const moved =
      !this.pathFor ||
      Math.hypot(this.pathFor[0] - dest[0], this.pathFor[2] - dest[2]) > 2.5;
    if (!this.path || moved || now > this.repathAt) {
      const g = gridFor(this.room.mapId, this.room.map, this.solids);
      this.path = findPath(g, p.pos, dest);
      this.pathFor = dest;
      this.repathAt = now + 1500 + Math.random() * 500;
    }
    const path = this.path;
    if (!path || !path.length) return dest;
    while (
      path.length > 1 &&
      Math.hypot(path[0][0] - p.pos[0], path[0][1] - p.pos[2]) < 0.9
    )
      path.shift();
    // Yol düz ve yürünebilirse birkaç nokta ileriye kestirme (zigzag azalsın)
    const g = gridFor(this.room.mapId, this.room.map, this.solids);
    let k = 0;
    for (let i = Math.min(path.length - 1, 5); i > 0; i--) {
      if (lineOk(g, p.pos[0], p.pos[2], path[i][0], path[i][1])) {
        k = i;
        break;
      }
    }
    return [path[k][0], 0, path[k][1]];
  }

  get solids() {
    return this.room.solids;
  }

  eye() {
    const p = this.p;
    return [p.pos[0], p.pos[1] + PLAYER.EYE, p.pos[2]];
  }

  /** Göz hizasından hedefe görüş var mı */
  canSee(o) {
    const e = this.eye();
    const t = [o.pos[0], o.pos[1] + 1.1, o.pos[2]];
    const d = [t[0] - e[0], t[1] - e[1], t[2] - e[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    if (len > 70 || len < 0.01) return false;
    const hit = castShot(
      e,
      [d[0] / len, d[1] / len, d[2] / len],
      this.solids,
      [],
      len,
    );
    return hit.distance >= len - 0.3;
  }

  /** Nereye gitmeli? (mod ve bayrak durumuna göre) */
  destination() {
    const room = this.room;
    const p = this.p;
    // Havuza / tünele düştüyse bulunduğu seviyedeki en yakın merdivenden çık
    const exits = room.map.botExits;
    if (exits && p.pos[1] < -0.3) {
      // Çıkış, çukura düşüldüğü an bir kez seçilir ve yüzeye çıkana kadar değişmez
      let best = this.pitExit ?? exits[0];
      let bd = this.pitExit ? 0 : Infinity;
      for (const ex of this.pitExit ? [] : exits) {
        // zemini botun bulunduğu yerden yukarıda olan çukurda olamaz (ör. tünel merdivenindeyken havuz çıkışı)
        if (ex[2] !== undefined && ex[2] > p.pos[1] + 0.3) continue;
        // başka seviyedeki çıkışlar cezalandırılır
        const d =
          Math.hypot(ex[0][0] - p.pos[0], ex[0][1] - p.pos[2]) +
          (ex[2] !== undefined ? Math.abs(ex[2] - p.pos[1]) * 20 : 0);
        if (d < bd) {
          bd = d;
          best = ex;
        }
      }
      this.pitExit = best;
      // merdiven dibine yaklaşınca (1.2 m) yukarıdaki çıkış noktasına yönel
      const near =
        Math.hypot(best[0][0] - p.pos[0], best[0][1] - p.pos[2]) < 1.2;
      if (near) this.climbing = best;
      const q = this.climbing === best || near ? best[1] : best[0];
      return [q[0], 0, q[1]];
    }
    this.climbing = null;
    this.pitExit = null;
    if (room.flags) {
      const bases = room.flagBases;
      const enemy = TEAMS.find((t) => t !== p.team);
      const mine = room.flags[p.team];
      const theirs = room.flags[enemy];
      if (theirs.carrier === p) return bases[p.team]; // bayrak bende: eve
      if (mine.state === FLAG_STATE.CARRIED) return mine.pos; // bayrağımızı kaçıranı kovala
      if (mine.state === FLAG_STATE.DROPPED) return mine.pos; // düşen bayrağımızı geri al
      if (this.role === "defend") return bases[p.team];
      return theirs.pos;
    }
    // Takım savaşı: en yakın canlı rakibe
    let best = null;
    let bd = Infinity;
    for (const o of room.players.values()) {
      if (!o.alive || !isEnemy(o, p)) continue;
      const d = Math.hypot(o.pos[0] - p.pos[0], o.pos[2] - p.pos[2]);
      if (d < bd) {
        bd = d;
        best = o.pos;
      }
    }
    if (best) return best;
    const pts = room.spawnPoints(p);
    return pts[Math.floor(now() / 8000 + this.skill * 10) % pts.length];
  }

  /** Belirtilen yöne dt kadar yürümeyi dene; engel varsa yana kaydır. Hareket ettiyse true */
  tryMove(dx, dz, dist) {
    const p = this.p;
    const s = this.solids;
    const nx = p.pos[0] + dx * dist;
    const nz = p.pos[2] + dz * dist;
    const step = (x, z) => {
      if (hitsBody(s, x, p.pos[1], z)) return false;
      // Uçurumdan / havuz kenarından kendiliğinden düşme
      if (this.vy === 0 && groundBelow(s, x, p.pos[1], z) < p.pos[1] - 0.7)
        return false;
      // Yüzeydeyken tünel girişine / çukura inme
      if (p.pos[1] > -0.3 && groundBelow(s, x, p.pos[1], z) < -0.3)
        return false;
      p.pos[0] = x;
      p.pos[2] = z;
      return true;
    };
    if (step(nx, nz)) return true;
    if (Math.abs(dx) > 0.2 && step(nx, p.pos[2])) return true;
    if (Math.abs(dz) > 0.2 && step(p.pos[0], nz)) return true;
    return false;
  }

  update(now, dt) {
    const p = this.p;
    const room = this.room;
    if (!p.alive) return;
    const playing = room.state === "playing";

    // --- Hedef seçimi: görünen en yakın rakip ---
    let enemy = null;
    let ed = Infinity;
    for (const o of room.players.values()) {
      if (!o.alive || !isEnemy(o, p) || now < o.protectedUntil) continue;
      const d = Math.hypot(
        o.pos[0] - p.pos[0],
        o.pos[1] - p.pos[1],
        o.pos[2] - p.pos[2],
      );
      if (d < ed && this.canSee(o)) {
        ed = d;
        enemy = o;
      }
    }
    if (enemy !== this.target) {
      this.target = enemy;
      this.seenAt = now;
    }

    // --- Hareket ---
    const finalDest = this.destination();
    const inPit = room.map.botExits && p.pos[1] < -0.3;
    let dest = inPit
      ? finalDest
      : this.goal && now < this.goalUntil
        ? this.goal
        : this.waypoint(now, finalDest);
    let dx = dest[0] - p.pos[0];
    let dz = dest[2] - p.pos[2];
    let dist = Math.hypot(dx, dz);
    if (dist < 0.05) {
      dx = finalDest[0] - p.pos[0];
      dz = finalDest[2] - p.pos[2];
      dist = Math.hypot(dx, dz) || 1;
    }
    const carrying =
      room.flags && Object.values(room.flags).some((f) => f.carrier === p);
    let moving =
      playing &&
      Math.hypot(finalDest[0] - p.pos[0], finalDest[2] - p.pos[2]) >
        (inPit ? 0.2 : 1);
    let speed = PLAYER.WALK_SPEED * 0.95;
    // CTF'de saldıran bot çatışırken de hedefe yürür (ateş ederek); diğerleri yerinde yana kayar
    const objective =
      room.flags &&
      (carrying || this.role === "attack") &&
      Math.random() < 0.97;
    if (enemy && !objective) {
      // Çatışmada: yaklaş ama çok yakına gitme, yanlara kay
      if (now > this.strafeFlip) {
        this.strafe = -this.strafe;
        this.strafeFlip = now + 600 + Math.random() * 900;
      }
      const ex = enemy.pos[0] - p.pos[0];
      const ez = enemy.pos[2] - p.pos[2];
      const el = Math.hypot(ex, ez) || 1;
      const toward = ed > 12 ? 0.7 : ed < 5 ? -0.4 : 0;
      dx = (ex / el) * toward + (-ez / el) * this.strafe;
      dz = (ez / el) * toward + (ex / el) * this.strafe;
      dist = Math.hypot(dx, dz) || 1;
      moving = playing;
      speed = PLAYER.WALK_SPEED * 0.8;
    } else if (Math.hypot(finalDest[0] - p.pos[0], finalDest[2] - p.pos[2]) > 8)
      speed = PLAYER.RUN_SPEED * 0.85;

    let moved = false;
    if (moving) {
      const ux = dx / dist;
      const uz = dz / dist;
      const step = speed * dt;
      // Doğrudan, olmazsa sağa/sola açılı dene (basit engelden kaçınma)
      for (const a of [0, 0.5, -0.5, 1, -1, 1.6, -1.6]) {
        const c = Math.cos(a);
        const s = Math.sin(a);
        if (this.tryMove(ux * c - uz * s, ux * s + uz * c, step)) {
          moved = true;
          break;
        }
      }
      // Takıldıysa bir süre rastgele bir noktaya git
      this.stuckT = moved ? Math.max(0, this.stuckT - dt) : this.stuckT + dt;
      if (this.stuckT > 0.8) {
        this.stuckT = 0;
        this.path = null;
        const B = room.map.bounds;
        this.goal = [
          (Math.random() * 2 - 1) * B.x * 0.8,
          0,
          p.pos[2] + (Math.random() * 2 - 1) * 10,
        ];
        this.goalUntil = now + 2500;
      }
      if (
        this.goal &&
        Math.hypot(this.goal[0] - p.pos[0], this.goal[2] - p.pos[2]) < 1
      )
        this.goal = null;
      // 2 sn'de hedefe 0.7 m bile yaklaşamadıysa takılmıştır: kısa bir yan sapma + yeni yol
      if (!enemy && now > this.progAt) {
        const real = Math.hypot(
          finalDest[0] - p.pos[0],
          finalDest[2] - p.pos[2],
        );
        if (real > 2 && real > this.progDist - 0.7) {
          this.path = null;
          const a = Math.random() * Math.PI * 2;
          this.goal = [
            p.pos[0] + Math.cos(a) * 3,
            0,
            p.pos[2] + Math.sin(a) * 3,
          ];
          this.goalUntil = now + 800;
        }
        this.progDist = real;
        this.progAt = now + 2000;
      }
    }

    // Yerçekimi ve basamak
    const g = groundBelow(this.solids, p.pos[0], p.pos[1], p.pos[2]);
    if (g >= p.pos[1] - 0.05) {
      p.pos[1] = Math.max(p.pos[1], g);
      this.vy = 0;
    } else {
      this.vy -= PLAYER.GRAVITY * dt;
      p.pos[1] = Math.max(g, p.pos[1] + this.vy * dt);
      if (p.pos[1] <= g) this.vy = 0;
    }
    if (p.pos[1] < room.map.bounds.minY) p.pos[1] = room.map.bounds.minY;

    // Bakış
    if (enemy) {
      const ex = enemy.pos[0] - p.pos[0];
      const ey = enemy.pos[1] + 1.1 - (p.pos[1] + PLAYER.EYE);
      const ez = enemy.pos[2] - p.pos[2];
      p.yaw = angleTo(ex, ez);
      p.pitch = Math.atan2(ey, Math.hypot(ex, ez));
    } else if (moved) {
      p.yaw = angleTo(dx, dz);
      p.pitch = 0;
    }
    p.flags =
      (moved ? FLAG.MOVING : 0) |
      (moved && speed > PLAYER.WALK_SPEED ? FLAG.RUNNING : 0) |
      (this.vy !== 0 ? FLAG.AIR : 0);
    p.record(now);

    // --- Ateş ---
    if (!playing) return;
    const w = WEAPONS[p.weapon];
    if (w.kind === "gun" && !(p.ammo[w.id] > 0) && !p.reloadUntil)
      room.onReload(p.id);
    if (!enemy || now - this.seenAt < 450 || now < p.lastShot || p.reloadUntil)
      return;
    if (w.kind !== "gun" || !(p.ammo[w.id] > 0)) return;
    const e = this.eye();
    const t = [
      enemy.pos[0],
      enemy.pos[1] + (Math.random() < 0.15 ? 1.5 : 1.0),
      enemy.pos[2],
    ];
    const d = [t[0] - e[0], t[1] - e[1], t[2] - e[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    // Nişan hatası: uzaklık, hareket ve beceriye göre
    const err = (0.032 + (moved ? 0.02 : 0)) * (1.6 - this.skill);
    for (let i = 0; i < 3; i++)
      d[i] = d[i] / len + (Math.random() - 0.5) * 2 * err;
    room.onShoot(p.id, { d });
  }
}
