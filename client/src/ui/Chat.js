import { MSG } from '@comic-strike/shared/protocol.js';
import { CHAT } from '@comic-strike/shared/constants.js';

const $ = (id) => document.getElementById(id);

/**
 * Oyun içi sohbet: Enter herkese, Y sadece takıma yazar.
 * Yazarken oyun tuşları (WASD vb.) oyuna gitmez; fare kilidi korunur.
 * Esc / boş Enter kutuyu kapatır.
 */
export class Chat {
  constructor({ net, input, game, hud }) {
    this.net = net;
    this.input = input;
    this.game = game;
    this.hud = hud;
    this.open = false;
    this.team = false;
    this.box = $('chat-input');
    this.box.maxLength = CHAT.MAX_LEN;

    // Yakalama aşamasında dinle: açılış tuşu ('y') kutuya harf olarak düşmesin
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.open || e.repeat || !this.canOpen()) return;
        if (e.code !== 'Enter' && e.code !== 'NumpadEnter' && e.code !== 'KeyY') return;
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
        e.preventDefault();
        this.show(e.code === 'KeyY' && this.game.mode !== 'ffa');
      },
      true,
    );
    this.box.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        this.send();
      } else if (e.code === 'Escape') this.hide();
    });
    this.box.addEventListener('blur', () => this.hide());

    net.on(MSG.CHAT_MSG, (m) => {
      if (this.game.active) this.hud.chatLine(m);
    });
  }

  /** Sadece maç içindeyken ve fare oyuna kilitliyken açılır (menüdeyken değil) */
  canOpen() {
    return this.game.active && this.input.locked;
  }

  show(team) {
    this.open = true;
    this.team = team;
    this.input.clear(); // basılı kalan hareket tuşlarını bırak
    this.game.chatting = true;
    this.hud.chatInput(true, team);
    this.box.value = '';
    this.box.focus();
  }

  hide() {
    if (!this.open) return;
    this.open = false;
    this.game.chatting = false;
    this.hud.chatInput(false);
    this.box.blur();
  }

  send() {
    const t = this.box.value.trim();
    if (t) this.net.emit(MSG.CHAT, { t: t.slice(0, CHAT.MAX_LEN), team: this.team });
    this.hide();
  }
}
