# COMIC STRIKE WEB

Tarayıcıda oynanan, çizgi roman görünümlü multiplayer FPS. 4v4 Team Deathmatch, oda kodu ile lobi, sunucu doğrulamalı hasar ve skor.

## Gereksinimler
- Node.js 20 veya üstü (`node -v`)
- Chrome / Edge / Opera

## Hızlı başlangıç (PowerShell, proje klasöründe)

```powershell
npm install
npm run dev
```
Tarayıcıda **http://localhost:5173** aç → isim yaz → **CREATE ROOM** → **START MATCH** → **CLICK TO FIGHT**.

### Tek başına test (botlarla)
Lobideyken ikinci bir PowerShell penceresi aç:
```powershell
npm run bots -- ODAKODU 3
```
3 bot odaya katılıp hazır olur. Botlar spawn çevresinde gezinir ve görüş hattındaki rakiplere ateş eder.

### Aynı ağdaki arkadaşlarla oynamak
```powershell
npm run build
npm start
```
Sen **http://localhost:3000**, arkadaşların **http://BILGISAYAR_IP:3000** adresini açar (`ipconfig` → IPv4). Windows Güvenlik Duvarı izin isterse “Özel ağlar”a izin ver.

İnternet üzerinden yayınlamak için: [docs/DEPLOY.md](docs/DEPLOY.md)

## Komutlar
| Komut | Ne yapar |
|---|---|
| `npm install` | Tüm paketleri kurar |
| `npm run dev` | Geliştirme: sunucu (3000) + Vite (5173), dosya değişince yenilenir |
| `npm run build` | İstemciyi `client/dist` içine derler |
| `npm start` | Production: oyun ve sunucu tek adreste (3000) |
| `npm run bots -- KOD [sayı] [adres]` | Test botları |

## Kontroller
| Tuş | Eylem |
|---|---|
| WASD | Hareket |
| Fare | Bakış |
| Shift | Koş |
| Space | Zıpla |
| Sol tık | Ateş |
| R | Şarjör değiştir |
| Tab | Skor tablosu |
| Esc | Menü (duraklat) |

## Ayarlanabilir değerler
Oyun dengesi `shared/constants.js` içinde: can, hız, silah hasarı, ateş hızı, şarjör, skor limiti, maç süresi, spawn koruması.
Harita `shared/map.js` içinde: kutu listesi + spawn noktaları.

Sunucu ortam değişkenleri:
- `PORT`: varsayılan 3000
- `MIN_PLAYERS`: maçı başlatmak için en az oyuncu (varsayılan 1; gerçek maçlar için 4)

## Yapı
```
shared/   ortak sabitler, mesaj isimleri, harita (istemci + sunucu)
server/   Express + Socket.IO, authoritative oyun sunucusu
client/   Vite + Three.js + Rapier istemcisi
tools/    test botları
docs/     mimari, ağ protokolü, yayına alma
```
Ayrıntılar: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/PROTOCOL.md](docs/PROTOCOL.md)

## İlerleme
- [x] Phase 1: Proje kurulumu ve klasör yapısı
- [x] Phase 2: Three.js sahne ve FPS kamera (Pointer Lock)
- [x] Phase 3: Hareket (Rapier karakter kontrolcüsü: yürü, koş, zıpla, çarpışma, basamak)
- [x] Phase 4: Silah (hitscan, şarjör, reload, geri tepme, dağılma, sesler)
- [x] Phase 5: Socket.IO multiplayer altyapısı
- [x] Phase 6: Senkronizasyon (client prediction + interpolation + sunucu düzeltmesi)
- [x] Phase 7: Hasar, ölüm, respawn (sunucuda, lag compensation ile)
- [x] Phase 8: Team Deathmatch (skor limiti, süre, maç sonu ekranı)
- [x] Phase 9: Ana menü, oda kodu, lobi, takım seçimi, hazır durumu
- [x] Phase 10: Çizgi roman grafikleri (toon shading, kontur, halftone, KAPOW efektleri)
- [x] Phase 11: Production build, chunk ayırma, yayına alma rehberi

## Bilinen sınırlamalar (ilk sürüm)
- Oyuncular birbirinin içinden geçebilir (oyuncu-oyuncu çarpışması yok).
- Sunucu hareket hızını ve harita sınırlarını kontrol eder, ama duvar içinden geçmeyi kontrol etmez.
- Tek silah, tek harita.
