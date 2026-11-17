// Test botları: tek başına test ederken odaya hedef olarak katılırlar.
// Kullanım (PowerShell, proje klasöründe, sunucu çalışırken):
//   npm run bots -- ODAKODU 3
//   npm run bots -- ODAKODU 3 http://localhost:3000
// Botlar spawn çevresinde sağa sola yürür ve görüş hattındaki rakiplere (kötü nişanla) ateş eder.
// Duvar içinden geçmezler çünkü yerlerinden fazla ayrılmazlar. Ctrl+C ile kapatılır.

import { io } from 'socket.io-client';
import { MSG } from '@comic-strike/shared/protocol.js';
import { PLAYER, WEAPON } from '@comic-strike/shared/constants.js';

const [code, countArg, url = 'http://localhost:3000'] = process.argv.slice(2);
if (!code) {
  console.log('Kullanım: npm run bots -- ODAKODU [bot sayısı] [sunucu adresi]');
  process.exit(1);
}
const count = Math.min(7, Number(countArg) || 3);
const NAMES = ['Bot Bıçkın', 'Bot Sakar', 'Bot Uykucu', 'Bot Kuzen', 'Bot Fırtına', 'Bot Pinpon', 'Bot Turşu'];

function startBot(i) {
  const socket = io(url, { transports: ['websocket'] });
  const bot = { id: null, life: 0, alive: false, home: null, pos: null, yaw: 0, phase: Math.random() * 6, team: null, ammo: WEAPON.MAG_SIZE, others: [] };

  socket.on(MSG.SPING, (cb) => typeof cb === 'function' && cb());
  socket.on('connect', () => {
    bot.id = socket.id;
    socket.emit(MSG.JOIN_ROOM, { code, name: NAMES[i] }, (res) => {
      if (!res?.ok) {
        console.log(`${NAMES[i]}: ${res?.error}`);
        socket.close();
        return;
      }
      console.log(`${NAMES[i]} odaya katıldı`);
      socket.emit(MSG.SET_READY, true);
    });
  });
  socket.on(MSG.ROOM_STATE, (rs) => {
    const me = rs.players.find((p) => p.id === bot.id);
    if (me) bot.team = me.team;
    if (rs.state === 'lobby' && me && !me.ready) socket.emit(MSG.SET_READY, true);
  });
  socket.on(MSG.RESPAWN, (d) => {
    if (d.id !== bot.id) return;
    bot.life = d.life;
    bot.alive = true;
    bot.home = [...d.p];
    bot.pos = [...d.p];
    bot.yaw = d.yaw;
    bot.ammo = d.ammo;
  });
  socket.on(MSG.KILL, (d) => {
    if (d.v === bot.id) bot.alive = false;
  });
  socket.on(MSG.AMMO, (d) => (bot.ammo = d.ammo));
  socket.on(MSG.SNAPSHOT, (s) => {
    bot.state = s.st;
    bot.others = s.p.filter((p) => p[0] !== bot.id && p[7] === 1);
  });

  // Hareket: yerinde sağa-sola
  setInterval(() => {
    if (!bot.alive || !bot.home || bot.state !== 'playing') return;
    bot.phase += 0.033 * 1.6;
    const off = Math.sin(bot.phase) * 1.5;
    bot.pos = [bot.home[0] + off, bot.home[1], bot.home[2]];
    socket.emit(MSG.INPUT, { l: bot.life, p: bot.pos, y: bot.yaw, pi: 0, f: 1 });
  }, 33);

  // Ateş: en yakın rakibe kötü nişanla
  setInterval(() => {
    if (!bot.alive || !bot.pos || bot.state !== 'playing') return;
    let target = null;
    let best = Infinity;
    for (const p of bot.others) {
      const d = Math.hypot(p[1] - bot.pos[0], p[3] - bot.pos[2]);
      if (d < best) {
        best = d;
        target = p;
      }
    }
    if (!target || best > 60) return;
    const dx = target[1] - bot.pos[0];
    const dy = target[2] + 1.1 - (bot.pos[1] + PLAYER.EYE);
    const dz = target[3] - bot.pos[2];
    bot.yaw = Math.atan2(-dx, -dz);
    if (bot.ammo <= 0) {
      socket.emit(MSG.RELOAD);
      return;
    }
    const L = Math.hypot(dx, dy, dz);
    const miss = 0.08;
    socket.emit(MSG.SHOOT, {
      d: [dx / L + (Math.random() - 0.5) * miss, dy / L + (Math.random() - 0.5) * miss, dz / L + (Math.random() - 0.5) * miss],
    });
    bot.ammo--;
  }, 450);

  return socket;
}

for (let i = 0; i < count; i++) setTimeout(() => startBot(i), i * 150);
console.log(`${count} bot ${code} odasına bağlanıyor → ${url}`);
