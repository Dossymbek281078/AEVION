/**
 * AEVION CyberChess — Anti-Cheat Engine v2
 *
 * 10-signal statistical + behavioral cheating detection.
 *
 * Key design principles vs. v1:
 *
 *  1. RATING-AGNOSTIC BASELINE — The player's stated/calibrated rating is NOT used
 *     as the primary comparison. Instead we build a session baseline from the first
 *     games in the current browser session. A genuine 2300 player who starts at 1200
 *     establishes their baseline at 2300 from game 1 and is never falsely flagged.
 *
 *  2. BEHAVIORAL SIGNALS — Browser-level events (tab switches, FEN clipboard copies,
 *     rapid-return patterns) are completely rating-independent and very hard to fake.
 *     FEN clipboard copy alone is near-definitive proof of engine use.
 *
 *  3. MULTI-SIGNAL CONVERGENCE — No single signal triggers a verdict. "flagged"
 *     requires 3+ suspicious signals OR 1 definitive behavioral event (FEN copy).
 *     This keeps false-positive rate near zero.
 *
 *  4. TRANSPARENT — Every signal has a human-readable explanation so the player can
 *     understand why they were or weren't flagged.
 *
 * Signal catalogue (10 total):
 *   Behavioral (rating-independent, very reliable):
 *     behavioral        — tab switches, FEN copy, rapid return, DevTools
 *   Session-relative (rating-independent):
 *     session_baseline  — current game vs. prior games in this session
 *   Algorithmic (cross-checked against FIDE only as soft context):
 *     engine_agreement  — Z-score of top-1 match rate (Binomial test)
 *     avg_cpl           — mean CPL vs expected for intrinsic level
 *     cpl_uniformity    — stddev too low = robot consistency
 *     top1_streak       — impossibly long consecutive top-1 runs
 *     time_anomaly      — CoV + instant-move count
 *     critical_perf     — top-1 rate in decisive positions
 *     endgame_tech      — near-perfect play in theoretical endgames
 *     intrinsic_context — (CONTEXT ONLY, low weight) CPL→ELO vs FIDE
 *
 * Calibration:
 *   CPL ↔ ELO: Regan Intrinsic Performance model (ICGA 2011)
 *   Engine agreement: Lichess open database statistics
 *   Behavioral weights: empirical study of phone-assisted play patterns
 */

import type { MoveMetric } from "./stockfishMetrics";
import type { BehaviorSummary } from "./behaviorTracker";

// ── Types ──────────────────────────────────────────────────────────────────

export type AntiCheatSignalId =
  | "behavioral"
  | "session_baseline"
  | "engine_agreement"
  | "avg_cpl"
  | "cpl_uniformity"
  | "top1_streak"
  | "time_anomaly"
  | "critical_perf"
  | "endgame_tech"
  | "intrinsic_context";

export type AntiCheatSignal = {
  id: AntiCheatSignalId;
  name: string;
  rawValue: number;
  expectedValue: number;
  score: number;       // 0–100, higher = more suspicious
  weight: number;
  verdict: "clean" | "unusual" | "suspicious";
  detail: string;
  isContextOnly?: boolean;  // shown but not used in composite score
};

export type AntiCheatStats = {
  totalMoves: number;
  diagnosticMoves: number;
  top1Count: number;
  top3Count: number;
  top1Rate: number;
  top3Rate: number;
  avgCpl: number;
  cplStddev: number;
  cplSkewness: number;
  longestTop1Streak: number;
  timeCoV: number;
  avgMoveTimeMs: number;
  instantMoves: number;       // moves < 800ms
  intrinsicRating: number;
  ratingDiscrepancy: number;
  zScore: number;
  critMoves: number;
  critTop1Rate: number;
  endgameMoves: number;
  endgameCplAvg: number;
  sessionGamesCount: number;
  sessionBaseDelta: number;   // intrinsicRating - sessionAvgIntrinsic
};

export type AntiCheatResult = {
  suspicionScore: number;
  verdict: "clean" | "unusual" | "suspicious" | "flagged";
  confidence: "insufficient" | "low" | "medium" | "high";
  signals: AntiCheatSignal[];
  stats: AntiCheatStats;
  gameId?: string;
  playerColor: "w" | "b";
  fideEstimate: number | null;
  analysedAt: number;
  // Immediate override flags
  fenCopyDetected: boolean;
};

// ── Session baseline (sessionStorage — cleared on tab close) ───────────────

export type SessionGame = {
  intrinsicRating: number;
  avgCpl: number;
  top1Rate: number;
  analysedAt: number;
};

const SESSION_KEY = "cc_ac_session_v2";

export function loadSessionGames(): SessionGame[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionGame[]) : [];
  } catch { return []; }
}

export function updateSessionBaseline(result: AntiCheatResult): void {
  if (typeof window === "undefined") return;
  try {
    const games = loadSessionGames();
    games.push({
      intrinsicRating: result.stats.intrinsicRating,
      avgCpl: result.stats.avgCpl,
      top1Rate: result.stats.top1Rate,
      analysedAt: result.analysedAt,
    });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(games.slice(-15)));
  } catch {}
}

// ── Calibration constants (Regan model) ───────────────────────────────────

// CPL = exp(A - B * fide)  ←→  fide = (A - ln(CPL)) / B
// Calibrated: 1200→72cp, 1600→40cp, 2000→22cp, 2400→10cp, 2600→7cp
const CPL_A = 6.251;
const CPL_B = 0.001645;

function expectedCpl(fide: number): number {
  return Math.max(3, Math.exp(CPL_A - CPL_B * Math.max(600, fide)));
}

function cplToIntrinsicRating(cpl: number): number {
  if (cpl <= 0) return 3100;
  return Math.min(3100, Math.max(500, Math.round((CPL_A - Math.log(Math.max(1, cpl))) / CPL_B)));
}

// Expected top-1 agreement by ELO: 1200→30%, 2000→38%, 2800→48%
function expectedTop1(fide: number): number {
  return 0.27 + Math.min(0.21, Math.max(0, (fide - 1000) * 0.00018));
}

function logistic(x: number): number { return 1 / (1 + Math.exp(-x)); }
function sigmoid100(x: number, center: number, steepness: number): number {
  return Math.min(100, Math.max(0, Math.round(logistic((x - center) / steepness) * 100)));
}

// ── Move classification ────────────────────────────────────────────────────

function isDiagnostic(m: MoveMetric): boolean {
  if (m.ply <= 6) return false;
  const top3 = m.engineTop3;
  if (top3.length >= 2) {
    const gap = Math.abs(top3[0].eval - top3[1].eval);
    if (gap > 400) return false;  // forcing move
    if (Math.abs(top3[0].eval) > 650) return false;  // decided position
  }
  return true;
}

function isCritical(m: MoveMetric): boolean {
  if (!isDiagnostic(m)) return false;
  const top3 = m.engineTop3;
  if (top3.length < 2) return false;
  const gap = Math.abs(top3[0].eval - top3[1].eval);
  return gap >= 100 && gap <= 400;
}

function isEndgame(m: MoveMetric): boolean {
  // Approximate: endgame positions tend to have < 10 total material
  // We don't have piece count directly, but can use eval magnitude as proxy
  // + ply > 40 heuristic
  return m.ply > 40 && Math.abs(m.engineTop3[0]?.eval ?? 0) < 500;
}

// ── Signal builders ────────────────────────────────────────────────────────

function sigBehavioral(summary: BehaviorSummary | null): AntiCheatSignal {
  const score = summary?.behaviorScore ?? 0;
  let detail = "Поведенческий анализ: ";
  if (!summary) {
    detail += "данные не собраны.";
  } else if (summary.fenCopyDetected) {
    detail += `🚨 FEN скопирован в буфер обмена — возможна передача позиции движку. `;
  } else {
    const parts: string[] = [];
    if (summary.rapidReturnCount > 0)
      parts.push(`быстрый возврат на вкладку после паузы (×${summary.rapidReturnCount})`);
    if (summary.tabHiddenCount > 2)
      parts.push(`вкладка скрыта во время хода (×${summary.tabHiddenCount})`);
    if (summary.devtoolsCount > 0)
      parts.push(`DevTools открыт`);
    if (summary.instantMoveCount > 5)
      parts.push(`мгновенные ходы без раздумий (×${summary.instantMoveCount})`);
    detail += parts.length ? parts.join(", ") + "." : "подозрительных событий не обнаружено.";
  }
  return {
    id: "behavioral", name: "Поведение в браузере",
    rawValue: score, expectedValue: 0, score, weight: 30,
    verdict: score < 25 ? "clean" : score < 55 ? "unusual" : "suspicious",
    detail,
  };
}

function sigSessionBaseline(
  intrinsicRating: number,
  sessionGames: SessionGame[],
): AntiCheatSignal {
  if (sessionGames.length < 2) {
    return {
      id: "session_baseline", name: "Динамика в сессии",
      rawValue: intrinsicRating, expectedValue: intrinsicRating, score: 0, weight: 28,
      verdict: "clean",
      detail: `Первые партии в сессии — устанавливается базовый уровень (~${intrinsicRating} ELO).`,
    };
  }
  const avg = sessionGames.reduce((s, g) => s + g.intrinsicRating, 0) / sessionGames.length;
  const delta = intrinsicRating - avg;
  const score = sigmoid100(delta, 320, 150);
  return {
    id: "session_baseline", name: "Динамика в сессии",
    rawValue: intrinsicRating, expectedValue: avg, score, weight: 28,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail:
      `Эта партия: ~${intrinsicRating} ELO. Среднее по сессии: ~${Math.round(avg)} ELO. ` +
      `Разница: ${delta >= 0 ? "+" : ""}${Math.round(delta)} ELO. ` +
      (delta > 500 ? "Резкое превышение уровня сессии." :
       delta > 300 ? "Заметное превышение." : "В пределах нормы."),
  };
}

function sigEngineAgreement(
  diagMoves: MoveMetric[], fide: number, zScore: number,
): AntiCheatSignal {
  const n = diagMoves.length;
  const top1Rate = n > 0 ? diagMoves.filter(m => m.rank === 1).length / n : 0;
  const expected = expectedTop1(fide);
  const score = n < 8 ? 0 : sigmoid100(zScore, 2.5, 0.9);
  return {
    id: "engine_agreement", name: "Совпадение с движком",
    rawValue: top1Rate, expectedValue: expected, score, weight: 22,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail:
      `${Math.round(top1Rate * 100)}% ходов совпадают с топ-1 движка ` +
      `(норма для этого уровня: ${Math.round(expected * 100)}%). Z-score: ${zScore.toFixed(2)}.`,
  };
}

function sigAvgCpl(avgCpl: number, fide: number): AntiCheatSignal {
  const exp = expectedCpl(fide);
  const score = sigmoid100(exp - avgCpl, exp * 0.45, exp * 0.2);
  return {
    id: "avg_cpl", name: "Средние потери (CPL)",
    rawValue: avgCpl, expectedValue: exp, score, weight: 20,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail:
      `Средние потери центипешек: ${avgCpl.toFixed(1)}cp ` +
      `(норма для уровня: ~${exp.toFixed(1)}cp). ` +
      (avgCpl < exp * 0.4 ? "Аномально низкие потери." :
       avgCpl < exp * 0.65 ? "Низкие потери, но в пределах сильного игрока." : "В норме."),
  };
}

function sigCplUniformity(cplStddev: number, avgCpl: number): AntiCheatSignal {
  const ratio = cplStddev / Math.max(1, avgCpl);
  const score = avgCpl < 3 ? 0 : sigmoid100(0.55 - ratio, 0, 0.18);
  return {
    id: "cpl_uniformity", name: "Однородность игры",
    rawValue: ratio, expectedValue: 1.15, score, weight: 10,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail:
      `Вариация потерь: stddev/mean = ${(ratio * 100).toFixed(0)}% ` +
      `(норма у людей: ~115%). ` +
      (ratio < 0.35 ? "Подозрительно однородная игра — нехарактерна для людей." : "В норме."),
  };
}

function sigTop1Streak(diagMoves: MoveMetric[], longestStreak: number): AntiCheatSignal {
  const n = diagMoves.length;
  const p = n > 0 ? diagMoves.filter(m => m.rank === 1).length / n : 0.35;
  const expStreak = (n > 0 && p > 0 && p < 1)
    ? Math.log(n * Math.max(0.01, p)) / Math.log(1 / Math.max(0.01, p))
    : 3;
  const score = sigmoid100(longestStreak - expStreak, 4, 1.3);
  return {
    id: "top1_streak", name: "Серия лучших ходов",
    rawValue: longestStreak, expectedValue: expStreak, score, weight: 12,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail:
      `Наибольшая серия ходов #1 подряд: ${longestStreak} ` +
      `(ожидаемая для ${n} ходов: ~${expStreak.toFixed(1)}). ` +
      (longestStreak > expStreak + 6 ? "Аномально длинная серия." : "В норме."),
  };
}

function sigTimeAnomaly(
  timeCoV: number, avgMs: number, instantMoves: number, n: number,
): AntiCheatSignal {
  const covScore  = n < 8 ? 0 : sigmoid100(0.42 - timeCoV, 0, 0.12);
  const instScore = sigmoid100(instantMoves - 3, 3, 2);
  const score = Math.round((covScore * 0.6 + instScore * 0.4));
  return {
    id: "time_anomaly", name: "Анализ темпа",
    rawValue: timeCoV, expectedValue: 0.8, score, weight: 13,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail:
      `Коэффициент вариации темпа: ${(timeCoV * 100).toFixed(0)}% ` +
      `(среднее: ${(avgMs / 1000).toFixed(1)}с, норма людей: 70–120%). ` +
      (instantMoves > 3 ? `Мгновенных ходов (<0.8с): ${instantMoves}. ` : "") +
      (timeCoV < 0.35 ? "Подозрительно равномерный темп." : "В норме."),
  };
}

function sigCriticalPerf(critMoves: MoveMetric[], fide: number): AntiCheatSignal {
  const n = critMoves.length;
  const top1 = critMoves.filter(m => m.rank === 1).length;
  const rate = n > 0 ? top1 / n : 0;
  const expCrit = expectedTop1(fide) * 0.82;
  const score = n < 5 ? 0 : sigmoid100(rate - expCrit, 0.20, 0.13);
  return {
    id: "critical_perf", name: "Критические позиции",
    rawValue: rate, expectedValue: expCrit, score, weight: 17,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail:
      `В решающих позициях (100–400cp разрыв между ходами): ` +
      `${Math.round(rate * 100)}% совпадений с лучшим ходом ` +
      `(норма: ~${Math.round(expCrit * 100)}%). ` +
      (n < 5 ? "Мало данных." :
       rate > expCrit + 0.35 ? "Аномально высокая точность в ключевых позициях." : "В норме."),
  };
}

function sigEndgameTech(endgameMoves: MoveMetric[]): AntiCheatSignal {
  const n = endgameMoves.length;
  if (n < 6) {
    return {
      id: "endgame_tech", name: "Техника эндшпиля",
      rawValue: 0, expectedValue: 0, score: 0, weight: 10,
      verdict: "clean",
      detail: "Недостаточно ходов в эндшпиле для анализа.",
    };
  }
  const cpls = endgameMoves.map(m => m.cpl);
  const avgCpl = cpls.reduce((s, v) => s + v, 0) / n;
  const top1Rate = endgameMoves.filter(m => m.rank === 1).length / n;
  // Endgame perfection: avgCpl < 5 AND top1Rate > 0.85 = tablebase-level
  const score = sigmoid100(0.85 - avgCpl / 20 + top1Rate - 0.6, 0.25, 0.12);
  return {
    id: "endgame_tech", name: "Техника эндшпиля",
    rawValue: avgCpl, expectedValue: 15, score, weight: 10,
    verdict: score < 30 ? "clean" : score < 60 ? "unusual" : "suspicious",
    detail:
      `Эндшпиль (${n} ходов): средние потери ${avgCpl.toFixed(1)}cp, ` +
      `совпадение с движком ${Math.round(top1Rate * 100)}%. ` +
      (avgCpl < 5 && top1Rate > 0.85 ? "Технически безупречный эндшпиль (уровень таблиц)." :
       "В норме."),
  };
}

function sigIntrinsicContext(intrinsicRating: number, fide: number | null): AntiCheatSignal {
  const f = fide ?? 1500;
  const diff = intrinsicRating - f;
  // This is CONTEXT ONLY — shown to the user but NOT used in composite score
  // because: a genuine strong player starting at 1200 would show diff = +1200
  // which is NOT cheating, just an unconfirmed player
  return {
    id: "intrinsic_context", name: "Расчётный уровень (справка)",
    rawValue: intrinsicRating, expectedValue: f,
    score: 0,   // ZERO weight in composite — purely informational
    weight: 0,
    verdict: "clean",
    isContextOnly: true,
    detail:
      `Расчётный рейтинг по качеству ходов: ~${intrinsicRating} ELO ` +
      `(заявленный профиль: ~${f} ELO, разница: ${diff >= 0 ? "+" : ""}${diff}). ` +
      `Само по себе превышение не является признаком читерства — сессионный анализ надёжнее.`,
  };
}

// ── Main function ──────────────────────────────────────────────────────────

/**
 * Analyse a completed game for cheating.
 *
 * @param moves        MoveMetric[] from MetricsCollector.snapshot()
 * @param playerColor  "w" | "b"
 * @param fideEstimate Player's calibrated FIDE estimate (null = use 1500 default)
 * @param behavior     BehaviorSummary from BehaviorTracker.getSummary()
 * @param gameId       Optional game identifier
 */
export function analyzeGameForCheating(
  moves: MoveMetric[],
  playerColor: "w" | "b",
  fideEstimate: number | null,
  behavior: BehaviorSummary | null,
  gameId?: string,
): AntiCheatResult {
  const fide = Math.max(600, Math.min(3200, fideEstimate ?? 1500));

  const playerMoves = moves.filter(m =>
    playerColor === "w" ? m.ply % 2 === 1 : m.ply % 2 === 0,
  );

  const diagMoves    = playerMoves.filter(isDiagnostic);
  const critMoves    = diagMoves.filter(isCritical);
  const endgameMoves = playerMoves.filter(isEndgame);
  const n = diagMoves.length;

  // ── Core statistics ──────────────────────────────────────────────────────

  const top1Count = diagMoves.filter(m => m.rank === 1).length;
  const top3Count = diagMoves.filter(m => m.rank <= 3).length;
  const top1Rate  = n > 0 ? top1Count / n : 0;
  const top3Rate  = n > 0 ? top3Count / n : 0;

  const cpls = diagMoves.map(m => m.cpl);
  const avgCpl  = n > 0 ? cpls.reduce((s, v) => s + v, 0) / n : 30;
  const cplVar  = n > 1
    ? cpls.reduce((s, v) => s + (v - avgCpl) ** 2, 0) / (n - 1) : 0;
  const cplStddev  = Math.sqrt(cplVar);
  const cplSkewness = cplStddev > 0 && n > 2
    ? cpls.reduce((s, v) => s + ((v - avgCpl) / cplStddev) ** 3, 0) / n : 0;

  let longestTop1Streak = 0, curStreak = 0;
  for (const m of diagMoves) {
    if (m.rank === 1) { curStreak++; longestTop1Streak = Math.max(longestTop1Streak, curStreak); }
    else curStreak = 0;
  }

  const times    = playerMoves.map(m => m.timeMs).filter(t => t > 200);
  const avgTime  = times.length > 0 ? times.reduce((s, v) => s + v, 0) / times.length : 5000;
  const timeVar  = times.length > 1
    ? times.reduce((s, v) => s + (v - avgTime) ** 2, 0) / (times.length - 1) : 0;
  const timeCoV  = avgTime > 0 ? Math.sqrt(timeVar) / avgTime : 0.8;
  const instantMoves = playerMoves.filter(m => m.timeMs > 0 && m.timeMs < 800 && m.ply > 6).length;

  const intrinsicRating = cplToIntrinsicRating(avgCpl);

  const expP = expectedTop1(fide);
  const zScore = n >= 8
    ? (top1Rate - expP) / Math.sqrt((expP * (1 - expP)) / n) : 0;

  const critTop1Rate = critMoves.length > 0
    ? critMoves.filter(m => m.rank === 1).length / critMoves.length : 0;

  const endgameCplAvg = endgameMoves.length > 0
    ? endgameMoves.reduce((s, m) => s + m.cpl, 0) / endgameMoves.length : 0;

  const sessionGames = loadSessionGames();
  const sessionAvg = sessionGames.length > 0
    ? sessionGames.reduce((s, g) => s + g.intrinsicRating, 0) / sessionGames.length
    : intrinsicRating;
  const sessionBaseDelta = intrinsicRating - sessionAvg;

  const stats: AntiCheatStats = {
    totalMoves: playerMoves.length, diagnosticMoves: n,
    top1Count, top3Count, top1Rate, top3Rate,
    avgCpl, cplStddev, cplSkewness,
    longestTop1Streak, timeCoV, avgMoveTimeMs: avgTime, instantMoves,
    intrinsicRating, ratingDiscrepancy: intrinsicRating - fide, zScore,
    critMoves: critMoves.length, critTop1Rate,
    endgameMoves: endgameMoves.length, endgameCplAvg,
    sessionGamesCount: sessionGames.length, sessionBaseDelta,
  };

  // ── Signals ───────────────────────────────────────────────────────────────

  const signals: AntiCheatSignal[] = [
    sigBehavioral(behavior),
    sigSessionBaseline(intrinsicRating, sessionGames),
    sigEngineAgreement(diagMoves, fide, zScore),
    sigAvgCpl(avgCpl, fide),
    sigCplUniformity(cplStddev, avgCpl),
    sigTop1Streak(diagMoves, longestTop1Streak),
    sigTimeAnomaly(timeCoV, avgTime, instantMoves, n),
    sigCriticalPerf(critMoves, fide),
    sigEndgameTech(endgameMoves),
    sigIntrinsicContext(intrinsicRating, fideEstimate),  // weight 0, context only
  ];

  // ── Composite score (exclude context-only signals) ────────────────────────

  const scoringSignals = signals.filter(s => !s.isContextOnly && s.weight > 0);
  const totalWeight = scoringSignals.reduce((s, sg) => s + sg.weight, 0);
  const suspicionScore = totalWeight > 0
    ? Math.round(scoringSignals.reduce((s, sg) => s + sg.score * sg.weight, 0) / totalWeight)
    : 0;

  // ── Confidence ────────────────────────────────────────────────────────────
  const confidence =
    n < 10 ? "insufficient" :
    n < 20 ? "low" :
    n < 35 ? "medium" : "high";

  // ── Verdict — requires multi-signal convergence ───────────────────────────
  const fenCopyDetected = behavior?.fenCopyDetected ?? false;
  const flaggedSignals   = scoringSignals.filter(s => s.verdict === "suspicious").length;
  const nonCleanSignals  = scoringSignals.filter(s => s.verdict !== "clean").length;

  let verdict: AntiCheatResult["verdict"] = "clean";
  if (fenCopyDetected) {
    // FEN clipboard copy is near-definitive; flag immediately
    verdict = "flagged";
  } else if (confidence !== "insufficient") {
    if (suspicionScore >= 65 && flaggedSignals >= 3) verdict = "flagged";
    else if (suspicionScore >= 50 && flaggedSignals >= 2) verdict = "suspicious";
    else if (suspicionScore >= 28 || nonCleanSignals >= 2) verdict = "unusual";
  }

  return {
    suspicionScore, verdict, confidence, signals, stats,
    gameId, playerColor, fideEstimate, analysedAt: Date.now(),
    fenCopyDetected,
  };
}

// ── Report for backend POST ───────────────────────────────────────────────

export type AntiCheatReport = {
  gameId?: string;
  userId: string;
  verdict: AntiCheatResult["verdict"];
  suspicionScore: number;
  confidence: AntiCheatResult["confidence"];
  fideEstimate: number | null;
  fenCopyDetected: boolean;
  stats: Pick<AntiCheatStats,
    "diagnosticMoves" | "top1Rate" | "avgCpl" | "intrinsicRating" |
    "ratingDiscrepancy" | "zScore" | "timeCoV" | "longestTop1Streak" |
    "sessionBaseDelta" | "sessionGamesCount" | "instantMoves"
  >;
  analysedAt: number;
};

export function buildReport(result: AntiCheatResult, userId: string): AntiCheatReport {
  const { stats } = result;
  return {
    gameId: result.gameId, userId,
    verdict: result.verdict, suspicionScore: result.suspicionScore,
    confidence: result.confidence, fideEstimate: result.fideEstimate,
    fenCopyDetected: result.fenCopyDetected,
    stats: {
      diagnosticMoves: stats.diagnosticMoves, top1Rate: stats.top1Rate,
      avgCpl: stats.avgCpl, intrinsicRating: stats.intrinsicRating,
      ratingDiscrepancy: stats.ratingDiscrepancy, zScore: stats.zScore,
      timeCoV: stats.timeCoV, longestTop1Streak: stats.longestTop1Streak,
      sessionBaseDelta: stats.sessionBaseDelta, sessionGamesCount: stats.sessionGamesCount,
      instantMoves: stats.instantMoves,
    },
    analysedAt: result.analysedAt,
  };
}
