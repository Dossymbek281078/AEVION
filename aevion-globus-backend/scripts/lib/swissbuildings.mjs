// Measured building heights and footprints for Switzerland from swisstopo's
// swissBUILDINGS3D 3.0 (open data, CityGML LoD2) — one zip per ~5.8×3 km tile,
// found through the STAC API; inside, ONE GML of ~1.8 GB. Parsed as a STREAM
// (the PLATEAU cache lesson): the zip's single deflate entry is inflated on the
// fly and buildings are cut out one `<bldg:Building>` at a time.
//
// 16.09.2026, разведка восьмого города (Цюрих). Замер по тайлу 1091-23: 9214
// зданий, у каждого `bldg:measuredHeight`, кольцо GroundSurface в EPSG:2056
// (LV95, x≈2 681 394, y≈1 248 826). LV95 → WGS84 — приближённые формулы
// swisstopo («Näherungsformeln», точность ~1 м), самопроверка на Цюрихе ниже.
//
// Класс: обмер (hs=0) — фотограмметрия/лидар swisstopo; measuredHeight — высота
// здания над землёй по модели. Что она включает (шпили, надстройки) — смотреть
// гистограмму «тег OSM выше обмера» при первой сборке.

import fs from "node:fs";
import zlib from "node:zlib";

const UA = "AEVION-QSkyway/1.0 (city twin builder; swissBUILDINGS3D, swisstopo open data)";
const STAC = "https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissbuildings3d_3_0/items";

/** LV95 (EPSG:2056) → WGS84, swisstopo approximation. */
export function lv95ToWgs84(E, N) {
  const y = (E - 2_600_000) / 1e6, x = (N - 1_200_000) / 1e6;
  const lon = (2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y) * 100 / 36;
  const lat = (16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.0140 * x * x * x) * 100 / 36;
  return [lon, lat];
}

/** Which tile zips (CityGML) cover a WGS84 bbox — newest year per tile. */
export async function findTileZips(bbox) {
  const url = `${STAC}?bbox=${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}&limit=50`;
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`STAC HTTP ${r.status}`);
  const j = await r.json();
  const byTile = new Map();
  for (const it of j.features || []) {
    const m = it.id.match(/_(\d{4})_(\d{4}-\d{2})$/);
    if (!m) continue;
    const zip = Object.values(it.assets || {}).find((a) => /citygml\.zip$/.test(a.href));
    if (!zip) continue;
    const prev = byTile.get(m[2]);
    if (!prev || prev.year < Number(m[1])) byTile.set(m[2], { year: Number(m[1]), href: zip.href });
  }
  return [...byTile.entries()].map(([tile, v]) => ({ tile, ...v }));
}

/** Скачать zip в файл (один раз; кэш по имени). */
export async function downloadOnce(href, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = `${dir}/${href.split("/").pop()}`;
  if (fs.existsSync(file) && fs.statSync(file).size > 1_000_000) return file;
  const r = await fetch(href, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(600_000) });
  if (!r.ok) throw new Error(`tile HTTP ${r.status}`);
  const tmp = file + ".part";
  await new Promise((res, rej) => {
    const w = fs.createWriteStream(tmp);
    r.body.pipeTo(new WritableStream({ write(c) { return new Promise((ok) => w.write(Buffer.from(c), ok)); }, close() { w.end(); } })).then(res, rej);
  });
  fs.renameSync(tmp, file);
  return file;
}

/**
 * Поток текста единственной записи zip: локальный заголовок (30 байт + имя +
 * extra), затем сырой deflate до конца записи. Zip64 не нужен для чтения — размер
 * записи мы не используем, читаем до конца потока.
 */
function gmlStream(zipFile) {
  const fd = fs.openSync(zipFile, "r");
  const head = Buffer.alloc(30);
  fs.readSync(fd, head, 0, 30, 0);
  if (head.readUInt32LE(0) !== 0x04034b50) throw new Error("not a zip local header");
  const method = head.readUInt16LE(8), nameLen = head.readUInt16LE(26), extraLen = head.readUInt16LE(28);
  fs.closeSync(fd);
  const start = 30 + nameLen + extraLen;
  const raw = fs.createReadStream(zipFile, { start });
  if (method === 0) return raw;
  if (method !== 8) throw new Error(`zip method ${method} unsupported`);
  return raw.pipe(zlib.createInflateRaw());
}

/**
 * @param {string} zipFile
 * @param {{minLat:number,maxLat:number,minLon:number,maxLon:number}} bbox WGS84 — оставляем здания, чей центроид внутри
 * @param {{log?:(s:string)=>void}} opts
 * @returns {Promise<Array<{h:number, ring:Array<[number,number]>, id:string}>>} ring — [lon, lat]
 */
export async function readSwissBuildings(zipFile, bbox, { log = () => {} } = {}) {
  const out = [];
  let buf = "", total = 0, noHeight = 0, noGround = 0;
  const stream = gmlStream(zipFile);
  stream.setEncoding("utf8");
  for await (const chunk of stream) {
    buf += chunk;
    let i;
    while ((i = buf.indexOf("</bldg:Building>")) >= 0) {
      const s = buf.lastIndexOf("<bldg:Building", i);
      const el = s >= 0 ? buf.slice(s, i) : "";
      buf = buf.slice(i + 16);
      if (!el) continue;
      total++;
      // Вырезаем indexOf-ом, не регуляркой: `[\s\S]*?` по элементу в сотни
      // килобайт (десятки WallSurface) давала 17 минут на тайл (замер 16.09).
      const hi = el.indexOf("measuredHeight");
      const h = hi >= 0 ? parseFloat(el.slice(el.indexOf(">", hi) + 1, el.indexOf("<", hi))) : NaN;
      if (!(h > 0)) { noHeight++; continue; }
      const gi = el.indexOf("<bldg:GroundSurface");
      const pi = gi >= 0 ? el.indexOf("<gml:posList", gi) : -1;
      if (pi < 0) { noGround++; continue; }
      const p0 = el.indexOf(">", pi) + 1, p1 = el.indexOf("<", p0);
      const v = el.slice(p0, p1).trim().split(/\s+/).map(Number);
      const ring = [];
      for (let k = 0; k + 2 < v.length; k += 3) ring.push(lv95ToWgs84(v[k], v[k + 1]));
      if (ring.length < 3) { noGround++; continue; }
      const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length, cy = ring.reduce((a, p) => a + p[1], 0) / ring.length;
      if (cx < bbox.minLon || cx > bbox.maxLon || cy < bbox.minLat || cy > bbox.maxLat) continue;
      const idm = el.match(/gml:id="([^"]+)"/);
      out.push({ h: Math.round(h * 10) / 10, ring, id: idm ? idm[1] : `b${total}` });
    }
    // Не держать хвост без границы здания бесконечно: обрезаем до последнего открытия.
    if (buf.length > 50_000_000) { const s = buf.lastIndexOf("<bldg:Building"); buf = s > 0 ? buf.slice(s) : ""; }
  }
  log(`  swissBUILDINGS3D: ${total} buildings in the tile, ${out.length} inside the box; skipped: no height ${noHeight}, no ground ${noGround}`);
  return out;
}

// Самопроверка: LV95-центр Цюриха (Hauptbahnhof ≈ 2683 200 / 1248 100) → ~8.540 E, 47.378 N.
export function selfTest() {
  const [lon, lat] = lv95ToWgs84(2_683_200, 1_248_100);
  return { lon: +lon.toFixed(4), lat: +lat.toFixed(4), ok: Math.abs(lon - 8.540) < 0.003 && Math.abs(lat - 47.378) < 0.003 };
}
