import { describe, it, expect } from "vitest";
import {
  unrealizedPnl,
  unrealizedPct,
  checkBracketHit,
  checkLimitFills,
  checkAlertHits,
  aggregateCandles,
  buildClosed,
  buildOrderBook,
  sparklinePath,
  makeBot,
  tickBot,
  botUnrealizedPnl,
  botUnrealizedPct,
  makeGridBot,
  tickGridBot,
  gridFilledCount,
  fmtUsd,
  fmtPct,
  type Position,
  type LimitOrder,
  type PriceAlert,
  type Pair,
  type Candle,
} from "../marketSim";

const mkPair = (price = 100, prevPrice = 100): Pair => ({
  id: "BTC/USD",
  symbol: "BTC",
  name: "Bitcoin",
  price,
  prevPrice,
  basePrice: 100,
  open24h: 100,
  open24hTs: Date.now(),
  history: [98, 99, 100, prevPrice, price],
  lastTs: Date.now(),
  vol: 0.003,
  drift: 0.00004,
});

const mkPosition = (over: Partial<Position> = {}): Position => ({
  id: "p1",
  pair: "BTC/USD",
  side: "long",
  qty: 0.5,
  entryPrice: 100,
  entryTs: Date.now(),
  ...over,
});

describe("PnL math", () => {
  it("long PnL is positive when price rises", () => {
    const p = mkPosition({ side: "long", qty: 2, entryPrice: 100 });
    expect(unrealizedPnl(p, 110)).toBe(20);
    expect(unrealizedPct(p, 110)).toBeCloseTo(10, 5);
  });

  it("short PnL is positive when price falls", () => {
    const p = mkPosition({ side: "short", qty: 2, entryPrice: 100 });
    expect(unrealizedPnl(p, 90)).toBe(20);
    expect(unrealizedPct(p, 90)).toBeCloseTo(10, 5);
  });

  it("zero PnL at entry", () => {
    const p = mkPosition({ entryPrice: 50 });
    expect(unrealizedPnl(p, 50)).toBe(0);
    expect(unrealizedPct(p, 50)).toBe(0);
  });
});

describe("checkBracketHit", () => {
  it("long: TP triggers when price >= TP", () => {
    const p = mkPosition({ side: "long", entryPrice: 100, takeProfit: 110, stopLoss: 90 });
    expect(checkBracketHit(p, 110)).toBe("tp");
    expect(checkBracketHit(p, 111)).toBe("tp");
    expect(checkBracketHit(p, 109)).toBeNull();
  });

  it("long: SL triggers when price <= SL", () => {
    const p = mkPosition({ side: "long", entryPrice: 100, stopLoss: 90 });
    expect(checkBracketHit(p, 90)).toBe("sl");
    expect(checkBracketHit(p, 89)).toBe("sl");
    expect(checkBracketHit(p, 91)).toBeNull();
  });

  it("short: TP triggers when price <= TP", () => {
    const p = mkPosition({ side: "short", entryPrice: 100, takeProfit: 90 });
    expect(checkBracketHit(p, 90)).toBe("tp");
    expect(checkBracketHit(p, 89)).toBe("tp");
    expect(checkBracketHit(p, 91)).toBeNull();
  });

  it("short: SL triggers when price >= SL", () => {
    const p = mkPosition({ side: "short", entryPrice: 100, stopLoss: 110 });
    expect(checkBracketHit(p, 110)).toBe("sl");
  });

  it("returns null when neither bracket set", () => {
    const p = mkPosition();
    expect(checkBracketHit(p, 200)).toBeNull();
  });
});

describe("checkLimitFills", () => {
  it("long limit fills when price drops to/below trigger", () => {
    const orders: LimitOrder[] = [
      { id: "o1", pair: "BTC/USD", side: "long", qty: 1, triggerPrice: 95, createdTs: 0 },
    ];
    expect(checkLimitFills(orders, mkPair(94))).toEqual(["o1"]);
    expect(checkLimitFills(orders, mkPair(95))).toEqual(["o1"]);
    expect(checkLimitFills(orders, mkPair(96))).toEqual([]);
  });

  it("short limit fills when price rises to/above trigger", () => {
    const orders: LimitOrder[] = [
      { id: "o2", pair: "BTC/USD", side: "short", qty: 1, triggerPrice: 105, createdTs: 0 },
    ];
    expect(checkLimitFills(orders, mkPair(106))).toEqual(["o2"]);
    expect(checkLimitFills(orders, mkPair(105))).toEqual(["o2"]);
    expect(checkLimitFills(orders, mkPair(104))).toEqual([]);
  });

  it("filters out orders for other pairs", () => {
    const orders: LimitOrder[] = [
      { id: "o3", pair: "ETH/USD", side: "long", qty: 1, triggerPrice: 999, createdTs: 0 },
    ];
    expect(checkLimitFills(orders, mkPair(0.01))).toEqual([]);
  });
});

describe("checkAlertHits", () => {
  it("'above' fires when price crosses up through threshold", () => {
    const alerts: PriceAlert[] = [
      { id: "a1", pair: "BTC/USD", direction: "above", price: 100, createdTs: 0 },
    ];
    const pair = mkPair(101, 99);
    expect(checkAlertHits(alerts, pair, 99)).toEqual(["a1"]);
  });

  it("'above' does NOT fire when price was already above", () => {
    const alerts: PriceAlert[] = [
      { id: "a1", pair: "BTC/USD", direction: "above", price: 100, createdTs: 0 },
    ];
    const pair = mkPair(102, 101);
    expect(checkAlertHits(alerts, pair, 101)).toEqual([]);
  });

  it("'below' fires when price crosses down through threshold", () => {
    const alerts: PriceAlert[] = [
      { id: "b1", pair: "BTC/USD", direction: "below", price: 100, createdTs: 0 },
    ];
    const pair = mkPair(99, 101);
    expect(checkAlertHits(alerts, pair, 101)).toEqual(["b1"]);
  });
});

describe("aggregateCandles", () => {
  const base: Candle[] = [
    { ts: 0,      o: 10, h: 12, l:  9, c: 11, vol: 1 },
    { ts: 30000,  o: 11, h: 13, l: 10, c: 12, vol: 1 },
    { ts: 60000,  o: 12, h: 14, l: 11, c: 13, vol: 1 },
    { ts: 90000,  o: 13, h: 15, l: 12, c: 14, vol: 1 },
  ];

  it("returns base candles for 30s timeframe", () => {
    expect(aggregateCandles(base, 30_000)).toEqual(base);
  });

  it("merges 2 base candles into 1 minute candle", () => {
    const m1 = aggregateCandles(base, 60_000);
    expect(m1).toHaveLength(2);
    expect(m1[0]).toMatchObject({ ts: 0,     o: 10, h: 13, l:  9, c: 12, vol: 2 });
    expect(m1[1]).toMatchObject({ ts: 60000, o: 12, h: 15, l: 11, c: 14, vol: 2 });
  });
});

describe("buildClosed", () => {
  it("computes realized PnL for long", () => {
    const p = mkPosition({ side: "long", qty: 2, entryPrice: 100 });
    const c = buildClosed(p, 110);
    expect(c.realizedPnl).toBe(20);
    expect(c.realizedPct).toBeCloseTo(10, 5);
    expect(c.exitPrice).toBe(110);
    expect(c.id).toBe("p1");
  });

  it("computes realized PnL for short", () => {
    const p = mkPosition({ side: "short", qty: 2, entryPrice: 100 });
    const c = buildClosed(p, 90);
    expect(c.realizedPnl).toBe(20);
    expect(c.realizedPct).toBeCloseTo(10, 5);
  });
});

describe("buildOrderBook", () => {
  it("produces balanced bids/asks with positive spread", () => {
    const ob = buildOrderBook(mkPair(100));
    expect(ob.bids).toHaveLength(8);
    expect(ob.asks).toHaveLength(8);
    expect(ob.spread).toBeGreaterThan(0);
    expect(ob.bids[0].price).toBeLessThan(100);
    expect(ob.asks[0].price).toBeGreaterThan(100);
  });

  it("levels move further from mid as depth increases", () => {
    const ob = buildOrderBook(mkPair(100));
    for (let i = 1; i < ob.bids.length; i++) {
      expect(ob.bids[i].price).toBeLessThan(ob.bids[i - 1].price);
      expect(ob.asks[i].price).toBeGreaterThan(ob.asks[i - 1].price);
    }
  });
});

describe("sparklinePath", () => {
  it("returns empty string for ≤1 point", () => {
    expect(sparklinePath([])).toBe("");
    expect(sparklinePath([42])).toBe("");
  });

  it("starts with M and includes L for subsequent points", () => {
    const path = sparklinePath([1, 2, 3]);
    expect(path.startsWith("M ")).toBe(true);
    expect(path).toMatch(/L /);
  });
});

describe("DCA bot", () => {
  it("makeBot enforces min interval of 5s and min amount of $1", () => {
    const b = makeBot({ pair: "BTC/USD", intervalSec: 1, amountUsd: 0.01, budgetUsd: 0 });
    expect(b.intervalSec).toBe(5);
    expect(b.amountUsd).toBe(1);
  });

  it("first tick runs immediately (lastRunTs=0)", () => {
    const b = makeBot({ pair: "BTC/USD", intervalSec: 30, amountUsd: 100, budgetUsd: 0 });
    const r = tickBot(b, 50);
    expect(r.ran).toBe(true);
    expect(r.bot.runsCount).toBe(1);
    expect(r.bot.totalQty).toBe(2);
    expect(r.bot.avgEntry).toBe(50);
  });

  it("does not re-run before interval elapsed", () => {
    let b = makeBot({ pair: "BTC/USD", intervalSec: 30, amountUsd: 100, budgetUsd: 0 });
    const t0 = 1_000_000;
    b = tickBot(b, 50, t0).bot;
    const r = tickBot(b, 60, t0 + 5_000);
    expect(r.ran).toBe(false);
  });

  it("weighted avg entry tracks correctly across ticks", () => {
    let b = makeBot({ pair: "BTC/USD", intervalSec: 5, amountUsd: 100, budgetUsd: 0 });
    const t0 = 1_000_000;
    b = tickBot(b, 50, t0).bot;             // qty 2 @ 50
    b = tickBot(b, 100, t0 + 6_000).bot;    // qty 1 @ 100, total 3 qty, avg ≈ (2*50+1*100)/3
    expect(b.totalQty).toBeCloseTo(3, 5);
    expect(b.avgEntry).toBeCloseTo(200 / 3, 4);
  });

  it("becomes exhausted when budget hit", () => {
    let b = makeBot({ pair: "BTC/USD", intervalSec: 5, amountUsd: 50, budgetUsd: 50 });
    const t0 = 1_000_000;
    const r = tickBot(b, 100, t0);
    expect(r.bot.status).toBe("exhausted");
    b = r.bot;
    const r2 = tickBot(b, 100, t0 + 6_000);
    expect(r2.ran).toBe(false);
    expect(r2.bot.status).toBe("exhausted");
  });

  it("PnL helpers handle zero-qty bot", () => {
    const b = makeBot({ pair: "BTC/USD", intervalSec: 5, amountUsd: 100, budgetUsd: 0 });
    expect(botUnrealizedPnl(b, 100)).toBe(0);
    expect(botUnrealizedPct(b, 100)).toBe(0);
  });

  it("PnL positive when price > avg entry", () => {
    let b = makeBot({ pair: "BTC/USD", intervalSec: 5, amountUsd: 100, budgetUsd: 0 });
    b = tickBot(b, 50).bot;
    expect(botUnrealizedPnl(b, 60)).toBeCloseTo(20, 5);
    expect(botUnrealizedPct(b, 60)).toBeCloseTo(20, 5);
  });
});

describe("Grid bot", () => {
  it("makeGridBot rejects invalid configs", () => {
    expect(makeGridBot({ pair: "BTC/USD", lowPrice: 100, highPrice: 90, gridCount: 5, amountUsdPerLevel: 10, startPrice: 100 })).toBeNull();
    expect(makeGridBot({ pair: "BTC/USD", lowPrice: 90, highPrice: 100, gridCount: 1, amountUsdPerLevel: 10, startPrice: 100 })).toBeNull();
    expect(makeGridBot({ pair: "BTC/USD", lowPrice: 90, highPrice: 100, gridCount: 5, amountUsdPerLevel: 0, startPrice: 100 })).toBeNull();
  });

  it("creates evenly-spaced levels", () => {
    const b = makeGridBot({ pair: "BTC/USD", lowPrice: 90, highPrice: 100, gridCount: 5, amountUsdPerLevel: 10, startPrice: 95 })!;
    expect(b.levels).toHaveLength(5);
    expect(b.levels[0].price).toBe(90);
    expect(b.levels[4].price).toBe(100);
    expect(b.levels[2].price).toBeCloseTo(95, 5);
    expect(b.levels.every((l) => l.state === "empty")).toBe(true);
  });

  it("buys on price drop through level", () => {
    let b = makeGridBot({ pair: "BTC/USD", lowPrice: 90, highPrice: 100, gridCount: 5, amountUsdPerLevel: 10, startPrice: 100 })!;
    const r = tickGridBot(b, 92);
    expect(r.buys).toBeGreaterThan(0);
    expect(gridFilledCount(r.bot)).toBeGreaterThan(0);
  });

  it("sells on price rise through next rung + accumulates profit", () => {
    let b = makeGridBot({ pair: "BTC/USD", lowPrice: 90, highPrice: 100, gridCount: 5, amountUsdPerLevel: 10, startPrice: 100 })!;
    b = tickGridBot(b, 90).bot;       // fills lowest rung
    expect(gridFilledCount(b)).toBeGreaterThan(0);
    const r = tickGridBot(b, 100);    // rises through all upper rungs
    expect(r.sells).toBeGreaterThan(0);
    expect(r.bot.totalProfit).toBeGreaterThan(0);
  });

  it("paused bot does not trade", () => {
    const b = makeGridBot({ pair: "BTC/USD", lowPrice: 90, highPrice: 100, gridCount: 5, amountUsdPerLevel: 10, startPrice: 100 })!;
    const paused = { ...b, status: "paused" as const };
    const r = tickGridBot(paused, 80);
    expect(r.buys).toBe(0);
    expect(r.sells).toBe(0);
  });
});

describe("formatters", () => {
  it("fmtUsd handles non-finite", () => {
    expect(fmtUsd(NaN)).toBe("—");
    expect(fmtUsd(Infinity)).toBe("—");
  });

  it("fmtUsd renders dollar prefix", () => {
    expect(fmtUsd(123.456, 2)).toBe("$123.46");
    expect(fmtUsd(0.123456)).toMatch(/^\$0\./);
  });

  it("fmtPct adds + for positive", () => {
    expect(fmtPct(1.234)).toBe("+1.23%");
    expect(fmtPct(-1.234)).toBe("-1.23%");
    expect(fmtPct(NaN)).toBe("—");
  });
});
