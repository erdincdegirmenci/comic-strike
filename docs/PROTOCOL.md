# Ağ protokolü (Socket.IO)

Mesaj isimleri `shared/protocol.js` içindedir.

## İstemci → Sunucu
| Mesaj | Veri | Not |
|---|---|---|
| `create_room` | `{name}` | ack: `{ok, code}` |
| `join_room` | `{name, code}` | ack: `{ok, code}` veya `{ok:false, error}` |
| `quick_play` | `{name}` | Açık bir herkese açık odaya girer, yoksa oluşturur |
| `leave_room` | — | |
| `set_team` | `'red' \| 'blue'` | Sadece lobide |
| `set_ready` | `boolean` | |
| `start_match` | — | Sadece host; herkes hazır olmalı |
| `input` | `{l, p:[x,y,z], y, pi, f}` | 30/sn. `l`=life no, `p`=ayak pozisyonu, `y`=yaw, `pi`=pitch, `f`=bayraklar (1 hareket, 2 koşu, 4 havada) |
| `shoot` | `{d:[x,y,z]}` | Atış yönü (dağılma dahil) |
| `reload` | — | |

## Sunucu → İstemci
| Mesaj | Veri |
|---|---|
| `room_state` | `{code, hostId, state, isPublic, scores, minPlayers, maxPlayers, maxPerTeam, players:[{id,name,team,ready,kills,deaths}]}` |
| `notice` | metin (ör. "Herkes hazır değil.") |
| `match_start` | `{roster, scores, scoreLimit, timeLeft, countdown}` |
| `snapshot` | 20/sn: `{t, st, tl, cd, s:[red,blue], p:[[id,x,y,z,yaw,pitch,hp,alive,flags,rtt,kills,deaths], ...]}` |
| `respawn` | `{id, p, yaw, life, ammo}` |
| `correction` | `{p, l}`: sunucu hareketini kabul etmedi, bu konuma dön |
| `shot` | `{id, o, e}`: başka bir oyuncu ateş etti (iz ve ses için) |
| `hit` | `{v, d, h, k, pt}`: sadece ateş edene, isabet onayı |
| `damaged` | `{hp, from}`: sadece vurulana |
| `kill` | `{k, v, h, s}`: herkese, kill feed ve skor |
| `ammo` | `{ammo}`: reload tamamlandı |
| `match_end` | `{winner, scores, players}` |
| `sping` | ack ile ping ölçümü |

## Oda durumları
`lobby → countdown (3 sn) → playing → ended (8 sn) → lobby`
