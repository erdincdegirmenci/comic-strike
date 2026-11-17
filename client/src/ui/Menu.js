import { saveSettings } from './settings.js';

const $ = (id) => document.getElementById(id);

/**
 * Menüler: ana menü (isim + PLAY + SETTINGS), ayarlar ve duraklatma.
 * Oda / lobi / takım ekranı yok: tek sunucu, PLAY'e basınca direkt oyuna girilir.
 */
export class Menu {
  constructor(ctx) {
    Object.assign(this, ctx); // net, game, input, sfx, settings, view
    this.current = 'loading';
    this.settingsBack = 'main';

    $('ui').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      this.sfx.ensure();
      this.action(btn.dataset.action);
    });
    $('game').addEventListener('click', () => {
      if (this.game.active && !this.input.locked) this.resume();
    });
    $('inp-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.action('play');
    });

    this.bindSettings();
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

  /** Açılışta sunucu durumunu göster */
  async checkServer() {
    const h = await this.net.health();
    $('server-status').textContent = h ? `● ${h.name} v${h.version} sunucusuna bağlı` : '● Sunucuya ulaşılamıyor';
    $('server-status').classList.toggle('error', !h);
  }

  action(a) {
    switch (a) {
      case 'play':
        if (!this.playerName()) {
          this.msg('main-msg', 'Önce bir isim yaz.');
          $('inp-name').focus();
          return;
        }
        this.msg('main-msg', '', false);
        this.game.startOffline();
        $('pause-title').textContent = 'GET READY!';
        $('btn-resume').textContent = 'CLICK TO PLAY';
        return this.show('pause');
      case 'settings':
        this.settingsBack = this.current;
        return this.show('settings');
      case 'back':
        return this.show(this.settingsBack);
      case 'resume':
        return this.resume();
      case 'quit':
        this.game.stop();
        this.input.unlock();
        return this.show('main');
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
    else if (this.current !== 'settings') {
      $('pause-title').textContent = 'PAUSED';
      $('btn-resume').textContent = 'RESUME';
      this.show('pause');
    }
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
