// QSkyway — CAAS permit regime over the SINGAPORE twin.
//
// Same KIND of rule as Tokyo's DID layer — a gate on whether the flight may
// happen at all — but a different BASIS: Singapore publishes the rule as text,
// not as a map. Under the Air Navigation Act any unmanned-aircraft operation
// that is not purely recreational or educational needs a CAAS Operator Permit
// and a Class 1 Activity Permit, everywhere in Singapore; recreational flight
// additionally needs a Class 2 permit above 200 ft AMSL or within 5 km of an
// aerodrome. Air-taxi operations are commercial by definition, so the rule
// covers 100 % of the twin without sampling anything: the figure below is the
// whole grid, and `basis: "ingested"` means "read from the regulator's text",
// not from a raster.
//
// Protected areas (no-fly) under the Act are published by CAAS only as a OneMap
// layer, which is NOT ingested — see the realityNote on the demo zone in
// qskyway.zones.ts. Nothing here claims to know their outlines.
//
// Sources (read 2026-09-15):
//   https://www.caas.gov.sg/unmanned-aircraft/operator-and-activity-permits/
//   https://www.caas.gov.sg/unmanned-aircraft/no-fly-zones-and-ua-flying-areas/
/* eslint-disable */
import type { CityPermission } from "./qskyway.permission";

export const PERMISSION_SINGAPORE: CityPermission = {
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
