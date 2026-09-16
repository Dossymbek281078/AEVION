// Свежесть правила Вены: полигон CTR LOWW приходит ВЕКТОРОМ из WFS Austro
// Control, значит его можно перепроверять как фид FAA — а не верить снимку
// от 16.09.2026, зашитому в qskyway.permission.vienna.ts.
//
// Спрашивает у сервиса: (1) полигон с designator LOWW всё ещё накрывает все
// четыре угла квадрата твина; (2) пределы и класс те же, что записаны в
// permission-слое (GND–2500 ft AMSL, класс D); (3) запись помечена current=Y.
// Любое расхождение — код 1 с адресным текстом. Сеть не ответила — код 2:
// «спросить не удалось» ≠ «всё в порядке».
//
//   node scripts/qskyway-vienna-ctr-check.mjs
import fs from "node:fs";

// Квадрат берём из самого твина (текстом, без импорта .ts — скрипт обычный node).
const twinText = fs.readFileSync(new URL("../src/routes/qskyway.city.vienna.ts", import.meta.url), "utf8");
const CITY_VIENNA = { bbox: JSON.parse(twinText.match(/"bbox":(\{[^}]+\})/)[1]) };

const BASE = "https://sdigeo-free.austrocontrol.at/geoserver/free/ows";
const EXPECT = { designator: "LOWW", upper_limit: "2500 FT AMSL", lower_limit: "GND", class_1: "D", current: "Y" };

function inside(ring, lon, lat) {
  let c = false;
  for (let k = 0, j = ring.length - 1; k < ring.length; j = k++) {
    const [x1, y1] = ring[k], [x2, y2] = ring[j];
    if ((y1 > lat) !== (y2 > lat) && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
}

const { minLat, maxLat, minLon, maxLon } = CITY_VIENNA.bbox;
const url = `${BASE}?service=WFS&version=2.0.0&request=GetFeature&typeNames=free:CTR&outputFormat=application/json` +
  `&srsName=EPSG:4326&bbox=${minLon},${minLat},${maxLon},${maxLat},EPSG:4326`;
let j;
try {
  const r = await fetch(url, { headers: { "User-Agent": "AEVION-QSkyway/1.0 (vienna ctr check)" }, signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  j = await r.json();
} catch (e) {
  console.log(`СПРОСИТЬ НЕ УДАЛОСЬ: ${e.message} — это не «всё в порядке»`);
  process.exitCode = 2;
}
if (j) {
  const problems = [];
  const f = (j.features || []).find((x) => x.properties?.designator === EXPECT.designator);
  if (!f) problems.push(`в квадрате нет полигона CTR ${EXPECT.designator} (найдено: ${(j.features || []).map((x) => x.properties?.designator).join(",") || "ничего"})`);
  else {
    for (const [k, v] of Object.entries(EXPECT)) if (String(f.properties[k]) !== v) problems.push(`${k}: сервис отдаёт «${f.properties[k]}», в permission-слое «${v}»`);
    const ring = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates[0][0] : f.geometry.coordinates[0];
    for (const [name, lon, lat] of [["SW", minLon, minLat], ["NE", maxLon, maxLat], ["SE", maxLon, minLat], ["NW", minLon, maxLat]]) {
      if (!inside(ring, lon, lat)) problems.push(`угол ${name} квадрата вне полигона CTR — покрытие уже не 100 %`);
    }
    console.log(`CTR ${f.properties.designator}: ${f.properties.lower_limit}–${f.properties.upper_limit}, класс ${f.properties.class_1}, действует с ${f.properties.effectivedate_begin}, current=${f.properties.current}, вершин ${ring.length}`);
  }
  if (problems.length) { console.log("РАСХОЖДЕНИЯ:\n  " + problems.join("\n  ")); process.exitCode = 1; }
  else console.log("OK: полигон и пределы совпадают с permission-слоем, все 4 угла внутри");
}
