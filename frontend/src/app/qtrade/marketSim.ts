// Market Simulator — frontend-only price feed + position tracking for QTrade.
// Random walk with mean-reversion drift. State persists in localStorage so the
// market "keeps moving" between sessions (we backfill ticks since lastTs).

const POSITIONS_KEY = "aevion_qtrade_positions_v1";
const PAIRS_KEY = "aevion_qtrade_pairs_v1";

export type PairId = "AEV/USD" | "BTC/USD" | "ETH/USD" | "SOL/USD";

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
};

export type Position = {
  id: string;
  pair: PairId;
  side: "long" | "short";
  qty: number;
  entryPrice: number;
  entryTs: number;
};

export type Trade = {
  id: string;
  pair: PairId;
  side: "buy" | "sell";
  qty: number;
  price: number;
  ts: number;
  realizedPnl?: number;  // populated when closing
};

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
  return { ...p, prevPrice: p.price, price: next, history, lastTs: now, open24h, open24hTs };
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
