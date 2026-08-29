// QSkyway — regulatory airspace-ceiling layer.
//
// Until now every airspace restriction in QSkyway was illustrative (the
// point+radius NOFLY config in qskyway.zones.ts). This layer is the opposite:
// ingested verbatim from a regulator's own published feed, per city, and
// rasterized onto the same 20 m grid the height field uses.
//
// This file covers CEILINGS specifically, and only the FAA publishes those as an
// open keyless feed (→ NYC); cities without one report `airspace: null` rather
// than getting invented altitudes. That is not the same as "no rule": Astana and
// Tokyo are governed by a prohibition and a permission regime respectively, both
// real and both in qskyway.permission.ts. Ceilings absent ≠ regulator absent.
//
// ⚠️ Scope, stated the same way everywhere it surfaces: UASFM encodes Part 107
// *small-UAS* LAANC authorization ceilings, not eVTOL air-taxi certification.
// It is the real published altitude constraint over the twin — that is exactly
// the claim, and no more.
//
// ── What was checked for the other two cities (2026-07-26) ──────────────────
// Recorded so nobody re-derives it. Japan (Tokyo / JCAB-MLIT):
//   · MLIT's own drone page (mlit.go.jp/en/koku/uas.html) does not publish data
//     downloads; it links to a GSI map view with layers `did2020` + `kokuarea`.
//   · `did2020` (Densely Inhabited Districts) IS live as raster tiles —
//     https://cyberjapandata.gsi.go.jp/xyz/did2020/{z}/{x}/{y}.png (verified 200,
//     z=14 covers the Nishi-Shinjuku twin at ~9.5 m/px, finer than our 20 m grid).
//     Two caveats before using it: it is raster, so polygons would be inferred
//     from pixel colour rather than ingested; and semantically DID means "flight
//     needs permission", NOT a ceiling — it does not fit CityAirspace as modelled
//     and would need its own permission-required concept.
//   · `kokuarea` (airspace around airports) returns 404 on every documented GSI
//     tile path (z=8..16) and does not appear in the official tile catalogue
//     (maps.gsi.go.jp/development/ichiran.html) — it is an app-internal overlay,
//     not a public endpoint.
//   · DIPS 2.0 (ossportal.dips.mlit.go.jp) is a permission-application portal
//     with no data export.
// Kazakhstan (Astana): no FEED — but the eAIP itself publishes prohibited areas
//   in ICAO coordinates, and UAP28 covers 100% of the twin. See
//   qskyway.permission.astana.ts. The earlier "nothing found" was the result of
//   looking for an API instead of for the rule.
//
// Is the NYC picture complete? Checked against the FAA's own services on the
//   same host (2026-07-26): Prohibited_Areas, Special_Use_Airspace and
//   Part_Time_National_Security_UAS_Flight_Restrictions all return ZERO features
//   over the Midtown twin. The query was validated against a known positive —
//   P-56 over Washington DC — so the zero is a real absence, not a broken
//   request. For this twin the UASFM ceilings are the applicable rule.
// Conclusion: no JCAB/CAA equivalent of UASFM — an altitude-ceiling grid — exists
// to ingest today, so `available:false` here is the honest answer for those two.
// It is emphatically NOT a conclusion that they are unregulated; assuming that,
// because the search was for a feed rather than for the rule, is exactly what
// hid Astana's UAP28 for weeks.

import crypto from "crypto";
import { AIRSPACE_NYC } from "./qskyway.airspace.nyc";
import type { CityData } from "./qskyway.city";

/** One source cell exactly as the regulator publishes it (axis-aligned lon/lat rect). */
export interface AirspaceCell {
  id: string;
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  /** Max altitude AGL with automatic authorization. 0 = none, ATC coordination required. */
  ceilingFt: number;
  ceilingM: number;
  airspaceClass: string | null;
  airportIcao: string | null;
  airportName: string | null;
  laanc: boolean;
  effective: string | null;
}

export interface CityAirspace {
  source: string;
  sourceUrl: string;
  authority: string;
  regime: string;
  effective: string;
  fetched: string;
  /** the envelope this snapshot was queried with — replayed by the freshness check */
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  cells: AirspaceCell[];
}

export const AIRSPACE: Record<string, CityAirspace> = { nyc: AIRSPACE_NYC };

/** Altitude used for grid cells the feed does not cover — "no published constraint". */
export const NO_CEILING = Infinity;

export interface CeilingField {
  /** metres AGL per grid cell, NO_CEILING where the feed has no coverage */
  ceilings: Float64Array;
  cols: number;
  rows: number;
  /** share of grid cells the feed actually covers, 0..1 */
  coverage: number;
  /** lowest published ceiling over the twin, metres (null if no coverage) */
  minCeilingM: number | null;
  maxCeilingM: number | null;
  /** grid cells where the published ceiling is 0 (no automatic authorization) */
  zeroCeilingCells: number;
}

// Same projection the rasterizer and the router use: equirectangular around the
// bbox centre latitude, metres from the north-west corner.
function cellCentreLonLat(city: CityData, c: number, r: number): [number, number] {
  const { minLat, maxLat, minLon } = city.bbox;
  const lat0 = (minLat + maxLat) / 2;
  const mPerLat = 110540;
  const mPerLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const x = (c + 0.5) * city.grid.cell;
  const y = (r + 0.5) * city.grid.cell;
  return [minLon + x / mPerLon, maxLat - y / mPerLat];
}

const fieldCache = new Map<string, CeilingField | null>();

/**
 * Rasterize the published cells onto the city grid. Cheap (a handful of source
 * rects), computed once per city and cached.
 */
export function ceilingField(cityId: string, city: CityData): CeilingField | null {
  if (fieldCache.has(cityId)) return fieldCache.get(cityId) ?? null;
  const src = AIRSPACE[cityId];
  if (!src) {
    fieldCache.set(cityId, null);
    return null;
  }
  const { cols, rows } = city.grid;
  const ceilings = new Float64Array(cols * rows).fill(NO_CEILING);
  let covered = 0;
  let zero = 0;
  let min: number | null = null;
  let max: number | null = null;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [lon, lat] = cellCentreLonLat(city, c, r);
      // Overlapping publications are possible; the binding constraint is the lowest.
      let ceil = NO_CEILING;
      for (const cell of src.cells) {
        if (lon >= cell.minLon && lon <= cell.maxLon && lat >= cell.minLat && lat <= cell.maxLat) {
          ceil = Math.min(ceil, cell.ceilingM);
        }
      }
      if (ceil !== NO_CEILING) {
        ceilings[r * cols + c] = ceil;
        covered++;
        if (ceil === 0) zero++;
        min = min === null ? ceil : Math.min(min, ceil);
        max = max === null ? ceil : Math.max(max, ceil);
      }
    }
  }
  const field: CeilingField = {
    ceilings,
    cols,
    rows,
    coverage: +(covered / (cols * rows)).toFixed(4),
    minCeilingM: min,
    maxCeilingM: max,
    zeroCeilingCells: zero,
  };
  fieldCache.set(cityId, field);
  return field;
}

/** Ceiling at a grid cell in metres; NO_CEILING where nothing is published. */
export function ceilingAt(field: CeilingField | null, c: number, r: number): number {
  if (!field) return NO_CEILING;
  if (c < 0 || r < 0 || c >= field.cols || r >= field.rows) return NO_CEILING;
  return field.ceilings[r * field.cols + c];
}

/**
 * Canonical, ASCII-only payload of what routing actually obeys.
 *
 * Signed rather than the whole record: the constraint is the cell geometry and
 * its ceiling, not the prose around it. Keeping localized free text out of the
 * signed bytes is the lesson from the Trust Score transport bug (PR #712) —
 * escaped non-ASCII JSON survived a proxy differently than raw UTF-8 and broke
 * verification for anyone whose HTTP client escapes by default.
 */
export function signablePayload(src: CityAirspace): string {
  const cells = [...src.cells]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((c) => [c.id, c.minLon, c.maxLon, c.minLat, c.maxLat, c.ceilingFt, c.airspaceClass ?? "", c.airportIcao ?? "", c.laanc ? 1 : 0]);
  return JSON.stringify({
    authority: src.authority,
    source: src.source,
    regime: src.regime,
    effective: src.effective,
    bbox: [src.bbox.minLon, src.bbox.minLat, src.bbox.maxLon, src.bbox.maxLat],
    cells,
  });
}

export function airspaceContentHash(src: CityAirspace): string {
  return crypto.createHash("sha256").update(signablePayload(src)).digest("hex");
}

/** Public summary for API responses — the provenance, not the raster. */
export function airspaceSummary(cityId: string, city: CityData) {
  const src = AIRSPACE[cityId];
  if (!src) {
    return {
      available: false as const,
      // Says what is missing (a CEILING grid), not "no regulator" — both cities
      // that hit this branch are in fact governed, just by a different kind of
      // rule, and the caller sees it in the sibling `permission` block. The old
      // wording claimed no source was found and was false for both.
      note: "Сетку потолков высоты регулятор этого города не публикует, поэтому высотного ограничения здесь нет. Это НЕ значит, что города нет правил — см. блок permission рядом.",
      noteEn: "This city's regulator publishes no altitude-ceiling grid, so there is no altitude constraint here. That does NOT mean the city has no rules — see the permission block next to this one.",
    };
  }
  const field = ceilingField(cityId, city);
  return {
    available: true as const,
    source: src.source,
    sourceUrl: src.sourceUrl,
    authority: src.authority,
    regime: src.regime,
    effective: src.effective,
    fetched: src.fetched,
    cells: src.cells.length,
    // Три соседних поля, и у ДВУХ из них умолчание уже было честным
    // (`?? null`), а у третьего — нет. Разное обращение с соседями в
    // одном литерале почти всегда недосмотр.
    //
    // Обратите внимание на асимметрию одного и того же нуля:
    //   `coveragePct ?? 0`      -> «покрытия нет»       — сторона осторожная;
    //   `zeroCeilingCells ?? 0` -> «пустых ячеек нет»   — то есть «данные
    //                              полны», сторона ЛЬСТИВАЯ и опасная.
    // Одинаковая цифра, противоположный смысл: направление отказа
    // определяется не значением, а тем, что оно утверждает.
    coveragePct: field ? Math.round(100 * field.coverage) : null,
    minCeilingM: field?.minCeilingM ?? null,
    maxCeilingM: field?.maxCeilingM ?? null,
    zeroCeilingCells: field?.zeroCeilingCells ?? null,
    // Хэш ИМЕННО ЭТОЙ редакции — чтобы сводку можно было связать с привязкой к
    // Bitcoin, не делая второго запроса и не веря нам на слово.
    //
    // 29.08.2026: без этого поля потребитель сводки (в том числе наша же
    // страница) знал, ЧТО за источник, и не знал, КАКАЯ именно редакция перед
    // ним. Байты, над которыми хэш взят, отдаёт /airspace/edition — вместе они
    // и дают проверяемость.
    contentHash: airspaceContentHash(src),
    note: "Реальные потолки регулятора (FAA UASFM, LAANC для малых БВС Part 107) — НЕ сертификация аэротакси. Используется как опубликованное ограничение высоты над твином; по умолчанию рекомендательно, строгий режим — POST /route {respectCeiling:true}.",
    noteEn: "Real regulator ceilings (FAA UASFM, LAANC for Part 107 small UAS) — NOT an air-taxi certification. Used as the published altitude limit over the twin; advisory by default, strict mode is POST /route {respectCeiling:true}.",
  };
}
