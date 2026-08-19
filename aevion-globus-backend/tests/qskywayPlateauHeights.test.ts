import { describe, it, expect } from "vitest";
import { parsePosList, parseBuildingMember, parsePlateauGml } from "../scripts/lib/plateau-heights.mjs";
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
