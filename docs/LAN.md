# Yerel ağda (Wi-Fi) oynama rehberi

## Normal kurulum
1. `ComicStrike.bat`'a çift tıkla. Konsol penceresi açık kalmalı, kapatırsan sunucu da kapanır.
2. Konsolda yazan `http://192.168.x.x:3000` adresini arkadaşlarına ver.
3. Hepiniz aynı Wi-Fi'da olmalısınız.

## Arkadaşım bağlanamıyor

**1. Güvenlik duvarı (en sık sebep)**
Sunucu ilk açıldığında Windows, Node.js için izin sorar. Yanlışlıkla "İptal" dediysen PowerShell'i **yönetici olarak** aç ve şunu çalıştır:
```powershell
New-NetFirewallRule -DisplayName "ComicStrike" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

**2. Ağ "Ortak" olarak işaretli**
Ayarlar → Ağ ve İnternet → Wi-Fi → bağlı ağ → Ağ profili türü: **Özel**.

**3. Yanlış IP**
Konsolda birden fazla adres varsa ilkini dene. Emin değilsen PowerShell'de `ipconfig` yaz. "Kablosuz LAN bağdaştırıcısı Wi-Fi" altındaki **IPv4 Adresi** doğru adrestir.

**4. Misafir ağı / AP izolasyonu**
Bazı modemlerin misafir ağı cihazların birbirini görmesini engeller. Ana Wi-Fi ağını kullanın.

**5. Port dolu**
"3000 portu kullanımda" mesajı görürsen `npm start -- --port 3050` ile başlat. Adres de `:3050` olur.

## Hızlı kontrol
Arkadaşının tarayıcısında `http://SENIN_IP:3000/api/health` adresi açılıyorsa bağlantı sorunsuz demektir.
