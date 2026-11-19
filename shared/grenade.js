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

/** Basılı tutma oranından (0..1) atış gücü */
export function throwPower(charge) {
  const c = Math.max(0, Math.min(1, Number(charge) || 0));
  return GRENADE.MIN_POWER + (1 - GRENADE.MIN_POWER) * c;
}

/** Atış yönünden başlangıç hızı. dir normalize olmalı, charge 0..1 (basılı tutma). */
export function throwVelocity(dir, charge = 1) {
  const s = GRENADE.THROW_SPEED * throwPower(charge);
  const up = GRENADE.THROW_UP * (0.5 + 0.5 * throwPower(charge));
  return [dir[0] * s, dir[1] * s + up, dir[2] * s];
}

/** Tek sabit adım (GRENADE.STEP). g = { p:[x,y,z], v:[x,y,z] } yerinde güncellenir. Bir yere çarptıysa true döner. */
export function stepGrenade(g, solids) {
  const dt = GRENADE.STEP;
  let hit = false;
  g.v[1] -= GRENADE.GRAVITY * dt;
  // Eksen eksen hareket: çarpışan eksende geri sek
  for (let a = 0; a < 3; a++) {
    const old = g.p[a];
    g.p[a] = old + g.v[a] * dt;
    if (!overlaps(g.p, solids)) continue;
    g.p[a] = old;
    hit = true;
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
  return hit;
}

/** Işın - kutu kesişimi: mesafe ya da -1 (dir normalize) */
function rayBox(o, d, min, max, maxT) {
  let tmin = 0;
  let tmax = maxT;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < min[i] || o[i] > max[i]) return -1;
    } else {
      let t1 = (min[i] - o[i]) / d[i];
      let t2 = (max[i] - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

/**
 * Roket: yerçekimsiz, dümdüz bir sabit adım. Duvara çarparsa çarpma noktasında durur (v sıfırlanır) ve true döner.
 * (Sunucu oyunculara çarpmayı ayrıca kontrol eder; istemci sadece görüntü için kullanır.)
 */
export function stepRocket(g, solids) {
  const speed = Math.hypot(g.v[0], g.v[1], g.v[2]);
  if (speed < 1e-6) return false;
  const d = [g.v[0] / speed, g.v[1] / speed, g.v[2] / speed];
  const len = speed * GRENADE.STEP;
  let best = len;
  for (const b of solids) {
    const t = rayBox(g.p, d, b.min, b.max, best);
    if (t >= 0 && t < best) best = t;
  }
  const go = best < len ? Math.max(0, best - 0.08) : len;
  for (let i = 0; i < 3; i++) g.p[i] += d[i] * go;
  if (best < len) {
    g.v = [0, 0, 0];
    return true;
  }
  return false;
}

/** Başlangıçtan itibaren ms kadar ilerletilmiş konum (yeni nesne döner). */
export function simulateGrenade(o, v, ms, solids) {
  const g = { p: [...o], v: [...v] };
  const steps = Math.floor(ms / 1000 / GRENADE.STEP);
  for (let i = 0; i < steps; i++) stepGrenade(g, solids);
  return g;
}
