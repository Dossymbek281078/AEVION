// Measured building heights from an ArcGIS I3S "3D Object" scene layer, as
// POINTS: one centroid + one height per building.
//
// Найдено 15.09.2026 для Астаны. Геопортал Управления архитектуры города
// (gis.esaulet.kz) публикует 3D-модель зданий (Hosted/Build_151222) как
// SceneServer. Его таблица (FeatureServer) закрыта токеном, но сам I3S-слой
// открыт: страницы узлов, атрибуты и геометрия читаются без ключа. Атрибут
// h_1 — высота здания в метрах (Байтерек 97.0 м, Хан Шатыр 139 м — сошлись
// с известными), геометрия даёт положение: вершины хранятся смещениями в
// ГРАДУСАХ от центра узла (indexCRS 4326), высота z — метры.
//
// Почему точки, а не контуры. Контур пришлось бы восстанавливать из
// треугольников меша; центроид считается точно и дёшево, а сопоставление
// с контуром OSM идёт по правилу «центроид внутри контура» — тем же, что у
// reconcileMeasuredOutlines для обмерных контуров (точка представлена
// квадратом 1×1 м). Здания, не попавшие ни в один контур OSM, в твин НЕ
// добавляются: у точки нет площади, и «здание 1 м² высотой 300 м» было бы
// иглой-препятствием, которого в городе нет.
//
// Формат геометрии — legacy I3S 1.6 (defaultGeometrySchema слоя): заголовок
// [vertexCount u32, featureCount u32], затем массивы по атрибутам (position
// f32×3, normal f32×3, uv0 f32×2, color u8×4), затем featureId u64 и
// faceRange u32×2 на здание. Буфер отдаётся gzip'ом без заголовка
// Content-Encoding — проверяем магические байты сами. Проверено побайтно:
// узел с 68 070 вершинами / 2443 зданиями разобрался в 2 489 616 байт ровно.

import { gunzipSync } from "node:zlib";

const M_PER_LAT = 110540;
const M_PER_LON_EQ = 111320;

function u32Array(buf) {
  const n = buf.readUInt32LE(0);
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readUInt32LE(4 + i * 4);
  return out;
}
function f64Array(buf) {
  const n = buf.readUInt32LE(0);
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readDoubleLE(8 + i * 8);
  return out;
}

// Сервер города небыстрый и на параллельных запросах иногда молчит по минуте:
// первый прогон упал таймаутом на 82 узлах. Три подхода с паузой, как у Overpass.
async function getBuffer(url, ua) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": ua }, signal: AbortSignal.timeout(180_000) });
      if (!res.ok) throw new Error(`I3S: HTTP ${res.status} for ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      last = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 10_000 * attempt));
    }
  }
  throw last;
}

/**
 * @param {string} layerUrl   .../SceneServer/layers/0
 * @param {{minLat:number,maxLat:number,minLon:number,maxLon:number}} bbox
 * @param {{ua:string, idField?:string, heightField?:string, log?:(s:string)=>void}} opts
 * @returns {Promise<Array<{id:number, lon:number, lat:number, h:number}>>}
 */
export async function fetchI3sBuildingPoints(layerUrl, bbox, { ua, idField = "objectid", heightField = "h_1", log = () => {} } = {}) {
  const layer = await (await fetch(`${layerUrl}?f=json`, { headers: { "User-Agent": ua }, signal: AbortSignal.timeout(60_000) })).json();
  const keyOf = (name) => layer.attributeStorageInfo?.find((a) => a.name === name)?.key;
  const idKey = keyOf(idField), hKey = keyOf(heightField);
  if (!idKey || !hKey) throw new Error(`I3S: no attribute key for ${idField}/${heightField} in ${layerUrl}`);
  const schema = layer.store?.defaultGeometrySchema;
  const order = schema?.ordering?.join(",");
  if (order !== "position,normal,uv0,color") throw new Error(`I3S: unexpected vertex ordering "${order}" — parser knows position,normal,uv0,color`);

  const mLat = M_PER_LAT, mLon = M_PER_LON_EQ * Math.cos((((bbox.minLat + bbox.maxLat) / 2) * Math.PI) / 180);
  const leaves = [];
  for (let p = 0; p < 10_000; p++) {
    const res = await fetch(`${layerUrl}/nodepages/${p}?f=json`, { headers: { "User-Agent": ua }, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) break;
    const page = await res.json();
    if (!page.nodes?.length) break;
    for (const n of page.nodes) {
      if (n.children?.length || !n.mesh) continue;
      const c = n.obb?.center, hs = n.obb?.halfSize;
      if (!c || !hs) continue;
      // halfSize — метры вдоль осей коробки; поворот не учитываем, берём с запасом
      const r = Math.hypot(hs[0], hs[1]);
      const dLat = r / mLat, dLon = r / mLon;
      if (c[1] + dLat < bbox.minLat || c[1] - dLat > bbox.maxLat || c[0] + dLon < bbox.minLon || c[0] - dLon > bbox.maxLon) continue;
      leaves.push({ attr: n.mesh.attribute.resource, geo: n.mesh.geometry.resource, center: c });
    }
  }
  log(`  I3S: leaf nodes touching the bbox: ${leaves.length}`);

  const points = [];
  for (const L of leaves) {
    const [ida, ha, g] = await Promise.all([
      getBuffer(`${layerUrl}/nodes/${L.attr}/attributes/${idKey}/0`, ua),
      getBuffer(`${layerUrl}/nodes/${L.attr}/attributes/${hKey}/0`, ua),
      getBuffer(`${layerUrl}/nodes/${L.geo}/geometries/0`, ua),
    ]);
    const ids = u32Array(ida), hs = f64Array(ha);
    const hById = new Map();
    ids.forEach((id, i) => hById.set(id, hs[i]));
    const b = g[0] === 0x1f && g[1] === 0x8b ? gunzipSync(g) : g;
    const vc = b.readUInt32LE(0), fc = b.readUInt32LE(4);
    let off = 8;
    const pos = new Float32Array(b.buffer.slice(b.byteOffset + off, b.byteOffset + off + vc * 12));
    off += vc * 12 + vc * 12 + vc * 8 + vc * 4;
    const fid = new Array(fc);
    for (let i = 0; i < fc; i++) fid[i] = Number(b.readBigUInt64LE(off + i * 8));
    off += fc * 8;
    const fr = new Uint32Array(b.buffer.slice(b.byteOffset + off, b.byteOffset + off + fc * 8));
    if (off + fc * 8 !== b.length) throw new Error(`I3S: geometry ${L.geo} parsed ${off + fc * 8} of ${b.length} bytes — schema drift`);
    for (let i = 0; i < fc; i++) {
      const a = fr[i * 2], z = fr[i * 2 + 1];
      let sx = 0, sy = 0, n = 0;
      const xy = [];
      for (let v = a * 3; v <= z * 3 + 2; v++) { const x = pos[v * 3], y = pos[v * 3 + 1]; sx += x; sy += y; n++; xy.push([x, y]); }
      const h = hById.get(fid[i]);
      if (!(h > 0)) continue;
      const lon = L.center[0] + sx / n, lat = L.center[1] + sy / n;
      if (lat < bbox.minLat || lat > bbox.maxLat || lon < bbox.minLon || lon > bbox.maxLon) continue;
      // Контур — выпуклая оболочка вершин меша (в градусах, от центра узла).
      // Для Г-образного дома она шире настоящего контура — это ошибка в
      // безопасную сторону: препятствие не меньше настоящего. Замер 15.09.2026:
      // 338 из 705 зданий города в квадрате Астаны отсутствуют в OSM вовсе.
      const hull = convexHull(xy).map(([x, y]) => [L.center[0] + x, L.center[1] + y]);
      points.push({ id: fid[i], lon, lat, h, ring: hull.length >= 3 ? hull : pointAsTinyRing(lon, lat) });
    }
  }
  log(`  I3S: building points inside the bbox with a height: ${points.length}`);
  return points;
}

/** Выпуклая оболочка (monotone chain), точки [x, y]; вырожденные случаи дают < 3 вершин. */
export function convexHull(points) {
  const pts = Array.from(new Map(points.map((p) => [`${p[0]},${p[1]}`, p])).values()).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

/** Точка → квадрат 1×1 м в градусах, чтобы пройти через reconcileMeasuredOutlines как контур. */
export function pointAsTinyRing(lon, lat) {
  const dLat = 0.5 / M_PER_LAT;
  const dLon = 0.5 / (M_PER_LON_EQ * Math.cos((lat * Math.PI) / 180));
  return [[lon - dLon, lat - dLat], [lon + dLon, lat - dLat], [lon + dLon, lat + dLat], [lon - dLon, lat + dLat]];
}
