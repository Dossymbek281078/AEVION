// Measured building heights for Vienna from the city's open Baukörpermodell
// (LOD1 bodies, CC BY 4.0, data.wien.gv.at) — one building = several bodies by
// height class (shared BW_GEB_ID); the twin needs the tallest body per outline.
//
// 16.09.2026, разведка седьмого города. Проверено: слой `ogdwien:FMZKBKMOGD`,
// GeoJSON, bbox ТОЛЬКО с явным суффиксом CRS (`…,EPSG:4326`; без него — 0),
// координаты [lon, lat]. Высота тела = O_KOTE − T_KOTE (обе от Wiener Null).
// Квадрат центра 48.204–48.213 × 16.36–16.38: 5059 тел.

// Только ASCII: с «ö» в User-Agent сервер отвечает 500 (замер 16.09 — четыре
// варианта заголовков, падал ровно этот).
const UA = "AEVION-QSkyway/1.0 (city twin builder; Stadt Wien Baukoerpermodell, CC BY 4.0)";
const BASE = "https://data.wien.gv.at/daten/geo";
const LAYER = "ogdwien:FMZKBKMOGD";

/**
 * @param {{minLat:number,maxLat:number,minLon:number,maxLon:number}} bbox WGS84
 * @param {{log?:(s:string)=>void}} opts
 * @returns {Promise<Array<{h:number, ring:Array<[number,number]>, id:string}>>} ring — [lon, lat]; одна запись на ТЕЛО
 */
export async function fetchWienBodies(bbox, { log = () => {} } = {}) {
  const out = [];
  let start = 0, total = null, noHeight = 0, noFootprint = 0;
  const PAGE = 1000;
  for (let page = 0; page < 200; page++) {
    const url = `${BASE}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${LAYER}` +
      `&srsName=EPSG:4326&bbox=${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat},EPSG:4326` +
      `&count=${PAGE}${start ? `&startIndex=${start}` : ""}&outputFormat=application/json`;
    let j;
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA }, signal: AbortSignal.timeout(120_000) });
        if (!r.ok) throw new Error(`Wien WFS HTTP ${r.status}`);
        j = await r.json();
        break;
      } catch (e) {
        if (attempt >= 4) throw e;
        log(`  Wien WFS: ${e.message} at startIndex ${start}, retry ${attempt}/3`);
        await new Promise((res) => setTimeout(res, 15_000 * attempt));
      }
    }
    if (total === null) { total = j.numberMatched ?? 0; log(`  Wien WFS: ${total} bodies in the box`); }
    const feats = j.features || [];
    if (!feats.length) break;
    for (const f of feats) {
      const p = f.properties || {};
      if (p.LAYER && p.LAYER !== "Gebäude") continue;
      const h = Number(p.O_KOTE) - Number(p.T_KOTE ?? p.HOEHE_DGM);
      if (!(h > 0)) { noHeight++; continue; }
      const g = f.geometry;
      const ring = g?.type === "MultiPolygon" ? g.coordinates?.[0]?.[0] : g?.type === "Polygon" ? g.coordinates?.[0] : null;
      if (!ring || ring.length < 3) { noFootprint++; continue; }
      out.push({ h: Math.round(h * 10) / 10, ring: ring.map(([lon, lat]) => [lon, lat]), id: String(p.BW_GEB_ID ?? p.FMZK_ID) });
    }
    start += feats.length;
    if (start >= total) break;
  }
  log(`  Wien WFS: bodies with a height ${out.length}, skipped: no height ${noHeight}, no footprint ${noFootprint}`);
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const bbox = { minLat: 48.204, maxLat: 48.213064, minLon: 16.36, maxLon: 16.3776 };
  const o = await fetchWienBodies(bbox, { log: (s) => console.log(s) });
  const hs = o.map((x) => x.h).sort((a, b) => a - b);
  const q = (p) => hs[Math.min(hs.length - 1, Math.floor(p * hs.length))];
  const byB = new Set(o.map((x) => x.id));
  console.log(`bodies ${o.length}, distinct buildings ${byB.size}; h p10 ${q(0.1)} p50 ${q(0.5)} p90 ${q(0.9)} max ${q(1)}`);
}
