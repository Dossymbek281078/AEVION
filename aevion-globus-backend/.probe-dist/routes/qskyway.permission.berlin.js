"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_BERLIN = void 0;
exports.PERMISSION_BERLIN = {
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
