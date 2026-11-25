# Pruebas realizadas
Entorno de desarrollo SIN acceso a internet: no se pudo instalar `socket.io` real ni publicar ni probar con celulares reales.

| Prueba | Archivo | Resultado |
|---|---|---|
| 20 pruebas de la simulación (8 jugadores, obstáculos, puntos, phishing, escudo, fin por muerte/tiempo, reinicio, 2 min sin NaN, tamaño de snapshot) | test/sim.test.js | ✔ |
| 15 pruebas del servidor con una capa `socket.io` simulada (crear/unir sala, código inválido, sala en curso, solo anfitrión inicia, sincronización de movimiento, entradas inválidas, desconexión, reconexión con token, token falso) | test/server.test.js | ✔ |
| Navegador real (Chromium, viewport 390×780 táctil) con `io` simulado: inicio → menú → crear → personaje → sala → arena → joystick/botones → victoria → estadísticas → ranking, sin errores JS | test/ui.test.js | ✔ |
| Socket.IO real, varios dispositivos reales, despliegue en Render | — | ⚠ NO PROBADO |
Ejecutar: `node test/sim.test.js`, `node test/server.test.js`, y `NODE_PATH=$(npm root -g) node test/ui.test.js` (requiere Playwright).
