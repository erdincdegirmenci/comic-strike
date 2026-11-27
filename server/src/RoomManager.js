import { MSG } from '@comic-strike/shared/protocol.js';
import { CHARACTER_IDS } from '@comic-strike/shared/constants.js';
import { Room } from './Room.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karışan karakterler (0/O, 1/I) yok

function cleanName(name) {
  const n = typeof name === 'string' ? name.replace(/[<>&"'`]/g, '').trim().slice(0, 16) : '';
  return n || `Player${Math.floor(Math.random() * 900 + 100)}`;
}

function cleanPassword(p) {
  return typeof p === 'string' ? p.trim().slice(0, 24) : '';
}

function cleanChar(c) {
  return CHARACTER_IDS.includes(c) ? c : CHARACTER_IDS[Math.floor(Math.random() * CHARACTER_IDS.length)];
}

/** Tüm odaları yönetir ve socket olaylarını ilgili odaya yönlendirir. */
export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    io.on('connection', (socket) => this.onConnection(socket));
  }

  get count() {
    return this.rooms.size;
  }

  newCode() {
    let code;
    do {
      code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(isPublic, opts = {}) {
    const code = this.newCode();
    const room = new Room(code, this.io, isPublic, () => {
      this.rooms.delete(code);
      console.log(`[room] ${code} kapandı`);
    });
    room.password = opts.password ?? '';
    room.ff = !!opts.ff;
    this.rooms.set(code, room);
    console.log(`[room] ${code} oluşturuldu (${room.password ? 'şifreli' : 'herkese açık'}${room.ff ? ', takım ateşi' : ''})`);
    return room;
  }

  leave(socket) {
    const room = socket.data.room;
    if (room) {
      socket.data.room = null;
      room.removePlayer(socket.id);
    }
  }

  onConnection(socket) {
    console.log(`[+] Bağlandı: ${socket.id}`);
    const reply = (cb) => (typeof cb === 'function' ? cb : () => {});

    // Açık oda listesi (ana menünün yanında)
    socket.on(MSG.LIST_ROOMS, (_data, cb) => {
      const list = [...this.rooms.values()].filter((r) => r.size > 0).map((r) => r.listing());
      reply(cb)(list);
    });

    socket.on(MSG.CREATE_ROOM, (data, cb) => {
      const password = data?.locked ? cleanPassword(data?.password) : '';
      if (data?.locked && !password) return reply(cb)({ ok: false, error: 'Şifreli oda için bir şifre yaz.' });
      this.leave(socket);
      // Oluşturulan her oda listede görünür; şifreliyse girerken şifre sorulur
      const room = this.createRoom(!password, { password, ff: !!data?.ff });
      room.addPlayer(socket, cleanName(data?.name), cleanChar(data?.char), data?.loadout);
      reply(cb)({ ok: true, code: room.code });
    });

    socket.on(MSG.JOIN_ROOM, (data, cb) => {
      const code = String(data?.code ?? '').trim().toUpperCase();
      const room = this.rooms.get(code);
      if (!room) return reply(cb)({ ok: false, error: 'Oda bulunamadı.' });
      if (socket.data.room === room) return reply(cb)({ ok: true, code });
      if (!room.canJoin()) return reply(cb)({ ok: false, error: 'Oda dolu.' });
      if (room.password && cleanPassword(data?.password) !== room.password) {
        return reply(cb)({ ok: false, needPassword: true, error: data?.password ? 'Şifre yanlış.' : 'Bu oda şifreli. Şifreyi yaz.' });
      }
      this.leave(socket);
      room.addPlayer(socket, cleanName(data?.name), cleanChar(data?.char), data?.loadout);
      reply(cb)({ ok: true, code });
    });

    socket.on(MSG.QUICK_PLAY, (data, cb) => {
      this.leave(socket);
      let room = [...this.rooms.values()].find((r) => r.isPublic && !r.password && r.canJoin());
      if (!room) room = this.createRoom(true);
      room.addPlayer(socket, cleanName(data?.name), cleanChar(data?.char), data?.loadout);
      reply(cb)({ ok: true, code: room.code });
    });

    socket.on(MSG.LEAVE_ROOM, () => this.leave(socket));

    // Oyun içi olaylar → oyuncunun bulunduğu odaya
    const forward = (event, method) =>
      socket.on(event, (data) => {
        try {
          socket.data.room?.[method](socket.id, data);
        } catch (err) {
          console.error(`[hata] ${event}:`, err);
        }
      });
    forward(MSG.SET_TEAM, 'onSetTeam');
    forward(MSG.SET_READY, 'onSetReady');
    forward(MSG.SET_MAP, 'onSetMap');
    forward(MSG.SET_MODE, 'onSetMode');
    forward(MSG.START_MATCH, 'onStartMatch');
    forward(MSG.INPUT, 'onInput');
    forward(MSG.SHOOT, 'onShoot');
    forward(MSG.RELOAD, 'onReload');
    forward(MSG.SWITCH, 'onSwitch');
    forward(MSG.THROW, 'onThrow');
    forward(MSG.SPRAY, 'onSpray');
    forward(MSG.SET_LOADOUT, 'onSetLoadout');
    forward(MSG.FALL, 'onFall');
    forward(MSG.MARK, 'onMark');
    forward(MSG.ADD_BOT, 'onAddBot');
    forward(MSG.REMOVE_BOT, 'onRemoveBot');
    forward(MSG.SET_LIMITS, 'onSetLimits');
    forward(MSG.SET_FF, 'onSetFF');
    forward(MSG.MOVE_BOT, 'onMoveBot');
    forward(MSG.HOOK, 'onHook');
    forward(MSG.UNHOOK, 'onUnhook');
    forward(MSG.RESTART_REQUEST, 'onRestartRequest');
    forward(MSG.VOTE, 'onVote');
    forward(MSG.CHAT, 'onChat');

    socket.on('disconnect', () => {
      this.leave(socket);
      console.log(`[-] Ayrıldı: ${socket.id}`);
    });
  }
}
