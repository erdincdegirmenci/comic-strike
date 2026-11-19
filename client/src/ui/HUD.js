import { TEAM_INFO, WEAPONS, SLOT_OF_CAT, FLAG_STATE, TEAMS } from '@comic-strike/shared/constants.js';

// Silah resmi yoksa (düşme vb.) gösterilecek metin
const KF_TEXT = { fall: '⤓ DÜŞTÜ' };
const CHAT_LIFE = 10000; // sohbet satırı bu kadar ms sonra solar

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
    this.icons = {}; // silah id -> resim (dataURL), bkz. weaponIcons.js
  }

  setWeaponIcons(icons) {
    this.icons = icons;
  }

  /** Öldürme akışı için silah resmi (resim yoksa yazı) */
  weaponIcon(id, small = false) {
    const src = this.icons[id];
    if (!src) return el('span', 'kf-icon', KF_TEXT[id] ?? WEAPONS[id]?.NAME ?? '✹');
    const img = document.createElement('img');
    img.className = small ? 'kf-gun small' : 'kf-gun';
    img.src = src;
    img.alt = WEAPONS[id]?.NAME ?? id;
    img.title = img.alt;
    return img;
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
    $('chat-log').replaceChildren();
    this.hideEnd();
    this.respawn(null);
    this.setProtection(null);
    this.setFlags(null);
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

  /** def: silah tanımı, count: şarjördeki mermi / bomba sayısı (bıçakta null), reserve: yedek mermi */
  setAmmo(def, count, reloading, reserve = null) {
    this.set('ammo', `${def.id}|${count}|${reloading}|${reserve}`, () => {
      const gun = def.kind === 'gun';
      const dry = gun && count <= 0 && !(reserve > 0);
      $('weapon-name').textContent = def.NAME;
      $('ammo-val').textContent = count === null ? '∞' : count;
      $('ammo-max').textContent = gun ? `/ ${reserve ?? 0}` : def.kind === 'grenade' ? 'ADET' : '';
      $('ammo').classList.toggle('low', gun && count <= Math.max(1, Math.floor(def.MAG_SIZE / 6)));
      $('ammo').classList.toggle('dry', dry);
      $('reload-msg').classList.toggle('hidden', !reloading);
      $('noammo-msg').classList.toggle('hidden', !dry);
    });
  }

  /** k: 0..1 stamina (null: gizle), tired: tamamen bitti, dolması bekleniyor */
  setStamina(k, tired) {
    const v = k === null ? null : Math.round(k * 50) / 50;
    this.set('stam', `${v}|${tired}`, () => {
      $('stamina').classList.toggle('hidden', v === null);
      $('stamina').classList.toggle('tired', !!tired);
      if (v !== null) $('stam-bar').style.width = `${v * 100}%`;
    });
  }

  setPoison(density) {
    const d = Math.round(density * 20) / 20;
    this.set('poison', d, () => {
      $('poison-veil').style.opacity = d;
    });
  }

  /** Alttaki silah yuvaları (1-5) */
  setWeapons(current, owned, nades, visible) {
    this.set('weapons', `${current}|${owned.join()}|${JSON.stringify(nades)}|${visible}`, () => {
      const box = $('weapons');
      box.classList.toggle('hidden', !visible);
      box.replaceChildren();
      for (const id of owned) {
        const w = WEAPONS[id];
        const empty = w.kind === 'grenade' && !(nades[id] > 0);
        const slot = el('div', `slot${id === current ? ' active' : ''}${empty ? ' empty' : ''}`);
        slot.append(el('b', '', String(SLOT_OF_CAT[w.cat])), el('span', '', w.NAME));
        if (w.kind === 'grenade') slot.append(el('i', '', `×${nades[id] ?? 0}`));
        box.append(slot);
      }
    });
  }

  setCharge(k) {
    const v = Math.round(k * 50) / 50;
    this.set('charge', v, () => {
      $('charge').classList.toggle('hidden', v <= 0);
      $('charge-fill').style.width = `${v * 100}%`;
    });
  }

  /** Can %15'in altında: ekran kenarlarında hafif kırmızılık */
  setLowHealth(on) {
    this.set('lowhp', on, () => $('low-hp').classList.toggle('show', on));
  }

  setScope(on) {
    this.set('scope', on, () => $('scope').classList.toggle('hidden', !on));
  }

  setSmoke(density) {
    const d = Math.round(density * 20) / 20;
    this.set('smoke', d, () => {
      $('smoke-veil').style.opacity = d;
    });
  }

  setScores(red, blue, limit, mode = 'tdm') {
    this.set('scores', `${red}|${blue}|${limit}|${mode}`, () => {
      $('score-red').textContent = red;
      $('score-blue').textContent = blue;
      $('score-limit').textContent = mode === 'ctf' ? `${limit} BAYRAK KAZANIR` : `${limit} PUANDA BİTER`;
    });
  }

  /** Herkes Tek skor çubuğu: benim puanım / en iyi rakibin puanı */
  setFfaScores(mine, best, bestName, limit) {
    this.set('scores', `ffa|${mine}|${best}|${bestName}|${limit}`, () => {
      $('score-red').textContent = mine;
      $('score-blue').textContent = best;
      $('score-limit').textContent = `SEN · ${limit} PUANDA BİTER · ${bestName}`;
    });
  }

  setMode(mode) {
    $('topbar').classList.toggle('ffa', mode === 'ffa');
    $('flagbar').classList.toggle('hidden', mode !== 'ctf');
    if (mode !== 'ctf') $('flag-carry').classList.add('hidden');
  }

  /** states: [red, blue] FLAG_STATE (null: gizle), carrying: bayrak bende, ownHome: kendi bayrağımız üste mi */
  setFlags(states, carrying = false, ownHome = true) {
    const key = states ? `${states.join()}|${carrying}|${ownHome}` : 'none';
    this.set('flags', key, () => {
      $('flagbar').classList.toggle('hidden', !states);
      $('flag-carry').classList.toggle('hidden', !states || !carrying);
      if (!states) return;
      const label = ['ÜSTE', 'ALINDI!', 'YERDE'];
      TEAMS.forEach((t, i) => {
        const chip = $(`flag-${t}`);
        chip.textContent = `🚩 ${TEAM_INFO[t].name}: ${label[states[i]]}`;
        chip.classList.toggle('taken', states[i] === FLAG_STATE.CARRIED);
        chip.classList.toggle('dropped', states[i] === FLAG_STATE.DROPPED);
      });
      $('flag-carry-hint').textContent = ownHome ? 'Kendi üssündeki halkaya gir' : 'Sayı için önce kendi bayrağınız üsse dönmeli!';
    });
  }

  flagNotice(text, cls = '') {
    const m = $('flag-msg');
    m.textContent = text;
    m.classList.remove('good', 'bad');
    if (cls) m.classList.add(cls);
    this.restart(m, 'show');
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

  /**
   * Öldüren [silahı] + asist yapan(lar) [silahı] → ölen.
   * assists: [{ p: oyuncu, w: silah }] — 5 sn içinde ölene hasar verip öldüremeyenler
   */
  killfeed(killer, victim, head, weapon, assists = [], teamKill = false) {
    const row = el('div', 'kf-row');
    const self = killer === victim || killer.id === victim.id;
    if (!self) row.append(el('span', `kf-name ${killer.team}`, killer.name));
    row.append(this.weaponIcon(weapon));
    if (head) row.append(el('span', 'kf-hs', '⌖'));
    for (const a of assists) {
      row.append(el('span', 'kf-plus', '+'), el('span', `kf-name kf-assist ${a.p.team}`, a.p.name), this.weaponIcon(a.w, true));
    }
    if (teamKill) row.append(el('span', 'kf-tk', 'TAKIM ATEŞİ'));
    row.append(el('span', 'kf-arrow', '➜'), el('span', `kf-name ${victim.team}`, victim.name));
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
    if (angle === null) return; // yönsüz hasar (düşme)
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

  /** Doğuş koruması geri sayımı (null: gizle) */
  setProtection(seconds) {
    this.set('protect', seconds, () => {
      const p = $('protect');
      p.classList.toggle('hidden', seconds === null);
      if (seconds === null) return;
      $('protect-time').textContent = seconds;
      this.restart(p, 'tick');
    });
  }

  respawn(seconds, killer, killerHp = 0) {
    const r = $('respawn');
    if (seconds === null) {
      this.set('respawn', null, () => r.classList.add('hidden'));
      return;
    }
    this.set('respawn', `${seconds}|${killer}|${killerHp}`, () => {
      r.classList.remove('hidden');
      $('respawn-by').textContent = killer ? `${killer} SENİ VURDU!` : 'ÖLDÜN!';
      $('respawn-hp').textContent = killer ? (killerHp > 0 ? `Canı kaldı: ${killerHp}` : 'O da öldü!') : '';
      $('respawn-time').textContent = seconds > 0 ? `${seconds}` : '...';
    });
  }

  /** rows: [{id, name, team, k, d, rtt}] */
  scoreboard(visible, rows = [], myId = null, scores = null, mode = 'tdm') {
    const sb = $('scoreboard');
    sb.classList.toggle('hidden', !visible);
    if (!visible) return;
    const key = JSON.stringify(rows) + JSON.stringify(scores) + mode;
    this.set('sb', key, () => {
      sb.replaceChildren();
      for (const team of mode === 'ffa' ? ['ffa'] : ['red', 'blue']) {
        const box = el('div', `sb-team ${team}`);
        box.append(el('h3', '', team === 'ffa' ? 'HERKES TEK' : `${TEAM_INFO[team].name} — ${scores ? scores[team] : 0}`));
        const table = el('table');
        const head = el('tr');
        for (const h of ['İSİM', 'K', 'A', 'D', 'PUAN', 'PING']) head.append(el('th', '', h));
        table.append(head);
        for (const r of rows.filter((x) => x.team === team).sort((a, b) => b.score - a.score || b.k - a.k)) {
          const tr = el('tr', r.id === myId ? 'me' : '');
          tr.append(
            el('td', '', (r.bot ? '🤖 ' : '') + r.name),
            el('td', '', r.k),
            el('td', '', r.a),
            el('td', '', r.d),
            el('td', 'sb-score', r.score),
            el('td', '', r.bot ? 'BOT' : r.rtt),
          );
          table.append(tr);
        }
        box.append(table);
        sb.append(box);
      }
      sb.append(el('p', 'sb-note', 'Öldürme +3 · Asist +1 · Ölüm −1 (asist: 5 sn içinde vurduğun rakibi başkası öldürdü)'));
    });
  }

  // ---------------- Sohbet ----------------

  /** Gelen sohbet satırı. m: {n, tm, t, team, dead} */
  chatLine(m) {
    const log = $('chat-log');
    const row = el('div', 'chat-row');
    if (m.team) row.append(el('span', 'chat-tag', '[TAKIM]'));
    if (m.dead) row.append(el('span', 'chat-dead', '*ÖLÜ*'));
    row.append(el('span', `chat-name ${m.tm}`, `${m.n}:`), el('span', 'chat-text', m.t));
    log.append(row);
    while (log.children.length > 8) log.firstChild.remove();
    setTimeout(() => row.classList.add('old'), CHAT_LIFE);
  }

  /** Sohbet yazma kutusu: team=true takım içi */
  chatInput(open, team = false) {
    $('chat').classList.toggle('open', open);
    $('chat-input-row').classList.toggle('hidden', !open);
    $('chat-mode').textContent = team ? 'TAKIM:' : 'HERKES:';
    $('chat-input-row').classList.toggle('team', team);
  }

  end(data, myTeam, names, myId = null) {
    const e = $('end-screen');
    if (data.mode === 'ffa') {
      // Herkes Tek: kazanan oyuncu
      const w = data.players.find((p) => p.id === data.winnerId);
      const me = data.winnerId && data.winnerId === myId;
      const wName = w ? names.get(w.id) ?? w.name : '';
      e.replaceChildren(
        el('h1', `end-title ${w ? 'ffa' : 'draw'}`, !w ? 'BERABERE!' : me ? 'KAZANDIN!' : `${wName} KAZANDI!`),
        el('p', 'end-sub', !w ? 'Kimse öne geçemedi.' : me ? 'HERKESİ ALT ETTİN!' : 'Bir dahaki sefere...'),
        el('p', 'end-score', w ? `${w.score ?? 0} puan · ${w.kills} öldürme` : ''),
      );
    } else {
      const title = data.winner === 'draw' ? 'BERABERE!' : `${TEAM_INFO[data.winner].name} WINS!`;
      const won = data.winner === myTeam;
      e.replaceChildren(
        el('h1', `end-title ${data.winner}`, title),
        el('p', 'end-sub', data.winner === 'draw' ? 'Kimse kazanamadı.' : won ? 'TAKIMIN KAZANDI!' : 'TAKIMIN KAYBETTİ!'),
        el('p', 'end-score', `${data.scores.red} — ${data.scores.blue}`),
      );
    }
    // Maç sonu ödülleri
    const ICON = { score: '⭐', kills: '💀', assists: '🤝', hs: '🎯', caps: '🚩', deaths: '🧲' };
    const UNIT = { score: 'puan', kills: 'öldürme', assists: 'asist', hs: 'kafadan', caps: 'bayrak', deaths: 'ölüm' };
    if (data.awards?.length) {
      const row = el('div', 'awards');
      data.awards.forEach((a, i) => {
        const team = data.players.find((p) => p.id === a.id)?.team ?? 'red';
        const card = el('div', `award ${a.key} ${team}`);
        card.style.animationDelay = `${0.3 + i * 0.25}s`;
        card.append(
          el('span', 'award-icon', ICON[a.key] ?? '★'),
          el('b', 'award-title', a.title),
          el('span', 'award-name', names.get(a.id) ?? a.name),
          el('span', 'award-val', `${a.value} ${UNIT[a.key] ?? ''}`),
          el('small', 'award-desc', a.desc),
        );
        row.append(card);
      });
      e.append(row);
    }
    e.append(el('p', 'end-note', 'Lobiye dönülüyor...'));
    e.classList.remove('hidden');
  }

  hideEnd() {
    $('end-screen').classList.add('hidden');
  }
}
