// Tam ekranda kilitlenen tuşlar (Ctrl/Cmd kombinasyonları dahil oyuna gelir). Escape bilerek yok.
const GAME_KEYS = [
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyQ', 'KeyR', 'KeyT', 'KeyB', 'KeyE', 'KeyF', 'KeyN', 'KeyP', 'KeyH', 'KeyL',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Tab', 'Space', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight',
];

/** Klavye, fare ve Pointer Lock yönetimi. */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouseDown = false;
    this.mouseClicked = false;
    this.rightDown = false;
    this.rightClicked = false;
    this.middleClicked = false;
    this.wheel = 0;
    this.dx = 0;
    this.dy = 0;
    this.locked = false;
    this.gameActive = false;
    this.onLockChange = null;

    const isTyping = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;

    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      // Ctrl: çömelme. Tarayıcı kısayollarını (Ctrl+S, Ctrl+D, Ctrl+W...) oyun sırasında engelle.
      // Ctrl+W (sekmeyi kapat) normal sekmede engellenemez; bu yüzden oyunda tam ekran + Keyboard Lock
      // kullanılır (Chrome/Edge). Desteklenmeyen tarayıcılarda çıkmadan önce onay penceresi çıkar.
      if (this.gameActive && (e.code === 'Tab' || e.code === 'Space' || e.ctrlKey || e.metaKey)) e.preventDefault();
      if (!e.repeat) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    // Maç sırasında yanlışlıkla sekme kapanmasın (Ctrl+W yedek koruması)
    window.addEventListener('beforeunload', (e) => {
      if (!this.gameActive) return;
      e.preventDefault();
      e.returnValue = '';
    });
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) navigator.keyboard?.unlock?.();
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      } else if (e.button === 2) {
        this.rightDown = true;
        this.rightClicked = true;
      } else if (e.button === 1) {
        this.middleClicked = true;
        e.preventDefault();
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightDown = false;
    });
    document.addEventListener('contextmenu', (e) => {
      if (this.gameActive) e.preventDefault();
    });
    document.addEventListener('wheel', (e) => {
      if (this.locked) this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // Bazı tarayıcılarda nadiren gelen ani sıçramaları yok say
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.clear();
      this.onLockChange?.(this.locked);
    });
  }

  clear() {
    this.keys.clear();
    this.mouseDown = false;
    this.rightDown = false;
  }

  down(code) {
    return this.keys.has(code);
  }

  pressed(code) {
    return this.pressedKeys.has(code);
  }

  consumeMouse() {
    const m = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return m;
  }

  endFrame() {
    this.pressedKeys.clear();
    this.mouseClicked = false;
    this.rightClicked = false;
    this.middleClicked = false;
    this.wheel = 0;
  }

  /**
   * Tam ekrana geçip oyun tuşlarını kilitler. Böylece Ctrl+W, Ctrl+S, Ctrl+D gibi tarayıcı kısayolları
   * sekmeyi kapatmak yerine oyuna gelir. ESC kilitlenmez: tek basış her zamanki gibi menüyü açar.
   */
  lockKeyboard() {
    const lockKeys = () => {
      navigator.keyboard?.lock?.(GAME_KEYS)?.catch?.(() => {});
    };
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(lockKeys, () => {});
      } else lockKeys();
    } catch {
      /* tam ekran desteklenmiyor: beforeunload onayı yine korur */
    }
  }

  /** Maçtan çıkınca tam ekranı ve tuş kilidini bırak */
  releaseKeyboard() {
    try {
      navigator.keyboard?.unlock?.();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch {
      /* yok say */
    }
  }

  /** Pointer Lock ister. Kullanıcı tıklaması içinde çağrılmalı. */
  lock() {
    if (this.gameActive) this.lockKeyboard();
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) {
        p.catch(() => {
          // unadjustedMovement desteklenmiyorsa normal iste
          try {
            this.canvas.requestPointerLock()?.catch?.(() => {});
          } catch {
            /* yok say */
          }
        });
      }
    } catch {
      /* yok say */
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
