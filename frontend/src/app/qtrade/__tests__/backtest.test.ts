import { describe, it, expect } from "vitest";
import { runBacktest } from "../backtest";
import type { Candle } from "../marketSim";

const linearCandles = (start: number, end: number, n: number): Candle[] => {
  const candles: Candle[] = [];
  const denom = Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const px = start + ((end - start) * i) / denom;
    const next = start + ((end - start) * Math.min(i + 1, n - 1)) / denom;
    candles.push({
      ts: i * 30_000,
      o: px,
      h: Math.max(px, next),
      l: Math.min(px, next),
      c: next,
      vol: 1,
    });
  }
  return candles;
};

const oscillatingCandles = (low: number, high: number, n: number): Candle[] => {
  const mid = (low + high) / 2;
  const amp = (high - low) / 2;
  const candles: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const c = mid + amp * Math.sin((i / n) * 4 * Math.PI);
    const next = mid + amp * Math.sin(((i + 1) / n) * 4 * Math.PI);
    candles.push({
      ts: i * 30_000,
      o: c,
      h: Math.max(c, next) + 0.1,
      l: Math.min(c, next) - 0.1,
      c: next,
      vol: 1,
    });
  }
  return candles;
};

describe("runBacktest · DCA", () => {
  it("returns error for empty candles", () => {
    const r = runBacktest([], { kind: "dca", cfg: { amountUsd: 100, intervalCandles: 1 } });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("no candles");
  });

  it("buys every interval and accumulates qty", () => {
    const candles = linearCandles(100, 200, 10);
    const r = runBacktest(candles, { kind: "dca", cfg: { amountUsd: 100, intervalCandles: 2 } });
    expect(r.ok).toBe(true);
    expect(r.numBuys).toBe(5);
    expect(r.totalSpent).toBe(500);
    expect(r.equity).toHaveLength(10);
    expect(r.finalQty).toBeGreaterThan(0);
  });

  it("totalReturn positive when price climbs", () => {
    const candles = linearCandles(100, 200, 20);
    const r = runBacktest(candles, { kind: "dca", cfg: { amountUsd: 50, intervalCandles: 1 } });
    expect(r.ok).toBe(true);
    expect(r.totalReturn).toBeGreaterThan(0);
  });

  it("totalReturn negative when price falls", () => {
    const candles = linearCandles(200, 100, 20);
    const r = runBacktest(candles, { kind: "dca", cfg: { amountUsd: 50, intervalCandles: 1 } });
    expect(r.ok).toBe(true);
    expect(r.totalReturn).toBeLessThan(0);
  });
});

describe("runBacktest · Buy & Hold", () => {
  it("returns error for empty candles", () => {
    const r = runBacktest([], { kind: "bnh", cfg: { totalUsd: 1000 } });
    expect(r.ok).toBe(false);
  });

  it("doubles equity when price doubles", () => {
    const candles = linearCandles(100, 200, 5);
    const r = runBacktest(candles, { kind: "bnh", cfg: { totalUsd: 1000 } });
    expect(r.ok).toBe(true);
    expect(r.numBuys).toBe(1);
    expect(r.totalSpent).toBe(1000);
    expect(r.finalValue).toBeCloseTo(2000, 0);
    expect(r.totalReturn).toBeCloseTo(100, 0);
  });

  it("max drawdown is zero on monotonic rise", () => {
    const candles = linearCandles(100, 200, 10);
    const r = runBacktest(candles, { kind: "bnh", cfg: { totalUsd: 1000 } });
    expect(r.maxDrawdown).toBe(0);
  });

  it("max drawdown is positive on dip", () => {
    const candles: Candle[] = [
      { ts: 0,     o: 100, h: 100, l: 100, c: 100, vol: 1 },
      { ts: 30000, o: 100, h: 110, l: 100, c: 110, vol: 1 },
      { ts: 60000, o: 110, h: 110, l:  80, c:  80, vol: 1 },
      { ts: 90000, o:  80, h:  95, l:  80, c:  95, vol: 1 },
    ];
    const r = runBacktest(candles, { kind: "bnh", cfg: { totalUsd: 1000 } });
    expect(r.maxDrawdown).toBeGreaterThan(0);
  });
});

describe("runBacktest · Grid", () => {
  it("returns error on invalid range", () => {
    const r = runBacktest([], { kind: "grid", cfg: { lowPrice: 100, highPrice: 50, gridCount: 5, amountUsdPerLevel: 10 } });
    expect(r.ok).toBe(false);
  });

  it("returns error on too few levels", () => {
    const candles = linearCandles(80, 120, 5);
    const r = runBacktest(candles, { kind: "grid", cfg: { lowPrice: 80, highPrice: 120, gridCount: 1, amountUsdPerLevel: 10 } });
    expect(r.ok).toBe(false);
  });

  it("realizes profit on oscillating market", () => {
    const candles = oscillatingCandles(80, 120, 80);
    const r = runBacktest(candles, { kind: "grid", cfg: { lowPrice: 85, highPrice: 115, gridCount: 6, amountUsdPerLevel: 50 } });
    expect(r.ok).toBe(true);
    expect(r.numBuys).toBeGreaterThan(0);
    expect(r.numSells).toBeGreaterThan(0);
    expect(r.realizedProfit).toBeGreaterThan(0);
  });

  it("equity curve length matches candles", () => {
    const candles = oscillatingCandles(80, 120, 50);
    const r = runBacktest(candles, { kind: "grid", cfg: { lowPrice: 85, highPrice: 115, gridCount: 5, amountUsdPerLevel: 25 } });
    expect(r.equity).toHaveLength(50);
  });
});
