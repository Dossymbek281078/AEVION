/**
 * QVenture — Deterministic Scoring & Investment Engine
 * ────────────────────────────────────────────────────
 * A transparent, reproducible rubric that turns a structured business input
 * into (1) a weighted 0–100 composite score, (2) a verdict, and (3) a concrete
 * entry strategy: ticket sizing, tranche schedule, valuation band, and a
 * risk-adjusted return envelope.
 *
 * Philosophy: the *numbers* come from an explainable model grounded in the
 * sector knowledge base and US-market stage norms — never from an LLM. The LLM
 * layer (lenses.ts) adds qualitative narrative on top. Every factor is exposed
 * so an analyst can see exactly why the score is what it is.
 */

import { resolveSector, type SectorProfile, type MoatArchetype } from "./sectors";

export const STAGES = ["idea", "pre-seed", "seed", "series-a", "growth"] as const;
export type Stage = (typeof STAGES)[number];

export interface AnalysisInput {
  name: string;
  sector?: string;
  description: string;
  stage: Stage;
  geography?: string;
  askUsd?: number; // amount the company is raising
  tractionNotes?: string;
  url?: string;
  /** Analyst-declared moat, overrides sector default when provided. */
  claimedMoat?: MoatArchetype;
}

export interface ScoreFactor {
  key: string;
  label: string;
  weight: number; // 0–1, weights sum to 1
  score: number; // 0–100
  rationale: string;
}

export interface EntryStrategy {
  verdict: "invest" | "watch" | "pass";
  conviction: "high" | "medium" | "low";
  ticketUsd: { min: number; target: number; max: number };
  valuationBandUsd: { low: number; base: number; high: number };
  ownershipTargetPct: number;
  tranches: Array<{ label: string; pct: number; trigger: string }>;
  returns: {
    baseMoic: number; // gross money-on-money at base case
    lossProbability: number; // 0–1 empirical stage loss rate
    expectedMoic: number; // probability-weighted
    targetIrrPct: number;
    horizonYears: number;
  };
  portfolioNote: string;
  reasoning: string[];
}

export interface AnalysisResult {
  composite: number; // 0–100
  verdict: EntryStrategy["verdict"];
  factors: ScoreFactor[];
  sector: SectorProfile;
  stage: Stage;
  strategy: EntryStrategy;
  assumptions: string[];
}

// ── US-market stage norms (directional; 2024–2026 window) ──────────────────
// Pre-money valuation bands (USD), empirical loss rate (fraction of deals that
// return < 1x), and a base-case gross MOIC for a *successful* deal at that stage.
const STAGE_NORMS: Record<Stage, {
  preMoneyLow: number; preMoneyBase: number; preMoneyHigh: number;
  lossRate: number; successMoic: number; horizonYears: number; ownershipTarget: number;
}> = {
  "idea":     { preMoneyLow: 1_000_000,  preMoneyBase: 3_000_000,  preMoneyHigh: 6_000_000,  lossRate: 0.75, successMoic: 30, horizonYears: 9, ownershipTarget: 0.08 },
  "pre-seed": { preMoneyLow: 3_000_000,  preMoneyBase: 6_000_000,  preMoneyHigh: 12_000_000, lossRate: 0.70, successMoic: 22, horizonYears: 8, ownershipTarget: 0.08 },
  "seed":     { preMoneyLow: 8_000_000,  preMoneyBase: 15_000_000, preMoneyHigh: 30_000_000, lossRate: 0.60, successMoic: 15, horizonYears: 7, ownershipTarget: 0.10 },
  "series-a": { preMoneyLow: 25_000_000, preMoneyBase: 50_000_000, preMoneyHigh: 100_000_000, lossRate: 0.45, successMoic: 9,  horizonYears: 6, ownershipTarget: 0.12 },
  "growth":   { preMoneyLow: 100_000_000, preMoneyBase: 300_000_000, preMoneyHigh: 800_000_000, lossRate: 0.25, successMoic: 4, horizonYears: 4, ownershipTarget: 0.06 },
};

const MOAT_STRENGTH: Record<MoatArchetype, number> = {
  "network-effects": 90,
  "regulatory-license": 82,
  "data-scale": 78,
  "switching-costs": 74,
  "ip-patents": 80,
  "economies-of-scale": 68,
  "brand": 62,
  "none": 35,
};

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Heuristic "execution signal" from the presence/richness of traction text. */
function tractionSignal(input: AnalysisInput): { score: number; note: string } {
  const t = (input.tractionNotes || "").toLowerCase();
  if (!t.trim()) return { score: 38, note: "no traction disclosed — execution unproven" };
  let s = 50;
  const notes: string[] = [];
  if (/\b(revenue|arr|mrr|\$|paying|customers?)\b/.test(t)) { s += 18; notes.push("revenue/customers cited"); }
  if (/\b(growth|mom|wow|yoy|%|x\b|doubl|tripl)\b/.test(t)) { s += 12; notes.push("growth metric cited"); }
  if (/\b(retention|churn|nps|cohort|ltv|cac|payback)\b/.test(t)) { s += 12; notes.push("unit-economics metric cited"); }
  if (/\b(pilot|loi|partnership|contract|enterprise)\b/.test(t)) { s += 8; notes.push("commercial validation cited"); }
  if (t.length > 240) s += 4;
  return { score: clamp(s), note: notes.length ? notes.join("; ") : "qualitative traction only" };
}

/** Timing/tailwind proxy from sector growth vs. a neutral 12% baseline. */
function timingScore(sector: SectorProfile): number {
  return clamp(50 + (sector.cagr - 0.12) * 250);
}

export function analyze(rawInput: AnalysisInput): AnalysisResult {
  const sector = resolveSector(rawInput.sector);
  const stage = STAGES.includes(rawInput.stage) ? rawInput.stage : "seed";
  const norms = STAGE_NORMS[stage];
  const moat = rawInput.claimedMoat && MOAT_STRENGTH[rawInput.claimedMoat] !== undefined
    ? rawInput.claimedMoat
    : sector.primaryMoat;

  // ── Factor scores (each 0–100) ──────────────────────────────────────────
  const marketScore = clamp(35 + Math.log10(Math.max(1, sector.tamUsdBn)) * 12);
  const timing = timingScore(sector);
  const moatScore = MOAT_STRENGTH[moat];
  const econScore = clamp(sector.grossMargin * 100 * 0.7 + (1 - sector.capitalIntensity) * 30);
  const traction = tractionSignal(rawInput);
  const scienceScore = clamp(48 + (sector.cagr - 0.1) * 180 - (sector.capitalIntensity - 0.5) * 20);
  const legalScore = clamp(100 - sector.regulatoryIntensity * 65); // higher = less legal drag
  const competitionScore = clamp(100 - sector.competitiveIntensity * 70); // higher = less crowded

  const factors: ScoreFactor[] = [
    { key: "market", label: "Market size & growth", weight: 0.20, score: round(marketScore),
      rationale: `~$${sector.tamUsdBn}B TAM, ${round(sector.cagr * 100)}% CAGR (${sector.label}).` },
    { key: "timing", label: "Timing / tailwinds", weight: 0.10, score: round(timing),
      rationale: `Sector growth ${round(sector.cagr * 100)}% vs. 12% neutral baseline.` },
    { key: "moat", label: "Moat / defensibility", weight: 0.15, score: round(moatScore),
      rationale: `Dominant defensibility here: ${moat.replace(/-/g, " ")}.` },
    { key: "economics", label: "Unit economics potential", weight: 0.15, score: round(econScore),
      rationale: `~${round(sector.grossMargin * 100)}% mature gross margin, capital intensity ${round(sector.capitalIntensity * 100)}%.` },
    { key: "execution", label: "Team / execution signal", weight: 0.12, score: round(traction.score),
      rationale: traction.note },
    { key: "science", label: "Scientific / tech feasibility", weight: 0.10, score: round(scienceScore),
      rationale: sector.scienceFrontier },
    { key: "legal", label: "Regulatory / legal headroom", weight: 0.09, score: round(legalScore),
      rationale: `Regulatory intensity ${round(sector.regulatoryIntensity * 100)}% (higher = more legal drag).` },
    { key: "competition", label: "Competitive headroom", weight: 0.09, score: round(competitionScore),
      rationale: `Competitive intensity ${round(sector.competitiveIntensity * 100)}%. ${sector.structuralRisk}.` },
  ];

  const composite = round(factors.reduce((acc, f) => acc + f.weight * f.score, 0), 1);

  const strategy = buildStrategy({ composite, stage, norms, sector, input: rawInput });

  const citedSource = sector.sources[0];
  const assumptions = [
    citedSource
      ? `Market size / growth for ${sector.label} is anchored to ${citedSource.publisher} (${citedSource.year}): ${citedSource.claim}. Full citations are listed under "Market data sources".`
      : `Sector reference data (${sector.label}) is directional — override with primary diligence.`,
    `Stage norms reflect US-market ${stage} deals; adjust for geography "${rawInput.geography || "US"}".`,
    `Score is a screening signal, not a substitute for legal, financial, and technical due diligence.`,
  ];

  return { composite, verdict: strategy.verdict, factors, sector, stage, strategy, assumptions };
}

function buildStrategy(args: {
  composite: number; stage: Stage;
  norms: (typeof STAGE_NORMS)[Stage];
  sector: SectorProfile; input: AnalysisInput;
}): EntryStrategy {
  const { composite, stage, norms, sector, input } = args;

  const verdict: EntryStrategy["verdict"] = composite >= 72 ? "invest" : composite >= 55 ? "watch" : "pass";
  const conviction: EntryStrategy["conviction"] = composite >= 78 ? "high" : composite >= 62 ? "medium" : "low";

  // Valuation band: blend stage norm with score (stronger deals command up-band).
  const scoreMul = 0.7 + (composite / 100) * 0.6; // 0.7–1.3
  const valuationBandUsd = {
    low: round(norms.preMoneyLow * (0.85 + (composite / 100) * 0.3), 0),
    base: round(norms.preMoneyBase * scoreMul, 0),
    high: round(norms.preMoneyHigh * scoreMul, 0),
  };

  // Ownership target scales mildly with conviction.
  const ownershipTargetPct = round(
    norms.ownershipTarget * (conviction === "high" ? 1.25 : conviction === "medium" ? 1.0 : 0.6) * 100,
    1
  );

  // Ticket: ownership% of post-money (post ≈ pre + round). If ask unknown,
  // assume round ≈ 25% of pre-money (typical dilution).
  const roundSize = input.askUsd && input.askUsd > 0 ? input.askUsd : round(valuationBandUsd.base * 0.25, 0);
  const postMoney = valuationBandUsd.base + roundSize;
  const targetTicket = round((ownershipTargetPct / 100) * postMoney, 0);
  const ticketUsd = {
    min: round(targetTicket * 0.5, 0),
    target: targetTicket,
    max: round(Math.min(targetTicket * 1.6, roundSize * 0.5), 0), // don't lead >50% of a round
  };

  // Tranche schedule — sharper staging for weaker/earlier deals.
  const tranches = buildTranches(verdict, stage);

  // Risk-adjusted returns.
  const lossProbability = clamp01(norms.lossRate - (composite - 60) / 400); // stronger deals lose less often
  const baseMoic = round(norms.successMoic * scoreMul, 1);
  const expectedMoic = round(baseMoic * (1 - lossProbability) + 0.15 * lossProbability, 2); // survivors × p + salvage
  const targetIrrPct = round((Math.pow(Math.max(expectedMoic, 0.01), 1 / norms.horizonYears) - 1) * 100, 1);

  const returns = {
    baseMoic,
    lossProbability: round(lossProbability, 2),
    expectedMoic,
    targetIrrPct,
    horizonYears: norms.horizonYears,
  };

  // Position sizing — fractional-Kelly-lite, capped, scaled by conviction.
  const edge = clamp01((expectedMoic - 1) / 10);
  const kellyFraction = clamp01(edge * (conviction === "high" ? 0.5 : conviction === "medium" ? 0.35 : 0.2));
  const portfolioPct = round(clamp(kellyFraction * 10, 0.5, 6), 1); // % of a venture portfolio

  const portfolioNote = verdict === "pass"
    ? `Pass for now. If re-scored ≥55 after new traction, size at ~${portfolioPct}% of a diversified venture book — never single-name concentration at this stage.`
    : `Size at ~${portfolioPct}% of a diversified venture portfolio (fractional-Kelly, conviction-scaled). Reserve ${round(ticketUsd.target * 1.5, 0).toLocaleString("en-US")} USD for pro-rata follow-on.`;

  const reasoning = [
    `Composite ${composite}/100 → verdict "${verdict.toUpperCase()}" (${conviction} conviction).`,
    `Valuation anchor: ~$${(valuationBandUsd.base / 1e6).toFixed(1)}M pre-money base case for a ${stage} ${sector.label} deal.`,
    `Lead with $${targetTicket.toLocaleString("en-US")} for ~${ownershipTargetPct}% target ownership; cap exposure at $${ticketUsd.max.toLocaleString("en-US")}.`,
    `Base-case ${baseMoic}x on success; probability-weighted ${expectedMoic}x after a ${round(lossProbability * 100)}% loss rate → ~${targetIrrPct}% target IRR over ${norms.horizonYears}yr.`,
  ];

  return {
    verdict, conviction, ticketUsd, valuationBandUsd, ownershipTargetPct,
    tranches, returns, portfolioNote, reasoning,
  };
}

function buildTranches(verdict: EntryStrategy["verdict"], stage: Stage): EntryStrategy["tranches"] {
  const early = stage === "idea" || stage === "pre-seed" || stage === "seed";
  if (verdict === "pass") {
    return [
      { label: "Initial", pct: 0, trigger: "Do not deploy. Add to watchlist." },
      { label: "Re-entry", pct: 100, trigger: "Only after a materially improved re-score (≥55) with fresh evidence." },
    ];
  }
  if (early) {
    return [
      { label: "Entry", pct: 40, trigger: "On close, after founder + IP + cap-table diligence." },
      { label: "Milestone", pct: 35, trigger: "Product-market fit signal (retention cohort / first repeatable revenue)." },
      { label: "Pro-rata", pct: 25, trigger: "Reserve for next priced round to defend ownership." },
    ];
  }
  return [
    { label: "Entry", pct: 60, trigger: "On close, after commercial + legal + financial diligence." },
    { label: "Pro-rata", pct: 40, trigger: "Reserve to maintain ownership through the next round." },
  ];
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
