import { describe, it, expect } from "vitest";
import {
  CELL, DEFAULT_HEIGHT_M, METRES_PER_LEVEL, PARAPET_M,
  projection, parseMetres, heightOf, toRing, ringsOf, inRing, rasterize,
} from "../scripts/lib/city-twin-geometry.mjs";
import { CITY } from "../src/routes/qskyway.city";

// The twin is the module's most load-bearing data: every route, every ceiling
// check and every signed justification is computed over the obstacle grid these
// functions produce. Until 2026-07-27 none of it was covered — the one bug found
// here (relations flattened into a single zig-zag ring) surfaced only by
// comparing the output against OSM by hand, which is not something CI does.

const flat = (lon: number, lat: number): [number, number] => [lon, lat];

describe("parseMetres — a bad tag must not become NaN", () => {
  it("reads the shapes OSM actually uses", () => {
    expect(parseMetres("42")).toBe(42);
    expect(parseMetres("42 m")).toBe(42);
    expect(parseMetres("42.5m")).toBe(42.5);
    expect(parseMetres(" 7 ")).toBe(7);
  });

  it("rejects anything it cannot read rather than returning NaN", () => {
    // A NaN height rasterizes to a hole in the obstacle grid — i.e. a corridor
    // planned straight through a building. Every rejection here is a building
    // that instead falls through to the next, weaker but finite, source.
    for (const bad of ["about 12", "12-15", "", "m", "twelve", "1,5"]) {
      expect(parseMetres(bad)).toBeNull();
    }
    expect(parseMetres(undefined as unknown as string)).toBeNull();
    expect(parseMetres(42 as unknown as string)).toBeNull();
  });

  it("rejects non-positive heights", () => {
    expect(parseMetres("0")).toBeNull();
    expect(parseMetres("-5")).toBeNull();
  });
});

describe("heightOf — provenance decides the safety clearance, so it must be exact", () => {
  it("an explicit height tag is measured (hs 0)", () => {
    expect(heightOf({ height: "88" })).toEqual({ h: 88, hs: 0 });
    expect(heightOf({ "building:height": "31.4" })).toEqual({ h: 31, hs: 0 });
  });

  it("levels are derived with the parapet allowance (hs 1)", () => {
    // levels*3.2 + 1.6, the model recovered from the committed twin (159/159).
    expect(heightOf({ "building:levels": "1" })).toEqual({ h: 5, hs: 1 });
    expect(heightOf({ "building:levels": "3" })).toEqual({ h: 11, hs: 1 });
    expect(heightOf({ "building:levels": "10" })).toEqual({ h: 34, hs: 1 });
    expect(heightOf({ "building:levels": "12" })).toEqual({ h: 40, hs: 1 });
  });

  it("plain levels*3.2 without the parapet would disagree with the shipped twin", () => {
    // Guards the constant itself: dropping PARAPET_M silently lowers every
    // derived obstacle by ~1.6 m the next time a twin is regenerated.
    expect(METRES_PER_LEVEL).toBe(3.2);
    expect(PARAPET_M).toBe(1.6);
    expect(heightOf({ "building:levels": "10" }).h).not.toBe(Math.round(10 * 3.2));
  });

  it("an untagged building is guessed at the blind default (hs 2)", () => {
    expect(heightOf({})).toEqual({ h: DEFAULT_HEIGHT_M, hs: 2 });
    expect(heightOf({ building: "yes" })).toEqual({ h: DEFAULT_HEIGHT_M, hs: 2 });
  });

  it("an unreadable height falls through to levels instead of poisoning the cell", () => {
    expect(heightOf({ height: "tall", "building:levels": "3" })).toEqual({ h: 11, hs: 1 });
    expect(heightOf({ height: "tall" })).toEqual({ h: DEFAULT_HEIGHT_M, hs: 2 });
  });

  it("a measured height wins over levels", () => {
    expect(heightOf({ height: "100", "building:levels": "2" })).toEqual({ h: 100, hs: 0 });
  });
});

describe("ringsOf — a multipolygon must not collapse into one zig-zag ring", () => {
  const wing = (x0: number) => [
    { lon: x0, lat: 0 }, { lon: x0 + 1, lat: 0 }, { lon: x0 + 1, lat: 1 }, { lon: x0, lat: 1 },
  ];

  it("a way yields exactly one ring", () => {
    const rings = ringsOf({ type: "way", geometry: wing(0) }, flat);
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4);
  });

  it("a relation yields one ring PER outer member, not a single merged ring", () => {
    // The regression this guards: concatenating members produced a polygon
    // spanning the gap between two wings, blocking cells nothing stands on.
    const rings = ringsOf({
      type: "relation",
      members: [
        { type: "way", role: "outer", geometry: wing(0) },
        { type: "way", role: "outer", geometry: wing(10) },
      ],
    }, flat);
    expect(rings).toHaveLength(2);
    expect(rings.every((r) => r.length === 4)).toBe(true);
    // No ring may span both wings — that is exactly the zig-zag artefact.
    for (const r of rings) {
      const xs = r.map(([x]) => x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(5);
    }
  });

  it("inner courtyard members are skipped, never merged into the outline", () => {
    const rings = ringsOf({
      type: "relation",
      members: [
        { type: "way", role: "outer", geometry: wing(0) },
        { type: "way", role: "inner", geometry: wing(20) },
      ],
    }, flat);
    expect(rings).toHaveLength(1);
  });

  it("degenerate geometry is dropped rather than half-built", () => {
    expect(ringsOf({ type: "way", geometry: [{ lon: 0, lat: 0 }, { lon: 1, lat: 1 }] }, flat)).toEqual([]);
    expect(ringsOf({ type: "way", geometry: [] }, flat)).toEqual([]);
    expect(ringsOf({ type: "relation", members: [] }, flat)).toEqual([]);
    expect(toRing([{ lon: NaN, lat: 0 }, { lon: 1, lat: 1 }, { lon: 2, lat: 2 }], flat)).toBeNull();
  });
});

describe("inRing", () => {
  const square = [[0, 0], [100, 0], [100, 100], [0, 100]] as number[][];

  it("separates inside from outside", () => {
    expect(inRing(square, 50, 50)).toBe(true);
    expect(inRing(square, 150, 50)).toBe(false);
    expect(inRing(square, -1, 50)).toBe(false);
    expect(inRing(square, 50, 150)).toBe(false);
  });

  it("handles a concave shape, where a bounding box would answer wrongly", () => {
    // Boomerang: the notch is inside the bbox but outside the polygon.
    const L = [[0, 0], [100, 0], [100, 40], [40, 40], [40, 100], [0, 100]] as number[][];
    expect(inRing(L, 20, 20)).toBe(true);
    expect(inRing(L, 80, 80)).toBe(false);
  });
});

describe("rasterize — the tallest obstacle owns the cell, with its own provenance", () => {
  const cover = (h: number, hs: number) => ({
    h, hs, r: [[0, 0], [CELL, 0], [CELL, CELL], [0, CELL]] as number[][],
  });

  it("marks a covered cell with the building height", () => {
    const { heights, src } = rasterize([cover(30, 1)], 2, 2);
    expect(heights[0]).toBe(30);
    expect(src[0]).toBe(1);
  });

  it("keeps the taller building AND its provenance, not the better-known one", () => {
    // If the shorter, measured building won the provenance, the clearance model
    // would apply a 0 m margin to an obstacle whose height is a guess.
    const { heights, src } = rasterize([cover(12, 0), cover(60, 2)], 2, 2);
    expect(heights[0]).toBe(60);
    expect(src[0]).toBe(2);
  });

  it("ignores order", () => {
    const a = rasterize([cover(60, 2), cover(12, 0)], 2, 2);
    const b = rasterize([cover(12, 0), cover(60, 2)], 2, 2);
    expect(a.heights).toEqual(b.heights);
    expect(a.src).toEqual(b.src);
  });

  it("does not block a cell a building merely clips at the corner", () => {
    // Cell-centre rule. Any-overlap would inflate every footprint by up to a
    // cell in each direction and make the city denser than it is.
    const corner = { h: 40, hs: 1, r: [[0, 0], [4, 0], [4, 4], [0, 4]] as number[][] };
    const { heights } = rasterize([corner], 2, 2);
    expect(heights[0]).toBe(0);
  });

  it("clips to the grid instead of writing out of bounds", () => {
    const outside = { h: 40, hs: 1, r: [[500, 500], [520, 500], [520, 520], [500, 520]] as number[][] };
    const { heights } = rasterize([outside], 2, 2);
    expect(heights).toEqual([0, 0, 0, 0]);
  });

  it("returns a grid of exactly cols*rows", () => {
    const { heights, src } = rasterize([], 7, 5);
    expect(heights).toHaveLength(35);
    expect(src).toHaveLength(35);
  });
});

describe("projection — must reproduce the committed twin, or routes miss the buildings", () => {
  it("derives the shipped Astana grid from the shipped bbox", () => {
    const { cols, rows, w, h } = projection(CITY.bbox);
    expect({ cols, rows }).toEqual({ cols: CITY.grid.cols, rows: CITY.grid.rows });
    expect({ w, h }).toEqual(CITY.meters);
  });

  it("places the bbox corner at the origin and grows south-east", () => {
    const { proj } = projection(CITY.bbox);
    const [x0, y0] = proj(CITY.bbox.minLon, CITY.bbox.maxLat);
    expect(Math.abs(x0)).toBeLessThan(1e-6);
    expect(Math.abs(y0)).toBeLessThan(1e-6);
    const [x1, y1] = proj(CITY.bbox.maxLon, CITY.bbox.minLat);
    expect(x1).toBeGreaterThan(0);
    expect(y1).toBeGreaterThan(0);
  });
});

describe("the committed Astana twin is internally consistent", () => {
  it("dataQuality counts match its own buildings array", () => {
    const q = CITY.dataQuality;
    const count = (hs: number) => CITY.buildings.filter((b) => b.hs === hs).length;
    expect(q.total).toBe(CITY.buildings.length);
    expect([q.measured, q.derived, q.guessed]).toEqual([count(0), count(1), count(2)]);
    expect(q.measured + q.derived + q.guessed).toBe(q.total);
    expect(q.measuredPct).toBeCloseTo((100 * q.measured) / q.total, 1);
    expect(q.realPct).toBeCloseTo((100 * (q.measured + q.derived)) / q.total, 1);
  });

  it("the grids are the declared size and carry no NaN", () => {
    const cells = CITY.grid.cols * CITY.grid.rows;
    expect(CITY.grid.heights).toHaveLength(cells);
    expect(CITY.grid.src).toHaveLength(cells);
    expect(CITY.grid.heights.every((h) => Number.isFinite(h) && h >= 0)).toBe(true);
    expect(CITY.grid.src.every((s) => s === 0 || s === 1 || s === 2)).toBe(true);
  });

  it("every vertiport sits inside the grid", () => {
    for (const v of CITY.vertiports) {
      expect(v.c).toBeGreaterThanOrEqual(0);
      expect(v.r).toBeGreaterThanOrEqual(0);
      expect(v.c).toBeLessThan(CITY.grid.cols);
      expect(v.r).toBeLessThan(CITY.grid.rows);
    }
  });
});
