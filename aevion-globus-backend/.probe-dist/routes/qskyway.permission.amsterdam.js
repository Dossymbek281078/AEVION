"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_AMSTERDAM = void 0;
exports.PERMISSION_AMSTERDAM = {
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
