# COMIC STRIKE WEB

Tarayıcıda oynanan, çizgi roman görünümlü multiplayer FPS. 4v4 Takım Savaşı veya Bayrak Kapmaca, pratik botları, oda kodu ile lobi, sunucu doğrulamalı hasar ve skor.

Oyna

https://comic-strike.onrender.com/

Linke tıkla, tarayıcıdan oyuna gir. Kurulum gerekmez.

Sunucu bir süre kullanılmazsa uyku moduna geçebilir. İlk açılışta sayfa yüklenirken biraz bekleyebilirsin (yaklaşık 30-50 saniye).

Sunucunun ayakta olup olmadığını şuradan görebilirsin: https://comic-strike.onrender.com/api/health

## Gereksinimler

- Node.js 20 veya üstü (`node -v`)
- Chrome / Edge / Opera

## Hızlı başlangıç (PowerShell, proje klasöründe)

```powershell
npm install
npm run dev
```

Tarayıcıda **http://localhost:5173** aç → isim yaz → **CREATE ROOM** → **START MATCH** → **CLICK TO FIGHT**.

### Odalar

Ana menünün yanında **AÇIK ODALAR** listesi var: aktif odalar (mod, harita, oyuncu sayısı, lobide / maçta) görünür, tıklayınca girilir. 🔒 olan odalar şifrelidir, girerken şifre sorulur.
**CREATE ROOM** ile oda kurarken **herkese açık** ya da **şifreli** seçilir; **takım ateşi** (takım arkadaşını da vurabilme, arkadaş öldürmek −3 puan) açılıp kapatılabilir. Host lobide takım ateşini değiştirebilir, botları **sürükleyip** diğer takıma bırakabilir.

**Maçı baştan başlatma:** host maç sırasında Esc menüsündeki **↺ MAÇI BAŞTAN BAŞLAT** ile oylama açar (sonradan gelenler puanda geride kalmasın diye). Herkesin ekranına oylama çıkar; oyuncuların (botlar hariç) yarısından fazlası EVET derse puanlar sıfırlanır ve maç baştan başlar. 20 saniyede çoğunluk çıkmazsa oylama reddedilir.

### Tek başına pratik (botlarla)

Lobide host olarak **+ BOT EKLE** düğmesine bas; her basışta az kalabalık takıma bir bot eklenir (en fazla 8 oyuncu). **− BOT ÇIKAR** ile çıkarırsın.
Botlar sunucuda çalışır: haritada yol bulur (A\*), gördüğü rakibe ateş eder; Bayrak Kap modunda bir kısmı saldırır, bir kısmı üssü korur.

Eski yöntem (ayrı süreçte basit test botları) hâlâ çalışır: `npm run bots -- ODAKODU 3`

### Aynı ağdaki arkadaşlarla oynamak

```powershell
npm run build
npm start
```

Sen **http://localhost:3000**, arkadaşların **http://BILGISAYAR_IP:3000** adresini açar (`ipconfig` → IPv4). Windows Güvenlik Duvarı izin isterse “Özel ağlar”a izin ver.

İnternet üzerinden yayınlamak için: [docs/DEPLOY.md](docs/DEPLOY.md)

## Komutlar

| Komut                                | Ne yapar                                                           |
| ------------------------------------ | ------------------------------------------------------------------ |
| `npm install`                        | Tüm paketleri kurar                                                |
| `npm run dev`                        | Geliştirme: sunucu (3000) + Vite (5173), dosya değişince yenilenir |
| `npm run build`                      | İstemciyi `client/dist` içine derler                               |
| `npm start`                          | Production: oyun ve sunucu tek adreste (3000)                      |
| `npm run bots -- KOD [sayı] [adres]` | Test botları                                                       |

## Kontroller

| Tuş            | Eylem                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| WASD           | Hareket                                                                  |
| Fare           | Bakış                                                                    |
| Shift          | Hızlı koş (stamina harcar)                                               |
| Space          | Zıpla                                                                    |
| Ctrl / C       | Çömel                                                                    |
| Sol tık        | Ateş · bombada basılı tut (ne kadar uzun, o kadar uzağa), bırakınca atar |
| Sağ tık        | Nişan al · AWP dürbünü (2 seviye) · bıçakta ağır saldırı                 |
| 1 / 2 / 3 / 4  | Ana silah / tabanca / bıçak / bomba                                      |
| B              | Silah seçimi (ana silah + tabanca + bomba)                               |
| Fare tekeri    | Silah değiştir                                                           |
| Q              | Son seçilen iki silah arasında hızlı geçiş (daha kısa çekme süresi)     |
| T              | Karakterine özel sticker'ı duvara yapıştır                               |
| E / orta tık   | Takıma işaret ("BURADA!", rakibe bakıyorsan "DÜŞMAN!")                   |
| R              | Şarjör değiştir                                                          |
| Tab            | Skor tablosu (öldürme / asist / ölüm / puan)                             |
| Enter          | Sohbet (herkese)                                                         |
| Y              | Takım sohbeti                                                            |
| F1 / F2        | Baştan başlatma oylamasında EVET / HAYIR                                 |
| Esc            | Menü (duraklat)                                                          |

## Puanlama ve maç sonu

- **Öldürme +3, asist +1, ölüm −1.** Asist: rakibi vurdun ama öldüremedin, rakip 5 saniye içinde başkasının elinden öldü.
- Sağ üstteki öldürme akışında öldürenin silahının resmi gösterilir; ölene son 5 saniyede hasar veren başka oyuncular da kendi silahlarının resmiyle "+ isim" olarak yazılır.
- Lobide host **bitiş puanını** (Bayrak Kap'ta bayrak sayısını) ve **süreyi** seçer; hangisine önce ulaşılırsa maç biter. Takım Savaşı'nda takım puanı, Herkes Tek'te oyuncu puanı sayılır.

## Oyun modları

- **Takım Savaşı** (varsayılan): 30 öldürmeye ilk ulaşan takım kazanır.
- **Bayrak Kap**: rakip bayrağını kendi üssündeki halkaya getir; 3 bayrak getiren kazanır. Taşıyan ölürse bayrak düşer, sahibi dokunursa üsse döner (20 sn sonra kendiliğinden döner). Lobide host seçer.
- **Herkes Tek** (FFA): takım yok, herkes herkese rakip; 20 öldürmeye ilk ulaşan kazanır. Her öldürmede **+25 can** (100'ü geçmez) ve öldürdüğün silaha **+1 şarjör**. Şarjör hiç tamamen bitmez: son mermiyi atınca bir şarjör yedek gelir. Ölünce can ve mermi başlangıca döner. Her haritada oynanabilir.

Sol üstte oyuncuyla birlikte dönen **mini harita** var: takım arkadaşları her zaman, rakipler ateş ettikten sonra kısa süre görünür. Oyuncular birbirinin içinden geçemez.

**Zıplama pedleri** (yeşil oklu diskler): üstüne basınca seni çatılara, platformlara ve konteynerlerin üstüne fırlatır; pedden inişte düşme hasarı yok.
**Eğilerek geçilen yerler**: tır dorsesinin altı, çit kemerleri, kale duvarındaki gizli delik, boru rafı, havada duran konteyner, havalandırma deliği… Ayakta geçilmez, **Ctrl / C** ile çömelince geçilir.

Maç sonunda ödüller: TERMİNATÖR (en çok öldüren), KESKİN NİŞANCI (en çok kafadan vuruş), BAYRAK USTASI (Bayrak Kap'ta en çok bayrak getiren) ve en çok ölene KURŞUN MIKNATISI.

## Ayarlanabilir değerler

Oyun dengesi `shared/constants.js` içinde: can, hız, silah hasarı, ateş hızı, şarjör, skor limiti, maç süresi, spawn koruması.
Haritalar `shared/maps.js` içinde (City Arena `shared/map.js`): kutu listesi, doğuş noktaları, bayrak üsleri ve zıplama pedleri. Lobide host haritayı seçer: CITY ARENA, POOL PARTY, FROST ARENA (buz zemini kaygan) ve HURDALIK (en büyük harita, tüm modlarda; takım modlarında kırmızı güneyde, mavi kuzeyde doğar: yüksek platform ve köprüler, depo, iskele, konteyner sahası, boru rafı, iki katlı ofis, basamaklı hurda tepesi).

Eğlence haritaları (`shared/funmaps.js`): **NİŞANCI DÜELLOSU** (uzun vadi, sadece AWP), **NİŞAN ARENASI** (küçük simetrik avlu, hızlı çatışma), **AVLU** (karşılıklı iki ev ve aradaki pazar avlusu), **DEV ODA** (minicik oyuncular dev bir masanın çevresinde; kitap merdivenle masanın üstüne çıkılır).

Her klasik haritada **yer altı tünelleri** var (`shared/tunnel.js`): sarı korkuluklu merdivenle inilir, aydınlatmalı koridordan karşı tarafa geçilir. City: köşe evi ↔ köşe evi ve yol ↔ yol; Pool Party: havuzun iki yanındaki yollar; Frost: iglu ↔ iglu (iki tane); Hurdalık: iskele ↔ depo ve ofis ↔ konteyner sahası (ortada kavşak). Botlar tünel kullanmaz, düşerlerse en yakın merdivenden çıkar.

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

- Sunucu hareket hızını ve harita sınırlarını kontrol eder, ama duvar içinden geçmeyi kontrol etmez.
- Botlar merdiven çıkmaz, çatılara ve surlara çıkmazlar; zemin katta dolaşırlar.
