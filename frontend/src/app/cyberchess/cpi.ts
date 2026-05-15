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

// ──────────────────────────────────────────────────────────────────────────
// Dev tests — call __runTests() from console to verify formula
// ──────────────────────────────────────────────────────────────────────────

/**
 * Helper: build movesByEngineRank with n1 best, n2 second, n3 third, rest=4.
 */
function buildRanks(n1: number, n2: number, n3: number, total: number): Array<1 | 2 | 3 | 4> {
  const out: Array<1 | 2 | 3 | 4> = [];
  for (let i = 0; i < n1; i++) out.push(1);
  for (let i = 0; i < n2; i++) out.push(2);
  for (let i = 0; i < n3; i++) out.push(3);
  while (out.length < total) out.push(4);
  return out;
}

/**
 * Helper: build alternating times to drive T_score → 0
 * (so tests match raw spec example values without T contribution).
 */
function alternatingTimes(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i % 2 === 0 ? 0 : 1000);
  return out;
}

/** Helper: build constant CPL array averaging `avgCpl`. */
function constCpl(avg: number, n: number): number[] {
  return Array.from({ length: n }, () => avg);
}

export function __runTests(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const TOL = 5;

  // Test 1: L, CPL=25, B1=18/40, M1=2/2, M2=1/1, br=1, hangs=0 → expect ≈ +88
  const m1: GameMetrics = {
    cplPerMove: constCpl(25, 40),
    timeMsPerMove: alternatingTimes(40),
    totalTimeMs: 600000,
    openingBookHits: 0,
    movesByEngineRank: buildRanks(18, 0, 0, 40),
    mateOpportunities: { m1: 2, m2: 1, m3: 0 },
    mateFound: { m1: 2, m2: 1, m3: 0 },
    hangs: 0,
    brilliancies: 1,
    result: "l",
  };
  const r1 = computeGameCPI(m1).total;
  if (Math.abs(r1 - 88) > TOL) failures.push(`T1: expected ~88, got ${r1}`);

  // Test 2: W, CPL=80, B1=12/35, hangs=1, br=0 → expect ≈ +10
  const m2: GameMetrics = {
    cplPerMove: constCpl(80, 35),
    timeMsPerMove: alternatingTimes(35),
    totalTimeMs: 600000,
    openingBookHits: 0,
    movesByEngineRank: buildRanks(12, 0, 0, 35),
    mateOpportunities: { m1: 0, m2: 0, m3: 0 },
    mateFound: { m1: 0, m2: 0, m3: 0 },
    hangs: 1,
    brilliancies: 0,
    result: "w",
  };
  const r2 = computeGameCPI(m2).total;
  if (Math.abs(r2 - 10) > TOL) failures.push(`T2: expected ~10, got ${r2}`);

  // Test 3: D, CPL=8, B1=30/40, B2=6/40, hangs=0 → expect ≈ +50
  const m3: GameMetrics = {
    cplPerMove: constCpl(8, 40),
    timeMsPerMove: alternatingTimes(40),
    totalTimeMs: 600000,
    openingBookHits: 0,
    movesByEngineRank: buildRanks(30, 6, 0, 40),
    mateOpportunities: { m1: 0, m2: 0, m3: 0 },
    mateFound: { m1: 0, m2: 0, m3: 0 },
    hangs: 0,
    brilliancies: 0,
    result: "d",
  };
  const r3 = computeGameCPI(m3).total;
  if (Math.abs(r3 - 50) > TOL) failures.push(`T3: expected ~50, got ${r3}`);

  return { ok: failures.length === 0, failures };
}
