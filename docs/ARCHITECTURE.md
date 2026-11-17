# Mimari (v0.3)

```
 Oyuncunun tarayıcısı                      Senin bilgisayarın
 ┌────────────────────────────┐   HTTP    ┌──────────────────────────────┐
 │ Three.js (çizim)           │ ◄──────── │ Node.js sunucu (:3000)       │
 │ Rapier (hareket/çarpışma)  │           │  ├─ client/dist dosyaları    │
 │ Menü + HUD (HTML/CSS)      │ Socket.IO │  ├─ /api/health              │
 │                            │ ◄ ─ ─ ─ ► │  └─ oyun mantığı (Aşama 5)   │
 └────────────────────────────┘ (Aşama 5) └──────────────────────────────┘
```

## Nasıl çalışıyor?
1. `npm run build`: Vite, `client/` klasöründeki JavaScript'i paketleyip `client/dist` klasörüne yazar.
2. `npm start`: Node.js sunucu `client/dist` dosyalarını sunar ve konsola yerel ağ adreslerini yazar. Windows'ta tarayıcıyı da açar.
3. `ComicStrike.bat`: bu iki adımı (gerekirse `npm install` ile birlikte) tek çift tıklamada yapar.

## Geliştirme modu
`npm run dev` iki programı birlikte başlatır:
- `node --watch`: sunucu, kod değişince yeniden başlar (port 3000).
- `vite`: tarayıcı oyunu, kod değişince sayfa anında güncellenir (port 5173). `/api` ve `/socket.io` isteklerini 3000'e yönlendirir.

## Planlanan oyun mimarisi (Aşama 2–6)
- **Sunucu otoritesi:** hasar, ölüm, skor, mermi, stamina, koşma hızı ve ateş hızı sunucuda hesaplanır.
- **Sekme ve dağılma sunucuda:** tarayıcı sadece nişan yönünü yollar. Sunucu oyuncunun durumuna göre (koşuyor, eğiliyor, havada, art arda ateş) dağılmayı ekler. Böylece sekme herkes için aynı olur.
- **Ortak harita ve ayarlar:** `shared/` klasörü hem tarayıcıda hem sunucuda kullanılır. Haritayı ve denge değerlerini tek yerden değiştirirsin.
- **LAN ayarları:** sunucu saniyede 30 güncelleme yapacak, diğer oyuncular 50 ms geriden gösterilecek.

## v0.1 → v0.3 değişiklikleri
- Oda kodu, lobi ve takım seçimi kaldırıldı: tek sunucu, herkes herkese (FFA).
- İnternette yayınlama (Render) kaldırıldı: sadece yerel ağ.
- Test botları kaldırıldı. Aşama 8'de 8 oyuncu testleri için yeniden eklenecek.
- (v0.2'de denenen C# sunucu, isteğin üzerine kaldırıldı.)
