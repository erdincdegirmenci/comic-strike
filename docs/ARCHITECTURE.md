# Mimari

## Genel bakış
```
 Tarayıcı (client)                         Node.js (server)
 ┌──────────────────────────┐   Socket.IO   ┌──────────────────────────┐
 │ Menu / Lobby (DOM)       │ ◄───────────► │ RoomManager              │
 │ Game                     │   websocket   │  └─ Room (oda başına)     │
 │  ├─ LocalPlayer (Rapier) │               │      ├─ Player            │
 │  ├─ RemotePlayer (interp)│               │      ├─ 20 Hz tick        │
 │  ├─ Weapon (viewmodel)   │               │      └─ HitScan           │
 │  ├─ Effects              │               └──────────────────────────┘
 │  └─ HUD (DOM)            │                         ▲
 │ Renderer (Three.js)      │                         │
 └──────────────────────────┘                         │
              ▲            shared/ (constants, protocol, map)
              └───────────────────────────────────────┘
```

## Kim neye karar verir?
| Konu | Karar veren |
|---|---|
| Kendi hareketin | İstemci hesaplar; sunucu hız/sınır kontrolü yapar, şüpheliyse `correction` ile geri çeker |
| Atış yönü | İstemci gönderir |
| İsabet, hasar, ölüm, skor | **Sunucu** |
| Mühimmat, reload süresi, ateş hızı | **Sunucu** (istemci sadece tahmin eder) |
| Doğma yeri ve zamanı | **Sunucu** |
| Maç süresi ve bitişi | **Sunucu** |

## Akıcılık teknikleri
- **Client prediction:** Yerel oyuncu Rapier ile anında hareket eder, sunucuyu beklemez.
- **Interpolation:** Diğer oyuncular `INTERP_DELAY` (100 ms) geriden, iki snapshot arasında yumuşatılarak gösterilir.
- **Lag compensation:** Sunucu her oyuncunun son 1 saniyelik pozisyon geçmişini tutar. Atış gelince hedefleri `şimdi − (ping + 100 ms)` anına geri sarar ve ışını orada test eder. Böylece ekranda vurduğun yere isabet edersin.

## Grafik
- `MeshToonMaterial` + 3 tonlu gradient → çizgi film gölgelendirme.
- Kontur: her nesnenin biraz büyütülmüş, arka yüzü çizilen siyah kopyası ("inverted hull").
- Harita kutuları üç mesh'e birleştirilir (renk, kontur, kenar çizgileri) → haritanın tamamı 3 draw call.
- Halftone nokta deseni ve vinyet tek bir CSS katmanı (GPU maliyeti yok).
- Silah ayrı bir sahnede, derinlik temizlenerek çizilir (duvara girmez).
- Efekt dokuları (yıldız, mürekkep, duman, "KAPOW!") canvas ile çizilir; harici görsel dosya yok.
- Sesler WebAudio ile anlık üretilir; harici ses dosyası yok.

## Dosyalar
| Dosya | Görev |
|---|---|
| `shared/constants.js` | Tüm denge değerleri |
| `shared/protocol.js` | Mesaj isimleri |
| `shared/map.js` | City Arena: kutular + spawn noktaları (Z eksenine göre aynalı) |
| `server/src/RoomManager.js` | Oda oluşturma/katılma, olay yönlendirme |
| `server/src/Room.js` | Lobi, maç durumu, girdi doğrulama, hasar, skor, snapshot |
| `server/src/HitScan.js` | Işın-kutu / ışın-küre testleri |
| `client/src/main.js` | Açılış, ana döngü |
| `client/src/Game.js` | Maç içi istemci mantığı ve ağ olayları |
| `client/src/ui/Menu.js` | Menüler, lobi, uygulama akışı |
| `client/src/ui/HUD.js` | Can, mühimmat, skor, süre, kill feed, skor tablosu |
| `client/src/world/MapBuilder.js` | Haritayı görsel + fizik olarak kurar |
| `client/src/player/*` | Yerel oyuncu, uzak oyuncular, silah |
| `client/src/fx/*` | Toon materyaller, efektler, bomba yörünge önizlemesi (`Trajectory.js`) |
