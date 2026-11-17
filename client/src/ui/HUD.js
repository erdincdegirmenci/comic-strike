import { TEAM_INFO, WEAPON } from '@comic-strike/shared/constants.js';

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Oyun içi arayüz (DOM). Değerler değişmedikçe DOM'a dokunmaz. */
export class HUD {
  constructor() {
    this.root = $('hud');
    this.cache = {};
  }

  set(key, value, apply) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    apply(value);
  }

  show() {
    this.root.classList.remove('hidden');
    this.cache = {};
    $('killfeed').replaceChildren();
    this.hideEnd();
    this.respawn(null);
    this.center('');
  }

  hide() {
    this.root.classList.add('hidden');
    this.scoreboard(false);
  }

  setHealth(hp) {
    this.set('hp', hp, () => {
      $('hp-val').textContent = hp;
      $('hp-bar').style.width = `${hp}%`;
      $('health').classList.toggle('low', hp <= 30);
    });
  }

  setAmmo(ammo, reloading) {
    this.set('ammo', `${ammo}|${reloading}`, () => {
      $('ammo-val').textContent = ammo;
      $('ammo-max').textContent = `/ ${WEAPON.MAG_SIZE}`;
      $('ammo').classList.toggle('low', ammo <= 5);
      $('reload-msg').classList.toggle('hidden', !reloading);
    });
  }

  setScores(red, blue, limit) {
    this.set('scores', `${red}|${blue}|${limit}`, () => {
      $('score-red').textContent = red;
      $('score-blue').textContent = blue;
      $('score-limit').textContent = `FIRST TO ${limit}`;
    });
  }

  setTime(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    this.set('time', s, () => {
      $('timer').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      $('timer').classList.toggle('low', s <= 30);
    });
  }

  setPing(ms) {
    this.set('ping', ms, () => {
      $('ping').textContent = `${ms} ms`;
    });
  }

  setCrosshair(gap) {
    const g = Math.round(gap);
    this.set('ch', g, () => $('crosshair').style.setProperty('--gap', `${g}px`));
  }

  setCrosshairVisible(v) {
    this.set('chv', v, () => $('crosshair').classList.toggle('hidden', !v));
  }

  killfeed(killer, victim, head) {
    const row = el('div', 'kf-row');
    row.append(
      el('span', `kf-name ${killer.team}`, killer.name),
      el('span', 'kf-icon', head ? '✹ ⌖' : '✹'),
      el('span', `kf-name ${victim.team}`, victim.name),
    );
    const feed = $('killfeed');
    feed.prepend(row);
    while (feed.children.length > 5) feed.lastChild.remove();
    setTimeout(() => row.classList.add('fade'), 4500);
    setTimeout(() => row.remove(), 5200);
  }

  restart(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth; // animasyonu yeniden başlat
    node.classList.add(cls);
  }

  hitmarker(kill) {
    const h = $('hitmarker');
    h.classList.toggle('kill', kill);
    this.restart(h, 'show');
  }

  damage(angle) {
    this.restart($('damage-flash'), 'show');
    const d = $('damage-dir');
    d.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    this.restart(d, 'show');
  }

  pop(text) {
    const p = $('comic-pop');
    p.textContent = text;
    p.style.setProperty('--rot', `${(Math.random() - 0.5) * 16}deg`);
    this.restart(p, 'show');
  }

  center(text, cls = '') {
    this.set('center', text + cls, () => {
      const c = $('center-msg');
      c.textContent = text;
      c.className = cls;
    });
  }

  respawn(seconds, killer) {
    const r = $('respawn');
    if (seconds === null) {
      this.set('respawn', null, () => r.classList.add('hidden'));
      return;
    }
    this.set('respawn', `${seconds}|${killer}`, () => {
      r.classList.remove('hidden');
      $('respawn-by').textContent = killer ? `${killer} SENİ VURDU!` : 'ÖLDÜN!';
      $('respawn-time').textContent = seconds > 0 ? `${seconds}` : '...';
    });
  }

  /** rows: [{id, name, team, k, d, rtt}] */
  scoreboard(visible, rows = [], myId = null, scores = null) {
    const sb = $('scoreboard');
    sb.classList.toggle('hidden', !visible);
    if (!visible) return;
    const key = JSON.stringify(rows) + JSON.stringify(scores);
    this.set('sb', key, () => {
      sb.replaceChildren();
      for (const team of ['red', 'blue']) {
        const box = el('div', `sb-team ${team}`);
        box.append(el('h3', '', `${TEAM_INFO[team].name} — ${scores ? scores[team] : 0}`));
        const table = el('table');
        const head = el('tr');
        for (const h of ['NAME', 'K', 'D', 'PING']) head.append(el('th', '', h));
        table.append(head);
        for (const r of rows.filter((x) => x.team === team).sort((a, b) => b.k - a.k || a.d - b.d)) {
          const tr = el('tr', r.id === myId ? 'me' : '');
          tr.append(el('td', '', r.name), el('td', '', r.k), el('td', '', r.d), el('td', '', r.rtt));
          table.append(tr);
        }
        box.append(table);
        sb.append(box);
      }
    });
  }

  end(data, myTeam, names) {
    const e = $('end-screen');
    const title = data.winner === 'draw' ? 'BERABERE!' : `${TEAM_INFO[data.winner].name} WINS!`;
    const won = data.winner === myTeam;
    e.replaceChildren(
      el('h1', `end-title ${data.winner}`, title),
      el('p', 'end-sub', data.winner === 'draw' ? 'Kimse kazanamadı.' : won ? 'TAKIMIN KAZANDI!' : 'TAKIMIN KAYBETTİ!'),
      el('p', 'end-score', `${data.scores.red} — ${data.scores.blue}`),
    );
    const best = [...data.players].sort((a, b) => b.kills - a.kills)[0];
    if (best && best.kills > 0) e.append(el('p', 'end-mvp', `MVP: ${names.get(best.id) ?? best.name} (${best.kills} kill)`));
    e.append(el('p', 'end-note', 'Lobiye dönülüyor...'));
    e.classList.remove('hidden');
  }

  hideEnd() {
    $('end-screen').classList.add('hidden');
  }
}
