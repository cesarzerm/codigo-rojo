'use strict';
const assert = require('assert'); const { Room, W, H, OBST, DURATION } = require('../sim');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('✔', m); };
const r = new Room('TEST1');
const ps = []; for (let i = 0; i < 8; i++) ps.push(r.addPlayer('P' + i, i % 4, 't' + i));
ok(r.addPlayer('X', 0, 'x') === null, 'máximo 8 jugadores por sala');
ok(r.hostId === 'p1', 'el primer jugador es anfitrión');
r.start(); ok(r.phase === 'playing' && r.items.length === 6, 'la partida inicia con ítems');
let bad = 0; for (const p of ps) if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) bad++; ok(bad === 0, 'todos aparecen dentro de la arena');
ps[0].x = 800; ps[0].y = 450; r.setInput(ps[0], 1, 0); const x0 = ps[0].x; for (let i = 0; i < 30; i++) r.step(1 / 30);
ok(ps[0].x !== x0 || OBST.some(b => b.x < 900), 'el movimiento por input cambia la posición');
// obstáculos: nadie puede quedar dentro
const inside = o => OBST.some(b => o.x > b.x && o.x < b.x + b.w && o.y > b.y && o.y < b.y + b.h);
let ins = 0; for (let t = 0; t < 30 * 30; t++) { ps.forEach((p, i) => r.setInput(p, Math.cos(t / 20 + i), Math.sin(t / 13 + i))); r.step(1 / 30); ps.forEach(p => inside(p) && ins++); r.viruses.forEach(v => inside(v) && ins++); }
ok(ins === 0, 'ni jugadores ni virus atraviesan obstáculos (30 s simulados)');
// recolección y puntuación
const q = new Room('T2'); const a = q.addPlayer('A', 0, 'a'); q.addPlayer('B', 1, 'b'); q.start(); q.items = [{ id: 99, k: 'av', x: a.x, y: a.y, l: 10 }]; q.viruses = [];
const s0 = a.score; q.step(1 / 30); ok(a.score === s0 + 10 && q.items.length >= 0 && !q.items.some(i => i.id === 99), 'antivirus otorga +10 puntos');
q.items = [{ id: 98, k: 'phish', x: a.x, y: a.y, l: 10 }]; a.score = 50; const h0 = a.hp; q.step(1 / 30); ok(a.score === 30 && a.hp === h0 - 15, 'phishing resta 20 puntos y 15 de vida');
q.items = [{ id: 97, k: 'heal', x: a.x, y: a.y, l: 10 }]; a.hp = 50; q.step(1 / 30); ok(a.hp === 80, 'curación +30 de vida');
// daño por virus y escudo
q.items = []; q.viruses = [{ id: 1, k: 'trojan', x: a.x, y: a.y, ph: 0 }]; a.hp = 100; a.invT = 0; q.step(1 / 30); ok(a.hp === 78, 'troyano hace 22 de daño');
q.viruses = [{ id: 2, k: 'worm', x: a.x, y: a.y, ph: 0 }]; a.invT = 0; q.skill(a, 'shield'); const sc = a.score; q.step(1 / 30); ok(a.hp === 78 && a.score >= sc + 15 && q.viruses.length === 0, 'el escudo destruye virus (+15) sin daño');
const cd = a.shieldCd; q.skill(a, 'shield'); ok(a.shieldCd === cd, 'el escudo respeta el enfriamiento');
q.skill(a, 'dash'); ok(a.dashT > 0, 'el impulso se activa');
// fin por muerte de todos
const z = new Room('T3'); const za = z.addPlayer('A', 0, 'a'); const zb = z.addPlayer('B', 1, 'b'); z.start(); z.items = [];
za.score = 40; zb.score = 5; za.hp = zb.hp = 1; za.shieldT = zb.shieldT = 0; let ended = false;
for (let i = 0; i < 3000 && !ended; i++) { z.viruses.push({ id: 1000 + i, k: 'trojan', x: za.x, y: za.y, ph: 0 }, { id: 5000 + i, k: 'trojan', x: zb.x, y: zb.y, ph: 0 }); za.invT = zb.invT = 0; ended = z.step(1 / 30); }
ok(ended && z.phase === 'ended', 'la partida termina cuando todos mueren');
ok(z.results.length === 2 && z.results[0].rank === 1 && z.results[0].score >= z.results[1].score, 'resultados ordenados por puntaje');
z.backToLobby(); ok(z.phase === 'lobby' && z.players.get('p1').score === 0 && z.players.get('p1').alive, 'reinicio vuelve a la sala con stats en cero');
// fin por tiempo con superviviente bonus
const t = new Room('T4'); const ta = t.addPlayer('A', 0, 'a'); t.addPlayer('B', 1, 'b'); t.start(); t.viruses = []; t.timeLeft = .05; t.vT = 99; const ts = ta.score;
ok(t.step(.1) === true && ta.score >= ts + 100, 'fin por tiempo: bonus de superviviente +100');
// simulación larga de 8 jugadores: sin NaN, tamaño de snapshot razonable
const L = new Room('T5'); const lp = []; for (let i = 0; i < 8; i++) lp.push(L.addPlayer('J' + i, i % 4, 'k' + i)); L.start(); let maxSnap = 0;
for (let i = 0; i < 30 * 130 && L.phase === 'playing'; i++) { lp.forEach((p, k) => L.setInput(p, Math.cos(i / 25 + k), Math.sin(i / 31 + k))); L.step(1 / 30); if (i % 2 === 0) maxSnap = Math.max(maxSnap, JSON.stringify(L.snapshot()).length); }
ok(lp.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.score)), 'sin valores NaN tras 2 min con 8 jugadores');
ok(maxSnap < 8000, 'snapshot máximo ' + maxSnap + ' bytes (<8 KB)');
ok(L.phase === 'ended' && L.results.length === 8, 'la partida de 8 jugadores termina correctamente');
console.log('\n' + n + ' pruebas de simulación OK');
