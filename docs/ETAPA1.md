# Etapa 1 · Celular como control — estado real

## Hecho y verificado (13 pruebas, `npm test`, Node 22.22)
- `packages/protocol`: versión de protocolo, códigos de sala de 6 caracteres (alfabeto sin I/O/0/1, reintento por colisión),
  validación de nombre (2–16, sin HTML), validación de `input` (finitos, rango, tipos, 1 KiB, normalización),
  limitador de tasa (30/s, ráfaga 40) con reloj inyectable.
- `packages/game-core`: simulación pura a 30 Hz con N jugadores, mapa de 40×22, hash de mapa, movimiento a 64/96 px/s,
  diagonal normalizada, colisiones, energía de sprint, descarte de secuencias viejas, neutralización a los 300 ms,
  neutralización en reconexión sin duplicar personaje, máximo de 4 plazas, aislamiento entre simulaciones.

## NO hecho (requiere acceso a npm y a tu máquina; no se pudo instalar ni probar aquí)
- Next.js, Phaser, Colyseus, rutas `/host`, `/room/[code]`, `/join/[code]`, QR (`qrcode`), control táctil con pointer events.
- Cableado de Colyseus: sala, sesión de anfitrión, reservas/reconexión, filtrado de estado, validación de Origin.
- Despliegue en Vercel y Render; pruebas con dos teléfonos reales y E2E con Playwright.

## Criterio de la Etapa 1 (sin cumplir todavía)
Dos teléfonos independientes, movimiento simultáneo y neutralización — sobre un servidor real.

## Siguiente paso sugerido (en tu computadora)
1. `npm create` del monorepo (workspaces: apps/web, apps/server, packages/*) y registrar versiones en docs/DEPENDENCIAS.md.
2. Instalar Colyseus y leer su documentación de la versión instalada (salas, auth, reconexión). No inventar métodos.
3. En `apps/server`: sala que, por mensaje `input`, haga `parseInput` + `RateLimiter` + `Sim.applyInput`,
   y un bucle `setInterval` a 30 Hz con `Sim.tick()` y `snapshot()` a ~15 Hz.
4. En `apps/web`: `/host` (QR + código), `/join/[code]` (nombre + control), vista Phaser mínima con cuadrados.
