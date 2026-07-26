// QSkyway — regulatory airspace-ceiling layer.
//
// Until now every airspace restriction in QSkyway was illustrative (the
// point+radius NOFLY config in qskyway.zones.ts). This layer is the opposite:
// ingested verbatim from a regulator's own published feed, per city, and
// rasterized onto the same 20 m grid the height field uses.
//
// Coverage is honest and partial by design: the FAA publishes UAS Facility Map
// ceilings as an open, keyless ArcGIS feed (→ NYC), while no equivalent free
// feed was found for Kazakhstan's CAA (Astana) or Japan's JCAB (Tokyo). Cities
// without a feed report `airspace: null` rather than getting invented data.
//
// ⚠️ Scope, stated the same way everywhere it surfaces: UASFM encodes Part 107
// *small-UAS* LAANC authorization ceilings, not eVTOL air-taxi certification.
// It is the real published altitude constraint over the twin — that is exactly
// the claim, and no more.

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

/** Public summary for API responses — the provenance, not the raster. */
export function airspaceSummary(cityId: string, city: CityData) {
  const src = AIRSPACE[cityId];
  if (!src) {
    return {
      available: false as const,
      note: "Открытого фида регулятора для этого города не найдено — регуляторный потолок не наложен (запретные зоны остаются иллюстративными).",
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
    coveragePct: Math.round(100 * (field?.coverage ?? 0)),
    minCeilingM: field?.minCeilingM ?? null,
    maxCeilingM: field?.maxCeilingM ?? null,
    zeroCeilingCells: field?.zeroCeilingCells ?? 0,
    note: "Реальные потолки регулятора (FAA UASFM, LAANC для малых БВС Part 107) — НЕ сертификация аэротакси. Используется как опубликованное ограничение высоты над твином; по умолчанию рекомендательно, строгий режим — POST /route {respectCeiling:true}.",
  };
}
