'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Server } = require('socket.io');
const { Room, W, H, OBST, DURATION, MAX } = require('./sim');

const PORT = process.env.PORT || 3000;
const MIN_PLAYERS = Math.max(1, +process.env.MIN_PLAYERS || 2);
const GRACE_MS = 25000;
const PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  const file = path.normalize(path.join(PUB, url === '/' ? 'index.html' : url));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || '*' } });

// ---- Ranking global (en memoria + archivo opcional) ----
const LB_FILE = path.join(__dirname, 'data', 'leaderboard.json');
let leaderboard = [];
try { leaderboard = JSON.parse(fs.readFileSync(LB_FILE, 'utf8')); } catch (e) { /* primera vez */ }
function addScores(results, players) {
  for (const r of results) leaderboard.push({ name: r.name, char: r.char, score: r.score, date: Date.now() });
  leaderboard.sort((a, b) => b.score - a.score); leaderboard = leaderboard.slice(0, 10);
  try { fs.mkdirSync(path.dirname(LB_FILE), { recursive: true }); fs.writeFileSync(LB_FILE, JSON.stringify(leaderboard)); } catch (e) { /* disco de solo lectura: se ignora */ }
}

const rooms = new Map();
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode() { for (;;) { let c = ''; for (let i = 0; i < 5; i++) c += ALPHA[Math.random() * ALPHA.length | 0]; if (!rooms.has(c)) return c; } }
const cleanName = n => String(n || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 14) || 'Programa';
const cleanChar = c => Math.max(0, Math.min(3, c | 0));
const startPayload = () => ({ W, H, OBST, DURATION });

function bind(sock, room, p) {
  if (p.sid && p.sid !== sock.id) { const old = io.sockets.sockets.get(p.sid); if (old) { old.data = {}; old.disconnect(true); } }
  clearTimeout(p.timer); p.sid = sock.id; p.connected = true; sock.data = { code: room.code, pid: p.id }; sock.join(room.code);
}
const notice = (room, text) => io.to(room.code).emit('notice', text);
const pushLobby = room => io.to(room.code).emit('lobby', room.info());
function reassignHost(room) {
  const h = room.players.get(room.hostId);
  if (!h || !h.connected) { const n = [...room.players.values()].find(p => p.connected); if (n) room.hostId = n.id; }
}
function removePlayer(room, p, msg) {
  clearTimeout(p.timer);
  if (room.phase === 'lobby') room.players.delete(p.id); else { p.gone = true; p.connected = false; if (p.alive && room.phase === 'playing') room.die(p, ''); }
  reassignHost(room); if (msg) notice(room, msg); pushLobby(room);
  if (![...room.players.values()].some(x => x.connected)) rooms.delete(room.code);
}
const ctx = sock => { const r = rooms.get(sock.data && sock.data.code); const p = r && r.players.get(sock.data.pid); return p ? { r, p } : null; };

io.on('connection', sock => {
  sock.data = {};
  const enter = (room, p, cb, resumed) => {
    bind(sock, room, p);
    cb && cb({ ok: true, code: room.code, pid: p.id, token: p.token, info: room.info(), phase: room.phase });
    pushLobby(room);
    if (room.phase === 'playing') sock.emit('start', startPayload());
    if (room.phase === 'ended') sock.emit('ended', { results: room.results, lb: leaderboard });
    if (resumed) notice(room, p.name + ' se reconectó');
  };
  sock.on('create', (d, cb) => {
    if (typeof cb !== 'function') return;
    d = d || {}; const room = new Room(makeCode()); rooms.set(room.code, room);
    const p = room.addPlayer(cleanName(d.name), cleanChar(d.char), crypto.randomBytes(8).toString('hex'));
    enter(room, p, cb);
  });
  sock.on('join', (d, cb) => {
    if (typeof cb !== 'function') return; d = d || {};
    const room = rooms.get(String(d.code || '').toUpperCase().trim());
    if (!room) return cb({ ok: false, error: 'No existe una sala con ese código.' });
    if (room.phase !== 'lobby') return cb({ ok: false, error: 'La partida ya comenzó. Espera a que termine.' });
    if (room.players.size >= MAX) return cb({ ok: false, error: 'La sala está llena (máx. ' + MAX + ').' });
    const p = room.addPlayer(cleanName(d.name), cleanChar(d.char), crypto.randomBytes(8).toString('hex'));
    enter(room, p, cb); notice(room, p.name + ' entró a la sala');
  });
  sock.on('resume', (d, cb) => {
    if (typeof cb !== 'function') return; d = d || {};
    const room = rooms.get(String(d.code || '').toUpperCase()); const p = room && [...room.players.values()].find(x => x.token === d.token);
    if (!p || p.gone) return cb({ ok: false });
    enter(room, p, cb, true);
  });
  sock.on('char', c => { const x = ctx(sock); if (x && x.r.phase === 'lobby') { x.p.char = cleanChar(c); pushLobby(x.r); } });
  sock.on('start', () => {
    const x = ctx(sock); if (!x || x.r.hostId !== x.p.id || x.r.phase !== 'lobby') return;
    if ([...x.r.players.values()].filter(p => p.connected).length < MIN_PLAYERS) return sock.emit('notice', 'Se necesitan al menos ' + MIN_PLAYERS + ' jugadores.');
    x.r.start(); io.to(x.r.code).emit('start', startPayload()); pushLobby(x.r);
  });
  sock.on('input', d => { const x = ctx(sock); if (x && d) x.r.setInput(x.p, d.x, d.y); });
  sock.on('skill', s => { const x = ctx(sock); if (x) x.r.skill(x.p, s); });
  sock.on('restart', () => {
    const x = ctx(sock); if (!x || x.r.hostId !== x.p.id || x.r.phase !== 'ended') return;
    x.r.backToLobby(); pushLobby(x.r); io.to(x.r.code).emit('lobby-reset');
  });
  sock.on('leaderboard', cb => typeof cb === 'function' && cb(leaderboard));
  sock.on('leave', () => { const x = ctx(sock); if (!x) return; sock.leave(x.r.code); sock.data = {}; removePlayer(x.r, x.p, x.p.name + ' salió de la sala'); });
  sock.on('disconnect', () => {
    const x = ctx(sock); if (!x || x.p.sid !== sock.id) return;
    const { r, p } = x; p.connected = false; r.setInput(p, 0, 0); reassignHost(r);
    notice(r, p.name + ' se desconectó (puede volver en 25 s)'); pushLobby(r);
    p.timer = setTimeout(() => removePlayer(r, p, p.name + ' salió de la sala'), GRACE_MS);
  });
});

let last = Date.now(), tk = 0;
setInterval(() => {
  const now = Date.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; tk++;
  for (const r of rooms.values()) {
    if (r.phase !== 'playing') continue;
    const ended = r.step(dt);
    if (tk % 2 === 0 || ended) io.to(r.code).emit('state', r.snapshot());
    if (ended) { addScores(r.results); io.to(r.code).emit('ended', { results: r.results, lb: leaderboard }); pushLobby(r); }
  }
}, 1000 / 30);
setInterval(() => { for (const [c, r] of rooms) if (![...r.players.values()].some(p => p.connected)) rooms.delete(c); }, 60000);

if (require.main === module) server.listen(PORT, '0.0.0.0', () => console.log('CÓDIGO ROJO escuchando en el puerto ' + PORT));
module.exports = { server, io };
