/**
 * Sunucu bağlantısı.
 * Aşama 1: Henüz multiplayer yok, oyun tek kişilik test modunda çalışır.
 * Bu sınıf şimdilik mesajları yok sayar. Aşama 5'te Socket.IO bağlantısı buraya gelecek.
 */
export class Network {
  constructor() {
    this.handlers = new Map();
    this.connected = false;
  }

  get id() {
    return 'local';
  }

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push(fn);
  }

  emit() {
    // Aşama 5'e kadar sunucuya bir şey gönderilmiyor
  }

  /** Sunucunun çalıştığını ve sürümünü kontrol eder. */
  async health() {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }
}
