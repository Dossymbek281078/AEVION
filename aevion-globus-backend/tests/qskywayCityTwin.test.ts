import { describe, it, expect } from "vitest";
import {
  CELL, DEFAULT_HEIGHT_M, METRES_PER_LEVEL, PARAPET_M, heightOutliers, MIN_STOREY_M, CONTRADICTION_MIN_LEVELS,
  projection, parseMetres, heightOf, toRing, ringsOf, inRing, rasterize, overpassProblem,
} from "../scripts/lib/city-twin-geometry.mjs";
import { CITY } from "../src/routes/qskyway.city";
import { CITY_NYC } from "../src/routes/qskyway.city.nyc";
import { CITY_TOKYO } from "../src/routes/qskyway.city.tokyo";

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
  // Every city, not just the one being worked on: a twin whose grid no longer
  // follows from its own bbox means the routes are planned against a frame that
  // has drifted from the buildings, and nothing else in the suite would notice.
  it.each([
    ["astana", CITY],
    ["nyc", CITY_NYC],
    ["tokyo", CITY_TOKYO],
  ])("derives the shipped %s grid from the shipped bbox", (_name, city) => {
    const { cols, rows, w, h } = projection(city.bbox);
    expect({ cols, rows }).toEqual({ cols: city.grid.cols, rows: city.grid.rows });
    expect({ w, h }).toEqual(city.meters);
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

describe("overpassProblem — a truncated answer must not be mistaken for data", () => {
  const ok = { elements: [{ type: "way", id: 1 }] };

  it("accepts a normal payload", () => {
    expect(overpassProblem(ok)).toBeNull();
    expect(overpassProblem({ ...ok, remark: "some harmless note" })).toBeNull();
  });

  it("rejects the remarks Overpass uses for an incomplete result", () => {
    // These arrive with HTTP 200 and a valid body — the ONLY signal that blocks
    // of the city are missing is this string.
    for (const remark of [
      'runtime error: Query timed out in "query" at line 3 after 180 seconds.',
      'runtime error: Query run out of memory in "query" at line 2 using about 2048 MB of RAM.',
      "Query timed out",
    ]) {
      expect(overpassProblem({ ...ok, remark })).toMatch(/incomplete/i);
    }
  });

  it("rejects empty and malformed payloads instead of building an empty city", () => {
    expect(overpassProblem({ elements: [] })).toMatch(/zero elements/);
    expect(overpassProblem({})).toMatch(/no elements array/);
    expect(overpassProblem(null)).toMatch(/non-object/);
    expect(overpassProblem("[]" as unknown as object)).toMatch(/non-object/);
  });
});

describe("the committed twins are internally consistent", () => {
  it.each([["astana", CITY], ["nyc", CITY_NYC], ["tokyo", CITY_TOKYO]])(
    "%s: dataQuality counts match its own buildings array", (_n, city) => {
    const q = city.dataQuality;
    const count = (hs: number) => city.buildings.filter((b) => b.hs === hs).length;
    expect(q.total).toBe(city.buildings.length);
    expect([q.measured, q.derived, q.guessed]).toEqual([count(0), count(1), count(2)]);
    expect(q.measured + q.derived + q.guessed).toBe(q.total);
    expect(q.measuredPct).toBeCloseTo((100 * q.measured) / q.total, 1);
    expect(q.realPct).toBeCloseTo((100 * (q.measured + q.derived)) / q.total, 1);
  });

  it.each([["astana", CITY], ["nyc", CITY_NYC], ["tokyo", CITY_TOKYO]])(
    "%s: the grids are the declared size and carry no NaN", (_n, city) => {
    const cells = city.grid.cols * city.grid.rows;
    expect(city.grid.heights).toHaveLength(cells);
    expect(city.grid.src).toHaveLength(cells);
    expect(city.grid.heights.every((h) => Number.isFinite(h) && h >= 0)).toBe(true);
    expect(city.grid.src.every((s) => s === 0 || s === 1 || s === 2)).toBe(true);
  });

  it.each([["astana", CITY], ["nyc", CITY_NYC], ["tokyo", CITY_TOKYO]])(
    "%s: every vertiport sits inside the grid", (_n, city) => {
    expect(city.vertiports.length).toBeGreaterThan(0);
    for (const v of city.vertiports) {
      expect(v.c).toBeGreaterThanOrEqual(0);
      expect(v.r).toBeGreaterThanOrEqual(0);
      expect(v.c).toBeLessThan(city.grid.cols);
      expect(v.r).toBeLessThan(city.grid.rows);
    }
  });
});

describe("heightOutliers — one wrong tag is trusted completely", () => {
  const city = (...hs: number[]) => hs.map((h) => ({ h, hs: 0, r: [] }));
  const skyline = Array.from({ length: 100 }, (_, i) => ({ h: 20 + i, hs: 1, r: [] }));

  it("flags a height towering over the 99th percentile", () => {
    // Astana: 382 m tagged on a 75-storey tower, next building 88 m. hs=0 means
    // SRC_CLEARANCE adds nothing on top — the twin trusts the tag absolutely.
    const found = heightOutliers([...skyline, ...city(382)]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ h: 382, hs: 0 });
  });

  it("leaves a genuine tapering skyline alone", () => {
    // NYC 443 m over a p99 of 172 m and Tokyo 241 over 130 both stay silent;
    // a real skyline tapers, so the tallest is a multiple, not an order.
    expect(heightOutliers(skyline)).toEqual([]);
    expect(heightOutliers([...skyline, ...city(240)])).toEqual([]);
  });

  it("says nothing about a city too small to have a distribution", () => {
    expect(heightOutliers(city(12, 900))).toEqual([]);
  });
});

describe("the committed twins publish what the generator could not vouch for", () => {
  it("Astana ships the height that towers over it, with the building it belongs to", () => {
    // height=382 tagged on a 75-storey tower: 5.1 m per storey, against a
    // published 311 m. It enters as MEASURED, so the corridor clears it with no
    // safety margin at all. Hiding that would make the twin look cleaner than
    // it is; the fix belongs upstream in OSM, the disclosure belongs here.
    const suspect = CITY.dataQuality.suspect ?? [];
    expect(suspect).toHaveLength(1);
    expect(suspect[0].h).toBe(382);
    expect(suspect[0].times).toBeGreaterThan(3);
    expect(CITY.buildings[suspect[0].i].h).toBe(suspect[0].h);
    expect(CITY.buildings[suspect[0].i].hs).toBe(0);
  });

  it("a city with nothing to flag omits the field rather than shipping an empty list", () => {
    // An always-present empty array reads, on a chip, as "checked and fine" in
    // exactly the same way as "never checked". Absence is the honest shape.
    expect(CITY_NYC.dataQuality.suspect).toBeUndefined();
  });

  it("Tokyo reports the height tags its own floor counts contradicted", () => {
    // Two buildings carry a height tag impossible beside their floor count
    // (14 m over 8 and over 10 storeys). The twin uses the floor-derived height
    // and says so, instead of publishing the impossible number as measured.
    const suspect = CITY_TOKYO.dataQuality.suspect ?? [];
    expect(suspect.length).toBeGreaterThan(0);
    for (const o of suspect) {
      expect(o.why).toMatch(/contradicted/);
      expect(o.h).toBeGreaterThan(o.was!);
      // Deliberately NOT asserting the building's final provenance: a later
      // stage may still identify it with a surveyed outline and re-measure it.
      // The record says what the OSM tag claimed and what we used instead of
      // it — not how the story ended.
      expect(CITY_TOKYO.buildings[o.i]).toBeDefined();
    }
  });
});

describe("heightOf — a measured tag its own source contradicts is not a measurement", () => {
  it("prefers the floor count when the height tag is impossible beside it", () => {
    // way/572495079 in Nishi-Shinjuku: height=7 with building:levels=47, i.e.
    // 0.15 m per storey. It shipped in the twin as MEASURED, which buys zero
    // safety clearance, so corridors were planned through a 47-storey building
    // at seven metres. PLATEAU did not cover that footprint, so nothing
    // downstream caught it.
    const got = heightOf({ height: "7", "building:levels": "47" });
    expect(got.h).toBe(Math.round(47 * METRES_PER_LEVEL + PARAPET_M));
    expect(got.hs).toBe(1);
    expect(got.contradicted).toBe(7);
  });

  it("does not touch a height tag that merely sits low", () => {
    // 3 m per storey is a normal building, not a contradiction. The rule must
    // fire on the impossible, not on the merely short — otherwise it becomes a
    // second, silent height model competing with the source.
    const got = heightOf({ height: "30", "building:levels": "10" });
    expect(got).toMatchObject({ h: 30, hs: 0 });
    expect(got.contradicted).toBeUndefined();
  });

  it("leaves single-storey structures alone, where the two tags do not really disagree", () => {
    // A canopy tagged levels=1, height=1 is a modelling convention. Treating it
    // as a hidden tower would inflate every awning in the city — eleven such
    // rows exist in Nishi-Shinjuku against three genuine contradictions.
    expect(heightOf({ height: "1", "building:levels": "1" })).toMatchObject({ h: 1, hs: 0 });
    expect(heightOf({ height: "1", "building:levels": "2" })).toMatchObject({ h: 1, hs: 0 });
    expect(CONTRADICTION_MIN_LEVELS).toBe(3);
  });

  it("keeps the boundary where a storey stops being possible", () => {
    expect(MIN_STOREY_M).toBe(2);
    // exactly 2 m per storey is allowed; below it is not
    expect(heightOf({ height: "20", "building:levels": "10" })).toMatchObject({ hs: 0 });
    expect(heightOf({ height: "19", "building:levels": "10" })).toMatchObject({ hs: 1 });
  });

  it("still needs BOTH tags — one alone says nothing about the other", () => {
    expect(heightOf({ height: "7" })).toMatchObject({ h: 7, hs: 0 });
    expect(heightOf({ "building:levels": "47" })).toMatchObject({ hs: 1 });
  });
});
