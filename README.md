# CÓDIGO ROJO: Sobrevive en la Red
Arcade multijugador en tiempo real (2–8 jugadores) · Node.js + Socket.IO + HTML5 Canvas · Proyecto de Cultura Digital.

## Ejecutar en tu computadora
```bash
npm install
npm start          # http://localhost:3000
```
Requiere Node.js 18+. Para probar a solas: `MIN_PLAYERS=1 npm start` (en Windows PowerShell: `$env:MIN_PLAYERS=1; npm start`).
Para jugar con celulares en la misma WiFi abre `http://IP-DE-TU-PC:3000` (ej. 192.168.1.20).

## Publicar en internet (Render, gratis)
1. Crea una cuenta en https://github.com y sube esta carpeta a un repositorio nuevo (botón "Add file → Upload files", sin la carpeta `node_modules`).
2. Crea una cuenta en https://render.com (puedes entrar con GitHub).
3. **New + → Web Service** → elige tu repositorio. Render lee `render.yaml`; si te pide datos: Runtime **Node**, Build `npm install`, Start `npm start`, Plan **Free**.
4. Espera el despliegue. Tu enlace será `https://codigo-rojo-xxxx.onrender.com`.
5. Compártelo. Nota: en el plan gratis el servidor "duerme" tras 15 min sin uso; la primera visita tarda ~50 s. Ábrelo tú antes de la clase.
Railway: New Project → Deploy from GitHub → misma carpeta (usa `npm start` y el puerto `PORT` automático).
Variables opcionales: `PORT` (automático), `MIN_PLAYERS` (def. 2), `CORS_ORIGIN` (def. `*`).

## Cómo jugar con tus compañeros
1. Abre el enlace → JUGAR → CREAR PARTIDA → nombre → personaje.
2. En la sala aparece un **código de 5 letras**; pulsa "Copiar enlace" y mándalo por WhatsApp (el enlace ya trae el código).
3. Tus compañeros abren el enlace, escriben su nombre y eligen personaje. Cuando haya 2+ jugadores, el anfitrión pulsa INICIAR.
Controles: PC = WASD/flechas, ESPACIO impulso, E/SHIFT escudo · Celular = joystick izquierda, botones derecha (mejor en horizontal).

## Cómo funciona el multijugador
- El **servidor es la autoridad** (`sim.js`): simula a 30 Hz posiciones, virus, ítems, daño, puntos y tiempo. Los clientes solo envían su *intención* (`input` de dirección y `skill`), por lo que nadie puede hacer trampa ni desincronizarse.
- Cada 66 ms (~15 Hz) el servidor emite un `state` (~2.5 KB con 8 jugadores) a la sala; el cliente suaviza el movimiento y dibuja los efectos.
- Salas en memoria con código único; al desconectarse un jugador tiene **25 s** para volver (token guardado en el navegador → evento `resume`). Si el anfitrión se va, otro jugador toma el rol.
- Fin de partida → `ended` con resultados; el anfitrión reinicia y todos vuelven a la sala. Ranking Top 10 en memoria (y en `data/` si el disco lo permite; en Render gratis se reinicia al redesplegar).
- Privacidad: solo se usa un apodo; no hay cuentas ni datos personales.

## Contenido de Cultura Digital
Virus (gusano, troyano, spyware), antivirus, contraseñas seguras, **phishing** (ítem trampa "GRATIS"), VPN, verificación en 2 pasos y copias de seguridad aparecen como mecánicas y avisos educativos; la pantalla final incluye un reto rápido.

## Pruebas (`npm test` y archivos en `test/`)
Ver `PRUEBAS.md`.
