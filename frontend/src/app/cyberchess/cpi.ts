// AEVION CyberChess — Chess Performance Index (CPI)
// Pure TypeScript module. No external dependencies.
// Spec: CYBERCHESS_CPI_SPEC.md (F3 phase).
//
// CPI начисляет баллы за КАЖДУЮ партию независимо от результата,
// на основе композитной оценки качества игры (eval-loss, time-mgmt,
// best-line match, mate-detection, brilliancies, hangs).

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type GameMetrics = {
  /** Per-move centipawn loss array (one entry per played move). */
  cplPerMove: number[];
  /** Per-move time spent in milliseconds (one per played move). */
  timeMsPerMove: number[];
  /** Total time control in ms (e.g. 600000 for 10+0). */
  totalTimeMs: number;
  /** Opening book hits: how many of first 10 moves matched TOP-10 of opening db. */
  openingBookHits: number;
  /** For each move, what rank in engine's multiPV (1, 2, 3, or 4+ for "off"). */
  movesByEngineRank: Array<1 | 2 | 3 | 4>;
  /** Mate-in-N opportunities + successes. */
  mateOpportunities: { m1: number; m2: number; m3: number };
  mateFound: { m1: number; m2: number; m3: number };
  /** Counts. */
  hangs: number;
  brilliancies: number;
  /** Result. */
  result: "w" | "l" | "d";
};

export type CPIWeights = {
  E: number;
  T: number;
  O: number;
  B1: number;
  B2: number;
  B3: number;
  M1: number;
  M2: number;
  M3: number;
  /** Penalty (will be subtracted). */
  H: number;
  Br: number;
  R_W: number;
  R_D: number;
  R_L: number;
};

export const DEFAULT_WEIGHTS: CPIWeights = {
  E: 30,
  T: 5,
  O: 10,
  B1: 20,
  B2: 5,
  B3: 2,
  M1: 8,
  M2: 15,
  M3: 20,
  H: 25,
  Br: 30,
  R_W: 10,
  R_D: 5,
  R_L: 0,
};

export type CPIBreakdown = {
  E: number;
  T: number;
  O: number;
  B1: number;
  B2: number;
  B3: number;
  M1: number;
  M2: number;
  M3: number;
  H: number;
  Br: number;
  R: number;
  total: number;
};

export type CPIState = {
  v: 1;
  cpi: number;
  history: Array<{
    date: string;
    delta: number;
    gameId?: string;
    breakdown: CPIBreakdown;
    result: "w" | "l" | "d";
  }>;
};

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mu = mean(xs);
  let acc = 0;
  for (const x of xs) {
    const d = x - mu;
    acc += d * d;
  }
  return Math.sqrt(acc / xs.length);
}

function countRank(ranks: Array<1 | 2 | 3 | 4>, target: 1 | 2 | 3 | 4): number {
  let n = 0;
  for (const r of ranks) if (r === target) n++;
  return n;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-scores (each returns a 0..1 value, except H/Br which are counts)
// ──────────────────────────────────────────────────────────────────────────

function E_score(m: GameMetrics): number {
  const avgCPL = mean(m.cplPerMove);
  return Math.max(0, 1 - avgCPL / 200);
}

function T_score(m: GameMetrics): number {
  const times = m.timeMsPerMove;
  if (times.length < 2) return 0.5;
  const avg = mean(times);
  const std = stddev(times);
  return Math.max(0, Math.min(1, 1 - std / (avg || 1)));
}

function O_score(m: GameMetrics): number {
  const denom = Math.min(10, Math.max(1, m.movesByEngineRank.length));
  return m.openingBookHits / denom;
}

function B_score(m: GameMetrics, rank: 1 | 2 | 3): number {
  const total = Math.max(1, m.movesByEngineRank.length);
  return countRank(m.movesByEngineRank, rank) / total;
}

function M_score(opps: number, found: number): number {
  return opps > 0 ? found / opps : 0;
}

function R_bonus(result: "w" | "l" | "d", w: CPIWeights): number {
  return result === "w" ? w.R_W : result === "d" ? w.R_D : w.R_L;
}

// ──────────────────────────────────────────────────────────────────────────
// Main formula
// ──────────────────────────────────────────────────────────────────────────

export function computeGameCPI(
  m: GameMetrics,
  w: CPIWeights = DEFAULT_WEIGHTS,
): CPIBreakdown {
  const E = w.E * E_score(m);
  const T = w.T * T_score(m);
  const O = w.O * O_score(m);
  const B1 = w.B1 * B_score(m, 1);
  const B2 = w.B2 * B_score(m, 2);
  const B3 = w.B3 * B_score(m, 3);
  const M1 = w.M1 * M_score(m.mateOpportunities.m1, m.mateFound.m1);
  const M2 = w.M2 * M_score(m.mateOpportunities.m2, m.mateFound.m2);
  const M3 = w.M3 * M_score(m.mateOpportunities.m3, m.mateFound.m3);
  const H = w.H * m.hangs; // subtracted below
  const Br = w.Br * m.brilliancies;
  const R = R_bonus(m.result, w);

  const total = E + T + O + B1 + B2 + B3 + M1 + M2 + M3 - H + Br + R;

  return {
    E: round2(E),
    T: round2(T),
    O: round2(O),
    B1: round2(B1),
    B2: round2(B2),
    B3: round2(B3),
    M1: round2(M1),
    M2: round2(M2),
    M3: round2(M3),
    H: round2(H),
    Br: round2(Br),
    R: round2(R),
    total: round2(total),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Persistence (localStorage)
// ──────────────────────────────────────────────────────────────────────────

const CPI_KEY = "aevion_cyberchess_cpi_v1";
const INITIAL_CPI = 1200;
const CPI_MIN = 0;
const CPI_MAX = 4000;

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function ldCPIState(): CPIState {
  const fresh: CPIState = { v: 1, cpi: INITIAL_CPI, history: [] };
  if (!hasStorage()) return fresh;
  try {
    const raw = window.localStorage.getItem(CPI_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Partial<CPIState>;
    if (parsed && parsed.v === 1 && typeof parsed.cpi === "number" && Array.isArray(parsed.history)) {
      return {
        v: 1,
        cpi: clamp(parsed.cpi, CPI_MIN, CPI_MAX),
        history: parsed.history,
      };
    }
    return fresh;
  } catch {
    return fresh;
  }
}

export function svCPIState(s: CPIState): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(CPI_KEY, JSON.stringify(s));
  } catch {
    // localStorage may be full or unavailable — silently noop
  }
}

export function applyGameToCPI(metrics: GameMetrics, gameId?: string): CPIState {
  const state = ldCPIState();
  const breakdown = computeGameCPI(metrics);
  const next: CPIState = {
    v: 1,
    cpi: clamp(state.cpi + breakdown.total, CPI_MIN, CPI_MAX),
    history: [
      ...state.history,
      {
        date: new Date().toISOString(),
        delta: breakdown.total,
        gameId,
        breakdown,
        result: metrics.result,
      },
    ],
  };
  svCPIState(next);
  return next;
}
