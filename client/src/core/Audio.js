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

  reload() {
    if (!this.ready) return;
    this.noiseBurst({ gain: 0.35, decay: 0.05, freq: 2500, type: 'highpass', delay: 0.15 });
    this.noiseBurst({ gain: 0.4, decay: 0.06, freq: 1800, type: 'highpass', delay: 0.9 });
    this.noiseBurst({ gain: 0.5, decay: 0.07, freq: 2200, type: 'highpass', delay: 1.5 });
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
