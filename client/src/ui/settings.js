const KEY = 'comic-strike-settings';

export const DEFAULTS = {
  name: '',
  char: 'max',
  hand: 'right', // viewmodel: sağ / sol el
  loadout: { primary: 'rifle', pistol: 'cannon', nade: 'he' },
  sensitivity: 1,
  fov: 80,
  volume: 0.6,
  quality: 'high',
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
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
