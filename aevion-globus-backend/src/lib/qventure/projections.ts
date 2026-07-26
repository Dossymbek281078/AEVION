/**
 * QVenture — Revenue Projection Analysis (deterministic)
 * ──────────────────────────────────────────────────────
 * Takes a founder's multi-year revenue plan and checks the implied growth
 * against the bar a venture investor actually underwrites *at that stage* — the
 * "is this plan venture-scale, and is it evidenced?" test a diligence team runs
 * on the model tab. Pure arithmetic, no LLM.
 *
 * Why the stage bar and not the sector CAGR: the sector CAGR is how fast the
 * *market* grows (fintech ~16%/yr). A seed company that grows at market rate is
 * not "credible", it is dead — it never takes share and never returns a fund.
 * Comparing a startup plan to the market rate flagged every ordinary venture
 * plan as a hockey stick (a $4.8M→$17M Series A plan scored 3.7× "sector" and
 * came back HOCKEY STICK) while calling a market-rate plan "grounded". Both
 * verdicts were backwards.
 *
 * So the market CAGR is kept only as a floor — a plan growing slower than its
 * own market is losing share — and the verdict is set against stage growth
 * expectations (the T2D3 path: triple, triple, double, double, double, which is
 * how seed→A→B revenue is benchmarked by ICONIQ / Bessemer / SaaS Capital).
 */

import type { SectorProfile } from "./sectors";
import type { Stage } from "./engine";

export interface ProjectionPoint {
  year: number;
  revenueUsd: number;
}

export type ProjectionVerdict =
  /** No revenue in the first year — CAGR undefined, judge on absolute scale. */
  | "pre-revenue"
  /** Grows slower than the market itself — the plan loses share. */
  | "below-market"
  /** Beats the market but sits well under the stage's venture bar. */
  | "conservative"
  /** In the band a fund underwrites at this stage. */
  | "venture-grade"
  /** Materially above the bar — needs an evidenced growth engine. */
  | "aggressive"
  /** Far beyond anything observed at this stage — out-years are unproven. */
  | "hockey-stick";

export interface ProjectionAnalysis {
  points: ProjectionPoint[];
  years: number;
  startRevenueUsd: number;
  endRevenueUsd: number;
  multiple: number;
  impliedCagrPct: number | null;
  /** Market growth for the sector — the floor, not the benchmark. */
  sectorCagrPct: number;
  /** Revenue CAGR a venture investor underwrites at this stage. */
  stageBarCagrPct: number;
  /** impliedCagr ÷ stage bar (null when pre-revenue). */
  ratioToBar: number | null;
  verdict: ProjectionVerdict;
  note: string;
}

/**
 * Annual revenue CAGR a venture investor underwrites at each stage.
 *
 * Anchored to the T2D3 path used by growth-stage benchmarking (triple, triple,
 * double, double, double): ~200%/yr out of seed, decaying to ~60%/yr at scale.
 * These are expectations for the *plan*, not a prediction — a plan far under the
 * bar is honest but sub-venture; far over it is possible but must be evidenced.
 */
export const STAGE_GROWTH_BAR_PCT: Record<Stage, number> = {
  idea: 200,
  "pre-seed": 200,
  seed: 180,
  "series-a": 130,
  growth: 60,
};

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function fmt(n: number): string {
  if (n >= 1e9) return `$${round(n / 1e9)}B`;
  if (n >= 1e6) return `$${round(n / 1e6)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n)}`;
}

/** Analyze projected revenue points against the stage bar. Null if < 2 points. */
export function analyzeProjections(
  raw: ProjectionPoint[] | undefined,
  sector: SectorProfile,
  stage: Stage = "seed",
): ProjectionAnalysis | null {
  if (!raw || raw.length < 2) return null;
  const points = [...raw]
    .filter((p) => typeof p.year === "number" && typeof p.revenueUsd === "number" && isFinite(p.revenueUsd) && p.revenueUsd >= 0)
    .sort((a, b) => a.year - b.year);
  if (points.length < 2) return null;

  const start = points[0];
  const end = points[points.length - 1];
  const years = Math.max(1, end.year - start.year);
  const sectorCagrPct = round(sector.cagr * 100);
  const stageBarCagrPct = STAGE_GROWTH_BAR_PCT[stage] ?? STAGE_GROWTH_BAR_PCT.seed;
  const multiple = start.revenueUsd > 0 ? round(end.revenueUsd / start.revenueUsd, 1) : 0;

  if (start.revenueUsd <= 0) {
    return {
      points, years, startRevenueUsd: start.revenueUsd, endRevenueUsd: end.revenueUsd, multiple,
      impliedCagrPct: null, sectorCagrPct, stageBarCagrPct, ratioToBar: null, verdict: "pre-revenue",
      note: `Pre-revenue start — CAGR is undefined. Plan reaches ${fmt(end.revenueUsd)} by year ${end.year}; judge on absolute scale and assumptions, not growth rate.`,
    };
  }

  const impliedCagrPct = round((Math.pow(end.revenueUsd / start.revenueUsd, 1 / years) - 1) * 100);
  const ratioToBar = round(impliedCagrPct / stageBarCagrPct, 2);

  const verdict: ProjectionVerdict =
    impliedCagrPct < sectorCagrPct ? "below-market"
      : ratioToBar < 0.5 ? "conservative"
        : ratioToBar <= 1.5 ? "venture-grade"
          : ratioToBar <= 2 ? "aggressive"
            : "hockey-stick";

  const shape = `${impliedCagrPct}% revenue CAGR (${fmt(start.revenueUsd)}→${fmt(end.revenueUsd)}, ${multiple}× over ${years}yr)`;
  const bar = `the ~${stageBarCagrPct}%/yr a ${stage} deal is underwritten at`;

  const note =
    verdict === "below-market"
      ? `Projected ${shape} is below the ~${sectorCagrPct}% growth of the ${sector.label} market itself — the plan loses share as it executes, and is far under ${bar}. Sub-venture unless the model is deliberately conservative.`
      : verdict === "conservative"
        ? `Projected ${shape} beats the ~${sectorCagrPct}% market rate but reaches only ${ratioToBar}× ${bar} — credible, but check whether it clears a fund's return math.`
        : verdict === "venture-grade"
          ? `Projected ${shape} is ${ratioToBar}× ${bar} — a venture-scale plan in the band funds actually underwrite. Diligence the growth engine, not the arithmetic.`
          : verdict === "aggressive"
            ? `Projected ${shape} is ${ratioToBar}× ${bar} — aggressive; it needs a repeatable, already-visible growth engine to be underwritable.`
            : `Projected ${shape} is ${ratioToBar}× ${bar} — a hockey stick; treat the out-years as unproven until the growth mechanism is evidenced.`;

  return {
    points, years, startRevenueUsd: start.revenueUsd, endRevenueUsd: end.revenueUsd, multiple,
    impliedCagrPct, sectorCagrPct, stageBarCagrPct, ratioToBar, verdict, note,
  };
}
