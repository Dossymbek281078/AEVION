import { describe, it, expect } from "vitest";
import { parseNycBuildings, nycBuildingsQuery, FEET_TO_M } from "../scripts/lib/nyc-open-data.mjs";
import { CITY_NYC } from "../src/routes/qskyway.city.nyc";

// New York's survey is the cheapest of the three authority sources to ingest and
// the easiest to get silently wrong: the heights are in feet and they stop at
// the roof. Both mistakes produce a twin that looks entirely normal.

const poly = (ring: number[][]) => ({ type: "MultiPolygon", coordinates: [[ring]] });
const square = [[-73.98, 40.75], [-73.979, 40.75], [-73.979, 40.751], [-73.98, 40.751], [-73.98, 40.75]];

describe("parseNycBuildings — feet, and only the roof", () => {
  it("converts height_roof from FEET to metres", () => {
    // 1238.79 ft on a 1931 building is the Empire State Building (1250 ft to
    // the roof). Reading the number as metres would put it at 1.2 km.
    const [b] = parseNycBuildings([{ height_roof: "1238.79", the_geom: poly(square) }]);
    expect(b.h).toBeCloseTo(377.6, 1);
    expect(FEET_TO_M).toBe(0.3048);
  });

  it("keeps the ring in [lon, lat] order, as GeoJSON gives it", () => {
    // The CityGML source is latitude-first and this one is not. Normalising in
    // the wrong direction lands Midtown in the Southern Ocean.
    const [b] = parseNycBuildings([{ height_roof: "100", the_geom: poly(square) }]);
    expect(b.ring[0][0]).toBeLessThan(-70);
    expect(b.ring[0][1]).toBeGreaterThan(40);
  });

  it("drops rows with no usable height instead of defaulting them", () => {
    // NYC gives planned footprints height_roof 0 and the status "Marked for
    // Construction". A default would place an obstacle where nothing stands.
    const rows = [
      { height_roof: "0", last_status_type: "Marked for Construction", the_geom: poly(square) },
      { height_roof: "", the_geom: poly(square) },
      { the_geom: poly(square) },
      { height_roof: "-5", the_geom: poly(square) },
    ];
    expect(parseNycBuildings(rows)).toEqual([]);
  });

  it("keeps buildings whose RECORD is mid-edit, because the building still stands", () => {
    // Alteration / Merged / Initialization / Correction describe the row, not
    // the world. Eighteen of them stand in the Midtown bbox, up to 275 m.
    const rows = ["Alteration", "Merged", "Initialization", "Correction"].map((s) => ({
      height_roof: "300", last_status_type: s, the_geom: poly(square),
    }));
    expect(parseNycBuildings(rows)).toHaveLength(4);
  });

  it("takes only the outer ring of each polygon", () => {
    const inner = [[-73.7995, 40.7505], [-73.7994, 40.7505], [-73.7994, 40.7506], [-73.7995, 40.7505]];
    const withHole = { type: "MultiPolygon", coordinates: [[square, inner]] };
    const [b] = parseNycBuildings([{ height_roof: "100", the_geom: withHole }]);
    expect(b.ring).toHaveLength(square.length);
  });

  it("survives a malformed or missing geometry rather than emitting a hole", () => {
    const rows = [
      { height_roof: "100" },
      { height_roof: "100", the_geom: { type: "Point", coordinates: [0, 0] } },
      { height_roof: "100", the_geom: { type: "MultiPolygon", coordinates: [[[[1, 2]]]] } },
    ];
    expect(parseNycBuildings(rows)).toEqual([]);
    expect(parseNycBuildings(null as unknown as unknown[])).toEqual([]);
  });

  it("accepts a plain Polygon as well as a MultiPolygon", () => {
    const got = parseNycBuildings([{ height_roof: "100", the_geom: { type: "Polygon", coordinates: [square] } }]);
    expect(got).toHaveLength(1);
  });
});

describe("nycBuildingsQuery — within_box corner order", () => {
  it("puts the NORTH-WEST corner first and the SOUTH-EAST second", () => {
    // Swapping them returns an empty result set, not an error — which reads as
    // "the city has no data here" and leaves the twin on its guesses.
    const url = nycBuildingsQuery({ minLat: 40.74, maxLat: 40.76, minLon: -74.0, maxLon: -73.97 });
    expect(decodeURIComponent(url)).toContain("within_box(the_geom,40.76,-74,40.74,-73.97)");
  });

  it("asks for the fields the parser actually reads", () => {
    const url = decodeURIComponent(nycBuildingsQuery({ minLat: 1, maxLat: 2, minLon: 3, maxLon: 4 }));
    expect(url).toContain("height_roof");
    expect(url).toContain("the_geom");
  });
});

describe("the committed NYC twin carries the city's survey", () => {
  it("names the city survey alongside OSM", () => {
    expect(CITY_NYC.dataQuality.source).toMatch(/OSM/i);
    expect(CITY_NYC.dataQuality.source).toMatch(/NYC Open Data/i);
  });

  it("measures nearly everything, where it used to guess 259 buildings blind", () => {
    expect(CITY_NYC.dataQuality.measuredPct).toBeGreaterThan(95);
  });

  it("still clears the Empire State ANTENNA, not just its roof", () => {
    // The city's height_roof for it is 377.6 m. OSM's tag, 443 m, includes the
    // antenna — and the antenna is what an aircraft has to clear. If taking the
    // taller of two measurements ever regresses to "the official one wins",
    // this is the number that drops.
    expect(Math.max(...CITY_NYC.grid.heights)).toBeGreaterThanOrEqual(440);
  });
});
