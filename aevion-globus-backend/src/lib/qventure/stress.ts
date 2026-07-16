/**
 * QVenture — Financial Stress Test (deterministic)
 * ────────────────────────────────────────────────
 * Takes the plan's disclosed unit economics (LTV/CAC, payback, churn, margin)
 * and flexes them under adverse shocks — what a top-tier diligence team does by
 * hand: "what if CAC doubles, churn rises, margin compresses?". Shows how the
 * economics hold up and a resilience verdict.
 *
 * Pure & deterministic (no LLM). Meaningful only when the plan discloses at
 * least an LTV/CAC ratio (or CAC + LTV); otherwise it returns an
 * `insufficient-data` result prompting the founder for unit economics.
 *
 * Model (subscription unit economics, first-order):
 *   • CAC ×k          → LTV/CAC ÷ k,   payback ×k     (more to acquire, same value)
 *   • churn ×k        → LTV/CAC ÷ k                   (LTV ∝ 1/churn: shorter lifetime)
 *   • gross margin −Δ → LTV/CAC × (m−Δ)/m             (LTV ∝ contribution margin)
 * These are directional sensitivities to frame diligence, not a full cohort model.
 */

import type { PlanSignals } from "./signals";

export type ResilienceVerdict = "robust" | "fragile" | "underwater" | "insufficient-data";
export type ScenarioHealth = "healthy" | "tight" | "underwater";

export interface StressScenario {
  label: string;
  shock: string;
  ltvCac: number | null;
  paybackMonths: number | null;
  health: ScenarioHealth;
}

export interface StressResult {
  base: { ltvCac: number | null; paybackMonths: number | null };
  scenarios: StressScenario[];
  resilience: ResilienceVerdict;
  /** Worst LTV/CAC across all scenarios (null when insufficient data). */
  worstLtvCac: number | null;
  note: string;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function health(ltvCac: number): ScenarioHealth {
  return ltvCac >= 3 ? "healthy" : ltvCac >= 1 ? "tight" : "underwater";
}

/** Base LTV/CAC from an explicit ratio, or from CAC + LTV if both are disclosed. */
function baseLtvCac(s: PlanSignals): number | null {
  if (s.ltvCacRatio !== null) return s.ltvCacRatio;
  if (s.cacUsd !== null && s.ltvUsd !== null && s.cacUsd > 0) return round1(s.ltvUsd / s.cacUsd);
  return null;
}

export function stressTest(s: PlanSignals): StressResult {
  const base = baseLtvCac(s);
  const basePayback = s.paybackMonths;

  if (base === null) {
    return {
      base: { ltvCac: null, paybackMonths: basePayback },
      scenarios: [],
      resilience: "insufficient-data",
      worstLtvCac: null,
      note: "Stress test needs unit economics — disclose LTV/CAC (or CAC and LTV) to model CAC, churn and margin shocks.",
    };
  }

  const scenarios: StressScenario[] = [];
  const push = (label: string, shock: string, ltvCac: number, payback: number | null) => {
    const v = Math.max(0, round1(ltvCac));
    scenarios.push({ label, shock, ltvCac: v, paybackMonths: payback === null ? null : round1(payback), health: health(v) });
  };

  push("CAC +50%", "acquisition cost ×1.5", base / 1.5, basePayback === null ? null : basePayback * 1.5);
  push("CAC ×2", "acquisition cost doubles", base / 2, basePayback === null ? null : basePayback * 2);
  push("Churn +50%", "monthly churn ×1.5 (shorter lifetime)", base / 1.5, basePayback);
  push("Churn ×2", "monthly churn doubles", base / 2, basePayback);
  if (s.grossMarginPct !== null && s.grossMarginPct > 15) {
    const factor = (s.grossMarginPct - 15) / s.grossMarginPct;
    push("Margin −15pp", `gross margin ${s.grossMarginPct}% → ${s.grossMarginPct - 15}%`, base * factor, basePayback);
  }
  // Combined downturn — CAC and churn both worsen at once.
  push("Downturn (CAC +50% & churn +50%)", "both shocks together", base / (1.5 * 1.5), basePayback === null ? null : basePayback * 1.5);

  const worst = Math.min(...scenarios.map((x) => x.ltvCac ?? Infinity));
  const worstLtvCac = round1(worst);
  const resilience: ResilienceVerdict = worst >= 3 ? "robust" : worst >= 1 ? "fragile" : "underwater";

  const note =
    resilience === "robust"
      ? `Unit economics stay healthy (LTV/CAC ≥3) even in the combined downturn — resilient model.`
      : resilience === "fragile"
        ? `Economics survive but tighten under shocks (worst LTV/CAC ${worstLtvCac}) — watch CAC and churn closely post-investment.`
        : `At least one realistic shock pushes LTV/CAC below 1 (worst ${worstLtvCac}) — the model is not robust; acquisition or retention must improve to de-risk.`;

  return { base: { ltvCac: base, paybackMonths: basePayback }, scenarios, resilience, worstLtvCac, note };
}
