// Market Simulator — frontend-only price feed + position tracking for QTrade.
// Random walk with mean-reversion drift. State persists in localStorage so the
// market "keeps moving" between sessions (we backfill ticks since lastTs).

const POSITIONS_KEY = "aevion_qtrade_positions_v1";
const PAIRS_KEY = "aevion_qtrade_pairs_v1";
const LIMITS_KEY = "aevion_qtrade_limits_v1";
const CLOSED_KEY = "aevion_qtrade_closed_v1";
const ALERTS_KEY = "aevion_qtrade_alerts_v1";
const BOTS_KEY = "aevion_qtrade_bots_v1";

export type PairId = "AEV/USD" | "BTC/USD" | "ETH/USD" | "SOL/USD";

export type Candle = { ts: number; o: number; h: number; l: number; c: number; vol: number };

export type Pair = {
  id: PairId;
  symbol: string;
  name: string;
  price: number;
  prevPrice: number;
  basePrice: number;     // anchor for mean-reversion
  open24h: number;       // tracked for 24h % change
  open24hTs: number;
  history: number[];     // last 120 ticks (ring buffer)
  lastTs: number;
  vol: number;           // annualized-ish volatility (per-tick stdev)
  drift: number;         // long-term drift per tick
  candles?: Candle[];    // optional для backward-compat — 30-second timeframe, last 40
};

// 30-секундный candle timeframe — 40 свечей = 20 минут истории
export const CANDLE_TIMEFRAME_MS = 30_000;
export const CANDLE_BUFFER = 40;

export type Position = {
  id: string;
  pair: PairId;
  side: "long" | "short";
  qty: number;
  entryPrice: number;
  entryTs: number;
  stopLoss?: number;     // абсолютная цена; long — закрытие если price ≤ SL; short — если price ≥ SL
  takeProfit?: number;   // абсолютная цена; long — закрытие если price ≥ TP; short — если price ≤ TP
  entryMode?: "maker" | "taker"; // taker — market open; maker — limit fill. undefined ⇒ taker (legacy)
  maxHoldMs?: number;    // time-stop: auto-close после N мс с entryTs. undefined / ≤0 ⇒ нет лимита
};

// Returns "tp" / "sl" / "ts" / null. "ts" = time-stop fired — Position
// held longer than maxHoldMs. Time-stop wins ties с price-bracket если оба
// триггера сработали в одном тике (защита: time guarantees бесконечно
// открытая позиция не висит).
export type BracketReason = "tp" | "sl" | "ts";

export function checkBracketHit(p: Position, price: number, now: number = Date.now()): BracketReason | null {
  if (p.maxHoldMs !== undefined && p.maxHoldMs > 0 && now - p.entryTs >= p.maxHoldMs) {
    return "ts";
  }
  if (p.side === "long") {
    if (p.takeProfit !== undefined && price >= p.takeProfit) return "tp";
    if (p.stopLoss !== undefined && price <= p.stopLoss) return "sl";
  } else {
    if (p.takeProfit !== undefined && price <= p.takeProfit) return "tp";
    if (p.stopLoss !== undefined && price >= p.stopLoss) return "sl";
  }
  return null;
}

export type Trade = {
  id: string;
  pair: PairId;
  side: "buy" | "sell";
  qty: number;
  price: number;
  ts: number;
  realizedPnl?: number;  // populated when closing
};

export type ClosedPosition = {
  id: string;
  pair: PairId;
  side: "long" | "short";
  qty: number;
  entryPrice: number;
  entryTs: number;
  exitPrice: number;
  exitTs: number;
  realizedPnl: number;     // USD
  realizedPct: number;     // %
  notes?: string;          // trade journal note
  tags?: string[];         // trade journal tags (lowercased, deduped)
};

export function ldClosed(): ClosedPosition[] {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(CLOSED_KEY) : null;
    if (!s) return [];
    const r = JSON.parse(s);
    return Array.isArray(r) ? r as ClosedPosition[] : [];
  } catch { return [] }
}

export function svClosed(cs: ClosedPosition[]) {
  try { localStorage.setItem(CLOSED_KEY, JSON.stringify(cs.slice(0, 200))) } catch {}
}

export function buildClosed(p: Position, exitPrice: number): ClosedPosition {
  const direction = p.side === "long" ? 1 : -1;
  const realizedPnl = (exitPrice - p.entryPrice) * p.qty * direction;
  const realizedPct = ((exitPrice - p.entryPrice) / p.entryPrice) * 100 * direction;
  return {
    id: p.id,
    pair: p.pair,
    side: p.side,
    qty: p.qty,
    entryPrice: p.entryPrice,
    entryTs: p.entryTs,
    exitPrice,
    exitTs: Date.now(),
    realizedPnl,
    realizedPct,
  };
}

const PAIR_DEFAULTS: Record<PairId, Pick<Pair, "id" | "symbol" | "name" | "basePrice" | "vol" | "drift">> = {
  "AEV/USD": { id: "AEV/USD", symbol: "AEV", name: "AEVION", basePrice: 1.42, vol: 0.0042, drift: 0.00008 },
  "BTC/USD": { id: "BTC/USD", symbol: "BTC", name: "Bitcoin", basePrice: 94500, vol: 0.0028, drift: 0.00004 },
  "ETH/USD": { id: "ETH/USD", symbol: "ETH", name: "Ethereum", basePrice: 3250, vol: 0.0035, drift: 0.00003 },
  "SOL/USD": { id: "SOL/USD", symbol: "SOL", name: "Solana", basePrice: 178, vol: 0.0048, drift: 0.00006 },
};

export const PAIR_IDS: PairId[] = ["AEV/USD", "BTC/USD", "ETH/USD", "SOL/USD"];

export function ldPairs(): Pair[] {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(PAIRS_KEY) : null;
    if (s) {
      const r = JSON.parse(s);
      if (Array.isArray(r) && r.length === PAIR_IDS.length) return r as Pair[];
    }
  } catch {}
  // Cold start
  const now = Date.now();
  return PAIR_IDS.map(id => {
    const d = PAIR_DEFAULTS[id];
    return {
      ...d,
      price: d.basePrice,
      prevPrice: d.basePrice,
      open24h: d.basePrice,
      open24hTs: now,
      history: Array(60).fill(d.basePrice),
      lastTs: now,
    };
  });
}

export function svPairs(pairs: Pair[]) {
  try { localStorage.setItem(PAIRS_KEY, JSON.stringify(pairs)) } catch {}
}

// Box-Muller normal sample
function gaussian(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Single-step price update: random walk with mean-reversion to basePrice.
// Returns the new price.
export function tickPair(p: Pair): Pair {
  const reversion = (p.basePrice - p.price) * 0.002;
  const shock = gaussian() * p.vol * p.price;
  const next = Math.max(0.0001, p.price + reversion + p.drift * p.price + shock);
  const history = p.history.length >= 120 ? [...p.history.slice(1), next] : [...p.history, next];
  const now = Date.now();
  // Roll 24h open every 24h
  let open24h = p.open24h, open24hTs = p.open24hTs;
  if (now - p.open24hTs > 24 * 3600 * 1000) {
    open24h = next;
    open24hTs = now;
  }
  // Roll 30s candles
  const prevCandles = p.candles || [];
  const bucketTs = Math.floor(now / CANDLE_TIMEFRAME_MS) * CANDLE_TIMEFRAME_MS;
  const last = prevCandles[prevCandles.length - 1];
  let candles: Candle[];
  if (!last || last.ts < bucketTs) {
    // Open new candle
    candles = [...prevCandles, { ts: bucketTs, o: next, h: next, l: next, c: next, vol: 1 }];
    if (candles.length > CANDLE_BUFFER) candles = candles.slice(-CANDLE_BUFFER);
  } else {
    // Update current candle: extend H/L, set C, bump vol
    const updated: Candle = {
      ts: last.ts,
      o: last.o,
      h: Math.max(last.h, next),
      l: Math.min(last.l, next),
      c: next,
      vol: last.vol + 1,
    };
    candles = [...prevCandles.slice(0, -1), updated];
  }
  return { ...p, prevPrice: p.price, price: next, history, lastTs: now, open24h, open24hTs, candles };
}

// Backfill: if many ticks have passed (e.g. tab was closed), fast-simulate
// up to N catch-up ticks so the price keeps a believable trajectory.
export function catchupPair(p: Pair, maxTicks = 60): Pair {
  const now = Date.now();
  const ticksMissed = Math.floor((now - p.lastTs) / 1000);
  const n = Math.min(maxTicks, Math.max(0, ticksMissed));
  let cur = p;
  for (let i = 0; i < n; i++) cur = tickPair(cur);
  return cur;
}

export function ldPositions(): Position[] {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(POSITIONS_KEY) : null;
    if (!s) return [];
    const r = JSON.parse(s);
    return Array.isArray(r) ? r as Position[] : [];
  } catch { return [] }
}

export function svPositions(ps: Position[]) {
  try { localStorage.setItem(POSITIONS_KEY, JSON.stringify(ps)) } catch {}
}

export function unrealizedPnl(p: Position, currentPrice: number): number {
  const direction = p.side === "long" ? 1 : -1;
  return (currentPrice - p.entryPrice) * p.qty * direction;
}

export function unrealizedPct(p: Position, currentPrice: number): number {
  const direction = p.side === "long" ? 1 : -1;
  return ((currentPrice - p.entryPrice) / p.entryPrice) * 100 * direction;
}

export function fmtUsd(n: number, decimals?: number): string {
  if (!Number.isFinite(n)) return "—";
  const d = decimals ?? (Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 1 ? 3 : 5);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

export function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

// ─── Limit orders ─────────────────────────────────────────────────
// Stop / Limit orders that auto-fill when the simulated price crosses the trigger.
export type LimitOrder = {
  id: string;
  pair: PairId;
  side: "long" | "short";
  qty: number;
  triggerPrice: number;  // execute at-or-better
  createdTs: number;
};

export function ldLimits(): LimitOrder[] {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(LIMITS_KEY) : null;
    if (!s) return [];
    const r = JSON.parse(s);
    return Array.isArray(r) ? r as LimitOrder[] : [];
  } catch { return [] }
}

export function svLimits(ls: LimitOrder[]) {
  try { localStorage.setItem(LIMITS_KEY, JSON.stringify(ls)) } catch {}
}

// Returns IDs of orders that should fill at given pair price.
// Fill semantics:
// - LONG limit: fill when price <= triggerPrice (you wanted to buy cheaper)
// - SHORT limit: fill when price >= triggerPrice (you wanted to sell higher)
export function checkLimitFills(orders: LimitOrder[], pair: Pair): string[] {
  const filled: string[] = [];
  for (const o of orders) {
    if (o.pair !== pair.id) continue;
    if (o.side === "long" && pair.price <= o.triggerPrice) filled.push(o.id);
    else if (o.side === "short" && pair.price >= o.triggerPrice) filled.push(o.id);
  }
  return filled;
}

// ─── Price alerts ─────────────────────────────────────────────────
export type PriceAlert = {
  id: string;
  pair: PairId;
  direction: "above" | "below";
  price: number;
  createdTs: number;
  note?: string;
};

export function ldAlerts(): PriceAlert[] {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(ALERTS_KEY) : null;
    if (!s) return [];
    const r = JSON.parse(s);
    return Array.isArray(r) ? r as PriceAlert[] : [];
  } catch { return [] }
}

export function svAlerts(as: PriceAlert[]) {
  try { localStorage.setItem(ALERTS_KEY, JSON.stringify(as)) } catch {}
}

// Returns alert IDs that should fire at the given pair price.
export function checkAlertHits(alerts: PriceAlert[], pair: Pair, prevPrice: number): string[] {
  const fired: string[] = [];
  for (const a of alerts) {
    if (a.pair !== pair.id) continue;
    if (a.direction === "above" && prevPrice < a.price && pair.price >= a.price) fired.push(a.id);
    else if (a.direction === "below" && prevPrice > a.price && pair.price <= a.price) fired.push(a.id);
  }
  return fired;
}

// ─── Order book mock ──────────────────────────────────────────────
// Generate a synthetic 10-level order book around the current price.
// Spread ~0.04% × volatility multiplier; size decreases linearly with depth.
export type OrderBookLevel = { price: number; size: number };
export type OrderBook = { bids: OrderBookLevel[]; asks: OrderBookLevel[]; spread: number };

export function buildOrderBook(p: Pair, levels = 8): OrderBook {
  const baseSpread = p.price * (p.vol * 0.5 + 0.0002);
  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];
  for (let i = 1; i <= levels; i++) {
    const offset = baseSpread * i + p.price * 0.00005 * i * i;
    const size = Math.max(0.01, (levels - i + 1) * (1 + (p.id === "BTC/USD" ? 0.05 : p.id === "ETH/USD" ? 0.3 : 5)) + Math.random() * 2);
    bids.push({ price: p.price - offset, size: Math.round(size * 100) / 100 });
    asks.push({ price: p.price + offset, size: Math.round(size * 100) / 100 });
  }
  return { bids, asks, spread: asks[0].price - bids[0].price };
}

// ─── Multi-timeframe aggregation ──────────────────────────────────
// Базовое хранилище — 30s candles в Pair.candles. Высшие таймфреймы
// агрегируем on-the-fly: floor(ts / TF) → bucket, MAX(h), MIN(l), first o,
// last c, sum vol. С 40 base candles это покрывает: 1m=20 свечей, 5m=4,
// 15m=2-3, 1h=1. Для производственного UX на 1h нужен больший buffer,
// но для демо — нормально.
export type TimeframeMs = 30_000 | 60_000 | 300_000 | 900_000 | 3_600_000;

export const TIMEFRAMES: { ms: TimeframeMs; label: string }[] = [
  { ms: 30_000,    label: "30s" },
  { ms: 60_000,    label: "1m"  },
  { ms: 300_000,   label: "5m"  },
  { ms: 900_000,   label: "15m" },
  { ms: 3_600_000, label: "1h"  },
];

export function aggregateCandles(base: Candle[], tfMs: TimeframeMs): Candle[] {
  if (tfMs === 30_000) return base;
  const buckets = new Map<number, Candle>();
  const order: number[] = [];
  for (const c of base) {
    const bucketTs = Math.floor(c.ts / tfMs) * tfMs;
    const existing = buckets.get(bucketTs);
    if (!existing) {
      buckets.set(bucketTs, { ts: bucketTs, o: c.o, h: c.h, l: c.l, c: c.c, vol: c.vol });
      order.push(bucketTs);
    } else {
      existing.h = Math.max(existing.h, c.h);
      existing.l = Math.min(existing.l, c.l);
      existing.c = c.c;
      existing.vol += c.vol;
    }
  }
  return order.map((ts) => buckets.get(ts)!);
}

// Build a tiny SVG sparkline path string (path d="...") from a price history.
export function sparklinePath(history: number[], width = 100, height = 30): string {
  if (history.length < 2) return "";
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const dx = width / (history.length - 1);
  return history
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * dx).toFixed(2)} ${(height - ((p - min) / range) * height).toFixed(2)}`)
    .join(" ");
}

// ─── DCA Bots — auto-trader ───────────────────────────────────────
// Каждый bot покупает фиксированную сумму USD каждые N секунд по текущей
// рыночной цене пары, строит average entry и считает unrealized PnL.
// Стопится когда исчерпан budget. Auto-tick инициируется из page tick.

export type BotRun = {
  ts: number;
  price: number;
  qty: number;
  spent: number;       // USD
};

export type DcaBot = {
  id: string;
  pair: PairId;
  intervalSec: number;        // как часто покупать
  amountUsd: number;          // сколько USD за tick
  budgetUsd: number;          // 0 = unlimited (поедает infinity)
  status: "active" | "paused" | "exhausted";
  createdTs: number;
  lastRunTs: number;          // 0 = ещё ни разу
  runsCount: number;
  spentUsd: number;
  totalQty: number;
  avgEntry: number;           // weighted-avg entry price
  recent: BotRun[];           // последние 20 покупок
};

export function ldBots(): DcaBot[] {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(BOTS_KEY) : null;
    if (!s) return [];
    const r = JSON.parse(s);
    return Array.isArray(r) ? r as DcaBot[] : [];
  } catch { return [] }
}

export function svBots(bs: DcaBot[]) {
  try { localStorage.setItem(BOTS_KEY, JSON.stringify(bs.slice(0, 50))) } catch {}
}

export function makeBot(opts: {
  pair: PairId;
  intervalSec: number;
  amountUsd: number;
  budgetUsd: number;          // 0 = unlimited
}): DcaBot {
  return {
    id: `bot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    pair: opts.pair,
    intervalSec: Math.max(5, Math.floor(opts.intervalSec)),
    amountUsd: Math.max(1, opts.amountUsd),
    budgetUsd: Math.max(0, opts.budgetUsd),
    status: "active",
    createdTs: Date.now(),
    lastRunTs: 0,
    runsCount: 0,
    spentUsd: 0,
    totalQty: 0,
    avgEntry: 0,
    recent: [],
  };
}

// Tick a single bot if active + interval elapsed. Returns possibly-updated bot
// + flag indicating whether a new run was performed (для AEV reward в page).
export function tickBot(
  bot: DcaBot,
  currentPrice: number,
  now = Date.now(),
): { bot: DcaBot; ran: boolean } {
  if (bot.status !== "active") return { bot, ran: false };
  const elapsed = (now - bot.lastRunTs) / 1000;
  if (bot.lastRunTs > 0 && elapsed < bot.intervalSec) return { bot, ran: false };
  const remaining = bot.budgetUsd > 0 ? bot.budgetUsd - bot.spentUsd : Infinity;
  if (remaining <= 0) return { bot: { ...bot, status: "exhausted" }, ran: false };
  const spend = Math.min(bot.amountUsd, remaining);
  if (spend <= 0) return { bot: { ...bot, status: "exhausted" }, ran: false };
  if (currentPrice <= 0) return { bot, ran: false };
  const qty = spend / currentPrice;
  const newTotalQty = bot.totalQty + qty;
  const newAvg = newTotalQty > 0
    ? (bot.avgEntry * bot.totalQty + currentPrice * qty) / newTotalQty
    : currentPrice;
  const run: BotRun = { ts: now, price: currentPrice, qty, spent: spend };
  const recent = [run, ...bot.recent].slice(0, 20);
  const newSpent = bot.spentUsd + spend;
  const exhausted = bot.budgetUsd > 0 && newSpent >= bot.budgetUsd;
  return {
    bot: {
      ...bot,
      lastRunTs: now,
      runsCount: bot.runsCount + 1,
      spentUsd: newSpent,
      totalQty: newTotalQty,
      avgEntry: newAvg,
      recent,
      status: exhausted ? "exhausted" : "active",
    },
    ran: true,
  };
}

// Unrealized PnL for a bot's averaged DCA stack.
export function botUnrealizedPnl(bot: DcaBot, currentPrice: number): number {
  if (bot.totalQty <= 0) return 0;
  return (currentPrice - bot.avgEntry) * bot.totalQty;
}

export function botUnrealizedPct(bot: DcaBot, currentPrice: number): number {
  if (bot.avgEntry <= 0) return 0;
  return ((currentPrice - bot.avgEntry) / bot.avgEntry) * 100;
}

// ─── Grid Bots — buy низко, sell высоко по сетке ──────────────────
// Grid bot задаёт диапазон [low, high] и N уровней. На каждый уровень:
// - empty → если price падает через уровень — buy
// - filled → если price поднимается на одно деление выше — sell, +profit
// Continuous поведение: bot переключается между filled/empty уровнями
// по мере колебания цены, накапливая realized profit.

const GRID_BOTS_KEY = "aevion_qtrade_grid_bots_v1";

export type GridLevel = {
  price: number;
  state: "empty" | "filled";
  qty: number;
  filledAtPrice?: number;
  filledTs?: number;
};

export type GridBot = {
  id: string;
  pair: PairId;
  lowPrice: number;
  highPrice: number;
  levels: GridLevel[];           // sorted asc by price
  amountUsdPerLevel: number;
  status: "active" | "paused" | "stopped";
  createdTs: number;
  lastPrice: number;
  totalProfit: number;
  totalBuys: number;
  totalSells: number;
};

export function ldGridBots(): GridBot[] {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(GRID_BOTS_KEY) : null;
    if (!s) return [];
    const r = JSON.parse(s);
    return Array.isArray(r) ? r as GridBot[] : [];
  } catch { return [] }
}

export function svGridBots(bs: GridBot[]) {
  try { localStorage.setItem(GRID_BOTS_KEY, JSON.stringify(bs.slice(0, 30))) } catch {}
}

export function makeGridBot(opts: {
  pair: PairId;
  lowPrice: number;
  highPrice: number;
  gridCount: number;
  amountUsdPerLevel: number;
  startPrice: number;
}): GridBot | null {
  if (opts.gridCount < 2) return null;
  if (opts.lowPrice >= opts.highPrice) return null;
  if (opts.amountUsdPerLevel <= 0) return null;
  const levels: GridLevel[] = [];
  for (let i = 0; i < opts.gridCount; i++) {
    const price = opts.lowPrice + (opts.highPrice - opts.lowPrice) * i / (opts.gridCount - 1);
    levels.push({ price, state: "empty", qty: 0 });
  }
  return {
    id: `grid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    pair: opts.pair,
    lowPrice: opts.lowPrice,
    highPrice: opts.highPrice,
    levels,
    amountUsdPerLevel: opts.amountUsdPerLevel,
    status: "active",
    createdTs: Date.now(),
    lastPrice: opts.startPrice,
    totalProfit: 0,
    totalBuys: 0,
    totalSells: 0,
  };
}

// Tick a grid bot: detect price-crossings, fill empty levels на падении,
// release filled levels на подъёме (+ realize profit).
// Returns updated bot + counts of new buys/sells (для AEV mint).
export function tickGridBot(
  bot: GridBot,
  currentPrice: number,
  now = Date.now(),
): { bot: GridBot; buys: number; sells: number } {
  if (bot.status !== "active") return { bot, buys: 0, sells: 0 };
  if (currentPrice <= 0) return { bot, buys: 0, sells: 0 };
  const prevPrice = bot.lastPrice;
  let totalProfit = bot.totalProfit;
  let totalBuys = bot.totalBuys;
  let totalSells = bot.totalSells;
  let newBuys = 0;
  let newSells = 0;
  const newLevels = bot.levels.map((lvl, i) => {
    if (lvl.state === "empty") {
      // Crossed DOWN через level → buy at currentPrice
      if (prevPrice > lvl.price && currentPrice <= lvl.price) {
        const qty = bot.amountUsdPerLevel / currentPrice;
        totalBuys += 1; newBuys += 1;
        return { ...lvl, state: "filled" as const, qty, filledAtPrice: currentPrice, filledTs: now };
      }
    } else if (lvl.state === "filled") {
      // Sell-trigger price = next higher rung (если есть) или +2% gap
      const sellTriggerPrice = i + 1 < bot.levels.length
        ? bot.levels[i + 1].price
        : lvl.price * 1.02;
      if (prevPrice < sellTriggerPrice && currentPrice >= sellTriggerPrice) {
        const buyPrice = lvl.filledAtPrice ?? lvl.price;
        const profit = lvl.qty * (sellTriggerPrice - buyPrice);
        totalProfit += profit;
        totalSells += 1; newSells += 1;
        return { price: lvl.price, state: "empty" as const, qty: 0 };
      }
    }
    return lvl;
  });
  return {
    bot: {
      ...bot,
      levels: newLevels,
      lastPrice: currentPrice,
      totalProfit,
      totalBuys,
      totalSells,
    },
    buys: newBuys,
    sells: newSells,
  };
}

// Inventory value at current price (для display)
export function gridInventoryValue(bot: GridBot, currentPrice: number): number {
  return bot.levels
    .filter((l) => l.state === "filled")
    .reduce((s, l) => s + l.qty * currentPrice, 0);
}

export function gridFilledCount(bot: GridBot): number {
  return bot.levels.filter((l) => l.state === "filled").length;
}
