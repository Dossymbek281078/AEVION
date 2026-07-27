import { describe, it, expect } from "vitest";
import {
  parseInfoboxHeights, publishedHeights, compareTagToArticle, storeyRatio,
} from "../scripts/lib/wiki-infobox.mjs";

// An OSM element that carries `wikipedia=` names its own reference, so its
// height tag can be checked against it with nothing brought in from outside.
// This is the check that pinned down the Astana defect.

// Verbatim from en:Abu Dhabi Plaza — the article way/486561786 links to.
const ABU_DHABI_PLAZA = `{{Infobox building
| name                    = Abu Dhabi Plaza
| location                = [[Astana]], Kazakhstan
| status                  = Completed<ref name="SC">{{cite web |url= http://skyscrapercenter.com/astana/abu-dhabi-plaza/260/|work= The Skyscraper Center}}</ref>
| antenna_spire           =
| roof                    = {{cvt|310.8|m}}<ref name="SC" />
| floor_count             = 75
}}`;

describe("parseInfoboxHeights", () => {
  it("reads the roof height and floor count out of the real article", () => {
    const box = parseInfoboxHeights(ABU_DHABI_PLAZA);
    expect(box.roof).toBe(310.8);
    expect(box.floors).toBe(75);
  });

  it("ignores a field the infobox leaves blank", () => {
    // `| antenna_spire           =` with nothing after it is the normal case.
    expect(parseInfoboxHeights(ABU_DHABI_PLAZA).antennaSpire).toBeUndefined();
  });

  it("converts a template stated in FEET instead of reading it as metres", () => {
    // {{convert|1454|ft|m}} is the Empire State Building's antenna height.
    // Reading 1454 as metres would put it above the troposphere.
    const box = parseInfoboxHeights("| antenna_spire = {{convert|1,454|ft|m}}");
    expect(box.antennaSpire).toBeCloseTo(443.2, 1);
  });

  it("reads a plain '310.8 m' as well as a template", () => {
    expect(parseInfoboxHeights("| roof = 310.8 m").roof).toBe(310.8);
  });

  it("returns nothing rather than guessing when the article has no infobox", () => {
    expect(parseInfoboxHeights("A building in Astana.")).toEqual({});
    expect(parseInfoboxHeights(null as unknown as string)).toEqual({});
  });

  it("does not match on a field that merely CONTAINS the name", () => {
    // `<gallery heights=150px>` sits in this very article and must not be read
    // as the building's height.
    expect(parseInfoboxHeights("<gallery mode=packed heights=150px>").height).toBeUndefined();
  });
});

describe("publishedHeights — the antenna and the roof are different questions", () => {
  it("separates the tallest published figure from the roof figure", () => {
    const box = { roof: 381, antennaSpire: 443.2, floors: 102 };
    expect(publishedHeights(box)).toMatchObject({ tallest: 443.2, roof: 381 });
  });

  it("falls back to whatever single figure exists", () => {
    expect(publishedHeights({ roof: 310.8 })).toMatchObject({ tallest: 310.8, roof: 310.8 });
    expect(publishedHeights({})).toMatchObject({ tallest: null, roof: null });
  });
});

describe("compareTagToArticle", () => {
  it("calls the Astana tag OVER what its own article publishes", () => {
    const box = parseInfoboxHeights(ABU_DHABI_PLAZA);
    const v = compareTagToArticle(382, box);
    expect(v.verdict).toBe("over");
    expect(v.published).toBe(310.8);
  });

  it("calls a tag UNDER the roof figure, which is the dangerous direction", () => {
    // 30 Rockefeller Plaza is tagged height=10 in OSM against ~259 m published.
    // The twin trusts a height tag completely, so an understated one is flown
    // over with no clearance at all.
    const v = compareTagToArticle(10, { roof: 259, floors: 70 });
    expect(v.verdict).toBe("under");
  });

  it("does NOT flag an antenna height against a roof figure", () => {
    // The Empire State Building: OSM says 443 m (antenna), the roof is 381 m.
    // Comparing against the roof alone would manufacture a disagreement.
    expect(compareTagToArticle(443, { roof: 381, antennaSpire: 443.2 }).verdict).toBe("agrees");
  });

  it("says unknown rather than inventing a verdict without data", () => {
    expect(compareTagToArticle(100, {}).verdict).toBe("unknown");
    expect(compareTagToArticle(0, { roof: 100 }).verdict).toBe("unknown");
  });
});

describe("storeyRatio", () => {
  it("calls 0.14 m per storey impossible — 30 Rockefeller Plaza in OSM today", () => {
    expect(storeyRatio(10, 70)).toMatchObject({ band: "impossible" });
  });

  it("calls 2.33 m per storey suspicious but does not act on it", () => {
    // Odakyu Southern Tower: OSM 84 m over 36 floors against ~150 m real. Real
    // buildings do sit in this band, so it is reported, not corrected.
    expect(storeyRatio(84, 36)).toMatchObject({ mPerFloor: 2.33, band: "suspicious" });
  });

  it("leaves ordinary and tall-storey buildings alone", () => {
    expect(storeyRatio(310.8, 75).band).toBe("normal");
    expect(storeyRatio(382, 75).band).toBe("normal"); // 5.09 — caught by the article check, not this one
    expect(storeyRatio(94.1, 2).band).toBe("high");
  });

  it("returns null instead of dividing by zero", () => {
    expect(storeyRatio(50, 0)).toBeNull();
    expect(storeyRatio(0, 10)).toBeNull();
  });
});
