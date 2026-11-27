import { MSG } from '@comic-strike/shared/protocol.js';
import { TEAM_INFO, CHARACTERS, CHARACTER_IDS, WEAPONS, LOADOUT_OPTIONS, cleanLoadout, MODES, MODE_IDS, LIMITS, DAMAGE_ZONE } from '@comic-strike/shared/constants.js';
import { MAPS, MAP_IDS } from '@comic-strike/shared/maps.js';
import { saveSettings } from './settings.js';
import { drawSpray } from '../fx/Sprays.js';
import { WeaponPreview } from './WeaponPreview.js';

const $ = (id) => document.getElementById(id);

// Kontroller tablosu: [eylem, klavye, fare]
const CONTROLS = [
  ['HAREKET'],
  ['İLERİ', 'W', ''], ['GERİ', 'S', ''], ['SOL', 'A', ''], ['SAĞ', 'D', ''],
  ['ZIPLA', 'SPACE', ''], ['HIZLI KOŞ (STAMINA)', 'LEFT SHIFT', ''], ['ÇÖMEL', 'LEFT CTRL / C', ''], ['KANCA', 'F', ''],
  ['SAVAŞ'],
  ['ATEŞ / BOMBA AT', '', 'LEFT MOUSE BUTTON'], ['NİŞAN AL / DÜRBÜN / AĞIR BIÇAK', '', 'RIGHT MOUSE BUTTON'],
  ['ŞARJÖR DEĞİŞTİR', 'R', ''],
  ['ANA SİLAH', '1', ''], ['TABANCA', '2', ''], ['BIÇAK', '3', ''], ['BOMBA', '4', ''],
  ['SON İKİ SİLAH ARASINDA GEÇİŞ', 'Q', ''], ['ÖNCEKİ / SONRAKİ SİLAH', '', 'MOUSE WHEEL'],
  ['SİLAH SEÇİMİ', 'B', ''],
  ['DİĞER'],
  ['STICKER YAPIŞTIR', 'T', ''], ['TAKIMA İŞARET', 'E', 'MIDDLE MOUSE BUTTON'], ['SKOR TABLOSU', 'TAB', ''],
  ['SOHBET (HERKESE)', 'ENTER', ''], ['TAKIM SOHBETİ', 'Y', ''], ['OYLAMA: EVET / HAYIR', 'F1 / F2', ''], ['MENÜ / DURAKLAT', 'ESC', ''],
];

/**
 * Menüler ve uygulama akışı:
 * ana menü → (play / create / join) → lobi → maç → lobi ...
 */
export class Menu {
  constructor(ctx) {
    Object.assign(this, ctx); // net, game, input, sfx, settings, view
    this.room = null;
    this.current = 'loading';
    this.settingsBack = 'main';
    this.busy = false;

    $('ui').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      this.sfx.ensure();
      this.action(btn.dataset.action);
    });
    $('game').addEventListener('click', () => {
      if (this.game.active && !this.input.locked && this.game.state !== 'ended') this.resume();
    });
    this.setupPanelFit();
    $('inp-code').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.action('join-confirm');
    });

    this.bindSettings();
    this.bindNet();
    this.input.onLockChange = (locked) => {
      document.body.classList.toggle('pointer-locked', locked);
      this.onLockChange(locked);
    };
    this.input.autoFullscreen = this.settings.autoFullscreen !== 'off';
    const fsLabels = () => {
      for (const b of document.querySelectorAll('.fs-label')) b.textContent = document.fullscreenElement ? '🗗 PENCERE' : '⛶ TAM EKRAN';
    };
    document.addEventListener('fullscreenchange', fsLabels);
    fsLabels();
    if (!document.documentElement.requestFullscreen) for (const b of document.querySelectorAll('.fs-label')) b.classList.add('hidden');
    $('inp-name').value = this.settings.name;
    this.buildCharacters();
    this.buildModes();
    this.buildMaps();
    this.buildLimits();
    this.createOpts = { locked: false, ff: false };
    this.bindBotDrag();
    this.refreshRooms();
    setInterval(() => this.refreshRooms(), 3000);
    $('inp-pass').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.action('create-confirm');
    });
    $('inp-join-pass').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.action('join-confirm');
    });
    this.buildControls();
    this.preview = new WeaponPreview($('lo-canvas'));
    this.buildLoadout();
    this.game.onBuyMenu = () => this.openLoadout();
    this.game.onLoadout = (d) => {
      const base = d.now ? 'Silahların eline verildi!' : 'Seçimin bir sonraki doğuşta geçerli olacak.';
      this.msg('loadout-msg', this.forceNote ? `${base} ${this.forceNote}` : base, false);
    };
  }

  /** Her grup (HAREKET, SAVAŞ, DİĞER) ayrı bir kutu; CSS bunları yan yana dizer */
  buildControls() {
    const list = $('controls-list');
    const el = (tag, cls, text = '') => {
      const e = document.createElement(tag);
      e.className = cls;
      e.textContent = text;
      return e;
    };
    let group = null;
    for (const [action, key, mouse] of CONTROLS) {
      if (key === undefined) {
        group = el('div', 'ctl-group');
        group.dataset.group = action;
        group.append(el('h3', '', action));
        list.append(group);
        continue;
      }
      const keys = el('span', 'ctl-keys');
      for (const k of [key, mouse]) if (k) keys.append(el('kbd', '', k));
      const row = el('div', 'ctl-row');
      row.append(el('span', 'ctl-act', action), keys);
      group.append(row);
    }
  }

  /** Silah seçim kartları */
  buildLoadout() {
    this.settings.loadout = cleanLoadout(this.settings.loadout);
    for (const box of document.querySelectorAll('.lo-cards')) {
      const cat = box.dataset.cat;
      for (const id of LOADOUT_OPTIONS[cat]) {
        const w = WEAPONS[id];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'lo-card';
        b.dataset.weapon = id;
        const name = document.createElement('b');
        name.textContent = w.NAME;
        const desc = document.createElement('span');
        desc.textContent = w.DESC ?? '';
        const stats = document.createElement('i');
        stats.textContent = w.SPRAY ? `${(w.DAMAGE * 1000) / w.FIRE_INTERVAL} HASAR/sn · ${w.RANGE} m · ${w.MAG_SIZE}+${w.RESERVE}`
          : w.id === 'flash' ? `${w.BLIND / 1000} sn'ye kadar körlük · ${w.COUNT} ADET`
          : w.id === 'frost' ? `${w.FREEZE_MS / 1000} sn donma · ${w.RADIUS} m`
          : w.ROCKET ? `PATLAMA ${w.DAMAGE} · ${w.RADIUS} m · ${w.MAG_SIZE}+${w.RESERVE} ROKET`
          : w.PELLETS ? `${w.PELLETS}×${w.DAMAGE} SAÇMA · ŞARJÖR ${w.MAG_SIZE}+${w.RESERVE}`
          : w.kind === 'gun'
          ? `HASAR ${w.DAMAGE} · ŞARJÖR ${w.MAG_SIZE}+${w.RESERVE} · ${Math.round(60000 / w.FIRE_INTERVAL)} RPM`
          : w.id === 'he' ? `HASAR ${w.DAMAGE} · ${w.RADIUS} m`
            : w.id === 'mine' ? `HASAR ${w.DAMAGE} · ${w.COUNT} ADET`
            : w.id === 'molotov' ? `${(w.DAMAGE_TICK * 1000) / w.TICK} HASAR/sn · ${w.DURATION / 1000} sn alev`
            : w.id === 'poison' ? `${(w.DAMAGE_TICK * 1000) / w.TICK} HASAR/sn · ${w.DURATION / 1000} sn` : `${w.DURATION / 1000} sn sis`;
        b.append(name, desc, stats);
        b.addEventListener('click', () => {
          this.sfx.ensure();
          this.previewWeapon(id);
          this.settings.loadout[cat] = id;
          saveSettings(this.settings);
          this.renderLoadout();
          if (this.game.active) this.net.emit(MSG.SET_LOADOUT, this.settings.loadout);
        });
        box.append(b);
      }
    }
    this.renderLoadout();
  }

  /** Seçilen silahın 3B dönen önizlemesi ve bilgisi */
  previewWeapon(id) {
    const w = WEAPONS[id];
    this.preview.show(id);
    $('lo-name').textContent = w.NAME;
    $('lo-desc').textContent = w.DESC ?? '';
    $('lo-stats').textContent = w.SPRAY
      ? `Saniyede ${(w.DAMAGE * 1000) / w.FIRE_INTERVAL} HASAR · MENZİL ${w.RANGE} m · ${w.CHILL ? `${(w.CHILL * w.FIRE_INTERVAL) / 1000} sn püskürtünce ${w.FREEZE_MS / 1000} sn dondurur · ` : ''}ŞARJÖR ${w.MAG_SIZE} · YEDEK ${w.RESERVE}`
      : w.id === 'flash' ? `Patlamayı gören herkes (sen de!) ${w.BLIND / 1000} sn'ye kadar kör olur · arkanı dönersen çok daha kısa · ${w.COUNT} ADET`
      : w.id === 'frost' ? `${w.RADIUS} m alandaki herkes (sen ve takımın da!) ${w.FREEZE_MS / 1000} sn donar · hasar vermez`
      : w.ROCKET
      ? `Roket çarptığı yerde patlar · ${w.DAMAGE} HASAR · ETKİ ALANI ${w.RADIUS} m · ŞARJÖR ${w.MAG_SIZE} · YEDEK ${w.RESERVE} · kendine de zarar verir`
      : w.PELLETS
      ? `${w.PELLETS} saçma × ${w.DAMAGE} HASAR (yakında en fazla ${w.PELLETS * w.DAMAGE}) · ${w.FALLOFF[0]} m'den sonra hasar düşer · ŞARJÖR ${w.MAG_SIZE} · YEDEK ${w.RESERVE}`
      : w.kind === 'gun'
      ? `HASAR ${w.DAMAGE} · KAFA ${Math.round(w.DAMAGE * w.HEADSHOT_MULT)} · BACAK ${Math.round(w.DAMAGE * DAMAGE_ZONE.LEG)} · ŞARJÖR ${w.MAG_SIZE} · YEDEK ${w.RESERVE} · ${Math.round(60000 / w.FIRE_INTERVAL)} RPM`
      : w.id === 'he' ? `HASAR ${w.DAMAGE} · ETKİ ALANI ${w.RADIUS} m · basılı tut, uzağa at`
        : w.id === 'molotov' ? `Çarptığı yerde ${w.DURATION / 1000} sn yanan ${w.RADIUS} m'lik alev · içindekiler saniyede ${(w.DAMAGE_TICK * 1000) / w.TICK} can kaybeder (sen de!)`
        : w.id === 'mine' ? `${w.COUNT} mayın · ${w.ARM / 1000} sn sonra kurulur · rakip ${w.TRIGGER} m yaklaşınca ${w.DAMAGE} hasarla patlar · ${w.LIFETIME / 1000} sn sonra söner`
        : w.id === 'poison' ? `${w.DURATION / 1000} sn zehirli sis · içindekiler saniyede ${(w.DAMAGE_TICK * 1000) / w.TICK} can kaybeder · basılı tut, uzağa at`
          : `${w.DURATION / 1000} sn görüş kapatır · basılı tut, uzağa at`;
  }

  renderLoadout() {
    for (const box of document.querySelectorAll('.lo-cards')) {
      for (const b of box.children) b.classList.toggle('active', this.settings.loadout[box.dataset.cat] === b.dataset.weapon);
    }
  }

  openLoadout() {
    this.msg('loadout-msg', 'Doğduktan sonraki 10 sn içinde (ateş etmeden) hemen değişir.', false);
    this.show('loadout');
    this.previewWeapon(this.settings.loadout.primary);
    this.preview.start();
    this.input.unlock();
  }

  /** Lobide harita seçimi (sadece host değiştirebilir) */
  buildModes() {
    const box = $('mode-pick');
    for (const id of MODE_IDS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mode-card';
      b.dataset.action = `mode-${id}`;
      b.dataset.mode = id;
      const name = document.createElement('b');
      name.textContent = MODES[id].name;
      const desc = document.createElement('small');
      desc.textContent = MODES[id].desc;
      b.append(name, desc);
      box.append(b);
    }
  }

  buildMaps() {
    const box = $('map-pick');
    for (const id of MAP_IDS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `map-card map-${id}`;
      b.dataset.action = `map-${id}`;
      b.dataset.map = id;
      b.textContent = MAPS[id].name;
      const note = MAPS[id].ffaOnly ? 'SADECE HERKES TEK' : MAPS[id].desc;
      if (note) {
        const tag = document.createElement('small');
        tag.textContent = note;
        b.append(tag);
      }
      box.append(b);
    }
  }

  /** Maç sonu sınırları: hazır değer düğmeleri (puan / bayrak / dakika) */
  buildLimits() {
    const fill = (box, values, key, unit) => {
      box.replaceChildren();
      for (const v of values) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'preset';
        b.dataset.action = `limit-${key}-${v}`;
        b.dataset.value = v;
        b.textContent = `${v}${unit}`;
        box.append(b);
      }
    };
    // kind: 'flags' (Bayrak Kap) | 'kills' (Ölüm Yarışı) | 'score' (diğerleri)
    const PRESETS = { flags: [1, 3, 5, 7], kills: [20, 30, 50, 75], score: [50, 100, 150, 200] };
    this.fillScorePresets = (kind) => fill($('limit-score-presets'), PRESETS[kind] ?? PRESETS.score, 'score', '');
    this.fillScorePresets('score');
    fill($('limit-time-presets'), [5, 10, 15, 20], 'time', ' dk');
  }

  /** key: 'score' | 'time', op: 'inc' | 'dec' | sayı */
  changeLimit(key, op) {
    const rs = this.room;
    if (!rs?.limits || rs.hostId !== this.net.id) return;
    const field = key === 'time' ? 'time' : rs.mode === 'ctf' ? 'flags' : rs.mode === 'kills' ? 'kills' : 'score';
    const L = LIMITS[field.toUpperCase()];
    let v = rs.limits[field];
    if (op === 'inc') v += L.STEP;
    else if (op === 'dec') v -= L.STEP;
    else v = Number(op);
    v = Math.max(L.MIN, Math.min(L.MAX, v));
    this.net.emit(MSG.SET_LIMITS, { [field]: v });
  }

  /** Karakter seçimi: her karakterin sticker'ı önizleme olarak gösterilir */
  buildCharacters() {
    if (!CHARACTERS[this.settings.char]) this.settings.char = CHARACTER_IDS[0];
    const box = $('char-pick');
    for (const id of CHARACTER_IDS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.char = id;
      b.title = CHARACTERS[id].name;
      b.append(drawSpray(id, 128), document.createTextNode(CHARACTERS[id].name));
      b.addEventListener('click', () => {
        this.sfx.ensure();
        this.settings.char = id;
        saveSettings(this.settings);
        this.renderCharacters();
      });
      box.append(b);
    }
    this.renderCharacters();
  }

  renderCharacters() {
    for (const b of $('char-pick').children) b.classList.toggle('active', b.dataset.char === this.settings.char);
  }

  /** Lobi, kontroller ve silah seçimi panelleri ekrana sığmazsa küçültülür (kaydırma çubuğu çıkmaz) */
  setupPanelFit() {
    const panels = {
      lobby: document.querySelector('#screen-lobby .panel.lobby'),
      controls: document.querySelector('#screen-controls .panel'),
      loadout: document.querySelector('#screen-loadout .panel'),
    };
    let queued = false;
    const fit = () => {
      queued = false;
      const panel = panels[this.current];
      if (!panel) return;
      panel.style.zoom = '1';
      const w = panel.offsetWidth + 24, h = panel.offsetHeight + 24; // gölge ve eğiklik payı
      const z = Math.max(0.35, Math.min(1, (window.innerHeight - 16) / h, (window.innerWidth - 8) / w));
      panel.style.zoom = z.toFixed(3);
    };
    this.fitPanel = () => { if (!queued) { queued = true; requestAnimationFrame(fit); } };
    window.addEventListener('resize', this.fitPanel);
    document.fonts?.ready.then(this.fitPanel); // yazı tipi geç yüklenirse boyutlar değişir
    for (const panel of Object.values(panels)) {
      new MutationObserver(this.fitPanel).observe(panel, { childList: true, subtree: true, characterData: true });
    }
  }

  show(name) {
    if (name !== 'loadout') this.preview?.stop();
    if (name === 'main' && this.current !== 'main') setTimeout(() => this.refreshRooms(), 0);
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== `screen-${name}`);
    this.current = name;
    document.body.classList.toggle('in-menu', !this.game.active);
    this.fitPanel?.();
  }

  msg(id, text, error = true) {
    const m = $(id);
    m.textContent = text;
    m.classList.toggle('error', error);
  }

  playerName() {
    const name = $('inp-name').value.trim().slice(0, 16);
    if (name !== this.settings.name) {
      this.settings.name = name;
      saveSettings(this.settings);
    }
    return name;
  }

  async request(event, data, msgId) {
    if (this.busy) return;
    this.busy = true;
    this.msg(msgId, 'Bağlanıyor...', false);
    const res = await this.net.request(event, data);
    this.busy = false;
    if (!res?.ok) this.msg(msgId, res?.error ?? 'Bir hata oluştu.');
    else this.msg(msgId, '', false);
  }

  action(a) {
    switch (a) {
      case 'play':
        return this.request(MSG.QUICK_PLAY, { name: this.playerName(), char: this.settings.char, loadout: this.settings.loadout }, 'main-msg');
      case 'create':
        this.playerName();
        this.show('create');
        this.msg('create-msg', '', false);
        return;
      case 'vis-public':
      case 'vis-locked':
        this.createOpts.locked = a === 'vis-locked';
        return this.renderCreate();
      case 'ff-on':
      case 'ff-off':
        this.createOpts.ff = a === 'ff-on';
        return this.renderCreate();
      case 'create-confirm': {
        const password = $('inp-pass').value.trim();
        if (this.createOpts.locked && !password) return this.msg('create-msg', 'Şifreli oda için bir şifre yaz.');
        return this.request(
          MSG.CREATE_ROOM,
          { name: this.settings.name, char: this.settings.char, loadout: this.settings.loadout, ...this.createOpts, password },
          'create-msg',
        );
      }
      case 'restart-vote':
        this.net.emit(MSG.RESTART_REQUEST);
        return this.resume();
      case 'ff-toggle':
        return this.net.emit(MSG.SET_FF, !this.room?.ff);
      case 'join':
        this.playerName();
        this.show('join');
        this.msg('join-msg', '', false);
        return $('inp-code').focus();
      case 'join-confirm': {
        const code = $('inp-code').value.trim().toUpperCase();
        if (code.length < 4) return this.msg('join-msg', 'Oda kodunu gir.');
        return this.joinRoom(code, $('inp-join-pass').value, 'join-msg');
      }
      case 'settings':
        this.settingsBack = this.current;
        return this.show('settings');
      case 'back':
        if (this.current === 'controls') return this.show('main');
        return this.show(this.current === 'settings' ? this.settingsBack : 'main');
      case 'controls':
        return this.show('controls');
      case 'loadout':
        return this.openLoadout();
      case 'loadout-done':
        if (!this.game.active) return this.show('main');
        return this.resume();
      case 'team-red':
      case 'team-blue':
        return this.net.emit(MSG.SET_TEAM, a.slice(5));
      case 'ready': {
        const me = this.room?.players.find((p) => p.id === this.net.id);
        return this.net.emit(MSG.SET_READY, !me?.ready);
      }
      case 'start':
        return this.net.emit(MSG.START_MATCH);
      case 'add-bot':
        return this.net.emit(MSG.ADD_BOT);
      case 'remove-bot':
        return this.net.emit(MSG.REMOVE_BOT);
      case 'copy':
        navigator.clipboard?.writeText(this.room?.code ?? '').catch(() => {});
        return this.msg('lobby-msg', 'Oda kodu kopyalandı!', false);
      case 'leave':
      case 'leave-match':
        this.net.emit(MSG.LEAVE_ROOM);
        this.room = null;
        if (this.game.active) this.game.stop();
        this.input.unlock();
        this.input.releaseKeyboard();
        return this.show('main');
      case 'resume':
        return this.resume();
      case 'fullscreen': {
        // Düğmeyle seçilen durum ayar olarak da kalsın (sonraki girişlerde aynı davranış)
        const goFull = !this.input.fullscreen;
        this.settings.autoFullscreen = goFull ? 'on' : 'off';
        $('set-autofs').value = this.settings.autoFullscreen;
        this.applySettings();
        return this.input.toggleFullscreen();
      }
      default:
        if (a.startsWith('limit-')) {
          const [, key, op] = a.split('-');
          this.changeLimit(key, op);
        } else if (a.startsWith('map-')) this.net.emit(MSG.SET_MAP, a.slice(4));
        else if (a.startsWith('mode-')) this.net.emit(MSG.SET_MODE, a.slice(5));
    }
  }

  /** Odaya gir; şifre gerekiyorsa katılma ekranında şifre alanını aç */
  async joinRoom(code, password, msgId) {
    if (this.busy) return;
    this.busy = true;
    this.msg(msgId, 'Bağlanıyor...', false);
    const res = await this.net.request(MSG.JOIN_ROOM, {
      name: this.playerName(), char: this.settings.char, loadout: this.settings.loadout, code, password,
    });
    this.busy = false;
    if (res?.ok) return this.msg(msgId, '', false);
    if (res?.needPassword && this.current !== 'join') {
      this.show('join');
      $('inp-code').value = code;
      $('inp-join-pass').value = '';
      this.msg('join-msg', res.error);
      return $('inp-join-pass').focus();
    }
    this.msg(msgId, res?.error ?? 'Bir hata oluştu.');
  }

  renderCreate() {
    const o = this.createOpts;
    $('vis-public').classList.toggle('active', !o.locked);
    $('vis-locked').classList.toggle('active', o.locked);
    $('pass-field').classList.toggle('hidden', !o.locked);
    $('ff-off').classList.toggle('active', !o.ff);
    $('ff-on').classList.toggle('active', o.ff);
    if (o.locked) $('inp-pass').focus();
  }

  /** Ana menüdeki açık oda listesi (menü açıkken birkaç saniyede bir yenilenir) */
  async refreshRooms() {
    if (this.current !== 'main' || !this.net.connected) return;
    const list = await this.net.request(MSG.LIST_ROOMS, null, 3000);
    const box = $('room-list');
    box.replaceChildren();
    if (!Array.isArray(list) || !list.length) {
      const empty = document.createElement('p');
      empty.className = 'rooms-empty';
      empty.textContent = 'Şu an açık oda yok. CREATE ROOM ile sen kur!';
      box.append(empty);
      return;
    }
    list.sort((a, b) => (a.state === 'lobby' ? 0 : 1) - (b.state === 'lobby' ? 0 : 1) || b.humans - a.humans);
    for (const r of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `room-row${r.players >= r.max ? ' full' : ''}`;
      b.disabled = r.players >= r.max;
      const name = document.createElement('b');
      name.textContent = `${r.locked ? '🔒 ' : ''}${r.ff ? '⚔ ' : ''}${r.name}`;
      const info = document.createElement('span');
      info.textContent = `${MODES[r.mode]?.name ?? r.mode} · ${MAPS[r.map]?.name ?? r.map}`;
      const right = document.createElement('i');
      right.textContent = `${r.players}/${r.max} · ${r.state === 'lobby' ? 'LOBİDE' : 'MAÇTA'}`;
      b.append(name, info, right);
      b.addEventListener('click', () => {
        this.sfx.ensure();
        if (r.locked) {
          this.playerName();
          this.show('join');
          $('inp-code').value = r.code;
          $('inp-join-pass').value = '';
          this.msg('join-msg', 'Bu oda şifreli. Şifreyi yaz.', false);
          $('inp-join-pass').focus();
        } else this.joinRoom(r.code, '', 'main-msg');
      });
      box.append(b);
    }
  }

  /** Lobide botları sürükle-bırak ile takım değiştirme (sadece host) */
  bindBotDrag() {
    for (const team of ['red', 'blue']) {
      const zone = document.querySelector(`#screen-lobby .team.${team}`);
      zone.addEventListener('dragover', (e) => {
        if (!this.dragBot) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('drop');
      });
      zone.addEventListener('dragleave', (e) => {
        if (!zone.contains(e.relatedTarget)) zone.classList.remove('drop');
      });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drop');
        if (this.dragBot) this.net.emit(MSG.MOVE_BOT, { id: this.dragBot, team });
        this.dragBot = null;
      });
    }
  }

  resume() {
    this.sfx.ensure();
    this.show('none');
    this.input.lock();
  }

  onLockChange(locked) {
    if (!this.game.active) return;
    if (locked) this.show('none');
    else if (this.game.state !== 'ended' && !['settings', 'controls', 'loadout'].includes(this.current)) {
      $('pause-title').textContent = 'PAUSED';
      $('btn-resume').textContent = 'RESUME';
      $('btn-restart').classList.toggle('hidden', this.room?.hostId !== this.net.id);
      this.show('pause');
    }
  }

  // ---------------- Ağ ----------------

  bindNet() {
    this.net.on(MSG.ROOM_STATE, (rs) => {
      this.room = rs;
      if (this.game.active) {
        if (rs.state === 'lobby') {
          this.game.stop();
          this.show('lobby');
        } else this.game.syncRoster(rs.players);
      } else if (['main', 'join', 'create', 'lobby'].includes(this.current)) {
        this.show('lobby');
      }
      this.renderLobby();
    });

    this.net.on(MSG.MATCH_START, (info) => {
      this.game.start(info, this.net.id);
      $('btn-restart').classList.add('hidden');
      $('pause-title').textContent = 'GET READY!';
      $('btn-resume').textContent = 'CLICK TO FIGHT';
      // Maç başında önce silah seçimi (silahı sabit haritalarda — sadece AWP — seçim ekranı açılmaz)
      this.net.emit(MSG.SET_LOADOUT, this.settings.loadout);
      const force = MAPS[info.map]?.forceLoadout;
      this.forceNote = force?.primary ? `Bu haritada ana silah her zaman ${WEAPONS[force.primary].NAME}.` : '';
      if (force) {
        this.show('pause');
        this.input.unlock();
      } else this.openLoadout();
      if (this.forceNote) this.msg('loadout-msg', this.forceNote, false);
      document.body.classList.remove('in-menu');
    });

    this.net.on(MSG.NOTICE, (text) => this.msg('lobby-msg', text));

    this.net.on('disconnect', () => {
      if (this.game.active) this.game.stop();
      this.input.unlock();
      this.input.releaseKeyboard();
      this.room = null;
      this.show('main');
      this.msg('main-msg', 'Sunucu bağlantısı koptu. Yeniden bağlanılıyor...');
    });
    this.net.on('connect', () => {
      if (this.current === 'main') this.msg('main-msg', '', false);
    });
  }

  renderLobby() {
    const rs = this.room;
    if (!rs) return;
    const myId = this.net.id;
    const me = rs.players.find((p) => p.id === myId);
    const isHost = rs.hostId === myId;

    $('lobby-code').textContent = rs.code;
    // Harita seçimi ve menü arkasında harita önizlemesi
    for (const b of $('map-pick').children) {
      b.classList.toggle('active', b.dataset.map === rs.map);
      b.disabled = !isHost || rs.state !== 'lobby';
    }
    $('map-hint').textContent = isHost ? 'Haritayı seç' : 'Haritayı host seçer';
    for (const b of $('mode-pick').children) {
      b.classList.toggle('active', b.dataset.mode === (rs.mode ?? 'tdm'));
      b.disabled = !isHost || rs.state !== 'lobby';
    }
    $('mode-hint').textContent = isHost ? 'Oyun modunu seç' : 'Modu host seçer';
    // Maç sonu sınırları
    if (rs.limits) {
      const kind = rs.mode === 'ctf' ? 'flags' : rs.mode === 'kills' ? 'kills' : 'score';
      const editable = isHost && rs.state === 'lobby';
      const scoreVal = rs.limits[kind] ?? rs.limits.score;
      if (this.limitsKind !== kind) {
        this.limitsKind = kind;
        this.fillScorePresets(kind);
      }
      $('limit-score-label').textContent = { flags: 'BAYRAK SAYISI', kills: 'ÖLDÜRME SAYISI', score: 'BİTİŞ PUANI' }[kind];
      $('limit-score-desc').textContent = kind === 'flags'
        ? 'Bu kadar bayrak getiren takım kazanır'
        : kind === 'kills' ? 'Bu kadar rakip öldüren ilk takım kazanır'
        : rs.mode === 'ffa' ? 'Oyuncu puanı · Öldürme +3 · Asist +1 · Ölüm −1' : 'Takım puanı · Öldürme +3 · Asist +1 · Ölüm −1';
      $('limit-score').textContent = `${scoreVal} ${{ flags: 'BAYRAK', kills: 'ÖLDÜRME', score: 'PUAN' }[kind]}`;
      $('limit-time').textContent = `${rs.limits.time} DK`;
      for (const b of document.querySelectorAll('#limits-pick button')) b.disabled = !editable;
      for (const b of document.querySelectorAll('#limit-score-presets .preset')) b.classList.toggle('active', Number(b.dataset.value) === scoreVal);
      for (const b of document.querySelectorAll('#limit-time-presets .preset')) b.classList.toggle('active', Number(b.dataset.value) === rs.limits.time);
      $('limits-hint').textContent = isHost ? 'Puan ya da süre — hangisi önce gelirse' : 'Sınırları host seçer';
    }
    if (!this.game.active && rs.map) this.game.world.load(rs.map);
    $('lobby-type').textContent = rs.locked ? '🔒 ŞİFRELİ ODA' : '🌐 HERKESE AÇIK ODA';
    // Takım ateşi (host lobide değiştirebilir)
    const ffBtn = $('btn-ff');
    ffBtn.textContent = rs.ff ? '⚔ AÇIK' : 'KAPALI';
    ffBtn.classList.toggle('active', !!rs.ff);
    ffBtn.disabled = !isHost || rs.state !== 'lobby';
    // Herkes Tek: takım yok, herkes tek listede
    const ffa = rs.mode === 'ffa';
    document.querySelector('#screen-lobby .teams').classList.toggle('ffa', ffa);
    document.querySelector('#screen-lobby .team.red h3').textContent = ffa ? 'OYUNCULAR — HERKES HERKESE RAKİP' : 'RED TEAM';
    for (const team of ['red', 'blue']) {
      const list = $(`list-${team}`);
      list.replaceChildren();
      const members = ffa ? (team === 'red' ? rs.players : []) : rs.players.filter((p) => p.team === team);
      for (const p of members) {
        const li = document.createElement('li');
        if (p.id === myId) li.classList.add('me');
        // Host botları sürükleyip diğer takıma bırakabilir
        if (p.bot && isHost && !ffa && rs.state === 'lobby') {
          li.draggable = true;
          li.classList.add('draggable');
          li.addEventListener('dragstart', (e) => {
            this.dragBot = p.id;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', p.id);
            li.classList.add('dragging');
          });
          li.addEventListener('dragend', () => {
            this.dragBot = null;
            li.classList.remove('dragging');
            for (const z of document.querySelectorAll('#screen-lobby .team')) z.classList.remove('drop');
          });
        }
        const name = document.createElement('span');
        name.textContent = (p.id === rs.hostId ? '★ ' : p.bot ? '🤖 ' : '') + p.name;
        const status = document.createElement('span');
        status.className = p.ready || p.id === rs.hostId ? 'ok' : 'wait';
        status.textContent = p.id === rs.hostId ? 'HOST' : p.bot ? 'BOT' : p.ready ? 'READY' : '...';
        li.append(name, status);
        list.append(li);
      }
      for (let i = members.length; i < (ffa ? (team === 'red' ? rs.maxPlayers : 0) : rs.maxPerTeam); i++) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'boş';
        list.append(li);
      }
      $(`btn-${team}`).disabled = me?.team === team || members.length >= rs.maxPerTeam || rs.state !== 'lobby';
    }

    // Pratik botları (sadece host)
    $('bot-row').classList.toggle('hidden', !isHost);
    $('btn-addbot').disabled = rs.players.length >= rs.maxPlayers;
    $('btn-rmbot').disabled = !rs.players.some((p) => p.bot);

    const ready = $('btn-ready');
    ready.classList.toggle('hidden', isHost);
    ready.textContent = me?.ready ? 'NOT READY' : 'READY';
    ready.classList.toggle('active', !!me?.ready);

    const start = $('btn-start');
    start.classList.toggle('hidden', !isHost);
    const allReady = rs.players.every((p) => p.ready || p.id === rs.hostId);
    const enough = rs.players.length >= rs.minPlayers;
    start.disabled = !(allReady && enough && rs.state === 'lobby');

    let status = `${rs.players.length}/${rs.maxPlayers} oyuncu`;
    if (rs.state !== 'lobby') status = 'Maç bitiyor, lütfen bekle...';
    else if (!enough) status += ` — en az ${rs.minPlayers} gerekli`;
    else if (!allReady) status += ' — herkesin hazır olması bekleniyor';
    else status += isHost ? ' — başlatabilirsin!' : ' — host başlatacak';
    $('lobby-status').textContent = status;
    $('lobby-code').style.color = me ? TEAM_INFO[me.team].color : '';
  }

  // ---------------- Ayarlar ----------------

  bindSettings() {
    const s = this.settings;
    const bind = (id, key, fmt, parse = Number) => {
      const inp = $(id);
      const out = $(`${id}-val`);
      inp.value = s[key];
      if (out) out.textContent = fmt(s[key]);
      inp.addEventListener('input', () => {
        s[key] = parse(inp.value);
        if (out) out.textContent = fmt(s[key]);
        this.applySettings();
      });
    };
    bind('set-sens', 'sensitivity', (v) => v.toFixed(2));
    bind('set-fov', 'fov', (v) => `${v}°`);
    bind('set-vol', 'volume', (v) => `${Math.round(v * 100)}%`);
    bind('set-quality', 'quality', (v) => v, String);
    bind('set-hand', 'hand', (v) => v, String);
    bind('set-autofs', 'autoFullscreen', (v) => v, String);
  }

  applySettings() {
    saveSettings(this.settings);
    this.input.autoFullscreen = this.settings.autoFullscreen !== 'off';
    this.sfx.setVolume(this.settings.volume);
    this.view.applyQuality(this.settings.quality);
    if (this.game.active) this.game.applySettings();
    else {
      this.view.camera.fov = this.settings.fov;
      this.view.camera.updateProjectionMatrix();
    }
  }
}
