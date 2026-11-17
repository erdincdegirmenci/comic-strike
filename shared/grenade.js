// Bomba fiziği — istemci ve sunucu aynı kodu, aynı sabit adımla çalıştırır.
// Böylece sunucu yalnızca başlangıç konumu/hızını yollar, herkes aynı yörüngeyi çizer.
import { GRENADE } from './constants.js';

const R = GRENADE.RADIUS;

function overlaps(p, solids) {
  for (const b of solids) {
    if (
      p[0] > b.min[0] - R && p[0] < b.max[0] + R &&
      p[1] > b.min[1] - R && p[1] < b.max[1] + R &&
      p[2] > b.min[2] - R && p[2] < b.max[2] + R
    ) return true;
  }
  return false;
}

/** Atış yönünden başlangıç hızı. dir normalize olmalı. */
export function throwVelocity(dir) {
  return [dir[0] * GRENADE.THROW_SPEED, dir[1] * GRENADE.THROW_SPEED + GRENADE.THROW_UP, dir[2] * GRENADE.THROW_SPEED];
}

/** Tek sabit adım (GRENADE.STEP). g = { p:[x,y,z], v:[x,y,z] } yerinde güncellenir. */
export function stepGrenade(g, solids) {
  const dt = GRENADE.STEP;
  g.v[1] -= GRENADE.GRAVITY * dt;
  // Eksen eksen hareket: çarpışan eksende geri sek
  for (let a = 0; a < 3; a++) {
    const old = g.p[a];
    g.p[a] = old + g.v[a] * dt;
    if (!overlaps(g.p, solids)) continue;
    g.p[a] = old;
    if (a === 1 && g.v[1] < 0) {
      // Yere çarptı
      if (g.v[1] < -1.5) {
        g.v[1] = -g.v[1] * GRENADE.BOUNCE;
        g.v[0] *= GRENADE.FRICTION;
        g.v[2] *= GRENADE.FRICTION;
      } else {
        g.v[1] = 0;
        g.v[0] *= 0.9; // yuvarlanma sürtünmesi
        g.v[2] *= 0.9;
      }
    } else {
      g.v[a] = -g.v[a] * GRENADE.BOUNCE;
    }
  }
}

/** Başlangıçtan itibaren ms kadar ilerletilmiş konum (yeni nesne döner). */
export function simulateGrenade(o, v, ms, solids) {
  const g = { p: [...o], v: [...v] };
  const steps = Math.floor(ms / 1000 / GRENADE.STEP);
  for (let i = 0; i < steps; i++) stepGrenade(g, solids);
  return g;
}
