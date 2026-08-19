import { describe, it, expect } from "vitest";
import {
  parseInfoboxHeights, publishedHeights, compareTagToArticle, storeyRatio, extractInfobox,
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
    // Reading 1454 as metres would put the building above the troposphere.
    const box = parseInfoboxHeights("| tip = {{convert|1,454|ft|m}}");
    expect(box.tip).toBeCloseTo(443.2, 1);
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

// Verbatim field shape from en:Empire State Building. `antenna_spire` is the
// mast's OWN length, not the elevation of its top — the height to the top lives
// in `tip`. The first version of this module treated the spire as an elevation,
// which would have published the tallest thing in Midtown as 62 m.
const EMPIRE_STATE = `{{Infobox building
| roof             = {{cvt|1250|ft|m|1}}<ref name=skyscrapercenter />
| tip              = {{cvt|1454|ft|m|1}}<ref name=skyscrapercenter/>
| antenna_spire    = {{cvt|204|ft|m|1}}<ref name=skyscrapercenter/>
| floor_count      = 102<ref name=skyscrapercenter />
}}`;

describe("publishedHeights — the mast and the roof are different questions", () => {
  it("reads the real Empire State infobox without mistaking the spire for the top", () => {
    const box = parseInfoboxHeights(EMPIRE_STATE);
    expect(box.roof).toBeCloseTo(381, 0);
    expect(box.tip).toBeCloseTo(443.2, 1);
    expect(box.antennaSpire).toBeCloseTo(62.2, 1); // the mast itself, 204 ft
    expect(publishedHeights(box)).toMatchObject({ tallest: box.tip, roof: box.roof });
  });

  it("does NOT flag OSM's 443 m against this article", () => {
    // OSM tags the Empire State Building at 443 m, which is the tip and is what
    // an aircraft must clear. An audit that cried wolf on the most famous
    // building in the bbox would be ignored on the next one.
    expect(compareTagToArticle(443, parseInfoboxHeights(EMPIRE_STATE)).verdict).toBe("agrees");
  });

  it("separates the tallest published figure from the roof figure", () => {
    const box = { roof: 381, tip: 443.2, floors: 102 };
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

  it("does NOT flag a mast-top height against a roof figure", () => {
    // Comparing against the roof alone would manufacture a disagreement.
    expect(compareTagToArticle(443, { roof: 381, tip: 443.2 }).verdict).toBe("agrees");
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

// Verbatim from ja:東京都庁舎 — the article way/89877471 links to. Japanese
// infoboxes name their fields in Japanese, and until this parser learned them a
// Tokyo audit read NONE of the 35 articles its elements link to and still
// printed "no findings".
const TOCHO_JA = `{{建築物
|建築面積 = 11042
|階数 = 地上48階、地下3階
|高さ = 243.4m（軒高：241.9m）
}}`;

describe("японская карточка — иначе аудит Токио проверяет ноль статей", () => {
  it("reads 高さ as the overall height and 軒高 as the roof figure", () => {
    const box = parseInfoboxHeights(TOCHO_JA);
    expect(box.height).toBeCloseTo(243.4, 1);
    expect(box.roof).toBeCloseTo(241.9, 1);
    expect(publishedHeights(box)).toMatchObject({ tallest: 243.4, roof: 241.9 });
  });

  it("counts only above-ground storeys out of 地上48階、地下3階", () => {
    // Basements are not obstacles; reading 3 would make the ratio nonsense.
    expect(parseInfoboxHeights(TOCHO_JA).floors).toBe(48);
  });

  it("flags the Metropolitan Government Building as UNDERstated in OSM", () => {
    // OSM tags way/89877471 at 133 m. Its own article publishes 243.4 m — and
    // this is the dangerous direction, since a height tag is trusted with zero
    // clearance. Tokyo's PLATEAU survey corrects it downstream; a city without
    // one would fly the understated figure.
    expect(compareTagToArticle(133, parseInfoboxHeights(TOCHO_JA)).verdict).toBe("under");
  });
});

describe("японские записи высоты, на которых парсер молчал", () => {
  it("reads a full-width ｍ — 新宿三井ビルディング publishes 223.6ｍ", () => {
    // U+FF4D, not ASCII m. Matching only ASCII made the article look empty
    // rather than unparsed, which is exactly the silence this module fights.
    expect(parseInfoboxHeights("|高さ = 223.6ｍ<ref name=\"m\" />").height).toBeCloseTo(223.6, 1);
  });

  it("reads figures stated in WORDS, not leading with a number", () => {
    // 小田急サザンタワー: `|高さ = 軒高 146.55 m、最高部 150.75 m`.
    // 最高部 is what an aircraft clears; 軒高 is the roof deck.
    const box = parseInfoboxHeights("|高さ = 軒高 146.55 m、最高部 150.75 m");
    expect(box.height).toBeCloseTo(150.75, 2);
    expect(box.roof).toBeCloseTo(146.55, 2);
  });

  it("flags Odakyu Southern Tower, tagged 84 m in OSM, as understated", () => {
    const box = parseInfoboxHeights("|高さ = 軒高 146.55 m、最高部 150.75 m");
    expect(compareTagToArticle(84, box).verdict).toBe("under");
  });
});

describe("единица, записанная вики-ссылкой", () => {
  it("reads `210.3 [[メートル|m]]` — 新宿住友ビルディング", () => {
    // Requiring a bare letter after the number reads no height at all, and the
    // article then looks like it states none. Sixteen of Tokyo's 35 linked
    // articles were unread for reasons of this shape.
    expect(parseInfoboxHeights("|高さ = 210.3 [[メートル|m]]{{Sfn|x|1992}}").height).toBeCloseTo(210.3, 1);
  });

  it("reads the unlinked form too", () => {
    expect(parseInfoboxHeights("|高さ = 117.10 [[メートル]]").height).toBeCloseTo(117.1, 1);
  });

  it("still refuses a linked unit that is not metres", () => {
    expect(parseInfoboxHeights("|高さ = 500 [[尺]]").height).toBeUndefined();
  });
});

describe("границы карточки — поле чужой карточки не является заявлением о здании", () => {
  // ja:JR東日本本社ビル carries two infoboxes: the building's own leaves its
  // height fields empty, and a later one — for something else — says 31 m. The
  // building is 150.1 m. Scanning the whole page reported the tower as OVERstated.
  const TWO_BOXES = `{{基礎情報 超高層ビル
|アンテナ_尖塔 = <!--アンテナや尖塔も含めた最頂部の高さ-->
|屋上 = <!--屋上の高さ-->
|階数 = 地上28階、地下4階
}}
本文。高さはそれぞれ、最高部150.1メートル。
{{記念碑
|高さ = 31 [[メートル|m]]
}}`;

  it("does not read a height out of a SECOND infobox", () => {
    expect(parseInfoboxHeights(TWO_BOXES).height).toBeUndefined();
    expect(compareTagToArticle(150, parseInfoboxHeights(TWO_BOXES)).verdict).toBe("unknown");
  });

  it("takes the first infobox whole, braces balanced", () => {
    const box = extractInfobox(TWO_BOXES);
    expect(box).toMatch(/基礎情報/);
    expect(box).not.toMatch(/記念碑/);
  });

  it("survives nested templates inside the infobox", () => {
    const nested = `{{Infobox building
| roof = {{cvt|310.8|m}}<ref>{{cite web |title={{nowrap|x}}}}</ref>
}}
{{other| roof = 5 m}}`;
    expect(parseInfoboxHeights(nested).roof).toBe(310.8);
  });

  it("falls back to the whole text when there is no infobox at all", () => {
    expect(parseInfoboxHeights("| roof = 310.8 m").roof).toBe(310.8);
  });

  it("refuses an unbalanced infobox rather than guessing where it ends", () => {
    expect(extractInfobox("{{Infobox building\n| roof = 5 m")).toBeNull();
  });
});
