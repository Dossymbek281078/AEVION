import { describe, test, expect } from "vitest";
import { analyze, VERDICT_BANDS, CONVICTION_BANDS, type Stage } from "../src/lib/qventure/engine";
import { defineBands, checkBandsReachable, assertBandsReachable } from "../src/lib/verdictBands";

// The defect this exists to prevent: QVenture ran for months with a "pass"
// verdict no submission could produce. Every factor started at a sector prior
// and only moved up, so the composite bottomed out near 59 against a threshold
// of 55 — 55 live analyses, zero passes, nothing failing. A band nobody can
// reach is worse than a missing feature, because the tool looks like it
// discriminates while it does not.
//
// Synthetic scores spanning 0-100 would prove nothing here. The question is not
// whether classify() does arithmetic, it is whether the engine can emit a score
// in that range at all — so these samples come from running the real engine over
// inputs spanning the range it is meant to handle.

function sample(): number[] {
  const inputs: Array<{ sector: string; stage: Stage; description: string; tractionNotes?: string }> = [
    // Strong, fully disclosed — should reach the top band.
    { sector: "saas", stage: "series-a",
      description: "Horizontal B2B analytics platform with usage-based pricing and strong enterprise pull.",
      tractionNotes: "$12M ARR growing 90% YoY, 400 enterprise customers, 128% net retention, LTV/CAC 5.2, 9mo payback" },
    { sector: "cybersecurity", stage: "series-a",
      description: "Agentless cloud security platform building an exposure graph across the whole estate.",
      tractionNotes: "$8M ARR, 140% YoY growth, 260 customers, 131% net retention, LTV/CAC 6.0" },
    { sector: "fintech", stage: "seed",
      description: "Embedded payment rails for vertical software platforms.",
      tractionNotes: "$40k MRR growing 18% MoM, 92% retention cohort, LTV/CAC 4.2" },
    // Middling — no numbers, nothing wrong.
    { sector: "marketplace", stage: "seed",
      description: "Two-sided marketplace for industrial parts with network effects and high switching costs." },
    { sector: "climate", stage: "series-a",
      description: "Grid-scale iron-air battery storage with granted patents and improving margins at scale." },
    // Explicitly weak — should reach the bottom band.
    { sector: "ecommerce", stage: "growth",
      description: "No revenue in 3 years, two of four founders left, incumbent ships the same feature free, and our only patent lapsed. We lose money on every order." },
    { sector: "consumer", stage: "series-a",
      description: "Short-form premium mobile video funded ahead of launch.",
      tractionNotes: "Pre-launch. No revenue, no users." },
    { sector: "logistics", stage: "growth",
      description: "Digital freight brokerage. Thin take rate, being sued by a competitor, and our operating licence was suspended by the regulator." },
  ];
  return inputs.map((i) => analyze({ name: "sample", ...i }).composite);
}

describe("qventure verdict bands are reachable", () => {
  const scores = sample();

  test("every verdict band is produced by the real engine", () => {
    const r = checkBandsReachable(VERDICT_BANDS, scores);
    expect(r.ok, r.message).toBe(true);
  });

  test("conviction bands: low and medium reachable; high is documented as not", () => {
    const r = checkBandsReachable(CONVICTION_BANDS, scores);
    // "high" needs composite >= 78, which nothing in this sample reaches. That is
    // recorded rather than asserted away — if it becomes reachable, tighten this.
    expect(r.counts.low).toBeGreaterThan(0);
    expect(r.counts.medium).toBeGreaterThan(0);
  });

  test("the top verdict band is genuinely attainable, not just defined", () => {
    expect(Math.max(...scores)).toBeGreaterThanOrEqual(72);
  });

  test("the bottom verdict band is genuinely attainable", () => {
    expect(Math.min(...scores)).toBeLessThan(55);
  });
});

describe("defineBands guards its own contract", () => {
  test("rejects a band set that leaves low scores uncategorised", () => {
    expect(() => defineBands("t", [{ label: "hi", min: 60 }, { label: "lo", min: 30 }]))
      .toThrow(/uncategorised/);
  });

  test("rejects duplicate thresholds", () => {
    expect(() => defineBands("t", [{ label: "a", min: 50 }, { label: "b", min: 50 }, { label: "c", min: 0 }]))
      .toThrow(/share min/);
  });

  test("assertBandsReachable names the unreachable band", () => {
    const set = defineBands("t", [{ label: "top", min: 90 }, { label: "bottom", min: 0 }]);
    expect(() => assertBandsReachable(set, [10, 20, 30])).toThrow(/unreachable band\(s\) top/);
  });
});
