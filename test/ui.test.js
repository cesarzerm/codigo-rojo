// Prueba de interfaz con navegador real (Playwright) y un "io" simulado en la página.
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const STUB = `window.io=function(){const h={};let n=0;const s={on(e,f){h[e]=f},emit(e,d,cb){
 if(e==='create'||e==='join'){const info={code:'ABCDE',phase:'lobby',hostId:'p1',max:8,players:[{id:'p1',name:'Ana',char:0,connected:true},{id:'p2',name:'Beto',char:1,connected:true}]};setTimeout(()=>{cb({ok:true,code:'ABCDE',pid:'p1',token:'t',info,phase:'lobby'});},20)}
 if(e==='start'){setTimeout(()=>{h.start({W:1600,H:900,DURATION:120,OBST:[{x:720,y:380,w:160,h:140}]});let t=0;window.__iv=setInterval(()=>{t++;h.state({t:120-t/20|0,p:[{i:'p1',x:400+t*3,y:300,h:70,s:t,a:1,sh:t%100<30?1:0,sp:0,d:0,dc:2,sc:0,c:1},{i:'p2',x:900,y:500,h:100,s:5,a:1,sh:0,sp:1,d:0,dc:0,sc:3,c:1}],v:[{i:1,k:'worm',x:600,y:350},{i:2,k:'trojan',x:300,y:500},{i:3,k:'spy',x:700,y:200}],it:[{i:1,k:'av',x:500,y:320,l:10},{i:2,k:'phish',x:560,y:300,l:10},{i:3,k:'pass',x:450,y:380,l:10}],e:t===60?(clearInterval(window.__iv),setTimeout(()=>h.ended({results:[{id:'p1',name:'Ana',char:0,score:230,kills:4,items:9,phish:1,survived:120,alive:true,rank:1},{id:'p2',name:'Beto',char:1,score:90,kills:1,items:3,phish:0,survived:60,alive:false,rank:2}],lb:[]}),0),[]):t===5?[{t:'hit',x:420,y:300,pid:'p1'},{t:'tip',pid:'p1',text:'¡PHISHING! prueba de aviso'},{t:'boom',x:500,y:300}]:[]});},50)},20)}
 if(e==='leaderboard')d([{name:'Ana',char:0,score:230}]);
 if(false){h.ended({results:[{id:'p1',name:'Ana',char:0,score:230,kills:4,items:9,phish:1,survived:120,alive:true,rank:1},{id:'p2',name:'Beto',char:1,score:90,kills:1,items:3,phish:0,survived:60,alive:false,rank:2}],lb:[]})}
 },connected:true};setTimeout(()=>h.connect&&h.connect(),0);return s};`;
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0];
  if (u === '/socket.io/socket.io.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(STUB); }
  const f = path.join(__dirname, '../public', u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(d); }); }).listen(0);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:' + srv.address().port + '/'); const on = () => p.$eval('.screen.on', e => e.id);
  const log = (m) => console.log('✔', m);
  await p.screenshot({ path: '/tmp/s1.png' }); if (await on() !== 's-splash') throw new Error('splash'); log('pantalla de inicio visible');
  await p.click('#s-splash .btn',{force:true}); if (await on() !== 's-menu') throw new Error('menu'); log('JUGAR abre el menú principal');
  await p.click('[data-go=how]'); log('cómo jugar: ' + await on()); await p.click('#s-how .ghost');
  await p.click('[data-go=create]'); await p.fill('#n-create', 'Ana'); await p.click('#b-create'); if (await on() !== 's-chars') throw new Error('chars'); log('selección de personaje');
  await p.click('.ch:nth-child(2)'); await p.waitForTimeout(150); await p.screenshot({ path: '/tmp/s2.png' }); await p.click('#b-confirm'); await p.waitForTimeout(100);
  if (await on() !== 's-lobby' || (await p.textContent('#l-code')) !== 'ABCDE') throw new Error('lobby'); log('sala de espera con código y lista de jugadores');
  await p.screenshot({ path: '/tmp/s3.png' }); await p.click('#b-start'); await p.waitForTimeout(700);
  if (await on() !== 's-game') throw new Error('game'); log('arena iniciada');
  await p.waitForTimeout(500); await p.screenshot({ path: '/tmp/s4.png' });
  const box = await p.$eval('#joyzone', e => { const r = e.getBoundingClientRect(); return { x: r.x + 80, y: r.y + r.height - 100 }; });
  await p.dispatchEvent('#joyzone', 'pointerdown', { pointerId: 1, clientX: box.x, clientY: box.y, bubbles: true, pointerType: 'touch' });
  await p.dispatchEvent('#joyzone', 'pointermove', { pointerId: 1, clientX: box.x + 40, clientY: box.y, bubbles: true }); log('joystick táctil sin errores');
  await p.tap('#k-dash'); await p.tap('#k-shield'); log('botones de habilidad responden');
  await p.waitForTimeout(3600); if (await on() !== 's-result') throw new Error('result ' + await on()); log('pantalla de victoria/derrota: ' + await p.textContent('#r-title'));
  await p.screenshot({ path: '/tmp/s5.png' }); await p.click('#s-result .btn'); if (await on() !== 's-stats') throw new Error('stats'); log('estadísticas finales: ' + (await p.$$('#t-stats tr')).length + ' filas');
  await p.click('#quiz button'); await p.screenshot({ path: '/tmp/s6.png' }); await p.click('#b-rank2'); await p.waitForTimeout(100); log('clasificación: ' + await on()); await p.screenshot({ path: '/tmp/s7.png' });
  await b.close(); srv.close();
  if (errs.length) { console.log('ERRORES JS:', errs); process.exit(1); } console.log('Sin errores de JavaScript en consola'); })().catch(e => { console.error('FALLÓ', e.message); process.exit(1); });
