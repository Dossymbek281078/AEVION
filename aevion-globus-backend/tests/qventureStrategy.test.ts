import { describe, test, expect } from "vitest";
import { analyze, STAGES, type AnalysisInput, type Stage } from "../src/lib/qventure/engine";

// buildStrategy turns the composite into the numbers an investor acts on —
// ticket, tranches, valuation band, risk-adjusted MOIC/IRR, position size. The
// smoke checks a couple of these on one deal; this asserts the money-math
// invariants hold across the stage/quality matrix, because a wrong ticket or an
// IRR that doesn't follow from the MOIC is the kind of error that looks
// plausible and gets acted on.

const base = (over: Partial<AnalysisInput>): AnalysisInput => ({
  name: "S", sector: "saas", stage: "seed",
  description: "A horizontal B2B SaaS analytics platform with a clear wedge and enterprise pull.",
  ...over,
});

const STRONG = base({
  stage: "series-a",
  tractionNotes: "$12M ARR growing 90% YoY, 400 enterprise customers, 128% net retention, LTV/CAC 5.2, 9mo payback",
});
const WEAK = base({
  sector: "ecommerce", stage: "growth",
  description: "No revenue in 3 years, two of four founders left, incumbent ships the same feature free, and our patent lapsed.",
});

const MATRIX: AnalysisInput[] = [
  ...STAGES.map((stage) => base({ stage: stage as Stage })),
  STRONG, WEAK,
  base({ stage: "seed", askUsd: 4_000_000, tractionNotes: "$40k MRR, 18% MoM, LTV/CAC 4.2" }),
];

describe("entry strategy — money-math invariants", () => {
  test.each(MATRIX)("tranches sum to exactly 100% ($#name/$stage)", (input) => {
    const { tranches } = analyze(input).strategy;
    const sum = tranches.reduce((a, t) => a + t.pct, 0);
    expect(sum).toBe(100);
  });

  test.each(MATRIX)("ticket is ordered and never leads >50% of the round", (input) => {
    const r = analyze(input);
    const t = r.strategy.ticketUsd;
    expect(t.min).toBeLessThanOrEqual(t.target);
    expect(t.target).toBeLessThanOrEqual(t.max);
    const roundSize = (input.askUsd && input.askUsd > 0)
      ? input.askUsd
      : r.strategy.valuationBandUsd.base * 0.25;
    // max is capped at 50% of the round.
    expect(t.max).toBeLessThanOrEqual(Math.round(roundSize * 0.5) + 1);
  });

  test.each(MATRIX)("valuation band is ordered low ≤ base ≤ high", (input) => {
    const v = analyze(input).strategy.valuationBandUsd;
    expect(v.low).toBeLessThanOrEqual(v.base);
    expect(v.base).toBeLessThanOrEqual(v.high);
  });

  test.each(MATRIX)("returns are internally consistent", (input) => {
    const rt = analyze(input).strategy.returns;
    expect(rt.lossProbability).toBeGreaterThanOrEqual(0);
    expect(rt.lossProbability).toBeLessThanOrEqual(1);
    expect(rt.expectedMoic).toBeGreaterThan(0);
    // Probability-weighted return can't exceed the success-case return.
    expect(rt.expectedMoic).toBeLessThanOrEqual(rt.baseMoic);
    expect(Number.isFinite(rt.targetIrrPct)).toBe(true);
    // IRR must follow from the expected MOIC over the horizon.
    const impliedIrr = (Math.pow(rt.expectedMoic, 1 / rt.horizonYears) - 1) * 100;
    expect(Math.abs(rt.targetIrrPct - impliedIrr)).toBeLessThan(0.2);
  });

  test("a pass recommends no ticket and gives re-entry conditions", () => {
    const r = analyze(WEAK).strategy;
    expect(r.verdict).toBe("pass");
    expect(Array.isArray(r.reEntryConditions)).toBe(true);
    expect((r.reEntryConditions ?? []).length).toBeGreaterThanOrEqual(3);
    expect(r.reasoning.some((x) => /no ticket recommended/i.test(x))).toBe(true);
  });

  test("a non-pass carries no re-entry conditions and a real ticket", () => {
    const r = analyze(STRONG).strategy;
    expect(r.verdict).not.toBe("pass");
    expect(r.reEntryConditions).toBeUndefined();
    expect(r.ticketUsd.target).toBeGreaterThan(0);
  });

  test("a fully-disclosed strong deal can reach 'invest'", () => {
    expect(analyze(STRONG).strategy.verdict).toBe("invest");
  });

  test("conviction tiers with the composite", () => {
    // Higher composite must not yield lower conviction.
    const order = { low: 0, medium: 1, high: 2 };
    const strong = analyze(STRONG);
    const weak = analyze(WEAK);
    expect(order[strong.strategy.conviction]).toBeGreaterThanOrEqual(order[weak.strategy.conviction]);
  });
});
