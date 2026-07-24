import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { analyze, type AnalysisInput } from "../src/lib/qventure/engine";
import { runCouncil } from "../src/lib/qventure/lenses";

// The four-role council has two paths: an LLM path when a provider key is set,
// and a deterministic fallback when it resolves to "stub". Production usually
// runs with no QVenture key, so the fallback IS the text most users read — and
// it was the one core piece with no test. These drive runCouncil with the
// provider forced to stub, so the assertions are about the deterministic
// output, not a live model.

const STUB_KEYS = [
  "QVENTURE_PROVIDER", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "QCOREAI_API_KEY",
  "GROQ_API_KEY", "OPENROUTER_API_KEY", "GOOGLE_API_KEY", "DEEPSEEK_API_KEY",
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of STUB_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
});
afterEach(() => {
  for (const k of STUB_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const SEED_INPUT: AnalysisInput = {
  name: "OfflineCo",
  sector: "fintech",
  stage: "seed",
  geography: "US",
  askUsd: 4_000_000,
  description: "Embedded treasury and stablecoin payment rails for vertical SaaS platforms, with on-device fraud scoring.",
  tractionNotes: "$40k MRR growing 18% MoM, 3 enterprise pilots, 92% retention cohort, LTV/CAC 4.2.",
};

describe("offline council (no AI key → deterministic)", () => {
  test("runs in stub mode without a provider key", async () => {
    const result = analyze(SEED_INPUT);
    const council = await runCouncil(SEED_INPUT, result);
    expect(council.aiUsed).toBe(false);
    expect(council.aiProvider).toBe("stub");
  });

  test("produces exactly the four expert lenses", async () => {
    const result = analyze(SEED_INPUT);
    const { lenses } = await runCouncil(SEED_INPUT, result);
    expect(lenses).toHaveLength(4);
    expect(lenses.map((l) => l.lens).sort()).toEqual(
      ["data_analyst", "economist", "lawyer", "scientist"],
    );
  });

  test("every lens has a headline and non-empty points and risks", async () => {
    const result = analyze(SEED_INPUT);
    const { lenses } = await runCouncil(SEED_INPUT, result);
    for (const l of lenses) {
      expect(l.role.length).toBeGreaterThan(0);
      expect(l.headline.length).toBeGreaterThan(0);
      expect(l.points.length).toBeGreaterThan(0);
      expect(l.risks.length).toBeGreaterThan(0);
      expect(l.points.every((p) => typeof p === "string" && p.length > 0)).toBe(true);
    }
  });

  test("lenses cite concrete factor scores from the quant model", async () => {
    const result = analyze(SEED_INPUT);
    const { lenses } = await runCouncil(SEED_INPUT, result);
    // The deterministic lenses reference "<n>/100" factor figures — that anchoring
    // to the quant core is the point, so a regression that drops it should fail.
    const anyCitesScore = lenses.some((l) =>
      l.points.some((p) => /\/100\b/.test(p)));
    expect(anyCitesScore).toBe(true);
  });

  test("memo is a substantial recommendation that names the verdict and score", async () => {
    const result = analyze(SEED_INPUT);
    const { memo } = await runCouncil(SEED_INPUT, result);
    expect(memo.length).toBeGreaterThan(120);
    expect(memo).toContain("INVESTMENT MEMO");
    expect(memo).toContain(SEED_INPUT.name);
    expect(memo.toUpperCase()).toContain(result.strategy.verdict.toUpperCase());
    expect(memo).toContain(`${result.composite}/100`);
    // The entry plan must be in the memo — it is the actionable part.
    expect(memo).toMatch(/Entry:/);
    expect(memo).toMatch(/Staging:/);
  });

  test("is fully deterministic — same input twice yields identical output", async () => {
    const result = analyze(SEED_INPUT);
    const a = await runCouncil(SEED_INPUT, result);
    const b = await runCouncil(SEED_INPUT, result);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("a weak deal's memo reflects a pass, not a generic write-up", async () => {
    const weak: AnalysisInput = {
      name: "WeakCo", sector: "ecommerce", stage: "growth", geography: "US",
      description: "No revenue in 3 years, two of four founders left, incumbent ships the same feature free, and our patent lapsed.",
    };
    const result = analyze(weak);
    const { memo } = await runCouncil(weak, result);
    expect(result.strategy.verdict).toBe("pass");
    expect(memo.toUpperCase()).toContain("PASS");
  });
});
