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
// Tuşlar: 1 INK-47 · 2 AWP · 3 bıçak · 4 patlayıcı bomba · 5 sis bombası (fare tekeri / Q ile de değişir)
export const WEAPONS = {
  rifle: {
    id: 'rifle', slot: 1, NAME: 'INK-47', kind: 'gun',
    DAMAGE: 25, HEADSHOT_MULT: 2, FIRE_INTERVAL: 110, MAG_SIZE: 30, RELOAD_TIME: 1800, RANGE: 150,
    SPREAD_BASE: 0.003, SPREAD_MOVE: 0.02, SPREAD_RUN: 0.035, SPREAD_AIR: 0.06, RECOIL: 0.012,
    AUTO: true, SPEED_MULT: 1,
  },
  awp: {
    id: 'awp', slot: 2, NAME: 'AWP', kind: 'gun',
    // Nereye vurursan vur tek atış (100 can)
    DAMAGE: 115, HEADSHOT_MULT: 1, FIRE_INTERVAL: 1450, MAG_SIZE: 5, RELOAD_TIME: 2900, RANGE: 300,
    // Dürbünsüz çok dağınık, dürbünle durunca tam isabet
    SPREAD_BASE: 0.07, SPREAD_MOVE: 0.1, SPREAD_RUN: 0.14, SPREAD_AIR: 0.2,
    SPREAD_SCOPED: 0.0, SPREAD_SCOPED_MOVE: 0.035, RECOIL: 0.05,
    AUTO: false, SPEED_MULT: 0.84,
    ZOOM_FOV: [40, 15], // dürbün seviyeleri (sağ tık)
  },
  knife: {
    id: 'knife', slot: 3, NAME: 'SHIV', kind: 'melee',
    DAMAGE: 40, HEAVY_DAMAGE: 90, HEADSHOT_MULT: 1.5, FIRE_INTERVAL: 420, HEAVY_INTERVAL: 1000, RANGE: 2.1,
    SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0,
    AUTO: true, SPEED_MULT: 1.1, MAG_SIZE: 0,
  },
  he: {
    id: 'he', slot: 4, NAME: 'KABOOM', kind: 'grenade',
    DAMAGE: 98, RADIUS: 7, FUSE: 1600, FIRE_INTERVAL: 900, COUNT: 1, SPEED_MULT: 1, MAG_SIZE: 0,
    SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0,
  },
  smoke: {
    id: 'smoke', slot: 5, NAME: 'PUFF', kind: 'grenade',
    RADIUS: 4.2, FUSE: 1800, DURATION: 16000, FIRE_INTERVAL: 900, COUNT: 1, SPEED_MULT: 1, MAG_SIZE: 0,
    SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0,
  },
};
export const WEAPON_ORDER = ['rifle', 'awp', 'knife', 'he', 'smoke'];

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
