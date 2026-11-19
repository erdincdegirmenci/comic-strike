const KEY = 'comic-strike-settings';
const VERSION = 2; // 2: varsayılan grafik LOW oldu

export const DEFAULTS = {
  name: '',
  char: 'max',
  hand: 'right', // viewmodel: sağ / sol el
  loadout: { primary: 'rifle', pistol: 'cannon', nade: 'he' },
  sensitivity: 1,
  fov: 80,
  volume: 0.6,
  quality: 'low', // varsayılan LOW (akıcı); isteyen ayarlardan HIGH yapar
  autoFullscreen: 'on', // oyuna tıklayınca tam ekrana geç (Ctrl+W koruması da bununla çalışır)
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : {};
    // Eski sürümde kaydedilen HIGH varsayılandı, kullanıcı seçimi değildi: bir kez LOW'a çek
    if ((saved.v ?? 1) < VERSION) {
      saved.quality = 'low';
      saved.v = VERSION;
    }
    return { ...DEFAULTS, ...saved, v: VERSION };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* gizli sekme vb. — ayarlar sadece bu oturumda kalır */
  }
}
