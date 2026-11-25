// Sustituto mínimo de socket.io SOLO para pruebas sin red (no se usa en producción).
const { EventEmitter } = require('events');
class FSock {
  constructor(io) { this.io = io; this.id = 's' + (++io.n); this.rooms = new Set(); this.data = {}; this.h = {}; this.out = []; this.alive = true; }
  on(e, f) { this.h[e] = f; } join(r) { this.rooms.add(r); } leave(r) { this.rooms.delete(r); }
  emit(e, d) { this.out.push([e, d]); } disconnect() { if (this.alive) { this.alive = false; this.h.disconnect && this.h.disconnect(); this.io.sockets.sockets.delete(this.id); } }
  // lado cliente
  send(e, d, cb) { this.h[e] && this.h[e](d, cb); }
  got(e) { return this.out.filter(x => x[0] === e).map(x => x[1]); }
}
class Server {
  constructor() { this.n = 0; this.sockets = { sockets: new Map() }; this.ee = new EventEmitter(); module.exports.last = this; }
  on(e, f) { this.ee.on(e, f); }
  to(r) { return { emit: (e, d) => { for (const s of this.sockets.sockets.values()) if (s.rooms.has(r)) s.emit(e, d); } }; }
  connect() { const s = new FSock(this); this.sockets.sockets.set(s.id, s); this.ee.emit('connection', s); return s; }
}
module.exports = { Server };
