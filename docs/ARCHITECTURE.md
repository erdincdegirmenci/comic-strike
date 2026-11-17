# Mimari (v0.2)

```
 Oyuncunun tarayıcısı                      Senin bilgisayarın
 ┌────────────────────────────┐   HTTP    ┌────────────────────────────────┐
 │ Three.js (çizim)           │ ◄──────── │ ComicStrike.exe                │
 │ Rapier (hareket/çarpışma)  │           │  ASP.NET Core (Kestrel :5000)  │
 │ Menü + HUD (HTML/CSS)      │  SignalR  │  ├─ Gömülü oyun dosyaları      │
 │                            │ ◄ ─ ─ ─ ► │  ├─ /api/health                │
 └────────────────────────────┘ (Aşama 5) │  └─ GameHub (Aşama 5)          │
                                          └────────────────────────────────┘
```

## Nasıl çalışıyor?
1. `npm run build`: Vite, `client/` klasöründeki JavaScript'i birkaç dosyaya paketler ve `server/ComicStrike.Server/game/` içine yazar.
2. `dotnet build/publish`: `.csproj` bu dosyaları **EXE'nin içine gömer** (EmbeddedResource).
3. EXE açılınca `EmbeddedGameFiles` gömülü dosyaları belleğe okur ve tarayıcıya sunar. Böylece EXE'nin yanında başka dosya gerekmez.
4. `Banner`, bilgisayarın Wi-Fi/Ethernet IPv4 adreslerini bulup konsola yazar.

## Geliştirme modu
`npm run dev` iki programı birlikte başlatır:
- `dotnet watch`: C# sunucu, kod değişince yeniden başlar (port 5000).
- `vite`: tarayıcı oyunu, kod değişince sayfa anında güncellenir (port 5173). `/api` ve `/hub` isteklerini 5000'e yönlendirir.

## Planlanan oyun mimarisi (Aşama 2–6)
- **Sunucu otoritesi:** hasar, ölüm, skor, mermi, stamina, koşma hızı ve ateş hızı C# sunucuda hesaplanır.
- **Sekme ve dağılma sunucuda:** tarayıcı sadece nişan yönünü yollar. Sunucu oyuncunun durumuna göre dağılmayı ekler: koşuyor, eğiliyor, havada veya art arda ateş ediyor. Böylece sekme herkes için aynı olur.
- **Ortak harita:** harita bir JSON dosyası olacak. Hem tarayıcı (çizim ve çarpışma) hem C# sunucu (isabet ve el bombası) aynı dosyayı okuyacak.
- **LAN ayarları:** sunucu saniyede 30 güncelleme yapacak, diğer oyuncular 50 ms geriden gösterilecek.

## Kaldırılanlar (v0.1 → v0.2)
- Node.js sunucu (Socket.IO): yerine C# ASP.NET Core geldi.
- Oda kodu, lobi, takım seçimi: tek sunucu, herkes herkese (FFA).
- İnternette yayınlama (Render) ve test botları. Botlar 8 oyuncu testleri için Aşama 8'de C# tarafında yeniden yazılacak.
