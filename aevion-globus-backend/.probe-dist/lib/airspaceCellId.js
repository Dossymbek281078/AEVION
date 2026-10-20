"use strict";
/**
 * QSkyway — устойчивый идентификатор ячейки воздушного пространства (серверная
 * копия).
 *
 * ЗАЧЕМ ДВЕ КОПИИ. Ингест живёт в `scripts/lib/airspace-cell-id.mjs`, а сторож
 * свежести — здесь, в `src/`. Папка `scripts/` вне области сборки бэкенда, и
 * импортировать её из `src/` нельзя: сборка соберётся, а `dist/` упадёт в
 * рантайме. В репозитории это уже принятая развилка (см. `city-twin-geometry.mjs`
 * и projector в `qskyway.ts`), и обычно её сторожит комментарий «держите
 * одинаковыми».
 *
 * Комментарий здесь заменён на ТЕСТ: `tests/qskywayAirspaceCellId.test.ts`
 * прогоняет обе реализации по одному набору входов и требует совпадения. Пока
 * они расходятся молча, сторож и ингест говорят на разных языках ключей — а это
 * ровно та поломка, ради которой всё и затевалось.
 *
 * Смысл самого ключа и выбор точности — в комментарии .mjs-копии.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.stableCellId = stableCellId;
function fixed(n, digits) {
    const v = Number(n);
    if (!Number.isFinite(v))
        return "nan";
    const s = v.toFixed(digits);
    return s === "-" + (0).toFixed(digits) ? (0).toFixed(digits) : s;
}
function stableCellId(cell, { prefix = "faa", digits = 4 } = {}) {
    const icao = typeof cell?.airportIcao === "string" ? cell.airportIcao.trim().toUpperCase() : "";
    const sw = `${fixed(cell?.minLat, digits)}_${fixed(cell?.minLon, digits)}`;
    return icao ? `${prefix}-${icao}-${sw}` : `${prefix}-${sw}`;
}
