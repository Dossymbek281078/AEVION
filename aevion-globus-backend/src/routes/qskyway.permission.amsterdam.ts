// QSkyway — Schiphol CTR regime over the AMSTERDAM (Zuidas) twin.
//
// Same KIND as Tokyo/Singapore — a gate on whether the flight may happen at
// all — and the strongest BASIS of the five cities: the volume is published as
// GEOMETRY by the Dutch ANSP itself. LVNL eAIP, AD 2 EHAM 2.17 (AIRAC AMDT
// 09-2026, effective 2026-09-03):
//
//   SCHIPHOL CTR (EHAM): 522454N 0043805E – 522821N 0043824E – 522801N 0044812E
//   – 522621N 0044803E along clockwise arc (radius 8 NM, centre 521829N
//   0044551E) – 522454N 0043805E. 3000 FT AMSL / GND, class C, Schiphol Tower.
//   "Restricted to ACFT capable of maintaining two-way radio communication with
//   Schiphol TWR, unless prior permission from Aerodrome Control has been
//   obtained."
//
// The whole Zuidas square lies on the arc side: the four bbox corners are
// 3.9–4.7 NM from the arc centre at bearings 60–70°, and the arc runs clockwise
// 10°→323° — so 100 % of the grid is inside the CTR, by construction, not by
// sampling (computed 2026-09-16 from the published coordinates). Under EU 2019/947 as applied in NL, a CTR is a drone no-fly volume
// except with ATC/ILT permission; an air taxi needs a clearance from Schiphol
// TWR for every flight. `basis: "ingested"` — read from the published
// coordinates, not from a raster.
//
// Not claimed: the PDOK "drone no-fly zones" dataset was withdrawn from
// production on 2026-06-30, so no NL-wide vector layer is ingested; the CTR
// above is the only published volume this twin knows, and it covers all of it.
/* eslint-disable */
import type { CityPermission } from "./qskyway.permission";

export const PERMISSION_AMSTERDAM: CityPermission = {
  authority: "LVNL (Luchtverkeersleiding Nederland) / eAIP Netherlands",
  authorityEn: "LVNL (Air Traffic Control the Netherlands) / eAIP Netherlands",
  source: "eAIP NL, AD 2 EHAM 2.17 — SCHIPHOL CTR: GND–3000 ft AMSL, класс C, диспетчерская вышка Схипхола; полёт без двусторонней радиосвязи с TWR только по предварительному разрешению",
  sourceUrl: "https://eaip.lvnl.nl/web/eaip/AIRAC%20AMDT%2009-2026_2026_09_03/eAIP/EH-AD%202%20EHAM%201-en-GB.html",
  regime: "Весь квадрат Зёйдаса лежит в CTR Схипхола (GND–3000 ft AMSL, класс C): каждый полёт — только с разрешения диспетчерской вышки Схипхола (LVNL); для БПЛА CTR — зона запрета без разрешения",
  regimeEn: "The whole Zuidas square lies inside the Schiphol CTR (GND–3000 ft AMSL, class C): every flight needs a clearance from Schiphol Tower (LVNL); for UAS the CTR is a no-fly volume without permission",
  kind: "permission",
  basis: "ingested",
  effective: "AIRAC AMDT 09-2026, effective 2026-09-03",
  sampled: "2026-09-16",
  // 60 × 51 cells of the Zuidas twin — every corner of the bbox is inside the
  // 8 NM arc of the CTR, so every cell is under it by geometry.
  sampledCells: 3060,
  cellsRequiringPermission: 3060,
  coveragePct: 100,
};
