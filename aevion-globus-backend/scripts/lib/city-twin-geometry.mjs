/**
 * QSkyway — pure geometry and provenance rules behind a city digital-twin.
 *
 * Extracted from scripts/fetch-city-twin.mjs so it can be tested. Everything the
 * committed twins depend on lives here, and every function is pure: no fetch, no
 * filesystem, no module-level mutable state. A defect in this file corrupts the
 * obstacle grid of every city at once — and the one bug already found here (a
 * multipolygon relation flattened into a single zig-zag ring) was caught by
 * comparing against OSM by hand, which is not a thing that runs in CI.
 *
 * Constants are exported rather than inlined because src/routes/qskyway.ts reads
 * the SAME provenance codes through SRC_CLEARANCE: hs 0 measured / 1 derived /
 * 2 guessed. The two files must agree or the safety clearance is applied to the
 * wrong confidence class.
 */

export const METRES_PER_LEVEL = 3.2;
// Parapet/roof allowance on top of the storey stack. Recovered, not invented:
// matching every committed Astana building to its OSM element by footprint
// centroid and testing candidate formulas over all 159 pairs carrying
// `building:levels` gives levels*3.2 + 1.6 → 159/159, levels*3.2 → 0/159,
// levels*3.5 → 65/159.
export const PARAPET_M = 1.6;
export const DEFAULT_HEIGHT_M = 12;
export const CELL = 20;
export const M_PER_LAT = 110540;
export const M_PER_LON_EQ = 111320;

/**
 * Overpass answers HTTP 200 with a PARTIAL element list when a query runs out
 * of time or memory, reporting it only in a top-level `remark`. Nothing about
 * the response shape says "incomplete" — you get a valid JSON body with fewer
 * buildings, which rasterizes into a city that is quietly missing blocks.
 *
 * That is exactly the shape of the defect found in the committed NYC twin on
 * 2026-07-27: 1930 grid cells (21.8%) held buildings the twin did not know
 * about, including Penn Station, and only 10.6% were explicable as multipolygon
 * handling. A silent truncation of the original query fits the evidence.
 *
 * Returns a reason string when the payload must not be trusted, else null.
 */
/**
 * An OVERLOADED Overpass answers with HTTP **200** and an HTML page:
 *
 *   <strong style="color:#FF0000">Error</strong>: runtime error: …
 *   The server is probably too busy to handle your request.
 *
 * Checking `res.ok` therefore passes, and `res.json()` then throws
 * "Unexpected token '<'" — which reads like a bug in our parser rather than a
 * busy server, and hides the explanation the server actually gave. Markup has to
 * be stripped before looking for the message, because the word Error sits in its
 * own tag.
 *
 * Returns a reason string when the body is not the JSON we asked for, else null.
 */
export function overpassBodyProblem(body) {
  if (typeof body !== "string" || !body.trimStart().startsWith("{")) {
    const plain = String(body ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    const said = /Error:?\s*(.{0,160})/.exec(plain);
    return said && said[1].trim()
      ? `Overpass answered with a page, not data — ${said[1].trim()}`
      : "Overpass answered with a non-JSON body (server busy?)";
  }
  return null;
}

export function overpassProblem(json) {
  if (!json || typeof json !== "object") return "Overpass returned a non-object payload";
  if (!Array.isArray(json.elements)) return "Overpass returned no elements array";
  const remark = typeof json.remark === "string" ? json.remark : "";
  if (/runtime error|out of memory|timed out/i.test(remark)) {
    return `Overpass reported an incomplete result: ${remark.trim()}`;
  }
  if (json.elements.length === 0) return "Overpass returned zero elements for this bbox";
  return null;
}

/**
 * Local metric frame for a bbox. Must stay identical to projector() in
 * src/routes/qskyway.ts: routes are planned on this grid, so a divergence here
 * would offset every corridor from the buildings it is meant to avoid.
 */
export function projection(bbox) {
  const { minLat, maxLat, minLon, maxLon } = bbox;
  const lat0 = (minLat + maxLat) / 2;
  const mPerLon = M_PER_LON_EQ * Math.cos((lat0 * Math.PI) / 180);
  const proj = (lon, lat) => [(lon - minLon) * mPerLon, (maxLat - lat) * M_PER_LAT];
  // ROUND, not floor. All three committed twins round (Astana 2290.99 → 2291,
  // NYC 1715.67 → 1716, Tokyo 1578.81 → 1579); flooring matches none of them and
  // systematically under-reports the extent. The first version of this file
  // floored, and because cols/rows come through Math.ceil the grid was identical
  // either way — so the regenerated twins shipped a `meters` that was quietly
  // 1 m short while every test still passed. Caught only by asserting that each
  // committed twin still follows from its own bbox.
  const w = Math.round((maxLon - minLon) * mPerLon);
  const h = Math.round((maxLat - minLat) * M_PER_LAT);
  return { proj, w, h, cols: Math.ceil(w / CELL), rows: Math.ceil(h / CELL) };
}

/**
 * A tag may read "42", "42 m", "42.5m". Anything unparseable returns null and
 * falls through to the next source rather than becoming NaN — a NaN height
 * rasterizes to a hole in the obstacle grid, i.e. a corridor flown straight
 * through a building.
 */
export function parseMetres(v) {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(-?\d+(?:\.\d+)?)\s*m?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// The shortest storey anyone builds. Used only to decide whether a `height` tag
// CONTRADICTS the floor count published beside it — not to estimate anything.
export const MIN_STOREY_M = 2;
// Below this many floors the two tags stop disagreeing in any meaningful way: a
// canopy tagged `building:levels=1, height=1` is a modelling convention, not a
// hidden tower, and "correcting" it would inflate every awning in the city.
export const CONTRADICTION_MIN_LEVELS = 3;
/**
 * Structures where `building:levels` does not describe the structure at all.
 *
 * A `building=roof` is a canopy: an awning over a forecourt, a station platform
 * cover, a fuel-station shelter. Mappers routinely give it the floor count of
 * whatever it is attached to. way/572495079 in Nishi-Shinjuku is exactly that —
 * height=7 with building:levels=47 — and the 7 m is RIGHT: PLATEAU surveyed the
 * same footprint at 7 m. Treating that as a contradiction would have inflated a
 * canopy into a 152 m obstacle, and only a second source stood between the rule
 * and that outcome. Astana has no second source, so this exclusion is what keeps
 * the rule from inventing towers there. Tokyo alone carries 49 such structures.
 */
export const LEVELS_MEANINGLESS_FOR = new Set(["roof", "canopy", "carport"]);

export function heightOf(tags = {}) {
  const explicit = parseMetres(tags.height) ?? parseMetres(tags["building:height"]);
  const levels = parseMetres(tags["building:levels"]);

  // A measured tag that its OWN source contradicts is not a measurement.
  //
  // In the shipped Tokyo twin: way/144093559 (高倉第一ビル) carries height=14
  // alongside building:levels=8, i.e. 1.75 m per storey. It entered the obstacle
  // grid as hs=0, MEASURED, which buys zero safety clearance — so an eight-floor
  // building was published at fourteen metres and flown over with none.
  //
  // Understating an obstacle is the expensive direction of this failure, and no
  // outside source is needed to see it: the source disagrees with itself, so we
  // fall back to its other claim and mark the result DERIVED — which is both
  // honest and buys back the clearance a guess deserves.
  //
  // The exclusion below is not a footnote. The first version of this rule had no
  // exclusion and would have raised a 7 m canopy to 152 m; only PLATEAU, which
  // had surveyed the same footprint, stood in the way. A rule that needs a
  // second source to stay safe is not safe in the city that has none.
  if (explicit !== null && levels !== null && levels >= CONTRADICTION_MIN_LEVELS
      && explicit / levels < MIN_STOREY_M
      && !LEVELS_MEANINGLESS_FOR.has(tags.building)) {
    return { h: Math.round(levels * METRES_PER_LEVEL + PARAPET_M), hs: 1, contradicted: Math.round(explicit) };
  }

  // Тег `height` из OSM — НЕ обмер, поэтому и не hs=0.
  //
  // hs=0 означает «обмерено» и покупает SRC_CLEARANCE[0] = 0 м запаса: твин
  // доверяет числу полностью. Такое доверие заслуживает обмер властей —
  // PLATEAU `measuredHeight`, городская съёмка Нью-Йорка. Тег в OSM ставит
  // волонтёр, и аудит по статьям, на которые ссылаются САМИ элементы, показал
  // ошибки на порядок в обе стороны: 30 Rockefeller Plaza с height=10 при 70
  // этажах, здание правительства Токио 133 м против 241.9, Байтерек в Астане
  // 382 м против 310.8.
  //
  // Нью-Йорк и Токио это не задевает: обмер властей проходит ПОСЛЕ и заново
  // выставляет hs=0 там, где контур опознан уверенно (fetch-city-twin.mjs).
  // Спасал их обмер, а не тег. У Астаны обмера нет — и её твин вёз 382 м с
  // высшим классом доверия и нулевым запасом. Сам генератор при этом печатал
  // «TRUSTED as measured, so flown with zero safety clearance»: код знал и
  // всё равно отгружал.
  //
  // hs=1 (derived) даёт 6 м запаса — ровно тот класс, к которому тег относится:
  // величина правдоподобна, но никем не подтверждена.
  // `stated` отделяет «источник назвал число» от «мы прикинули по этажам».
  // Класс доверия у обоих теперь одинаковый (derived), но при сверке с обмером
  // это разные вещи: заявленной высоте есть чем спорить с крышной съёмкой —
  // она часто включает мачту; прикидке по этажам спорить нечем.
  if (explicit !== null) return { h: Math.round(explicit), hs: 1, stated: true };
  if (levels !== null) return { h: Math.round(levels * METRES_PER_LEVEL + PARAPET_M), hs: 1 };
  return { h: DEFAULT_HEIGHT_M, hs: 2 };
}

export function toRing(geom, proj) {
  const pts = (geom ?? []).filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (pts.length < 3) return null;
  return pts.map((p) => {
    const [x, y] = proj(p.lon, p.lat);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });
}

/**
 * A building is either a way (one ring) or a multipolygon relation (several
 * outer ways, often with inner courtyards). Concatenating a relation's members
 * into a single ring — the obvious-looking one-liner, and the bug this code
 * shipped first — produces a polygon that zig-zags between unrelated wings and
 * blocks cells nothing stands on. Inner (courtyard) members are skipped rather
 * than punched out: a courtyard wrongly marked solid costs a detour, the
 * reverse would route an aircraft through a wall.
 */
export function ringsOf(el, proj) {
  if (el.type === "way") {
    const r = toRing(el.geometry, proj);
    return r ? [r] : [];
  }
  return (el.members ?? [])
    .filter((m) => m.type === "way" && (m.role === "outer" || m.role === ""))
    .map((m) => toRing(m.geometry, proj))
    .filter(Boolean);
}

/**
 * Even-odd point-in-polygon, evaluated at the cell CENTRE. Chosen over
 * any-overlap so a 20 m cell counts as blocked when the building actually
 * occupies its middle; any-overlap would inflate every footprint by up to a
 * cell in each direction and quietly make the city denser than it is.
 */
export function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Buildings → 20 m height field plus a parallel provenance grid. The tallest
 * building wins a cell and carries ITS provenance with it, because the safety
 * clearance must reflect the obstacle actually being cleared, not a shorter
 * neighbour whose height happens to be better known.
 */
/**
 * Buildings whose height towers implausibly over the rest of the city.
 *
 * A single wrong `height` tag enters the twin as hs=0 — MEASURED — and therefore
 * gets SRC_CLEARANCE[0] = 0 m of safety margin: the twin trusts it completely.
 * Found in Astana on 2026-07-27: way/486561786 (the Abu Dhabi Plaza tower) is
 * tagged height=382 with building:levels=75, i.e. 5.1 m per storey, against a
 * published 311 m. The city's second-tallest building is 88 m, so the twin's
 * ceiling was a 4.3x outlier over everything else standing.
 *
 * The ratio against the 99th percentile — not against the tallest — is what
 * makes this discriminate: a genuine skyline tapers (NYC 443 m over a p99 of
 * 172 m = 2.6x, Tokyo 241 over 130 = 1.9x), a bad tag does not.
 *
 * Reports, never rejects. Some cities really do have one dominant structure —
 * a mast, a spire — and that is an obstacle worth flying over, not a defect.
 * A human decides which one this is.
 */
export function heightOutliers(buildings, { ratio = 3 } = {}) {
  const sorted = buildings.map((b) => b.h).sort((a, b) => a - b);
  if (sorted.length < 20) return [];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  if (!(p99 > 0)) return [];
  return buildings
    .map((b, i) => ({ index: i, h: b.h, hs: b.hs, times: Math.round((100 * b.h) / p99) / 100 }))
    .filter((b) => b.h > p99 * ratio)
    .sort((a, b) => b.h - a.h);
}

export function rasterize(buildings, cols, rows) {
  const heights = new Array(cols * rows).fill(0);
  const src = new Array(cols * rows).fill(0);
  for (const b of buildings) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of b.r) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const c0 = Math.max(0, Math.floor(minX / CELL)), c1 = Math.min(cols - 1, Math.floor(maxX / CELL));
    const r0 = Math.max(0, Math.floor(minY / CELL)), r1 = Math.min(rows - 1, Math.floor(maxY / CELL));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (!inRing(b.r, c * CELL + CELL / 2, r * CELL + CELL / 2)) continue;
        const i = r * cols + c;
        if (b.h > heights[i]) { heights[i] = b.h; src[i] = b.hs; }
      }
    }
  }
  return { heights, src };
}
