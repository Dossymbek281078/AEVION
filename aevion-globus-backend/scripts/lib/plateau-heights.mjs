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
 * Everything here is pure — parsing and geometry only, no fetch, no filesystem —
 * so tests/qskywayPlateauHeights.test.ts can exercise it on fixtures.
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

/** Area-weighted polygon centroid; degenerate rings fall back to the vertex mean. */
export function ringCentroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f;
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) {
    let sx = 0, sy = 0;
    for (const [x, y] of ring) { sx += x; sy += y; }
    return [sx / ring.length, sy / ring.length];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

function pointInRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function bounds(ring) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Reconcile OSM footprints with PLATEAU roof outlines. Both are rings in the
 * city's metric frame; the result says, for every OSM footprint, what PLATEAU
 * measured there — and which PLATEAU buildings OSM does not know about at all.
 *
 * STRONG EVIDENCE — CONTAINMENT. Two outlines are the same building when either
 * centroid lies inside the other. The test is symmetric on purpose: OSM tends to
 * draw one outline around a complex that PLATEAU models as separate towers
 * (Shinjuku Park Tower is three), and a one-directional test loses whichever
 * side is subdivided. A footprint covered by several PLATEAU outlines takes the
 * TALLEST — that is the obstacle to clear; the first or the average would
 * publish the podium and hide the tower.
 *
 * WEAK EVIDENCE — PROXIMITY, reported separately as `how: "near"`. OSM often
 * traces the ground floor where PLATEAU draws the roof edge, so the two outlines
 * of one building can miss each other entirely: 33 footprints in Nishi-Shinjuku
 * have a PLATEAU outline of near-identical height 9-17 m away and no containment
 * at all. Refusing to use it drops those buildings to the 12 m default — a 45 m
 * obstacle published as 12 m. The CALLER decides what to do with a weak match,
 * and qskyway's rule is: use it only where neither source measured anything, and
 * never let it overrule a height OSM actually states. The committed twin shows
 * why — it gives way/155784975 41 m, a neighbouring tower's height assigned by
 * distance alone, while OSM plainly tags that structure height=3.
 *
 * What is deliberately NOT done: taking the tallest PLATEAU height within a
 * generous radius. It is the "safe" choice for any single building and ruinous
 * overall — every low building beside a tower inherits the tower's height, the
 * street canyons fill in, and the router loses the low corridors that are the
 * entire product.
 */
export function reconcileWithPlateau(osmRings, plateauRings, { nearRadiusM = 20 } = {}) {
  const BUCKET = 50;
  const pb = plateauRings.map((p) => ({ ...p, b: bounds(p.ring), c: ringCentroid(p.ring) }));
  const index = new Map();
  pb.forEach((p, i) => {
    for (let bx = Math.floor(p.b.minX / BUCKET); bx <= Math.floor(p.b.maxX / BUCKET); bx++) {
      for (let by = Math.floor(p.b.minY / BUCKET); by <= Math.floor(p.b.maxY / BUCKET); by++) {
        const k = `${bx},${by}`;
        let bucket = index.get(k);
        if (!bucket) index.set(k, (bucket = []));
        bucket.push(i);
      }
    }
  });

  const nearby = (b, radius) => {
    const seen = new Set();
    for (let bx = Math.floor((b.minX - radius) / BUCKET); bx <= Math.floor((b.maxX + radius) / BUCKET); bx++) {
      for (let by = Math.floor((b.minY - radius) / BUCKET); by <= Math.floor((b.maxY + radius) / BUCKET); by++) {
        for (const i of index.get(`${bx},${by}`) ?? []) seen.add(i);
      }
    }
    return seen;
  };

  const claimed = new Uint8Array(plateauRings.length);
  const geometry = osmRings.map((ring) => ({ ring, b: bounds(ring), c: ringCentroid(ring) }));

  // Pass 1 — containment only, over every footprint, before any weak match is
  // considered. Interleaving the two would let a proximity guess claim an
  // outline that the next footprint contains outright.
  const heights = geometry.map(({ ring, b, c }) => {
    let best = null, n = 0;
    for (const i of nearby(b, 0)) {
      const p = pb[i];
      if (p.b.maxX < b.minX || p.b.minX > b.maxX || p.b.maxY < b.minY || p.b.minY > b.maxY) continue;
      if (!pointInRing(ring, p.c[0], p.c[1]) && !pointInRing(p.ring, c[0], c[1])) continue;
      claimed[i] = 1;
      n++;
      if (best === null || p.h > best) best = p.h;
    }
    return best === null ? { h: null, how: "none" } : { h: best, how: "contained", sources: n };
  });

  // Pass 2 — nearest outline, for footprints containment left empty.
  //
  // An outline already claimed by another footprint stays eligible, and that is
  // deliberate. OSM frequently splits one building into two adjoining ways where
  // PLATEAU draws a single roof: the half holding the outline's centroid matches,
  // the other half matches nothing. Excluding claimed outlines published the
  // second half at the 12 m default while its own roof, measured at 45 m, sat
  // ten metres away — the exact obstacle the router must not miss. The choice
  // here is never "45 m or the right answer"; it is "45 m or a 12 m guess".
  geometry.forEach(({ b, c }, k) => {
    if (heights[k].h !== null) return;
    let best = null, bestD = Infinity;
    for (const i of nearby(b, nearRadiusM)) {
      const d = Math.hypot(pb[i].c[0] - c[0], pb[i].c[1] - c[1]);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best === null || bestD > nearRadiusM) return;
    claimed[best] = 1;
    heights[k] = { h: pb[best].h, how: "near", distance: Math.round(bestD * 10) / 10 };
  });

  const unmatched = [];
  for (let i = 0; i < plateauRings.length; i++) if (!claimed[i]) unmatched.push(i);
  return { heights, unmatched };
}
