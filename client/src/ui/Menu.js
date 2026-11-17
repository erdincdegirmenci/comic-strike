import { MSG } from '@comic-strike/shared/protocol.js';
import { TEAM_INFO } from '@comic-strike/shared/constants.js';
import { saveSettings } from './settings.js';

const $ = (id) => document.getElementById(id);

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
    this.input.onLockChange = (locked) => this.onLockChange(locked);
    $('inp-name').value = this.settings.name;
  }

  show(name) {
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
        return this.request(MSG.QUICK_PLAY, { name: this.playerName() }, 'main-msg');
      case 'create':
        return this.request(MSG.CREATE_ROOM, { name: this.playerName() }, 'main-msg');
      case 'join':
        this.playerName();
        this.show('join');
        this.msg('join-msg', '', false);
        return $('inp-code').focus();
      case 'join-confirm': {
        const code = $('inp-code').value.trim().toUpperCase();
        if (code.length < 4) return this.msg('join-msg', 'Oda kodunu gir.');
        return this.request(MSG.JOIN_ROOM, { name: this.settings.name, code }, 'join-msg');
      }
      case 'settings':
        this.settingsBack = this.current;
        return this.show('settings');
      case 'back':
        return this.show(this.current === 'settings' ? this.settingsBack : 'main');
      case 'team-red':
      case 'team-blue':
        return this.net.emit(MSG.SET_TEAM, a.slice(5));
      case 'ready': {
        const me = this.room?.players.find((p) => p.id === this.net.id);
        return this.net.emit(MSG.SET_READY, !me?.ready);
      }
      case 'start':
        return this.net.emit(MSG.START_MATCH);
      case 'copy':
        navigator.clipboard?.writeText(this.room?.code ?? '').catch(() => {});
        return this.msg('lobby-msg', 'Oda kodu kopyalandı!', false);
      case 'leave':
      case 'leave-match':
        this.net.emit(MSG.LEAVE_ROOM);
        this.room = null;
        if (this.game.active) this.game.stop();
        this.input.unlock();
        return this.show('main');
      case 'resume':
        return this.resume();
      default:
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
    else if (this.game.state !== 'ended' && this.current !== 'settings') {
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
      this.show('pause');
      document.body.classList.remove('in-menu');
    });

    this.net.on(MSG.NOTICE, (text) => this.msg('lobby-msg', text));

    this.net.on('disconnect', () => {
      if (this.game.active) this.game.stop();
      this.input.unlock();
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
    $('lobby-type').textContent = rs.isPublic ? 'PUBLIC ROOM' : 'PRIVATE ROOM';
    for (const team of ['red', 'blue']) {
      const list = $(`list-${team}`);
      list.replaceChildren();
      const members = rs.players.filter((p) => p.team === team);
      for (const p of members) {
        const li = document.createElement('li');
        if (p.id === myId) li.classList.add('me');
        const name = document.createElement('span');
        name.textContent = (p.id === rs.hostId ? '★ ' : '') + p.name;
        const status = document.createElement('span');
        status.className = p.ready || p.id === rs.hostId ? 'ok' : 'wait';
        status.textContent = p.id === rs.hostId ? 'HOST' : p.ready ? 'READY' : '...';
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
  }

  applySettings() {
    saveSettings(this.settings);
    this.sfx.setVolume(this.settings.volume);
    this.view.applyQuality(this.settings.quality);
    if (this.game.active) this.game.applySettings();
    else {
      this.view.camera.fov = this.settings.fov;
      this.view.camera.updateProjectionMatrix();
    }
  }
}
