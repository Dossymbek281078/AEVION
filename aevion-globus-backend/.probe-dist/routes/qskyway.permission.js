"use strict";
// QSkyway — regulator permission regimes, the second kind of published rule.
//
// The ceiling layer (qskyway.airspace.ts) answers "how high may this corridor
// fly here". This one answers a different question the same regulators also
// publish: "may the flight happen at all without an individual permission".
//
// They are deliberately NOT merged. A ceiling constrains the route geometry and
// belongs in the router; a permission regime constrains the operation and
// belongs on the paperwork. Folding one into the other would either invent an
// altitude Japan never published, or hide a legal gate behind a number.
//
// The distinction also keeps the honesty tractable per city:
//   NYC    — ceilings, ingested as vectors from the FAA feed
//   Tokyo  — no ceiling grid published; a permission regime, read from MLIT's own
//            raster layer, covering the whole twin
//   Astana — no feed either, but the eAIP itself publishes prohibited areas, and
//            UAP28 covers 100% of the twin outright. Documents count as sources;
//            "no API" is not the same as "no rule", and treating it as such is
//            how this module spent weeks animating flights over prohibited
//            airspace behind an invented 320 m circle.
//
// `basis` records HOW the value was obtained, because "the authority publishes
// this" and "we sampled the authority's map image" are different strengths of
// claim and the platform's provenance vocabulary exists to keep them apart.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION = void 0;
exports.permissionSummary = permissionSummary;
const qskyway_permission_tokyo_1 = require("./qskyway.permission.tokyo");
const qskyway_permission_astana_1 = require("./qskyway.permission.astana");
const qskyway_permission_singapore_1 = require("./qskyway.permission.singapore");
const qskyway_permission_amsterdam_1 = require("./qskyway.permission.amsterdam");
const qskyway_permission_berlin_1 = require("./qskyway.permission.berlin");
const qskyway_permission_vienna_1 = require("./qskyway.permission.vienna");
exports.PERMISSION = { tokyo: qskyway_permission_tokyo_1.PERMISSION_TOKYO, astana: qskyway_permission_astana_1.PERMISSION_ASTANA, singapore: qskyway_permission_singapore_1.PERMISSION_SINGAPORE, amsterdam: qskyway_permission_amsterdam_1.PERMISSION_AMSTERDAM, berlin: qskyway_permission_berlin_1.PERMISSION_BERLIN, vienna: qskyway_permission_vienna_1.PERMISSION_VIENNA };
function permissionSummary(cityId) {
    const p = exports.PERMISSION[cityId];
    if (!p)
        return { available: false };
    // A uniform result is reported as such rather than dressed up as a map: when
    // the whole twin is inside the regime there is nothing to route around, and
    // saying so is more useful than a per-cell layer with one value in it.
    const uniform = p.coveragePct >= 99.9;
    return {
        available: true,
        authority: p.authority,
        authorityEn: p.authorityEn,
        source: p.source,
        sourceUrl: p.sourceUrl,
        regime: p.regime,
        regimeEn: p.regimeEn,
        kind: p.kind,
        basis: p.basis,
        effective: p.effective,
        sampled: p.sampled,
        coveragePct: p.coveragePct,
        uniform,
        note: p.kind === "prohibition"
            ? uniform
                ? "Весь твин лежит внутри опубликованной ЗАПРЕТНОЙ зоны: полёты здесь запрещены, а не разрешены по согласованию. Демонстрация маршрутизации остаётся корректной как расчёт, но реальный полёт по ней недопустим без изменения статуса зоны."
                : `${p.coveragePct}% твина лежит внутри опубликованной запретной зоны — полёты в этой части запрещены.`
            : uniform
                ? "Весь твин попадает под режим: каждый полёт здесь требует индивидуального разрешения. Обходить нечего — это условие операции, а не геометрии маршрута."
                : `Под режим попадает ${p.coveragePct}% твина — часть полётов требует индивидуального разрешения.`,
        // Английские версии тех же двух примечаний. Разведены по тем же четырём
        // случаям: запрет/разрешение × весь твин/часть. Перевод буквальный —
        // «forbidden, not permitted subject to coordination» держит ровно то
        // различие, ради которого разделены `kind`.
        noteEn: p.kind === "prohibition"
            ? uniform
                ? "The entire twin lies inside a published PROHIBITED area: flights here are forbidden, not permitted subject to coordination. The routing demonstration remains valid as a calculation, but an actual flight along it is not admissible unless the status of the area changes."
                : `${p.coveragePct}% of the twin lies inside a published prohibited area — flights in that part are forbidden.`
            : uniform
                ? "The entire twin falls under the regime: every flight here requires an individual authorization. There is nothing to route around — this is a condition on the operation, not on the geometry of the route."
                : `${p.coveragePct}% of the twin falls under the regime — some flights require an individual authorization.`,
        provenanceNoteEn: p.basis === "raster-sampled"
            ? "The value was sampled from the regulator's own published raster tiles at grid-cell centres, not from a vector dataset — the regulator publishes this layer only as a map."
            : "The value was ingested from the regulator's vector publication.",
        provenanceNote: p.basis === "raster-sampled"
            ? "Значение получено выборкой по опубликованным растровым тайлам регулятора в центрах ячеек сетки, а не из векторного датасета — регулятор публикует этот слой только картой."
            : "Значение загружено из векторной публикации регулятора.",
    };
}
