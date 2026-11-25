'use strict';
// Simulación autoritativa del juego (sin dependencias, probada de forma independiente).
const W = 1600, H = 900, R = 16, DURATION = 120, MAX = 8;
const OBST = [
  { x: 300, y: 200, w: 160, h: 40 }, { x: 1140, y: 200, w: 160, h: 40 },
  { x: 300, y: 660, w: 160, h: 40 }, { x: 1140, y: 660, w: 160, h: 40 },
  { x: 720, y: 380, w: 160, h: 140 }, { x: 100, y: 400, w: 40, h: 100 }, { x: 1460, y: 400, w: 40, h: 100 }
];
const TIPS = {
  av: 'Un antivirus detecta y elimina malware. Mantenlo actualizado.',
  pass: 'Contraseña segura: 12+ caracteres con letras, números y símbolos.',
  phish: '¡PHISHING! Las ofertas "gratis" que piden tus datos son trampas. Verifica el remitente.',
  heal: 'Las copias de seguridad te salvan cuando el malware ataca.',
  shield: 'La verificación en dos pasos protege tu identidad digital.',
  speed: 'Una VPN protege tu conexión en redes WiFi públicas.',
  worm: 'Un gusano se replica solo por la red sin que lo ejecutes.',
  trojan: 'Un troyano se disfraza de programa legítimo. Descarga solo de fuentes oficiales.',
  spy: 'El spyware espía tu actividad y roba datos personales.'
};
const VK = { worm: { r: 14, sp: 105, dmg: 12 }, trojan: { r: 22, sp: 62, dmg: 22 }, spy: { r: 10, sp: 150, dmg: 8 } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

function pushOut(o, r) {
  o.x = clamp(o.x, r, W - r); o.y = clamp(o.y, r, H - r);
  for (const b of OBST) {
    const cx = clamp(o.x, b.x, b.x + b.w), cy = clamp(o.y, b.y, b.y + b.h);
    const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 1e-4) { const d = Math.sqrt(d2); o.x = cx + dx / d * r; o.y = cy + dy / d * r; }
    else {
      const l = o.x - b.x, rr = b.x + b.w - o.x, t = o.y - b.y, bt = b.y + b.h - o.y, m = Math.min(l, rr, t, bt);
      if (m === l) o.x = b.x - r; else if (m === rr) o.x = b.x + b.w + r; else if (m === t) o.y = b.y - r; else o.y = b.y + b.h + r;
    }
  }
}
const inObst = (x, y, pad) => OBST.some(b => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad);

class Room {
  constructor(code) { this.code = code; this.phase = 'lobby'; this.players = new Map(); this.hostId = null; this.pn = 0; this.events = []; this.results = null; this.resetWorld(); }
  resetWorld() { this.viruses = []; this.items = []; this.timeLeft = DURATION; this.elapsed = 0; this.nid = 1; this.vT = 2; this.iT = 0.3; this.secAcc = 0; this.results = null; }
  addPlayer(name, char, token) {
    if (this.players.size >= MAX) return null;
    const p = { id: 'p' + (++this.pn), name, char, token, sid: null, connected: true, timer: null };
    this.players.set(p.id, p); if (!this.hostId) this.hostId = p.id; this.resetPlayer(p); return p;
  }
  resetPlayer(p) {
    Object.assign(p, { x: 800, y: 450, hp: 100, score: 0, alive: true, ix: 0, iy: 0, fx: 1, fy: 0, shieldT: 0, speedT: 0, dashT: 0, dashCd: 0, shieldCd: 0, invT: 0, kills: 0, items: 0, phish: 0, deathAt: 0, gone: false });
  }
  info() { return { code: this.code, phase: this.phase, hostId: this.hostId, max: MAX, players: [...this.players.values()].map(p => ({ id: p.id, name: p.name, char: p.char, connected: p.connected })) }; }
  start() {
    this.phase = 'playing'; this.resetWorld();
    for (const [id, p] of this.players) if (!p.connected) this.players.delete(id);
    let i = 0; const n = this.players.size;
    for (const p of this.players.values()) {
      this.resetPlayer(p); const a = (i++ / n) * Math.PI * 2;
      p.x = 800 + Math.cos(a) * 280; p.y = 450 + Math.sin(a) * 280; pushOut(p, R);
    }
    for (let k = 0; k < 6; k++) this.spawnItem();
  }
  backToLobby() {
    this.phase = 'lobby'; this.resetWorld();
    for (const [id, p] of this.players) { if (!p.connected || p.gone) this.players.delete(id); else this.resetPlayer(p); }
    if (!this.players.has(this.hostId)) this.hostId = [...this.players.keys()][0] || null;
  }
  spawnItem() {
    if (this.items.length >= 14) return;
    const r = Math.random(); const k = r < .38 ? 'av' : r < .55 ? 'pass' : r < .68 ? 'heal' : r < .78 ? 'speed' : r < .86 ? 'shield' : 'phish';
    for (let t = 0; t < 20; t++) {
      const x = rnd(60, W - 60), y = rnd(60, H - 60);
      if (!inObst(x, y, 24)) { this.items.push({ id: this.nid++, k, x, y, l: 16 }); return; }
    }
  }
  spawnVirus(alive) {
    const k = Math.random() < .5 ? 'worm' : Math.random() < .55 ? 'spy' : 'trojan';
    for (let t = 0; t < 12; t++) {
      const e = Math.random() * 4 | 0;
      const x = e === 0 ? 20 : e === 1 ? W - 20 : rnd(20, W - 20), y = e === 2 ? 20 : e === 3 ? H - 20 : rnd(20, H - 20);
      if (alive.every(p => Math.hypot(p.x - x, p.y - y) > 300)) { this.viruses.push({ id: this.nid++, k, x, y, ph: Math.random() * 6 }); return; }
    }
  }
  die(p, why) { p.alive = false; p.hp = 0; p.deathAt = this.elapsed; this.events.push({ t: 'boom', x: p.x, y: p.y, big: 1 }, { t: 'tip', pid: p.id, text: TIPS[why] || '' }); }
  step(dt) {
    if (this.phase !== 'playing') return false;
    this.elapsed += dt; this.timeLeft -= dt;
    const alive = [...this.players.values()].filter(p => p.alive);
    for (const p of alive) {
      p.dashCd = Math.max(0, p.dashCd - dt); p.shieldCd = Math.max(0, p.shieldCd - dt);
      p.shieldT = Math.max(0, p.shieldT - dt); p.speedT = Math.max(0, p.speedT - dt); p.dashT = Math.max(0, p.dashT - dt); p.invT = Math.max(0, p.invT - dt);
      let sp = 230 * (p.speedT > 0 ? 1.5 : 1), dx = p.ix, dy = p.iy;
      if (p.dashT > 0) { sp = 640; dx = p.fx; dy = p.fy; }
      p.x += dx * sp * dt; p.y += dy * sp * dt; pushOut(p, R);
    }
    this.vT -= dt; this.iT -= dt;
    if (this.vT <= 0 && alive.length) {
      const cap = 5 + this.players.size * 3 + Math.floor(this.elapsed / 20);
      if (this.viruses.length < cap) this.spawnVirus(alive);
      this.vT = Math.max(.45, 2.2 - this.elapsed / 70) / Math.max(1, this.players.size / 3);
    }
    if (this.iT <= 0) { this.spawnItem(); this.iT = 1.4; }
    const scale = 1 + this.elapsed / 240;
    for (const v of this.viruses) {
      const d = VK[v.k]; let tgt = null, bd = 1e9;
      for (const p of alive) { const q = Math.hypot(p.x - v.x, p.y - v.y); if (q < bd) { bd = q; tgt = p; } }
      if (!tgt) continue;
      v.ph += dt * 5; let ax = (tgt.x - v.x) / (bd || 1), ay = (tgt.y - v.y) / (bd || 1);
      if (v.k === 'spy') { const w = Math.sin(v.ph) * .6; const nx = ax - ay * w, ny = ay + ax * w; ax = nx; ay = ny; }
      v.x += ax * d.sp * scale * dt; v.y += ay * d.sp * scale * dt; pushOut(v, d.r);
    }
    for (const p of alive) {
      for (let i = this.viruses.length - 1; i >= 0; i--) {
        const v = this.viruses[i], d = VK[v.k];
        if (Math.hypot(p.x - v.x, p.y - v.y) > R + d.r) continue;
        if (p.dashT > 0 || p.shieldT > 0) { this.viruses.splice(i, 1); p.score += 15; p.kills++; this.events.push({ t: 'boom', x: v.x, y: v.y }); }
        else if (p.invT <= 0) {
          p.hp -= d.dmg; p.invT = 1; this.events.push({ t: 'hit', x: p.x, y: p.y, pid: p.id });
          if (p.hp <= 0) { this.die(p, v.k); break; }
        }
      }
      if (!p.alive) continue;
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i]; if (Math.hypot(p.x - it.x, p.y - it.y) > R + 12) continue;
        this.items.splice(i, 1); this.events.push({ t: 'pick', x: it.x, y: it.y, k: it.k, pid: p.id });
        if (it.k === 'av') { p.score += 10; p.items++; } else if (it.k === 'pass') { p.score += 25; p.items++; }
        else if (it.k === 'heal') p.hp = Math.min(100, p.hp + 30); else if (it.k === 'speed') p.speedT = 6; else if (it.k === 'shield') p.shieldT = 4;
        else if (it.k === 'phish') {
          p.phish++; p.score = Math.max(0, p.score - 20); p.hp -= 15;
          if (p.hp <= 0) { this.die(p, 'phish'); break; }
        }
        this.events.push({ t: 'tip', pid: p.id, text: TIPS[it.k] });
      }
    }
    this.items = this.items.filter(it => (it.l -= dt) > 0);
    this.secAcc += dt; if (this.secAcc >= 1) { this.secAcc -= 1; for (const p of alive) if (p.alive) p.score += 1; }
    const left = [...this.players.values()].some(p => p.alive);
    if (this.timeLeft <= 0 || !left) { this.finish(); return true; }
    return false;
  }
  finish() {
    this.phase = 'ended'; this.timeLeft = Math.max(0, this.timeLeft);
    for (const p of this.players.values()) if (p.alive) { p.score += 100; p.deathAt = this.elapsed; }
    const list = [...this.players.values()].sort((a, b) => b.score - a.score || b.deathAt - a.deathAt);
    this.results = list.map((p, i) => ({ id: p.id, name: p.name, char: p.char, score: p.score, kills: p.kills, items: p.items, phish: p.phish, survived: Math.round(p.deathAt), alive: p.alive, rank: i + 1 }));
  }
  snapshot() {
    const e = this.events; this.events = []; const r = Math.round;
    return {
      t: Math.max(0, Math.ceil(this.timeLeft)),
      p: [...this.players.values()].map(p => ({ i: p.id, x: r(p.x), y: r(p.y), h: Math.max(0, r(p.hp)), s: p.score, a: p.alive ? 1 : 0, sh: p.shieldT > 0 ? 1 : 0, sp: p.speedT > 0 ? 1 : 0, d: p.dashT > 0 ? 1 : 0, dc: +p.dashCd.toFixed(1), sc: +p.shieldCd.toFixed(1), c: p.connected ? 1 : 0 })),
      v: this.viruses.map(v => ({ i: v.id, k: v.k, x: r(v.x), y: r(v.y) })),
      it: this.items.map(i => ({ i: i.id, k: i.k, x: r(i.x), y: r(i.y), l: +i.l.toFixed(1) })),
      e
    };
  }
  setInput(p, x, y) {
    x = clamp(+x || 0, -1, 1); y = clamp(+y || 0, -1, 1); const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    p.ix = x; p.iy = y; if (m > .1) { p.fx = x / m; p.fy = y / m; }
  }
  skill(p, s) {
    if (this.phase !== 'playing' || !p.alive) return;
    if (s === 'dash' && p.dashCd <= 0) { p.dashT = .25; p.dashCd = 4; this.events.push({ t: 'dash', x: p.x, y: p.y }); }
    else if (s === 'shield' && p.shieldCd <= 0) { p.shieldT = 2.5; p.shieldCd = 10; }
  }
}
module.exports = { Room, W, H, OBST, DURATION, MAX, TIPS };
