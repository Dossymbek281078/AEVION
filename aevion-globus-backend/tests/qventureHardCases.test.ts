import { describe, test, expect } from "vitest";
import { PAIRS } from "../scripts/qventure-hardcases";
import { CASES as CALIBRATION_CASES } from "../scripts/qventure-calibration";
import { analyze } from "../src/lib/qventure/engine";
import { parsePlanSignals } from "../src/lib/qventure/signals";

// The capability that gates a launch is not "does it score", it is "does it read
// the evidence a hard business model actually produces". That was measured by
// hand once and would have decayed silently on the next rubric edit, which is
// precisely the failure mode this module keeps rediscovering. So the same
// invariants run in CI: the scripts stay the readable report, these are the gate.

describe("complex business models are scored on their own evidence", () => {
  for (const p of PAIRS) {
    describe(p.model, () => {
      const strong = analyze(p.strong);
      const weak = analyze(p.weak);
      const signals = parsePlanSignals(`${p.strong.description} ${p.strong.tractionNotes ?? ""}`);

      test(`reads ${p.mustParseLabel}`, () => {
        expect(p.mustParse(signals)).toBe(true);
      });

      test("the disclosed plan outscores the identical undisclosed one by a decision-relevant margin", () => {
        expect(strong.composite - weak.composite).toBeGreaterThanOrEqual(6);
      });

      test("the strong plan is scored mostly on company evidence", () => {
        expect(strong.signalCoverage).toBeGreaterThanOrEqual(0.4);
      });

      test("the weak plan never reads as investable", () => {
        expect(weak.verdict).not.toBe("invest");
      });
    });
  }

  test("the mean gap across models stays material", () => {
    const gaps = PAIRS.map((p) => analyze(p.strong).composite - analyze(p.weak).composite);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(mean).toBeGreaterThanOrEqual(10);
  });
});

// Floors, not targets. These are deliberately well below the measured values so
// ordinary tuning does not trip them — they exist to catch a change that
// collapses discrimination, which is how this rubric failed before (v1 could not
// reach "pass" at all, and nobody noticed until someone re-measured by hand).
describe("rubric discrimination does not collapse", () => {
  const scored = CALIBRATION_CASES.map((c) => ({
    outcome: c.outcome,
    sector: c.sector,
    composite: analyze({
      name: c.name, sector: c.sector, stage: c.stage, geography: c.geography,
      askUsd: c.askUsd, description: c.description, tractionNotes: c.tractionNotes,
    }).composite,
  }));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const failed = scored.filter((r) => r.outcome === "failed").map((r) => r.composite);
  const ok = scored.filter((r) => r.outcome === "succeeded").map((r) => r.composite);

  test("known successes still separate from known failures", () => {
    expect(mean(ok) - mean(failed)).toBeGreaterThanOrEqual(4);
  });

  test("capital-intensive deals separate too, not only software", () => {
    const HEAVY = new Set(["climate", "space", "proptech", "logistics", "biotech", "agtech"]);
    const heavy = scored.filter((r) => HEAVY.has(r.sector as string));
    const hf = heavy.filter((r) => r.outcome === "failed").map((r) => r.composite);
    const hs = heavy.filter((r) => r.outcome === "succeeded").map((r) => r.composite);
    expect(hf.length).toBeGreaterThanOrEqual(4);
    expect(hs.length).toBeGreaterThanOrEqual(4);
    expect(mean(hs) - mean(hf)).toBeGreaterThanOrEqual(3);
  });

  test("both ends of the verdict range stay reachable on real cases", () => {
    const verdicts = CALIBRATION_CASES.map((c) => analyze({
      name: c.name, sector: c.sector, stage: c.stage, geography: c.geography,
      askUsd: c.askUsd, description: c.description, tractionNotes: c.tractionNotes,
    }).verdict);
    expect(verdicts).toContain("pass");
    expect(verdicts).toContain("watch");
  });
});
