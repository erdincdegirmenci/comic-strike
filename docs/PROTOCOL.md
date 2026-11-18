# Ağ protokolü (Socket.IO)

Mesaj isimleri `shared/protocol.js` içindedir.

## İstemci → Sunucu
| Mesaj | Veri | Not |
|---|---|---|
| `create_room` | `{name, char}` | ack: `{ok, code}`. `char`: karakter id (`max`, `ziggy`, `roxy`, `bones`) |
| `join_room` | `{name, char, code}` | ack: `{ok, code}` veya `{ok:false, error}` |
| `quick_play` | `{name, char}` | Açık bir herkese açık odaya girer, yoksa oluşturur |
| `leave_room` | — | |
| `set_team` | `'red' \| 'blue'` | Sadece lobide |
| `set_ready` | `boolean` | |
| `set_map` | `'city' \| 'pool' \| 'frost'` | Sadece host, lobide |
| `start_match` | — | Sadece host; herkes hazır olmalı |
| `input` | `{l, p:[x,y,z], y, pi, f}` | 30/sn. `l`=life no, `p`=ayak pozisyonu, `y`=yaw, `pi`=pitch, `f`=bayraklar (1 hareket, 2 koşu, 4 havada, 8 çömelmiş, 16 dürbün) |
| `shoot` | `{d:[x,y,z], h?}` | Atış yönü (dağılma dahil). Bıçakta `h:1` ağır saldırı |
| `reload` | — | Elindeki silahı doldurur |
| `switch` | `'rifle' \| 'awp' \| 'knife' \| 'he' \| 'smoke'` | Silah değiştir |
| `throw` | `{d:[x,y,z], c}` | Elindeki bombayı at. `c` 0..1: basılı tutma oranı (uzaklık) |
| `spray` | `{p, n}` | Duvara sticker (nokta + yüzey normali) |
| `set_loadout` | `{primary, pistol, nade}` | Silah seçimi. Doğuştan sonra 10 sn içinde ve ateş etmeden hemen, yoksa sonraki doğuşta |
| `set_mode` | `'tdm' \| 'ctf' \| 'ffa'` | Oyun modu (sadece host, lobide). Herkes Tek'te tüm oyuncuların takımı `ffa` olur; HURDALIK seçilince mod otomatik `ffa` |
| `fall` | `{v}` | Yere sert iniş hızı (m/s). Hasarı sunucu hesaplar, üst sınırlı (`FALL` sabitleri) |

## Sunucu → İstemci
| Mesaj | Veri |
|---|---|
| `room_state` | `{code, hostId, state, isPublic, scores, minPlayers, maxPlayers, maxPerTeam, players:[{id,name,team,ready,kills,deaths}]}` |
| `notice` | metin (ör. "Herkes hazır değil.") |
| `match_start` | `{map, roster, scores, scoreLimit, timeLeft, countdown}` |
| `snapshot` | 20/sn: `{t, st, tl, cd, s:[red,blue], p:[[id,x,y,z,yaw,pitch,hp,alive,flags,rtt,kills,deaths,weaponIndex], ...]}` |
| `respawn` | `{id, p, yaw, life, ammo:{rifle,awp}, reserve:{rifle,awp}, nades:{he,smoke}, pr}` — `pr`: kalan doğuş koruması (ms). Snapshot bayraklarında `32` = korumalı |
| `correction` | `{p, l}`: sunucu hareketini kabul etmedi, bu konuma dön |
| `shot` | `{id, o, e, w}`: başka bir oyuncu ateş etti (iz ve ses için) |
| `hit` | `{v, d, h, k, pt}`: sadece ateş edene, isabet onayı |
| `damaged` | `{hp, from}`: sadece vurulana |
| `kill` | `{k, v, h, w, s}`: herkese, kill feed ve skor (`w` silah) |
| `ammo` | `{w, ammo, res}`: reload tamamlandı |
| `reward` | `{hp?, reserve, w, kill?}`: Herkes Tek öldürme ödülü (`kill:1`) ya da şarjör bitmesin diye verilen yedek |
| `flag` | `{team, ev, by, s}`: CTF bayrak olayı — `ev`: `take` (kapıldı) · `drop` (taşıyıcı öldü) · `return` (üsse döndü) · `capture` (sayı). Snapshot'ta `f: [[durum, taşıyıcıId, x, y, z] ×2]` (durum 0 üste, 1 taşınıyor, 2 yerde) |
| `grenade` | `{g, t, id, o, v}`: bomba atıldı; herkes `shared/grenade.js` ile aynı yörüngeyi hesaplar |
| `boom` | `{g, t, p}`: bomba patladı / sis açıldı |
| `sprayed` | `{id, c, p, n}`: sticker yapıştırıldı |
| `loadout` | `{loadout, ammo, nades, now}`: silah seçimi kaydedildi (`now` = hemen uygulandı) |
| `match_end` | `{winner, scores, players}` |
| `sping` | ack ile ping ölçümü |

## Oda durumları
`lobby → countdown (3 sn) → playing → ended (8 sn) → lobby`
