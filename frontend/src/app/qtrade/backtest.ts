// Backtester — applies a trading strategy to historical OHLC candles
// (Pair.candles[]) and produces equity curve + summary metrics.

import type { Candle } from "./marketSim";

export type StrategyKind = "dca" | "grid" | "bnh";

export type DcaConfig = {
  amountUsd: number;        // USD per buy
  intervalCandles: number;  // buy every N candles
};

export type GridConfig = {
  lowPrice: number;
  highPrice: number;
  gridCount: number;
  amountUsdPerLevel: number;
};

export type BnHConfig = {
  totalUsd: number;         // одна покупка на старте
};

export type StrategyConfig =
  | { kind: "dca"; cfg: DcaConfig }
  | { kind: "grid"; cfg: GridConfig }
  | { kind: "bnh"; cfg: BnHConfig };

export type EquityPoint = {
  ts: number;
  equity: number;       // (cash unspent) + (qty × current price)
  spent: number;        // cumulative USD spent
  realized: number;     // cumulative realized profit (только для grid)
  qty: number;          // cumulative qty held
};

export type BacktestResult = {
  ok: boolean;
  error?: string;
  strategy: StrategyKind;
  equity: EquityPoint[];
  totalSpent: number;
  finalQty: number;
  finalValue: number;        // equity на последней свече
  realizedProfit: number;    // grid only
  totalReturn: number;       // (finalValue - totalSpent) / totalSpent × 100
  maxDrawdown: number;       // абсолютный $ от peak
  maxDrawdownPct: number;    // % от peak
  numTrades: number;         // total buy + sell events
  numBuys: number;
  numSells: number;
};

function emptyResult(strategy: StrategyKind, error: string): BacktestResult {
  return {
    ok: false, error, strategy,
    equity: [], totalSpent: 0, finalQty: 0, finalValue: 0, realizedProfit: 0,
    totalReturn: 0, maxDrawdown: 0, maxDrawdownPct: 0,
    numTrades: 0, numBuys: 0, numSells: 0,
  };
}

// DCA: buy fixed USD каждые intervalCandles при открытии candle.
function runDca(candles: Candle[], cfg: DcaConfig): BacktestResult {
  if (candles.length === 0) return emptyResult("dca", "no candles");
  const interval = Math.max(1, Math.floor(cfg.intervalCandles));
  const amount = Math.max(0.01, cfg.amountUsd);
  let qty = 0, spent = 0, numBuys = 0;
  const equity: EquityPoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i % interval === 0) {
      // Buy at open
      const px = c.o;
      if (px > 0) {
        qty += amount / px;
        spent += amount;
        numBuys += 1;
      }
    }
    // Mark equity at close
    equity.push({ ts: c.ts, equity: qty * c.c, spent, realized: 0, qty });
  }
  const finalValue = equity.length > 0 ? equity[equity.length - 1].equity : 0;
  const totalReturn = spent > 0 ? ((finalValue - spent) / spent) * 100 : 0;
  // Max drawdown on (equity - spent) curve
  let peak = -Infinity, maxDd = 0, maxDdPct = 0;
  for (const p of equity) {
    const pl = p.equity - p.spent;
    if (pl > peak) peak = pl;
    const dd = peak - pl;
    if (dd > maxDd) {
      maxDd = dd;
      const denom = Math.max(p.spent, 1);
      maxDdPct = (dd / denom) * 100;
    }
  }
  return {
    ok: true, strategy: "dca", equity,
    totalSpent: spent, finalQty: qty, finalValue, realizedProfit: 0,
    totalReturn, maxDrawdown: maxDd, maxDrawdownPct: maxDdPct,
    numTrades: numBuys, numBuys, numSells: 0,
  };
}

// Grid: simulate buy/sell-cross на каждой candle (high/low проверка).
function runGrid(candles: Candle[], cfg: GridConfig): BacktestResult {
  if (candles.length === 0) return emptyResult("grid", "no candles");
  if (cfg.lowPrice <= 0 || cfg.highPrice <= cfg.lowPrice) return emptyResult("grid", "invalid range");
  if (cfg.gridCount < 2) return emptyResult("grid", "need ≥2 levels");
  const N = Math.min(60, Math.floor(cfg.gridCount));
  const amount = Math.max(0.01, cfg.amountUsdPerLevel);
  type Level = { price: number; filled: boolean; qty: number; entry: number };
  const levels: Level[] = [];
  for (let i = 0; i < N; i++) {
    const price = cfg.lowPrice + (cfg.highPrice - cfg.lowPrice) * i / (N - 1);
    levels.push({ price, filled: false, qty: 0, entry: 0 });
  }
  let qty = 0, spent = 0, realized = 0, numBuys = 0, numSells = 0;
  const equity: EquityPoint[] = [];
  for (const c of candles) {
    // For each level: check if candle range covers buy-trigger or sell-trigger
    for (let i = 0; i < levels.length; i++) {
      const lvl = levels[i];
      if (!lvl.filled) {
        // Buy if low <= level.price (price touched/dropped below this rung)
        if (c.l <= lvl.price && c.h >= 0) {
          const px = lvl.price; // assume fill at level
          lvl.qty = amount / px;
          lvl.entry = px;
          lvl.filled = true;
          qty += lvl.qty;
          spent += amount;
          numBuys += 1;
        }
      } else {
        // Sell at next-higher rung
        const sellPrice = i + 1 < levels.length ? levels[i + 1].price : lvl.price * 1.02;
        if (c.h >= sellPrice) {
          const profit = lvl.qty * (sellPrice - lvl.entry);
          realized += profit;
          spent -= amount; // deduct (или treat realized отдельно). Не вычитать из spent — это запутает return;
          // Actually: keep spent (total invested), grid releases capital but для simple return мы используем realized profit
          spent += amount; // restore
          qty -= lvl.qty;
          lvl.qty = 0;
          lvl.entry = 0;
          lvl.filled = false;
          numSells += 1;
        }
      }
    }
    // Mark equity = realized + (qty × close)
    equity.push({ ts: c.ts, equity: realized + qty * c.c, spent, realized, qty });
  }
  const finalValue = equity.length > 0 ? equity[equity.length - 1].equity : 0;
  // Grid: total return = (realized + final inventory value) / max-spent × 100. Но spent=cumulative,
  // включая re-buy циклы. Лучше: peak invested USD как denom.
  let peakSpent = 0, peakEquity = -Infinity, maxDd = 0, maxDdPct = 0;
  for (const p of equity) {
    if (p.spent > peakSpent) peakSpent = p.spent;
    if (p.equity > peakEquity) peakEquity = p.equity;
    const dd = peakEquity - p.equity;
    if (dd > maxDd) {
      maxDd = dd;
      const denom = Math.max(peakSpent, 1);
      maxDdPct = (dd / denom) * 100;
    }
  }
  // Total return for grid: (realized + qty × finalPrice) / peakSpent × 100
  const totalReturn = peakSpent > 0 ? (finalValue / peakSpent) * 100 : 0;
  return {
    ok: true, strategy: "grid", equity,
    totalSpent: peakSpent, finalQty: qty, finalValue, realizedProfit: realized,
    totalReturn, maxDrawdown: maxDd, maxDrawdownPct: maxDdPct,
    numTrades: numBuys + numSells, numBuys, numSells,
  };
}

// Buy-and-hold: одна покупка на open[0], держим до close[last].
function runBnh(candles: Candle[], cfg: BnHConfig): BacktestResult {
  if (candles.length === 0) return emptyResult("bnh", "no candles");
  const total = Math.max(0.01, cfg.totalUsd);
  const startPx = candles[0].o;
  if (startPx <= 0) return emptyResult("bnh", "invalid start price");
  const qty = total / startPx;
  const equity: EquityPoint[] = candles.map((c) => ({
    ts: c.ts,
    equity: qty * c.c,
    spent: total,
    realized: 0,
    qty,
  }));
  const finalValue = equity[equity.length - 1].equity;
  const totalReturn = ((finalValue - total) / total) * 100;
  let peak = -Infinity, maxDd = 0, maxDdPct = 0;
  for (const p of equity) {
    const pl = p.equity - p.spent;
    if (pl > peak) peak = pl;
    const dd = peak - pl;
    if (dd > maxDd) {
      maxDd = dd;
      maxDdPct = (dd / Math.max(total, 1)) * 100;
    }
  }
  return {
    ok: true, strategy: "bnh", equity,
    totalSpent: total, finalQty: qty, finalValue, realizedProfit: 0,
    totalReturn, maxDrawdown: maxDd, maxDrawdownPct: maxDdPct,
    numTrades: 1, numBuys: 1, numSells: 0,
  };
}

export function runBacktest(candles: Candle[], strategy: StrategyConfig): BacktestResult {
  switch (strategy.kind) {
    case "dca":  return runDca(candles, strategy.cfg);
    case "grid": return runGrid(candles, strategy.cfg);
    case "bnh":  return runBnh(candles, strategy.cfg);
  }
}
