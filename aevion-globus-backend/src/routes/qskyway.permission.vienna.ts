// QSkyway — LOWW CTR regime over the VIENNA (Innere Stadt) twin.
//
// The strongest basis of the seven cities after NYC: the VOLUME comes as a
// vector polygon from the regulator's own service. Austro Control publishes
// its airspace on a free GeoServer (sdigeo-free.austrocontrol.at, layer
// `free:CTR`, no fees, no access constraints); the LOWW feature carries the
// limits as attributes:
//
//   designator LOWW, type CTR, lower_limit GND, upper_limit 2500 FT AMSL,
//   class D, callsign WIEN TOWER, frequency 119.400 / 123.800, H24,
//   effectivedate_begin 2020-11-06, aip_link → AD 2 LOWW 2.17 (current cycle).
//
// The whole Innere Stadt square (48.204–48.213 × 16.360–16.376) lies inside the
// polygon — all four corners and Stephansdom tested point-in-polygon on
// 2026-09-16 — so 100 % of the grid is under the CTR by geometry. Class D means
// flight is allowed WITH a Wien Tower clearance (kind "permission", not a
// wall); Austria publishes no permanent prohibited areas (ENR 5.1).
//
// Freshness: the layer has a sibling `free:CTR_EFFDATE` and every feature an
// effective-date pair, so drift can be checked like the FAA feed — not wired
// yet; the sampled date below is the day the polygon was read.
//
// Sources (read 2026-09-16):
//   https://sdigeo-free.austrocontrol.at/geoserver/free/ows?service=WFS&request=GetCapabilities
//   https://eaip.austrocontrol.at/lo/260806/PART_2/LO_ENR_5_1_en.pdf (no permanent prohibited areas)
/* eslint-disable */
import type { CityPermission } from "./qskyway.permission";

export const PERMISSION_VIENNA: CityPermission = {
  authority: "Austro Control / Wien Tower (диспетчерская зона LOWW)",
  authorityEn: "Austro Control / Wien Tower (LOWW control zone)",
  source: "WFS Austro Control (free:CTR) — LOWW CTR: GND–2500 ft AMSL, класс D, Wien Tower 119.400/123.800, H24; действует с 2020-11-06",
  sourceUrl: "https://sdigeo-free.austrocontrol.at/geoserver/free/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=free:CTR&outputFormat=application/json",
  regime: "Весь квадрат Внутреннего города лежит в диспетчерской зоне LOWW (GND–2500 ft AMSL, класс D): каждый полёт — только с разрешения Wien Tower; постоянных запретных зон в Австрии нет (ENR 5.1)",
  regimeEn: "The whole Innere Stadt square lies inside the LOWW control zone (GND–2500 ft AMSL, class D): every flight needs a Wien Tower clearance; Austria publishes no permanent prohibited areas (ENR 5.1)",
  kind: "permission",
  basis: "ingested",
  effective: "Austro Control WFS free:CTR, feature LOWW effective from 2020-11-06 (current = Y on 2026-09-16)",
  sampled: "2026-09-16",
  // 60 × 51 cells of the Innere Stadt twin — every corner is inside the CTR polygon.
  sampledCells: 3060,
  cellsRequiringPermission: 3060,
  coveragePct: 100,
};
