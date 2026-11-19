import { MSG } from '@comic-strike/shared/protocol.js';

const $ = (id) => document.getElementById(id);

/**
 * "Maçı baştan başlat" oylaması. Host açar; herkesin ekranında panel çıkar.
 * F1 / F2 ile (fare kilitliyken) ya da düğmelerle (menüdeyken) oy verilir.
 * Oyuncuların (botlar hariç) yarısından fazlası EVET derse maç baştan başlar.
 */
export class Vote {
  constructor({ net, game, hud }) {
    this.net = net;
    this.game = game;
    this.hud = hud;
    this.state = null;
    this.timer = null;

    net.on(MSG.VOTE_STATE, (s) => this.onState(s));
    $('vote-yes').addEventListener('click', () => this.cast(true));
    $('vote-no').addEventListener('click', () => this.cast(false));
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.canVote() || (e.code !== 'F1' && e.code !== 'F2')) return;
        e.preventDefault(); // F1 tarayıcı yardım sayfasını açmasın
        this.cast(e.code === 'F1');
      },
      true,
    );
  }

  get voted() {
    return !!this.state?.voters?.includes(this.net.id);
  }

  canVote() {
    return this.game.active && this.state?.active && !this.voted;
  }

  cast(yes) {
    if (!this.state?.active) return;
    this.net.emit(MSG.VOTE, { yes });
  }

  onState(s) {
    const box = $('vote');
    if (!s.active) {
      this.state = null;
      clearInterval(this.timer);
      box.classList.add('hidden');
      if (this.game.active && s.result) {
        this.hud.flagNotice(s.result === 'restart' ? 'MAÇ BAŞTAN BAŞLIYOR!' : 'OYLAMA REDDEDİLDİ', s.result === 'restart' ? 'good' : 'bad');
      }
      return;
    }
    this.state = { ...s, at: performance.now() };
    if (!this.game.active) return;
    box.classList.remove('hidden');
    box.classList.toggle('voted', this.voted);
    $('vote-title').textContent = `${s.by} maçı baştan başlatmak istiyor`;
    $('vote-note').textContent = this.voted
      ? 'Oyun verildi · diğer oyuncular bekleniyor'
      : 'Puanlar sıfırlanır, herkes yeniden doğar · Fare kilitliyken F1 / F2';
    this.render();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.render(), 250);
  }

  render() {
    const s = this.state;
    if (!s) return;
    const left = Math.max(0, Math.ceil((s.left - (performance.now() - s.at)) / 1000));
    $('vote-count').textContent = `EVET ${s.yes} · HAYIR ${s.no} · ${s.need}/${s.total} EVET gerekli · ${left} sn`;
  }
}
