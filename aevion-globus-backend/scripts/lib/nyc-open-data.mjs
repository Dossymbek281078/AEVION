/**
 * QSkyway — measured building heights from NYC Open Data.
 *
 * New York publishes what Tokyo publishes and Astana does not: a city-run survey
 * of every building's roof height, derived photogrammetrically. It arrives as
 * ordinary Socrata JSON rather than 420 MB of CityGML, which makes it the
 * cheapest of the three regulator sources to ingest — and the twin needed it:
 * before this, 205 Midtown buildings stood in the obstacle grid at the blind
 * 12 m default while the city had measured them.
 *
 * Dataset `5zhs-2jue` on data.cityofnewyork.us. The id in most published guides,
 * `qb5r-6dgf`, is dead (404) — resolve a fresh one through the Socrata catalogue
 * (api.us.socrata.com/api/catalog/v1?domains=data.cityofnewyork.us) rather than
 * trusting a blog post.
 *
 * Pure: no fetch, no filesystem. Reconciliation lives in measured-outlines.mjs.
 */

/**
 * TWO UNIT TRAPS, both verified against buildings whose height is public
 * knowledge, because getting either wrong is silent:
 *
 *  1. `height_roof` is in FEET. Read as metres, Midtown becomes a third of its
 *     real height and every corridor is planned through it. Confirmed by
 *     identification, not by assumption: 1238.79 on a 1931 building is the
 *     Empire State Building (1250 ft), 1401 on a 2021 building is One
 *     Vanderbilt (1401 ft).
 *  2. `height_roof` stops at the ROOF — no mast, no antenna, no spire. So the
 *     city's number is sometimes LOWER than the OSM tag for the same building
 *     (the twin's 443 m Empire State is its 1454 ft antenna height). An obstacle
 *     grid has to clear the antenna, so the caller takes the taller of the two
 *     measurements; treating the city as authoritative because it is official
 *     would quietly shave 65 m off the tallest thing in the bbox.
 *
 * `ground_elevation` is deliberately ignored: the twin's height field is height
 * ABOVE GROUND, and Midtown sits ~15 m above sea level.
 */
export const FEET_TO_M = 0.3048;

/**
 * Socrata rows → [{ h, ring }] with `h` in METRES and `ring` as [lon, lat] pairs
 * for the caller to project.
 *
 * Only the outer ring of each polygon is kept, matching how ringsOf treats OSM
 * multipolygons: an inner courtyard wrongly marked solid costs a detour, the
 * reverse routes an aircraft through a wall.
 *
 * Rows without a positive height are dropped rather than defaulted. That single
 * filter is also what keeps unbuilt records out — NYC marks planned footprints
 * `last_status_type: "Marked for Construction"` and gives them height_roof 0, so
 * they never become obstacles. The other statuses (Alteration, Merged,
 * Initialization, Correction — 18 rows in the Midtown bbox) describe the edit
 * state of the RECORD, not whether the building is standing, and are kept.
 */
export function parseNycBuildings(rows, { unitToMetres = FEET_TO_M } = {}) {
  const out = [];
  for (const row of rows ?? []) {
    const raw = Number.parseFloat(row?.height_roof);
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const h = Math.round(raw * unitToMetres * 10) / 10;
    const geom = row?.the_geom;
    if (!geom) continue;
    const polygons = geom.type === "MultiPolygon" ? geom.coordinates
      : geom.type === "Polygon" ? [geom.coordinates]
        : null;
    if (!polygons) continue;
    for (const poly of polygons) {
      const outer = poly?.[0];
      if (!Array.isArray(outer) || outer.length < 3) continue;
      const ring = outer.filter(
        (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
      );
      if (ring.length < 3) continue;
      out.push({ h, ring });
    }
  }
  return out;
}

/**
 * The Socrata query for one bbox. `within_box` takes NORTH-WEST then SOUTH-EAST
 * corners — latitude first, longitude second, and the north latitude before the
 * south one. Swapping the pairs returns an empty set rather than an error, which
 * would read as "the city has no data here" and leave the twin on its guesses.
 */
export function nycBuildingsQuery({ minLat, maxLat, minLon, maxLon }, limit = 20000) {
  const box = `within_box(the_geom,${maxLat},${minLon},${minLat},${maxLon})`;
  const params = new URLSearchParams({
    $where: box,
    $select: "bin,height_roof,the_geom,last_status_type",
    $limit: String(limit),
  });
  return `https://data.cityofnewyork.us/resource/5zhs-2jue.json?${params}`;
}
