"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_SINGAPORE = void 0;
exports.PERMISSION_SINGAPORE = {
    authority: "CAAS (Управление гражданской авиации Сингапура)",
    authorityEn: "CAAS (Civil Aviation Authority of Singapore)",
    source: "CAAS — Operator and Activity Permits (Air Navigation Act): любая нерекреационная эксплуатация БПЛА требует Operator Permit и Class 1 Activity Permit",
    sourceUrl: "https://www.caas.gov.sg/unmanned-aircraft/operator-and-activity-permits/",
    regime: "Разрешение оператора CAAS (на год) и разрешение на деятельность (Class 1) обязательны для любого нерекреационного полёта — по всему городу; плюс запрет в 5 км от аэродромов и в охраняемых районах",
    regimeEn: "CAAS Operator Permit (one year) and Class 1 Activity Permit are required for any non-recreational flight, everywhere; plus no-fly within 5 km of aerodromes and in protected areas",
    kind: "permission",
    basis: "ingested",
    effective: "Air Navigation Act; CAAS permit pages as read 2026-09-15",
    sampled: "2026-09-15",
    // 112 × 78 cells of the Marina Bay / CBD twin — the rule is city-wide, so
    // every cell is under it by construction, not by sampling.
    sampledCells: 8736,
    cellsRequiringPermission: 8736,
    coveragePct: 100,
};
