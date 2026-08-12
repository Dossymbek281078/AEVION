#!/usr/bin/env node
/**
 * QSkyway — сколько высот в твине выдуманы, и чем их можно было бы заменить,
 * НЕ изобретая правду.
 *
 * ЗАЧЕМ. Замер 12.08.2026 по Астане: 470 зданий, обмерено 0, а 240 стоят на
 * слепом дефолте 12 м. Двенадцать метров — не «нет данных», а число, одинаковое
 * для сарая и для жилой башни: для первого это лишний крюк, для второй — полёт
 * с меньшим запасом, чем нужно. Твин честно помечает такие высоты классом
 * `guessed` (+16 м страховки), но сам дефолт от этого не перестаёт быть
 * выдуманным.
 *
 * ЧТО СЧИТАЕТ. Для зданий БЕЗ height и БЕЗ levels — их тип (`building=*`), и
 * рядом медиану высоты по зданиям ТОГО ЖЕ ТИПА в ТОМ ЖЕ городе, у которых
 * этажность или высота известна. Это не изобретение числа: город отвечает про
 * себя сам. Решение о замене дефолта здесь НЕ принимается и твин не трогается —
 * скрипт только показывает, на сколько дефолт расходится с городом.
 *
 * Использование:
 *   node scripts/audit-guessed-heights.mjs astana
 *   node scripts/audit-guessed-heights.mjs astana --all   (все типы, не только массовые)
 *   флаги кэша те же: --no-cache, --osm-cache <каталог>
 */

import fs from "node:fs";
import {
  parseMetres, overpassBodyProblem,
  METRES_PER_LEVEL, PARAPET_M, DEFAULT_HEIGHT_M,
} from "./lib/city-twin-geometry.mjs";
import { cachedOverpass, osmCacheDir } from "./lib/overpass.mjs";

const BBOX = {
  astana: { minLat: 51.1183717, maxLat: 51.1356973, minLon: 71.4104119, maxLon: 71.4432041 },
  nyc: { minLat: 40.7474728, maxLat: 40.7629936, minLon: -74.0002478, maxLon: -73.9758674 },
  tokyo: { minLat: 35.683592, maxLat: 35.6978747, minLon: 139.6879457, maxLon: 139.7037075 },
};
const UA = "AEVION-QSkyway/1.0 (guessed-height audit; contact via github.com/Dossymbek281078/AEVION)";
// Формула этажей и слепой дефолт берутся ИЗ той же библиотеки, что и сборщик
// твина, а не переписываются сюда числами. Переписанная копия разошлась бы
// молча, и отчёт начал бы сравнивать с дефолтом, которого в продукте нет, —
// ровно тот класс тихой неправды, который этот же отчёт и ищет в данных.
const M_PER_LEVEL = METRES_PER_LEVEL, PARAPET = PARAPET_M, BLIND_DEFAULT = DEFAULT_HEIGHT_M;
// Что реально пролетает над слепым зданием: сам дефолт + обязательный просвет
// (CLEAR=15) + страховка за класс guessed (SRC_CLEARANCE[2]=16). Ровно это
// число и делает вопрос о дефолте вопросом безопасности, а не аккуратности:
// здание своего типа ВЫШЕ него было бы препятствием над коридором.
const CLEAR = 15, GUESSED_CLEARANCE = 16;
const BLIND_CORRIDOR = BLIND_DEFAULT + CLEAR + GUESSED_CLEARANCE;

const city = process.argv[2];
const showAll = process.argv.includes("--all");
if (!BBOX[city]) {
  console.error(`unknown city "${city}" — known: ${Object.keys(BBOX).join(", ")}`);
  process.exit(1);
}
const b = BBOX[city];
const cacheDir = osmCacheDir(process.argv, new URL("../.aevion-data/osm-cache/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

const elements = await cachedOverpass({
  cacheFile: cacheDir ? `${cacheDir}/audit-${city}-buildings.json` : null,
  label: `QSkyway guessed-height audit: ${city}`,
  ua: UA,
  bodyProblem: overpassBodyProblem,
  query: `[out:json][timeout:180];`
    + `(way["building"](${b.minLat},${b.minLon},${b.maxLat},${b.maxLon});`
    + ` relation["building"](${b.minLat},${b.minLon},${b.maxLat},${b.maxLon}););out tags;`,
});

const median = (xs) => {
  const s = [...xs].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : +(((s[m - 1] + s[m]) / 2).toFixed(1));
};

/** Известная высота здания: тег height, иначе счёт этажей. null — неизвестна. */
function knownHeight(tags) {
  const h = parseMetres(tags.height) ?? parseMetres(tags["building:height"]);
  if (h && h > 0) return h;
  const lv = Number.parseFloat(tags["building:levels"]);
  if (Number.isFinite(lv) && lv > 0) return +(lv * M_PER_LEVEL + PARAPET).toFixed(1);
  return null;
}

const byType = new Map(); // тип → { blind: n, known: [высоты] }
let total = 0, withHeightTag = 0, withLevels = 0, blind = 0;
for (const el of elements) {
  const t = el.tags ?? {};
  total++;
  const type = String(t.building || "yes");
  const slot = byType.get(type) ?? { blind: 0, known: [] };
  const h = knownHeight(t);
  if (parseMetres(t.height) || parseMetres(t["building:height"])) withHeightTag++;
  else if (h !== null) withLevels++;
  if (h === null) { blind++; slot.blind++; } else slot.known.push(h);
  byType.set(type, slot);
}

console.log(`\n── ${city}: ${total} зданий в границах твина ──`);
console.log(`  с тегом height                : ${withHeightTag}`);
console.log(`  без height, но со счётом этажей: ${withLevels}`);
console.log(`  без того и другого (слепые ${BLIND_DEFAULT} м): ${blind}`);

const rows = [...byType.entries()]
  .filter(([, v]) => v.blind > 0)
  .sort((x, y) => y[1].blind - x[1].blind);
const shown = showAll ? rows : rows.filter(([, v]) => v.blind >= 3);

console.log(`\n── чем город отвечает про себя сам ──`);
console.log(`  тип                  слепых   свидетельств   медиана типа   против ${BLIND_DEFAULT} м   выше коридора ${BLIND_CORRIDOR} м`);
let covered = 0, uncovered = 0;
for (const [type, v] of rows) {
  if (v.known.length >= 3) covered += v.blind; else uncovered += v.blind;
}
for (const [type, v] of shown) {
  const med = v.known.length >= 3 ? median(v.known) : null;
  const delta = med === null ? "—" : `${med > BLIND_DEFAULT ? "+" : ""}${(med - BLIND_DEFAULT).toFixed(1)} м`;
  const over = v.known.filter((h) => h > BLIND_CORRIDOR).length;
  const overTxt = v.known.length === 0 ? "—"
    : `${over} из ${v.known.length}${over ? ` (до ${Math.max(...v.known).toFixed(0)} м)` : ""}`;
  console.log(
    `  ${type.padEnd(20)} ${String(v.blind).padStart(5)}   ${String(v.known.length).padStart(10)}   `
    + `${(med === null ? "мало данных" : med + " м").padStart(12)}   ${delta.padStart(10)}   ${overTxt}`,
  );
}
if (!showAll && rows.length > shown.length) {
  console.log(`  … ещё ${rows.length - shown.length} типов с 1–2 слепыми зданиями (--all покажет все)`);
}

console.log(
  `\nИтог: медиана по своему типу нашлась бы для ${covered} слепых зданий из ${blind}`
  + ` (${Math.round((100 * covered) / Math.max(1, blind))}%); остальным ${uncovered} город ответить нечем —`
  + ` для них ${BLIND_DEFAULT} м остаётся честнее любой подстановки.`,
);
// Доходит ли слепота тегов до КОРИДОРОВ — отдельный вопрос, и без него отчёт
// пугает зря. В Токио и Нью-Йорке высоты перекрыты городским обмером (PLATEAU,
// NYC Open Data), и слепой тег там до маршрутизации не доживает; в Астане
// обмера нет вовсе, и тег несущий. Ровно эту проверку я не сделал 11.08 по
// занижённым тегам Токио и подал находку как живую опасность.
const TWIN_FILE = { astana: "qskyway.city.ts", nyc: "qskyway.city.nyc.ts", tokyo: "qskyway.city.tokyo.ts" };
try {
  const twinPath = new URL(`../src/routes/${TWIN_FILE[city]}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const dq = JSON.parse(fs.readFileSync(twinPath, "utf8").match(/"dataQuality":(\{.*?\})(?:,"heightReview"|\})/s)?.[1] ?? "null");
  if (dq) {
    console.log(
      `\n── а доходит ли это до коридоров ──\n`
      + `  в ТВИНЕ ${city}: обмерено ${dq.measured}, выведено ${dq.derived}, угадано ${dq.guessed} (из ${dq.total}).`,
    );
    console.log(
      dq.guessed > 0 && dq.measured === 0
        ? `  Городского обмера нет ни у одного здания — слепой тег здесь НЕСУЩИЙ, и цифры выше применимы к маршрутам.`
        : dq.guessed === 0
          ? `  Слепых высот в твине не осталось: теги перекрыты обмером, до коридоров эта слепота не доходит.`
          : `  Большая часть перекрыта обмером; до коридоров доходят только ${dq.guessed} угаданных зданий, а не все слепые теги выше.`,
    );
  }
} catch { /* твин не читается — отчёт по OSM остаётся в силе, просто без сверки */ }

console.log(
  `\nСкрипт ничего не меняет. Замена дефолта потребует пересборки твина`
  + ` (fetch-city-twin.mjs) и хранения типа здания, а класс высоты обязан остаться`
  + ` guessed: медиана по типу — догадка получше, но всё ещё догадка, и`
  + ` страховочный просвет за неё платить надо.`,
);
