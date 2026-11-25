'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const socket = io({ transports: ['websocket', 'polling'] });
const CH = [
  { n: 'FIREWALL', c: '#00d4ff', d: 'Hexágono defensivo' }, { n: 'CIFRADO', c: '#a855f7', d: 'Triángulo veloz' },
  { n: 'ANTIVIRUS', c: '#22ff88', d: 'Núcleo sanador' }, { n: 'SENTINEL', c: '#ffd60a', d: 'Diamante vigía' }
];
const KIND = { av: ['#22ff88', '+'], pass: ['#00d4ff', '🔑'], heal: ['#ff6bd5', '♥'], speed: ['#ffd60a', '»'], shield: ['#a855f7', '◈'], phish: ['#ffd60a', '¡$!'] };
const VCOL = { worm: '#ff2d55', trojan: '#ff7a1a', spy: '#d946ef' };
const touch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
if (touch) document.body.classList.add('touch');
const S = { name: '', char: 0, pending: null, pid: null, code: null, host: null, info: null, world: { W: 1600, H: 900, OBST: [] }, playing: false, results: null, lb: [] };
let tipI = 0;

// ---------- Pantallas ----------
function show(id) {
  $$('.screen').forEach(s => s.classList.remove('on')); $('#s-' + id).classList.add('on');
  document.body.classList.toggle('ingame', id === 'game');
  S.playing = id === 'game';
  if (id === 'stats') loadQuiz();
}
$$('[data-go]').forEach(b => b.onclick = () => show(b.dataset.go));
function toast(t, color) { const e = $('#toast'); e.textContent = t; e.style.setProperty('--c', color || '#00d4ff'); e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 3200); }
const saveSess = () => { try { localStorage.setItem('cr_sess', JSON.stringify({ code: S.code, token: S.token })); } catch (e) {} };
const clearSess = () => { try { localStorage.removeItem('cr_sess'); } catch (e) {} };
function beep(f, d, type) {
  try { const a = beep.a || (beep.a = new (window.AudioContext || window.webkitAudioContext)()), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.value = f; g.gain.value = .04; o.connect(g); g.connect(a.destination); o.start(); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + d); o.stop(a.currentTime + d); } catch (e) {}
}

// ---------- Personajes ----------
function drawShape(g, ch, x, y, r, t) {
  const c = CH[ch].c; g.save(); g.translate(x, y); g.shadowColor = c; g.shadowBlur = 18; g.strokeStyle = c; g.fillStyle = c + '33'; g.lineWidth = 3;
  g.rotate(ch === 3 ? Math.PI / 4 : t * (ch === 1 ? 2 : .8)); g.beginPath();
  if (ch === 0) for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  else if (ch === 1) for (let i = 0; i < 3; i++) { const a = i * 2.094 - 1.57; g.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15); }
  else if (ch === 2) g.arc(0, 0, r, 0, 7);
  else g.rect(-r * .8, -r * .8, r * 1.6, r * 1.6);
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r * (ch === 2 ? .35 + .1 * Math.sin(t * 5) : .22), 0, 7); g.fill(); g.restore();
}
function buildChars() {
  const box = $('#char-list'); box.innerHTML = '';
  CH.forEach((c, i) => {
    const d = document.createElement('div'); d.className = 'ch' + (i === S.char ? ' sel' : ''); d.style.setProperty('--c', c.c);
    d.innerHTML = '<canvas width="128" height="128"></canvas><b>' + c.n + '</b><small>' + c.d + '</small>';
    d.onclick = () => { S.char = i; $$('.ch').forEach((e, k) => e.classList.toggle('sel', k === i)); beep(500 + i * 120, .08); };
    box.appendChild(d);
  });
}
setInterval(() => { if (!$('#s-chars').classList.contains('on')) return; const t = performance.now() / 1000;
  $$('.ch canvas').forEach((cv, i) => { const g = cv.getContext('2d'); g.clearRect(0, 0, 128, 128); drawShape(g, i, 64, 64, 30, t); }); }, 40);

// ---------- Flujo crear / unirse ----------
const nm = v => v.trim().slice(0, 14) || 'Programa';
$('#b-create').onclick = () => { S.name = nm($('#n-create').value); S.pending = 'create'; buildChars(); show('chars'); };
$('#b-join').onclick = () => {
  const c = $('#c-join').value.trim().toUpperCase(); if (c.length < 4) return toast('Escribe el código de la sala', '#ff2d55');
  S.name = nm($('#n-join').value); S.pending = 'join'; S.joinCode = c; buildChars(); show('chars');
};
$('#c-join').oninput = e => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
$('#b-char2').onclick = () => { S.pending = 'change'; buildChars(); show('chars'); };
$('#b-chars-back').onclick = () => show(S.pending === 'change' ? 'lobby' : S.pending === 'join' ? 'join' : 'create');
$('#b-confirm').onclick = () => {
  if (S.pending === 'change') { socket.emit('char', S.char); return show('lobby'); }
  const cb = r => {
    if (!r.ok) { toast(r.error || 'Error', '#ff2d55'); return show(S.pending === 'join' ? 'join' : 'create'); }
    S.pid = r.pid; S.code = r.code; S.token = r.token; saveSess(); applyLobby(r.info); show('lobby');
  };
  if (S.pending === 'create') socket.emit('create', { name: S.name, char: S.char }, cb);
  else socket.emit('join', { code: S.joinCode, name: S.name, char: S.char }, cb);
};

// ---------- Sala de espera ----------
const TIPS = ['Nunca compartas tus contraseñas, ni con amigos.', 'Desconfía de mensajes urgentes que piden tus datos: es phishing.', 'Activa la verificación en dos pasos en tus cuentas.', 'Tu identidad digital incluye todo lo que publicas: cuídala.', 'Actualiza tu sistema: cada parche cierra una puerta al malware.', 'Revisa el candado HTTPS, pero recuerda que no garantiza que el sitio sea honesto.', 'Usa un gestor de contraseñas y una distinta para cada cuenta.'];
function applyLobby(info) {
  S.info = info; S.host = info.hostId; S.code = info.code;
  $('#l-code').textContent = info.code; $('#l-count').textContent = info.players.length + '/' + info.max;
  $('#l-list').innerHTML = info.players.map(p => '<li class="' + (p.connected ? '' : 'off') + '"><span class="dot" style="background:' + CH[p.char].c + ';box-shadow:0 0 8px ' + CH[p.char].c + '"></span>' + esc(p.name) + (p.id === S.pid ? ' (tú)' : '') + '<span class="tag">' + (p.id === info.hostId ? '👑 ANFITRIÓN' : p.connected ? '' : 'reconectando…') + '</span></li>').join('');
  const host = info.hostId === S.pid, n = info.players.filter(p => p.connected).length;
  $('#b-start').style.display = host ? '' : 'none'; $('#b-start').disabled = n < 2;
  $('#l-wait').textContent = host ? (n < 2 ? 'Esperando al menos 2 jugadores…' : '¡Todo listo! Pulsa iniciar.') : 'Esperando a que el anfitrión inicie…';
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
setInterval(() => { $('#l-tip').textContent = '💡 ' + TIPS[tipI++ % TIPS.length]; }, 5000); $('#l-tip').textContent = '💡 ' + TIPS[0];
$('#b-start').onclick = () => socket.emit('start');
$('#b-leave').onclick = leave;
function leave() { socket.emit('leave'); clearSess(); S.code = null; S.token = null; show('menu'); }
$('#b-exit').onclick = leave;
$('#b-copy').onclick = async () => {
  const url = location.origin + '/?sala=' + S.code;
  try { if (navigator.share) await navigator.share({ title: 'CÓDIGO ROJO', text: 'Únete a mi sala: ' + S.code, url }); else { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } } catch (e) { toast('Código: ' + S.code); }
};

// ---------- Eventos de red ----------
socket.on('lobby', info => { if (info.code !== S.code) return; applyLobby(info); });
socket.on('notice', t => toast(t));
socket.on('lobby-reset', () => { show('lobby'); });
socket.on('start', w => { S.world = w; ents.clear(); parts.length = 0; snap = null; S.lastTime = w.DURATION; show('game'); sendInput(true); beep(300, .3, 'sawtooth'); });
socket.on('state', onState);
socket.on('ended', d => { S.results = d.results; S.lb = d.lb; showEnd(); });
socket.on('connect', () => {
  let s = null; try { s = JSON.parse(localStorage.getItem('cr_sess')); } catch (e) {}
  if (s && s.code && s.token) socket.emit('resume', s, r => {
    if (!r || !r.ok) { clearSess(); return; }
    S.pid = r.pid; S.code = r.code; S.token = r.token; applyLobby(r.info);
    if (r.phase === 'lobby') show('lobby');
  });
});
socket.on('disconnect', () => toast('Conexión perdida… reconectando', '#ff2d55'));
(() => { const c = new URLSearchParams(location.search).get('sala'); if (c) { $('#c-join').value = c.toUpperCase().slice(0, 5); setTimeout(() => show('join'), 0); } })();

// ---------- Ranking ----------
function showRank(back) {
  socket.emit('leaderboard', lb => {
    $('#t-rank').innerHTML = lb.length ? lb.map((r, i) => '<li><b>' + (i + 1) + '</b><span class="dot" style="background:' + CH[r.char || 0].c + '"></span><span>' + esc(r.name) + '</span><span>' + r.score + '</span></li>').join('') : '<li>Aún no hay puntuaciones. ¡Sé el primero!</li>';
    $('#b-rank-back').onclick = () => show(back); show('rank');
  });
}
$('#b-rank').onclick = () => showRank('menu'); $('#b-rank2').onclick = () => showRank('stats');

// ---------- Fin de partida ----------
function showEnd() {
  const me = S.results.find(r => r.id === S.pid) || S.results[0], win = me.rank === 1;
  const t = $('#r-title'); t.textContent = win ? 'VICTORIA' : 'DERROTA'; t.style.color = win ? '#22ff88' : '#ff2d55'; t.style.textShadow = '0 0 30px ' + (win ? '#22ff88' : '#ff2d55');
  $('#r-sub').textContent = win ? '¡Eres el mejor programa de seguridad de la red!' : 'Puesto #' + me.rank + '. El virus ganó esta vez… ¡revancha!';
  $('#r-score').textContent = me.score; beep(win ? 880 : 150, .5, win ? 'triangle' : 'sawtooth');
  $('#t-stats').innerHTML = '<tr><th>#</th><th>JUGADOR</th><th>PTS</th><th>VIRUS</th><th>ITEMS</th><th>PHISH</th><th>VIVIÓ</th></tr>' +
    S.results.map(r => '<tr style="color:' + CH[r.char].c + (r.id === S.pid ? ';font-weight:800' : '') + '"><td>' + r.rank + '</td><td>' + esc(r.name) + '</td><td>' + r.score + '</td><td>' + r.kills + '</td><td>' + r.items + '</td><td>' + r.phish + '</td><td>' + (r.alive ? '✔' : r.survived + 's') + '</td></tr>').join('');
  const host = S.host === S.pid; $('#b-again').style.display = host ? '' : 'none'; $('#s-wait').textContent = host ? '' : 'Esperando al anfitrión para volver a jugar…';
  show('result');
}
$('#b-again').onclick = () => socket.emit('restart');
const QZ = [
  { q: 'Recibes un correo: "¡Ganaste un iPhone! Ingresa tu contraseña para reclamarlo". ¿Qué es?', o: ['Phishing', 'Un premio real'], a: 0 },
  { q: '¿Cuál es la contraseña más segura?', o: ['123456', 'T0m8-Luz!Rio_92x'], a: 1 },
  { q: 'Un programa que parece útil pero esconde código dañino se llama…', o: ['Troyano', 'Antivirus'], a: 0 },
  { q: 'La verificación en dos pasos sirve para…', o: ['Ir más rápido', 'Proteger tu cuenta aunque roben tu contraseña'], a: 1 },
  { q: 'En un WiFi público de cafetería, para comprar en línea conviene…', o: ['Usar VPN o datos móviles', 'Nada, es seguro'], a: 0 }
];
function loadQuiz() {
  const q = QZ[Math.random() * QZ.length | 0], box = $('#quiz');
  box.innerHTML = '<div class="q">🧠 <b>RETO RÁPIDO:</b> ' + q.q + '</div><div class="opts">' + q.o.map((o, i) => '<button data-i="' + i + '">' + o + '</button>').join('') + '</div>';
  $$('#quiz button').forEach(b => b.onclick = () => { const ok = +b.dataset.i === q.a; $$('#quiz button').forEach(x => x.disabled = true); b.classList.add(ok ? 'ok' : 'bad'); if (!ok) $$('#quiz button')[q.a].classList.add('ok'); toast(ok ? '¡Correcto! +1 punto de cultura digital' : 'Casi… ¡ya lo sabes para la próxima!', ok ? '#22ff88' : '#ff2d55'); });
}

// ---------- Entrada ----------
const inp = { x: 0, y: 0 }; let lastSent = '', lastT = 0; const keys = {};
function sendInput(force) {
  let x = inp.x, y = inp.y;
  if (keys.a || keys.ArrowLeft) x -= 1; if (keys.d || keys.ArrowRight) x += 1; if (keys.w || keys.ArrowUp) y -= 1; if (keys.s || keys.ArrowDown) y += 1;
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  const k = x.toFixed(2) + ',' + y.toFixed(2), now = performance.now();
  if ((k !== lastSent && now - lastT > 40) || force) { lastSent = k; lastT = now; socket.emit('input', { x, y }); }
}
const skill = s => { if (S.playing) socket.emit('skill', s); };
addEventListener('keydown', e => {
  if (!S.playing) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = true;
  if (k === ' ') { skill('dash'); e.preventDefault(); } if (k === 'e' || k === 'Shift') skill('shield');
  if (k.startsWith('Arrow')) e.preventDefault(); sendInput();
});
addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = false; if (S.playing) sendInput(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; inp.x = inp.y = 0; if (S.playing) sendInput(true); });
$('#k-dash').addEventListener('pointerdown', e => { e.preventDefault(); skill('dash'); });
$('#k-shield').addEventListener('pointerdown', e => { e.preventDefault(); skill('shield'); });
// Joystick virtual (aparece donde tocas en la mitad izquierda)
const jz = $('#joyzone'), jb = $('#joybase'), jk = $('#joyknob'); let jid = null, jo = null;
jz.addEventListener('pointerdown', e => {
  jid = e.pointerId; jz.setPointerCapture(jid); const r = jz.getBoundingClientRect(); jo = { x: e.clientX, y: e.clientY };
  jb.style.display = 'block'; jb.style.left = (jo.x - r.left - 60) + 'px'; jb.style.top = (jo.y - r.top - 60) + 'px'; jk.style.transform = 'none';
});
jz.addEventListener('pointermove', e => {
  if (e.pointerId !== jid) return; let dx = e.clientX - jo.x, dy = e.clientY - jo.y; const m = Math.hypot(dx, dy), max = 55;
  if (m > max) { dx = dx / m * max; dy = dy / m * max; }
  jk.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; inp.x = Math.abs(dx) < 8 && Math.abs(dy) < 8 ? 0 : dx / max; inp.y = Math.abs(dx) < 8 && Math.abs(dy) < 8 ? 0 : dy / max; sendInput();
});
const jend = e => { if (e.pointerId !== jid) return; jid = null; jb.style.display = 'none'; inp.x = inp.y = 0; sendInput(true); };
jz.addEventListener('pointerup', jend); jz.addEventListener('pointercancel', jend);
setInterval(() => S.playing && sendInput(), 100);

// ---------- Render ----------
const cv = $('#cv'), g = cv.getContext('2d'); let cw = 0, ch = 0, dpr = 1;
const ents = new Map(), parts = []; let snap = null, shake = 0, last = performance.now();
function resize() { dpr = Math.min(2, devicePixelRatio || 1); cw = innerWidth; ch = innerHeight; cv.width = cw * dpr; cv.height = ch * dpr; }
addEventListener('resize', resize); resize();
function ease(id, x, y, k) { let e = ents.get(id); if (!e) { e = { x, y, tx: x, ty: y, seen: 0 }; ents.set(id, e); } e.tx = x; e.ty = y; e.seen = performance.now(); return e; }
function onState(s) {
  snap = s; const pm = new Map(S.info ? S.info.players.map(p => [p.id, p]) : []);
  s.p.forEach(p => ease(p.i, p.x, p.y)); s.v.forEach(v => ease('v' + v.i, v.x, v.y)); s.it.forEach(i => ease('i' + i.i, i.x, i.y));
  for (const [id, e] of ents) if (performance.now() - e.seen > 600) ents.delete(id);
  for (const ev of s.e) {
    if (ev.t === 'hit') { burst(ev.x, ev.y, '#ff2d55', 14); if (ev.pid === S.pid) { shake = 12; beep(120, .2, 'sawtooth'); if (navigator.vibrate) navigator.vibrate(60); } }
    else if (ev.t === 'boom') { burst(ev.x, ev.y, '#ff7a1a', ev.big ? 40 : 18); beep(ev.big ? 90 : 200, .2, 'sawtooth'); if (ev.big) shake = 16; }
    else if (ev.t === 'pick') { burst(ev.x, ev.y, KIND[ev.k][0], 12); if (ev.pid === S.pid) beep(ev.k === 'phish' ? 140 : 700 + Math.random() * 200, .1, ev.k === 'phish' ? 'sawtooth' : 'triangle'); }
    else if (ev.t === 'dash') burst(ev.x, ev.y, '#00d4ff', 10);
    else if (ev.t === 'tip' && ev.pid === S.pid && ev.text) toast(ev.text, ev.text.startsWith('¡PHISHING') ? '#ffd60a' : '#22ff88');
  }
}
function burst(x, y, c, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 60 + Math.random() * 240; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: .5 + Math.random() * .5, m: 1, c }); } }
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000); last = now; if (!S.playing || !snap) return;
  const k = 1 - Math.exp(-dt * 18); for (const e of ents.values()) { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; }
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; p.l -= dt; if (p.l <= 0) parts.splice(i, 1); }
  draw(now / 1000);
}
function draw(t) {
  const { W, H, OBST } = S.world, me = ents.get(S.pid);
  const fit = Math.min(cw / W, ch / H), sc = Math.max(fit, Math.min(1.4, Math.min(cw, ch) / 600));
  const vw = cw / sc, vh = ch / sc; let cx = me ? me.x : W / 2, cy = me ? me.y : H / 2;
  cx = vw >= W ? W / 2 : Math.max(vw / 2, Math.min(W - vw / 2, cx)); cy = vh >= H ? H / 2 : Math.max(vh / 2, Math.min(H - vh / 2, cy));
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#05060f'; g.fillRect(0, 0, cw, ch);
  shake *= .88; const sx = (Math.random() - .5) * shake, sy = (Math.random() - .5) * shake;
  g.save(); g.translate(cw / 2 - cx * sc + sx, ch / 2 - cy * sc + sy); g.scale(sc, sc);
  g.fillStyle = '#080b1c'; g.fillRect(0, 0, W, H); g.strokeStyle = '#00d4ff1c'; g.lineWidth = 1; g.beginPath();
  for (let x = 0; x <= W; x += 50) { g.moveTo(x, 0); g.lineTo(x, H); } for (let y = 0; y <= H; y += 50) { g.moveTo(0, y); g.lineTo(W, y); } g.stroke();
  g.shadowColor = '#a855f7'; g.shadowBlur = 16; g.strokeStyle = '#a855f7'; g.lineWidth = 4; g.strokeRect(0, 0, W, H);
  g.fillStyle = '#1a0f3a'; g.lineWidth = 2; for (const b of OBST) { g.fillRect(b.x, b.y, b.w, b.h); g.strokeRect(b.x, b.y, b.w, b.h); }
  g.shadowBlur = 0;
  for (const i of snap.it) { const e = ents.get('i' + i.i); if (!e) continue; const [c, ic] = KIND[i.k]; const pulse = 1 + .15 * Math.sin(t * 6 + i.i); const blink = i.l < 3 && Math.floor(t * 6) % 2;
    if (blink) continue; g.save(); g.translate(e.x, e.y); g.shadowColor = c; g.shadowBlur = 16; g.fillStyle = c + '33'; g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 13 * pulse, 0, 7); g.fill(); g.stroke(); g.shadowBlur = 0; g.fillStyle = c; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ic, 0, 1);
    if (i.k === 'phish') { g.fillStyle = '#ffd60a'; g.font = 'bold 9px sans-serif'; g.fillText('GRATIS', 0, -20); } g.restore(); }
  for (const v of snap.v) { const e = ents.get('v' + v.i); if (!e) continue; const c = VCOL[v.k], r = v.k === 'trojan' ? 22 : v.k === 'worm' ? 14 : 10;
    g.save(); g.translate(e.x, e.y); g.rotate(t * 3 + v.i); g.shadowColor = c; g.shadowBlur = 16; g.fillStyle = c + '55'; g.strokeStyle = c; g.lineWidth = 2; g.beginPath();
    for (let a = 0; a < 8; a++) { const rr = a % 2 ? r * .55 : r * 1.2, an = a * Math.PI / 4; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } g.closePath(); g.fill(); g.stroke(); g.restore(); }
  const players = S.info ? new Map(S.info.players.map(p => [p.id, p])) : new Map();
  for (const p of snap.p) { const e = ents.get(p.i), info = players.get(p.i); if (!e || !info) continue;
    g.save(); if (!p.a) g.globalAlpha = .25;
    drawShape(g, info.char, e.x, e.y, 16, t);
    if (p.sh) { g.strokeStyle = '#a855f7'; g.lineWidth = 3; g.shadowColor = '#a855f7'; g.shadowBlur = 20; g.beginPath(); g.arc(e.x, e.y, 26 + Math.sin(t * 10) * 2, 0, 7); g.stroke(); }
    if (p.sp) { g.strokeStyle = '#ffd60a88'; g.beginPath(); g.arc(e.x, e.y, 22, 0, 7); g.stroke(); }
    g.shadowBlur = 0; g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText(info.name + (p.i === S.pid ? ' ★' : ''), e.x, e.y - 28);
    g.fillStyle = '#000a'; g.fillRect(e.x - 16, e.y + 22, 32, 4); g.fillStyle = p.h > 40 ? '#22ff88' : '#ff2d55'; g.fillRect(e.x - 16, e.y + 22, 32 * p.h / 100, 4); g.restore(); }
  for (const p of parts) { g.globalAlpha = Math.max(0, p.l * 1.6); g.fillStyle = p.c; g.fillRect(p.x - 2, p.y - 2, 4, 4); } g.globalAlpha = 1;
  g.restore();
  // HUD
  const m = snap.p.find(p => p.i === S.pid); if (!m) return;
  $('#h-time').textContent = Math.floor(snap.t / 60) + ':' + String(snap.t % 60).padStart(2, '0'); $('#h-score').textContent = m.s;
  $('#h-hp').style.width = m.h + '%'; $('#h-hpn').textContent = m.h; $('#h-info').textContent = m.a ? 'WASD mover · ESPACIO impulso · E escudo' : '💀 Eliminado — observando la partida';
  const sorted = [...snap.p].sort((a, b) => b.s - a.s);
  $('#board').innerHTML = sorted.map(p => { const i = players.get(p.i); return i ? '<div class="' + (p.a ? '' : 'dead') + '"><span class="dot" style="background:' + CH[i.char].c + '"></span><span class="n">' + esc(i.name) + '</span><b>' + p.s + '</b></div>' : ''; }).join('');
  for (const [id, cd, tot] of [['k-dash', m.dc, 4], ['k-shield', m.sc, 10]]) { const b = $('#' + id); b.classList.toggle('cd', cd > 0); b.querySelector('i').style.height = (cd / tot * 100) + '%'; }
}
requestAnimationFrame(frame);
