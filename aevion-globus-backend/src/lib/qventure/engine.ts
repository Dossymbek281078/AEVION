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
import { parsePlanSignals, mergeStructuredSignals, type PlanSignals, type StructuredFinancials } from "./signals";
import { stressTest, type StressResult } from "./stress";
import { triangulateTam, type TamAnalysis } from "./tam";
import { analyzeProjections, type ProjectionPoint, type ProjectionAnalysis } from "./projections";

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
  /** Exact financials supplied directly — override the text parser (precise input). */
  financials?: StructuredFinancials;
  /** Multi-year revenue plan for the projection / hockey-stick check. */
  projections?: ProjectionPoint[];
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
  /** Quantitative signals parsed from THIS plan (drives company-specific scoring). */
  signals: PlanSignals;
  /** Fraction of the composite's weight backed by the company's own disclosed
   *  numbers rather than sector priors (0 = pure sector average, 1 = fully company-specific). */
  signalCoverage: number;
  /** Deterministic red flags: internal inconsistencies or weak metrics in the plan. */
  redFlags: string[];
  /** Financial stress test: unit economics flexed under CAC/churn/margin shocks. */
  stress: StressResult;
  /** Bottom-up TAM triangulation: claimed TAM vs derived ACV, implied accounts, penetration, SOM. */
  tam: TamAnalysis;
  /** Revenue projection check vs sector CAGR (null when < 2 projection points). */
  projections: ProjectionAnalysis | null;
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

// A sector's dominant moat archetype is a *category potential*, not a company
// fact: at seed, with no users, a "network-effects" business has no network yet,
// and a premium/proprietary product (Quibi, Juicero) is not defensible just
// because its category can be. So MOAT_STRENGTH is treated as the moat's *mature
// ceiling*, credited only in proportion to how far it is plausibly realized —
// from stage maturity, nudged by disclosed traction — with the remainder blended
// toward a "no demonstrated defensibility" floor. This stops the deterministic
// score from awarding a full 90 moat to an unproven pitch.
const MOAT_FLOOR = MOAT_STRENGTH.none; // 35 = unproven / no demonstrated moat

const STAGE_MOAT_REALIZATION: Record<Stage, number> = {
  "idea": 0.30,
  "pre-seed": 0.42,
  "seed": 0.55,
  "series-a": 0.75,
  "growth": 0.90,
};

/** Fraction of a moat archetype's mature ceiling a company has plausibly earned,
 *  from stage maturity ± disclosed traction evidence. */
function moatRealization(stage: Stage, tractionScore: number): number {
  const base = STAGE_MOAT_REALIZATION[stage];
  const tractionAdj = ((tractionScore - 50) / 50) * 0.2; // ±0.2 around a neutral 50
  return clamp01(base + tractionAdj);
}

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

/** Compact money formatter for rationale/flag text ($1.2M, $500k). */
function fmtMoney(n: number): string {
  if (n >= 1e9) return `$${round(n / 1e9, 1)}B`;
  if (n >= 1e6) return `$${round(n / 1e6, 1)}M`;
  if (n >= 1e3) return `$${round(n / 1e3)}k`;
  return `$${round(n)}`;
}

/** Execution score from the plan's *actual* disclosed metrics (revenue, growth,
 *  customers, retention). Returns null when no quantitative traction is parsed,
 *  so the caller falls back to the qualitative tractionSignal heuristic. */
function quantifiedExecution(sig: PlanSignals): { score: number; note: string } | null {
  if (sig.revenueUsd === null && sig.customers === null && sig.growthPct === null) return null;
  let s = 50;
  const notes: string[] = [];
  if (sig.revenueUsd !== null) {
    const r = sig.revenueUsd;
    s += r >= 10e6 ? 28 : r >= 1e6 ? 22 : r >= 1e5 ? 14 : 8;
    notes.push(`${fmtMoney(r)} ${sig.revenueBasis ?? "revenue"}`);
  }
  if (sig.growthPct !== null) {
    const g = sig.growthPct;
    const add = sig.growthPeriod === "MoM"
      ? (g >= 15 ? 14 : g >= 7 ? 9 : g >= 3 ? 4 : 1)
      : sig.growthPeriod === "YoY"
        ? (g >= 100 ? 12 : g >= 50 ? 8 : g >= 20 ? 3 : 1)
        : (g >= 50 ? 8 : g >= 20 ? 4 : 1);
    s += add;
    notes.push(`${g}% ${sig.growthPeriod ?? ""} growth`.replace(/\s+/g, " ").trim());
  }
  if (sig.customers !== null) {
    s += sig.customers >= 1000 ? 8 : sig.customers >= 100 ? 5 : sig.customers >= 10 ? 2 : 1;
    notes.push(`${sig.customers.toLocaleString("en-US")} customers`);
  }
  if (sig.retentionPct !== null) s += sig.retentionPct >= 120 ? 6 : sig.retentionPct >= 90 ? 3 : 0;
  if (sig.churnPct !== null && sig.churnPct > 5) { s -= 6; notes.push(`${sig.churnPct}% churn`); }
  return { score: clamp(s), note: `Quantified traction: ${notes.join("; ")}.` };
}

/** Factor keys an adverse disclosure can be charged against. */
type PenaltyFactor = "market" | "moat" | "economics" | "execution" | "legal" | "competition";

interface AdverseSignal {
  factor: PenaltyFactor;
  /** Points deducted from that factor's 0-100 score. */
  penalty: number;
  /** Investor-facing explanation of what was found and why it costs points. */
  flag: string;
}

/** Per-factor ceiling, so a single verbose plan cannot zero a factor out. */
const ADVERSE_CAP_PER_FACTOR = 40;

/**
 * Detect *explicit* adverse disclosures in the plan text.
 *
 * The rest of the engine only ever adds points: every factor starts at a sector
 * prior and moves up when the plan discloses something good. That made the
 * composite bottom out around ~59 ("watch") even for plainly dead deals, so the
 * verdict band "pass" (<55) was unreachable in practice. This charges stated
 * negatives against the specific factor they impair.
 *
 * Deliberately conservative: each pattern matches an unambiguous statement, so a
 * penalty is always defensible to a founder who asks why the score dropped.
 */
function detectAdverseDisclosures(text: string): AdverseSignal[] {
  const t = text.toLowerCase();
  const out: AdverseSignal[] = [];
  const add = (factor: PenaltyFactor, penalty: number, flag: string) => out.push({ factor, penalty, flag });

  // ── Execution: no revenue, shrinking revenue, team loss, cash exhaustion. ──
  if (/\b(no|zero|without any)\s+(revenue|sales|paying customers)\b|\bpre-?revenue\b/.test(t)) {
    add("execution", 18, "Plan states there is no revenue — commercial validation is absent, not merely undisclosed.");
  }
  if (/\b(declining|shrinking|falling|decreasing)\s+(revenue|sales|arr|mrr|users?)\b|\brevenue (fell|dropped|declined)\b/.test(t)) {
    add("execution", 16, "Plan discloses declining revenue — the business is contracting, not compounding.");
  }
  if (/\b(founders?|co-?founders?|cto|ceo)\b[^.]{0,60}\b(left|departed|quit|resigned|exited)\b|\b(lost|losing)\b[^.]{0,20}\bfounders?\b/.test(t)) {
    add("execution", 15, "Plan discloses founder or key-executive departure — a material team-continuity risk at this stage.");
  }
  if (/\b(runway|cash)\b[^.]{0,40}\b([0-5]\s*months?|out|depleted|exhausted)\b|\bout of (cash|money|runway)\b/.test(t)) {
    add("execution", 14, "Plan discloses six months or less of runway — the round is a rescue, which changes the terms materially.");
  }

  // ── Moat / competition: the defensibility claim is contradicted. ──────────
  if (/\b(incumbents?|competitors?|google|amazon|microsoft|shopify|salesforce|meta|apple)\b[^.]{0,70}\b(free|bundl\w*|included at no cost|ships? the same)\b/.test(t)) {
    add("competition", 20, "Plan concedes an incumbent offers equivalent functionality free or bundled — price and distribution advantage sit with the incumbent.");
    add("moat", 14, "A free incumbent substitute caps willingness to pay and undercuts the stated moat.");
  }
  if (/\b(commodit\w+|no (real )?(moat|differentiation|barrier)|easily (copied|replicated)|low barriers? to entry)\b/.test(t)) {
    add("moat", 16, "Plan concedes weak or absent defensibility — the moat factor cannot rest on the sector archetype alone.");
  }

  // ── Legal / IP: lapsed rights, active proceedings, lost permissions. ──────
  if (/\bpatents?\b[^.]{0,40}\b(lapsed|expired|invalidated|abandoned|rejected)\b|\b(lapsed|expired|invalidated)\b[^.]{0,20}\bpatents?\b/.test(t)) {
    add("legal", 16, "Plan discloses lapsed or invalidated patents — claimed IP protection is not enforceable.");
    add("moat", 12, "Lapsed IP removes the legal basis of an IP-patents moat.");
  }
  if (/\b(lawsuit|litigation|sued|being sued|injunction|cease and desist|class action)\b/.test(t)) {
    add("legal", 14, "Plan discloses active litigation — quantify exposure and legal spend before committing capital.");
  }
  if (/\b(licen[cs]e|authorization|approval)\b[^.]{0,40}\b(revoked|denied|withdrawn|suspended)\b|\b(regulatory|government)\b[^.]{0,30}\b(investigation|ban|banned|enforcement action)\b/.test(t)) {
    add("legal", 20, "Plan discloses a lost licence or an active regulatory action — the right to operate is itself in question.");
  }

  // ── Unit economics: stated unprofitability per unit. ──────────────────────
  if (/\b(negative|inverted)\s+(gross\s+)?(margin|unit economics)\b|\blos(e|ing) money on (each|every)\b|\bsell\w*\s+below cost\b/.test(t)) {
    add("economics", 20, "Plan discloses negative unit economics — growth compounds the loss rather than the return.");
  }

  return out;
}

export function analyze(rawInput: AnalysisInput, signalsOverride?: PlanSignals): AnalysisResult {
  const sector = resolveSector(rawInput.sector);
  const stage = STAGES.includes(rawInput.stage) ? rawInput.stage : "seed";
  const norms = STAGE_NORMS[stage];
  const moat = rawInput.claimedMoat && MOAT_STRENGTH[rawInput.claimedMoat] !== undefined
    ? rawInput.claimedMoat
    : sector.primaryMoat;

  // Company-specific signals: parse the plan text, then let any exact structured
  // financials override the parsed guesses (precise input beats regex).
  const parsedSignals = signalsOverride
    ?? parsePlanSignals(`${rawInput.description || ""} ${rawInput.tractionNotes || ""}`);
  const signals = mergeStructuredSignals(parsedSignals, rawInput.financials);
  const sectorTamUsd = sector.tamUsdBn * 1e9;

  // ── Market: sector-anchored; a credible bottom-up TAM earns a small rigor
  //    credit, an inflated one earns none (and a red flag). ─────────────────
  const sectorMarketScore = clamp(35 + Math.log10(Math.max(1, sector.tamUsdBn)) * 12);
  let marketScore = sectorMarketScore;
  let marketCompany = false;
  if (signals.bottomUpTamUsd !== null && signals.bottomUpTamUsd <= sectorTamUsd * 2) {
    marketScore = clamp(sectorMarketScore + 3);
    marketCompany = true;
  }

  const timing = timingScore(sector);

  // ── Execution: real metrics when disclosed, else qualitative heuristic. ──
  const quant = quantifiedExecution(signals);
  const traction = quant ?? tractionSignal(rawInput);
  const execCompany = quant !== null;

  // ── Unit economics: actual gross margin & LTV/CAC when disclosed. ────────
  let econScoreRaw = sector.grossMargin * 100 * 0.7 + (1 - sector.capitalIntensity) * 30;
  let econCompany = false;
  const econNotes: string[] = [];
  if (signals.grossMarginPct !== null) {
    econScoreRaw = signals.grossMarginPct * 0.7 + (1 - sector.capitalIntensity) * 30;
    econCompany = true;
    econNotes.push(`${signals.grossMarginPct}% disclosed gross margin`);
  }
  if (signals.ltvCacRatio !== null) {
    econScoreRaw += signals.ltvCacRatio >= 3 ? 10 : signals.ltvCacRatio >= 1.5 ? 4 : signals.ltvCacRatio >= 1 ? -4 : -18;
    econCompany = true;
    econNotes.push(`LTV/CAC ${signals.ltvCacRatio}`);
  }
  if (signals.paybackMonths !== null) {
    econScoreRaw += signals.paybackMonths <= 12 ? 4 : signals.paybackMonths > 24 ? -6 : 0;
    econCompany = true;
    econNotes.push(`${signals.paybackMonths}mo payback`);
  }
  const econScore = clamp(econScoreRaw);

  // ── Moat: archetype ceiling × realization (from stage & the now-company-
  //    specific traction), nudged up if the plan asserts patents. ──────────
  const moatCeiling = MOAT_STRENGTH[moat];
  let moatRealized = moatRealization(stage, traction.score);
  if (signals.mentionsPatent && moat === "ip-patents") moatRealized = clamp01(moatRealized + 0.1);
  const moatScore = clamp(MOAT_FLOOR + (moatCeiling - MOAT_FLOOR) * moatRealized);
  const moatCompany = execCompany || signals.mentionsPatent;

  const scienceScore = clamp(48 + (sector.cagr - 0.1) * 180 - (sector.capitalIntensity - 0.5) * 20);
  const legalScore = clamp(100 - sector.regulatoryIntensity * 65); // higher = less legal drag
  const competitionScore = clamp(100 - sector.competitiveIntensity * 70); // higher = less crowded

  const factors: ScoreFactor[] = [
    { key: "market", label: "Market size & growth", weight: 0.20, score: round(marketScore),
      rationale: marketCompany
        ? `~$${sector.tamUsdBn}B sector TAM, ${round(sector.cagr * 100)}% CAGR; plan discloses a credible bottom-up TAM of ${fmtMoney(signals.bottomUpTamUsd as number)}.`
        : `~$${sector.tamUsdBn}B TAM, ${round(sector.cagr * 100)}% CAGR (${sector.label}).` },
    { key: "timing", label: "Timing / tailwinds", weight: 0.10, score: round(timing),
      rationale: `Sector growth ${round(sector.cagr * 100)}% vs. 12% neutral baseline.` },
    { key: "moat", label: "Moat / defensibility", weight: 0.15, score: round(moatScore),
      rationale: `${moat.replace(/-/g, " ")} is the category's mature moat (ceiling ${moatCeiling}), but ~${round(moatRealized * 100)}% realized at ${stage}${execCompany ? " given disclosed traction" : (rawInput.tractionNotes || "").trim() ? " given disclosed traction" : " with no disclosed traction"}${signals.mentionsPatent && moat === "ip-patents" ? " (patent claim credited)" : ""} — an unproven moat is discounted toward the ${MOAT_FLOOR} "no demonstrated defensibility" floor.` },
    { key: "economics", label: "Unit economics potential", weight: 0.15, score: round(econScore),
      rationale: econCompany
        ? `Company metrics: ${econNotes.join(", ")} (capital intensity ${round(sector.capitalIntensity * 100)}%).`
        : `~${round(sector.grossMargin * 100)}% mature gross margin, capital intensity ${round(sector.capitalIntensity * 100)}% (sector reference).` },
    { key: "execution", label: "Team / execution signal", weight: 0.12, score: round(traction.score),
      rationale: traction.note },
    { key: "science", label: "Scientific / tech feasibility", weight: 0.10, score: round(scienceScore),
      rationale: sector.scienceFrontier },
    { key: "legal", label: "Regulatory / legal headroom", weight: 0.09, score: round(legalScore),
      rationale: `Regulatory intensity ${round(sector.regulatoryIntensity * 100)}% (higher = more legal drag).` },
    { key: "competition", label: "Competitive headroom", weight: 0.09, score: round(competitionScore),
      rationale: `Competitive intensity ${round(sector.competitiveIntensity * 100)}%. ${sector.structuralRisk}.` },
  ];

  // ── Adverse disclosures: charge stated negatives against the factor they
  //    impair, capped per factor, and record the deduction in the rationale so
  //    every lost point stays explainable. ─────────────────────────────────────
  const adverse = detectAdverseDisclosures(`${rawInput.description || ""} ${rawInput.tractionNotes || ""}`);
  const penaltyByFactor = new Map<string, number>();
  for (const a of adverse) {
    penaltyByFactor.set(a.factor, Math.min(ADVERSE_CAP_PER_FACTOR, (penaltyByFactor.get(a.factor) ?? 0) + a.penalty));
  }
  for (const f of factors) {
    const p = penaltyByFactor.get(f.key);
    if (!p) continue;
    f.score = round(clamp(f.score - p));
    f.rationale = `${f.rationale} −${p} for adverse disclosures in the plan.`;
  }

  const composite = round(factors.reduce((acc, f) => acc + f.weight * f.score, 0), 1);

  // ── Signal coverage: share of the composite weight backed by company data. ──
  const companyWeight =
    (marketCompany ? 0.20 : 0) + (econCompany ? 0.15 : 0) +
    (execCompany ? 0.12 : 0) + (moatCompany ? 0.15 : 0);
  const signalCoverage = round(companyWeight, 2);

  // ── Deterministic red flags: inconsistencies / weak disclosed metrics. ──
  const redFlags: string[] = adverse.map((a) => a.flag);
  const sectorGmPct = round(sector.grossMargin * 100);
  if (signals.grossMarginPct !== null && signals.grossMarginPct > sectorGmPct + 25) {
    redFlags.push(`Claimed ${signals.grossMarginPct}% gross margin is well above the ~${sectorGmPct}% ${sector.label} norm — verify against actuals.`);
  }
  if (signals.ltvCacRatio !== null && signals.ltvCacRatio < 1) {
    redFlags.push(`LTV/CAC of ${signals.ltvCacRatio} is below 1 — the company currently loses money on each customer acquired.`);
  }
  if (signals.bottomUpTamUsd !== null && signals.bottomUpTamUsd > sectorTamUsd * 2) {
    redFlags.push(`Bottom-up TAM of ${fmtMoney(signals.bottomUpTamUsd)} exceeds 2× the entire ${sector.label} market (~$${sector.tamUsdBn}B) — likely top-down inflation.`);
  }
  if (signals.mentionsRevenueNoNumber && signals.revenueUsd === null) {
    redFlags.push(`Revenue / monetization is referenced but no figure is disclosed — treat traction as unverified.`);
  }
  if (signals.growthPct !== null && signals.growthPeriod === "MoM" && signals.growthPct > 40) {
    redFlags.push(`${signals.growthPct}% month-over-month growth is exceptionally high — confirm it is sustained, not a single-period spike.`);
  }
  if (signals.churnPct !== null && signals.churnPct > 8) {
    redFlags.push(`${signals.churnPct}% churn is high — retention is a material risk to the model.`);
  }

  const strategy = buildStrategy({ composite, stage, norms, sector, input: rawInput });

  const citedSource = sector.sources[0];
  const assumptions = [
    citedSource
      ? `Market size / growth for ${sector.label} is anchored to ${citedSource.publisher} (${citedSource.year}): ${citedSource.claim}. Full citations are listed under "Market data sources".`
      : `Sector reference data (${sector.label}) is directional — override with primary diligence.`,
    `Signal coverage: ~${round(signalCoverage * 100)}% of the score is backed by the plan's own disclosed metrics (${signals.fieldsFound} quantified field${signals.fieldsFound === 1 ? "" : "s"}); the remainder uses ${sector.label} sector priors — add financials to raise it.`,
    `Stage norms reflect US-market ${stage} deals; adjust for geography "${rawInput.geography || "US"}".`,
    `Score is a screening signal, not a substitute for legal, financial, and technical due diligence.`,
  ];

  const stress = stressTest(signals);
  const tam = triangulateTam(signals, sector);
  const projections = analyzeProjections(rawInput.projections, sector);

  return { composite, verdict: strategy.verdict, factors, sector, stage, strategy, assumptions, signals, signalCoverage, redFlags, stress, tam, projections };
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
