/**
 * AEVION CyberChess — Calibrated FIDE estimation with loadable weights.
 *
 * Companion to `ratingCalibration.ts`. The existing `estimateFideFromCPI`
 * uses hardcoded weights. This module supports loading calibration
 * weights from `/calibration-weights.json` (produced by
 * `scripts/cyberchess-fide-calibrate.mjs`) and applying them via
 * `estimateFideFromCPIWithFit`.
 *
 * Loading is lazy + cached + graceful: if the file doesn't exist or
 * fetch fails, we fall back to hardcoded defaults silently. This means
 * the calibration is fully opt-in — copy the JSON into `public/` and
 * the runtime picks it up; otherwise behaviour is identical to before.
 */

import {
  type CPIMetrics,
  type FideEstimateResult,
  type FideFactorBreakdown,
  estimateFideFromCPI,
} from "./ratingCalibration";

/* ────────────────────────────────────────────────────────────────────
 *  Types
 * ──────────────────────────────────────────────────────────────────── */

export type CalibrationWeights = {
  schemaVersion: number;
  generatedAt: string;
  sourceFile?: string;
  samples: number;
  coefficients: {
    accuracy: number;
    opening: number;
    tactical: number;
    endgame: number;
    blunder: number;
    time: number;
  };
  bias: number;
  fitStats?: {
    rmseElo: number;
    r2: number;
    meanTargetElo: number;
  };
  notes?: string[];
};

/* ────────────────────────────────────────────────────────────────────
 *  Hardcoded defaults — mirror what's in ratingCalibration.ts
 * ──────────────────────────────────────────────────────────────────── */

const DEFAULT_WEIGHTS: CalibrationWeights = {
  schemaVersion: 1,
  generatedAt: "1970-01-01T00:00:00.000Z",
  samples: 0,
  coefficients: {
    accuracy: 35,
    opening: 30,
    tactical: 250,
    endgame: 200,
    blunder: -500,
    time: -2,
  },
  bias: 1200,
};

const ACCURACY_BASELINE = 60;
const OPTIMAL_MOVE_TIME = 30;

/* ────────────────────────────────────────────────────────────────────
 *  Lazy loader (browser fetch + in-memory cache)
 * ──────────────────────────────────────────────────────────────────── */

let cached: CalibrationWeights | null = null;
let cachedPromise: Promise<CalibrationWeights | null> | null = null;

/**
 * Load calibration weights from /calibration-weights.json.
 * Falls back to null if file missing/invalid — callers should use
 * DEFAULT_WEIGHTS or omit weights to use the original formula.
 *
 * Result is memoized for the lifetime of the page.
 */
export function loadCalibratedWeights(): Promise<CalibrationWeights | null> {
  if (cached !== null) return Promise.resolve(cached);
  if (cachedPromise !== null) return cachedPromise;

  // SSR safety: only fetch in the browser
  if (typeof fetch === "undefined" || typeof window === "undefined") {
    return Promise.resolve(null);
  }

  cachedPromise = fetch("/calibration-weights.json", { cache: "no-cache" })
    .then(async r => {
      if (!r.ok) return null;
      const data = (await r.json()) as CalibrationWeights;
      if (!validateWeights(data)) return null;
      cached = data;
      return data;
    })
    .catch(() => null)
    .finally(() => {
      // keep cachedPromise resolved; future calls will get cached value
    });

  return cachedPromise;
}

/**
 * Synchronous variant — returns cached weights if already loaded,
 * null otherwise. Use after a prior `loadCalibratedWeights()` await.
 */
export function getCachedCalibratedWeights(): CalibrationWeights | null {
  return cached;
}

/**
 * Resets the in-memory cache. Useful for tests or hot reload.
 */
export function resetCalibrationCache(): void {
  cached = null;
  cachedPromise = null;
}

function validateWeights(d: unknown): d is CalibrationWeights {
  if (!d || typeof d !== "object") return false;
  const w = d as Partial<CalibrationWeights>;
  if (typeof w.bias !== "number") return false;
  if (!w.coefficients || typeof w.coefficients !== "object") return false;
  const c = w.coefficients as Record<string, unknown>;
  const keys = ["accuracy", "opening", "tactical", "endgame", "blunder", "time"];
  for (const k of keys) {
    if (typeof c[k] !== "number" || !Number.isFinite(c[k] as number)) return false;
  }
  return true;
}

/* ────────────────────────────────────────────────────────────────────
 *  FIDE estimation with configurable weights
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Variant of estimateFideFromCPI that accepts a calibrated weight set.
 * If `weights` is null/undefined, delegates to the original
 * estimateFideFromCPI (hardcoded weights) for behavioural parity.
 *
 * Returns the same FideEstimateResult shape so it's a drop-in.
 */
export function estimateFideFromCPIWithFit(
  metrics: CPIMetrics,
  weights?: CalibrationWeights | null
): FideEstimateResult {
  // No weights → fall back to existing implementation
  if (!weights) return estimateFideFromCPI(metrics);

  const w = weights.coefficients;
  const bias = weights.bias;

  const accDelta = (metrics.accuracyPct - ACCURACY_BASELINE) * w.accuracy;
  const openingDelta = Math.min(10, metrics.openingTheoryDepth) * w.opening;
  const tacticalDelta = clamp01(metrics.tacticalEfficiency) * w.tactical;
  const endgameDelta = clamp01(metrics.endgameStrength) * w.endgame;
  const blunderDelta = clamp01(metrics.blunderRate) * w.blunder;
  const timeDelta = -Math.abs(metrics.avgMoveTime - OPTIMAL_MOVE_TIME) * Math.abs(w.time);

  const rawFide = bias + accDelta + openingDelta + tacticalDelta + endgameDelta + blunderDelta + timeDelta;
  const fide = Math.max(400, Math.min(3000, Math.round(rawFide)));

  const stddev = Math.max(50, 200 - Math.min(150, metrics.gamesPlayed * 1.5));

  const status = (val: number, mid: number, good: number, inverted = false): "good" | "mid" | "bad" => {
    if (inverted) {
      if (val <= good) return "good";
      if (val <= mid) return "mid";
      return "bad";
    }
    if (val >= good) return "good";
    if (val >= mid) return "mid";
    return "bad";
  };

  const factors: FideFactorBreakdown[] = [
    {
      key: "accuracy",
      label: "Точность игры",
      value: metrics.accuracyPct,
      unit: "%",
      deltaElo: Math.round(accDelta),
      target: 85,
      status: status(metrics.accuracyPct, 70, 85),
    },
    {
      key: "openingDepth",
      label: "Глубина теории дебюта",
      value: metrics.openingTheoryDepth,
      unit: "ply",
      deltaElo: Math.round(openingDelta),
      target: 8,
      status: status(metrics.openingTheoryDepth, 4, 8),
    },
    {
      key: "tactical",
      label: "Тактическая эффективность",
      value: Math.round(metrics.tacticalEfficiency * 100),
      unit: "%",
      deltaElo: Math.round(tacticalDelta),
      target: 80,
      status: status(metrics.tacticalEfficiency, 0.5, 0.8),
    },
    {
      key: "endgame",
      label: "Сила эндшпиля",
      value: Math.round(metrics.endgameStrength * 100),
      unit: "%",
      deltaElo: Math.round(endgameDelta),
      target: 75,
      status: status(metrics.endgameStrength, 0.5, 0.75),
    },
    {
      key: "blunders",
      label: "Грубые ошибки",
      value: Math.round(metrics.blunderRate * 100),
      unit: "%",
      deltaElo: Math.round(blunderDelta),
      target: 5,
      status: status(metrics.blunderRate, 0.15, 0.05, true),
    },
    {
      key: "timing",
      label: "Тайминг хода",
      value: Math.round(metrics.avgMoveTime),
      unit: "с",
      deltaElo: Math.round(timeDelta),
      target: 30,
      status:
        Math.abs(metrics.avgMoveTime - OPTIMAL_MOVE_TIME) < 10
          ? "good"
          : Math.abs(metrics.avgMoveTime - OPTIMAL_MOVE_TIME) < 25
          ? "mid"
          : "bad",
    },
  ];

  return {
    fide,
    low: Math.max(400, Math.round(fide - stddev)),
    high: Math.min(3000, Math.round(fide + stddev)),
    samples: metrics.gamesPlayed,
    factors,
  };
}

/**
 * Async one-shot: loads calibration (if available) and applies it.
 * Equivalent to estimateFideFromCPI when no weights file is deployed.
 */
export async function estimateFideFromCPIAsync(metrics: CPIMetrics): Promise<FideEstimateResult> {
  const weights = await loadCalibratedWeights();
  return estimateFideFromCPIWithFit(metrics, weights);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/* ────────────────────────────────────────────────────────────────────
 *  Export defaults for downstream tooling
 * ──────────────────────────────────────────────────────────────────── */

export { DEFAULT_WEIGHTS };
