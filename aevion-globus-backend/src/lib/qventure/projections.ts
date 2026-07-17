/**
 * QVenture — Revenue Projection Analysis (deterministic)
 * ──────────────────────────────────────────────────────
 * Takes a founder's multi-year revenue plan and checks the implied growth
 * against the sector's real CAGR — the classic "is this a hockey stick?" test a
 * diligence team runs on the model tab. Pure arithmetic, no LLM.
 */

import type { SectorProfile } from "./sectors";

export interface ProjectionPoint {
  year: number;
  revenueUsd: number;
}

export interface ProjectionAnalysis {
  points: ProjectionPoint[];
  years: number;
  startRevenueUsd: number;
  endRevenueUsd: number;
  multiple: number;
  impliedCagrPct: number | null;
  sectorCagrPct: number;
  verdict: "grounded" | "aggressive" | "hockey-stick" | "pre-revenue";
  note: string;
}

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

/** Analyze projected revenue points against the sector CAGR. Null if < 2 points. */
export function analyzeProjections(raw: ProjectionPoint[] | undefined, sector: SectorProfile): ProjectionAnalysis | null {
  if (!raw || raw.length < 2) return null;
  const points = [...raw]
    .filter((p) => typeof p.year === "number" && typeof p.revenueUsd === "number" && isFinite(p.revenueUsd) && p.revenueUsd >= 0)
    .sort((a, b) => a.year - b.year);
  if (points.length < 2) return null;

  const start = points[0];
  const end = points[points.length - 1];
  const years = Math.max(1, end.year - start.year);
  const sectorCagrPct = round(sector.cagr * 100);
  const multiple = start.revenueUsd > 0 ? round(end.revenueUsd / start.revenueUsd, 1) : 0;

  if (start.revenueUsd <= 0) {
    return {
      points, years, startRevenueUsd: start.revenueUsd, endRevenueUsd: end.revenueUsd, multiple,
      impliedCagrPct: null, sectorCagrPct, verdict: "pre-revenue",
      note: `Pre-revenue start — CAGR is undefined. Plan reaches ${fmt(end.revenueUsd)} by year ${end.year}; judge on absolute scale and assumptions, not growth rate.`,
    };
  }

  const impliedCagrPct = round((Math.pow(end.revenueUsd / start.revenueUsd, 1 / years) - 1) * 100);
  const ratio = sector.cagr > 0 ? impliedCagrPct / 100 / sector.cagr : Infinity;

  const verdict: ProjectionAnalysis["verdict"] =
    ratio <= 1.5 ? "grounded" : ratio <= 3 ? "aggressive" : "hockey-stick";

  const note =
    verdict === "grounded"
      ? `Projected ${impliedCagrPct}% revenue CAGR (${fmt(start.revenueUsd)}→${fmt(end.revenueUsd)}, ${multiple}× over ${years}yr) is in line with the ~${sectorCagrPct}% sector — credible.`
      : verdict === "aggressive"
        ? `Projected ${impliedCagrPct}% CAGR (${multiple}× over ${years}yr) runs ${round(ratio, 1)}× the ~${sectorCagrPct}% sector rate — aggressive; needs a repeatable growth engine to justify.`
        : `Projected ${impliedCagrPct}% CAGR (${multiple}× over ${years}yr) is ${round(ratio, 1)}× the ~${sectorCagrPct}% sector rate — a hockey stick; treat the out-years as unproven until the growth mechanism is evidenced.`;

  return { points, years, startRevenueUsd: start.revenueUsd, endRevenueUsd: end.revenueUsd, multiple, impliedCagrPct, sectorCagrPct, verdict, note };
}
