// Trading fees & slippage model — pro-trader realism for QTrade.
// Maker/Taker bps + bidirectional slippage. Defaults follow Binance USDM-style
// (maker 0.04%, taker 0.10%, slippage 0.05%). LocalStorage-backed config так,
// что юзер может настроить под свой брокерский профиль.

const FEES_KEY = "aevion_qtrade_fees_v1";

export type FeeMode = "maker" | "taker";

export type FeeConfig = {
  enabled: boolean;
  makerBps: number;        // basis points (1 bps = 0.01%) для лимитных ордеров (passive fill)
  takerBps: number;        // bps для маркет ордеров (aggressive fill)
  slippageBps: number;     // bps от цены — entry/exit slip (sym., ухудшает цену)
};

export const DEFAULT_FEES: FeeConfig = {
  enabled: false,
  makerBps: 4,             // 0.04%
  takerBps: 10,            // 0.10%
  slippageBps: 5,          // 0.05%
};

const FEE_BOUNDS = { min: 0, max: 10_000 };  // 100% upper cap

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function sanitize(raw: unknown): FeeConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FEES };
  const r = raw as Partial<FeeConfig>;
  return {
    enabled: r.enabled === true,
    makerBps: Number.isFinite(r.makerBps) ? clamp(Number(r.makerBps), FEE_BOUNDS.min, FEE_BOUNDS.max) : DEFAULT_FEES.makerBps,
    takerBps: Number.isFinite(r.takerBps) ? clamp(Number(r.takerBps), FEE_BOUNDS.min, FEE_BOUNDS.max) : DEFAULT_FEES.takerBps,
    slippageBps: Number.isFinite(r.slippageBps) ? clamp(Number(r.slippageBps), FEE_BOUNDS.min, FEE_BOUNDS.max) : DEFAULT_FEES.slippageBps,
  };
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

export const __FEES_INTERNAL = { FEES_KEY, sanitize, FEE_BOUNDS };
