// Socket.IO mesaj isimleri. Yazım hatalarını önlemek için her yerde buradan kullanılır.
// Ayrıntılı açıklama: docs/PROTOCOL.md
export const MSG = {
  // istemci → sunucu
  CREATE_ROOM: 'create_room', // {name, locked, password, ff} → ack {ok, code}
  JOIN_ROOM: 'join_room', // {name, code, password} → ack {ok, code | error, needPassword}
  LIST_ROOMS: 'list_rooms', // → ack [{code, name, players, max, map, mode, state, locked, ff}]
  SET_FF: 'set_ff', // boolean: takım ateşi (sadece host, lobide)
  MOVE_BOT: 'move_bot', // {id, team}: host lobide botu diğer takıma taşır
  QUICK_PLAY: 'quick_play', // {name} → ack {ok, code}
  LEAVE_ROOM: 'leave_room',
  SET_TEAM: 'set_team', // 'red' | 'blue'
  SET_READY: 'set_ready', // boolean
  SET_MAP: 'set_map', // 'city' | 'pool' | 'frost' (sadece host, lobide)
  SET_MODE: 'set_mode', // 'tdm' | 'ctf' (sadece host, lobide)
  START_MATCH: 'start_match',
  INPUT: 'input', // {l, p:[x,y,z], y, pi, f}
  SHOOT: 'shoot', // {d:[x,y,z], h?:1 (bıçak ağır saldırı)}
  RELOAD: 'reload',
  SWITCH: 'switch', // 'rifle' | 'awp' | 'knife' | 'he' | 'smoke'
  THROW: 'throw', // {d:[x,y,z], c:0..1} elindeki bombayı at (c = basılı tutma oranı)
  SPRAY: 'spray', // {p:[x,y,z], n:[x,y,z]} duvara sticker
  SET_LOADOUT: 'set_loadout', // {primary, pistol, nade}
  MARK: 'mark', // {p:[x,y,z], e:0|1} takıma işaret (e=1: düşman işaretlendi)
  ADD_BOT: 'add_bot', // (sadece host) pratik botu ekle
  REMOVE_BOT: 'remove_bot', // (sadece host) bir botu çıkar
  FALL: 'fall', // {v} yere çarpma hızı (m/s) → düşme hasarı
  SET_LIMITS: 'set_limits', // {score, flags, time} (sadece host, lobide) maç sonu sınırları
  CHAT: 'chat', // {t: metin, team: bool}
  HOOK: 'hook', // {p:[x,y,z]} kanca atıldı
  UNHOOK: 'unhook', // kanca bırakıldı
  RESTART_REQUEST: 'restart_request', // host maçı baştan başlatmak için oylama açar
  VOTE: 'vote', // {yes: bool} oylamaya cevap

  // sunucu → istemci
  ROOM_STATE: 'room_state',
  NOTICE: 'notice',
  MATCH_START: 'match_start',
  SNAPSHOT: 'snapshot',
  RESPAWN: 'respawn',
  CORRECTION: 'correction',
  SHOT: 'shot',
  HIT: 'hit',
  DAMAGED: 'damaged',
  KILL: 'kill',
  AMMO: 'ammo', // {w, ammo}
  GRENADE: 'grenade', // {g, t, id, o, v}: bomba atıldı
  BOOM: 'boom', // {g, t, p}: bomba patladı / sis açıldı
  SPRAYED: 'sprayed', // {id, c, p, n}
  HOOKED: 'hooked', // {id, p} kanca halatı (p=null: bırakıldı)
  BLIND: 'blind', // {ms, k: 0..1 şiddet} flaş gözünü aldı
  FROZEN: 'frozen', // {ms} dondun
  LOADOUT: 'loadout', // {loadout, ammo, nades, now}: seçim uygulandı (now=false ise sonraki doğuşta)
  FLAG: 'flag', // {team, ev:'take'|'drop'|'return'|'capture', by, s}: bayrak olayı (CTF)
  MARKED: 'marked', // {id, p, e}: takım arkadaşının işareti
  DROP: 'drop', // {id, p}: mermi kutusu düştü
  PICKUP: 'pickup', // {id, by, reserve?}: mermi kutusu alındı / süresi doldu (by=null)
  REWARD: 'reward', // {hp?, reserve, kill?}: FFA öldürme ödülü / şarjör bitmesin diye verilen yedek
  MATCH_END: 'match_end',
  CHAT_MSG: 'chat_msg', // {id, n, tm, t, team, dead}
  VOTE_STATE: 'vote_state', // {active, by, yes, no, total, left, voters:[id], result?: 'restart'|'rejected'}
  SPING: 'sping', // sunucunun ping ölçümü (ack ile)
};
