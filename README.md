# ComicStrike

Çizgi roman görünümlü, tarayıcıda oynanan LAN FPS.
Sunucu senin Windows bilgisayarında tek bir EXE olarak çalışır. Arkadaşların aynı Wi-Fi'dan tarayıcıyla bağlanır, hiçbir şey kurmaz.

> **Şu anki durum (v0.2, Aşama 1):** C# sunucu ve tek EXE altyapısı hazır. Oyun şimdilik **tek kişilik test modunda**. Multiplayer Aşama 5'te SignalR ile gelecek.

## Senin bilgisayarında gerekenler (sadece geliştirme için)
- **.NET SDK 10**: `dotnet --version`
- **Node.js 20+**: `node -v`. Sadece oyunu derlemek için gerekir, oyun çalışırken kullanılmaz.

Oyuncuların bilgisayarında sadece güncel Chrome, Edge veya Opera yeterli.

## Komutlar (PowerShell, proje klasöründe)

| Komut | Ne yapar |
|---|---|
| `npm install` | İlk seferde bir kez: JavaScript paketlerini kurar |
| `npm run dev` | Geliştirme modu: C# sunucu (5000) + Vite (5173). **http://localhost:5173** aç. Kod değişince yenilenir. |
| `npm run build` | Oyunu derler, C# projesinin `game` klasörüne koyar |
| `npm run server` | Derlenmiş oyunu C# sunucuyla çalıştırır → **http://localhost:5000** |
| `npm run publish` | **Tek EXE üretir:** `publish\ComicStrike.exe` |

## Arkadaşlarla oynamak (aynı Wi-Fi)
1. `npm run publish` → `publish\ComicStrike.exe` oluşur. Bu dosyayı istediğin yere taşıyabilirsin, tek başına çalışır.
2. `ComicStrike.exe`'ye çift tıkla. Konsolda şöyle bir adres görürsün:
   ```
   Arkadaşların tarayıcısına bunu yazsın:
       http://192.168.1.25:5000
   ```
3. Windows Güvenlik Duvarı sorarsa **Özel ağlar** için izin ver.
4. Arkadaşların bu adresi tarayıcıya yazar.

Sorun çıkarsa: [docs/LAN.md](docs/LAN.md)

EXE seçenekleri: `ComicStrike.exe --port 5050` farklı port açar, `--no-browser` tarayıcıyı otomatik açmaz.

## Kontroller
WASD hareket · Fare bakış · Shift koş · Space zıpla · Sol tık ateş · R şarjör · Tab skor · Esc menü

## Yapı
```
server/ComicStrike.Server/   C# ASP.NET Core sunucu (EXE)
  Program.cs                 başlangıç, port, tarayıcıyı açma
  EmbeddedGameFiles.cs       oyun dosyalarını EXE'nin içinden sunar
  Banner.cs                  konsola yerel IP adreslerini yazar
  game/                      (npm run build çıktısı, EXE'ye gömülür)
client/                      Three.js + Rapier tarayıcı oyunu
shared/                      oyun ayarları ve harita
docs/                        dokümanlar
```

## Yol haritası
- [x] **Aşama 1** — Analiz + C# sunucu iskeleti + tek EXE + sade menü
- [ ] Aşama 2 — Hareket: eğilme (Ctrl), stamina ve koşma
- [ ] Aşama 3 — Pool Day esintili fun map: merdivenler, platformlar, tüneller
- [ ] Aşama 4 — Silahlar: Keleş, el bombası, bıçak; mermi sistemi; sekme
- [ ] Aşama 5 — Multiplayer: SignalR, FFA, sunucu doğrulaması
- [ ] Aşama 6 — Ölüm, skor, kill feed, TAB tablosu, mermi ödülü
- [ ] Aşama 7 — Görsel kalite ve ses
- [ ] Aşama 8 — 2/4/8 oyuncu testleri, performans, final EXE
