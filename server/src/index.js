import express from 'express';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// ComicStrike LAN sunucusu.
//   npm start                    → 3000 portunda başlar, tarayıcıyı açar
//   npm start -- --port 3050     → farklı port
//   npm start -- --no-browser    → tarayıcıyı açma

const VERSION = '0.3.0';
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = Number(portArg >= 0 ? args[portArg + 1] : process.env.PORT) || 3000;
const OPEN_BROWSER = !args.includes('--no-browser');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

const app = express();
const httpServer = createServer(app);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'ComicStrike', version: VERSION, players: 0 });
});

if (fs.existsSync(clientDist)) {
  app.use(
    express.static(clientDist, {
      setHeaders(res, filePath) {
        // Vite dosya adlarına içerik özeti ekler → bu dosyalar uzun süre önbellekte kalabilir
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
} else {
  app.get('/', (_req, res) => {
    res.type('html').send('<h1>ComicStrike sunucusu çalışıyor</h1><p>Oyun derlenmemiş. Proje klasöründe <b>npm run build</b> çalıştır.</p>');
  });
}

/** Çalışan Wi-Fi/Ethernet IPv4 adresleri (sanal bağdaştırıcılar hariç) */
function lanAddresses() {
  const skip = /vEthernet|VirtualBox|VMware|Hyper-V|WSL|docker|br-|veth|Loopback/i;
  const list = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (skip.test(name)) continue;
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) list.push({ ip: a.address, name });
    }
  }
  // Ev ağları genelde 192.168.x.x → önce onlar
  return list.sort((a, b) => Number(b.ip.startsWith('192.168.')) - Number(a.ip.startsWith('192.168.')));
}

const c = { y: '\x1b[33m', g: '\x1b[32m', c: '\x1b[36m', d: '\x1b[90m', r: '\x1b[31m', x: '\x1b[0m' };

function printBanner() {
  console.log(`
${c.y}  ╔══════════════════════════════╗
  ║    C O M I C S T R I K E     ║
  ╚══════════════════════════════╝${c.x}
  v${VERSION} — LAN sunucusu çalışıyor

  Bu bilgisayardan oyna:   ${c.c}http://localhost:${PORT}${c.x}`);
  const addrs = lanAddresses();
  if (addrs.length === 0) {
    console.log("  (Yerel ağ bağlantısı bulunamadı. Wi-Fi'ya bağlı mısın?)");
  } else {
    console.log('  Arkadaşların tarayıcısına bunu yazsın:');
    for (const a of addrs) console.log(`      ${c.g}http://${a.ip}:${PORT}${c.x}   ${c.d}(${a.name})${c.x}`);
  }
  if (!fs.existsSync(clientDist)) console.log(`\n  ${c.r}UYARI: Oyun derlenmemiş. Önce 'npm run build' çalıştır.${c.x}`);
  console.log(`
${c.d}  Windows Güvenlik Duvarı izin sorarsa 'Özel ağlar' için izin ver.
  Sunucuyu kapatmak için bu pencerede Ctrl+C.${c.x}
`);
}

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n${c.r}  ${PORT} portu kullanımda. ComicStrike zaten açık olabilir.${c.x}`);
    console.log(`  Farklı port denemek için: npm start -- --port ${PORT + 1}\n`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, '0.0.0.0', () => {
  printBanner();
  if (OPEN_BROWSER && process.platform === 'win32') exec(`start "" http://localhost:${PORT}`);
});
