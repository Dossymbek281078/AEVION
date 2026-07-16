// AEVION Trust Score — platform-wide data-provenance aggregation.
//
// The DataProvenanceChip pattern (measured / derived / guessed) is per-module UI;
// this is its server-side counterpart: a registry where each module that can
// report the provenance of its data exposes a DataQuality, and an aggregate
// "AEVION Trust Score" = the share of the platform's data that is measured
// (survey-grade / verified) vs. inferred vs. a placeholder.
//
// Honest by construction: the aggregate reports how many modules actually feed
// it (`modulesReporting`), so a high score over one module is never mistaken for
// a planet-wide claim. Coverage grows as modules register a provider here.
//
// Only backend-accessible provenance can live here. QSkyway's city twins are
// static server-side data, so they report live. Modules whose provenance lives
// in the frontend (e.g. Smeta's ССЦ material map) will report once they expose a
// backend endpoint or ship their counts server-side.

import { CITY } from "../routes/qskyway.city";
import { CITY_NYC } from "../routes/qskyway.city.nyc";
import { CITY_TOKYO } from "../routes/qskyway.city.tokyo";
import { PROVENANCE_SNAPSHOTS } from "../data/moduleProvenanceSnapshots";

export interface DataQuality {
  total: number;
  measured: number;
  derived: number;
  guessed: number;
  measuredPct: number;
  realPct: number;
  source?: string;
  note?: string;
}

function pct(n: number, total: number): number {
  return total ? Math.round((1000 * n) / total) / 10 : 0;
}

function fromCounts(
  measured: number,
  derived: number,
  guessed: number,
  extra?: { source?: string; note?: string },
): DataQuality {
  const total = measured + derived + guessed;
  return {
    total,
    measured,
    derived,
    guessed,
    measuredPct: pct(measured, total),
    realPct: pct(measured + derived, total),
    source: extra?.source,
    note: extra?.note,
  };
}

// ── Per-module providers ────────────────────────────────────────────────────
// A provider returns the module's current DataQuality, or null if unavailable.
type Provider = () => DataQuality | null;

const qskywayProvider: Provider = () => {
  // Aggregate building-height provenance across all live city twins.
  let measured = 0, derived = 0, guessed = 0;
  for (const c of [CITY, CITY_NYC, CITY_TOKYO]) {
    const d = c.dataQuality;
    if (!d) continue;
    measured += d.measured;
    derived += d.derived;
    guessed += d.guessed;
  }
  return fromCounts(measured, derived, guessed, {
    source: "QSkyway city twins (OSM footprints + PLATEAU LOD2 / real height tags)",
    note: "доля зданий с измеренной высотой по всем городам-двойникам.",
  });
};

const PROVIDERS: Record<string, Provider> = {
  qskyway: qskywayProvider,
};

// Register a provider for every build-time provenance snapshot (frontend-data
// modules that shipped their counts to the backend).
for (const [id, snap] of Object.entries(PROVENANCE_SNAPSHOTS)) {
  PROVIDERS[id] = () =>
    fromCounts(snap.measured, snap.derived, snap.guessed, {
      source: `${snap.source} (snapshot ${snap.capturedAt})`,
      note: snap.note,
    });
}

// ── Public API ──────────────────────────────────────────────────────────────

/** DataQuality for one module, or null if the module does not report provenance. */
export function moduleDataQuality(moduleId: string): DataQuality | null {
  const p = PROVIDERS[moduleId];
  return p ? p() : null;
}

/** Every module's DataQuality that is currently reportable. */
export function allModuleDataQuality(): Record<string, DataQuality> {
  const out: Record<string, DataQuality> = {};
  for (const [id, p] of Object.entries(PROVIDERS)) {
    const dq = p();
    if (dq) out[id] = dq;
  }
  return out;
}

export interface TrustScore {
  /** platform measured-% across every reporting module's items, weighted by count */
  score: number;
  realPct: number;
  totalItems: number;
  measured: number;
  derived: number;
  guessed: number;
  modulesReporting: number;
  perModule: Record<string, { measuredPct: number; realPct: number; total: number }>;
  note: string;
}

/** AEVION Trust Score — measured-% of the platform's reportable data, honestly scoped. */
export function trustScore(): TrustScore {
  const all = allModuleDataQuality();
  let measured = 0, derived = 0, guessed = 0;
  const perModule: TrustScore["perModule"] = {};
  for (const [id, d] of Object.entries(all)) {
    measured += d.measured;
    derived += d.derived;
    guessed += d.guessed;
    perModule[id] = { measuredPct: d.measuredPct, realPct: d.realPct, total: d.total };
  }
  const total = measured + derived + guessed;
  const modulesReporting = Object.keys(all).length;
  return {
    score: pct(measured, total),
    realPct: pct(measured + derived, total),
    totalItems: total,
    measured,
    derived,
    guessed,
    modulesReporting,
    perModule,
    note: `Средневзвешенная доля измеренных данных по ${modulesReporting} репортящему(-им) модулю(-ям). Охват растёт по мере подключения /data-quality в других модулях — это не претензия на всю планету.`,
  };
}
