import { describe, it, expect } from "vitest";
import { reconcileMeasuredOutlines, ringCentroid } from "../scripts/lib/measured-outlines.mjs";

// Reconciliation decides how tall the router believes each building is, from
// whatever survey the city's authority happens to publish. It was written for
// Tokyo's PLATEAU CityGML and then fed New York's Socrata JSON without a line
// changing — which is why it no longer lives in a PLATEAU-named module.

describe("reconcileWithPlateau — which outline is which building", () => {
  const sq = (x: number, y: number, s: number): number[][] =>
    [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]];

  it("identifies a building when the PLATEAU centroid falls inside the footprint", () => {
    const { heights } = reconcileMeasuredOutlines([sq(0, 0, 40)], [{ h: 90, ring: sq(15, 15, 8) }]);
    expect(heights[0]).toMatchObject({ h: 90, how: "contained" });
  });

  it("identifies it the other way round too, when OSM draws the smaller outline", () => {
    // OSM often traces one wing of a complex PLATEAU models whole. A
    // one-directional test loses whichever side is subdivided.
    const { heights } = reconcileMeasuredOutlines([sq(20, 20, 6)], [{ h: 70, ring: sq(0, 0, 60) }]);
    expect(heights[0]).toMatchObject({ h: 70, how: "contained" });
  });

  it("takes the TALLEST of several outlines standing on one footprint", () => {
    // Shinjuku Park Tower is one OSM outline over three PLATEAU towers. The
    // podium must not be the height published for the block.
    const { heights } = reconcileMeasuredOutlines(
      [sq(0, 0, 100)],
      [{ h: 30, ring: sq(10, 10, 5) }, { h: 227, ring: sq(50, 50, 5) }, { h: 96, ring: sq(80, 80, 5) }],
    );
    expect(heights[0]).toMatchObject({ h: 227, sources: 3 });
  });

  it("falls back to the nearest outline when nothing is contained", () => {
    // OSM traces the ground floor where PLATEAU draws the roof edge, so the two
    // outlines of one building can miss each other completely.
    const { heights } = reconcileMeasuredOutlines([sq(0, 0, 10)], [{ h: 45, ring: sq(18, 0, 6) }], { nearRadiusM: 20 });
    expect(heights[0]).toMatchObject({ h: 45, how: "near" });
  });

  it("reports no match rather than reaching past the radius", () => {
    // ~38 m away: far enough to be a different building, close enough that the
    // spatial index still offers it. Pushing it hundreds of metres out would
    // let the bucket sweep reject it first, and the radius check itself would
    // go untested — the test would pass for the wrong reason.
    const { heights } = reconcileMeasuredOutlines([sq(0, 0, 10)], [{ h: 45, ring: sq(40, 0, 6) }], { nearRadiusM: 20 });
    expect(heights[0]).toMatchObject({ h: null, how: "none" });
  });

  it("still refuses an outline the index never offered", () => {
    const { heights } = reconcileMeasuredOutlines([sq(0, 0, 10)], [{ h: 45, ring: sq(400, 0, 6) }], { nearRadiusM: 20 });
    expect(heights[0]).toMatchObject({ h: null, how: "none" });
  });

  it("prefers containment over a nearer outline that only sits alongside", () => {
    // Distance alone would pick the 3 m shed; containment says the 60 m tower
    // is the building. Getting this backwards is how the committed twin ended
    // up publishing a neighbouring tower's height for a 3 m structure.
    const { heights } = reconcileMeasuredOutlines(
      [sq(0, 0, 40)],
      [{ h: 3, ring: sq(42, 18, 4) }, { h: 60, ring: sq(16, 16, 8) }],
      { nearRadiusM: 30 },
    );
    expect(heights[0]).toMatchObject({ h: 60, how: "contained" });
  });

  it("lists outlines no footprint accounts for — those are OSM's blind spots", () => {
    const { unmatched } = reconcileMeasuredOutlines(
      [sq(0, 0, 40)],
      [{ h: 60, ring: sq(16, 16, 8) }, { h: 146, ring: sq(500, 500, 20) }],
    );
    expect(unmatched).toEqual([1]);
  });

  it("does not report an outline as unmatched once a footprint has claimed it", () => {
    const { unmatched } = reconcileMeasuredOutlines([sq(0, 0, 40)], [{ h: 60, ring: sq(16, 16, 8) }]);
    expect(unmatched).toEqual([]);
  });

  it("handles an empty PLATEAU set without pretending every building is unknown-height", () => {
    const { heights, unmatched } = reconcileMeasuredOutlines([sq(0, 0, 40)], []);
    expect(heights[0].h).toBeNull();
    expect(unmatched).toEqual([]);
  });
});

describe("ringCentroid", () => {
  it("is the area centroid, not the average vertex", () => {
    // A vertex mean is pulled by whichever edge is drawn with more points —
    // and PLATEAU roof outlines are not evenly sampled.
    const dense: number[][] = [[0, 0], [2, 0], [4, 0], [6, 0], [8, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    const [x] = ringCentroid(dense);
    expect(x).toBeCloseTo(5, 6);
  });
});

describe("ringCentroid", () => {
  it("is the area centroid, not the average vertex", () => {
    // A vertex mean is pulled by whichever edge is drawn with more points —
    // and roof outlines are not evenly sampled.
    const dense: number[][] = [[0, 0], [2, 0], [4, 0], [6, 0], [8, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    const [x] = ringCentroid(dense);
    expect(x).toBeCloseTo(5, 6);
  });
});
