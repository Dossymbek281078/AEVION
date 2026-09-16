// QSkyway — ED-R 146 (Berlin) regime over the BERLIN (Potsdamer Platz) twin.
//
// Same KIND as Amsterdam's CTR — a published VOLUME with coordinates, so the
// basis is "ingested", not sampled. AIP Germany ENR 5.1 (DFS; edition read
// 2024-03-21, the area is unchanged since its creation in 2005 — re-check the
// current AIRAC at aip.dfs.de before relying on the vertical limit):
//
//   ED-R 146 (Berlin): Kreis mit einem Radius von 3 NM um / circle with a radius
//   of 3 NM centred at N 52 31 07 E 013 22 34 (the Reichstag). GND – 5000 ft MSL.
//   H24 + HOL. "nur schriftlich / in writing only: Bundesaufsichtsamt für
//   Flugsicherung (BAF)". Remarks ENR 5.1-30: for UAS the innermost 1 NM around
//   the Reichstag is the strictest tier (government district kept clear).
//
// The whole Potsdamer Platz square lies 0.39–0.89 NM from the centre — inside
// the inner 1 NM tier, so 100 % of the grid is under the strictest rule, by
// geometry. What this layer says is "permission", not "prohibition": BAF grants
// written transit permission (Durchfluggenehmigung), which is the operator's
// paperwork, not a wall — the ceiling layer stays empty because ENR 5.1 gives a
// volume, not a corridor height.
//
// Sources (read 2026-09-16):
//   AIP Germany ENR 5.1 (DFS) — ED-R 146 entry, coordinates and limits as above
//   https://www.baf.bund.de/DE/Themen/Luftraum_Flugverfahren_Recht/Flugbeschraenkungsgebiete_UAS/ED-R146_Berlin/ED-R146_Berlin_node.html
/* eslint-disable */
import type { CityPermission } from "./qskyway.permission";

export const PERMISSION_BERLIN: CityPermission = {
  authority: "BAF (Федеральное ведомство надзора за аэронавигацией) / AIP Germany (DFS)",
  authorityEn: "BAF (Bundesaufsichtsamt für Flugsicherung) / AIP Germany (DFS)",
  source: "AIP Germany ENR 5.1 — ED-R 146 (Berlin): круг 3 NM вокруг Рейхстага (N 52 31 07 E 013 22 34), GND–5000 ft MSL, H24; разрешение только письменно от BAF",
  sourceUrl: "https://www.baf.bund.de/DE/Themen/Luftraum_Flugverfahren_Recht/Flugbeschraenkungsgebiete_UAS/ED-R146_Berlin/ED-R146_Berlin_node.html",
  regime: "Весь квадрат Потсдамер-плац лежит внутри ED-R 146 (круг 3 NM вокруг Рейхстага, GND–5000 ft MSL) и во внутреннем ярусе 1 NM: каждый полёт — только по письменному разрешению BAF (Durchfluggenehmigung); правительственный квартал держат свободным от полётов",
  regimeEn: "The whole Potsdamer Platz square lies inside ED-R 146 (3 NM circle around the Reichstag, GND–5000 ft MSL) and within its inner 1 NM tier: every flight needs a written BAF transit permission (Durchfluggenehmigung); the government district is kept clear of flights",
  kind: "permission",
  basis: "ingested",
  effective: "AIP Germany ENR 5.1, edition read 2024-03-21 (area unchanged since 2005; current AIRAC to be re-checked at aip.dfs.de)",
  sampled: "2026-09-16",
  // 60 × 51 cells of the Potsdamer Platz twin — the four bbox corners are
  // 0.39–0.89 NM from the Reichstag, so every cell is inside the 1 NM tier by geometry.
  sampledCells: 3060,
  cellsRequiringPermission: 3060,
  coveragePct: 100,
};
