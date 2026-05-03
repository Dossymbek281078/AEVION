// Portfolio analytics — pure functions over closed positions. No state, no side
// effects. Returns derived metrics (Sharpe-like, profit factor, R-multiples,
// streaks, calendar P&L, per-pair breakdown). Used by the QTrade Trade history
// section to make the journal actually useful instead of a flat list.

import type { ClosedPosition } from "./marketSim";

// ─── Core metrics ──────────────────────────────────────────────────
export type PortfolioStats = {
  total: number;
  wins: number;
  losses: number;
  flat: number;            // realizedPnl exactly 0 (rare)
  winrate: number;         // 0..100
  realizedSum: number;     // USD
  grossWin: number;        // sum of positive trades, USD
  grossLoss: number;       // |sum of negative trades|, USD
  profitFactor: number | null;
  avgWin: number;          // USD, mean of winning trades
  avgLoss: number;         // USD, mean of |losing| trades (positive number)
  expectancy: number;      // USD, winrate*avgWin - lossrate*avgLoss
  payoffRatio: number | null; // avgWin / avgLoss
  avgRPct: number;         // average %-return per trade (signed)
  stddevRPct: number;      // stdev of %-returns
  sharpeLike: number | null; // sqrt(N) × meanR / stdevR (annualization-free, per-trade)
  best: ClosedPosition | null;
  worst: ClosedPosition | null;
  longestWinStreak: number;
  longestLossStreak: number;
  currentStreak: { kind: "W" | "L" | "—"; len: number };
  avgHoldingMs: number;
  longHoldingMs: number;
  shortHoldingMs: number;
  longCount: number;
  shortCount: number;
  longPnl: number;
  shortPnl: number;
  // Equity curve
  equity: { ts: number; equity: number }[];
  peak: number;
  maxDrawdown: number;     // USD, positive number
  maxDrawdownPct: number;  // % of peak
};

export function computePortfolioStats(closed: ClosedPosition[]): PortfolioStats {
  const empty: PortfolioStats = {
    total: 0, wins: 0, losses: 0, flat: 0, winrate: 0,
    realizedSum: 0, grossWin: 0, grossLoss: 0, profitFactor: null,
    avgWin: 0, avgLoss: 0, expectancy: 0, payoffRatio: null,
    avgRPct: 0, stddevRPct: 0, sharpeLike: null,
    best: null, worst: null,
    longestWinStreak: 0, longestLossStreak: 0,
    currentStreak: { kind: "—", len: 0 },
    avgHoldingMs: 0, longHoldingMs: 0, shortHoldingMs: 0,
    longCount: 0, shortCount: 0, longPnl: 0, shortPnl: 0,
    equity: [], peak: 0, maxDrawdown: 0, maxDrawdownPct: 0,
  };
  if (closed.length === 0) return empty;

  const total = closed.length;
  const wins = closed.filter((c) => c.realizedPnl > 0).length;
  const losses = closed.filter((c) => c.realizedPnl < 0).length;
  const flat = total - wins - losses;
  const winrate = (wins / total) * 100;
  const realizedSum = closed.reduce((s, c) => s + c.realizedPnl, 0);
  const grossWin = closed.filter((c) => c.realizedPnl > 0).reduce((s, c) => s + c.realizedPnl, 0);
  const grossLoss = Math.abs(closed.filter((c) => c.realizedPnl < 0).reduce((s, c) => s + c.realizedPnl, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : null;
  const avgWin = wins > 0 ? grossWin / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;
  const lossrate = (losses / total) * 100;
  const expectancy = (winrate / 100) * avgWin - (lossrate / 100) * avgLoss;
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : null;

  // R-multiples in % space (uses realizedPct field, side-aware in buildClosed)
  const rs = closed.map((c) => c.realizedPct);
  const avgR = rs.reduce((s, x) => s + x, 0) / total;
  const variance = rs.reduce((s, x) => s + (x - avgR) * (x - avgR), 0) / total;
  const stdR = Math.sqrt(variance);
  const sharpeLike = stdR > 0 ? Math.sqrt(total) * avgR / stdR : null;

  // Best / worst
  const best = closed.reduce<ClosedPosition | null>((b, c) => (!b || c.realizedPnl > b.realizedPnl ? c : b), null);
  const worst = closed.reduce<ClosedPosition | null>((b, c) => (!b || c.realizedPnl < b.realizedPnl ? c : b), null);

  // Streaks (chronological — sort by exitTs ascending)
  const chrono = [...closed].sort((a, b) => a.exitTs - b.exitTs);
  let longestW = 0, longestL = 0, curW = 0, curL = 0;
  for (const c of chrono) {
    if (c.realizedPnl > 0) { curW++; curL = 0; longestW = Math.max(longestW, curW); }
    else if (c.realizedPnl < 0) { curL++; curW = 0; longestL = Math.max(longestL, curL); }
    else { curW = 0; curL = 0; }
  }
  // Current streak = walking back from most recent
  let currentStreak: PortfolioStats["currentStreak"] = { kind: "—", len: 0 };
  for (let i = chrono.length - 1; i >= 0; i--) {
    const c = chrono[i];
    if (i === chrono.length - 1) {
      if (c.realizedPnl > 0) currentStreak = { kind: "W", len: 1 };
      else if (c.realizedPnl < 0) currentStreak = { kind: "L", len: 1 };
      else { currentStreak = { kind: "—", len: 0 }; break; }
    } else {
      if (currentStreak.kind === "W" && c.realizedPnl > 0) currentStreak.len++;
      else if (currentStreak.kind === "L" && c.realizedPnl < 0) currentStreak.len++;
      else break;
    }
  }

  // Holding times
  const holdings = closed.map((c) => c.exitTs - c.entryTs);
  const avgHoldingMs = holdings.reduce((s, x) => s + x, 0) / total;
  const longTrades = closed.filter((c) => c.side === "long");
  const shortTrades = closed.filter((c) => c.side === "short");
  const longHoldingMs = longTrades.length > 0 ? longTrades.reduce((s, c) => s + (c.exitTs - c.entryTs), 0) / longTrades.length : 0;
  const shortHoldingMs = shortTrades.length > 0 ? shortTrades.reduce((s, c) => s + (c.exitTs - c.entryTs), 0) / shortTrades.length : 0;
  const longPnl = longTrades.reduce((s, c) => s + c.realizedPnl, 0);
  const shortPnl = shortTrades.reduce((s, c) => s + c.realizedPnl, 0);

  // Equity curve, drawdown
  let cum = 0;
  const equity = chrono.map((c) => { cum += c.realizedPnl; return { ts: c.exitTs, equity: cum } });
  let peak = 0, maxDD = 0;
  for (const pt of equity) {
    if (pt.equity > peak) peak = pt.equity;
    const dd = peak - pt.equity;
    if (dd > maxDD) maxDD = dd;
  }
  const maxDrawdownPct = peak > 0 ? (maxDD / peak) * 100 : 0;

  return {
    total, wins, losses, flat, winrate,
    realizedSum, grossWin, grossLoss, profitFactor,
    avgWin, avgLoss, expectancy, payoffRatio,
    avgRPct: avgR, stddevRPct: stdR, sharpeLike,
    best, worst,
    longestWinStreak: longestW, longestLossStreak: longestL, currentStreak,
    avgHoldingMs, longHoldingMs, shortHoldingMs,
    longCount: longTrades.length, shortCount: shortTrades.length,
    longPnl, shortPnl,
    equity, peak, maxDrawdown: maxDD, maxDrawdownPct,
  };
}

// ─── Per-pair breakdown ────────────────────────────────────────────
export type PairBreakdown = {
  pair: string;
  trades: number;
  wins: number;
  pnl: number;
  winrate: number;
  avgR: number;        // avg realizedPct
  bestPct: number;
  worstPct: number;
};

export function computePairBreakdown(closed: ClosedPosition[]): PairBreakdown[] {
  const byPair = new Map<string, ClosedPosition[]>();
  for (const c of closed) {
    const arr = byPair.get(c.pair) ?? [];
    arr.push(c);
    byPair.set(c.pair, arr);
  }
  const out: PairBreakdown[] = [];
  for (const [pair, list] of byPair.entries()) {
    const trades = list.length;
    const wins = list.filter((c) => c.realizedPnl > 0).length;
    const pnl = list.reduce((s, c) => s + c.realizedPnl, 0);
    const avgR = list.reduce((s, c) => s + c.realizedPct, 0) / trades;
    const bestPct = Math.max(...list.map((c) => c.realizedPct));
    const worstPct = Math.min(...list.map((c) => c.realizedPct));
    out.push({
      pair, trades, wins, pnl,
      winrate: (wins / trades) * 100,
      avgR, bestPct, worstPct,
    });
  }
  return out.sort((a, b) => b.pnl - a.pnl);
}

// ─── Calendar heatmap (last N days) ─────────────────────────────────
export type CalendarCell = {
  dayKey: string;        // YYYY-MM-DD
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
};

export function buildCalendar(closed: ClosedPosition[], days = 28): CalendarCell[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const startMs = start.getTime();
  // Build cell map for the window
  const cells: CalendarCell[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startMs + i * 86_400_000);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    cells.push({ dayKey, pnl: 0, trades: 0, wins: 0, losses: 0 });
  }
  const byKey = new Map<string, CalendarCell>(cells.map((c) => [c.dayKey, c]));
  for (const c of closed) {
    if (c.exitTs < startMs) continue;
    const d = new Date(c.exitTs);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cell = byKey.get(dayKey);
    if (!cell) continue;
    cell.pnl += c.realizedPnl;
    cell.trades += 1;
    if (c.realizedPnl > 0) cell.wins += 1;
    else if (c.realizedPnl < 0) cell.losses += 1;
  }
  return cells;
}

// ─── Format helpers ────────────────────────────────────────────────
export function fmtMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)}h`;
  return `${(ms / 86_400_000).toFixed(1)}d`;
}
