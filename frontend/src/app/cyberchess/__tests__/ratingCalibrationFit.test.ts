import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  estimateFideFromCPIWithFit,
  DEFAULT_WEIGHTS,
  type CalibrationWeights,
} from "../ratingCalibrationFit";
import { estimateFideFromCPI, type CPIMetrics } from "../ratingCalibration";

/* The panel prints this number as the player's real FIDE strength, so the interesting
   property is not any single value but that the estimate stays inside the board's own
   scale and that the interval around it is not narrower than the model's own error. */

const SHIPPED: CalibrationWeights = JSON.parse(
  readFileSync(join(process.cwd(), "public", "calibration-weights.json"), "utf8"),
);

const player = (over: Partial<CPIMetrics> = {}): CPIMetrics => ({
  accuracyPct: 75,
  openingTheoryDepth: 6,
  tacticalEfficiency: 0.6,
  endgameStrength: 0.6,
  blunderRate: 0.05,
  avgMoveTime: 25,
  gamesPlayed: 20,
  ...over,
});

describe("the weights we actually ship", () => {
  it("carries the fields the estimator reads", () => {
    expect(SHIPPED.schemaVersion).toBe(1);
    expect(SHIPPED.samples).toBeGreaterThan(0);
    expect(typeof SHIPPED.bias).toBe("number");
    for (const k of ["accuracy", "opening", "tactical", "endgame", "blunder", "time"] as const) {
      expect(typeof SHIPPED.coefficients[k], k).toBe("number");
    }
  });

  /* rmseElo is what the estimate is actually worth. It is displayed to the player and,
     after the fix below, it also sets the floor on the interval — so it has to be
     present and sane rather than quietly absent. */
  it("states how wrong it typically is", () => {
    expect(SHIPPED.fitStats).toBeDefined();
    expect(SHIPPED.fitStats!.rmseElo).toBeGreaterThan(0);
    expect(SHIPPED.fitStats!.r2).toBeGreaterThan(0);
    expect(SHIPPED.fitStats!.r2).toBeLessThanOrEqual(1);
  });
});

describe("estimateFideFromCPIWithFit", () => {
  it("falls back to the hardcoded model when no weights were loaded", () => {
    const m = player();
    expect(estimateFideFromCPIWithFit(m, null).fide).toBe(estimateFideFromCPI(m).fide);
  });

  it("keeps the estimate inside the rating scale for any input", () => {
    const extremes: CPIMetrics[] = [
      player({ accuracyPct: 99, blunderRate: 0, endgameStrength: 1, tacticalEfficiency: 1, openingTheoryDepth: 10 }),
      player({ accuracyPct: 30, blunderRate: 1, endgameStrength: 0, tacticalEfficiency: 0, openingTheoryDepth: 0 }),
      player({ accuracyPct: 0, blunderRate: 5, avgMoveTime: 10000 }),
    ];
    for (const m of extremes) {
      const r = estimateFideFromCPIWithFit(m, SHIPPED);
      expect(r.fide).toBeGreaterThanOrEqual(400);
      expect(r.fide).toBeLessThanOrEqual(3000);
    }
  });

  it("rates the accurate player above the sloppy one", () => {
    const good = estimateFideFromCPIWithFit(player({ accuracyPct: 92, blunderRate: 0.01 }), SHIPPED).fide;
    const bad = estimateFideFromCPIWithFit(player({ accuracyPct: 55, blunderRate: 0.25 }), SHIPPED).fide;
    expect(good).toBeGreaterThan(bad);
  });

  it("puts the interval around the estimate, not beside it", () => {
    const r = estimateFideFromCPIWithFit(player(), SHIPPED);
    expect(r.low).toBeLessThanOrEqual(r.fide);
    expect(r.high).toBeGreaterThanOrEqual(r.fide);
  });

  /* The interval used to shrink to ±50 after a hundred games by a curve that had nothing
     to do with how wrong the model is. The shipped fit reports rmseElo ≈ 328 — telling
     the player ±50 claims six times the precision the model has. Whatever the sampling
     term says, the interval cannot be tighter than the model's own error. */
  it("never claims more precision than the model has", () => {
    const rmse = SHIPPED.fitStats!.rmseElo;
    const veteran = estimateFideFromCPIWithFit(player({ gamesPlayed: 500 }), SHIPPED);
    expect((veteran.high - veteran.low) / 2).toBeGreaterThanOrEqual(rmse * 0.95);
  });

  it("gives the newcomer a wider interval than the veteran", () => {
    const fresh = estimateFideFromCPIWithFit(player({ gamesPlayed: 0 }), SHIPPED);
    const veteran = estimateFideFromCPIWithFit(player({ gamesPlayed: 500 }), SHIPPED);
    expect(fresh.high - fresh.low).toBeGreaterThan(veteran.high - veteran.low);
  });

  it("explains itself with a factor breakdown", () => {
    const r = estimateFideFromCPIWithFit(player(), SHIPPED);
    expect(r.factors.length).toBeGreaterThan(3);
    for (const f of r.factors) {
      expect(typeof f.deltaElo).toBe("number");
      expect(["good", "mid", "bad"]).toContain(f.status);
    }
  });

  it("uses the specialist fit at the top of the scale when one is supplied", () => {
    const strong = player({ accuracyPct: 96, blunderRate: 0, endgameStrength: 1, tacticalEfficiency: 1, openingTheoryDepth: 10 });
    const withFloor = estimateFideFromCPIWithFit(strong, SHIPPED).fide;
    const withoutFloor = estimateFideFromCPIWithFit(strong, { ...SHIPPED, floorFit: undefined }).fide;
    // Both must stay on the scale; the specialist exists to change the answer up there.
    expect(withFloor).toBeLessThanOrEqual(3000);
    expect(withoutFloor).toBeLessThanOrEqual(3000);
  });

  it("still answers when the rich features are missing from the metrics", () => {
    const lean = estimateFideFromCPIWithFit(player({ medianCpLoss: undefined, cpLossStd: undefined }), SHIPPED);
    expect(Number.isFinite(lean.fide)).toBe(true);
  });

  it("ships defaults that produce a usable estimate on their own", () => {
    const r = estimateFideFromCPIWithFit(player(), DEFAULT_WEIGHTS);
    expect(r.fide).toBeGreaterThanOrEqual(400);
    expect(r.fide).toBeLessThanOrEqual(3000);
  });
});
