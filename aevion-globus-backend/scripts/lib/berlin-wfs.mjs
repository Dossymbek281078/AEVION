// Measured building heights and footprints for Berlin from the Senate's open
// "Gebäudehöhen (Umweltatlas)" WFS — LoD2-derived roof heights per cadastral
// building outline, licence dl-de-zero-2.0.
//
// 16.09.2026, шестой город — Берлин. Проверено 16.09: слой
// `ua_gebaeudehoehen:gebaeudehoehen`, родной CRS EPSG:25833, но сервер сам
// перепроецирует в WGS84 (`srsName=urn:ogc:def:crs:EPSG::4326`, GeoJSON отдаёт
// [lon, lat]) — своей математики, как у RD для Амстердама, не нужно. Поля:
// `hoehe` (высота, м), `geschosse` (этажи), `dachart`, `funktion_txt`, `gml_id`.
// Замер по Потсдамер-плац (52.505–52.514 × 13.366–13.386): 1910 контуров.
//
// Что это по классу: обмер (hs=0) — LoD2 из лидара/фотограмметрии Сената, а не
// тег. Чем меряет `hoehe` (конёк или максимум крыши) — сверять гистограммой
// «тег OSM выше обмера» при сборке; пока osmTallerIsTag не ставить.

const UA = "AEVION-QSkyway/1.0 (city twin builder; Berlin Umweltatlas WFS, dl-de-zero-2.0)";
const BASE = "https://gdi.berlin.de/services/wfs/ua_gebaeudehoehen";
const LAYER = "ua_gebaeudehoehen:gebaeudehoehen";
const CRS = "urn:ogc:def:crs:EPSG::4326";

/**
 * @param {{minLat:number,maxLat:number,minLon:number,maxLon:number}} bbox WGS84
 * @param {{log?:(s:string)=>void}} opts
 * @returns {Promise<Array<{h:number, ring:Array<[number,number]>, id:string}>>} ring — [lon, lat]
 */
export async function fetchBerlinOutlines(bbox, { log = () => {} } = {}) {
  const out = [];
  let start = 0, total = null, noHeight = 0, noFootprint = 0;
  const PAGE = 1000;
  for (let page = 0; page < 200; page++) {
    const url = `${BASE}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${LAYER}` +
      `&srsName=${CRS}&bbox=${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon},${CRS}` +
      `&count=${PAGE}&startIndex=${start}&outputFormat=application/json`;
    let j;
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA }, signal: AbortSignal.timeout(120_000) });
        if (!r.ok) throw new Error(`Berlin WFS HTTP ${r.status}`);
        j = await r.json();
        break;
      } catch (e) {
        if (attempt >= 4) throw e;
        log(`  Berlin WFS: ${e.message} at startIndex ${start}, retry ${attempt}/3`);
        await new Promise((res) => setTimeout(res, 15_000 * attempt));
      }
    }
    if (total === null) { total = j.numberMatched ?? 0; log(`  Berlin WFS: ${total} buildings in the box`); }
    const feats = j.features || [];
    if (!feats.length) break;
    for (const f of feats) {
      const h = Number(f.properties?.hoehe);
      if (!(h > 0)) { noHeight++; continue; }
      const g = f.geometry;
      // MultiPolygon → первое кольцо первого полигона; Polygon → первое кольцо.
      const ring = g?.type === "MultiPolygon" ? g.coordinates?.[0]?.[0] : g?.type === "Polygon" ? g.coordinates?.[0] : null;
      if (!ring || ring.length < 3) { noFootprint++; continue; }
      out.push({ h: Math.round(h * 10) / 10, ring: ring.map(([lon, lat]) => [lon, lat]), id: f.properties?.gml_id || f.id });
    }
    start += feats.length;
    if (start >= total) break;
  }
  log(`  Berlin WFS: outlines with a height ${out.length}, skipped: no height ${noHeight}, no footprint ${noFootprint}`);
  return out;
}

// Самопроверка на квадрате Потсдамер-плац: число, доля с высотой, распределение.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const bbox = { minLat: 52.505, maxLat: 52.514064, minLon: 13.366, maxLon: 13.3836 };
  const o = await fetchBerlinOutlines(bbox, { log: (s) => console.log(s) });
  const hs = o.map((x) => x.h).sort((a, b) => a - b);
  const q = (p) => hs[Math.min(hs.length - 1, Math.floor(p * hs.length))];
  console.log(`outlines ${o.length}; h p10 ${q(0.1)} p50 ${q(0.5)} p90 ${q(0.9)} max ${q(1)}; первая точка ${JSON.stringify(o[0]?.ring[0])}`);
}
