// Simulación pura: sin DOM, Phaser ni red. Paso fijo de 30 Hz.
export const T = 16, W = 40, H = 22, DT = 1 / 30;
export const WALK = 64, RUN = 96, STALE_STEPS = 9; // 300 ms sin entrada = 9 pasos
export const MAX_PLAYERS = 4;
const RECTS = [[10,1,1,4],[10,7,1,8],[10,17,1,4],[21,1,1,6],[21,9,1,7],[21,18,1,3],[30,1,1,3],[30,6,1,6],[30,14,1,7],[1,11,3,1],[6,11,4,1],[14,4,4,2],[24,3,4,3],[14,14,4,3],[24,15,3,3],[33,8,3,2],[4,15,3,2],[4,6,2,2],[13,9,1,1],[34,14,3,2],[24,9,2,2]];
const G: number[][] = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x === 0 || y === 0 || x === W - 1 || y === H - 1 ? 1 : 0)));
for (const [x, y, w, h] of RECTS) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) G[j][i] = 1;
export const solid = (tx: number, ty: number) => tx < 0 || ty < 0 || tx >= W || ty >= H || G[ty][tx] === 1;
const hitBox = (x: number, y: number) => [[-5,-3],[5,-3],[-5,3],[5,3]].some(([a, b]) => solid(Math.floor((x + a) / T), Math.floor((y + b) / T)));
export const MAP_HASH = (() => { let h = 2166136261; for (const r of G) for (const c of r) { h ^= c; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); })();
export const SPAWNS: [number, number][] = [[3,18],[3,19],[5,18],[5,19]].map(([x, y]) => [x * T + 8, y * T + 10]);

export type In = { seq: number; x: number; y: number; run: boolean; act: boolean };
const NEUTRAL = { x: 0, y: 0, run: false, act: false };
export type Player = { id: string; x: number; y: number; en: number; idle: number; running: boolean; input: typeof NEUTRAL; lastSeq: number; lastStep: number };

export class Sim {
  step = 0;
  players = new Map<string, Player>();
  addPlayer(id: string): Player | null {
    if (this.players.has(id) || this.players.size >= MAX_PLAYERS) return null;
    const [x, y] = SPAWNS[this.players.size];
    const p: Player = { id, x, y, en: 100, idle: 0, running: false, input: { ...NEUTRAL }, lastSeq: -1, lastStep: this.step };
    this.players.set(id, p);
    return p;
  }
  removePlayer(id: string) { this.players.delete(id); }
  /** Rechaza secuencias antiguas o repetidas. Devuelve si se aplicó. */
  applyInput(id: string, i: In): boolean {
    const p = this.players.get(id);
    if (!p || i.seq <= p.lastSeq) return false;
    p.lastSeq = i.seq; p.lastStep = this.step;
    p.input = { x: i.x, y: i.y, run: i.run, act: i.act };
    return true;
  }
  /** Cambio de estado o reconexión: botones a cero. resetSeq permite que el teléfono reinicie su contador. */
  neutralize(id: string, resetSeq = false) {
    const p = this.players.get(id); if (!p) return;
    p.input = { ...NEUTRAL }; p.lastStep = this.step;
    if (resetSeq) p.lastSeq = -1;
  }
  tick() {
    this.step++;
    for (const p of this.players.values()) {
      if (this.step - p.lastStep > STALE_STEPS) p.input = { ...NEUTRAL };
      let { x, y } = p.input; const m = Math.hypot(x, y);
      if (m > 0) { x /= m; y /= m; }
      p.running = p.input.run && m > 0 && p.en > 0;
      if (p.running) { p.en = Math.max(0, p.en - 25 * DT); p.idle = 0; }
      else { p.idle += DT; if (p.idle > 1) p.en = Math.min(100, p.en + 20 * DT); }
      const s = (p.running ? RUN : WALK) * DT;
      if (!hitBox(p.x + x * s, p.y)) p.x += x * s;
      if (!hitBox(p.x, p.y + y * s)) p.y += y * s;
    }
  }
  snapshot() {
    return { step: this.step, hash: MAP_HASH, players: [...this.players.values()].map((p) => ({ id: p.id, x: +p.x.toFixed(1), y: +p.y.toFixed(1), en: Math.round(p.en), run: p.running })) };
  }
}
