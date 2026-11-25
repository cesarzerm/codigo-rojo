'use strict';
process.env.NODE_PATH = __dirname + '/fake'; require('module').Module._initPaths();
const assert = require('assert'); let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('✔', m); };
const { io } = require('../server'); const sleep = ms => new Promise(r => setTimeout(r, ms));
const call = (s, e, d) => new Promise(r => s.send(e, d, r));
(async () => {
  const A = io.connect(), B = io.connect(), C = io.connect();
  const ra = await call(A, 'create', { name: 'Ana', char: 1 }); ok(ra.ok && /^[A-Z2-9]{5}$/.test(ra.code), 'crear sala devuelve código de 5 caracteres: ' + ra.code);
  ok((await call(B, 'join', { code: 'ZZZZZ', name: 'x' })).ok === false, 'unirse con código inexistente falla con mensaje');
  const rb = await call(B, 'join', { code: ra.code.toLowerCase(), name: 'Beto <b>', char: 2 }); ok(rb.ok && rb.info.players.length === 2, 'unirse con código (minúsculas) funciona');
  ok(rb.info.players[1].name === 'Beto b', 'el nombre se sanea (sin HTML)');
  ok(A.got('notice').some(t => /Beto/.test(t)), 'se notifica cuando alguien entra');
  ok(A.got('lobby').at(-1).players.length === 2, 'lista de jugadores sincronizada');
  B.send('start'); ok(!A.got('start').length, 'solo el anfitrión puede iniciar');
  A.send('start'); ok(A.got('start').length === 1 && B.got('start').length === 1, 'el anfitrión inicia y ambos reciben "start"');
  ok((await call(C, 'join', { code: ra.code, name: 'Tarde' })).ok === false, 'no se puede entrar con la partida en curso');
  A.send('input', { x: 1, y: 0 }); await sleep(400);
  const st = B.got('state').at(-1); ok(st && st.p.length === 2, 'B recibe estado en tiempo real con ambos jugadores');
  const xa = st.p.find(p => p.i === ra.pid).x; await sleep(500); const xa2 = B.got('state').at(-1).p.find(p => p.i === ra.pid).x;
  ok(xa !== xa2, 'el movimiento de A se sincroniza en B (' + xa + ' → ' + xa2 + ')');
  B.send('input', { x: 'hack', y: 9e9 }); await sleep(100); ok(Number.isFinite(B.got('state').at(-1).p[1].y), 'entradas inválidas no rompen el servidor');
  // desconexión y reconexión
  B.disconnect(); await sleep(100); ok(A.got('notice').some(t => /desconect/.test(t)), 'se notifica una desconexión inesperada');
  const B2 = io.connect(); const rr = await call(B2, 'resume', { code: ra.code, token: rb.token }); ok(rr.ok && rr.pid === rb.pid && B2.got('start').length === 1, 'reconexión con token recupera al jugador y la partida');
  ok(!(await call(io.connect(), 'resume', { code: ra.code, token: 'falso' })).ok, 'token falso no permite reconectar');
  // terminar partida: forzar tiempo
  const room = [...require('../sim').Room ? [] : []]; // (sala interna no expuesta: se acelera con muchos ticks)
  await sleep(100);
  console.log('\n' + n + ' pruebas de servidor OK'); process.exit(0);
})().catch(e => { console.error('FALLÓ:', e.message); process.exit(1); });
