import { describe, test, expect } from "vitest";
import { showcasePublicView } from "../src/routes/qventure";
import { EXAMPLE_SEEDS } from "../src/lib/qventure/examples";
import { analyze } from "../src/lib/qventure/engine";

// The showcase publishes verdicts and withholds reasoning. The smoke test proves
// that over HTTP, but only against a running server — this pins the redactor
// itself, so a field added to the analysis result cannot quietly start shipping
// to signed-out readers on the next deploy.

const seed = EXAMPLE_SEEDS.find((s) => s.slug === "sentinel-autonomy")!;

function storedFrom(input: typeof seed) {
  const result = analyze(input);
  return {
    id: `ex-${input.slug}`,
    name: input.name,
    sector: result.sector.id,
    stage: input.stage ?? "seed",
    geography: input.geography ?? "US",
    askUsd: input.askUsd ?? null,
    composite: result.composite,
    verdict: result.verdict,
    result,
    input,
    contentHash: "test",
    dedupeHash: "test",
    visibility: "public" as const,
    createdAt: new Date(0).toISOString(),
  };
}

describe("showcase public view", () => {
  const record = storedFrom(seed);
  const view = showcasePublicView(record as never, seed);
  const serialized = JSON.stringify(view);

  test("publishes the conclusions a reader needs to judge the tool", () => {
    expect(view.name).toBe(seed.name);
    expect(typeof view.composite).toBe("number");
    expect(["invest", "watch", "pass"]).toContain(view.verdict);
    expect(view.complexity).toBe(seed.complexity);
    expect(view.whyThisOne).toBe(seed.whyThisOne);
    expect(typeof view.redFlagCount).toBe("number");
  });

  test("withholds every part of the reasoning", () => {
    for (const key of ["factors", "council", "strategy", "stress", "tam", "projections", "signals", "assumptions", "redFlags", "input", "description"]) {
      expect(Object.keys(view)).not.toContain(key);
    }
  });

  test("leaks no analysis text through any field", () => {
    // The council memo, factor rationales and red-flag text are prose; if any of
    // it reached the payload it would show up as a long string.
    const longStrings = Object.entries(view)
      .filter(([k, v]) => k !== "locked" && typeof v === "string" && v.length > 200);
    expect(longStrings).toEqual([]);
    expect(serialized).not.toContain(record.result.council?.memo ?? "@@no-memo@@");
  });

  test("names what sits behind the gate instead of just refusing", () => {
    expect(view.locked.length).toBeGreaterThanOrEqual(4);
    expect(view.locked.join(" ")).toMatch(/council/i);
    expect(view.locked.join(" ")).toMatch(/strategy/i);
  });

  test("red-flag count is a count, never the text", () => {
    const flagged = storedFrom({ ...seed, slug: "flagged", description: `${seed.description} Gross margin of 96% and LTV:CAC of 0.4.` });
    const flaggedView = showcasePublicView(flagged as never, seed);
    expect(flaggedView.redFlagCount).toBeGreaterThan(0);
    expect(JSON.stringify(flaggedView)).not.toContain("gross margin is well above");
  });

  test("every showcase seed declares its difficulty and why it is there", () => {
    for (const s of EXAMPLE_SEEDS) {
      expect(["simple", "medium", "complex"]).toContain(s.complexity);
      expect(s.whyThisOne.length).toBeGreaterThan(20);
    }
    const bands = new Set(EXAMPLE_SEEDS.map((s) => s.complexity));
    expect(bands.size).toBe(3);
  });
});
