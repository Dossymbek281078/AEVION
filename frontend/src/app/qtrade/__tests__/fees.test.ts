import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_FEES,
  ldFees,
  svFees,
  tradeFee,
  slipPrice,
  slipEntryPrice,
  slipExitPrice,
  roundTripFee,
  applyClosedFees,
  closeWithFees,
  todayRealizedPnl,
  dailyLossExceeded,
  feesForPair,
  __FEES_INTERNAL,
  type FeeConfig,
} from "../fees";

const enabledCfg: FeeConfig = {
  enabled: true,
  makerBps: 4,    // 0.04%
  takerBps: 10,   // 0.10%
  slippageBps: 5, // 0.05%
  dailyLossLimitUsd: 0,
};

describe("fees · ldFees / svFees", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("ldFees returns defaults when no entry exists", () => {
    expect(ldFees()).toEqual(DEFAULT_FEES);
  });

  it("ldFees returns defaults when JSON is malformed", () => {
    window.localStorage.setItem(__FEES_INTERNAL.FEES_KEY, "{not-json");
    expect(ldFees()).toEqual(DEFAULT_FEES);
  });

  it("svFees → ldFees roundtrip preserves config", () => {
    svFees(enabledCfg);
    expect(ldFees()).toEqual(enabledCfg);
  });

  it("svFees clamps out-of-range bps into [0, 10_000]", () => {
    svFees({ enabled: true, makerBps: -50, takerBps: 99_999, slippageBps: 7 });
    const out = ldFees();
    expect(out.makerBps).toBe(0);
    expect(out.takerBps).toBe(10_000);
    expect(out.slippageBps).toBe(7);
  });

  it("sanitize coerces non-boolean enabled to false", () => {
    window.localStorage.setItem(
      __FEES_INTERNAL.FEES_KEY,
      JSON.stringify({ enabled: 1, makerBps: 4, takerBps: 10, slippageBps: 5 }),
    );
    expect(ldFees().enabled).toBe(false);
  });
});

describe("fees · tradeFee", () => {
  it("returns 0 when fees disabled", () => {
    expect(tradeFee(10_000, "taker", { ...DEFAULT_FEES, enabled: false })).toBe(0);
  });

  it("returns 0 for non-positive notional", () => {
    expect(tradeFee(0, "taker", enabledCfg)).toBe(0);
    expect(tradeFee(-100, "taker", enabledCfg)).toBe(0);
    expect(tradeFee(NaN, "taker", enabledCfg)).toBe(0);
  });

  it("computes maker fee as notional × makerBps / 10_000", () => {
    // 10_000 × 4 / 10_000 = 4
    expect(tradeFee(10_000, "maker", enabledCfg)).toBeCloseTo(4, 6);
  });

  it("computes taker fee as notional × takerBps / 10_000", () => {
    // 10_000 × 10 / 10_000 = 10
    expect(tradeFee(10_000, "taker", enabledCfg)).toBeCloseTo(10, 6);
  });
});

describe("fees · slipPrice", () => {
  it("returns price unchanged when fees disabled", () => {
    const cfg = { ...enabledCfg, enabled: false };
    expect(slipPrice(100, "worse-up", cfg)).toBe(100);
    expect(slipPrice(100, "worse-down", cfg)).toBe(100);
  });

  it("worse-up adds slippageBps to price", () => {
    // 100 × (1 + 5/10_000) = 100.05
    expect(slipPrice(100, "worse-up", enabledCfg)).toBeCloseTo(100.05, 6);
  });

  it("worse-down subtracts slippageBps from price", () => {
    // 100 × (1 - 5/10_000) = 99.95
    expect(slipPrice(100, "worse-down", enabledCfg)).toBeCloseTo(99.95, 6);
  });

  it("slipEntryPrice — long pays more, short receives less", () => {
    expect(slipEntryPrice(100, "long", enabledCfg)).toBeCloseTo(100.05, 6);
    expect(slipEntryPrice(100, "short", enabledCfg)).toBeCloseTo(99.95, 6);
  });

  it("slipExitPrice — long receives less, short pays more", () => {
    expect(slipExitPrice(100, "long", enabledCfg)).toBeCloseTo(99.95, 6);
    expect(slipExitPrice(100, "short", enabledCfg)).toBeCloseTo(100.05, 6);
  });

  it("does not mutate non-positive prices", () => {
    expect(slipPrice(0, "worse-up", enabledCfg)).toBe(0);
    expect(slipPrice(-5, "worse-down", enabledCfg)).toBe(-5);
  });
});

describe("fees · roundTripFee + applyClosedFees", () => {
  it("roundTripFee = entry_fee + exit_fee", () => {
    // entry: 100 × 1 × 4/10_000 = 0.04
    // exit:  110 × 1 × 10/10_000 = 0.11
    // total: 0.15
    expect(roundTripFee(100, 110, 1, "maker", "taker", enabledCfg)).toBeCloseTo(0.15, 6);
  });

  it("applyClosedFees subtracts fees from raw P&L", () => {
    const rawPnl = 10;
    const fees = roundTripFee(100, 110, 1, "taker", "taker", enabledCfg);
    expect(applyClosedFees(rawPnl, 100, 110, 1, "taker", "taker", enabledCfg)).toBeCloseTo(rawPnl - fees, 6);
  });

  it("applyClosedFees passes pnl through when fees disabled", () => {
    const cfg = { ...enabledCfg, enabled: false };
    expect(applyClosedFees(42, 100, 110, 1, "taker", "taker", cfg)).toBe(42);
  });

  it("can flip a marginal-winner trade into a net loss", () => {
    // Tiny edge: 0.5 USD profit but 1.0 USD round-trip fee → -0.5 net
    const entry = 1000, exit = 1000.5, qty = 1;
    const rawPnl = (exit - entry) * qty; // 0.5
    const heavyFees: FeeConfig = { enabled: true, makerBps: 50, takerBps: 50, slippageBps: 0 };
    const net = applyClosedFees(rawPnl, entry, exit, qty, "taker", "taker", heavyFees);
    expect(net).toBeLessThan(0);
  });
});

describe("fees · closeWithFees", () => {
  const target = { entryPrice: 100, side: "long" as const, qty: 2 };

  it("disabled config — exitPrice unchanged, pnl = naïve", () => {
    const cfg = { ...enabledCfg, enabled: false };
    const r = closeWithFees(target, 110, cfg);
    expect(r.exitPrice).toBe(110);
    expect(r.realizedPnl).toBeCloseTo(20, 6);     // (110-100)*2
    expect(r.realizedPct).toBeCloseTo(10, 6);     // 10%
  });

  it("enabled — long exit gets worse-down slip + taker fees deducted", () => {
    // exitSlipped = 110 × (1 - 5/10000) = 109.945
    // rawPnl = (109.945 - 100) × 2 = 19.89
    // entryFee = 100 × 2 × 10/10000 = 0.20
    // exitFee  = 109.945 × 2 × 10/10000 = 0.21989
    // net pnl  = 19.89 - 0.20 - 0.21989 ≈ 19.47011
    const r = closeWithFees(target, 110, enabledCfg);
    expect(r.exitPrice).toBeCloseTo(109.945, 4);
    expect(r.realizedPnl).toBeCloseTo(19.47011, 4);
  });

  it("short side — exit slip goes worse-up", () => {
    const shortTarget = { entryPrice: 100, side: "short" as const, qty: 1 };
    // shortExit slip: worse-up → 95 × (1 + 5/10000) = 95.0475
    // rawPnl (short profit when price goes down): (95.0475 - 100) × 1 × -1 = 4.9525
    const r = closeWithFees(shortTarget, 95, enabledCfg);
    expect(r.exitPrice).toBeCloseTo(95.0475, 4);
    expect(r.realizedPnl).toBeLessThan(4.9525); // fees deducted
    expect(r.realizedPnl).toBeGreaterThan(4.7); // sanity
  });

  it("losing trade — fees make loss bigger", () => {
    const r = closeWithFees(target, 90, enabledCfg);
    // raw loss: (90 × (1-slip) - 100) × 2 ≈ -20.09
    // fees deducted further → even more negative
    expect(r.realizedPnl).toBeLessThan(-20);
  });
});

describe("fees · todayRealizedPnl + dailyLossExceeded", () => {
  // Pin "now" to noon UTC so day-window math is deterministic
  const now = new Date(2026, 3, 29, 12, 0, 0).getTime();
  const dayStart = new Date(2026, 3, 29, 0, 0, 0).getTime();
  const yesterdayMid = new Date(2026, 3, 28, 12, 0, 0).getTime();

  it("excludes closes outside today's window", () => {
    expect(todayRealizedPnl([
      { exitTs: yesterdayMid, realizedPnl: -100 },
      { exitTs: dayStart - 1, realizedPnl: -50 },
    ], now)).toBe(0);
  });

  it("sums today's realized P&L", () => {
    expect(todayRealizedPnl([
      { exitTs: now, realizedPnl: 5 },
      { exitTs: now - 60_000, realizedPnl: -8 },
      { exitTs: yesterdayMid, realizedPnl: -1000 }, // ignored
    ], now)).toBeCloseTo(-3, 6);
  });

  it("ignores non-finite pnl entries", () => {
    expect(todayRealizedPnl([
      { exitTs: now, realizedPnl: NaN },
      { exitTs: now, realizedPnl: 7 },
    ], now)).toBe(7);
  });

  it("dailyLossExceeded false when cap is 0 / undefined", () => {
    const cfg: FeeConfig = { ...DEFAULT_FEES, dailyLossLimitUsd: 0 };
    expect(dailyLossExceeded([{ exitTs: now, realizedPnl: -9999 }], cfg, now)).toBe(false);
  });

  it("dailyLossExceeded true when today's loss ≥ cap", () => {
    const cfg: FeeConfig = { ...DEFAULT_FEES, dailyLossLimitUsd: 100 };
    expect(dailyLossExceeded([{ exitTs: now, realizedPnl: -101 }], cfg, now)).toBe(true);
    expect(dailyLossExceeded([{ exitTs: now, realizedPnl: -100 }], cfg, now)).toBe(true);
    expect(dailyLossExceeded([{ exitTs: now, realizedPnl: -99 }], cfg, now)).toBe(false);
  });

  it("dailyLossExceeded ignores yesterday's losses", () => {
    const cfg: FeeConfig = { ...DEFAULT_FEES, dailyLossLimitUsd: 50 };
    expect(dailyLossExceeded([
      { exitTs: yesterdayMid, realizedPnl: -1000 },
      { exitTs: now, realizedPnl: -10 },
    ], cfg, now)).toBe(false);
  });
});

describe("fees · feesForPair (per-pair promo overrides)", () => {
  it("returns config unchanged when fees disabled", () => {
    const cfg = { ...enabledCfg, enabled: false };
    expect(feesForPair("AEV/USD", cfg)).toBe(cfg);
    expect(feesForPair("BTC/USD", cfg)).toBe(cfg);
  });

  it("returns config unchanged for pairs without promo", () => {
    const out = feesForPair("BTC/USD", enabledCfg);
    expect(out).toEqual(enabledCfg);
  });

  it("AEV/USD promo overrides makerBps to 0 when fees enabled", () => {
    const out = feesForPair("AEV/USD", enabledCfg);
    expect(out.enabled).toBe(true);
    expect(out.makerBps).toBe(0);
    expect(out.takerBps).toBe(enabledCfg.takerBps);   // unchanged
    expect(out.slippageBps).toBe(enabledCfg.slippageBps); // unchanged
  });

  it("AEV/USD limit fill (maker) ⇒ zero fee with promo", () => {
    const promoCfg = feesForPair("AEV/USD", enabledCfg);
    expect(tradeFee(10_000, "maker", promoCfg)).toBe(0);
    expect(tradeFee(10_000, "taker", promoCfg)).toBeCloseTo(10, 6); // taker still 10 bps
  });
});
