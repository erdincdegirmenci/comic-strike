// COMIC STRIKE WEB — ortak oyun ayarları.
// İstemci ve sunucu bu dosyayı birlikte kullanır; dengeyi buradan ayarlayabilirsin.

export const GAME_NAME = 'COMIC STRIKE WEB';
export const SERVER_PORT = 3000;

// ---- Oda ----
export const MAX_PLAYERS = 8;
export const MAX_PER_TEAM = 4;
// Maçı başlatmak için gereken en az oyuncu.
// Tek başına test edebilmen için 1. Gerçek maçlar için sunucuda MIN_PLAYERS=4 ortam değişkeni ver.
export const MIN_PLAYERS_TO_START = 1;

// ---- Ağ ----
export const SERVER_TICK_RATE = 20; // sunucunun saniyedeki güncelleme sayısı
export const CLIENT_SEND_RATE = 30; // istemcinin saniyede gönderdiği girdi paketi
export const INTERP_DELAY = 100; // diğer oyuncular kaç ms geriden gösterilir

// ---- Takımlar ----
export const TEAMS = ['red', 'blue'];
export const TEAM_INFO = {
  red: { name: 'RED', color: '#e63946', dark: '#8d0801' },
  blue: { name: 'BLUE', color: '#2a6fdb', dark: '#14325c' },
};

// ---- Oyuncu ----
export const PLAYER = {
  RADIUS: 0.35,
  HEIGHT: 1.7,
  EYE: 1.55,
  WALK_SPEED: 5.2,
  RUN_SPEED: 7.8,
  JUMP_VELOCITY: 6.6,
  GRAVITY: 20,
  MAX_HP: 100,
  RESPAWN_TIME: 3000,
  SPAWN_PROTECTION: 1500,
  // Çömelme (Ctrl / C)
  CROUCH_HEIGHT: 1.15,
  CROUCH_EYE: 1.0,
  CROUCH_SPEED: 2.6,
};

// Sunucudaki isabet kutuları (ayak pozisyonuna göre)
export const HITBOX = {
  HEAD_Y: 1.5,
  HEAD_R: 0.24,
  BODY_TOP: 1.32,
  BODY_HALF: 0.36,
  // çömelmişken
  CROUCH_HEAD_Y: 1.02,
  CROUCH_BODY_TOP: 0.86,
};

// Girdi bayrakları (input.f ve snapshot flags)
export const FLAG = { MOVING: 1, RUNNING: 2, AIR: 4, CROUCH: 8, SCOPED: 16 };

// ---- Silahlar ----
// Her oyuncu bir ana silah, bir tabanca ve bir bomba seçer (B tuşu / maç başı). Bıçak herkeste var.
// Tuşlar: 1 ana silah · 2 tabanca · 3 bıçak · 4 bomba (fare tekeri / Q ile de değişir)
// cat: primary | pistol | melee | grenade
export const WEAPONS = {
  rifle: {
    id: 'rifle', cat: 'primary', NAME: 'INK-47', kind: 'gun', DESC: 'Güçlü otomatik tüfek',
    DAMAGE: 25, HEADSHOT_MULT: 2, FIRE_INTERVAL: 110, MAG_SIZE: 30, RELOAD_TIME: 1800, RANGE: 150,
    SPREAD_BASE: 0.003, SPREAD_MOVE: 0.02, SPREAD_RUN: 0.035, SPREAD_AIR: 0.06, RECOIL: 0.012,
    AUTO: true, SPEED_MULT: 1,
  },
  awp: {
    id: 'awp', cat: 'primary', NAME: 'AWP', kind: 'gun', DESC: 'Dürbünlü keskin nişancı, tek atış',
    // Nereye vurursan vur tek atış (100 can)
    DAMAGE: 115, HEADSHOT_MULT: 1, FIRE_INTERVAL: 1450, MAG_SIZE: 5, RELOAD_TIME: 2900, RANGE: 300,
    // Dürbünsüz çok dağınık, dürbünle durunca tam isabet
    SPREAD_BASE: 0.07, SPREAD_MOVE: 0.1, SPREAD_RUN: 0.14, SPREAD_AIR: 0.2,
    SPREAD_SCOPED: 0.0, SPREAD_SCOPED_MOVE: 0.035, RECOIL: 0.05,
    AUTO: false, SPEED_MULT: 0.84,
    ZOOM_FOV: [40, 15], // dürbün seviyeleri (sağ tık)
  },
  knife: {
    id: 'knife', cat: 'melee', NAME: 'SHIV', kind: 'melee',
    DAMAGE: 40, HEAVY_DAMAGE: 90, HEADSHOT_MULT: 1.5, FIRE_INTERVAL: 420, HEAVY_INTERVAL: 1000, RANGE: 2.1,
    SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0,
    AUTO: true, SPEED_MULT: 1.1, MAG_SIZE: 0,
  },
  he: {
    id: 'he', cat: 'grenade', NAME: 'KABOOM', kind: 'grenade', DESC: 'Patlayıcı bomba',
    DAMAGE: 98, RADIUS: 7, FUSE: 1600, FIRE_INTERVAL: 900, COUNT: 1, SPEED_MULT: 1, MAG_SIZE: 0,
    SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0,
  },
  smoke: {
    id: 'smoke', cat: 'grenade', NAME: 'PUFF', kind: 'grenade', DESC: 'Sis bombası',
    RADIUS: 4.2, FUSE: 1800, DURATION: 16000, FIRE_INTERVAL: 900, COUNT: 1, SPEED_MULT: 1, MAG_SIZE: 0,
    SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0,
  },
};
Object.assign(WEAPONS, {
  carbine: {
    id: 'carbine', cat: 'primary', NAME: 'STREAK-4', kind: 'gun', DESC: 'İsabetli, hızlı karabina',
    DAMAGE: 22, HEADSHOT_MULT: 2.2, FIRE_INTERVAL: 95, MAG_SIZE: 30, RELOAD_TIME: 2000, RANGE: 160,
    SPREAD_BASE: 0.002, SPREAD_MOVE: 0.015, SPREAD_RUN: 0.03, SPREAD_AIR: 0.06, RECOIL: 0.009,
    AUTO: true, SPEED_MULT: 1,
  },
  smg: {
    id: 'smg', cat: 'primary', NAME: 'BUZZ-5', kind: 'gun', DESC: 'Çok hızlı, hafif hafif makineli',
    DAMAGE: 17, HEADSHOT_MULT: 2, FIRE_INTERVAL: 78, MAG_SIZE: 30, RELOAD_TIME: 1700, RANGE: 90,
    SPREAD_BASE: 0.006, SPREAD_MOVE: 0.012, SPREAD_RUN: 0.02, SPREAD_AIR: 0.05, RECOIL: 0.007,
    AUTO: true, SPEED_MULT: 1.08,
  },
  lmg: {
    id: 'lmg', cat: 'primary', NAME: 'THUNDER', kind: 'gun', DESC: '100 mermilik ağır makineli',
    DAMAGE: 26, HEADSHOT_MULT: 2, FIRE_INTERVAL: 92, MAG_SIZE: 100, RELOAD_TIME: 4300, RANGE: 150,
    SPREAD_BASE: 0.009, SPREAD_MOVE: 0.04, SPREAD_RUN: 0.06, SPREAD_AIR: 0.1, RECOIL: 0.013,
    AUTO: true, SPEED_MULT: 0.8,
  },
  popper: {
    id: 'popper', cat: 'pistol', NAME: 'POPGUN', kind: 'gun', DESC: 'Hafif, isabetli tabanca',
    DAMAGE: 24, HEADSHOT_MULT: 2.5, FIRE_INTERVAL: 150, MAG_SIZE: 12, RELOAD_TIME: 1600, RANGE: 120,
    SPREAD_BASE: 0.005, SPREAD_MOVE: 0.02, SPREAD_RUN: 0.03, SPREAD_AIR: 0.06, RECOIL: 0.016,
    AUTO: false, SPEED_MULT: 1.05,
  },
  cannon: {
    id: 'cannon', cat: 'pistol', NAME: 'HAND CANNON', kind: 'gun', DESC: '.50 ağır tabanca, kafaya tek atış',
    DAMAGE: 48, HEADSHOT_MULT: 2.5, FIRE_INTERVAL: 300, MAG_SIZE: 7, RELOAD_TIME: 2100, RANGE: 140,
    SPREAD_BASE: 0.008, SPREAD_MOVE: 0.04, SPREAD_RUN: 0.06, SPREAD_AIR: 0.1, RECOIL: 0.045,
    AUTO: false, SPEED_MULT: 1.02,
    TWIRL: true, DEPLOY: 750, // çekilirken parmakta döner
  },
});

// Snapshot'ta silah sırası (indeks). Yeni silahlar sona eklenir.
export const WEAPON_ORDER = ['rifle', 'awp', 'knife', 'he', 'smoke', 'carbine', 'smg', 'lmg', 'popper', 'cannon'];

// Seçilebilir silahlar
export const LOADOUT_OPTIONS = {
  primary: ['rifle', 'carbine', 'smg', 'lmg', 'awp'],
  pistol: ['cannon', 'popper'],
  nade: ['he', 'smoke'],
};
export const DEFAULT_LOADOUT = { primary: 'rifle', pistol: 'cannon', nade: 'he' };
export const BUY_TIME = 10000; // doğduktan sonra ateş etmeden bu süre içinde silah değiştirilebilir

/** Geçersiz değerleri varsayılana çeker */
export function cleanLoadout(l) {
  const out = { ...DEFAULT_LOADOUT };
  for (const k of Object.keys(LOADOUT_OPTIONS)) if (l && LOADOUT_OPTIONS[k].includes(l[k])) out[k] = l[k];
  return out;
}

/** Yuva tuşu: 1 ana · 2 tabanca · 3 bıçak · 4 bomba */
export const SLOT_OF_CAT = { primary: 1, pistol: 2, melee: 3, grenade: 4 };

// Eski kodla uyumluluk (botlar vb.)
export const WEAPON = WEAPONS.rifle;

// ---- Bomba fiziği ----
export const GRENADE = {
  THROW_SPEED: 15,
  THROW_UP: 2.5,
  GRAVITY: 18,
  RADIUS: 0.09,
  BOUNCE: 0.4,
  FRICTION: 0.7,
  STEP: 1 / 60,
};

// ---- Karakterler ----
// Her karakterin kendine özel duvar sticker'ı var (T tuşu).
export const CHARACTERS = {
  max: { id: 'max', name: 'CAPTAIN MAX', color: '#ffd23f', accent: '#e63946', tag: 'MAX!' },
  ziggy: { id: 'ziggy', name: 'ZIGGY ZAP', color: '#4cc9f0', accent: '#ffd23f', tag: 'ZAP!' },
  roxy: { id: 'roxy', name: 'ROXY', color: '#ff70a6', accent: '#ffffff', tag: 'XOXO' },
  bones: { id: 'bones', name: 'MR. BONES', color: '#f1faee', accent: '#141414', tag: 'R.I.P.' },
};
export const CHARACTER_IDS = Object.keys(CHARACTERS);
export const SPRAY = { RANGE: 4, SIZE: 1.2, COOLDOWN: 4000 };

// ---- Maç ----
export const MATCH = {
  SCORE_LIMIT: 30,
  TIME_LIMIT: 8 * 60 * 1000,
  COUNTDOWN: 3000,
  END_SCREEN: 8000,
};
