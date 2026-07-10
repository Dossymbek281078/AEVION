/**
 * QVenture — Benchmark signal (proprietary, network-effect)
 * ─────────────────────────────────────────────────────────
 * Every analysis QVenture runs is persisted. This module turns that growing
 * corpus into a proprietary signal no public-data tool has: where does *this*
 * deal's score rank against every comparable deal QVenture has already scored?
 *
 *   "67/100 — 82nd percentile of 47 seed healthtech deals analyzed on QVenture."
 *
 * The more the product is used, the sharper the benchmark — a compounding moat.
 *
 * Honesty rules (per project objectivity principle):
 *   • We never fabricate a distribution. If a slice has too few real samples we
 *     fall back to a broader slice, and if even the global corpus is too thin we
 *     return mode:"insufficient" and say exactly how many more are needed.
 *   • Every result states its sample size and basis in plain language.
 */

/** One real, stored analysis reduced to what the benchmark needs. */
export interface BenchmarkSample {
  composite: number;
  stage: string;
  sector: string; // sector id (matches SectorProfile.id)
}

export type BenchmarkBasis = "sector_stage" | "sector" | "global";

export interface BenchmarkBucket {
  label: string;        // e.g. "60–80"
  count: number;
  containsScore: boolean;
}

export interface BenchmarkResult {
  mode: "ok" | "insufficient";
  basis: BenchmarkBasis | null;
  basisLabel: string;   // human phrase, e.g. "seed healthtech deals"
  count: number;        // samples in the chosen basis
  totalCount: number;   // total analyses in the corpus (context)
  score: number;
  percentile: number | null; // 0..100 — "scores higher than X% of {basisLabel}"
  median: number | null;
  p25: number | null;
  p75: number | null;
  best: number | null;
  buckets: BenchmarkBucket[];
  needed: number;       // more samples until a benchmark unlocks (0 when ok)
  disclaimer: string;
}

/** Minimum real samples before a slice is trustworthy enough to report. */
export const MIN_SAMPLE = 8;

function clampScore(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Linear-interpolation quantile over an ascending-sorted array. */
function quantile(sortedAsc: number[], q: number): number | null {
  const n = sortedAsc.length;
  if (n === 0) return null;
  if (n === 1) return sortedAsc[0];
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  const frac = pos - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

/** Percentile rank of `score` within `values` (mid-rank for ties). */
function percentileRank(values: number[], score: number): number {
  const n = values.length;
  if (n === 0) return 0;
  let below = 0;
  let equal = 0;
  for (const v of values) {
    if (v < score) below++;
    else if (v === score) equal++;
  }
  return Math.round(((below + equal * 0.5) / n) * 100);
}

function makeBuckets(values: number[], score: number): BenchmarkBucket[] {
  const edges = [0, 20, 40, 60, 80, 100];
  const buckets: BenchmarkBucket[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    const isLast = i === edges.length - 2;
    const count = values.filter((v) => v >= lo && (isLast ? v <= hi : v < hi)).length;
    const containsScore = score >= lo && (isLast ? score <= hi : score < hi);
    buckets.push({ label: `${lo}–${hi}`, count, containsScore });
  }
  return buckets;
}

/**
 * Build a benchmark for `score` in the given sector/stage from the real corpus.
 * Picks the most specific slice that has at least MIN_SAMPLE real analyses,
 * falling back sector → global, and reports honestly if nothing qualifies.
 */
export function computeBenchmark(
  samples: BenchmarkSample[],
  score: number,
  sectorId: string,
  sectorLabel: string,
  stage: string,
): BenchmarkResult {
  const s = clampScore(score);
  const totalCount = samples.length;

  const sectorArr = samples.filter((x) => x.sector === sectorId);
  const sectorStageArr = sectorArr.filter((x) => x.stage === stage);

  const candidates: Array<{ basis: BenchmarkBasis; label: string; values: number[] }> = [
    { basis: "sector_stage", label: `${stage} ${sectorLabel} deals`, values: sectorStageArr.map((x) => x.composite) },
    { basis: "sector", label: `${sectorLabel} deals`, values: sectorArr.map((x) => x.composite) },
    { basis: "global", label: `deals across all sectors`, values: samples.map((x) => x.composite) },
  ];

  const chosen = candidates.find((c) => c.values.length >= MIN_SAMPLE);

  if (!chosen) {
    return {
      mode: "insufficient",
      basis: null,
      basisLabel: `${sectorLabel} deals`,
      count: sectorArr.length,
      totalCount,
      score: s,
      percentile: null,
      median: null,
      p25: null,
      p75: null,
      best: null,
      buckets: [],
      needed: Math.max(1, MIN_SAMPLE - totalCount),
      disclaimer:
        `Not enough analyzed deals yet to benchmark this one — QVenture has ${totalCount} on record ` +
        `and needs at least ${MIN_SAMPLE}. This signal unlocks and sharpens as more deals are analyzed.`,
    };
  }

  const values = chosen.values;
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;

  return {
    mode: "ok",
    basis: chosen.basis,
    basisLabel: chosen.label,
    count: n,
    totalCount,
    score: s,
    percentile: percentileRank(values, s),
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    best: sorted[sorted.length - 1],
    buckets: makeBuckets(values, s),
    needed: 0,
    disclaimer:
      `Benchmarked against ${n} QVenture ${chosen.label}. This is a live network signal — ` +
      `it strengthens as more deals are analyzed.`,
  };
}
