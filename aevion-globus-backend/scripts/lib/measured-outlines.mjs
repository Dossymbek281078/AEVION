/**
 * QSkyway — reconcile OSM footprints against an authority's measured building
 * outlines, whoever the authority is.
 *
 * This started inside plateau-heights.mjs and moved out on 2026-07-27, when a
 * second source — NYC Open Data — was fed to it and needed NOT ONE LINE changed
 * to work. That is the evidence the logic is about geometry and evidence
 * strength, not about Japan: a name that says PLATEAU would have been a lie to
 * the next reader, and the next reader is the one deciding whether to reuse it.
 *
 * Pure: no fetch, no filesystem, no module state. Rings are [x, y] in the city's
 * metric frame; the caller projects.
 */

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
 * Reconcile OSM footprints with an authority's measured outlines. Both are rings
 * in the city's metric frame; the result says, for every OSM footprint, what the
 * authority measured there — and which of its buildings OSM does not know about.
 *
 * STRONG EVIDENCE — CONTAINMENT. Two outlines are the same building when either
 * centroid lies inside the other. The test is symmetric on purpose: OSM tends to
 * draw one outline around a complex that the authority models as separate towers
 * (Shinjuku Park Tower is three), and a one-directional test loses whichever
 * side is subdivided. A footprint covered by several authority outlines takes the
 * TALLEST — that is the obstacle to clear; the first or the average would
 * publish the podium and hide the tower.
 *
 * WEAK EVIDENCE — PROXIMITY, reported separately as `how: "near"`. OSM often
 * traces the ground floor where the survey draws the roof edge, so the two
 * outlines of one building can miss each other entirely — measured in
 * Nishi-Shinjuku: 33 footprints have a PLATEAU outline of near-identical height
 * 9-17 m away and no containment at all. Refusing to use it drops those buildings to the 12 m default — a 45 m
 * obstacle published as 12 m. The CALLER decides what to do with a weak match,
 * and qskyway's rule is: use it only where neither source measured anything, and
 * never let it overrule a height OSM actually states. The committed twin shows
 * why — it gives way/155784975 41 m, a neighbouring tower's height assigned by
 * distance alone, while OSM plainly tags that structure height=3.
 *
 * What is deliberately NOT done: taking the tallest surveyed height within a
 * generous radius. It is the "safe" choice for any single building and ruinous
 * overall — every low building beside a tower inherits the tower's height, the
 * street canyons fill in, and the router loses the low corridors that are the
 * entire product.
 */
export function reconcileMeasuredOutlines(osmRings, surveyed, { nearRadiusM = 20 } = {}) {
  const BUCKET = 50;
  const pb = surveyed.map((p) => ({ ...p, b: bounds(p.ring), c: ringCentroid(p.ring) }));
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

  const claimed = new Uint8Array(surveyed.length);
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
  // the survey draws a single roof: the half holding the outline's centroid matches,
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
  for (let i = 0; i < surveyed.length; i++) if (!claimed[i]) unmatched.push(i);
  return { heights, unmatched };
}
