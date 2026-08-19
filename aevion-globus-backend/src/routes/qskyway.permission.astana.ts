// QSkyway — published prohibited airspace over the ASTANA twin.
//
// Kazakhstan does publish low-altitude restrictions after all — not as a feed,
// but in its eAIP, which is the authoritative document rather than a convenience
// API. ENR 5.1 lists prohibited/restricted areas in ICAO DDMMSS coordinates, and
// one of them sits directly on this twin.
//
// UAP28: a 4.5 km circle centred 51°07'32"N 071°26'46"E, GND to 4800 ft, H24.
// Measured against our own grid: 11040 of 11040 cells — the ENTIRE twin — fall
// inside it.
//
// This matters more than a coverage statistic. Until this was checked, the module
// animated air taxis over Astana against an invented 320 m "government quarter"
// circle while the actual published rule prohibits flight over the whole area up
// to ~1460 m. The illustrative zone was not merely a placeholder — it understated
// the real restriction by a factor of fourteen in radius. Saying so plainly is
// the entire reason this module distinguishes "ours" from "the regulator's".
//
// Source: AIP Kazakhstan, ENR 5.1 (Казаэронавигация / ans.kz), AIRAC 2026-05-14.
// Coordinates parsed from the published table, not approximated from a map image
// — hence basis "ingested".
/* eslint-disable */
import type { CityPermission } from "./qskyway.permission";

export const PERMISSION_ASTANA: CityPermission = {
  authority: "Казаэронавигация / AIP KZ",
  // Для англоязычной оговорки в подписанном документе: адресат читает латиницей.
  authorityEn: "Kazaeronavigatsia (ANS of Kazakhstan) / AIP KZ",
  source: "AIP Kazakhstan ENR 5.1 — запретная зона UAP28 (круг R=4.5 км, 51°07'32\"N 071°26'46\"E)",
  sourceUrl: "https://www.ans.kz/AIP/eAIP/2026-05-14-AIRAC/html/eAIP/UA-ENR-5.1-ru-RU.html",
  regime: "Запретная зона UAP28: полёты запрещены от земли до 4800 ft, круглосуточно",
  regimeEn: "Prohibited area UAP28: flights are forbidden from the ground up to 4800 ft, around the clock",
  kind: "prohibition",
  basis: "ingested",
  effective: "AIRAC 2026-05-14",
  sampled: "2026-07-26",
  sampledCells: 11040,
  cellsRequiringPermission: 11040,
  coveragePct: 100,
};
