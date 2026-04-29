import { describe, it, expect } from "vitest";
import { runBacktest } from "../backtest";
import { DEFAULT_FEES, type FeeConfig } from "../fees";
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

describe("backtest · fee-aware execution", () => {
  const enabledFees: FeeConfig = {
    enabled: true,
    makerBps: 10,
    takerBps: 25,
    slippageBps: 20,
    dailyLossLimitUsd: 0,
  };

  it("DCA: with fees disabled returns same finalQty as default", () => {
    const candles = linearCandles(100, 100, 10);
    const cfg = { kind: "dca" as const, cfg: { amountUsd: 10, intervalCandles: 1 } };
    const noFees = runBacktest(candles, cfg);
    const explicitOff = runBacktest(candles, cfg, { ...DEFAULT_FEES, enabled: false });
    expect(noFees.finalQty).toBeCloseTo(explicitOff.finalQty, 6);
  });

  it("DCA: enabled fees reduce finalQty (slip + fee = less coins per USD)", () => {
    const candles = linearCandles(100, 100, 10);
    const cfg = { kind: "dca" as const, cfg: { amountUsd: 10, intervalCandles: 1 } };
    const idealised = runBacktest(candles, cfg);
    const realistic = runBacktest(candles, cfg, enabledFees);
    expect(realistic.finalQty).toBeLessThan(idealised.finalQty);
    // spent (USD invested) should be identical — fee comes out of coins not USD
    expect(realistic.totalSpent).toBeCloseTo(idealised.totalSpent, 6);
  });

  it("BnH: enabled fees reduce finalValue at equilibrium price", () => {
    const candles = linearCandles(100, 100, 10);
    const cfg = { kind: "bnh" as const, cfg: { totalUsd: 100 } };
    const idealised = runBacktest(candles, cfg);
    const realistic = runBacktest(candles, cfg, enabledFees);
    expect(realistic.finalQty).toBeLessThan(idealised.finalQty);
    // Idealised flat market = exactly break-even; with fees → loss
    expect(idealised.totalReturn).toBeCloseTo(0, 4);
    expect(realistic.totalReturn).toBeLessThan(0);
  });

  it("Grid: enabled fees reduce realizedProfit на каждом цикле", () => {
    const candles = oscillatingCandles(80, 120, 50);
    const cfg = { kind: "grid" as const, cfg: { lowPrice: 85, highPrice: 115, gridCount: 5, amountUsdPerLevel: 25 } };
    const idealised = runBacktest(candles, cfg);
    const realistic = runBacktest(candles, cfg, enabledFees);
    if (idealised.numSells > 0) {
      expect(realistic.realizedProfit).toBeLessThan(idealised.realizedProfit);
    }
  });

  it("Grid: numBuys/numSells unchanged by fee toggle (fees не fill events)", () => {
    const candles = oscillatingCandles(80, 120, 50);
    const cfg = { kind: "grid" as const, cfg: { lowPrice: 85, highPrice: 115, gridCount: 5, amountUsdPerLevel: 25 } };
    const idealised = runBacktest(candles, cfg);
    const realistic = runBacktest(candles, cfg, enabledFees);
    expect(realistic.numBuys).toBe(idealised.numBuys);
    expect(realistic.numSells).toBe(idealised.numSells);
  });
});

describe("backtest · BnH stop-loss / take-profit", () => {
  it("BnH без SL/TP — backwards compatible (numSells=0, finalQty>0)", () => {
    const candles = linearCandles(100, 110, 10);
    const r = runBacktest(candles, { kind: "bnh", cfg: { totalUsd: 100 } });
    expect(r.numSells).toBe(0);
    expect(r.finalQty).toBeGreaterThan(0);
  });

  it("BnH SL hit — exits when price drops X% from entry", () => {
    // Linear drop from 100 to 80 over 10 candles. SL = 10% (=> trigger at 90).
    const candles = linearCandles(100, 80, 10);
    const r = runBacktest(candles, { kind: "bnh", cfg: { totalUsd: 100, stopLossPct: 10 } });
    expect(r.numSells).toBe(1);
    expect(r.finalQty).toBe(0);
    expect(r.realizedProfit).toBeLessThan(0); // -10% loss + fees-free здесь
  });

  it("BnH TP hit — exits early at +X% profit", () => {
    const candles = linearCandles(100, 130, 10);
    const r = runBacktest(candles, { kind: "bnh", cfg: { totalUsd: 100, takeProfitPct: 20 } });
    expect(r.numSells).toBe(1);
    expect(r.finalQty).toBe(0);
    expect(r.realizedProfit).toBeGreaterThan(0);
  });

  it("BnH no trigger — same as plain BnH if neither SL nor TP hit", () => {
    const candles = linearCandles(100, 105, 10);
    // SL=20% (-20 to 80) + TP=20% (+20 to 120) — neither hit
    const plain = runBacktest(candles, { kind: "bnh", cfg: { totalUsd: 100 } });
    const guarded = runBacktest(candles, { kind: "bnh", cfg: { totalUsd: 100, stopLossPct: 20, takeProfitPct: 20 } });
    expect(guarded.finalQty).toBeCloseTo(plain.finalQty, 6);
    expect(guarded.numSells).toBe(0);
  });

  it("BnH equity курва — после exit equity замораживается на exitProceeds", () => {
    const candles = linearCandles(100, 80, 10);
    const r = runBacktest(candles, { kind: "bnh", cfg: { totalUsd: 100, stopLossPct: 10 } });
    // After SL hit, equity must be flat across remaining candles
    const last3 = r.equity.slice(-3).map((p) => p.equity);
    expect(last3[0]).toBeCloseTo(last3[1], 6);
    expect(last3[1]).toBeCloseTo(last3[2], 6);
  });
});

describe("backtest · DCA trailing exit", () => {
  it("DCA без trailing — backwards compat (numSells=0, finalQty>0)", () => {
    const candles = linearCandles(100, 110, 10);
    const r = runBacktest(candles, { kind: "dca", cfg: { amountUsd: 25, intervalCandles: 2 } });
    expect(r.numSells).toBe(0);
    expect(r.finalQty).toBeGreaterThan(0);
  });

  it("DCA trailing fires after up-move then retrace", () => {
    // Pump до 150 за 5 candles, потом dump до 100. Trailing 20% от peak 150 = 120.
    const up = linearCandles(100, 150, 6);
    const dn = linearCandles(150, 100, 6);
    const candles = [...up, ...dn];
    const r = runBacktest(candles, { kind: "dca", cfg: { amountUsd: 25, intervalCandles: 2, trailingPct: 20 } });
    expect(r.numSells).toBe(1);
    expect(r.finalQty).toBe(0);
  });

  it("DCA trailing tight 1% triggers быстро на любой dip", () => {
    const candles = linearCandles(100, 99, 5);
    const r = runBacktest(candles, { kind: "dca", cfg: { amountUsd: 25, intervalCandles: 1, trailingPct: 1 } });
    expect(r.numSells).toBe(1);
    expect(r.finalQty).toBe(0);
  });

  it("DCA equity замораживается после trailing exit", () => {
    const up = linearCandles(100, 200, 5);
    const dn = linearCandles(200, 100, 10);
    const candles = [...up, ...dn];
    const r = runBacktest(candles, { kind: "dca", cfg: { amountUsd: 25, intervalCandles: 1, trailingPct: 10 } });
    if (r.numSells === 1) {
      const last3 = r.equity.slice(-3).map((p) => p.equity);
      expect(last3[0]).toBeCloseTo(last3[1], 6);
      expect(last3[1]).toBeCloseTo(last3[2], 6);
    }
  });

  it("DCA trailing не fires если price не возрастает достаточно", () => {
    // Flat market with tiny noise — no up-move worth retracing
    const candles = linearCandles(100, 100, 10);
    const r = runBacktest(candles, { kind: "dca", cfg: { amountUsd: 25, intervalCandles: 2, trailingPct: 50 } });
    expect(r.numSells).toBe(0);
  });
});
