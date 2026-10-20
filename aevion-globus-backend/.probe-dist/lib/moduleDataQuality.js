"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.moduleDataQuality = moduleDataQuality;
exports.allModuleDataQuality = allModuleDataQuality;
exports.trustScore = trustScore;
const qskyway_city_1 = require("../routes/qskyway.city");
const qskyway_city_nyc_1 = require("../routes/qskyway.city.nyc");
const qskyway_city_tokyo_1 = require("../routes/qskyway.city.tokyo");
const qskyway_city_singapore_1 = require("../routes/qskyway.city.singapore");
const qskyway_city_amsterdam_1 = require("../routes/qskyway.city.amsterdam");
const qskyway_city_berlin_1 = require("../routes/qskyway.city.berlin");
const qskyway_city_vienna_1 = require("../routes/qskyway.city.vienna");
const qskyway_city_zurich_1 = require("../routes/qskyway.city.zurich");
const moduleProvenanceSnapshots_1 = require("../data/moduleProvenanceSnapshots");
function pct(n, total) {
    return total ? Math.round((1000 * n) / total) / 10 : 0;
}
function fromCounts(measured, derived, guessed, extra) {
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
const qskywayProvider = () => {
    // Aggregate building-height provenance across all live city twins.
    let measured = 0, derived = 0, guessed = 0;
    for (const c of [qskyway_city_1.CITY, qskyway_city_nyc_1.CITY_NYC, qskyway_city_tokyo_1.CITY_TOKYO, qskyway_city_singapore_1.CITY_SINGAPORE, qskyway_city_amsterdam_1.CITY_AMSTERDAM, qskyway_city_berlin_1.CITY_BERLIN, qskyway_city_vienna_1.CITY_VIENNA, qskyway_city_zurich_1.CITY_ZURICH]) {
        const d = c.dataQuality;
        if (!d)
            continue;
        measured += d.measured;
        derived += d.derived;
        guessed += d.guessed;
    }
    return fromCounts(measured, derived, guessed, {
        source: "QSkyway city twins (OSM footprints + PLATEAU LOD2 / real height tags)",
        note: "доля зданий с измеренной высотой по всем городам-двойникам.",
    });
};
const PROVIDERS = {
    qskyway: qskywayProvider,
};
// Register a provider for every build-time provenance snapshot (frontend-data
// modules that shipped their counts to the backend).
for (const [id, snap] of Object.entries(moduleProvenanceSnapshots_1.PROVENANCE_SNAPSHOTS)) {
    PROVIDERS[id] = () => fromCounts(snap.measured, snap.derived, snap.guessed, {
        source: `${snap.source} (snapshot ${snap.capturedAt})`,
        note: snap.note,
    });
}
// ── Public API ──────────────────────────────────────────────────────────────
/** DataQuality for one module, or null if the module does not report provenance. */
function moduleDataQuality(moduleId) {
    const p = PROVIDERS[moduleId];
    return p ? p() : null;
}
/** Every module's DataQuality that is currently reportable. */
function allModuleDataQuality() {
    const out = {};
    for (const [id, p] of Object.entries(PROVIDERS)) {
        const dq = p();
        if (dq)
            out[id] = dq;
    }
    return out;
}
/** AEVION Trust Score — measured-% of the platform's reportable data, honestly scoped. */
function trustScore() {
    const all = allModuleDataQuality();
    let measured = 0, derived = 0, guessed = 0;
    const perModule = {};
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
