// QSkyway — is the committed airspace snapshot still what the regulator publishes?
//
// The ceiling data in qskyway.airspace.<city>.ts is a committed snapshot: real,
// signed, reproducible — and frozen at the moment it was fetched. The FAA
// reissues UAS Facility Maps on a recurring cycle (the MAP_EFF field moves), so
// a snapshot that is honest today quietly becomes a false claim in a month or
// two. Nothing in the code would notice: the service would keep saying "real
// regulator feed" while routing against a superseded edition.
//
// So the running service asks the regulator the *identical* bbox question on a
// slow interval and compares. The answer is reported, never silently applied —
// auto-adopting a live regulatory feed into a signed snapshot would break the
// attestation and remove the human review that a rule change deserves. Drift
// surfaces as `upToDate:false` plus what changed; a human regenerates the file.
//
// Fails soft in the METAR style: a failed check leaves the previous verdict and
// reports `checked:false` rather than claiming either freshness or staleness.

import { AIRSPACE, type CityAirspace } from "./qskyway.airspace";

export interface FreshnessVerdict {
  /** false when the feed has never answered us (boot, outage, offline env) */
  checked: boolean;
  /** null while unchecked — deliberately not `false`, which would read as "stale" */
  upToDate: boolean | null;
  /** effective date the regulator currently publishes, if we got an answer */
  publishedEffective: string | null;
  /** effective date of the snapshot we actually route against */
  snapshotEffective: string;
  cellsAdded: number;
  cellsRemoved: number;
  cellsChanged: number;
  checkedAt: string | null;
  error: string | null;
}

const FEED_QUERY =
  "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/FAA_UAS_FacilityMap_Data/FeatureServer/0/query";

// UAS Facility Maps change on a ~monthly cadence, so a twice-daily check is
// already far more often than the data can move. Any tighter is pure noise
// against a public regulator endpoint.
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
// Don't add a network round-trip to boot — this backend redeploys constantly.
const FIRST_CHECK_DELAY_MS = 60 * 1000;

const verdicts = new Map<string, FreshnessVerdict>();

const blank = (src: CityAirspace): FreshnessVerdict => ({
  checked: false,
  upToDate: null,
  publishedEffective: null,
  snapshotEffective: src.effective,
  cellsAdded: 0,
  cellsRemoved: 0,
  cellsChanged: 0,
  checkedAt: null,
  error: null,
});

export interface LiveCell { id: string; ceilingFt: number; effective: string | null }

/**
 * Pure comparison, exported so the drift branch is testable: the live feed
 * cannot be made to disagree on demand, so verifying "detects a changed ceiling"
 * against the real network is impossible. The network path is exercised live
 * (see the smoke's freshness check); this covers the branches it cannot reach.
 */
export function compareSnapshot(src: CityAirspace, live: LiveCell[]) {
  const liveById = new Map(live.map((c) => [c.id, c.ceilingFt]));
  const snapById = new Map(src.cells.map((c) => [c.id, c.ceilingFt]));
  let cellsAdded = 0, cellsRemoved = 0, cellsChanged = 0;
  for (const [id, ceil] of liveById) {
    if (!snapById.has(id)) cellsAdded++;
    else if (snapById.get(id) !== ceil) cellsChanged++;
  }
  for (const id of snapById.keys()) if (!liveById.has(id)) cellsRemoved++;
  const effectives = [...new Set(live.map((c) => c.effective).filter(Boolean))] as string[];
  return {
    cellsAdded,
    cellsRemoved,
    cellsChanged,
    // Ceilings are what routing obeys; a reissued publication date with identical
    // ceilings is not a rule change and must not cry wolf.
    upToDate: cellsAdded === 0 && cellsRemoved === 0 && cellsChanged === 0,
    publishedEffective: effectives.length === 1 ? effectives[0] : effectives.join(", ") || null,
  };
}

async function checkCity(cityId: string, src: CityAirspace): Promise<void> {
  const prev = verdicts.get(cityId) ?? blank(src);
  try {
    const params = new URLSearchParams({
      geometry: `${src.bbox.minLon},${src.bbox.minLat},${src.bbox.maxLon},${src.bbox.maxLat}`,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "OBJECTID,CEILING,MAP_EFF",
      returnGeometry: "false",
      f: "json",
    });
    const res = await fetch(`${FEED_QUERY}?${params}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`http ${res.status}`);
    const data = (await res.json()) as {
      error?: unknown;
      features?: Array<{ attributes: { OBJECTID: number; CEILING: number; MAP_EFF?: string } }>;
    };
    if (data.error) throw new Error("feed error");
    const live = data.features ?? [];
    if (!live.length) throw new Error("feed returned no cells");

    const diff = compareSnapshot(
      src,
      live.map((f) => ({ id: `faa-${f.attributes.OBJECTID}`, ceilingFt: f.attributes.CEILING, effective: f.attributes.MAP_EFF ?? null })),
    );

    verdicts.set(cityId, {
      checked: true,
      ...diff,
      snapshotEffective: src.effective,
      checkedAt: new Date().toISOString(),
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[qskyway] airspace freshness check failed for ${cityId}:`, message);
    // Keep whatever we last knew; only the error and timestamp move.
    verdicts.set(cityId, { ...prev, checkedAt: prev.checkedAt, error: message });
  }
}

async function checkAll(): Promise<void> {
  for (const [cityId, src] of Object.entries(AIRSPACE)) {
    await checkCity(cityId, src);
  }
}

// setTimeout/setInterval callbacks must never throw here — an unhandled rejection
// inside a timer has taken this backend down before.
setTimeout(() => { void checkAll(); }, FIRST_CHECK_DELAY_MS).unref?.();
setInterval(() => { void checkAll(); }, CHECK_INTERVAL_MS).unref?.();

export function airspaceFreshness(cityId: string): FreshnessVerdict | null {
  const src = AIRSPACE[cityId];
  if (!src) return null;
  return verdicts.get(cityId) ?? blank(src);
}

/** Test hook: run one check now instead of waiting for the timer. */
export async function checkAirspaceFreshnessNow(): Promise<void> {
  await checkAll();
}
