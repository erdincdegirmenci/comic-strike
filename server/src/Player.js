import { PLAYER, WEAPON } from '@comic-strike/shared/constants.js';

/** Sunucu tarafında bir oyuncunun tüm durumu. */
export class Player {
  constructor(socket, name, team) {
    this.id = socket.id;
    this.socket = socket;
    this.name = name;
    this.team = team;
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

    this.ammo = WEAPON.MAG_SIZE;
    this.reloadUntil = 0;
    this.lastShot = 0;

    this.lastInput = 0;
    this.rtt = 80;
    this.history = []; // lag compensation için son ~1 saniyenin pozisyonları
  }

  resetStats() {
    this.kills = 0;
    this.deaths = 0;
  }

  record(now) {
    this.history.push({ t: now, x: this.pos[0], y: this.pos[1], z: this.pos[2] });
    while (this.history.length > 2 && this.history[0].t < now - 1000) this.history.shift();
  }

  /** Geçmişteki bir andaki pozisyon (lag compensation) */
  posAt(t) {
    const h = this.history;
    if (h.length === 0) return this.pos;
    const last = h[h.length - 1];
    if (t >= last.t) return [last.x, last.y, last.z];
    if (t <= h[0].t) return [h[0].x, h[0].y, h[0].z];
    for (let i = h.length - 1; i > 0; i--) {
      const a = h[i - 1];
      if (a.t <= t) {
        const b = h[i];
        const k = (t - a.t) / (b.t - a.t || 1);
        return [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k];
      }
    }
    return this.pos;
  }

  info() {
    return { id: this.id, name: this.name, team: this.team, ready: this.ready, kills: this.kills, deaths: this.deaths };
  }
}
