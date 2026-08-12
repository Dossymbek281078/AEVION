import { Router, Request, Response } from "express";
import crypto from "crypto";
import { CITY, CityData } from "./qskyway.city";
import { CITY_NYC } from "./qskyway.city.nyc";
import { CITY_TOKYO } from "./qskyway.city.tokyo";
import { NOFLY, WIND, NoFlyZone } from "./qskyway.zones";
import { getMetarWind, metarStatus } from "./qskyway.metar";
import { AIRSPACE, CeilingField, airspaceContentHash, airspaceSummary, ceilingAt, ceilingField, NO_CEILING } from "./qskyway.airspace";
import { airspaceFreshness } from "./qskyway.airspace.freshness";
import { anchorAirspace, verifyAnchoredAirspace } from "./qskyway.airspace.anchor";
import { AIRSPACE_PROOFS } from "./qskyway.airspace.proof";
import { PERMISSION, permissionSummary } from "./qskyway.permission";
import { getPool } from "../lib/dbPool";
import { isSmokeSlot, countLiveSlots } from "../lib/slotOrigin";
import { heightReviewFor, heightReviewsForCity } from "../data/qskywayHeightReview";
import { rateLimit } from "../lib/rateLimit";

/**
 * AEVION QSkyway — навигационный слой городского неба для аэротакси.
 *
 * Провайдер-независимый «Google Maps + ПДД неба»: 3D-аэрокоридоры поверх
 * реального цифрового двойника города. Мультигородской (Астана, Нью-Йорк,
 * Токио) — реальные здания из OpenStreetMap, поле высот 20 м.
 * Детерминированный движок; слоты опционально персистятся в Postgres
 * (getPool), при недоступности БД — in-memory fallback.
 *
 * Фаза 4: полигональные запретные зоны (обход в маршрутизации), послойная
 * ветровая модель (влияет на ETA), подпись двойника Ed25519 (QSign-аттестация),
 * скоринг пригодности посадочных площадок (шаг к муниципальным вертипортам).
 * Фаза 5 (уже реализована): страховочный просвет по уверенности в высотных
 * данных (measured/derived/guessed, см. SRC_CLEARANCE) — выше уверенность в
 * данных → ниже коридор. Фаза 6 (уже реализована): наземный ветер — реальный
 * METAR ближайшего аэропорта (aviationweather.gov, без ключа, см.
 * qskyway.metar.ts), не иллюстрация; graceful fallback на демо-модель при
 * недоступности фида. Фаза 7 (уже реализована): регуляторные потолки высоты из
 * официального фида — FAA UAS Facility Map для NYC (qskyway.airspace.ts).
 * Фаза 8 (уже реализована): режимы разрешений регулятора (qskyway.permission.ts)
 * — второй вид опубликованного правила. Токио: MLIT/JCAB, полёт над плотно
 * населённым районом (DID) требует разрешения министра; 100% твина под режимом.
 * Потолки и режимы НЕ смешиваются: первое ограничивает геометрию маршрута,
 * второе — саму операцию. Астана: сетки потолков нет, но AIP Казахстана публикует
 * запретную зону UAP28, накрывающую 100% твина. Ни один город больше не заявляет
 * «источника нет» — «нет API» и «нет правила» это разные вещи, и их смешение
 * несколько недель прятало UAP28 за выдуманным кружком радиусом 320 м.
 *
 * Честно: движок/PoC, не сертифицированное авиационное ПО. Данные зданий —
 * OpenStreetMap (ODbL, открытые). Точечные запретные зоны (qskyway.zones.ts)
 * по-прежнему ИЛЛЮСТРАТИВНЫ. Регуляторный потолок NYC — реальный (FAA UASFM),
 * но это сетка допусков для малых БВС Part 107, НЕ сертификация аэротакси.
 * Наземный ветер — реальный METAR с graceful fallback; послойный рост с высотой
 * — иллюстративная экстраполяция (METAR не содержит данных о ветре на высоте).
 *
 * Endpoints:
 *   GET  /health          — статус + список городов
 *   GET  /cities          — города (счётчики, bbox, подпись, площадки)
 *   GET  /city?city=id    — двойник + запретные зоны + ветер + потолки + подпись
 *   GET  /vertiports?city=id — площадки со скорингом пригодности
 *   POST /route           — {from,to,city?,respectCeiling?} → 4D-маршрут
 *                           (обход зон + ветер в ETA + регуляторный потолок)
 *   POST /route/justification — один подписанный документ «почему рейс обоснован»
 *   GET  /verify?city=id  — проверка подписей Ed25519 (двойник + слой ограничений)
 *   GET  /airspace/impact — сколько маршрутов между площадками реально укладывается в потолок
 *   POST /airspace/anchor — Bitcoin-якорь (OpenTimestamps) на слой ограничений
 *   GET  /airspace/proof  — вшитый Bitcoin-пруф текущей редакции + его проверка
 *   GET  /slots  · POST /slots — рынок 4D-слотов прав (QRight)
 */

export const qskywayRouter = Router();

const DISCLAIMER =
  "Движок/PoC, не сертифицированное авиационное ПО. Данные зданий — OpenStreetMap (ODbL). Наземный ветер — реальный METAR. Потолки высоты NYC — реальный фид FAA UASFM (сетка допусков Part 107 для малых БВС, НЕ сертификация аэротакси). Токио — реальный режим разрешений MLIT/JCAB (полёт над плотно населённым районом требует разрешения министра); значение снято выборкой по растровым тайлам регулятора, а не загружено вектором. Астана — реальная ЗАПРЕТНАЯ зона UAP28 из AIP Казахстана (круг R=4.5 км, GND–4800 ft, круглосуточно): полёты над твином запрещены, а не разрешены по согласованию; маршрутизация в демо оставлена как расчёт. Точечные запретные зоны и рост ветра с высотой остаются иллюстративными. Полёты требуют допуска (U-space/UTM/CAAC).";

// ── city registry ──────────────────────────────────────────────────────────
const CITIES: Record<string, CityData> = { astana: CITY, nyc: CITY_NYC, tokyo: CITY_TOKYO };
const DEFAULT_CITY = "astana";
const resolveCity = (id: unknown): { id: string; city: CityData } | null => {
  // hasOwnProperty.call, а не `in`: `in` идёт по цепочке прототипов, поэтому
  // `"constructor" in CITIES` истинно, ключом становилось само слово, а городом —
  // функция Object.prototype.constructor. Живой прод 28.07.2026 отвечал HTTP 500
  // на ?city=constructor, ?city=__proto__ и ?city=toString вместо честного 404
  // «неизвестный город» — и так на КАЖДОЙ ручке, зовущей resolveCity.
  //
  // Пятисотка здесь не косметика: это ручки регуляторного слоя, по которым
  // сторонний проверяющий судит, отвечает ли модуль предсказуемо.
  const known = typeof id === "string" && Object.prototype.hasOwnProperty.call(CITIES, id);
  const key = known ? (id as string) : id == null ? DEFAULT_CITY : null;
  return key ? { id: key, city: CITIES[key] } : null;
};

// ── engine constants ─────────────────────────────────────────────────────────
const FLOOR = 50;
const CLEAR = 15;
const BAND = 25;
// Phase 5: extra safety clearance by height-data confidence (metres), indexed by
// height source: 0=measured (a survey states this building's height — an OSM
// height tag, a PLATEAU measuredHeight, or both, in which case the twin carries
// the TALLER of the two: that is the height an aircraft has to clear, and both
// being measurements keeps the class honest),
// 1=derived (levels×3.2 plus a 1.6 m parapet allowance — verified against the
// committed Astana twin, 159/159 buildings, see scripts/fetch-city-twin.mjs;
// this comment said plain levels×3.2 until 2026-07-27, and so did the note
// shipped to users — OR, in Tokyo, a surveyed PLATEAU height whose building we
// identified by proximity rather than containment: the number is measured, the
// identification is inferred, and inference belongs in the class that gets
// extra room),
// 2=guessed (blind 12m default). A guessed height can badly understate the real
// building, so the corridor is flown higher until better data (LiDAR / CityGML
// LOD2 / Google 3D Tiles) raises confidence and lets it descend.
const SRC_CLEARANCE = [0, 6, 16];
const AVG_SPEED_MS = 25; // ~90 km/h
const MIN_SPEED_MS = 8;
const MAX_SPEED_MS = 42;
const SLOT_CAPACITY = 4;

// ── projection (lon/lat → local metres), matching the rasterizer ───────────────
function projector(city: CityData) {
  const { minLat, maxLat, minLon } = city.bbox;
  const lat0 = (minLat + maxLat) / 2;
  const mPerLat = 110540;
  const mPerLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return (lon: number, lat: number): [number, number] => [(lon - minLon) * mPerLon, (maxLat - lat) * mPerLat];
}
interface ZoneXY extends NoFlyZone { x: number; y: number; }
function zonesMeters(cityId: string, city: CityData): ZoneXY[] {
  const proj = projector(city);
  return (NOFLY[cityId] ?? []).map((z) => { const [x, y] = proj(z.center[0], z.center[1]); return { ...z, x, y }; });
}

// Russian pluralisation for the served strings. A figure this module computes
// and then renders as "1 площадок" undermines the care taken to compute it.
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

const obstOf = (g: CityData["grid"]) => (c: number, r: number): number =>
  c < 0 || r < 0 || c >= g.cols || r >= g.rows ? 999 : g.heights[r * g.cols + c];

// per-cell height-data source (0 measured / 1 derived / 2 guessed); out-of-grid = 0 (known open)
const srcOf = (g: CityData["grid"]) => (c: number, r: number): number =>
  c < 0 || r < 0 || c >= g.cols || r >= g.rows ? 0 : (g.src?.[r * g.cols + c] ?? 0);
const confClear = (s: number): number => SRC_CLEARANCE[s] ?? 0;

function edgeAltOf(g: CityData["grid"]) {
  const obst = obstOf(g);
  const src = srcOf(g);
  return (fc: number, fr: number, tc: number, tr: number): number => {
    const maxObst = Math.max(obst(fc, fr), obst(tc, tr));
    // confidence penalty from the least-trusted cell touched by this edge
    const conf = Math.max(confClear(src(fc, fr)), confClear(src(tc, tr)));
    const required = maxObst + CLEAR + conf;
    const band = Math.max(0, Math.ceil((required - FLOOR) / BAND));
    const eastOrNorth = tc - fc > 0 || tr - fr < 0;
    return FLOOR + band * BAND + (eastOrNorth ? 0 : BAND / 2);
  };
}

// cell-in-no-fly test (metres)
function noFlyTest(city: CityData, zones: ZoneXY[]) {
  const cell = city.grid.cell;
  return (c: number, r: number): boolean => {
    const x = (c + 0.5) * cell, y = (r + 0.5) * cell;
    for (const z of zones) if (Math.hypot(x - z.x, y - z.y) <= z.radiusM) return true;
    return false;
  };
}

// ── layered wind ───────────────────────────────────────────────────────────
// Ground reading prefers a live METAR observation (real, from the nearest
// airport); the altitude-growth model above ground stays the illustrative
// perBandMs slope (METAR carries no winds-aloft data). windSourceOf() below
// reports which case applied for a given city, honestly.
function windAt(cityId: string, altM: number): { fromDeg: number; speedMs: number } {
  const w = WIND[cityId] ?? { fromDeg: 270, baseMs: 3, perBandMs: 1 };
  const real = getMetarWind(cityId);
  const fromDeg = real?.fromDeg ?? w.fromDeg;
  const baseMs = real ? real.speedMs : w.baseMs;
  const band = Math.max(0, (altM - FLOOR) / BAND);
  return { fromDeg, speedMs: +(baseMs + band * w.perBandMs).toFixed(2) };
}
function windSourceOf(cityId: string): "metar" | "illustrative" {
  return getMetarWind(cityId) ? "metar" : "illustrative";
}
// tail-wind component (m/s, positive = помогает) for travel from (fc,fr)->(tc,tr) at altM
function tailwind(cityId: string, fc: number, fr: number, tc: number, tr: number, altM: number): number {
  const move = { e: tc - fc, n: -(tr - fr) }; // east, north
  const len = Math.hypot(move.e, move.n) || 1;
  const me = move.e / len, mn = move.n / len;
  const { fromDeg, speedMs } = windAt(cityId, altM);
  const toRad = ((fromDeg + 180) % 360) * Math.PI / 180; // куда дует
  const we = Math.sin(toRad), wn = Math.cos(toRad);
  return (we * me + wn * mn) * speedMs; // >0 попутный, <0 встречный
}

// ── binary-heap A* on the height field (with no-fly avoidance) ─────────────────
interface HeapNode { c: number; r: number; f: number; }
class MinHeap {
  private a: HeapNode[] = [];
  size(): number { return this.a.length; }
  push(n: HeapNode): void {
    const a = this.a; a.push(n); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop(): HeapNode {
    const a = this.a; const top = a[0]; const last = a.pop() as HeapNode;
    if (a.length) { a[0] = last; let i = 0;
      for (;;) { const l = 2 * i + 1, r = 2 * i + 2; let s = i;
        if (l < a.length && a[l].f < a[s].f) s = l;
        if (r < a.length && a[r].f < a[s].f) s = r;
        if (s === i) break; [a[s], a[i]] = [a[i], a[s]]; i = s; } }
    return top;
  }
}
interface Cell { c: number; r: number; }

/**
 * @param blocked     cell-level ban (no-fly zones)
 * @param edgeBlocked optional edge-level ban that also sees the flight altitude —
 *                    used by strict airspace mode, where an edge is illegal only
 *                    because the corridor it requires is above the published ceiling.
 */
function astar(
  g: CityData["grid"],
  s: Cell,
  goal: Cell,
  blocked: (c: number, r: number) => boolean,
  edgeBlocked?: (fc: number, fr: number, tc: number, tr: number, alt: number) => boolean,
): Cell[] | null {
  const cols = g.cols, rows = g.rows;
  const edgeAlt = edgeAltOf(g);
  const idx = (c: number, r: number): number => r * cols + c;
  const gsc = new Float64Array(cols * rows).fill(Infinity);
  const came = new Int32Array(cols * rows).fill(-1);
  const h = (c: number, r: number): number => Math.abs(c - goal.c) + Math.abs(r - goal.r);
  const open = new MinHeap();
  gsc[idx(s.c, s.r)] = 0;
  open.push({ c: s.c, r: s.r, f: h(s.c, s.r) });
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const isGoal = (c: number, r: number) => c === goal.c && r === goal.r;
  const isStart = (c: number, r: number) => c === s.c && r === s.r;
  while (open.size()) {
    const cur = open.pop();
    if (cur.c === goal.c && cur.r === goal.r) break;
    const ci = idx(cur.c, cur.r);
    for (const [dc, dr] of D) {
      const nc = cur.c + dc, nr = cur.r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      if (blocked(nc, nr) && !isGoal(nc, nr) && !isStart(nc, nr)) continue; // обход запретной зоны
      const alt = edgeAlt(cur.c, cur.r, nc, nr);
      // Unlike no-fly cells, a ceiling violation has no start/goal exemption:
      // a pad you cannot legally lift off from is not a usable pad.
      if (edgeBlocked?.(cur.c, cur.r, nc, nr, alt)) continue;
      const step = 1 + (alt - FLOOR) / 90;
      const t = gsc[ci] + step, ni = idx(nc, nr);
      if (t < gsc[ni]) { gsc[ni] = t; came[ni] = ci; open.push({ c: nc, r: nr, f: t + h(nc, nr) }); }
    }
  }
  let ci = idx(goal.c, goal.r);
  if (came[ci] < 0 && !isStart(goal.c, goal.r)) return null;
  const path: Cell[] = [];
  while (ci >= 0) { path.unshift({ c: ci % cols, r: Math.floor(ci / cols) }); ci = came[ci]; }
  return path.length > 1 ? path : null;
}

/**
 * Per-route verdict against the regulator's published ceiling.
 *
 * `compliant` answers one narrow question: does every segment of this corridor
 * stay at or below the altitude the authority publishes as automatically
 * authorizable for that cell? Non-compliant is not "illegal" — it means the
 * flight needs ATC/LAANC coordination, which is exactly what an operator has to
 * know before filing. Cities with no published feed report available:false and
 * no verdict, rather than a green tick that means nothing.
 */
interface AirspaceCompliance {
  available: boolean;
  compliant: boolean | null;
  coveragePct: number;
  exceedingSegments: number;
  zeroCeilingSegments: number;
  maxExceedanceM: number;
  lowestCeilingM: number | null;
  note: string;
}

function assessCeiling(field: CeilingField | null, path: Cell[], alts: number[]): AirspaceCompliance {
  if (!field) {
    return {
      available: false, compliant: null, coveragePct: 0, exceedingSegments: 0,
      zeroCeilingSegments: 0, maxExceedanceM: 0, lowestCeilingM: null,
      note: "Регуляторный фид для этого города не подключён — соответствие потолку не проверялось.",
    };
  }
  let covered = 0, exceeding = 0, zeroSegs = 0, maxExc = 0;
  let lowest: number | null = null;
  for (let k = 0; k < alts.length; k++) {
    // A segment is bound by the stricter of the two cells it touches.
    const ceil = Math.min(ceilingAt(field, path[k].c, path[k].r), ceilingAt(field, path[k + 1].c, path[k + 1].r));
    if (ceil === NO_CEILING) continue;
    covered++;
    lowest = lowest === null ? ceil : Math.min(lowest, ceil);
    if (ceil === 0) zeroSegs++;
    if (alts[k] > ceil) { exceeding++; maxExc = Math.max(maxExc, alts[k] - ceil); }
  }
  const compliant = exceeding === 0;
  return {
    available: true,
    compliant,
    coveragePct: Math.round((100 * covered) / Math.max(1, alts.length)),
    exceedingSegments: exceeding,
    zeroCeilingSegments: zeroSegs,
    maxExceedanceM: Math.round(maxExc),
    lowestCeilingM: lowest,
    note: compliant
      ? "Коридор укладывается в опубликованный потолок — автоматический допуск (LAANC) применим на всём протяжении."
      : `${exceeding} из ${alts.length} участков выше опубликованного потолка (макс. превышение ${Math.round(maxExc)} м) — нужна координация с УВД, автоматического допуска недостаточно.`,
  };
}

interface RouteResult {
  city: string; from: number; to: number; path: Cell[]; alts: number[]; obstacles: number[];
  distanceKm: number; cruiseAltM: number;
  etaMinStill: number; etaMinWind: number; avgWindMs: number; windFromDeg: number;
  avoidsNoFly: boolean;
  avgConfClearM: number; heightConfidencePct: number;
  respectCeiling: boolean;
  airspace: AirspaceCompliance;
}

function buildRoute(
  cityId: string, city: CityData, fromVp: number, toVp: number, respectCeiling = false,
): RouteResult | null {
  const vps = city.vertiports;
  if (fromVp < 0 || toVp < 0 || fromVp >= vps.length || toVp >= vps.length || fromVp === toVp) return null;
  const zones = zonesMeters(cityId, city);
  const blocked = noFlyTest(city, zones);
  const field = ceilingField(cityId, city);
  const a = vps[fromVp], b = vps[toVp];
  const ceilingGate = respectCeiling && field
    ? (fc: number, fr: number, tc: number, tr: number, alt: number): boolean =>
        alt > Math.min(ceilingAt(field, fc, fr), ceilingAt(field, tc, tr))
    : undefined;
  const path = astar(city.grid, { c: a.c, r: a.r }, { c: b.c, r: b.r }, blocked, ceilingGate);
  if (!path) return null;
  const edgeAlt = edgeAltOf(city.grid);
  const obst = obstOf(city.grid);
  const src = srcOf(city.grid);
  const cell = city.grid.cell;
  const alts: number[] = [];
  const obstacles: number[] = [];
  let timeStill = 0, timeWind = 0, windSum = 0, confSum = 0, measuredEdges = 0;
  for (let k = 0; k < path.length - 1; k++) {
    const alt = edgeAlt(path[k].c, path[k].r, path[k + 1].c, path[k + 1].r);
    alts.push(alt);
    obstacles.push(Math.max(obst(path[k].c, path[k].r), obst(path[k + 1].c, path[k + 1].r)));
    const worstSrc = Math.max(src(path[k].c, path[k].r), src(path[k + 1].c, path[k + 1].r));
    confSum += confClear(worstSrc);
    if (worstSrc === 0) measuredEdges++;
    const segLen = Math.hypot(path[k + 1].c - path[k].c, path[k + 1].r - path[k].r) * cell;
    const tw = tailwind(cityId, path[k].c, path[k].r, path[k + 1].c, path[k + 1].r, alt);
    const eff = Math.max(MIN_SPEED_MS, Math.min(MAX_SPEED_MS, AVG_SPEED_MS + tw));
    timeStill += segLen / AVG_SPEED_MS;
    timeWind += segLen / eff;
    windSum += Math.abs(tw);
  }
  const distanceKm = (alts.length * cell) / 1000;
  const w0 = windAt(cityId, FLOOR);
  return {
    city: cityId, from: fromVp, to: toVp, path, alts, obstacles,
    distanceKm: +distanceKm.toFixed(3),
    cruiseAltM: alts.reduce((m, v) => Math.max(m, v), 0),
    etaMinStill: +(timeStill / 60).toFixed(2),
    etaMinWind: +(timeWind / 60).toFixed(2),
    avgWindMs: +(windSum / Math.max(1, alts.length)).toFixed(2),
    windFromDeg: w0.fromDeg,
    avoidsNoFly: zones.length > 0,
    avgConfClearM: +(confSum / Math.max(1, alts.length)).toFixed(1),
    heightConfidencePct: Math.round(100 * measuredEdges / Math.max(1, alts.length)),
    respectCeiling,
    airspace: assessCeiling(field, path, alts),
  };
}

// ── чего стоит КОНКРЕТНОМУ коридору высота, которой мы сами не верим ──────────
//
// Твин помечает высоту сомнительной, интерфейс показывает «⚠ высота под
// вопросом» — но обе надписи про ГОРОД. Маршрут при этом молча закладывается на
// то же самое число: сетка высот у движка одна. Расхождение двух наших же
// ответов и есть дефект (разбор — в AEVION_QSKYWAY_HANDOFF_2026-07-26.md).
//
// Что здесь НЕ делается: высота не переписывается и из маршрутизации не
// выбрасывается. Позиция модуля прежняя — починка принадлежит источнику (OSM).
// Считается ровно одно: насколько этот коридор отличался бы, окажись правдой
// число из статьи объекта, которое человек уже проверил (qskywayHeightReview).
// Это не решение за источник, а названная цена расхождения.

/** Ячейки сетки, высоту которым дало здание, которое твин сам считает спорным. */
function suspectCellsOf(city: CityData): Map<number, number> {
  const out = new Map<number, number>(); // cellIndex → индекс здания
  const g = city.grid;
  for (const s of city.dataQuality?.suspect ?? []) {
    // `was` означает, что источник спорил сам с собой и движок УЖЕ взял счёт
    // этажей: в сетке лежит исправленное число, коридор поднимать нечему.
    if (s.was !== undefined) continue;
    const b = city.buildings[s.i];
    if (!b) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of b.r) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const c0 = Math.max(0, Math.floor(minX / g.cell)), c1 = Math.min(g.cols - 1, Math.floor(maxX / g.cell));
    const r0 = Math.max(0, Math.floor(minY / g.cell)), r1 = Math.min(g.rows - 1, Math.floor(maxY / g.cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        // Внутри габарита здания и ровно его высота: растеризатор мог задеть
        // соседнюю ячейку, но приписать ей чужое здание мы не имеем права.
        if (g.heights[r * g.cols + c] === b.h) out.set(r * g.cols + c, s.i);
      }
    }
  }
  return out;
}

/**
 * Копия твина, где спорные высоты заменены на опубликованные в статье объекта.
 * Только для сравнения — наружу как данные города НЕ отдаётся.
 * null, если по городу нечего сравнивать (нет разбора или разбор подтвердил тег).
 */
// Ключ — сам объект твина, а не id города: по одному id тест подставляет
// синтетический город, и кэш по строке отдал бы ему чужую подложку (а хуже —
// оставил бы свою в кэше настоящей Астаны).
const reviewedTwinCache = new WeakMap<CityData, CityData | null>();
function reviewedTwin(cityId: string, city: CityData): CityData | null {
  const hit = reviewedTwinCache.get(city);
  if (hit !== undefined) return hit;
  const reviews = heightReviewsForCity(cityId).filter((r) => r.verdict !== "confirmed");
  const cells = suspectCellsOf(city);
  let patched = 0;
  const heights = city.grid.heights.slice();
  for (const [cellIdx, buildingIdx] of cells) {
    const rev = reviews.find((r) => r.index === buildingIdx);
    if (!rev) continue;
    heights[cellIdx] = Math.round(rev.publishedM);
    patched++;
  }
  const twin = patched > 0 ? { ...city, grid: { ...city.grid, heights } } : null;
  reviewedTwinCache.set(city, twin);
  return twin;
}

interface HeightDispute {
  /** этот коридор действительно опирается на спорную высоту */
  affected: boolean;
  building: number;
  osm: string;
  taggedM: number;
  publishedM: number;
  publishedSource: string;
  /** участков коридора, поднятых ВЕДУЩИМ спорным зданием (полем `building`) */
  segments: number;
  /** другие спорные здания, тоже поднявшие этот коридор — обычно пусто */
  alsoDisputed: number[];
  cruiseAltM: number;
  /** каким был бы коридор, окажись правдой число из статьи */
  cruiseAltMIfPublished: number | null;
  cruiseDeltaM: number | null;
  distanceKm: number;
  distanceKmIfPublished: number | null;
  note: string;
}

/**
 * Расхождение для одного маршрута. Считает и вторую половину эффекта: спорная
 * высота меняет не только эшелон, но и сам путь — A* обходит завышенное
 * препятствие, и крюк стоит времени, даже когда крейсерская высота совпала.
 */
function heightDisputeFor(
  cityId: string, city: CityData, route: RouteResult,
): HeightDispute | null {
  const cells = suspectCellsOf(city);
  if (cells.size === 0) return null;
  const g = city.grid;
  const obst = obstOf(g);
  // Считаем ПО ЗДАНИЯМ, а не одним счётчиком: если коридор задел два спорных
  // дома, «участков 5» рядом с числами одного из них — уже неправда, а такую
  // неправду в подписанном документе не отличить от правды.
  const perBuilding = new Map<number, number>();
  for (let k = 0; k < route.alts.length; k++) {
    const a = route.path[k], b = route.path[k + 1];
    const ia = a.r * g.cols + a.c, ib = b.r * g.cols + b.c;
    const worst = Math.max(obst(a.c, a.r), obst(b.c, b.r));
    // Участок «поднят спорным зданием» только если именно оно и оказалось
    // самым высоким препятствием ребра: пролёт рядом с башней, но под другим
    // домом повыше, к спору отношения не имеет.
    for (const [idx, bi] of [[ia, cells.get(ia)], [ib, cells.get(ib)]] as [number, number | undefined][]) {
      if (bi === undefined) continue;
      if (g.heights[idx] !== worst) continue;
      perBuilding.set(bi, (perBuilding.get(bi) ?? 0) + 1);
      break;
    }
  }
  if (perBuilding.size === 0) return null;
  // Ведущее здание — то, что подняло больше участков; остальные названы отдельно,
  // а не свалены в его счётчик.
  const ranked = [...perBuilding.entries()].sort((x, y) => y[1] - x[1]);
  const building = ranked[0][0];
  const segments = ranked[0][1];
  const alsoDisputed = ranked.slice(1).map(([bi]) => bi);
  const rev = heightReviewFor(cityId, building);
  const shadowTwin = reviewedTwin(cityId, city);
  const shadow = shadowTwin ? buildRoute(cityId, shadowTwin, route.from, route.to, route.respectCeiling) : null;
  const cruiseIf = shadow ? shadow.cruiseAltM : null;
  const delta = cruiseIf === null ? null : route.cruiseAltM - cruiseIf;
  return {
    affected: true,
    building,
    osm: rev?.osm ?? "—",
    taggedM: rev?.taggedM ?? city.buildings[building]?.h ?? 0,
    publishedM: rev?.publishedM ?? 0,
    publishedSource: rev?.publishedSource ?? "—",
    segments,
    alsoDisputed,
    cruiseAltM: route.cruiseAltM,
    cruiseAltMIfPublished: cruiseIf,
    cruiseDeltaM: delta,
    distanceKm: route.distanceKm,
    distanceKmIfPublished: shadow ? shadow.distanceKm : null,
    note: rev
      ? `${segments} из ${route.alts.length} участков коридора подняты зданием, высоте которого мы сами не верим: ${rev.taggedM} м из тега OSM при ${rev.publishedM} м в статье объекта. Высоту не переписываем — починка принадлежит источнику (${rev.osm}); здесь названа цена расхождения.`
      : `${segments} из ${route.alts.length} участков коридора подняты высотой, которую твин считает спорной и по которой ещё нет разбора человеком.`,
  };
}

/**
 * Все маршруты «каждая площадка в каждую» в совещательном режиме, посчитанные
 * один раз на процесс.
 *
 * Два эндпоинта — `/airspace/impact` и `/height-dispute` — считают по одному и
 * тому же набору пар. Данные компилтайм-детерминированные, ответ измениться
 * внутри процесса не может — по той же причине кэшируются ceilingField() и сам
 * impact.
 *
 * Честно про выигрыш, чтобы не выдавать страховку за оптимизацию. Замер
 * 12.08.2026 на холодном процессе: `/height-dispute?city=astana` — 2.5 мс,
 * `/airspace/impact?city=nyc` — 0.75 с (там вдвое больше расчёта: ещё и строгий
 * режим). Сегодня ни один город не проходит ОБА пути: у Астаны нет сетки
 * потолков (impact выходит сразу), у Нью-Йорка и Токио нет неразобранных
 * спорных высот (dispute выходит сразу). То есть общий кэш сейчас не экономит
 * ничего — он на случай города, где будет и то и другое. Раньше в этом
 * комментарии стояло «страница платила дважды на каждую загрузку»: это было
 * рассуждение, а замер его не подтвердил.
 */
const pairRoutesCache = new Map<string, (RouteResult | null)[]>();
function allPairRoutes(cityId: string, city: CityData): (RouteResult | null)[] {
  const hit = pairRoutesCache.get(cityId);
  if (hit) return hit;
  const n = city.vertiports.length;
  const out: (RouteResult | null)[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    out.push(buildRoute(cityId, city, i, j, false));
  }
  pairRoutesCache.set(cityId, out);
  return out;
}

/**
 * Только для тестов. Через HTTP расхождение по высоте на живых городах не
 * воспроизвести: площадок рядом с башней нет, и детектор молчал бы независимо
 * от того, работает он или сломан. Проверять сам факт молчания — значит принять
 * тихий no-op за фичу, поэтому тест подставляет сюда синтетический твин.
 */
export const __engineForTests = { buildRoute, heightDisputeFor, suspectCellsOf };

// ── vertiport suitability (шаг к муниципальным площадкам) ──────────────────────
interface VertiportScore {
  id: string; c: number; r: number; x: number; y: number;
  openRadiusM: number; clearanceM: number; distNoFlyM: number;
  /** published regulatory ceiling over the pad, metres AGL; null where no feed */
  ceilingM: number | null;
  /** pad sits where the regulator authorizes nothing automatically (0 ft ceiling) */
  needsAtcCoordination: boolean;
  suitability: number; class: "candidate-pad" | "needs-infrastructure" | "unsuitable";
}
function suitability(cityId: string, city: CityData): VertiportScore[] {
  const g = city.grid;
  const obst = obstOf(g);
  const zones = zonesMeters(cityId, city);
  const field = ceilingField(cityId, city);
  return city.vertiports.map((v, i) => {
    // open radius: expand until an obstacle > 15 m appears
    let openR = 0;
    for (let rad = 1; rad <= 10; rad++) {
      let hit = false;
      for (let dc = -rad; dc <= rad && !hit; dc++) for (let dr = -rad; dr <= rad; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
        if (obst(v.c + dc, v.r + dr) > 15) { hit = true; break; }
      }
      if (hit) break; openR = rad * g.cell;
    }
    const distNoFly = zones.length
      ? Math.min(...zones.map((z) => Math.hypot(v.x - z.x, v.y - z.y) - z.radiusM))
      : 9999;
    const clearance = obst(v.c, v.r);
    const openScore = Math.min(1, openR / 120);
    const noflyScore = distNoFly > 0 ? Math.min(1, distNoFly / 300) : 0;
    const clearScore = clearance < 8 ? 1 : clearance < 15 ? 0.6 : 0.2;
    const score = Math.round(100 * (0.5 * openScore + 0.35 * noflyScore + 0.15 * clearScore));
    const cls: VertiportScore["class"] = score >= 65 ? "candidate-pad" : score >= 35 ? "needs-infrastructure" : "unsuitable";
    // Deliberately NOT folded into `suitability`: that score measures physical
    // siting (openness, clearance, distance to zones). Regulatory status is a
    // separate axis — a perfectly sited pad can still need ATC coordination —
    // and merging them would make one number mean two different things.
    const ceil = field ? ceilingAt(field, v.c, v.r) : NO_CEILING;
    const ceilingM = ceil === NO_CEILING ? null : ceil;
    return {
      id: `vp${i}`, c: v.c, r: v.r, x: v.x, y: v.y,
      openRadiusM: openR, clearanceM: clearance, distNoFlyM: Math.round(distNoFly),
      ceilingM, needsAtcCoordination: ceilingM === 0,
      suitability: score, class: cls,
    };
  });
}

// ── Ed25519 signing (QSign-style attestation over the immutable twin) ──────────
function loadSignKey(): crypto.KeyObject {
  const env = process.env.QSKYWAY_SIGN_SK;
  if (env) {
    try { return crypto.createPrivateKey({ key: Buffer.from(env, "base64"), format: "der", type: "pkcs8" }); }
    catch { /* fall through to ephemeral */ }
  }
  return crypto.generateKeyPairSync("ed25519").privateKey;
}
const SIGN_SK = loadSignKey();
const SIGN_PK = crypto.createPublicKey(SIGN_SK);
const SIGN_PK_B64 = SIGN_PK.export({ type: "spki", format: "der" }).toString("base64");
const SIGN_EPHEMERAL = !process.env.QSKYWAY_SIGN_SK;

interface Signature { alg: string; contentHash: string; signature: string; publicKey: string; note: string; }
const sigCache = new Map<string, Signature>();
function signCity(cityId: string, city: CityData): Signature {
  const cached = sigCache.get(cityId);
  if (cached) return cached;
  const contentHash = crypto.createHash("sha256").update(JSON.stringify(city)).digest("hex");
  const signature = crypto.sign(null, Buffer.from(contentHash, "hex"), SIGN_SK).toString("base64");
  const sig: Signature = {
    alg: "Ed25519", contentHash, signature, publicKey: SIGN_PK_B64,
    note: SIGN_EPHEMERAL
      ? "Ephemeral key (per-instance). Provide QSKYWAY_SIGN_SK for a stable key. Аттестация неизменности двойника (QSign)."
      : "Аттестация неизменности двойника (QSign). Подпись покрывает встроенный twin.",
  };
  sigCache.set(cityId, sig);
  return sig;
}
/**
 * Attest the ceiling layer too, not just the twin.
 *
 * A route is only as trustworthy as the two things it obeys: the city geometry
 * (already signed) and the published airspace constraint (until now unsigned).
 * With both attested under the same key, "this corridor was computed against FAA
 * edition 7/9/2026 over this exact cell set" is checkable by a third party
 * rather than a claim on a slide.
 */
const airspaceSigCache = new Map<string, Signature>();
function signAirspace(cityId: string): Signature | null {
  const src = AIRSPACE[cityId];
  if (!src) return null;
  const cached = airspaceSigCache.get(cityId);
  if (cached) return cached;
  const contentHash = airspaceContentHash(src);
  const sig: Signature = {
    alg: "Ed25519",
    contentHash,
    signature: crypto.sign(null, Buffer.from(contentHash, "hex"), SIGN_SK).toString("base64"),
    publicKey: SIGN_PK_B64,
    note: SIGN_EPHEMERAL
      ? "Ephemeral key (per-instance). Provide QSKYWAY_SIGN_SK for a stable key. Подпись покрывает ячейки и потолки, не пояснительный текст."
      : "Аттестация опубликованного слоя ограничений (QSign). Подпись покрывает ячейки, потолки, класс пространства и дату публикации — не пояснительный текст.",
  };
  airspaceSigCache.set(cityId, sig);
  return sig;
}
function verifyAirspace(cityId: string, sig: Signature): boolean {
  const src = AIRSPACE[cityId];
  if (!src) return false;
  if (airspaceContentHash(src) !== sig.contentHash) return false;
  try { return crypto.verify(null, Buffer.from(sig.contentHash, "hex"), SIGN_PK, Buffer.from(sig.signature, "base64")); }
  catch { return false; }
}

/** Everything a caller needs to trust the ceiling layer: what it is, whether it
 *  still matches the regulator, and its attestation. */
function airspaceBlock(cityId: string, city: CityData) {
  const summary = airspaceSummary(cityId, city);
  // A city can have no ceiling grid and still be under a published permission
  // regime (Tokyo). Reporting only ceilings would call that city "no source"
  // when a regulator does in fact govern every flight over it.
  const permission = permissionSummary(cityId);
  if (!summary.available) return { ...summary, permission };
  return { ...summary, permission, freshness: airspaceFreshness(cityId), _signature: signAirspace(cityId) };
}

function verifyCity(city: CityData, sig: Signature): boolean {
  const hash = crypto.createHash("sha256").update(JSON.stringify(city)).digest("hex");
  if (hash !== sig.contentHash) return false;
  try { return crypto.verify(null, Buffer.from(hash, "hex"), SIGN_PK, Buffer.from(sig.signature, "base64")); }
  catch { return false; }
}

// ── QRight slot market (Postgres-persisted, in-memory fallback) ────────────────
// Slots are the one piece of qskyway state that must survive a restart (the
// engine/routes are deterministic). Persist to Postgres when available; keep the
// in-memory array as a fallback so the market still works if the DB is offline.
interface Slot { id: string; routeId: string; t0: string; t1: string; holder: string; issued: string; receipt: string; }
const memSlots: Slot[] = [];
let slotsTablesReady = false;
let slotsDbAvailable = false;
const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean => a0 < b1 && b0 < a1;

async function ensureSlotTable(): Promise<void> {
  if (slotsTablesReady) return;
  try {
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS qskyway_slots (
        id          TEXT PRIMARY KEY,
        route_id    TEXT NOT NULL,
        t0          TEXT NOT NULL,
        t1          TEXT NOT NULL,
        holder      TEXT NOT NULL,
        issued      TEXT NOT NULL,
        receipt     TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_qskyway_slots_route ON qskyway_slots (route_id);
    `);
    slotsTablesReady = true;
    slotsDbAvailable = true;
  } catch (err) {
    slotsTablesReady = true;
    slotsDbAvailable = false;
    console.warn("[qskyway] slot table init skipped — using in-memory market:", err instanceof Error ? err.message : err);
  }
}

const rowToSlot = (r: Record<string, unknown>): Slot => ({
  id: String(r.id), routeId: String(r.route_id), t0: String(r.t0), t1: String(r.t1),
  holder: String(r.holder), issued: String(r.issued), receipt: String(r.receipt),
});

async function listSlots(): Promise<Slot[]> {
  await ensureSlotTable();
  if (slotsDbAvailable) {
    try {
      const r = await getPool().query(
        `SELECT id, route_id, t0, t1, holder, issued, receipt FROM qskyway_slots ORDER BY created_at ASC LIMIT 500`,
      );
      return r.rows.map(rowToSlot);
    } catch { /* fall through */ }
  }
  return memSlots;
}

async function countSlots(): Promise<number> {
  await ensureSlotTable();
  if (slotsDbAvailable) {
    try {
      const r = await getPool().query(`SELECT COUNT(*)::int AS c FROM qskyway_slots`);
      return (r.rows[0] as { c: number }).c;
    } catch { /* fall through */ }
  }
  return memSlots.length;
}

// Book a slot with a capacity/overlap check. Serialized per-route via a Postgres
// advisory lock so concurrent bookings can't both slip past the capacity gate.
async function bookSlot(
  routeId: string, t0: string, t1: string, holder: string,
): Promise<{ ok: true; slot: Slot } | { ok: false; concurrent: number }> {
  const a0 = Date.parse(t0), a1 = Date.parse(t1);
  await ensureSlotTable();
  if (slotsDbAvailable) {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Advisory lock keyed on routeId so the read-check-insert is atomic per route.
      const lockKey = parseInt(crypto.createHash("sha256").update("qskyway:" + routeId).digest("hex").slice(0, 15), 16);
      await client.query("SELECT pg_advisory_xact_lock($1)", [String(lockKey)]);
      const existing = await client.query(`SELECT t0, t1 FROM qskyway_slots WHERE route_id = $1`, [routeId]);
      const concurrent = existing.rows.filter((s: { t0: unknown; t1: unknown }) => overlaps(a0, a1, Date.parse(String(s.t0)), Date.parse(String(s.t1)))).length;
      if (concurrent >= SLOT_CAPACITY) {
        await client.query("ROLLBACK");
        return { ok: false, concurrent };
      }
      const rec: Slot = { id: "slot-" + crypto.randomUUID().slice(0, 8), routeId, t0, t1, holder, issued: new Date().toISOString().slice(0, 10), receipt: "" };
      rec.receipt = "qright:" + crypto.createHash("sha256").update(JSON.stringify(rec)).digest("hex").slice(0, 32);
      await client.query(
        `INSERT INTO qskyway_slots (id, route_id, t0, t1, holder, issued, receipt) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [rec.id, rec.routeId, rec.t0, rec.t1, rec.holder, rec.issued, rec.receipt],
      );
      await client.query("COMMIT");
      return { ok: true, slot: rec };
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch { /* ignore */ }
      console.warn("[qskyway] bookSlot DB error — falling back to memory:", e instanceof Error ? e.message : e);
      // fall through to memory path below
    } finally {
      client.release();
    }
  }
  const concurrent = memSlots.filter((s) => s.routeId === routeId && overlaps(a0, a1, Date.parse(s.t0), Date.parse(s.t1))).length;
  if (concurrent >= SLOT_CAPACITY) return { ok: false, concurrent };
  const rec: Slot = { id: "slot-" + (memSlots.length + 1), routeId, t0, t1, holder, issued: new Date().toISOString().slice(0, 10), receipt: "" };
  rec.receipt = "qright:" + crypto.createHash("sha256").update(JSON.stringify(rec)).digest("hex").slice(0, 32);
  memSlots.push(rec);
  return { ok: true, slot: rec };
}

// ── routes ────────────────────────────────────────────────────────────────────
qskywayRouter.get("/health", async (_req: Request, res: Response) => {
  const slotsBooked = await countSlots();
  res.json({
    status: "ok",
    module: "qskyway",
    cities: Object.entries(CITIES).map(([id, c]) => ({ id, name: c.city, buildings: c.buildings.length, vertiports: c.vertiports.length, noFlyZones: (NOFLY[id] ?? []).length, heightMeasuredPct: c.dataQuality.measuredPct, heightRealPct: c.dataQuality.realPct, suspectHeights: c.dataQuality.suspect?.length ?? 0, airspaceFeed: AIRSPACE[id]?.authority ?? null })),
    city: CITY.city,
    buildings: CITY.buildings.length,
    vertiports: CITY.vertiports.length,
    grid: { cols: CITY.grid.cols, rows: CITY.grid.rows, cellM: CITY.grid.cell },
    altitude: { floorM: FLOOR, bandM: BAND, clearanceM: CLEAR },
    clearanceModel: { baseM: CLEAR, byHeightSourceM: { measured: SRC_CLEARANCE[0], derived: SRC_CLEARANCE[1], guessed: SRC_CLEARANCE[2] }, note: "Страховочный просвет растёт при низкой уверенности высоты; лучше данные (LiDAR/LOD2/3D Tiles) → ниже крейсер." },
    features: ["nofly-avoidance", "layered-wind", "ed25519-signed-twin", "vertiport-suitability", "height-provenance", "confidence-clearance", "regulatory-airspace-ceilings"],
    airspace: Object.fromEntries(Object.keys(CITIES).map((id) => [id, airspaceBlock(id, CITIES[id])])),
    slotsStore: slotsDbAvailable ? "postgres" : "memory",
    slotsBooked,
    wind: metarStatus(),
    disclaimer: DISCLAIMER,
  });
});

qskywayRouter.get("/cities", (_req: Request, res: Response) => {
  res.json({
    default: DEFAULT_CITY,
    cities: Object.entries(CITIES).map(([id, c]) => ({
      id, name: c.city, buildings: c.buildings.length, vertiports: c.vertiports.length,
      bbox: c.bbox, meters: c.meters, maxHeightM: c.grid.heights.reduce((m, v) => Math.max(m, v), 0),
      noFlyZones: (NOFLY[id] ?? []).length,
      dataQuality: c.dataQuality,
      airspaceFeed: AIRSPACE[id]?.authority ?? null,
      signature: { alg: "Ed25519", contentHash: signCity(id, c).contentHash },
    })),
    // Not a shortfall to apologise for — a map of where low-altitude airspace is
    // machine-readable at all, counting ANY published rule: a ceiling grid (US)
    // or a permission regime (Japan). Counting only ceilings would misdescribe
    // Tokyo, where a regulator governs every flight but publishes no altitudes.
    // Kazakhstan publishes neither, so no provider can obey anything there yet.
    airspaceCoverage: {
      // `withFeed` называлось не тем, что считало: `AIRSPACE[id] || PERMISSION[id]`
      // — это ЛЮБОЙ регуляторный слой, а фид из трёх городов есть у одного
      // (Нью-Йорк). У Астаны правило опубликовано документом eAIP, у Токио —
      // растровым слоем MLIT. На странице формулировка была верной
      // («регуляторный слой: 3 из 3»), а поле API — нет, и читающий его напрямую
      // делал вывод, что фид есть у всех. Модуль как раз приглашает читать API,
      // так что цена такой опечатки в имени выше обычной.
      //
      // Теперь два поля, и разница между ними — ровно то, чем модуль дорожит:
      // «нет API» не равно «нет правила».
      withRegulatoryLayer: Object.keys(CITIES).filter((id) => AIRSPACE[id] || PERMISSION[id]).length,
      withFeed: Object.keys(CITIES).filter((id) => AIRSPACE[id]).length,
      withCeilings: Object.keys(CITIES).filter((id) => AIRSPACE[id]).length,
      withPermissionRegime: Object.keys(CITIES).filter((id) => PERMISSION[id]).length,
      total: Object.keys(CITIES).length,
      missing: Object.keys(CITIES).filter((id) => !AIRSPACE[id] && !PERMISSION[id]),
      note: "Регуляторный слой есть там, где регулятор вообще публикует ограничения — сеткой потолков, режимом разрешений или запретной зоной в AIP. Форма публикации разная: фид, растровый слой, нормативный документ. «Нет API» не равно «нет правила» — правило читается из того, в чём оно опубликовано.",
    },
  });
});

qskywayRouter.get("/city", (req: Request, res: Response) => {
  const resolved = resolveCity(req.query.city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  const { id, city } = resolved;
  const zones = zonesMeters(id, city);
  res.json({
    ...city,
    // Разбор сомнительных высот, которые движок НЕ переопределяет («towers over
    // the city»): что публикует статья, на которую ссылается сам объект, и наш
    // вердикт. Без этого интерфейс мог сказать только «в 4.66 раза выше
    // застройки» — верно, но не проверяемо. Высоту при этом не переписываем:
    // починка принадлежит OSM. См. src/data/qskywayHeightReview.ts.
    heightReview: heightReviewsForCity(id),
    nofly: zones.map((z) => ({ id: z.id, name: z.name, kind: z.kind, x: Math.round(z.x), y: Math.round(z.y), radiusM: z.radiusM, until: z.until ?? null, realityNote: z.realityNote ?? null })),
    wind: {
      fromDeg: windAt(id, FLOOR).fromDeg,
      groundMs: windAt(id, FLOOR).speedMs,
      topMs: windAt(id, city.grid.heights.reduce((m, v) => Math.max(m, v), 0) + CLEAR).speedMs,
      source: windSourceOf(id),
      note: windSourceOf(id) === "metar"
        ? "у земли — реальный METAR ближайшего аэропорта; рост по высоте — иллюстративная модель (METAR не содержит данных о ветре на высоте)"
        : "иллюстративная послойная модель (METAR временно недоступен)",
    },
    airspace: airspaceBlock(id, city),
    vertiportScores: suitability(id, city),
    _signature: signCity(id, city),
  });
});

/**
 * What the published ceiling actually costs, across every pair of pads.
 *
 * The single most useful thing this module can say about a city is not that it
 * ingested a feed — it is how much of the network the feed rules out. That
 * number has been sitting one loop away from the data since the ceilings
 * landed, computed nowhere and therefore quotable nowhere; a figure typed into
 * a slide by hand is exactly what this platform is not supposed to do.
 *
 * Deterministic and cheap (n² routes over a cached grid), so it is computed on
 * request rather than stored — nothing to go stale, and the page can show a
 * live figure instead of a hardcoded one.
 */
// Deterministic over compile-time data, so a city's answer cannot change while
// the process lives — the same reason ceilingField() is cached. Worth caching
// rather than not: measured 0.4-0.55 s against 0.025 s for /city, and this one
// sits on the first screen.
const impactCache = new Map<string, unknown>();

qskywayRouter.get("/airspace/impact", (req: Request, res: Response) => {
  const resolved = resolveCity(req.query.city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  const cached = impactCache.get(resolved.id);
  if (cached) return res.json(cached);
  const { id, city } = resolved;
  const field = ceilingField(id, city);
  if (!field) {
    const none = {
      city: id, available: false,
      note: "Сетки потолков для этого города регулятор не публикует — измерять нечего.",
    };
    impactCache.set(id, none);
    return res.json(none);
  }
  let pairs = 0, routable = 0, compliant = 0, strictRoutable = 0;
  let worstExceedanceM = 0;
  // Совещательные маршруты — из общего кэша пар (его же читает
  // `/height-dispute`). Строгий режим считается отдельно: там маршрут другой по
  // построению.
  for (const r of allPairRoutes(id, city)) {
    pairs++;
    if (!r) continue;
    routable++;
    if (r.airspace.compliant) compliant++;
    worstExceedanceM = Math.max(worstExceedanceM, r.airspace.maxExceedanceM);
    if (buildRoute(id, city, r.from, r.to, true)) strictRoutable++;
  }
  // Pads the regulator authorizes nothing over: they cannot launch at all, which
  // is a different and harsher fact than a corridor merely flying too high.
  const padsNeedingAtc = suitability(id, city).filter((v) => v.needsAtcCoordination).length;
  const payload = {
    city: id,
    available: true,
    authority: AIRSPACE[id].authority,
    effective: AIRSPACE[id].effective,
    pairs,
    routable,
    /** pairs whose corridor stays within the published ceiling end to end */
    compliant,
    compliantPct: Math.round((100 * compliant) / Math.max(1, pairs)),
    /** pairs still flyable when the ceiling is enforced as a hard constraint */
    strictRoutable,
    worstExceedanceM,
    padsNeedingAtc,
    zeroCeilingCells: field.zeroCeilingCells,
    gridCells: field.cols * field.rows,
    note: `${compliant} из ${pairs} маршрутов между площадками укладываются в опубликованный потолок; ${plural(padsNeedingAtc, "площадка стоит", "площадки стоят", "площадок стоят")} там, где автоматического допуска нет вовсе.`,
  };
  impactCache.set(id, payload);
  res.json(payload);
});

/**
 * Доходит ли спорная высота до того, что модуль реально считает.
 *
 * Вопрос возник из расхождения: чип в шапке говорит «высоте не верим», а сетка
 * высот у маршрутизации та же самая. Ответ на него нельзя было ни увидеть, ни
 * проверить — из «максимум в сетке 382» естественно (и, как выяснилось,
 * ошибочно) заключалось, что коридоры над центром подняты все. Здесь он
 * считается движком по всем парам площадок, а не выводится рассуждением.
 *
 * Замер 12.08.2026 по Астане: 0 из 42 — A* платит за высоту и обходит башню,
 * ячеек у неё шесть. Спорная высота живёт в данных и в карточке здания, но
 * коридоров сегодня не поднимает.
 */
const disputeImpactCache = new Map<string, unknown>();
qskywayRouter.get("/height-dispute", (req: Request, res: Response) => {
  const resolved = resolveCity(req.query.city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  const cached = disputeImpactCache.get(resolved.id);
  if (cached) return res.json(cached);
  const { id, city } = resolved;
  const cells = suspectCellsOf(city);
  if (cells.size === 0) {
    const none = {
      city: id, available: false, pairs: 0, affectedPairs: 0,
      note: "Высот, которые твин считает спорными и не переопределяет сам, в этом городе нет.",
    };
    disputeImpactCache.set(id, none);
    return res.json(none);
  }
  let pairs = 0, routable = 0, affectedPairs = 0, maxCruiseDeltaM = 0, maxSegments = 0;
  for (const r of allPairRoutes(id, city)) {
    pairs++;
    if (!r) continue;
    routable++;
    const d = heightDisputeFor(id, city, r);
    if (!d) continue;
    affectedPairs++;
    maxSegments = Math.max(maxSegments, d.segments);
    if (d.cruiseDeltaM !== null) maxCruiseDeltaM = Math.max(maxCruiseDeltaM, d.cruiseDeltaM);
  }
  const disputed = [...new Set(cells.values())].map((bi) => {
    const rev = heightReviewFor(id, bi);
    const cellCount = [...cells.values()].filter((v) => v === bi).length;
    return {
      building: bi,
      taggedM: city.buildings[bi]?.h ?? 0,
      cells: cellCount,
      osm: rev?.osm ?? null,
      publishedM: rev?.publishedM ?? null,
      publishedSource: rev?.publishedSource ?? null,
      verdict: rev?.verdict ?? "unreviewed",
    };
  });
  const payload = {
    city: id, available: true, disputed, pairs, routable, affectedPairs,
    maxCruiseDeltaM, maxSegments,
    note: affectedPairs === 0
      ? `Спорная высота в твине есть, но ни один из ${routable} маршрутов между площадками на неё не опирается: маршрутизация платит за высоту и обходит здание. Высота остаётся видимой в карточке и в провенансе — на коридоры она сегодня не влияет.`
      : `${affectedPairs} из ${routable} маршрутов между площадками подняты высотой, которой мы сами не верим (максимум ${maxCruiseDeltaM} м против опубликованной). Высоту не переписываем — починка принадлежит источнику; здесь названа цена расхождения.`,
  };
  disputeImpactCache.set(id, payload);
  res.json(payload);
});

qskywayRouter.get("/vertiports", (req: Request, res: Response) => {
  const resolved = resolveCity(req.query.city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  const scored = suitability(resolved.id, resolved.city);
  res.json({
    city: resolved.id, count: scored.length, vertiports: scored,
    note: "Скоринг пригодности площадок (открытый радиус, просвет, удалённость от запретных зон). Реальные вертипорты требуют муниципального размещения и наземной инфраструктуры — это алгоритмические кандидаты, не утверждённые площадки.",
  });
});

qskywayRouter.post("/route", (req: Request, res: Response) => {
  const { from, to, city, respectCeiling } = req.body ?? {};
  if (typeof from !== "number" || typeof to !== "number")
    return res.status(400).json({ error: "нужны числовые from, to (индексы вертипортов)" });
  const resolved = resolveCity(city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  const strict = respectCeiling === true;
  const route = buildRoute(resolved.id, resolved.city, from, to, strict);
  if (!route) {
    // In strict mode the usual "no corridor" answer is misleading: the corridor
    // exists physically and is only barred by the published ceiling. Say which.
    if (strict) {
      const relaxed = buildRoute(resolved.id, resolved.city, from, to, false);
      if (relaxed) {
        return res.status(422).json({
          error: "нет коридора в пределах опубликованного потолка регулятора",
          reason: "airspace-ceiling",
          respectCeiling: true,
          airspaceIfUnrestricted: relaxed.airspace,
          cruiseAltMIfUnrestricted: relaxed.cruiseAltM,
          note: "Физически маршрут существует, но требует высоты выше автоматически разрешённой. Полёт возможен только по координации с УВД (вне LAANC).",
        });
      }
    }
    return res.status(422).json({ error: "маршрут не найден / некорректные вертипорты / отрезан запретными зонами" });
  }
  // Считается ТОЛЬКО здесь, а не внутри buildRoute: расчёт сам строит теневой
  // маршрут по разобранным высотам, и вложенный вызов ушёл бы в рекурсию.
  const heightDispute = heightDisputeFor(resolved.id, resolved.city, route);
  res.json(heightDispute ? { ...route, heightDispute } : route);
});

/**
 * One document that answers "why is this flight defensible?".
 *
 * Everything in it already existed — twin hash, airspace hash, published
 * edition, ceiling verdict, wind source — but scattered across three responses,
 * so anyone who actually had to justify a flight was left stitching them
 * together by hand and hoping they matched. Filing paperwork is where a
 * navigation layer either earns its place or stays a demo, so the assembly is
 * ours to do, not the operator's.
 *
 * The whole document is signed as one unit: it is the *combination* — this
 * corridor, over this twin, against this edition — that is being attested, and
 * signing the parts separately would let a correct-looking set of pieces be
 * recombined into a claim we never made.
 *
 * Honest by construction: it states the verdict, including a non-compliant one.
 * A justification that can only come out green is not a justification.
 */
qskywayRouter.post("/route/justification", (req: Request, res: Response) => {
  const { from, to, city, respectCeiling } = req.body ?? {};
  if (typeof from !== "number" || typeof to !== "number")
    return res.status(400).json({ error: "нужны числовые from, to (индексы вертипортов)" });
  const resolved = resolveCity(city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  const route = buildRoute(resolved.id, resolved.city, from, to, respectCeiling === true);
  if (!route) return res.status(422).json({ error: "маршрут не найден — обосновывать нечего" });

  const src = AIRSPACE[resolved.id];
  const twinSig = signCity(resolved.id, resolved.city);
  const asSig = signAirspace(resolved.id);
  const dispute = heightDisputeFor(resolved.id, resolved.city, route);

  // ASCII-only and explicitly ordered: this is the byte sequence the signature
  // covers, so it must not depend on locale, key order, or JSON escaping
  // (the transport bug in #712).
  const document = {
    kind: "qskyway.route.justification/1",
    city: resolved.id,
    from,
    to,
    respectCeiling: route.respectCeiling,
    distanceKm: route.distanceKm,
    cruiseAltM: route.cruiseAltM,
    etaMinWind: route.etaMinWind,
    twinContentHash: twinSig.contentHash,
    airspace: src
      ? {
          authority: src.authority,
          source: src.source,
          regime: src.regime,
          effective: src.effective,
          contentHash: asSig?.contentHash ?? null,
          compliant: route.airspace.compliant,
          exceedingSegments: route.airspace.exceedingSegments,
          maxExceedanceM: route.airspace.maxExceedanceM,
          lowestCeilingM: route.airspace.lowestCeilingM,
        }
      : null,
    windSource: windSourceOf(resolved.id),
    heightConfidencePct: route.heightConfidencePct,
    // A permission regime belongs on the paperwork even though it never touched
    // the routing — "this corridor is legal geometry" and "this flight may take
    // place at all" are both things the filing has to answer.
    permission: PERMISSION[resolved.id]
      ? {
          authority: PERMISSION[resolved.id].authority,
          regime: PERMISSION[resolved.id].regime,
          // Part of the SIGNED payload: a filing that says "permission regime"
          // where the rule is a ban is the worst possible place to lose this.
          kind: PERMISSION[resolved.id].kind,
          basis: PERMISSION[resolved.id].basis,
          coveragePct: PERMISSION[resolved.id].coveragePct,
        }
      : null,
    // Спорная высота принадлежит обоснованию, а не только интерфейсу: коридор в
    // этом документе поднят числом, которому мы сами не верим. Умолчать о нём в
    // бумаге, которую понесут регулятору, значит выдать чужой тег за свой замер.
    heightDispute: dispute
      ? {
          building: dispute.building,
          osm: dispute.osm,
          taggedM: dispute.taggedM,
          publishedM: dispute.publishedM,
          publishedSource: dispute.publishedSource,
          segments: dispute.segments,
          cruiseAltMIfPublished: dispute.cruiseAltMIfPublished,
          cruiseDeltaM: dispute.cruiseDeltaM,
        }
      : null,
    issuedAt: new Date().toISOString(),
  };
  const canonical = JSON.stringify(document);
  const contentHash = crypto.createHash("sha256").update(canonical).digest("hex");
  const signature = crypto.sign(null, Buffer.from(contentHash, "hex"), SIGN_SK).toString("base64");

  res.json({
    document,
    attestation: { alg: "Ed25519", contentHash, signature, publicKey: SIGN_PK_B64, ephemeral: SIGN_EPHEMERAL },
    // The scope limit travels WITH the document. A justification that gets
    // forwarded without it is exactly how "routed against FAA data" turns into
    // "FAA approved".
    // Must cover all three cases. A city can have a permission regime without a
    // ceiling grid, and saying "no regulatory verdict" while the document itself
    // carries the regime would make the signed artifact contradict its own
    // disclaimer — in the one document meant to be handed to a regulator.
    scope: src
      ? "Ограничения взяты из публикации регулятора (сетка допусков Part 107 для малых БВС). Это НЕ разрешение на полёт и НЕ сертификация аэротакси — документ фиксирует, по каким данным и правилам построен коридор."
      : PERMISSION[resolved.id]
        ? PERMISSION[resolved.id].kind === "prohibition"
          ? `Сетки потолков для этого города регулятор не публикует, поэтому высотного вердикта в документе нет. Зафиксирована ЗАПРЕТНАЯ зона (${PERMISSION[resolved.id].authority}): полёты в ней запрещены, а не разрешены по согласованию. Документ фиксирует, по каким данным построен коридор, и служит основанием НЕ для полёта, а для обращения об изменении статуса зоны.`
          : `Сетки потолков для этого города регулятор не публикует, поэтому высотного вердикта в документе нет. Зафиксирован режим разрешений (${PERMISSION[resolved.id].authority}): полёт требует индивидуального разрешения. Это НЕ само разрешение — документ фиксирует, по каким данным и правилам построен коридор и какое согласование требуется.`
        : "Для этого города открытого фида регулятора нет: документ фиксирует геометрию и двойник, но НЕ содержит регуляторного вердикта.",
    verify: "POST /api/qskyway/route/justification/verify {document, attestation}",
  });
});

qskywayRouter.post("/route/justification/verify", (req: Request, res: Response) => {
  const { document, attestation } = req.body ?? {};
  if (!document || !attestation?.signature || !attestation?.contentHash)
    return res.status(400).json({ error: "нужны document и attestation {contentHash, signature}" });
  const contentHash = crypto.createHash("sha256").update(JSON.stringify(document)).digest("hex");
  const hashValid = contentHash === attestation.contentHash;
  let signatureValid = false;
  try {
    signatureValid = crypto.verify(null, Buffer.from(attestation.contentHash, "hex"), SIGN_PK, Buffer.from(attestation.signature, "base64"));
  } catch { signatureValid = false; }
  // Reported separately on purpose: a tampered value and a forged signature are
  // different failures, and one verdict would hide which happened.
  res.json({
    valid: hashValid && signatureValid,
    hashValid,
    signatureValid,
    isPlatformKey: signatureValid,
    note: hashValid
      ? signatureValid ? "Документ подписан ключом платформы и не изменён." : "Содержимое цело, но подпись не принадлежит ключу платформы."
      : "Содержимое документа изменено — хэш не совпадает.",
  });
});

qskywayRouter.get("/verify", (req: Request, res: Response) => {
  const resolved = resolveCity(req.query.city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  const sig = signCity(resolved.id, resolved.city);
  const twinValid = verifyCity(resolved.city, sig);
  const asSig = signAirspace(resolved.id);
  const airspace = asSig
    ? { attested: true as const, valid: verifyAirspace(resolved.id, asSig), contentHash: asSig.contentHash, effective: AIRSPACE[resolved.id].effective, authority: AIRSPACE[resolved.id].authority }
    : { attested: false as const, valid: null, note: "Для этого города нет подключённого фида регулятора — подписывать нечего." };
  res.json({
    city: resolved.id,
    // `valid` stays the twin verdict so existing callers (the UI badge) don't shift meaning.
    valid: twinValid,
    alg: "Ed25519",
    contentHash: sig.contentHash,
    publicKey: sig.publicKey,
    twin: { valid: twinValid, contentHash: sig.contentHash },
    airspace,
  });
});

// Bitcoin-anchor the ceiling layer: Ed25519 says who signed it, OpenTimestamps
// says it existed by block N — the edition date stops resting on our clock.
qskywayRouter.post("/airspace/anchor", async (req: Request, res: Response) => {
  const resolved = resolveCity(req.body?.city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  // A public POST that submits to the OpenTimestamps calendars is an open tap
  // into someone else's infrastructure: spam it and we flood them. It is also
  // pointless work — a second timestamp over an identical hash proves nothing
  // the first one did not. When this edition already ships a confirmed proof,
  // hand that one back instead of stamping again.
  const shipped = AIRSPACE_PROOFS[resolved.id];
  const src = AIRSPACE[resolved.id];
  if (shipped && src && shipped.contentHash === airspaceContentHash(src)) {
    return res.json({
      status: "bitcoin-confirmed",
      city: resolved.id,
      authority: src.authority,
      effective: src.effective,
      contentHash: shipped.contentHash,
      otsProofB64: shipped.otsProofB64,
      bitcoinBlockHeight: shipped.bitcoinBlockHeight,
      calendars: [],
      error: null,
      reused: true,
      note: "Эта редакция уже привязана и подтверждена Bitcoin — возвращён существующий пруф, повторный штамп не создавался: над тем же хэшем он не доказал бы ничего нового.",
    });
  }
  const anchor = await anchorAirspace(resolved.id);
  if (!anchor) return res.status(422).json({ error: "для этого города нет подключённого фида регулятора — привязывать нечего", city: resolved.id });
  res.json(anchor);
});

// The one endpoint whose outbound traffic is driven by user input: it verifies a
// proof the caller supplies, which means calling the OpenTimestamps calendars
// with a payload we did not choose. Everything else added today could be made
// self-sufficient by caching; this one legitimately needs the network, so it
// gets a limit instead. Reuses the repo's own limiter rather than inventing a
// second one.
const anchorVerifyLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyPrefix: "qskyway-anchor-verify",
  message: "Слишком много проверок якоря — проверка обращается к внешним календарям, попробуйте через минуту.",
});

// A serialized .ots proof for one hash is well under a kilobyte (ours is 3.7 KB
// with the Bitcoin attestation). Anything far larger is not a proof we could
// verify, and parsing it before finding that out is work an attacker chooses.
const MAX_OTS_PROOF_B64 = 64 * 1024;

qskywayRouter.post("/airspace/anchor/verify", anchorVerifyLimiter, async (req: Request, res: Response) => {
  const proofB64 = req.body?.otsProofB64;
  if (typeof proofB64 === "string" && proofB64.length > MAX_OTS_PROOF_B64) {
    return res.status(413).json({
      error: "пруф слишком большой",
      maxBytesB64: MAX_OTS_PROOF_B64,
      note: "Сериализованный .ots-пруф на один хэш — единицы килобайт; всё, что заметно больше, проверить всё равно не удастся.",
    });
  }
  res.json(await verifyAnchoredAirspace(req.body));
});

// The proof we ship for the edition actually in use, checkable by anyone with
// no arguments and no re-anchoring. A stateless anchor is right for a caller
// timestamping their own data, but the edition THIS service routes against
// needs a proof that outlives the request that created it.
// Verifying an OTS proof means talking to the calendar servers. On a public GET
// that is two problems: ~1.5 s per request, and every visitor (or crawler)
// making us hammer third-party infrastructure for an answer that is already
// settled. Cached ONLY once Bitcoin-confirmed — a confirmed proof cannot become
// unconfirmed, while a still-pending one legitimately needs re-asking, so
// caching that would freeze it as pending forever.
const proofVerdictCache = new Map<string, unknown>();

qskywayRouter.get("/airspace/proof", async (req: Request, res: Response) => {
  const resolved = resolveCity(req.query.city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  const proof = AIRSPACE_PROOFS[resolved.id];
  if (!proof) return res.status(404).json({ error: "для этого города вшитого пруфа нет", city: resolved.id });
  const settled = proofVerdictCache.get(resolved.id);
  if (settled) return res.json(settled);
  const current = AIRSPACE[resolved.id] ? airspaceContentHash(AIRSPACE[resolved.id]) : null;
  const verdict = await verifyAnchoredAirspace({ city: resolved.id, contentHash: proof.contentHash, otsProofB64: proof.otsProofB64 });
  const payload = {
    ...proof,
    currentContentHash: current,
    // Reported separately, because after a reissue the proof stays valid for the
    // edition it covers while no longer describing what we serve — a historical
    // record, not a broken proof.
    coversCurrentEdition: current === proof.contentHash,
    verification: verdict,
  };
  if (verdict.ots.status === "bitcoin-confirmed") proofVerdictCache.set(resolved.id, payload);
  res.json(payload);
});

/**
 * Register the signed ceiling layer in QRight — the platform's own registry.
 *
 * Until now "we routed against FAA edition 7/9/2026" lived inside QSkyway's own
 * response. Putting it in QRight makes it a dated entry in the registry every
 * other module already reads, which is the entire point of having one. Same
 * bridge QReal opened for film provenance.
 *
 * Idempotent on contentHash rather than on a stored flag: the hash IS the
 * identity of an edition, so re-registering the same rule set must find the
 * existing object instead of minting a duplicate — including after a restart,
 * a redeploy, or a call from a second instance.
 */
// Unauthenticated and it writes, so the same two questions as the anchor: what
// can a stranger make us do repeatedly, and what work is avoidable. The row is
// idempotent on content hash, so at most one exists per edition — but every call
// still reached the database. Once this process has seen the edition registered,
// answer from memory and touch nothing.
const registerLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyPrefix: "qskyway-airspace-register",
  message: "Слишком много обращений к реестру — попробуйте через минуту.",
});
const registeredCache = new Map<string, { qrightObjectId: string; contentHash: string }>();

qskywayRouter.post("/airspace/register", registerLimiter, async (req: Request, res: Response) => {
  const resolved = resolveCity(req.body?.city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  const src = AIRSPACE[resolved.id];
  if (!src) return res.status(422).json({ error: "для этого города нет подключённого фида регулятора — регистрировать нечего", city: resolved.id });
  const known = registeredCache.get(resolved.id);
  if (known && known.contentHash === airspaceContentHash(src)) {
    return res.json({
      ok: true, alreadyRegistered: true, qrightObjectId: known.qrightObjectId,
      contentHash: known.contentHash, link: "/qright",
      note: "Эта редакция уже зарегистрирована — ответ из памяти процесса, база не запрашивалась.",
    });
  }

  const contentHash = airspaceContentHash(src);
  const title = `${src.source} — ${resolved.city.city}, редакция ${src.effective}`;
  const description =
    `Опубликованный слой ограничений высоты, использованный QSkyway для маршрутизации. ` +
    `Орган: ${src.authority}. Режим: ${src.regime}. Ячеек: ${src.cells.length}. ` +
    `Подписано Ed25519 платформой AEVION. Это регистрация ИСПОЛЬЗОВАННЫХ данных, не претензия на права регулятора.`;

  try {
    const pool = getPool();
    await pool.query(`CREATE TABLE IF NOT EXISTS "QRightObject" (
      "id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "description" TEXT NOT NULL,
      "kind" TEXT NOT NULL, "contentHash" TEXT NOT NULL,
      "ownerName" TEXT, "ownerEmail" TEXT, "ownerUserId" TEXT,
      "country" TEXT, "city" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`);
    const existing = await pool.query(
      `SELECT "id", "createdAt" FROM "QRightObject" WHERE "contentHash" = $1 AND "kind" = 'airspace-edition' LIMIT 1`,
      [contentHash],
    );
    if (existing.rows.length) {
      const row = existing.rows[0] as { id: string; createdAt: string };
      registeredCache.set(resolved.id, { qrightObjectId: row.id, contentHash });
      return res.json({
        ok: true, alreadyRegistered: true, qrightObjectId: row.id, contentHash,
        registeredAt: row.createdAt, link: "/qright",
        note: "Эта редакция уже зарегистрирована — хэш совпадает, дубликат не создан.",
      });
    }
    const objectId = "qs-" + crypto.randomUUID().slice(0, 12);
    await pool.query(
      `INSERT INTO "QRightObject" ("id","title","description","kind","contentHash","country","city")
       VALUES ($1,$2,$3,'airspace-edition',$4,$5,$6)`,
      [objectId, title.slice(0, 200), description, contentHash, src.authority === "FAA" ? "US" : null, resolved.city.city.slice(0, 120)],
    );
    registeredCache.set(resolved.id, { qrightObjectId: objectId, contentHash });
    res.status(201).json({
      ok: true, alreadyRegistered: false, qrightObjectId: objectId, contentHash,
      authority: src.authority, effective: src.effective, link: "/qright",
      note: "Редакция ограничений внесена в реестр QRight как датированный объект.",
    });
  } catch (err) {
    // QSkyway is deliberately DB-optional (see the slot market). The registry is
    // not, so say so plainly instead of pretending the registration happened.
    console.warn("[qskyway] airspace register failed:", err instanceof Error ? err.message : err);
    res.status(503).json({
      error: "реестр QRight недоступен — регистрация не выполнена",
      contentHash,
      note: "Подпись и якорь слоя не затронуты; повторите регистрацию, когда база доступна.",
    });
  }
});

qskywayRouter.get("/slots", async (_req: Request, res: Response) => {
  const slots = await listSlots();
  // `count` остаётся прежним (все записи) — на него опирается прод-смок и
  // внешние читатели. Рядом появляются два честных поля: `liveCount` — глубина
  // рынка без наших же тестовых броней, и `test` у каждой записи.
  //
  // 10.08.2026 на проде было 34 записи, из них 33 — вывод смока: он бронирует
  // 5–6 слотов каждый прогон и за собой не убирает. Ничего не удаляем: право
  // зафиксировано по-настоящему, квитанция честная. Перестаём выдавать это за
  // рыночную активность.
  res.json({
    count: slots.length,
    liveCount: countLiveSlots(slots),
    capacityPerRoute: SLOT_CAPACITY,
    store: slotsDbAvailable ? "postgres" : "memory",
    slots: slots.map((s) => ({ ...s, test: isSmokeSlot(s) })),
  });
});

qskywayRouter.post("/slots", async (req: Request, res: Response) => {
  const { routeId, t0, t1, holder } = req.body ?? {};
  if (!routeId || !t0 || !t1 || !holder) return res.status(400).json({ error: "нужны routeId, t0, t1, holder" });
  const a0 = Date.parse(t0), a1 = Date.parse(t1);
  if (isNaN(a0) || isNaN(a1) || a1 <= a0) return res.status(400).json({ error: "некорректное окно времени (ISO-8601, t1>t0)" });
  const result = await bookSlot(String(routeId), String(t0), String(t1), String(holder));
  if (!result.ok) return res.status(409).json({ error: "слот занят", routeId, capacity: SLOT_CAPACITY, concurrent: result.concurrent });
  res.status(201).json({ ok: true, slot: result.slot, note: "Право на 4D-слот зафиксировано (QRight). receipt = SHA-256-якорь." });
});
