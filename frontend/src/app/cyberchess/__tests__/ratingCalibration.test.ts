import { describe, it, expect } from "vitest";
import {
  RATING_ANCHORS,
  internalToFide,
  nearestAnchor,
  fideConfidenceInterval,
  estimateFideFromCPI,
  type CPIMetrics,
} from "../ratingCalibration";

/* 553 lines that produce the FIDE number shown on the player's profile, with no
   tests at all until now. The point of these is the invariants the code silently
   depends on — not the exact constants, which are a product decision. */

const baseline: CPIMetrics = {
  accuracyPct: 75,
  openingTheoryDepth: 6,
  tacticalEfficiency: 0.6,
  endgameStrength: 0.5,
  blunderRate: 0.1,
  avgMoveTime: 30,
  gamesPlayed: 20,
};

describe("RATING_ANCHORS", () => {
  /* internalToFide walks the table looking for a bracket and, if it finds none,
     falls through to `return internal` — handing back an internal rating as if it
     were a FIDE one. That fallback is unreachable only while the table stays
     sorted, so the ordering is load-bearing rather than cosmetic. */
  it("is strictly descending in both internal and fide", () => {
    for (let i = 1; i < RATING_ANCHORS.length; i++) {
      expect(RATING_ANCHORS[i].internal).toBeLessThan(RATING_ANCHORS[i - 1].internal);
      expect(RATING_ANCHORS[i].fide).toBeLessThan(RATING_ANCHORS[i - 1].fide);
    }
  });

  it("gives every anchor a title and a badge — both are rendered", () => {
    for (const a of RATING_ANCHORS) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.badge.length).toBeGreaterThan(0);
    }
  });
});

describe("internalToFide", () => {
  it("returns the anchor's own fide at each anchor point", () => {
    for (const a of RATING_ANCHORS) {
      expect(internalToFide(a.internal)).toBe(a.fide);
    }
  });

  it("clamps outside the table instead of extrapolating", () => {
    const top = RATING_ANCHORS[0];
    const bottom = RATING_ANCHORS[RATING_ANCHORS.length - 1];
    expect(internalToFide(top.internal + 500)).toBe(top.fide);
    expect(internalToFide(bottom.internal - 500)).toBe(bottom.fide);
  });

  it("never decreases as the internal rating rises", () => {
    let prev = -Infinity;
    for (let internal = 500; internal <= 2700; internal += 10) {
      const fide = internalToFide(internal);
      expect(fide).toBeGreaterThanOrEqual(prev);
      prev = fide;
    }
  });

  it("interpolates between anchors rather than snapping", () => {
    const hi = RATING_ANCHORS.find((a) => a.internal === 1530)!;
    const lo = RATING_ANCHORS.find((a) => a.internal === 1430)!;
    const mid = internalToFide((hi.internal + lo.internal) / 2);
    expect(mid).toBeGreaterThan(lo.fide);
    expect(mid).toBeLessThan(hi.fide);
  });
});

describe("nearestAnchor", () => {
  it("picks the closest anchor, including above the table", () => {
    expect(nearestAnchor(RATING_ANCHORS[0].internal + 1000).internal).toBe(RATING_ANCHORS[0].internal);
    const last = RATING_ANCHORS[RATING_ANCHORS.length - 1];
    expect(nearestAnchor(last.internal - 1000).internal).toBe(last.internal);
  });

  it("returns an anchor that is actually in the table", () => {
    for (const internal of [600, 1000, 1450, 1900, 2400]) {
      expect(RATING_ANCHORS).toContain(nearestAnchor(internal));
    }
  });
});

describe("fideConfidenceInterval", () => {
  it("is widest with no games and settles at ±50", () => {
    expect(fideConfidenceInterval(1500, 0).high - fideConfidenceInterval(1500, 0).fide).toBe(200);
    expect(fideConfidenceInterval(1500, 100).high - fideConfidenceInterval(1500, 100).fide).toBe(50);
    // Past the asymptote it must not keep shrinking.
    expect(fideConfidenceInterval(1500, 1000).high - fideConfidenceInterval(1500, 1000).fide).toBe(50);
  });

  it("narrows monotonically as games accumulate", () => {
    let prevWidth = Infinity;
    for (const games of [0, 10, 25, 50, 75, 100]) {
      const { low, high } = fideConfidenceInterval(1500, games);
      const width = high - low;
      expect(width).toBeLessThanOrEqual(prevWidth);
      prevWidth = width;
    }
  });

  it("brackets the estimate", () => {
    const r = fideConfidenceInterval(1640, 30);
    expect(r.low).toBeLessThan(r.fide);
    expect(r.high).toBeGreaterThan(r.fide);
  });
});

describe("estimateFideFromCPI", () => {
  const fideOf = (m: Partial<CPIMetrics>) => estimateFideFromCPI({ ...baseline, ...m }).fide;

  it("rewards accuracy and punishes blunders — the signs that matter most", () => {
    expect(fideOf({ accuracyPct: 90 })).toBeGreaterThan(fideOf({ accuracyPct: 60 }));
    expect(fideOf({ blunderRate: 0.5 })).toBeLessThan(fideOf({ blunderRate: 0 }));
  });

  it("rewards tactics, endgame and opening depth", () => {
    expect(fideOf({ tacticalEfficiency: 1 })).toBeGreaterThan(fideOf({ tacticalEfficiency: 0 }));
    expect(fideOf({ endgameStrength: 1 })).toBeGreaterThan(fideOf({ endgameStrength: 0 }));
    expect(fideOf({ openingTheoryDepth: 12 })).toBeGreaterThan(fideOf({ openingTheoryDepth: 0 }));
  });

  it("treats time as a penalty in both directions from the optimum", () => {
    const atOptimum = fideOf({ avgMoveTime: 30 });
    expect(fideOf({ avgMoveTime: 5 })).toBeLessThan(atOptimum);
    expect(fideOf({ avgMoveTime: 90 })).toBeLessThan(atOptimum);
  });

  it("stays inside sane bounds even for absurd input", () => {
    const best = estimateFideFromCPI({
      accuracyPct: 100, openingTheoryDepth: 100, tacticalEfficiency: 5,
      endgameStrength: 5, blunderRate: 0, avgMoveTime: 30, gamesPlayed: 500,
    });
    const worst = estimateFideFromCPI({
      accuracyPct: 0, openingTheoryDepth: 0, tacticalEfficiency: -5,
      endgameStrength: -5, blunderRate: 5, avgMoveTime: 600, gamesPlayed: 1,
    });
    expect(best.fide).toBeLessThanOrEqual(3000);
    expect(worst.fide).toBeGreaterThanOrEqual(400);
    expect(best.fide).toBeGreaterThan(worst.fide);
  });

  it("caps opening depth so theory alone cannot inflate the estimate", () => {
    // The formula caps at 10 plies; beyond that the number must stop moving.
    expect(fideOf({ openingTheoryDepth: 10 })).toBe(fideOf({ openingTheoryDepth: 40 }));
  });
});
