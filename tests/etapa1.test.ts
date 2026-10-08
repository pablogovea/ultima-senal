import test from "node:test";
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { generateRoomCode, isRoomCode, parseInput, parseName, RateLimiter, ROOM_CODE_ALPHABET } from "../packages/protocol/src/index.ts";
import { Sim, DT, WALK, STALE_STEPS, MAX_PLAYERS } from "../packages/game-core/src/index.ts";

const inp = (seq: number, x = 0, y = 0, run = false, act = false) => ({ seq, x, y, run, act });
const runN = (s: Sim, n: number) => { for (let i = 0; i < n; i++) s.tick(); };

test("códigos: alfabeto sin ambiguos, longitud 6 y reintento por colisión", () => {
  assert.ok(!/[IO01]/.test(ROOM_CODE_ALPHABET));
  assert.ok(isRoomCode(generateRoomCode(() => false, randomInt)));
  let calls = 0;
  assert.ok(isRoomCode(generateRoomCode(() => ++calls < 3, randomInt)));
  assert.equal(calls, 3);
  assert.throws(() => generateRoomCode(() => true, randomInt, 5));
  assert.ok(!isRoomCode("ABC0IO"));
});
test("nombres: 2-16 caracteres visibles, sin HTML", () => {
  assert.equal(parseName("  Ana  ").ok, true);
  assert.equal(parseName("A").ok, false);
  assert.equal(parseName("x".repeat(17)).ok, false);
  assert.equal(parseName("<b>hi</b>").ok, false);
  assert.equal(parseName(42).ok, false);
});
test("input: rechaza NaN, Infinity, rango, tipos y tamaño; normaliza magnitud", () => {
  for (const bad of [null, "x", inp(-1), inp(1.5), inp(1, NaN), inp(1, Infinity), inp(1, 2), { ...inp(1), run: 1 }, { ...inp(1), pad: "z".repeat(2000) }])
    assert.equal(parseInput(bad).ok, false);
  const r = parseInput(inp(1, 1, 1));
  assert.ok(r.ok && Math.abs(Math.hypot(r.value.x, r.value.y) - 1) < 1e-9);
});
test("límite de tasa: ráfaga controlada y recuperación", () => {
  const rl = new RateLimiter(0); let ok = 0;
  for (let i = 0; i < 100; i++) if (rl.allow(0)) ok++;
  assert.equal(ok, 40);
  assert.equal(rl.allow(1000), true);
});
test("movimiento: velocidad base y diagonal normalizada", () => {
  const s = new Sim(); s.addPlayer("a"); s.addPlayer("b");
  s.applyInput("a", inp(1, 1, 0)); s.applyInput("b", inp(1, 1, 1));
  const a0 = { ...s.players.get("a")! }, b0 = { ...s.players.get("b")! };
  runN(s, 6);
  const a = s.players.get("a")!, b = s.players.get("b")!;
  assert.ok(Math.abs(a.x - a0.x - WALK * DT * 6) < 1e-6);
  assert.ok(Math.hypot(b.x - b0.x, b.y - b0.y) <= WALK * DT * 6 + 1e-6);
});
test("dos jugadores se mueven a la vez en direcciones distintas", () => {
  const s = new Sim(); s.addPlayer("a"); s.addPlayer("b");
  s.applyInput("a", inp(1, 0, -1)); s.applyInput("b", inp(1, 1, 0));
  const ay = s.players.get("a")!.y, bx = s.players.get("b")!.x;
  runN(s, 5);
  assert.ok(s.players.get("a")!.y < ay); assert.ok(s.players.get("b")!.x > bx);
});
test("paredes: no se atraviesa el borde del mapa", () => {
  const s = new Sim(); s.addPlayer("a");
  for (let i = 0; i < 300; i++) { s.applyInput("a", inp(1 + i, -1, 0, true)); s.tick(); }
  assert.ok(s.players.get("a")!.x >= 16 + 5 - 1e-6);
});
test("sprint: consumo y agotamiento de energía", () => {
  const s = new Sim(); s.addPlayer("a");
  for (let i = 0; i < 10; i++) { s.applyInput("a", inp(i + 1, 0, -1, true)); s.tick(); }
  assert.ok(s.players.get("a")!.running);
  assert.ok(Math.abs(s.players.get("a")!.en - (100 - 25 * DT * 10)) < 1e-6);
  for (let i = 10; i < 300; i++) { s.applyInput("a", inp(i + 1, i % 40 < 20 ? 1 : -1, 0, true)); s.tick(); }
  assert.equal(s.players.get("a")!.en, 0);
  assert.equal(s.players.get("a")!.running, false);
});
test("secuencias antiguas o repetidas se descartan", () => {
  const s = new Sim(); s.addPlayer("a");
  assert.equal(s.applyInput("a", inp(5, 1, 0)), true);
  assert.equal(s.applyInput("a", inp(5, 0, 1)), false);
  assert.equal(s.applyInput("a", inp(4, 0, 1)), false);
});
test("sin entrada durante 300 ms el personaje se detiene", () => {
  const s = new Sim(); s.addPlayer("a"); s.applyInput("a", inp(1, 1, 0));
  runN(s, STALE_STEPS + 1); const x2 = s.players.get("a")!.x;
  runN(s, 10);
  assert.equal(s.players.get("a")!.x, x2);
});
test("reconexión: neutraliza, no duplica personaje y permite reiniciar secuencia", () => {
  const s = new Sim(); s.addPlayer("a"); s.applyInput("a", inp(50, 1, 0, true));
  s.neutralize("a", true);
  assert.equal(s.addPlayer("a"), null); assert.equal(s.players.size, 1);
  const x = s.players.get("a")!.x; runN(s, 3);
  assert.equal(s.players.get("a")!.x, x);
  assert.equal(s.applyInput("a", inp(1, 1, 0)), true);
});
test("máximo de plazas e instantánea coherente", () => {
  const s = new Sim();
  for (let i = 0; i < MAX_PLAYERS; i++) assert.ok(s.addPlayer("p" + i));
  assert.equal(s.addPlayer("extra"), null);
  assert.equal(s.snapshot().players.length, 4);
});
test("aislamiento: dos simulaciones no comparten estado", () => {
  const a = new Sim(), b = new Sim(); a.addPlayer("x"); b.addPlayer("x");
  a.applyInput("x", inp(1, 1, 0)); runN(a, 5); runN(b, 5);
  assert.notEqual(a.players.get("x")!.x, b.players.get("x")!.x);
});
