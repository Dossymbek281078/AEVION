// Measured building heights and footprints from the Dutch 3D BAG (TU Delft /
// Kadaster): every building of the Netherlands with a LiDAR (AHN) roof height.
//
// 16.09.2026, пятый город — Амстердам. Источник открытый (CC BY 4.0), без ключа:
// OGC-подобный API `https://api.3dbag.nl/collections/pand/items?bbox=…` с bbox
// ТОЛЬКО в RD New (EPSG:28992), постраничная выдача offset/limit≤100. Каждое
// здание — CityJSONFeature: контур LoD0 (MultiSurface), высота земли
// `b3_h_maaiveld` и крыши `b3_h_dak_max` в NAP; высота здания = разность.
// Замер по Зёйдасу 16.09: 2876 зданий на 1.2×1.0 км, без высоты 0 из 50.
//
// Что это по классу: обмер (hs=0) — лидар, а не тег. Максимум крыши, а не
// мачты (как у NYC height_roof), поэтому тег OSM выше него — законная мачта,
// osmTallerIsTag НЕ ставить.
//
// RD → WGS84: приближение Schreutelkorps (1999), точность ~1 м — для сетки 20 м
// достаточно. Формула переписана по опубликованным коэффициентам; проверка на
// известной точке (Rijksdriehoek: x=155000,y=463000 → 52.15517°N 5.38721°E)
// в самопроверке ниже.

const UA = "AEVION-QSkyway/1.0 (city twin builder; 3D BAG, CC BY 4.0)";

export function rdToWgs84(x, y) {
  const dX = (x - 155000) / 100000, dY = (y - 463000) / 100000;
  const lat = 52.1551744 + (
    3235.65389 * dY - 32.58297 * dX * dX - 0.2475 * dY * dY - 0.84978 * dX * dX * dY
    - 0.0655 * dY ** 3 - 0.01709 * dX * dX * dY * dY - 0.00738 * dX + 0.0053 * dX ** 4
    - 0.00039 * dX * dX * dY ** 3 + 0.00033 * dX ** 4 * dY - 0.00012 * dX * dY) / 3600;
  const lon = 5.38720621 + (
    5260.52916 * dX + 105.94684 * dX * dY + 2.45656 * dX * dY * dY - 0.81885 * dX ** 3
    + 0.05594 * dX * dY ** 3 - 0.05607 * dX ** 3 * dY + 0.01199 * dY - 0.00256 * dX ** 3 * dY * dY
    + 0.00128 * dX * dY ** 4 + 0.00022 * dY * dY - 0.00022 * dX * dX + 0.00026 * dX ** 5) / 3600;
  return [lon, lat];
}

/** Обратно, для bbox: WGS84 → RD (Schreutelkorps, тот же порядок точности). */
export function wgs84ToRd(lon, lat) {
  const dF = 0.36 * (lat - 52.1551744), dL = 0.36 * (lon - 5.38720621);
  const x = 155000 + 190094.945 * dL - 11832.228 * dF * dL - 114.221 * dF * dF * dL - 32.391 * dL ** 3
    - 0.705 * dF - 2.34 * dF ** 3 * dL - 0.608 * dF * dL ** 3 - 0.008 * dL * dL + 0.148 * dF * dF * dL ** 3;
  const y = 463000 + 309056.544 * dF + 3638.893 * dL * dL + 73.077 * dF * dF - 157.984 * dF * dL * dL
    + 59.788 * dF ** 3 + 0.433 * dL - 6.439 * dF * dF * dL * dL - 0.032 * dF * dL + 0.092 * dL ** 4 - 0.054 * dF * dL ** 4;
  return [x, y];
}

/**
 * @param {{minLat:number,maxLat:number,minLon:number,maxLon:number}} bbox WGS84
 * @param {{log?:(s:string)=>void}} opts
 * @returns {Promise<Array<{h:number, ring:Array<[number,number]>, id:string}>>} ring — [lon, lat]
 */
export async function fetchBag3dOutlines(bbox, { log = () => {} } = {}) {
  const [x1, y1] = wgs84ToRd(bbox.minLon, bbox.minLat), [x2, y2] = wgs84ToRd(bbox.maxLon, bbox.maxLat);
  const rd = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)].map((v) => Math.round(v * 100) / 100);
  const out = [];
  let offset = 0, total = null, noHeight = 0, noFootprint = 0;
  for (let page = 0; page < 500; page++) {
    // `offset=0` ЯВНО — сервер отвечает 500 (замер 16.09: те же bbox и limit без
    // offset — 200; с offset=100 — 200). Первую страницу просим без параметра.
    const url = `https://api.3dbag.nl/collections/pand/items?bbox=${rd.join(",")}&limit=100${offset ? `&offset=${offset}` : ""}`;
    let j;
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA }, signal: AbortSignal.timeout(120_000) });
        if (!r.ok) throw new Error(`3D BAG HTTP ${r.status}`);
        j = await r.json();
        break;
      } catch (e) {
        // Сервер отдаёт 500/502 сериями по нескольку минут (замер 16.09: три
        // попытки с шагом 10 с не хватило) — ждём дольше, но конечное число раз.
        if (attempt >= 6) throw e;
        log(`  3D BAG: ${e.message} at offset ${offset}, retry ${attempt}/5`);
        await new Promise((res) => setTimeout(res, 20_000 * attempt));
      }
    }
    if (total === null) { total = j.numberMatched ?? 0; log(`  3D BAG: ${total} buildings in the RD box ${rd.join(",")}`); }
    const feats = j.features || [];
    if (!feats.length) break;
    const t = j.metadata?.transform;
    for (const f of feats) {
      const tr = f.transform || t;
      const co = f.CityObjects || {};
      const bid = Object.keys(co).find((k) => co[k].type === "Building");
      const b = bid ? co[bid] : null;
      const a = b?.attributes || {};
      const h = a.b3_h_dak_max - a.b3_h_maaiveld;
      if (!(h > 0)) { noHeight++; continue; }
      const g0 = (b.geometry || []).find((g) => String(g.lod) === "0");
      const surf = g0?.boundaries?.[0]?.[0];
      if (!surf || surf.length < 3 || !tr) { noFootprint++; continue; }
      const ring = surf.map((i) => {
        const v = f.vertices[i];
        return rdToWgs84(v[0] * tr.scale[0] + tr.translate[0], v[1] * tr.scale[1] + tr.translate[1]);
      });
      out.push({ h: Math.round(h * 10) / 10, ring, id: a.identificatie || f.id });
    }
    offset += feats.length;
    if (offset >= total || !(j.links || []).some((l) => l.rel === "next")) break;
  }
  log(`  3D BAG: outlines with a height ${out.length}, skipped: no height ${noHeight}, no footprint ${noFootprint}`);
  return out;
}

/** Самопроверка формул: центр системы RD и обратный ход. */
export function selfTest() {
  const [lon, lat] = rdToWgs84(155000, 463000);
  const okCenter = Math.abs(lat - 52.1551744) < 1e-5 && Math.abs(lon - 5.38720621) < 1e-5;
  const [x, y] = wgs84ToRd(4.9, 52.34); const [lon2, lat2] = rdToWgs84(x, y);
  const okRound = Math.abs(lon2 - 4.9) < 2e-5 && Math.abs(lat2 - 52.34) < 2e-5;
  return { okCenter, okRound, x: Math.round(x), y: Math.round(y) };
}
