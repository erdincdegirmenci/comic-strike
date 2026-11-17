import { PLAYER, WEAPONS, FLAG, DEFAULT_LOADOUT } from '@comic-strike/shared/constants.js';

/** Sunucu tarafında bir oyuncunun tüm durumu. */
export class Player {
  constructor(socket, name, team, char) {
    this.id = socket.id;
    this.socket = socket;
    this.name = name;
    this.team = team;
    this.char = char;
    this.loadout = { ...DEFAULT_LOADOUT };
    this.spawnedAt = 0;
    this.fired = false; // doğduktan sonra ateş etti mi (silah değiştirme süresi için)
    this.ready = false;
    this.kills = 0;
    this.deaths = 0;

    this.pos = [0, 0, 0]; // ayak pozisyonu
    this.yaw = 0;
    this.pitch = 0;
    this.flags = 0;
    this.hp = PLAYER.MAX_HP;
    this.alive = false;
    this.life = 0; // her doğuşta artar; eski girdileri ayıklamak için
    this.respawnAt = 0;
    this.protectedUntil = 0;

    this.weapon = 'rifle';
    this.ammo = {};
    this.nades = {};
    this.reloadUntil = 0;
    this.lastShot = 0;
    this.lastSpray = 0;
    this.resetLoadout();

    this.lastInput = 0;
    this.rtt = 80;
    this.history = []; // lag compensation için son ~1 saniyenin pozisyonları
  }

  resetStats() {
    this.kills = 0;
    this.deaths = 0;
  }

  get crouching() {
    return (this.flags & FLAG.CROUCH) !== 0;
  }

  get eyeHeight() {
    return this.crouching ? PLAYER.CROUCH_EYE : PLAYER.EYE;
  }

  /** Doğuşta silah/mermi/bomba sıfırlama */
  resetLoadout() {
    const l = this.loadout;
    this.weapon = l.primary;
    this.ammo = { [l.primary]: WEAPONS[l.primary].MAG_SIZE, [l.pistol]: WEAPONS[l.pistol].MAG_SIZE };
    this.nades = { [l.nade]: WEAPONS[l.nade].COUNT };
    this.reloadUntil = 0;
    this.lastShot = 0;
    this.fired = false;
  }

  /** Bu oyuncunun elinde olabilecek silahlar */
  owns(w) {
    const l = this.loadout;
    return w === 'knife' || w === l.primary || w === l.pistol || w === l.nade;
  }

  record(now) {
    this.history.push({ t: now, x: this.pos[0], y: this.pos[1], z: this.pos[2], c: this.crouching });
    while (this.history.length > 2 && this.history[0].t < now - 1000) this.history.shift();
  }

  /** Geçmişteki bir andaki pozisyon (lag compensation) */
  posAt(t) {
    const h = this.history;
    if (h.length === 0) return { pos: this.pos, crouch: this.crouching };
    const last = h[h.length - 1];
    if (t >= last.t) return { pos: [last.x, last.y, last.z], crouch: last.c };
    if (t <= h[0].t) return { pos: [h[0].x, h[0].y, h[0].z], crouch: h[0].c };
    for (let i = h.length - 1; i > 0; i--) {
      const a = h[i - 1];
      if (a.t <= t) {
        const b = h[i];
        const k = (t - a.t) / (b.t - a.t || 1);
        return { pos: [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k], crouch: k < 0.5 ? a.c : b.c };
      }
    }
    return { pos: this.pos, crouch: this.crouching };
  }

  info() {
    return { id: this.id, name: this.name, team: this.team, char: this.char, ready: this.ready, kills: this.kills, deaths: this.deaths };
  }
}
