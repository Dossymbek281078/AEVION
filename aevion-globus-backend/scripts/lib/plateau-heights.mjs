/**
 * QSkyway — measured building heights from MLIT Project PLATEAU (CityGML LOD2).
 *
 * WHY THIS EXISTS: Tokyo's committed twin carries measured heights that OSM does
 * not have, so fetch-city-twin.mjs refused to regenerate it — which meant the
 * one city with the best heights was the one city whose FOOTPRINTS could never
 * be refreshed. On 2026-07-27 that bill came due: comparing the committed Tokyo
 * twin against OSM showed 565 grid cells the twin calls empty that OSM has
 * buildings on, including JR Shinjuku Miraina Tower (168 m, way/535427342) — a
 * skyscraper the router could not see. In the other direction PLATEAU reports a
 * 240.6 m building inside the same bbox while the committed twin tops out at
 * 227 m. Neither source is a subset of the other, so the twin is built from
 * both instead of picking one and hoping.
 *
 * Everything here is pure — parsing only, no fetch, no filesystem — so
 * tests/qskywayPlateauHeights.test.ts can exercise it on fixtures. The
 * reconciliation itself is source-agnostic and lives in measured-outlines.mjs.
 */

// PLATEAU publishes EPSG:6697, whose axis order is LATITUDE FIRST:
// posList = "lat lon height lat lon height …". Reading it as lon-lat puts
// Shinjuku in the Indian Ocean and every match silently fails, leaving the twin
// on its OSM guesses while every number in the UI keeps looking the same. That
// is why assertLatLonOrder below throws instead of filtering.
const MEASURED_HEIGHT_RE = /<bldg:measuredHeight[^>]*>\s*([\d.]+)\s*<\/bldg:measuredHeight>/g;
const ROOF_EDGE_RE = /<bldg:lod0RoofEdge>([\s\S]*?)<\/bldg:lod0RoofEdge>/;
const EXTERIOR_RE = /<gml:exterior>[\s\S]*?<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>/g;

/**
 * "35.687 139.709 0 35.688 139.710 0 …" → [[lat, lon], …].
 *
 * The third component of each triplet is the ground elevation of the roof edge
 * and is dropped: the twin's height field is height ABOVE ground, which is what
 * measuredHeight already reports. Adding the elevation back would raise every
 * building in Shinjuku by ~35 m of terrain.
 */
export function parsePosList(text) {
  const n = text.trim().split(/\s+/);
  const ring = [];
  for (let i = 0; i + 2 < n.length; i += 3) {
    const lat = Number(n[i]), lon = Number(n[i + 1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    ring.push([lat, lon]);
  }
  return ring;
}

function assertLatLonOrder(ring, where) {
  for (const [lat, lon] of ring) {
    if (lat < -90 || lat > 90) {
      throw new Error(
        `${where}: latitude ${lat} is out of range — the posList is not "lat lon height". ` +
        `PLATEAU is EPSG:6697 (latitude first); parsing it as lon/lat would match nothing ` +
        `and quietly leave the twin on guessed heights.`,
      );
    }
  }
}

/**
 * One <core:cityObjectMember> → { h, rings } or null.
 *
 * `rings` are the LOD0 roof-edge outlines — the polygon PLATEAU draws where the
 * building meets the sky, which is the closest thing in the file to a footprint
 * and, unlike a centroid, survives a complex being modelled as several towers.
 * Interior rings (courtyards) are skipped for the same reason ringsOf skips
 * them: a courtyard wrongly marked solid costs a detour, the reverse routes an
 * aircraft through a wall.
 *
 * Height is the MAX measuredHeight in the member. Shinjuku publishes one per
 * building, but wards that model BuildingParts publish several, and taking the
 * first would mean publishing whichever part the file happens to list first —
 * for an obstacle grid, possibly the annex instead of the tower.
 */
export function parseBuildingMember(chunk) {
  if (chunk.indexOf("bldg:Building") === -1) return null;

  let h = 0;
  MEASURED_HEIGHT_RE.lastIndex = 0;
  let m;
  while ((m = MEASURED_HEIGHT_RE.exec(chunk)) !== null) {
    const v = Number.parseFloat(m[1]);
    if (Number.isFinite(v) && v > h) h = v;
  }
  if (!(h > 0)) return null;

  const roof = ROOF_EDGE_RE.exec(chunk);
  if (!roof) return null;

  const rings = [];
  EXTERIOR_RE.lastIndex = 0;
  while ((m = EXTERIOR_RE.exec(roof[1])) !== null) {
    const ring = parsePosList(m[1]);
    if (ring.length >= 3) {
      assertLatLonOrder(ring, "PLATEAU lod0RoofEdge");
      rings.push(ring);
    }
  }
  if (!rings.length) return null;
  return { h: Math.round(h * 10) / 10, rings };
}

/**
 * A whole .gml file → [{ h, ring }] in lat/lon, one entry per roof-edge outline,
 * keeping only those whose centroid falls inside `bbox`.
 *
 * `bbox` must be WIDER than the city — a building just outside the city bbox
 * still stands over footprints inside it, and cropping to the exact bbox drops
 * the measured height of every edge building. (Measured: cropping tight lost the
 * heights of 112 buildings including a 199 m tower.)
 *
 * Splitting on <core:cityObjectMember> instead of parsing XML is deliberate:
 * these files are 60-140 MB each and a DOM parse of four does not fit in a
 * default Node heap. The split is safe because the tag never nests.
 */
export function parsePlateauGml(gmlText, bbox) {
  const out = [];
  const chunks = gmlText.split("<core:cityObjectMember>");
  for (let i = 1; i < chunks.length; i++) {
    const b = parseBuildingMember(chunks[i]);
    if (!b) continue;
    for (const ring of b.rings) {
      let sLat = 0, sLon = 0;
      for (const [lat, lon] of ring) { sLat += lat; sLon += lon; }
      const cLat = sLat / ring.length, cLon = sLon / ring.length;
      if (cLat < bbox.minLat || cLat > bbox.maxLat || cLon < bbox.minLon || cLon > bbox.maxLon) continue;
      out.push({ h: b.h, ring });
    }
  }
  return out;
}
