/**
 * Ses efektleri — hiç ses dosyası yok, hepsi WebAudio ile anlık üretilir.
 * Tarayıcılar sesi ilk kullanıcı tıklamasından sonra açar; ensure() bunu halleder.
 */
export class Sfx {
  constructor() {
    this.ctx = null;
    this.volume = 0.6;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, len);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  get ready() {
    return this.ctx && this.ctx.state === 'running';
  }

  env(gainNode, t, peak, decay) {
    gainNode.gain.setValueAtTime(peak, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + decay);
  }

  noiseBurst({ gain = 1, decay = 0.12, freq = 1200, q = 0.8, type = 'bandpass', delay = 0 }) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    this.env(g, t, gain, decay);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.05);
  }

  tone({ type = 'sine', from = 440, to = from, gain = 0.4, decay = 0.1, delay = 0 }) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + decay);
    const g = c.createGain();
    this.env(g, t, gain, decay);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  shot(volume = 1, far = false) {
    if (!this.ready || volume <= 0.01) return;
    this.noiseBurst({ gain: 0.9 * volume, decay: far ? 0.22 : 0.13, freq: far ? 700 : 1400, q: 0.7 });
    this.tone({ type: 'sine', from: 150, to: 45, gain: 0.7 * volume, decay: 0.12 });
  }

  awp(volume = 1, far = false) {
    if (!this.ready || volume <= 0.01) return;
    this.noiseBurst({ gain: 1.1 * volume, decay: far ? 0.5 : 0.32, freq: far ? 500 : 900, q: 0.5 });
    this.tone({ type: 'sine', from: 110, to: 30, gain: 0.95 * volume, decay: 0.35 });
    // sürgü sesi
    this.noiseBurst({ gain: 0.25 * volume, decay: 0.05, freq: 2600, type: 'highpass', delay: 0.55 });
    this.noiseBurst({ gain: 0.3 * volume, decay: 0.06, freq: 2000, type: 'highpass', delay: 0.85 });
  }

  /** Pompalı: kalın patlama + pompa sesi */
  shotgun(volume = 1, far = false) {
    if (!this.ready || volume <= 0.01) return;
    this.noiseBurst({ gain: 1.2 * volume, decay: far ? 0.4 : 0.26, freq: far ? 450 : 800, q: 0.4 });
    this.tone({ type: 'sine', from: 120, to: 35, gain: 1.0 * volume, decay: 0.2 });
    this.noiseBurst({ gain: 0.3 * volume, decay: 0.07, freq: 1800, type: 'highpass', delay: 0.35 });
    this.noiseBurst({ gain: 0.35 * volume, decay: 0.08, freq: 1400, type: 'highpass', delay: 0.52 });
  }

  /** Kovboy tabancası / ağır tabanca: tok ve çınlayan */
  revolver(volume = 1, far = false) {
    if (!this.ready || volume <= 0.01) return;
    this.noiseBurst({ gain: 1.0 * volume, decay: far ? 0.3 : 0.18, freq: far ? 650 : 1100, q: 0.6 });
    this.tone({ type: 'sine', from: 170, to: 50, gain: 0.8 * volume, decay: 0.16 });
    this.tone({ type: 'triangle', from: 1900, to: 1700, gain: 0.05 * volume, decay: 0.25 });
  }

  /** Roket ateşleme: vınlayan ıslık */
  rocket(volume = 1) {
    if (!this.ready || volume <= 0.01) return;
    this.noiseBurst({ gain: 0.9 * volume, decay: 0.5, freq: 600, q: 0.5 });
    this.tone({ type: 'sawtooth', from: 220, to: 90, gain: 0.18 * volume, decay: 0.45 });
  }

  /** Molotof kırılıp tutuşunca */
  fireBurst(volume = 1) {
    if (!this.ready || volume <= 0.01) return;
    this.noiseBurst({ gain: 0.5 * volume, decay: 0.08, freq: 3500, type: 'highpass' }); // cam kırılması
    this.noiseBurst({ gain: 0.9 * volume, decay: 1.2, freq: 500, q: 0.3, type: 'lowpass', delay: 0.05 });
  }

  /** Alev silahı: kısa uğultu (sürekli ateşte üst üste biner) */
  flame(volume = 1) {
    if (!this.ready || volume <= 0.01) return;
    this.noiseBurst({ gain: 0.55 * volume, decay: 0.22, freq: 650, q: 0.4, type: 'lowpass' });
  }

  /** Dondurucu: tıslama */
  frost(volume = 1) {
    if (!this.ready || volume <= 0.01) return;
    this.noiseBurst({ gain: 0.22 * volume, decay: 0.18, freq: 5200, q: 0.8, type: 'highpass' });
  }

  flashbang(volume = 1) {
    if (!this.ready || volume <= 0.01) return;
    this.noiseBurst({ gain: 1.2 * volume, decay: 0.18, freq: 2600, q: 0.4 });
    this.tone({ type: 'square', from: 300, to: 60, gain: 0.35 * volume, decay: 0.15 });
  }

  /** Flaş yiyince kulak çınlaması */
  ring(seconds, strength = 1) {
    if (!this.ready) return;
    this.tone({ type: 'sine', from: 3900, to: 3600, gain: 0.09 * strength, decay: seconds });
  }

  /** Buz çatırtısı (dondurma bombası / donma) */
  ice(volume = 1) {
    if (!this.ready || volume <= 0.01) return;
    for (let i = 0; i < 5; i++) this.tone({ type: 'triangle', from: 1500 + i * 420, to: 900 + i * 300, gain: 0.14 * volume, decay: 0.12, delay: i * 0.045 });
    this.noiseBurst({ gain: 0.4 * volume, decay: 0.3, freq: 4200, type: 'highpass' });
  }

  hook(volume = 1) {
    if (!this.ready || volume <= 0.01) return;
    this.noiseBurst({ gain: 0.3 * volume, decay: 0.2, freq: 2400, q: 2 });
    this.tone({ type: 'square', from: 900, to: 220, gain: 0.12 * volume, decay: 0.14 });
  }

  /** Seri duyurusu: yükselen üç nota (level arttıkça daha tiz) */
  streak(level = 2) {
    if (!this.ready) return;
    const base = 330 + Math.min(level, 6) * 45;
    [1, 1.26, 1.5].forEach((k, i) => this.tone({ type: 'square', from: base * k, gain: 0.13, decay: 0.16, delay: i * 0.09 }));
  }

  knife(volume = 1) {
    if (!this.ready || volume <= 0.01) return;
    this.noiseBurst({ gain: 0.35 * volume, decay: 0.12, freq: 3200, q: 1.5 });
  }

  stab() {
    if (!this.ready) return;
    this.tone({ type: 'square', from: 220, to: 90, gain: 0.25, decay: 0.08 });
  }

  explosion(volume = 1) {
    if (!this.ready || volume <= 0.01) return;
    this.noiseBurst({ gain: 1.3 * volume, decay: 0.9, freq: 300, q: 0.4, type: 'lowpass' });
    this.tone({ type: 'sine', from: 90, to: 25, gain: 1.0 * volume, decay: 0.8 });
    this.noiseBurst({ gain: 0.6 * volume, decay: 0.25, freq: 1500, q: 0.5 });
  }

  smokePop(volume = 1) {
    if (!this.ready || volume <= 0.01) return;
    this.noiseBurst({ gain: 0.6 * volume, decay: 1.4, freq: 900, q: 0.3 });
  }

  throw() {
    if (!this.ready) return;
    this.noiseBurst({ gain: 0.3, decay: 0.15, freq: 1200, q: 1 });
  }

  bounce(volume = 1) {
    if (!this.ready || volume <= 0.01) return;
    this.tone({ type: 'triangle', from: 900, to: 600, gain: 0.15 * volume, decay: 0.05 });
  }

  spray() {
    if (!this.ready) return;
    this.noiseBurst({ gain: 0.4, decay: 0.5, freq: 5000, type: 'highpass' });
  }

  scope() {
    if (!this.ready) return;
    this.tone({ type: 'square', from: 1400, gain: 0.05, decay: 0.03 });
  }

  draw() {
    if (!this.ready) return;
    this.noiseBurst({ gain: 0.2, decay: 0.04, freq: 3000, type: 'highpass' });
  }

  hit() {
    if (!this.ready) return;
    this.tone({ type: 'triangle', from: 1900, to: 1500, gain: 0.25, decay: 0.06 });
  }

  kill() {
    if (!this.ready) return;
    this.tone({ type: 'square', from: 660, gain: 0.12, decay: 0.09 });
    this.tone({ type: 'square', from: 990, gain: 0.12, decay: 0.16, delay: 0.08 });
  }

  hurt() {
    if (!this.ready) return;
    this.tone({ type: 'sawtooth', from: 200, to: 80, gain: 0.25, decay: 0.18 });
  }

  empty() {
    if (!this.ready) return;
    this.noiseBurst({ gain: 0.3, decay: 0.03, freq: 3500, type: 'highpass' });
  }

  /** Reload başlangıcı: kumaş / tutuş sesi */
  reload() {
    if (!this.ready) return;
    this.noiseBurst({ gain: 0.18, decay: 0.08, freq: 900, q: 0.6 });
  }

  /** Şarjör animasyonu adımları: 'out' eski şarjör çıktı, 'in' yeni şarjör takıldı */
  reloadStep(step) {
    if (!this.ready) return;
    if (step === 'out') {
      this.noiseBurst({ gain: 0.35, decay: 0.05, freq: 2500, type: 'highpass' });
      this.tone({ type: 'triangle', from: 520, to: 380, gain: 0.08, decay: 0.06 });
    } else {
      this.noiseBurst({ gain: 0.5, decay: 0.06, freq: 2200, type: 'highpass' });
      this.tone({ type: 'square', from: 260, to: 140, gain: 0.12, decay: 0.05 });
      this.noiseBurst({ gain: 0.35, decay: 0.05, freq: 1600, type: 'highpass', delay: 0.12 });
    }
  }

  /** Zıplama pedi */
  boing() {
    if (!this.ready) return;
    this.tone({ type: 'sine', from: 180, to: 880, gain: 0.3, decay: 0.32 });
    this.tone({ type: 'triangle', from: 360, to: 1300, gain: 0.12, decay: 0.25, delay: 0.05 });
  }

  /** Mermi kutusu alındı */
  pickup() {
    if (!this.ready) return;
    this.tone({ type: 'square', from: 660, to: 990, gain: 0.12, decay: 0.12 });
    this.tone({ type: 'square', from: 990, gain: 0.1, decay: 0.1, delay: 0.08 });
  }

  /** Takım işareti */
  mark() {
    if (!this.ready) return;
    this.tone({ type: 'sine', from: 1200, to: 900, gain: 0.2, decay: 0.18 });
    this.tone({ type: 'sine', from: 1500, gain: 0.12, decay: 0.15, delay: 0.1 });
  }

  /** Bayrak olayları: good=true bizim lehimize (yükselen), false aleyhimize (alçalan) */
  flag(good = true) {
    if (!this.ready) return;
    const notes = good ? [523, 659, 784] : [523, 415, 330];
    notes.forEach((f, i) => this.tone({ type: 'triangle', from: f, gain: 0.18, decay: 0.16, delay: i * 0.09 }));
  }

  /** Sayı! kısa fanfar */
  capture(good = true) {
    if (!this.ready) return;
    const notes = good ? [523, 659, 784, 1047, 784, 1047] : [392, 370, 349, 262];
    notes.forEach((f, i) => this.tone({ type: 'square', from: f, gain: 0.12, decay: 0.18, delay: i * 0.11 }));
  }

  countdown(final = false) {
    if (!this.ready) return;
    this.tone({ type: 'square', from: final ? 880 : 440, gain: 0.12, decay: final ? 0.4 : 0.15 });
  }
}
