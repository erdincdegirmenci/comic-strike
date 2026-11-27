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
  red: { name: 'RED', color: '#c4493d', dark: '#6e2a22' },
  blue: { name: 'BLUE', color: '#3f6fa8', dark: '#22384f' },
  ffa: { name: 'FFA', color: '#9b5de5', dark: '#3c096c' }, // Herkes Tek: takım yok
};

/** a ve b birbirine rakip mi? (Herkes Tek modunda herkes herkese rakip) */
export function isEnemy(a, b) {
  return a !== b && (a.team === 'ffa' || b.team === 'ffa' || a.team !== b.team);
}

// ---- Oyuncu ----
export const PLAYER = {
  RADIUS: 0.35,
  HEIGHT: 1.7,
  EYE: 1.55,
  WALK_SPEED: 5.2,
  RUN_SPEED: 9.2, // Shift ile hızlı koşu
  JUMP_VELOCITY: 6.6,
  GRAVITY: 20,
  MAX_HP: 100,
  RESPAWN_TIME: 3000,
  SPAWN_PROTECTION: 5000, // doğduktan sonra hasar almama süresi (ateş edince biter)
  // Çömelme (Ctrl / C)
  CROUCH_HEIGHT: 1.15,
  CROUCH_EYE: 1.0,
  CROUCH_SPEED: 2.6,
  // Stamina: hızlı koşu tüketir, dururken hızlı, yürürken yavaş dolar.
  // Tamamen biterse MIN_TO_SPRINT'e kadar dolmadan tekrar koşulamaz.
  STAMINA_MAX: 100,
  STAMINA_DRAIN: 20, // koşarken saniyede (~5 sn koşu)
  STAMINA_REGEN_IDLE: 30, // dururken saniyede
  STAMINA_REGEN_MOVE: 12, // yürürken / çömelirken saniyede
  STAMINA_MIN_TO_SPRINT: 25,
  STAMINA_JUMP: 8, // zıplama da biraz yorar
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
  // Bacak bölgesi: gövde kutusunun bu yüksekliğin altındaki kısmı
  LEG_TOP: 0.8,
  CROUCH_LEG_TOP: 0.45,
};

// Vücut bölgesine göre hasar çarpanı: kafa silahın HEADSHOT_MULT değeri, gövde 1, bacak LEG
export const DAMAGE_ZONE = { LEG: 0.7 };

// Girdi bayrakları (input.f ve snapshot flags)
export const FLAG = { MOVING: 1, RUNNING: 2, AIR: 4, CROUCH: 8, SCOPED: 16, PROTECTED: 32, FROZEN: 64 };

// Düşme hasarı: yere bu hızdan (m/s) hızlı çarparsan az miktarda can gider.
// ~3 m'den yüksek düşüşler: ev çatısından ~5, apartman çatısından ~9-10 can.
export const FALL = { SAFE_SPEED: 11, DAMAGE_PER_SPEED: 1.4, MAX_DAMAGE: 20 };

// Havuz suyu: suyun içindeki oyuncu her TICK ms'de DAMAGE can kaybeder (ilk TICK hasarsız)
export const WATER = { DAMAGE: 3, TICK: 1000 };

// Sağ tık nişan (AWP dışındaki ateşli silahlar)
export const ADS = { FOV_MULT: 0.78, SPREAD_MULT: 0.35, SPEED_MULT: 0.72 };

// ---- Silahlar ----
// Her oyuncu bir ana silah, bir tabanca ve bir bomba seçer (B tuşu / maç başı). Bıçak herkeste var.
// Tuşlar: 1 ana silah · 2 tabanca · 3 bıçak · 4 bomba (fare tekeri / Q ile de değişir)
// cat: primary | pistol | melee | grenade
export const WEAPONS = {
  rifle: {
    id: 'rifle', cat: 'primary', NAME: 'INK-47', kind: 'gun', DESC: 'Güçlü otomatik tüfek',
    DAMAGE: 22, HEADSHOT_MULT: 3, FIRE_INTERVAL: 110, MAG_SIZE: 30, RESERVE: 90, RELOAD_TIME: 1800, RANGE: 150,
    SPREAD_BASE: 0.003, SPREAD_MOVE: 0.02, SPREAD_RUN: 0.035, SPREAD_AIR: 0.06, RECOIL: 0.012,
    AUTO: true, SPEED_MULT: 1,
  },
  awp: {
    id: 'awp', cat: 'primary', NAME: 'AWP', kind: 'gun', DESC: 'Dürbünlü keskin nişancı, kafaya tek atış',
    // Kafaya tek atış (170); gövdeye 85 → iki atış (ya da hasar almış rakibe tek); bacağa ~60
    DAMAGE: 85, HEADSHOT_MULT: 2, FIRE_INTERVAL: 1450, MAG_SIZE: 5, RESERVE: 20, RELOAD_TIME: 2900, RANGE: 300,
    // Dürbünsüz çok dağınık, dürbünle durunca neredeyse tam isabet
    SPREAD_BASE: 0.07, SPREAD_MOVE: 0.1, SPREAD_RUN: 0.14, SPREAD_AIR: 0.2,
    // Dürbünle durarak sapma yok (mermi tam nişangâha gider); yürürken çok az
    SPREAD_SCOPED: 0, SPREAD_SCOPED_MOVE: 0.004, RECOIL: 0.028,
    AUTO: false, SPEED_MULT: 0.84,
    ZOOM_FOV: [40, 15], // dürbün seviyeleri (sağ tık)
  },
  knife: {
    id: 'knife', cat: 'melee', NAME: 'SHIV', kind: 'melee',
    DAMAGE: 35, HEAVY_DAMAGE: 80, HEADSHOT_MULT: 2, FIRE_INTERVAL: 420, HEAVY_INTERVAL: 1000, RANGE: 2.1,
    SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0,
    AUTO: true, SPEED_MULT: 1.1, MAG_SIZE: 0,
  },
  he: {
    id: 'he', cat: 'grenade', NAME: 'KABOOM', kind: 'grenade', DESC: 'Patlayıcı bomba',
    DAMAGE: 112, RADIUS: 7, FUSE: 1600, FIRE_INTERVAL: 900, COUNT: 1, SPEED_MULT: 1, MAG_SIZE: 0,
    SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0,
  },
  poison: {
    id: 'poison', cat: 'grenade', NAME: 'STINKY', kind: 'grenade', DESC: 'Zehir bombası: içindekilerin canı azalır',
    // Patlayınca DURATION boyunca zehirli bulut; içindeki rakipler TICK ms'de bir DAMAGE_TICK can kaybeder
    RADIUS: 4, FUSE: 1800, DURATION: 10000, DAMAGE_TICK: 5, TICK: 500, FIRE_INTERVAL: 900, COUNT: 1, SPEED_MULT: 1, MAG_SIZE: 0,
    SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0,
  },
  mine: {
    id: 'mine', cat: 'grenade', NAME: 'TIK-TAK', kind: 'grenade', DESC: 'Mayın: atılır, yere oturunca kurulur, rakip basınca patlar',
    // ARM ms sonra kurulur; rakip TRIGGER metreye girince patlar (RADIUS içinde hasar). LIFETIME sonra söner.
    // Bir oyuncunun aynı anda en fazla MAX_ACTIVE mayını olur (fazlası en eskisini söndürür).
    DAMAGE: 140, RADIUS: 4.5, TRIGGER: 1.6, ARM: 1500, LIFETIME: 90000, MAX_ACTIVE: 2, FUSE: 90000,
    FIRE_INTERVAL: 900, COUNT: 2, SPEED_MULT: 1, MAG_SIZE: 0,
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
    DAMAGE: 20, HEADSHOT_MULT: 3.2, FIRE_INTERVAL: 95, MAG_SIZE: 30, RESERVE: 90, RELOAD_TIME: 2000, RANGE: 160,
    SPREAD_BASE: 0.002, SPREAD_MOVE: 0.015, SPREAD_RUN: 0.03, SPREAD_AIR: 0.06, RECOIL: 0.009,
    AUTO: true, SPEED_MULT: 1,
  },
  smg: {
    id: 'smg', cat: 'primary', NAME: 'BUZZ-5', kind: 'gun', DESC: 'Çok hızlı, hafif hafif makineli',
    DAMAGE: 15, HEADSHOT_MULT: 2.8, FIRE_INTERVAL: 78, MAG_SIZE: 30, RESERVE: 120, RELOAD_TIME: 1700, RANGE: 90,
    SPREAD_BASE: 0.006, SPREAD_MOVE: 0.012, SPREAD_RUN: 0.02, SPREAD_AIR: 0.05, RECOIL: 0.007,
    AUTO: true, SPEED_MULT: 1.08,
  },
  lmg: {
    id: 'lmg', cat: 'primary', NAME: 'THUNDER', kind: 'gun', DESC: '100 mermilik ağır makineli',
    DAMAGE: 23, HEADSHOT_MULT: 2.6, FIRE_INTERVAL: 92, MAG_SIZE: 100, RESERVE: 200, RELOAD_TIME: 4300, RANGE: 150,
    SPREAD_BASE: 0.009, SPREAD_MOVE: 0.04, SPREAD_RUN: 0.06, SPREAD_AIR: 0.1, RECOIL: 0.013,
    AUTO: true, SPEED_MULT: 0.8,
  },
  popper: {
    id: 'popper', cat: 'pistol', NAME: 'POPGUN', kind: 'gun', DESC: 'Hafif, isabetli tabanca',
    DAMAGE: 21, HEADSHOT_MULT: 3.4, FIRE_INTERVAL: 150, MAG_SIZE: 12, RESERVE: 36, RELOAD_TIME: 1600, RANGE: 120,
    SPREAD_BASE: 0.005, SPREAD_MOVE: 0.02, SPREAD_RUN: 0.03, SPREAD_AIR: 0.06, RECOIL: 0.016,
    AUTO: false, SPEED_MULT: 1.05,
  },
  cannon: {
    id: 'cannon', cat: 'pistol', NAME: 'HAND CANNON', kind: 'gun', DESC: '.50 ağır tabanca, kafaya tek atış',
    DAMAGE: 42, HEADSHOT_MULT: 3, FIRE_INTERVAL: 300, MAG_SIZE: 7, RESERVE: 21, RELOAD_TIME: 2100, RANGE: 140,
    SPREAD_BASE: 0.008, SPREAD_MOVE: 0.04, SPREAD_RUN: 0.06, SPREAD_AIR: 0.1, RECOIL: 0.045,
    AUTO: false, SPEED_MULT: 1.02,
    TWIRL: true, DEPLOY: 750, // çekilirken parmakta döner
  },
  revolver: {
    id: 'revolver', cat: 'pistol', NAME: 'SIXER', kind: 'gun', DESC: 'Kovboy tabancası: 6 mermi, ağır vuruş',
    DAMAGE: 36, HEADSHOT_MULT: 3, FIRE_INTERVAL: 380, MAG_SIZE: 6, RESERVE: 30, RELOAD_TIME: 2600, RANGE: 140,
    SPREAD_BASE: 0.004, SPREAD_MOVE: 0.03, SPREAD_RUN: 0.05, SPREAD_AIR: 0.09, RECOIL: 0.04,
    AUTO: false, SPEED_MULT: 1.04, KICK: 1.8,
    TWIRL: true, DEPLOY: 750,
  },
  shotgun: {
    id: 'shotgun', cat: 'primary', NAME: 'KA-CHUNK', kind: 'gun', DESC: 'Pompalı: yakında çok güçlü, uzakta etkisiz',
    // Bir atışta PELLETS saçma, her biri DAMAGE. FALLOFF [a, b]: a metreye kadar tam hasar, b metrede %MIN_FALLOFF
    DAMAGE: 13, PELLETS: 9, PELLET_SPREAD: 0.07, FALLOFF: [6, 22], MIN_FALLOFF: 0.2,
    HEADSHOT_MULT: 1.6, FIRE_INTERVAL: 850, MAG_SIZE: 6, RESERVE: 24, RELOAD_TIME: 2800, RANGE: 40,
    SPREAD_BASE: 0.004, SPREAD_MOVE: 0.01, SPREAD_RUN: 0.02, SPREAD_AIR: 0.04, RECOIL: 0.05,
    AUTO: false, SPEED_MULT: 0.98, KICK: 2,
  },
  bazooka: {
    id: 'bazooka', cat: 'primary', NAME: 'BAZOOKA', kind: 'gun', DESC: 'Roketatar: roket çarptığı yerde patlar',
    // Roket SPEED m/s ile dümdüz gider, ilk çarptığı yerde RADIUS içinde patlar (doğrudan isabet: tam hasar)
    ROCKET: true, DAMAGE: 130, RADIUS: 5, SPEED: 32, LIFETIME: 4000, HEADSHOT_MULT: 1,
    FIRE_INTERVAL: 1200, MAG_SIZE: 1, RESERVE: 3, RELOAD_TIME: 3000, RANGE: 200,
    SPREAD_BASE: 0.003, SPREAD_MOVE: 0.02, SPREAD_RUN: 0.04, SPREAD_AIR: 0.06, RECOIL: 0.06,
    AUTO: false, SPEED_MULT: 0.8, KICK: 2.2,
  },
  molotov: {
    id: 'molotov', cat: 'grenade', NAME: 'MOLOTOF', kind: 'grenade', DESC: 'Çarptığı yerde alev halısı: içinden geçen yanar',
    // İlk çarptığı yerde kırılır (en geç FUSE). DURATION boyunca RADIUS içindekiler TICK ms'de bir DAMAGE_TICK yanar
    IMPACT: true, RADIUS: 3.2, CLOUD_H: 1.4, FUSE: 2500, DURATION: 7000, DAMAGE_TICK: 6, TICK: 400,
    FIRE_INTERVAL: 900, COUNT: 1, SPEED_MULT: 1, MAG_SIZE: 0,
    SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0,
  },
});
Object.assign(WEAPONS, {
  flamer: {
    id: 'flamer', cat: 'primary', NAME: 'DRAGON', kind: 'gun', DESC: 'Alev silahı: yakındakini yakar',
    // SPRAY: mermi yerine püskürtme. RANGE metre içinde, bakış yönünden CONE radyana kadar olan herkese
    // her atışta DAMAGE hasar (duvar arkası etkilenmez)
    SPRAY: 'fire', CONE: 0.2, DAMAGE: 6, HEADSHOT_MULT: 1, FIRE_INTERVAL: 100, MAG_SIZE: 60, RESERVE: 120, RELOAD_TIME: 2800, RANGE: 7,
    SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0.0015,
    AUTO: true, SPEED_MULT: 0.92, KICK: 0.25,
  },
  freezer: {
    id: 'freezer', cat: 'primary', NAME: 'BRRR-9', kind: 'gun', DESC: 'Dondurucu: yeterince püskürtürsen rakip donar',
    // CHILL: bu kadar isabet (FREEZE.CHILL_WINDOW arayla) rakibi FREEZE_MS dondurur
    SPRAY: 'ice', CONE: 0.17, DAMAGE: 3, CHILL: 8, FREEZE_MS: 2500, HEADSHOT_MULT: 1, FIRE_INTERVAL: 100, MAG_SIZE: 50, RESERVE: 100, RELOAD_TIME: 2800, RANGE: 8,
    SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0.001,
    AUTO: true, SPEED_MULT: 0.95, KICK: 0.2,
  },
  flash: {
    id: 'flash', cat: 'grenade', NAME: 'FLASH', kind: 'grenade', DESC: 'Flaş bombası: gören herkesin gözü kamaşır',
    // Patlamayı gören herkes (atan dahil) kör olur: bakıyorsa BLIND ms'ye kadar, arkası dönükse çok daha kısa
    RADIUS: 18, FUSE: 1500, BLIND: 3500, FIRE_INTERVAL: 900, COUNT: 2, SPEED_MULT: 1, MAG_SIZE: 0,
    SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0,
  },
  frost: {
    id: 'frost', cat: 'grenade', NAME: 'BUZ KÜPÜ', kind: 'grenade', DESC: 'Dondurma bombası: alandaki herkesi dondurur',
    // Alandaki herkes (rakip, takım arkadaşı ve atan) FREEZE_MS boyunca donar. Hasar vermez.
    RADIUS: 4.5, FUSE: 1600, FREEZE_MS: 3000, FIRE_INTERVAL: 900, COUNT: 1, SPEED_MULT: 1, MAG_SIZE: 0,
    SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0,
  },
});

// ---- Donma ----
// CHILL_WINDOW: dondurucu isabetleri arasında bundan uzun boşluk olursa sayaç sıfırlanır
// IMMUNE: çözüldükten sonra bu süre tekrar donmazsın (sürekli kilitlenmesin)
export const FREEZE = { CHILL_WINDOW: 700, IMMUNE: 1500 };

// ---- Kanca (F) ----
// RANGE metre içindeki bir yüzeye atılır, oyuncuyu SPEED m/s ile oraya çeker. COOLDOWN ms'de bir kullanılır.
export const HOOK = { RANGE: 28, SPEED: 19, MAX_TIME: 1800, COOLDOWN: 5000, ARRIVE: 1.4, HOP: 8, RELEASE_SPEED: 8 };

// ---- Seri öldürme duyuruları ----
// MULTI_WINDOW içinde art arda öldürme (ikili, üçlü...) ve ölmeden yapılan seri
export const STREAK = {
  MULTI_WINDOW: 4000,
  MULTI: { 2: 'İKİLİ ÖLDÜRME!', 3: 'ÜÇLÜ ÖLDÜRME!', 4: 'DÖRTLÜ ÖLDÜRME!', 5: 'KATLİAM!' }, // 5 ve üstü
  ROW: { 3: 'ISINIYOR!', 5: 'DURDURULAMIYOR!', 7: 'ÖLÜM MAKİNESİ!', 10: 'EFSANE!' },
  ENDED: 5, // bu kadarlık seriyi bitiren de duyurulur
};

// Sahte Kopya: düştüğü yerde atanın karton kopyası dikilir; rakipler (ve botlar) ona ateş eder
WEAPONS.decoy = {
  id: 'decoy', cat: 'grenade', NAME: 'SAHTE KOPYA', kind: 'grenade', DESC: 'Düştüğü yerde senin kopyan dikilir, rakibi kandırır',
  FUSE: 1500, DURATION: 20000, HP: 40, MAX_ACTIVE: 2, FIRE_INTERVAL: 900, COUNT: 2, SPEED_MULT: 1, MAG_SIZE: 0,
  SPREAD_BASE: 0, SPREAD_MOVE: 0, SPREAD_RUN: 0, SPREAD_AIR: 0, RECOIL: 0,
};

WEAPONS.awp.KICK = 1.6;
WEAPONS.cannon.KICK = 1.8;

// Snapshot'ta silah sırası (indeks). Yeni silahlar sona eklenir.
export const WEAPON_ORDER = ['rifle', 'awp', 'knife', 'he', 'smoke', 'carbine', 'smg', 'lmg', 'popper', 'cannon', 'poison', 'mine', 'revolver', 'shotgun', 'bazooka', 'molotov', 'flamer', 'freezer', 'flash', 'frost', 'decoy'];

// Seçilebilir silahlar
export const LOADOUT_OPTIONS = {
  primary: ['rifle', 'carbine', 'smg', 'lmg', 'shotgun', 'bazooka', 'awp', 'flamer', 'freezer'],
  pistol: ['cannon', 'popper', 'revolver'],
  nade: ['he', 'smoke', 'poison', 'mine', 'molotov', 'flash', 'frost', 'decoy'],
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
  // Basılı tutma: kısa basış yakına, CHARGE_TIME kadar tutunca en uzağa
  MIN_POWER: 0.3,
  CHARGE_TIME: 1000,
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

// ---- Oyun modları ----
// tdm: takım ölüm maçı (öldürme = puan) · ctf: bayrak kapmaca (rakip bayrağını kendi üssüne getirmek = puan)
export const MODES = {
  tdm: { id: 'tdm', name: 'TAKIM SAVAŞI', desc: 'Öldüren takım puan alır' },
  ctf: { id: 'ctf', name: 'BAYRAK KAP', desc: 'Rakip bayrağını kendi üssüne getir' },
  ffa: { id: 'ffa', name: 'HERKES TEK', desc: 'Takım yok, herkes herkese rakip' },
  kills: { id: 'kills', name: 'ÖLÜM YARIŞI', desc: 'Belirlenen öldürme sayısına ilk ulaşan takım kazanır' },
  gun: { id: 'gun', name: 'SİLAH YARIŞI', desc: 'Her öldürmede silahın değişir, son öldürme bıçakla' },
};
/** Takımsız modlar: herkes herkese rakip */
export const isSolo = (mode) => mode === 'ffa' || mode === 'gun';
// Silah Yarışı sırası. Son basamak bıçak; bıçaklanan (son basamağa kadar) bir seviye geri düşer.
export const GUN_LADDER = ['rifle', 'carbine', 'smg', 'lmg', 'shotgun', 'bazooka', 'awp', 'flamer', 'revolver', 'cannon', 'popper', 'knife'];
// Herkes Tek (FFA): öldürme ödülü ve kazanma şartı
export const FFA = {
  KILL_LIMIT: 20, // bu kadar öldüren kazanır
  KILL_HP: 25, // öldürünce kazanılan can (en fazla MAX_HP)
  KILL_MAGS: 1, // öldürünce kazanılan şarjör (öldürdüğün silaha)
  MAX_MAGS: 10, // yedekte en fazla bu kadar şarjör birikir
};
// Zıplama pedi: üstüne basınca pedin hızıyla fırlatır (harita verisinde pads: [{c:[x,y,z], r, v:[vx,vy,vz]}])
export const PAD = { COOLDOWN: 600, MAX_VY: 18 };
export const MODE_IDS = Object.keys(MODES);
export const DEFAULT_MODE = 'tdm';
export const CTF = {
  CAPTURE_LIMIT: 3, // bu kadar bayrak getiren takım kazanır
  PICKUP_RADIUS: 1.4, // bayrağa bu kadar yaklaşınca alınır
  CAPTURE_RADIUS: 2.4, // taşıyıcı kendi üssüne bu kadar yaklaşınca sayı olur
  RETURN_TIME: 20000, // yere düşen bayrak bu süre sonra kendiliğinden üssüne döner
};
// Ölenin düşürdüğü mermi kutusu: üstünden geçen her iki silahına bu kadar şarjör yedek mermi alır
export const DROP = { LIFETIME: 25000, RADIUS: 1.3, MAGS: 1 };
// Takıma işaret (E tuşu / orta tık)
export const MARK = { RANGE: 150, COOLDOWN: 800, LIFETIME: 5000 };

// Puanlama: öldürme +3, asist +1, ölüm -1. Asist: rakibi vurdun, ASSIST_WINDOW içinde başkası öldürdü.
// Takım ateşi açıkken takım arkadaşını öldürmek: TEAMKILL puan (öldürme sayılmaz)
export const SCORE = { KILL: 3, ASSIST: 1, DEATH: -1, TEAMKILL: -3, ASSIST_WINDOW: 5000 };
// İntikam: bir rakip seni (sen onu hiç öldüremeden) KILLS kez öldürürse "ezeli düşman" olur; onu öldürünce BONUS puan
export const REVENGE = { KILLS: 3, BONUS: 2 };
/** Oyuncu puanı */
export const playerScore = (p) =>
  (p.kills ?? 0) * SCORE.KILL + (p.assists ?? 0) * SCORE.ASSIST + (p.deaths ?? 0) * SCORE.DEATH + (p.tks ?? 0) * SCORE.TEAMKILL + (p.revenges ?? 0) * REVENGE.BONUS;

// Lobide host'un seçebileceği maç sonu sınırları (hangisine önce ulaşılırsa maç biter)
export const LIMITS = {
  SCORE: { MIN: 10, MAX: 500, STEP: 10, DEFAULT: 100 },
  FLAGS: { MIN: 1, MAX: 10, STEP: 1, DEFAULT: 3 },
  KILLS: { MIN: 10, MAX: 100, STEP: 5, DEFAULT: 30 }, // Ölüm Yarışı: takımın toplam öldürmesi (varsayılan 30)
  TIME: { MIN: 2, MAX: 30, STEP: 1, DEFAULT: 8 }, // dakika
};

// Maçı baştan başlatma oylaması: host açar, oyuncuların (botlar hariç) yarısından fazlası EVET derse başlar
export const VOTE = { DURATION: 20000 };

// Sohbet (Enter: herkese, Y: takıma)
export const CHAT = { MAX_LEN: 120, COOLDOWN: 600 };

// Snapshot'taki bayrak durumu kodları
export const FLAG_STATE = { BASE: 0, CARRIED: 1, DROPPED: 2 };

// ---- Maç ----
export const MATCH = {
  SCORE_LIMIT: 100, // varsayılan bitiş puanı (takım puanı; Herkes Tek'te oyuncu puanı)
  TIME_LIMIT: 8 * 60 * 1000, // varsayılan süre
  COUNTDOWN: 3000,
  END_SCREEN: 12000, // maç sonu ekranı (ödüller) süresi
};
