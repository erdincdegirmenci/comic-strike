# İnternette yayınlama (Phase 11)

Oyun tek bir Node.js uygulamasıdır: aynı sunucu hem oyun dosyalarını hem Socket.IO'yu sunar. WebSocket destekleyen her Node barındırma servisi çalışır.

## Seçenek A: Render.com (en kolay, ücretsiz katman var)
1. Projeyi bir GitHub deposuna yükle:
   ```powershell
   git init
   git add .
   git commit -m "Comic Strike Web"
   git branch -M main
   git remote add origin https://github.com/KULLANICI/comic-strike-web.git
   git push -u origin main
   ```
2. https://render.com → **New → Blueprint** → depoyu seç. Projedeki `render.yaml` her şeyi otomatik ayarlar.
   Elle kurmak istersen **New → Web Service** seç ve şunları gir:
   - Build Command: `npm install --include=dev && npm run build`
   - Start Command: `npm start`
   - Environment: `NODE_VERSION=22`, `MIN_PLAYERS=2`
3. Deploy bitince `https://comic-strike-web-xxxx.onrender.com` adresini arkadaşlarına gönder.

> Ücretsiz katmanda sunucu 15 dakika kullanılmazsa uyur. İlk açılış yaklaşık 1 dakika sürebilir.

## Seçenek B: Railway / Fly.io / kendi VPS'in
Aynı iki komut yeterli:
```
npm install --include=dev && npm run build
npm start
```
Sunucu `PORT` ortam değişkenini otomatik kullanır.

## Performans notları
- `npm run build`, Three.js ve Rapier'i ayrı dosyalara böler. Oyun kodu güncellense bile tarayıcı bu büyük dosyaları önbellekten kullanır.
- `assets/` dosyaları 1 yıl, `index.html` hiç önbelleğe alınmaz. Böylece güncellemeler hemen görünür.
- Oyuncular yavaş bilgisayarda **Settings → Graphics → LOW** seçebilir: gölgeler kapanır, çözünürlük 1x olur.
- Sunucu oda başına 20 Hz çalışır. 8 oyunculu bir oda çok az CPU kullanır, tek sunucu onlarca odayı kaldırır.
- Oyuncular sunucuya coğrafi olarak yakın olmalı (Türkiye için Frankfurt bölgesi iyi bir seçim).
