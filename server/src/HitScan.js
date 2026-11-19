import { HITBOX } from '@comic-strike/shared/constants.js';

/** Işın - kutu kesişimi. Mesafeyi döner, kesişme yoksa -1. dir normalize olmalı. */
export function rayAABB(o, d, min, max, maxT) {
  let tmin = 0;
  let tmax = maxT;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < min[i] || o[i] > max[i]) return -1;
    } else {
      const inv = 1 / d[i];
      let t1 = (min[i] - o[i]) * inv;
      let t2 = (max[i] - o[i]) * inv;
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

/** Işın - küre kesişimi. */
export function raySphere(o, d, c, r, maxT) {
  const ox = o[0] - c[0];
  const oy = o[1] - c[1];
  const oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  if (t < 0 || t > maxT) return -1;
  return t;
}

/**
 * Bir atışın neye çarptığını bulur.
 * targets: [{ player, pos:[x,y,z] }] (pozisyonlar geri sarılmış olmalı)
 */
export function castShot(origin, dir, solids, targets, range) {
  let best = range;
  let player = null;
  let head = false;
  let leg = false;

  for (const b of solids) {
    const t = rayAABB(origin, dir, b.min, b.max, best);
    if (t >= 0 && t < best) best = t;
  }

  for (const { player: p, pos, crouch } of targets) {
    const headY = crouch ? HITBOX.CROUCH_HEAD_Y : HITBOX.HEAD_Y;
    const bodyTop = crouch ? HITBOX.CROUCH_BODY_TOP : HITBOX.BODY_TOP;
    const hc = [pos[0], pos[1] + headY, pos[2]];
    const th = raySphere(origin, dir, hc, HITBOX.HEAD_R, best);
    if (th >= 0 && th < best) {
      best = th;
      player = p;
      head = true;
      leg = false;
    }
    const bmin = [pos[0] - HITBOX.BODY_HALF, pos[1], pos[2] - HITBOX.BODY_HALF];
    const bmax = [pos[0] + HITBOX.BODY_HALF, pos[1] + bodyTop, pos[2] + HITBOX.BODY_HALF];
    const tb = rayAABB(origin, dir, bmin, bmax, best);
    if (tb >= 0 && tb < best) {
      best = tb;
      player = p;
      head = false;
      // Gövde kutusunun alt kısmı bacak sayılır (daha az hasar)
      const hy = origin[1] + dir[1] * tb - pos[1];
      leg = hy < (crouch ? HITBOX.CROUCH_LEG_TOP : HITBOX.LEG_TOP);
    }
  }

  const point = [origin[0] + dir[0] * best, origin[1] + dir[1] * best, origin[2] + dir[2] * best];
  return { player, head, leg, point, distance: best };
}
