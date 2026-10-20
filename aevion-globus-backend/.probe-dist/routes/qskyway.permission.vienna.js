"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_VIENNA = void 0;
exports.PERMISSION_VIENNA = {
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
