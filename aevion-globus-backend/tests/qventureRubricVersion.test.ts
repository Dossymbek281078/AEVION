import { describe, test, expect } from "vitest";
import crypto from "node:crypto";
import { analyze, RUBRIC_VERSION, STAGES } from "../src/lib/qventure/engine";

// Stored analyses are ranked against each other by the gallery, the /benchmark
// percentiles and the watchlist, so a score only means something next to scores
// from the same rubric. RUBRIC_VERSION records which rules produced a number —
// but bumping it was purely a matter of remembering, and the weights changed
// three times in one sitting. This makes forgetting fail loudly instead of
// silently poisoning every percentile computed afterwards.

/** Weight table of the live rubric, as the engine actually reports it. */
function weightFingerprint(): string {
  const { factors } = analyze({
    name: "fingerprint",
    sector: "saas",
    stage: "seed",
    description: "A reference submission used only to read back the factor weights.",
  });
  const table = factors
    .map((f) => `${f.key}:${f.weight}`)
    .sort()
    .join("|");
  return crypto.createHash("sha256").update(table).digest("hex").slice(0, 16);
}

describe("rubric versioning", () => {
  // Update BOTH constants together, in the same commit, or not at all.
  // If this fails, the weights moved: bump RUBRIC_VERSION, add a line to its
  // changelog comment, and paste the new fingerprint here.
  const EXPECTED_FINGERPRINT = "612b62dfb60afcf6";
  const EXPECTED_VERSION = 3;

  test("weights have not changed without a version bump", () => {
    expect(weightFingerprint()).toBe(EXPECTED_FINGERPRINT);
    expect(RUBRIC_VERSION).toBe(EXPECTED_VERSION);
  });

  test("every result carries the current rubric version", () => {
    for (const stage of STAGES) {
      const r = analyze({
        name: "v",
        sector: "fintech",
        stage,
        description: "Embedded payments infrastructure for vertical software platforms.",
      });
      expect(r.rubricVersion).toBe(RUBRIC_VERSION);
    }
  });

  test("weights still sum to 1", () => {
    const { factors } = analyze({
      name: "sum",
      sector: "saas",
      stage: "seed",
      description: "A reference submission used only to read back the factor weights.",
    });
    const total = factors.reduce((s, f) => s + f.weight, 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-9);
  });
});
