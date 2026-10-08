// Contrato funcional (Etapa 1). Sin dependencias; TypeScript "borrable" (sin enums).
export const PROTOCOL_VERSION = 1;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1
export const ROOM_CODE_LENGTH = 6;
export const MAX_PAYLOAD_BYTES = 1024;
export const INPUT_RATE = 30; // mensajes/s por conexión
export const INPUT_BURST = 40;

export type ErrorCode = "BAD_PAYLOAD" | "TOO_LARGE" | "BAD_SEQ" | "BAD_NAME" | "RATE_LIMIT";
export type Input = { seq: number; x: number; y: number; run: boolean; act: boolean };
export type Parsed<T> = { ok: true; value: T } | { ok: false; code: ErrorCode };

/** Código aleatorio criptográfico; reintenta si ya existe una sala activa. */
export function generateRoomCode(
  isTaken: (code: string) => boolean,
  randomInt: (max: number) => number,
  maxTries = 50,
): string {
  for (let t = 0; t < maxTries; t++) {
    let c = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) c += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    if (!isTaken(c)) return c;
  }
  throw new Error("No se pudo generar un código libre");
}
export const isRoomCode = (s: unknown): s is string =>
  typeof s === "string" && s.length === ROOM_CODE_LENGTH && [...s].every((ch) => ROOM_CODE_ALPHABET.includes(ch));

export function parseName(raw: unknown): Parsed<string> {
  if (typeof raw !== "string") return { ok: false, code: "BAD_NAME" };
  const n = raw.trim().replace(/\s+/g, " ");
  const len = Array.from(n).length;
  if (len < 2 || len > 16 || /[\u0000-\u001f\u007f<>]/.test(n)) return { ok: false, code: "BAD_NAME" };
  return { ok: true, value: n };
}

/** Valida un mensaje `input`. Normaliza la magnitud del eje a <= 1. */
export function parseInput(raw: unknown): Parsed<Input> {
  let size = 0;
  try { size = JSON.stringify(raw)?.length ?? 0; } catch { return { ok: false, code: "BAD_PAYLOAD" }; }
  if (size > MAX_PAYLOAD_BYTES) return { ok: false, code: "TOO_LARGE" };
  if (typeof raw !== "object" || raw === null) return { ok: false, code: "BAD_PAYLOAD" };
  const o = raw as Record<string, unknown>;
  if (!Number.isSafeInteger(o.seq) || (o.seq as number) < 0) return { ok: false, code: "BAD_SEQ" };
  const { x, y } = o;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1 || Math.abs(y) > 1)
    return { ok: false, code: "BAD_PAYLOAD" };
  if (typeof o.run !== "boolean" || typeof o.act !== "boolean") return { ok: false, code: "BAD_PAYLOAD" };
  const m = Math.hypot(x, y), k = m > 1 ? 1 / m : 1;
  return { ok: true, value: { seq: o.seq as number, x: x * k, y: y * k, run: o.run, act: o.act } };
}

/** Cubeta de tokens con reloj inyectable (ms). */
export class RateLimiter {
  private tokens: number;
  private last: number;
  private rate: number;
  private cap: number;
  constructor(now: number, rate = INPUT_RATE, cap = INPUT_BURST) { this.last = now; this.rate = rate; this.cap = cap; this.tokens = cap; }
  allow(now: number): boolean {
    this.tokens = Math.min(this.cap, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
