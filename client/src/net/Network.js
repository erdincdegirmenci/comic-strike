import { io } from 'socket.io-client';
import { MSG } from '@comic-strike/shared/protocol.js';

/** Socket.IO bağlantısı. Aynı adresteki sunucuya bağlanır (geliştirmede Vite proxy üzerinden). */
export class Network {
  constructor() {
    this.socket = io({ transports: ['websocket'] });
    // Sunucunun ping ölçümüne hemen cevap ver
    this.socket.on(MSG.SPING, (cb) => {
      if (typeof cb === 'function') cb();
    });
  }

  get id() {
    return this.socket.id;
  }

  get connected() {
    return this.socket.connected;
  }

  on(event, fn) {
    this.socket.on(event, fn);
  }

  emit(event, data) {
    this.socket.emit(event, data);
  }

  /** Cevap bekleyen istek (ack). */
  request(event, data, timeout = 5000) {
    return new Promise((resolve) => {
      if (!this.socket.connected) return resolve({ ok: false, error: 'Sunucuya bağlı değil.' });
      this.socket.timeout(timeout).emit(event, data, (err, res) => {
        resolve(err ? { ok: false, error: 'Sunucu yanıt vermedi.' } : res);
      });
    });
  }
}
