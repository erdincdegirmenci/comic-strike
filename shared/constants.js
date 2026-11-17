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
};

// Sunucudaki isabet kutuları (ayak pozisyonuna göre)
export const HITBOX = {
  HEAD_Y: 1.5,
  HEAD_R: 0.24,
  BODY_TOP: 1.32,
  BODY_HALF: 0.36,
};

// ---- Silah ----
export const WEAPON = {
  NAME: 'INK-47',
  DAMAGE: 25,
  HEADSHOT_MULT: 2,
  FIRE_INTERVAL: 110, // ms
  MAG_SIZE: 30,
  RELOAD_TIME: 1800, // ms
  RANGE: 150,
  SPREAD_BASE: 0.003,
  SPREAD_MOVE: 0.02,
  SPREAD_RUN: 0.035,
  SPREAD_AIR: 0.06,
  RECOIL: 0.012,
};

// ---- Maç ----
export const MATCH = {
  SCORE_LIMIT: 30,
  TIME_LIMIT: 8 * 60 * 1000,
  COUNTDOWN: 3000,
  END_SCREEN: 8000,
};
