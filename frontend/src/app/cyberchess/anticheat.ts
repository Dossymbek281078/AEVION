/**
 * AEVION CyberChess — Anti-Cheat Engine
 *
 * World-class multi-signal statistical cheating detection based on:
 *  1. Engine rank agreement (Regan-inspired, complexity-weighted)
 *  2. CPL distribution analysis (mean + stddev + skewness)
 *  3. Intrinsic rating inference (CPL → ELO, compare to FIDE estimate)
 *  4. Consecutive top-1 streaks in non-trivial positions
 *  5. Time coefficient of variation (human vs. phone-assisted play)
 *  6. Critical position performance (large eval-swing moves)
 *  7. Statistical Z-score significance test (Binomial approximation)
 *
 * Key design principles:
 *  - No single signal triggers a flag; requires multi-signal convergence
 *  - All signals are calibrated against player's FIDE estimate (from ratingCalibration.ts)
 *    → eliminates false positives for genuinely strong players
 *  - Confidence scales with N (need 15+ diagnostic moves for meaningful result)
 *  - Transparent: every signal score is explainable
 *
 * Calibration sources:
 *  - CPL↔ELO: Kenneth Regan's Intrinsic Performance model (ICGA 2011+)
 *  - Engine agreement rates: Lichess open-source analysis statistics
 *  - Time CoV: empirical study of correspondence vs. OTB chess timing
 */

import type { MoveMetric } from "./stockfishMetrics";

// ── Types ──────────────────────────────────────────────────────────────────

export type AntiCheatSignalId =
  | "engine_agreement"
  | "avg_cpl"
  | "intrinsic_rating"
  | "top1_streak"
  | "time_cov"
  | "cpl_stddev"
  | "critical_perf";

export type AntiCheatSignal = {
  id: AntiCheatSignalId;
  name: string;
  rawValue: number;       // the measured value (e.g. 0.78 for 78% agreement)
  expectedValue: number;  // what we expect at player's FIDE
  score: number;          // 0–100, higher = more suspicious
  weight: number;         // importance in composite score
  verdict: "clean" | "unusual" | "suspicious";
  detail: string;         // human-readable explanation
};

export type AntiCheatStats = {
  totalMoves: number;
  diagnosticMoves: number;    // non-trivial, non-forced moves
  top1Count: number;
  top3Count: number;
  top1Rate: number;
  top3Rate: number;
  avgCpl: number;
  cplStddev: number;
  cplSkewness: number;
  longestTop1Streak: number;
  timeCoV: number;            // coefficient of variation of move times
  avgMoveTimeMs: number;
  intrinsicRating: number;    // inferred ELO from avgCPL (Regan model)
  ratingDiscrepancy: number;  // intrinsicRating − fideEstimate
  zScore: number;             // binomial z-score for engine agreement
  critMoves: number;          // moves in critical positions (large eval swing)
  critTop1Rate: number;       // top-1 rate in critical positions
};

export type AntiCheatResult = {
  suspicionScore: number;         // 0–100 weighted composite
  verdict: "clean" | "unusual" | "suspicious" | "flagged";
  confidence: "insufficient" | "low" | "medium" | "high";
  signals: AntiCheatSignal[];
  stats: AntiCheatStats;
  gameId?: string;
  playerColor: "w" | "b";
  fideEstimate: number | null;
  analysedAt: number;
};

// ── Calibration tables (Regan model + Lichess statistics) ─────────────────

// CPL = exp(A - B*fide) calibrated on Lichess database:
// 1200→72cp, 1600→40cp, 2000→22cp, 2400→10cp, 2600→7cp
const CPL_A = 6.251;
const CPL_B = 0.001645;

function expectedCplForRating(fide: number): number {
  return Math.max(3, Math.exp(CPL_A - CPL_B * fide));
}

// Inverse: given avgCPL, what ELO does this performance imply?
function intrinsicRatingFromCpl(avgCpl: number): number {
  if (avgCpl <= 0) return 3000;
  return Math.round((CPL_A - Math.log(Math.max(1, avgCpl))) / CPL_B);
}

// Expected top-1 engine agreement rate by ELO (Lichess statistics):
// 1200→30%, 1600→34%, 2000→38%, 2400→43%, 2800→48%
// Engine user → 85%+
function expectedTop1Rate(fide: number): number {
  return 0.27 + Math.min(0.21, Math.max(0, (fide - 1000) * 0.00018));
}

// Logistic function for signal scoring
function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// Map logistic output to 0–100
function sigmoid100(x: number, center: number, steepness: number): number {
  return Math.round(logistic((x - center) / steepness) * 100);
}

// ── Move filtering: diagnostic vs. trivial ─────────────────────────────────

/**
 * A move is "diagnostic" (informative for anti-cheat) when:
 *  - Position is not hopelessly won/lost (|bestEval| < 600cp) — trivial moves don't count
 *  - There WAS a meaningful best move (not totally random among equally good choices)
 *  - Not an opening trap (ply > 6 = move 4+)
 *
 * We approximate using cpl and engineTop3 data from MoveMetric.
 */
function isDiagnostic(m: MoveMetric): boolean {
  if (m.ply <= 6) return false; // skip opening theory
  // Forced/trivial position: if the only non-blunder path existed, it's not suspicious to play it
  // We detect via engineTop3: if top-3 are all within 30cp of each other → complex (multiple good moves)
  // If top-1 is 400+ cp better than top-2 → forcing (only one good move)
  const top3 = m.engineTop3;
  if (top3.length >= 2) {
    const best = top3[0].eval;
    const second = top3[1].eval;
    const gap = Math.abs(best - second);
    // If gap > 400cp, it's essentially a forced move — not diagnostic
    if (gap > 400) return false;
    // If position is hopelessly won/lost (best eval > 600cp in either direction)
    if (Math.abs(best) > 600) return false;
  }
  return true;
}

/**
 * A "critical" move: position where the eval swing is large (> 150cp drop if best not played)
 * These positions most reveal engine assistance.
 */
function isCritical(m: MoveMetric): boolean {
  if (!isDiagnostic(m)) return false;
  const top3 = m.engineTop3;
  if (top3.length < 2) return m.cpl >= 0 && m.engineTop3.length > 0;
  const best = top3[0].eval;
  const second = top3[1].eval;
  // Critical: there's a significant best move (100-400cp gap) — finding it matters
  const gap = Math.abs(best - second);
  return gap >= 100 && gap <= 400;
}

// ── Signal computations ────────────────────────────────────────────────────

function computeEngineAgreementSignal(
  diagnosticMoves: MoveMetric[],
  fide: number,
  zScore: number,
): AntiCheatSignal {
  const n = diagnosticMoves.length;
  const top1Count = diagnosticMoves.filter(m => m.rank === 1).length;
  const top1Rate = n > 0 ? top1Count / n : 0;
  const expected = expectedTop1Rate(fide);
  const weight = 30;
  // Z-score based scoring: threshold at z=2.5 (p≈0.006), steep curve
  const score = n < 5 ? 0 : sigmoid100(zScore, 2.5, 0.9);
  const diff = top1Rate - expected;
  const detail =
    `${Math.round(top1Rate * 100)}% совпадений с ходом #1 движка ` +
    `(ожидаемо для FIDE ${fide}: ${Math.round(expected * 100)}%, отклонение: ${diff >= 0 ? "+" : ""}${Math.round(diff * 100)}%). ` +
    `Z-score: ${zScore.toFixed(2)}`;
  return {
    id: "engine_agreement",
    name: "Совпадение с движком",
    rawValue: top1Rate,
    expectedValue: expected,
    score,
    weight,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail,
  };
}

function computeAvgCplSignal(avgCpl: number, fide: number): AntiCheatSignal {
  const expected = expectedCplForRating(fide);
  const weight = 25;
  // Suspicious when avgCPL is significantly below expected
  // Center: 50% at (expected*0.45), very steep at the boundary
  const score = sigmoid100(expected - avgCpl, expected * 0.45, expected * 0.2);
  const detail =
    `Средние потери центипешек: ${avgCpl.toFixed(1)}cp ` +
    `(ожидаемо для FIDE ${fide}: ${expected.toFixed(1)}cp). ` +
    (avgCpl < expected * 0.5 ? "Необычно низкие потери." : "В норме.");
  return {
    id: "avg_cpl",
    name: "Средние потери (CPL)",
    rawValue: avgCpl,
    expectedValue: expected,
    score,
    weight,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail,
  };
}

function computeIntrinsicRatingSignal(
  intrinsicRating: number,
  fide: number,
): AntiCheatSignal {
  const discrepancy = intrinsicRating - fide;
  const weight = 20;
  // Suspicious if intrinsic is 300+ ELO above stated/calibrated rating
  const score = sigmoid100(discrepancy, 300, 130);
  const detail =
    `Расчётный рейтинг по качеству ходов: ~${intrinsicRating} ELO. ` +
    `Заявленный рейтинг (FIDE-оценка): ~${fide}. ` +
    `Расхождение: ${discrepancy >= 0 ? "+" : ""}${discrepancy} ELO. ` +
    (discrepancy > 400 ? "Значительное превышение." : discrepancy > 200 ? "Умеренное превышение." : "В норме.");
  return {
    id: "intrinsic_rating",
    name: "Расчётный рейтинг",
    rawValue: intrinsicRating,
    expectedValue: fide,
    score,
    weight,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail,
  };
}

function computeStreakSignal(
  diagnosticMoves: MoveMetric[],
  longestStreak: number,
): AntiCheatSignal {
  const n = diagnosticMoves.length;
  const p = n > 0 ? diagnosticMoves.filter(m => m.rank === 1).length / n : 0.35;
  // Expected longest streak for N Bernoulli(p) trials: ≈ log(N*p) / log(1/p)
  const expectedStreak = n > 0 && p > 0 && p < 1
    ? Math.log(n * p) / Math.log(1 / p)
    : 3;
  const weight = 15;
  const score = sigmoid100(longestStreak - expectedStreak, 3.5, 1.2);
  const detail =
    `Наибольшая серия ходов #1 движка подряд: ${longestStreak}. ` +
    `Ожидаемая для ${n} ходов: ~${expectedStreak.toFixed(1)}. ` +
    (longestStreak > expectedStreak + 5 ? "Аномально длинная серия." : "В норме.");
  return {
    id: "top1_streak",
    name: "Серия лучших ходов",
    rawValue: longestStreak,
    expectedValue: expectedStreak,
    score,
    weight,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail,
  };
}

function computeTimeCoVSignal(times: number[], avgMs: number, coV: number): AntiCheatSignal {
  const weight = 15;
  // Humans: CoV typically 0.7–1.4. Phone-cheater: CoV < 0.4 (very uniform)
  // Score rises steeply below CoV = 0.4
  const score = times.length < 8 ? 0 : sigmoid100(0.42 - coV, 0, 0.12);
  const detail =
    `Коэффициент вариации времени ходов: ${(coV * 100).toFixed(0)}% ` +
    `(среднее: ${(avgMs / 1000).toFixed(1)}с). ` +
    (coV < 0.35 ? "Необычно равномерный темп — возможна внешняя помощь." :
     coV < 0.5 ? "Умеренно равномерный." : "Нормальная вариация.");
  return {
    id: "time_cov",
    name: "Анализ темпа игры",
    rawValue: coV,
    expectedValue: 0.8,
    score,
    weight,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail,
  };
}

function computeCplStddevSignal(cplStddev: number, avgCpl: number, fide: number): AntiCheatSignal {
  // Humans show high CPL variance: some great moves, some blunders
  // Engine-assisted: unnaturally uniform (stddev << mean)
  const expectedStddev = expectedCplForRating(fide) * 1.2; // humans vary ~120% of mean
  const normalizedRatio = cplStddev / Math.max(1, avgCpl);
  const weight = 10;
  // Suspicious when stddev is abnormally low relative to mean (robot uniformity)
  const score = avgCpl < 3 ? 0 : sigmoid100(0.6 - normalizedRatio, 0, 0.18);
  const detail =
    `Стандартное отклонение потерь: ${cplStddev.toFixed(1)}cp (среднее: ${avgCpl.toFixed(1)}cp). ` +
    `Отношение ${(normalizedRatio * 100).toFixed(0)}% ` +
    `(норма ~120%). ` +
    (normalizedRatio < 0.4 ? "Подозрительно однородная игра." : "В норме.");
  return {
    id: "cpl_stddev",
    name: "Однородность игры",
    rawValue: normalizedRatio,
    expectedValue: 1.2,
    score,
    weight,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail,
  };
}

function computeCriticalPerfSignal(
  critMoves: MoveMetric[],
  fide: number,
): AntiCheatSignal {
  const n = critMoves.length;
  const top1 = critMoves.filter(m => m.rank === 1).length;
  const critTop1Rate = n > 0 ? top1 / n : 0;
  // In critical positions, even strong players agree with engine less (harder positions)
  // Expected critical agreement ≈ 0.85 * normal expected rate (harder to find the ONE good move)
  const expectedCrit = expectedTop1Rate(fide) * 0.85;
  const weight = 20;
  const score = n < 4 ? 0 : sigmoid100(critTop1Rate - expectedCrit, 0.18, 0.12);
  const detail =
    `В критических позициях (ход решает исход) ${Math.round(critTop1Rate * 100)}% ` +
    `совпадений с лучшим ходом движка (ожидаемо: ${Math.round(expectedCrit * 100)}%). ` +
    (critTop1Rate > expectedCrit + 0.3 ? "Аномально высокая точность в решающих позициях." :
     n < 4 ? "Мало критических позиций для анализа." : "В норме.");
  return {
    id: "critical_perf",
    name: "Критические позиции",
    rawValue: critTop1Rate,
    expectedValue: expectedCrit,
    score,
    weight,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail,
  };
}

// ── Main analysis function ─────────────────────────────────────────────────

/**
 * Analyse a completed game for cheating.
 *
 * @param moves - Full MoveMetric[] from MetricsCollector.snapshot()
 * @param playerColor - "w" | "b"
 * @param fideEstimate - Player's FIDE-equivalent rating from ratingCalibration.ts; null = use default 1500
 * @param gameId - Optional game ID for the report
 */
export function analyzeGameForCheating(
  moves: MoveMetric[],
  playerColor: "w" | "b",
  fideEstimate: number | null,
  gameId?: string,
): AntiCheatResult {
  const fide = Math.max(600, Math.min(3200, fideEstimate ?? 1500));

  // Filter to player's own moves
  const playerMoves = moves.filter(m =>
    playerColor === "w" ? m.ply % 2 === 1 : m.ply % 2 === 0,
  );

  const diagMoves = playerMoves.filter(isDiagnostic);
  const critMoves = diagMoves.filter(isCritical);
  const n = diagMoves.length;

  // ── Core statistics ──────────────────────────────────────────────────────

  const top1Count = diagMoves.filter(m => m.rank === 1).length;
  const top3Count = diagMoves.filter(m => m.rank <= 3).length;
  const top1Rate = n > 0 ? top1Count / n : 0;
  const top3Rate = n > 0 ? top3Count / n : 0;

  const cpls = diagMoves.map(m => m.cpl);
  const avgCpl = n > 0 ? cpls.reduce((s, v) => s + v, 0) / n : 30;
  const cplVariance = n > 1
    ? cpls.reduce((s, v) => s + (v - avgCpl) ** 2, 0) / (n - 1)
    : 0;
  const cplStddev = Math.sqrt(cplVariance);
  // Skewness (Pearson's moment): positive = tail toward high CPL (blunders), negative = suspicious
  const cplSkewness = cplStddev > 0 && n > 2
    ? cpls.reduce((s, v) => s + ((v - avgCpl) / cplStddev) ** 3, 0) / n
    : 0;

  // Longest consecutive top-1 streak in diagnostic moves
  let longestTop1Streak = 0;
  let curStreak = 0;
  for (const m of diagMoves) {
    if (m.rank === 1) { curStreak++; longestTop1Streak = Math.max(longestTop1Streak, curStreak); }
    else curStreak = 0;
  }

  // Time CoV
  const times = playerMoves.map(m => m.timeMs).filter(t => t > 200); // ignore premoves < 200ms
  const avgTime = times.length > 0 ? times.reduce((s, v) => s + v, 0) / times.length : 5000;
  const timeVariance = times.length > 1
    ? times.reduce((s, v) => s + (v - avgTime) ** 2, 0) / (times.length - 1)
    : 0;
  const timeStddev = Math.sqrt(timeVariance);
  const timeCoV = avgTime > 0 ? timeStddev / avgTime : 0.8;

  // Intrinsic rating
  const intrinsicRating = intrinsicRatingFromCpl(avgCpl);
  const ratingDiscrepancy = intrinsicRating - fide;

  // Statistical Z-score (binomial test, one-tailed)
  const expectedP = expectedTop1Rate(fide);
  const zScore = n >= 5
    ? (top1Rate - expectedP) / Math.sqrt((expectedP * (1 - expectedP)) / n)
    : 0;

  const critTop1Rate = critMoves.length > 0
    ? critMoves.filter(m => m.rank === 1).length / critMoves.length
    : 0;

  const stats: AntiCheatStats = {
    totalMoves: playerMoves.length,
    diagnosticMoves: n,
    top1Count,
    top3Count,
    top1Rate,
    top3Rate,
    avgCpl,
    cplStddev,
    cplSkewness,
    longestTop1Streak,
    timeCoV,
    avgMoveTimeMs: avgTime,
    intrinsicRating,
    ratingDiscrepancy,
    zScore,
    critMoves: critMoves.length,
    critTop1Rate,
  };

  // ── Build signals ─────────────────────────────────────────────────────────

  const signals: AntiCheatSignal[] = [
    computeEngineAgreementSignal(diagMoves, fide, zScore),
    computeAvgCplSignal(avgCpl, fide),
    computeIntrinsicRatingSignal(intrinsicRating, fide),
    computeStreakSignal(diagMoves, longestTop1Streak),
    computeTimeCoVSignal(times, avgTime, timeCoV),
    computeCplStddevSignal(cplStddev, avgCpl, fide),
    computeCriticalPerfSignal(critMoves, fide),
  ];

  // ── Composite score (weighted average) ───────────────────────────────────

  const totalWeight = signals.reduce((s, sg) => s + sg.weight, 0);
  const suspicionScore = Math.round(
    signals.reduce((s, sg) => s + sg.score * sg.weight, 0) / totalWeight,
  );

  // ── Confidence ───────────────────────────────────────────────────────────

  const confidence =
    n < 10 ? "insufficient" :
    n < 20 ? "low" :
    n < 35 ? "medium" : "high";

  // ── Verdict ──────────────────────────────────────────────────────────────
  // Requires convergence of multiple signals — single signal can't flag
  const flaggedCount = signals.filter(sg => sg.verdict === "suspicious").length;
  const suspiciousCount = signals.filter(sg => sg.verdict !== "clean").length;

  let verdict: AntiCheatResult["verdict"] = "clean";
  if (confidence !== "insufficient") {
    if (suspicionScore >= 68 && flaggedCount >= 3) verdict = "flagged";
    else if (suspicionScore >= 50 && flaggedCount >= 2) verdict = "suspicious";
    else if (suspicionScore >= 30 || suspiciousCount >= 2) verdict = "unusual";
  }

  return {
    suspicionScore,
    verdict,
    confidence,
    signals,
    stats,
    gameId,
    playerColor,
    fideEstimate: fideEstimate,
    analysedAt: Date.now(),
  };
}

// ── Serializable summary for backend POST ──────────────────────────────────

export type AntiCheatReport = {
  gameId?: string;
  userId: string;
  verdict: AntiCheatResult["verdict"];
  suspicionScore: number;
  confidence: AntiCheatResult["confidence"];
  fideEstimate: number | null;
  stats: Pick<AntiCheatStats,
    "diagnosticMoves" | "top1Rate" | "avgCpl" | "intrinsicRating" |
    "ratingDiscrepancy" | "zScore" | "timeCoV" | "longestTop1Streak"
  >;
  analysedAt: number;
};

export function buildReport(
  result: AntiCheatResult,
  userId: string,
): AntiCheatReport {
  const { stats } = result;
  return {
    gameId: result.gameId,
    userId,
    verdict: result.verdict,
    suspicionScore: result.suspicionScore,
    confidence: result.confidence,
    fideEstimate: result.fideEstimate,
    stats: {
      diagnosticMoves: stats.diagnosticMoves,
      top1Rate: stats.top1Rate,
      avgCpl: stats.avgCpl,
      intrinsicRating: stats.intrinsicRating,
      ratingDiscrepancy: stats.ratingDiscrepancy,
      zScore: stats.zScore,
      timeCoV: stats.timeCoV,
      longestTop1Streak: stats.longestTop1Streak,
    },
    analysedAt: result.analysedAt,
  };
}
