// Trading fees & slippage model — pro-trader realism for QTrade.
// Maker/Taker bps + bidirectional slippage. Defaults follow Binance USDM-style
// (maker 0.04%, taker 0.10%, slippage 0.05%). LocalStorage-backed config так,
// что юзер может настроить под свой брокерский профиль.

import type { PairId } from "./marketSim";

const FEES_KEY = "aevion_qtrade_fees_v1";

export type FeeMode = "maker" | "taker";

// AEV/USD promo: native pair даёт 0% maker fee — стимул использовать
// AEV liquidity. Применяется только когда global fees.enabled=true.
const PAIR_PROMOS: Partial<Record<PairId, Partial<Pick<FeeConfig, "makerBps" | "takerBps" | "slippageBps">>>> = {
  "AEV/USD": { makerBps: 0 },
};

export type PairFeeOverride = Partial<Pick<FeeConfig, "makerBps" | "takerBps" | "slippageBps">>;

export type FeeConfig = {
  enabled: boolean;
  makerBps: number;        // basis points (1 bps = 0.01%) для лимитных ордеров (passive fill)
  takerBps: number;        // bps для маркет ордеров (aggressive fill)
  slippageBps: number;     // bps от цены — entry/exit slip (sym., ухудшает цену)
  dailyLossLimitUsd?: number; // 0 / undefined = disabled. Опц. cap дневного убытка
  pairOverrides?: Partial<Record<PairId, PairFeeOverride>>; // user-defined per-pair overrides
};

export const DEFAULT_FEES: FeeConfig = {
  enabled: false,
  makerBps: 4,             // 0.04%
  takerBps: 10,            // 0.10%
  slippageBps: 5,          // 0.05%
  dailyLossLimitUsd: 0,    // 0 = no cap
};

const FEE_BOUNDS = { min: 0, max: 10_000 };  // 100% upper cap

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const PAIR_KEYS = ["AEV/USD", "BTC/USD", "ETH/USD", "SOL/USD"] as const;

function sanitizePairOverrides(raw: unknown): FeeConfig["pairOverrides"] {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const out: Partial<Record<PairId, PairFeeOverride>> = {};
  for (const pair of PAIR_KEYS) {
    const entry = r[pair];
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Partial<PairFeeOverride>;
    const sane: PairFeeOverride = {};
    if (Number.isFinite(e.makerBps)) sane.makerBps = clamp(Number(e.makerBps), FEE_BOUNDS.min, FEE_BOUNDS.max);
    if (Number.isFinite(e.takerBps)) sane.takerBps = clamp(Number(e.takerBps), FEE_BOUNDS.min, FEE_BOUNDS.max);
    if (Number.isFinite(e.slippageBps)) sane.slippageBps = clamp(Number(e.slippageBps), FEE_BOUNDS.min, FEE_BOUNDS.max);
    if (Object.keys(sane).length > 0) out[pair] = sane;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitize(raw: unknown): FeeConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FEES };
  const r = raw as Partial<FeeConfig>;
  const out: FeeConfig = {
    enabled: r.enabled === true,
    makerBps: Number.isFinite(r.makerBps) ? clamp(Number(r.makerBps), FEE_BOUNDS.min, FEE_BOUNDS.max) : DEFAULT_FEES.makerBps,
    takerBps: Number.isFinite(r.takerBps) ? clamp(Number(r.takerBps), FEE_BOUNDS.min, FEE_BOUNDS.max) : DEFAULT_FEES.takerBps,
    slippageBps: Number.isFinite(r.slippageBps) ? clamp(Number(r.slippageBps), FEE_BOUNDS.min, FEE_BOUNDS.max) : DEFAULT_FEES.slippageBps,
    dailyLossLimitUsd: Number.isFinite(r.dailyLossLimitUsd) ? Math.max(0, Number(r.dailyLossLimitUsd)) : 0,
  };
  const overrides = sanitizePairOverrides(r.pairOverrides);
  if (overrides) out.pairOverrides = overrides;
  return out;
}

export function ldFees(): FeeConfig {
  try {
    if (typeof window === "undefined") return { ...DEFAULT_FEES };
    const s = window.localStorage.getItem(FEES_KEY);
    if (!s) return { ...DEFAULT_FEES };
    return sanitize(JSON.parse(s));
  } catch {
    return { ...DEFAULT_FEES };
  }
}

export function svFees(cfg: FeeConfig): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FEES_KEY, JSON.stringify(sanitize(cfg)));
  } catch {/* localStorage quota / disabled */}
}

// Trade fee = notional × bps / 10_000.
// Returns absolute USD-cost (always ≥0).
export function tradeFee(notional: number, mode: FeeMode, cfg: FeeConfig = ldFees()): number {
  if (!cfg.enabled) return 0;
  if (!Number.isFinite(notional) || notional <= 0) return 0;
  const bps = mode === "maker" ? cfg.makerBps : cfg.takerBps;
  return (notional * bps) / 10_000;
}

// Slippage worsens execution price:
// - LONG entry (buy)   — pay higher: price × (1 + slip)
// - LONG exit (sell)   — receive lower: price × (1 - slip)
// - SHORT entry (sell) — receive lower: price × (1 - slip)
// - SHORT exit (buy)   — pay higher: price × (1 + slip)
// `direction` parameter folds these four cases into two:
// "worse-up" (pay-more) → +slip ; "worse-down" (receive-less) → -slip.
export type SlipDirection = "worse-up" | "worse-down";

export function slipPrice(price: number, direction: SlipDirection, cfg: FeeConfig = ldFees()): number {
  if (!cfg.enabled) return price;
  if (!Number.isFinite(price) || price <= 0) return price;
  const slip = cfg.slippageBps / 10_000;
  return direction === "worse-up" ? price * (1 + slip) : price * (1 - slip);
}

// Convenience: slip at *entry* of a position (long-buy = worse-up; short-sell = worse-down).
export function slipEntryPrice(price: number, side: "long" | "short", cfg: FeeConfig = ldFees()): number {
  return slipPrice(price, side === "long" ? "worse-up" : "worse-down", cfg);
}

// Convenience: slip at *exit* of a position (long-sell = worse-down; short-buy = worse-up).
export function slipExitPrice(price: number, side: "long" | "short", cfg: FeeConfig = ldFees()): number {
  return slipPrice(price, side === "long" ? "worse-down" : "worse-up", cfg);
}

// Total round-trip cost in USD = entry_fee + exit_fee. Notional uses the fill
// price (post-slippage). Used to deduct from realizedPnl на close.
export function roundTripFee(
  entryPrice: number,
  exitPrice: number,
  qty: number,
  entryMode: FeeMode,
  exitMode: FeeMode,
  cfg: FeeConfig = ldFees(),
): number {
  if (!cfg.enabled) return 0;
  return tradeFee(entryPrice * qty, entryMode, cfg) + tradeFee(exitPrice * qty, exitMode, cfg);
}

// Apply round-trip fees to a raw realized P&L (USD). Returns net pnl.
export function applyClosedFees(
  rawPnl: number,
  entryPrice: number,
  exitPrice: number,
  qty: number,
  entryMode: FeeMode,
  exitMode: FeeMode,
  cfg: FeeConfig = ldFees(),
): number {
  if (!cfg.enabled) return rawPnl;
  return rawPnl - roundTripFee(entryPrice, exitPrice, qty, entryMode, exitMode, cfg);
}

// One-shot close: returns slipped exit price + net pnl + net pct.
// `target` carries entry context. When fees disabled — exit/pnl identical
// to наивный (exitPrice − entryPrice) × qty × side-direction.
export type CloseInput = { entryPrice: number; side: "long" | "short"; qty: number };
export type CloseResult = { exitPrice: number; realizedPnl: number; realizedPct: number };

export function closeWithFees(
  target: CloseInput,
  rawExitPrice: number,
  cfg: FeeConfig = ldFees(),
  exitMode: FeeMode = "taker",
  entryMode: FeeMode = "taker",
): CloseResult {
  const exitPrice = slipExitPrice(rawExitPrice, target.side, cfg);
  const direction = target.side === "long" ? 1 : -1;
  const rawPnl = (exitPrice - target.entryPrice) * target.qty * direction;
  const netPnl = applyClosedFees(rawPnl, target.entryPrice, exitPrice, target.qty, entryMode, exitMode, cfg);
  const realizedPct = ((exitPrice - target.entryPrice) / target.entryPrice) * 100 * direction;
  return { exitPrice, realizedPnl: netPnl, realizedPct };
}

// Effective FeeConfig for a specific trading pair. Layers:
//   1. global cfg (makerBps/takerBps/slippageBps)
//   2. PAIR_PROMOS[pair] (system-level promo, e.g. AEV/USD 0% maker)
//   3. cfg.pairOverrides[pair] (user-defined per-pair tier — wins всё)
// When fees.enabled is false → returns config unchanged (no-op).
export function feesForPair(pair: PairId, cfg: FeeConfig = ldFees()): FeeConfig {
  if (!cfg.enabled) return cfg;
  const promo = PAIR_PROMOS[pair];
  const userOverride = cfg.pairOverrides?.[pair];
  if (!promo && !userOverride) return cfg;
  return { ...cfg, ...(promo ?? {}), ...(userOverride ?? {}) };
}

// Daily loss guard: returns sum of realized P&L for closes WHERE exitTs falls
// within today's local-day boundary. Negative numbers = loss accumulated.
export type DailyLossInput = { exitTs: number; realizedPnl: number };

export function todayRealizedPnl(closed: DailyLossInput[], now: number = Date.now()): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const startMs = start.getTime();
  const endMs = end.getTime();
  let sum = 0;
  for (const c of closed) {
    if (c.exitTs >= startMs && c.exitTs <= endMs && Number.isFinite(c.realizedPnl)) {
      sum += c.realizedPnl;
    }
  }
  return sum;
}

// True ⇒ today's loss already met or exceeded the configured cap.
export function dailyLossExceeded(
  closed: DailyLossInput[],
  cfg: FeeConfig = ldFees(),
  now: number = Date.now(),
): boolean {
  const cap = cfg.dailyLossLimitUsd ?? 0;
  if (!Number.isFinite(cap) || cap <= 0) return false;
  const today = todayRealizedPnl(closed, now);
  return today <= -cap;
}

export const __FEES_INTERNAL = { FEES_KEY, sanitize, FEE_BOUNDS };
