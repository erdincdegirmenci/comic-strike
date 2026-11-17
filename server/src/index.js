import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GAME_NAME, SERVER_PORT } from '@comic-strike/shared/constants.js';
import { RoomManager } from './RoomManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || SERVER_PORT;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  perMessageDeflate: false, // küçük ve sık paketlerde sıkıştırma gecikme ekler
  pingInterval: 10000,
  pingTimeout: 8000,
});

const rooms = new RoomManager(io);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: GAME_NAME, players: io.engine.clientsCount, rooms: rooms.count });
});

// Production: build edilmiş istemciyi sun (npm run build → client/dist)
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(
    express.static(clientDist, {
      setHeaders(res, filePath) {
        // Hash'li asset dosyaları uzun süre önbelleğe alınabilir, index.html alınmamalı
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
}

httpServer.listen(PORT, () => {
  console.log(`${GAME_NAME} sunucusu çalışıyor: http://localhost:${PORT}`);
});
