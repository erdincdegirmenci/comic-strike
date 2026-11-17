// Socket.IO mesaj isimleri. Yazım hatalarını önlemek için her yerde buradan kullanılır.
// Ayrıntılı açıklama: docs/PROTOCOL.md
export const MSG = {
  // istemci → sunucu
  CREATE_ROOM: 'create_room', // {name} → ack {ok, code}
  JOIN_ROOM: 'join_room', // {name, code} → ack {ok, code | error}
  QUICK_PLAY: 'quick_play', // {name} → ack {ok, code}
  LEAVE_ROOM: 'leave_room',
  SET_TEAM: 'set_team', // 'red' | 'blue'
  SET_READY: 'set_ready', // boolean
  SET_MAP: 'set_map', // 'city' | 'pool' | 'frost' (sadece host, lobide)
  START_MATCH: 'start_match',
  INPUT: 'input', // {l, p:[x,y,z], y, pi, f}
  SHOOT: 'shoot', // {d:[x,y,z], h?:1 (bıçak ağır saldırı)}
  RELOAD: 'reload',
  SWITCH: 'switch', // 'rifle' | 'awp' | 'knife' | 'he' | 'smoke'
  THROW: 'throw', // {d:[x,y,z]} elindeki bombayı at
  SPRAY: 'spray', // {p:[x,y,z], n:[x,y,z]} duvara sticker
  SET_LOADOUT: 'set_loadout', // {primary, pistol, nade}

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
  LOADOUT: 'loadout', // {loadout, ammo, nades, now}: seçim uygulandı (now=false ise sonraki doğuşta)
  MATCH_END: 'match_end',
  SPING: 'sping', // sunucunun ping ölçümü (ack ile)
};
