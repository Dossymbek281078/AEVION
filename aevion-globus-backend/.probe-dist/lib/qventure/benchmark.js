"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_SAMPLE = void 0;
exports.computeBenchmark = computeBenchmark;
/** Minimum real samples before a slice is trustworthy enough to report. */
exports.MIN_SAMPLE = 8;
function clampScore(n) {
    if (!isFinite(n))
        return 0;
    return Math.max(0, Math.min(100, n));
}
/** Linear-interpolation quantile over an ascending-sorted array. */
function quantile(sortedAsc, q) {
    const n = sortedAsc.length;
    if (n === 0)
        return null;
    if (n === 1)
        return sortedAsc[0];
    const pos = (n - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi)
        return sortedAsc[lo];
    const frac = pos - lo;
    return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}
/** Percentile rank of `score` within `values` (mid-rank for ties). */
function percentileRank(values, score) {
    const n = values.length;
    if (n === 0)
        return 0;
    let below = 0;
    let equal = 0;
    for (const v of values) {
        if (v < score)
            below++;
        else if (v === score)
            equal++;
    }
    return Math.round(((below + equal * 0.5) / n) * 100);
}
function makeBuckets(values, score) {
    const edges = [0, 20, 40, 60, 80, 100];
    const buckets = [];
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
function computeBenchmark(samples, score, sectorId, sectorLabel, stage) {
    const s = clampScore(score);
    const totalCount = samples.length;
    const sectorArr = samples.filter((x) => x.sector === sectorId);
    const sectorStageArr = sectorArr.filter((x) => x.stage === stage);
    const candidates = [
        { basis: "sector_stage", label: `${stage} ${sectorLabel} deals`, values: sectorStageArr.map((x) => x.composite) },
        { basis: "sector", label: `${sectorLabel} deals`, values: sectorArr.map((x) => x.composite) },
        { basis: "global", label: `deals across all sectors`, values: samples.map((x) => x.composite) },
    ];
    const chosen = candidates.find((c) => c.values.length >= exports.MIN_SAMPLE);
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
            needed: Math.max(1, exports.MIN_SAMPLE - totalCount),
            disclaimer: `Not enough analyzed deals yet to benchmark this one — QVenture has ${totalCount} on record ` +
                `and needs at least ${exports.MIN_SAMPLE}. This signal unlocks and sharpens as more deals are analyzed.`,
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
        disclaimer: `Benchmarked against ${n} QVenture ${chosen.label}. This is a live network signal — ` +
            `it strengthens as more deals are analyzed.`,
    };
}
