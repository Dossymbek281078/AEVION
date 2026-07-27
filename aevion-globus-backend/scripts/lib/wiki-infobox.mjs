/**
 * QSkyway — read a building's published height out of the article the OSM
 * element itself links to.
 *
 * WHY THIS EXISTS: an OSM element carrying `wikipedia=` names its own reference,
 * so its `height` tag can be checked against it without appealing to anything
 * outside the data. That is how the Astana defect was pinned down on 2026-07-27:
 * way/486561786 tags height=382, while the article it links to gives
 * `roof = {{cvt|310.8|m}}` sourced to the CTBUH Skyscraper Center — and states
 * the same 75 floors the element does. A disagreement an element has with its
 * own citation needs no third party to adjudicate.
 *
 * Pure: parsing only. The audit script does the network.
 *
 * ⚠ REGEXES HERE ARE LITERALS ON PURPOSE. The first version of this check built
 * them with `new RegExp("\\|\\s*" + key + "…")` and was run through a shell,
 * which ate one level of backslashes: the pattern degraded to `|s*roofs*=s*(…)`,
 * an alternation whose empty left branch matches at index 0 and captures
 * nothing. The code then reported "this article states no height" — a FALSE
 * NEGATIVE that reads exactly like a finding about the data. It was caught only
 * because the same article had already been read by hand. Never assemble these
 * from strings.
 */

/**
 * Infobox values are wrapped in conversion templates far more often than not:
 *   {{cvt|310.8|m}}   {{convert|1,454|ft|m}}   310.8 m
 * The first number after the template name is the one in the stated unit, so a
 * `|ft|` template yields FEET and must not be read as metres.
 */
function firstQuantity(raw) {
  const cvt = /\{\{\s*(?:cvt|convert)\s*\|\s*([\d.,]+)\s*\|\s*([a-zA-Z]+)/.exec(raw);
  if (cvt) {
    const n = Number(cvt[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) return null;
    const unit = cvt[2].toLowerCase();
    if (unit === "m") return n;
    if (unit === "ft") return Math.round(n * 0.3048 * 10) / 10;
    return null;
  }
  const plain = /^\s*([\d.,]+)\s*m\b/.exec(raw);
  if (plain) {
    const n = Number(plain[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const FIELD = {
  // `tip` is the height TO the top of the mast — the number an obstacle grid has
  // to clear. It is NOT `antenna_spire`, which in Infobox building is the mast's
  // OWN length: the Empire State Building publishes roof 1250 ft, tip 1454 ft
  // and antenna_spire 204 ft. Reading the spire as an elevation would call the
  // tallest thing in Midtown 62 metres. Found by running this audit against the
  // real article — the fixture written from memory had encoded the mistake.
  tip: /\|[ \t]*tip[ \t]*=([^\n]*)/,
  roof: /\|[ \t]*roof[ \t]*=([^\n]*)/,
  architectural: /\|[ \t]*architectural[ \t]*=([^\n]*)/,
  // 高さ is the Japanese infobox's overall height. Without it a Tokyo audit
  // reads none of the articles its elements link to and reports "no findings"
  // about a city it never checked — which is how this parser first passed Tokyo
  // while OSM had the Metropolitan Government Building at 133 m against the
  // 243.4 m its own article publishes.
  height: /\|[ \t]*(?:height|高さ)[ \t]*=([^\n]*)/,
  // Parsed for reporting only, and deliberately not a candidate for `tallest`.
  antennaSpire: /\|[ \t]*antenna_spire[ \t]*=([^\n]*)/,
};
// 軒高 ("eave height") is the Japanese roof-deck figure, published inside the
// same line as the overall height: 高さ = 243.4m（軒高：241.9m）.
const EAVE = /軒高[：:][ \t]*([\d.,]+)[ \t]*m/;
// floor_count, or 階数 = 地上48階、地下3階 — above-ground storeys only, because
// basements are not obstacles.
const FLOORS = /\|[ \t]*floor_count[ \t]*=[ \t]*([\d]+)|\|[ \t]*階数[ \t]*=[ \t]*地上([\d]+)階/;

/**
 * Wikitext → { roof?, architectural?, antennaSpire?, height?, floors? } in
 * metres. Missing and unparseable fields are simply absent — an infobox that
 * leaves `antenna_spire` blank is the normal case, not an error.
 */
export function parseInfoboxHeights(wikitext) {
  const out = {};
  if (typeof wikitext !== "string") return out;
  for (const [key, re] of Object.entries(FIELD)) {
    const m = re.exec(wikitext);
    if (!m) continue;
    const v = firstQuantity(m[1]);
    if (v !== null && v > 0) out[key] = v;
  }
  if (out.roof === undefined) {
    const eave = EAVE.exec(wikitext);
    if (eave) {
      const v = Number(eave[1].replace(/,/g, ""));
      if (Number.isFinite(v) && v > 0) out.roof = v;
    }
  }
  const f = FLOORS.exec(wikitext);
  if (f) out.floors = Number(f[1] ?? f[2]);
  return out;
}

/**
 * The tallest published figure, and the roof-only figure, from one infobox.
 *
 * Both matter and they are different questions. An obstacle grid has to clear
 * the ANTENNA, so `tallest` is what an OSM height tag may legitimately equal.
 * `roof` is what a city survey measuring to the roof deck should agree with.
 * Comparing the wrong pair manufactures disagreements: NYC's own survey puts the
 * Empire State Building at 377.6 m and OSM at 443 m, and neither is wrong.
 */
export function publishedHeights(box) {
  const tallest = [box.tip, box.architectural, box.height, box.roof]
    .filter((v) => typeof v === "number");
  const roofish = [box.roof, box.architectural, box.height]
    .filter((v) => typeof v === "number");
  return {
    tallest: tallest.length ? Math.max(...tallest) : null,
    roof: roofish.length ? Math.min(...roofish) : null,
  };
}

/**
 * How an OSM `height` tag stands against what the article publishes.
 *
 * `over` — the tag exceeds every published figure by more than tolerance. This
 * is the Astana case (382 against 310.8) and it costs a detour, not a collision.
 * `under` — the tag falls below the roof figure by more than tolerance. This is
 * the dangerous direction: the twin trusts a height tag completely, so an
 * understated one is flown over with no clearance at all.
 */
export function compareTagToArticle(tagMetres, box, { tolerance = 0.1 } = {}) {
  const { tallest, roof } = publishedHeights(box);
  if (!(tagMetres > 0) || tallest === null) return { verdict: "unknown" };
  if (tagMetres > tallest * (1 + tolerance)) {
    return { verdict: "over", published: tallest, ratio: Math.round((100 * tagMetres) / tallest) / 100 };
  }
  if (roof !== null && tagMetres < roof * (1 - tolerance)) {
    return { verdict: "under", published: roof, ratio: Math.round((100 * tagMetres) / roof) / 100 };
  }
  return { verdict: "agrees", published: tallest };
}

/**
 * Metres per storey, for elements that publish both a height and a floor count.
 *
 * No storey is under two metres, so anything below that is the source
 * contradicting itself — the same test heightOf applies before trusting a tag.
 * Between 2 and 2.8 the building is merely unusual: real examples exist (deep
 * plant floors, mezzanines counted as storeys), so it is reported, not acted on.
 */
export function storeyRatio(heightMetres, levels) {
  if (!(heightMetres > 0) || !(levels >= 1)) return null;
  const mPerFloor = heightMetres / levels;
  const band = mPerFloor < 2 ? "impossible" : mPerFloor < 2.8 ? "suspicious" : mPerFloor > 6 ? "high" : "normal";
  return { mPerFloor: Math.round(mPerFloor * 100) / 100, band };
}
