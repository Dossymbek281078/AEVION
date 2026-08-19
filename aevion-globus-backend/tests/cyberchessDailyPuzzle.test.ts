import { describe, it, expect } from "vitest";
import { pickDailyPuzzle, dayNumber } from "../src/lib/cyberchessDailyPuzzle";

/* Пазл дня выбирался на клиенте как POOL[индекс] — а пул приходит перемешанным на каждый
   запрос (замер: 0 совпадений из 2000 между двумя запросами). Отсюда требование к выбору:
   он обязан НЕ зависеть от порядка пула и быть одинаковым у всех в одни сутки. */

const pool = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ fen: `fen-${i}`, sol: ["e2e4"] }));

const shuffled = <T,>(arr: T[], seed = 7): T[] => {
  // детерминированная перестановка, чтобы тест не мигал
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

describe("pickDailyPuzzle", () => {
  it("gives the same puzzle whatever order the pool arrives in", () => {
    const p = pool(500);
    const straight = pickDailyPuzzle(p, 20_000);
    const mixed = pickDailyPuzzle(shuffled(p), 20_000);
    const mixedAgain = pickDailyPuzzle(shuffled(p, 99), 20_000);
    expect(mixed?.fen).toBe(straight?.fen);
    expect(mixedAgain?.fen).toBe(straight?.fen);
  });

  it("changes from one day to the next", () => {
    const p = pool(500);
    const days = [20_000, 20_001, 20_002, 20_003, 20_004].map((d) => pickDailyPuzzle(p, d)?.fen);
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it("stays put for the whole of one day", () => {
    const p = pool(200);
    expect(pickDailyPuzzle(p, 19_999)?.fen).toBe(pickDailyPuzzle(p, 19_999)?.fen);
  });

  it("spreads across the pool rather than favouring one end", () => {
    const p = pool(1000);
    const picks = Array.from({ length: 60 }, (_, k) => pickDailyPuzzle(p, 20_000 + k)!.fen);
    const idxs = picks.map((f) => Number(f.split("-")[1]));
    // и первая, и вторая половина пула должны встречаться
    expect(idxs.some((i) => i < 500)).toBe(true);
    expect(idxs.some((i) => i >= 500)).toBe(true);
  });

  it("returns null for an empty pool instead of throwing", () => {
    expect(pickDailyPuzzle([], 20_000)).toBeNull();
  });

  it("counts days from the epoch in whole days", () => {
    expect(dayNumber(0)).toBe(0);
    expect(dayNumber(86_400_000 - 1)).toBe(0);
    expect(dayNumber(86_400_000)).toBe(1);
  });
});
