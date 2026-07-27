import { describe, it, expect } from "vitest";
import {
  parsePosList, parseBuildingMember, parsePlateauGml, ringCentroid, reconcileWithPlateau,
} from "../scripts/lib/plateau-heights.mjs";
import { CITY_TOKYO } from "../src/routes/qskyway.city.tokyo";

// Tokyo's twin is the only one built from two sources, and the reconciliation
// between them decides how tall the router believes each building is. The
// defect this code exists to fix was invisible in every test, smoke and type
// check: the committed twin called 565 grid cells empty that OSM had buildings
// on, one of them a 168 m tower, because Tokyo could not be regenerated at all.

const member = (body: string) => `<bldg:Building gml:id="x">${body}</bldg:Building>`;
const roof = (...rings: string[]) =>
  `<bldg:lod0RoofEdge><gml:MultiSurface>${rings
    .map((r) => `<gml:surfaceMember><gml:Polygon><gml:exterior><gml:LinearRing><gml:posList>${r}</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></gml:surfaceMember>`)
    .join("")}</gml:MultiSurface></bldg:lod0RoofEdge>`;
const square = "35.6900 139.7000 0 35.6901 139.7000 0 35.6901 139.7001 0 35.6900 139.7001 0 35.6900 139.7000 0";

describe("parsePosList — the third component is ground elevation, not height", () => {
  it("reads lat/lon pairs out of the triplets", () => {
    expect(parsePosList("35.1 139.2 0 35.3 139.4 0")).toEqual([[35.1, 139.2], [35.3, 139.4]]);
  });

  it("drops the elevation rather than folding it into a coordinate", () => {
    // Shinjuku sits ~35 m above sea level. Keeping the third number would add
    // that terrain to every building in the city.
    const ring = parsePosList("35.1 139.2 35.7 35.3 139.4 35.9");
    for (const p of ring) expect(p).toHaveLength(2);
  });

  it("ignores a trailing partial triplet instead of inventing a point", () => {
    expect(parsePosList("35.1 139.2 0 35.3")).toEqual([[35.1, 139.2]]);
  });
});

describe("parseBuildingMember", () => {
  it("returns the roof outline and the measured height", () => {
    const b = parseBuildingMember(member(`<bldg:measuredHeight uom="m">42.5</bldg:measuredHeight>${roof(square)}`));
    expect(b?.h).toBe(42.5);
    expect(b?.rings).toHaveLength(1);
    expect(b?.rings[0]).toHaveLength(5);
  });

  it("takes the TALLEST measuredHeight, not the first one in the file", () => {
    // A ward that models BuildingParts publishes several. Taking the first
    // publishes whichever the file happens to list — for an obstacle grid that
    // can mean shipping the annex and hiding the tower.
    const b = parseBuildingMember(member(
      `<bldg:measuredHeight uom="m">9</bldg:measuredHeight>` +
      `<bldg:measuredHeight uom="m">180</bldg:measuredHeight>` +
      `<bldg:measuredHeight uom="m">31</bldg:measuredHeight>${roof(square)}`,
    ));
    expect(b?.h).toBe(180);
  });

  it("returns one entry per outer surface, so a complex is not merged", () => {
    const other = "35.6910 139.7010 0 35.6911 139.7010 0 35.6911 139.7011 0 35.6910 139.7010 0";
    const b = parseBuildingMember(member(`<bldg:measuredHeight uom="m">50</bldg:measuredHeight>${roof(square, other)}`));
    expect(b?.rings).toHaveLength(2);
  });

  it("skips a building with no height or no roof outline instead of guessing", () => {
    expect(parseBuildingMember(member(roof(square)))).toBeNull();
    expect(parseBuildingMember(member(`<bldg:measuredHeight uom="m">12</bldg:measuredHeight>`))).toBeNull();
    expect(parseBuildingMember(member(`<bldg:measuredHeight uom="m">0</bldg:measuredHeight>${roof(square)}`))).toBeNull();
    expect(parseBuildingMember("<tran:Road/>")).toBeNull();
  });

  it("THROWS when the coordinates are not latitude-first", () => {
    // EPSG:6697 is lat/lon. Reading it lon/lat puts Shinjuku in the Indian
    // Ocean: every match fails, no error is raised, and the twin quietly keeps
    // its OSM guesses while measuredPct still looks plausible. A silent
    // all-or-nothing failure is exactly what must not be allowed to be silent.
    const swapped = "139.7000 35.6900 0 139.7001 35.6900 0 139.7001 35.6901 0 139.7000 35.6900 0";
    expect(() => parseBuildingMember(member(`<bldg:measuredHeight uom="m">42</bldg:measuredHeight>${roof(swapped)}`)))
      .toThrow(/latitude/i);
  });
});

describe("parsePlateauGml", () => {
  const bbox = { minLat: 35.68, maxLat: 35.70, minLon: 139.69, maxLon: 139.71 };
  const far = "35.5000 139.5000 0 35.5001 139.5000 0 35.5001 139.5001 0 35.5000 139.5000 0";

  it("splits on cityObjectMember and keeps what is inside the bbox", () => {
    const gml =
      `<core:cityObjectMember>${member(`<bldg:measuredHeight uom="m">20</bldg:measuredHeight>${roof(square)}`)}</core:cityObjectMember>` +
      `<core:cityObjectMember>${member(`<bldg:measuredHeight uom="m">30</bldg:measuredHeight>${roof(far)}`)}</core:cityObjectMember>`;
    const got = parsePlateauGml(gml, bbox);
    expect(got).toHaveLength(1);
    expect(got[0].h).toBe(20);
  });

  it("returns nothing for a file with no buildings rather than throwing", () => {
    expect(parsePlateauGml("<core:CityModel/>", bbox)).toEqual([]);
  });
});

describe("reconcileWithPlateau — which outline is which building", () => {
  const sq = (x: number, y: number, s: number): number[][] =>
    [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]];

  it("identifies a building when the PLATEAU centroid falls inside the footprint", () => {
    const { heights } = reconcileWithPlateau([sq(0, 0, 40)], [{ h: 90, ring: sq(15, 15, 8) }]);
    expect(heights[0]).toMatchObject({ h: 90, how: "contained" });
  });

  it("identifies it the other way round too, when OSM draws the smaller outline", () => {
    // OSM often traces one wing of a complex PLATEAU models whole. A
    // one-directional test loses whichever side is subdivided.
    const { heights } = reconcileWithPlateau([sq(20, 20, 6)], [{ h: 70, ring: sq(0, 0, 60) }]);
    expect(heights[0]).toMatchObject({ h: 70, how: "contained" });
  });

  it("takes the TALLEST of several outlines standing on one footprint", () => {
    // Shinjuku Park Tower is one OSM outline over three PLATEAU towers. The
    // podium must not be the height published for the block.
    const { heights } = reconcileWithPlateau(
      [sq(0, 0, 100)],
      [{ h: 30, ring: sq(10, 10, 5) }, { h: 227, ring: sq(50, 50, 5) }, { h: 96, ring: sq(80, 80, 5) }],
    );
    expect(heights[0]).toMatchObject({ h: 227, sources: 3 });
  });

  it("falls back to the nearest outline when nothing is contained", () => {
    // OSM traces the ground floor where PLATEAU draws the roof edge, so the two
    // outlines of one building can miss each other completely.
    const { heights } = reconcileWithPlateau([sq(0, 0, 10)], [{ h: 45, ring: sq(18, 0, 6) }], { nearRadiusM: 20 });
    expect(heights[0]).toMatchObject({ h: 45, how: "near" });
  });

  it("reports no match rather than reaching past the radius", () => {
    // ~38 m away: far enough to be a different building, close enough that the
    // spatial index still offers it. Pushing it hundreds of metres out would
    // let the bucket sweep reject it first, and the radius check itself would
    // go untested — the test would pass for the wrong reason.
    const { heights } = reconcileWithPlateau([sq(0, 0, 10)], [{ h: 45, ring: sq(40, 0, 6) }], { nearRadiusM: 20 });
    expect(heights[0]).toMatchObject({ h: null, how: "none" });
  });

  it("still refuses an outline the index never offered", () => {
    const { heights } = reconcileWithPlateau([sq(0, 0, 10)], [{ h: 45, ring: sq(400, 0, 6) }], { nearRadiusM: 20 });
    expect(heights[0]).toMatchObject({ h: null, how: "none" });
  });

  it("prefers containment over a nearer outline that only sits alongside", () => {
    // Distance alone would pick the 3 m shed; containment says the 60 m tower
    // is the building. Getting this backwards is how the committed twin ended
    // up publishing a neighbouring tower's height for a 3 m structure.
    const { heights } = reconcileWithPlateau(
      [sq(0, 0, 40)],
      [{ h: 3, ring: sq(42, 18, 4) }, { h: 60, ring: sq(16, 16, 8) }],
      { nearRadiusM: 30 },
    );
    expect(heights[0]).toMatchObject({ h: 60, how: "contained" });
  });

  it("lists outlines no footprint accounts for — those are OSM's blind spots", () => {
    const { unmatched } = reconcileWithPlateau(
      [sq(0, 0, 40)],
      [{ h: 60, ring: sq(16, 16, 8) }, { h: 146, ring: sq(500, 500, 20) }],
    );
    expect(unmatched).toEqual([1]);
  });

  it("does not report an outline as unmatched once a footprint has claimed it", () => {
    const { unmatched } = reconcileWithPlateau([sq(0, 0, 40)], [{ h: 60, ring: sq(16, 16, 8) }]);
    expect(unmatched).toEqual([]);
  });

  it("handles an empty PLATEAU set without pretending every building is unknown-height", () => {
    const { heights, unmatched } = reconcileWithPlateau([sq(0, 0, 40)], []);
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

describe("the committed Tokyo twin carries what reconciliation produced", () => {
  it("has more buildings than OSM alone reported on 2026-07-13", () => {
    // 2068 was the frozen footprint count; the regression this guards is a
    // regeneration that silently drops back to an OSM-only or stale build.
    expect(CITY_TOKYO.buildings.length).toBeGreaterThan(2068);
  });

  it("still measures the overwhelming majority of its heights", () => {
    expect(CITY_TOKYO.dataQuality.measuredPct).toBeGreaterThan(90);
  });

  it("names BOTH sources, because the height class now depends on both", () => {
    expect(CITY_TOKYO.dataQuality.source).toMatch(/OSM/i);
    expect(CITY_TOKYO.dataQuality.source).toMatch(/PLATEAU/i);
  });

  it("sees the tallest structure PLATEAU surveyed inside the bbox", () => {
    // The committed twin topped out at 227 m while PLATEAU reports 240.6 m in
    // the same bbox — the tallest thing in Nishi-Shinjuku was understated.
    expect(Math.max(...CITY_TOKYO.grid.heights)).toBeGreaterThanOrEqual(240);
  });

  it("declares the derived class honestly, since it no longer means only levels", () => {
    expect(CITY_TOKYO.dataQuality.note).toMatch(/близости/);
  });
});
