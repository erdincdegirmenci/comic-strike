import { MSG } from '@comic-strike/shared/protocol.js';
import { TEAM_INFO, CHARACTERS, CHARACTER_IDS, WEAPONS, LOADOUT_OPTIONS, cleanLoadout, MODES, MODE_IDS } from '@comic-strike/shared/constants.js';
import { MAPS, MAP_IDS } from '@comic-strike/shared/maps.js';
import { saveSettings } from './settings.js';
import { drawSpray } from '../fx/Sprays.js';
import { WeaponPreview } from './WeaponPreview.js';

const $ = (id) => document.getElementById(id);

// Kontroller tablosu: [eylem, klavye, fare]
const CONTROLS = [
  ['HAREKET'],
  ['İLERİ', 'W', ''], ['GERİ', 'S', ''], ['SOL', 'A', ''], ['SAĞ', 'D', ''],
  ['ZIPLA', 'SPACE', ''], ['HIZLI KOŞ (STAMINA)', 'LEFT SHIFT', ''], ['ÇÖMEL', 'LEFT CTRL / C', ''],
  ['SAVAŞ'],
  ['ATEŞ / BOMBA AT', '', 'LEFT MOUSE BUTTON'], ['NİŞAN AL / DÜRBÜN / AĞIR BIÇAK', '', 'RIGHT MOUSE BUTTON'],
  ['ŞARJÖR DEĞİŞTİR', 'R', ''],
  ['ANA SİLAH', '1', ''], ['TABANCA', '2', ''], ['BIÇAK', '3', ''], ['BOMBA', '4', ''],
  ['ÖNCEKİ SİLAH', 'Q', 'MOUSE WHEEL UP'], ['SONRAKİ SİLAH', '', 'MOUSE WHEEL DOWN'],
  ['SİLAH SEÇİMİ', 'B', ''],
  ['DİĞER'],
  ['STICKER YAPIŞTIR', 'T', ''], ['TAKIMA İŞARET', 'E', 'MIDDLE MOUSE BUTTON'], ['SKOR TABLOSU', 'TAB', ''], ['MENÜ / DURAKLAT', 'ESC', ''],
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
    this.buildControls();
    this.preview = new WeaponPreview($('lo-canvas'));
    this.buildLoadout();
    this.game.onBuyMenu = () => this.openLoadout();
    this.game.onLoadout = (d) => {
      this.msg('loadout-msg', d.now ? 'Silahların eline verildi!' : 'Seçimin bir sonraki doğuşta geçerli olacak.', false);
    };
  }

  buildControls() {
    const t = $('controls-table');
    const row = (cells, cls) => {
      const tr = document.createElement('tr');
      if (cls) tr.className = cls;
      for (const [tag, text, c] of cells) {
        const td = document.createElement(tag);
        td.textContent = text;
        if (c) td.className = c;
        tr.append(td);
      }
      t.append(tr);
    };
    row([['th', 'EYLEM'], ['th', 'KLAVYE'], ['th', 'FARE']]);
    for (const [action, key, mouse] of CONTROLS) {
      if (key === undefined) row([['td', action, 'group'], ['td', ''], ['td', '']], 'group-row');
      else row([['td', action, 'act'], ['td', key, 'key'], ['td', mouse, 'key']]);
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
        stats.textContent = w.kind === 'gun'
          ? `HASAR ${w.DAMAGE} · ŞARJÖR ${w.MAG_SIZE}+${w.RESERVE} · ${Math.round(60000 / w.FIRE_INTERVAL)} RPM`
          : w.id === 'he' ? `HASAR ${w.DAMAGE} · ${w.RADIUS} m`
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
    $('lo-stats').textContent = w.kind === 'gun'
      ? `HASAR ${w.DAMAGE} · KAFA x${w.HEADSHOT_MULT} · ŞARJÖR ${w.MAG_SIZE} · YEDEK ${w.RESERVE} · ${Math.round(60000 / w.FIRE_INTERVAL)} RPM`
      : w.id === 'he' ? `HASAR ${w.DAMAGE} · ETKİ ALANI ${w.RADIUS} m · basılı tut, uzağa at`
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
      box.append(b);
    }
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

  show(name) {
    if (name !== 'loadout') this.preview?.stop();
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== `screen-${name}`);
    this.current = name;
    document.body.classList.toggle('in-menu', !this.game.active);
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
        return this.request(MSG.CREATE_ROOM, { name: this.playerName(), char: this.settings.char, loadout: this.settings.loadout }, 'main-msg');
      case 'join':
        this.playerName();
        this.show('join');
        this.msg('join-msg', '', false);
        return $('inp-code').focus();
      case 'join-confirm': {
        const code = $('inp-code').value.trim().toUpperCase();
        if (code.length < 4) return this.msg('join-msg', 'Oda kodunu gir.');
        return this.request(MSG.JOIN_ROOM, { name: this.settings.name, char: this.settings.char, loadout: this.settings.loadout, code }, 'join-msg');
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
        if (a.startsWith('map-')) this.net.emit(MSG.SET_MAP, a.slice(4));
        else if (a.startsWith('mode-')) this.net.emit(MSG.SET_MODE, a.slice(5));
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
      } else if (['main', 'join', 'lobby'].includes(this.current)) {
        this.show('lobby');
      }
      this.renderLobby();
    });

    this.net.on(MSG.MATCH_START, (info) => {
      this.game.start(info, this.net.id);
      $('pause-title').textContent = 'GET READY!';
      $('btn-resume').textContent = 'CLICK TO FIGHT';
      // Maç başında önce silah seçimi
      this.net.emit(MSG.SET_LOADOUT, this.settings.loadout);
      this.openLoadout();
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
    if (!this.game.active && rs.map) this.game.world.load(rs.map);
    $('lobby-type').textContent = rs.isPublic ? 'PUBLIC ROOM' : 'PRIVATE ROOM';
    for (const team of ['red', 'blue']) {
      const list = $(`list-${team}`);
      list.replaceChildren();
      const members = rs.players.filter((p) => p.team === team);
      for (const p of members) {
        const li = document.createElement('li');
        if (p.id === myId) li.classList.add('me');
        const name = document.createElement('span');
        name.textContent = (p.id === rs.hostId ? '★ ' : p.bot ? '🤖 ' : '') + p.name;
        const status = document.createElement('span');
        status.className = p.ready || p.id === rs.hostId ? 'ok' : 'wait';
        status.textContent = p.id === rs.hostId ? 'HOST' : p.bot ? 'BOT' : p.ready ? 'READY' : '...';
        li.append(name, status);
        list.append(li);
      }
      for (let i = members.length; i < rs.maxPerTeam; i++) {
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
