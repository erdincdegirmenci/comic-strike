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
  START_MATCH: 'start_match',
  INPUT: 'input', // {l, p:[x,y,z], y, pi, f}
  SHOOT: 'shoot', // {d:[x,y,z]}
  RELOAD: 'reload',

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
  AMMO: 'ammo',
  MATCH_END: 'match_end',
  SPING: 'sping', // sunucunun ping ölçümü (ack ile)
};
