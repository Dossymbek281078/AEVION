import { Router, Request, Response } from "express";
import crypto from "crypto";
import { CITY, CityData } from "./qskyway.city";
import { CITY_NYC } from "./qskyway.city.nyc";

/**
 * AEVION QSkyway — навигационный слой городского неба для аэротакси.
 *
 * Провайдер-независимый «Google Maps + ПДД неба»: 3D-аэрокоридоры поверх
 * реального цифрового двойника города. Мультигородской: Астана (центр, бульвар
 * Нуржол) и Нью-Йорк (Мидтаун, Манхэттен) — реальные здания из OpenStreetMap,
 * растеризованы в поле высот 20 м. Детерминированный, DB-free.
 *
 * Ядро: A* по полю высот с раскладкой коридора по высотным полосам — нижняя
 * кромка = высота застройки + запас; курс задаёт полосу (одностороннее движение
 * в 3D). Плюс рынок 4D-слотов (QRight): право на (коридор × окно времени).
 *
 * Честно: движок и доказательство концепции, НЕ сертифицированное авиационное ПО.
 * Данные зданий — OpenStreetMap (ODbL, открытые). Высоты, где нет тега OSM,
 * оценены по этажности (×3.2 м) или дефолту 12 м.
 *
 * Endpoints:
 *   GET  /health         — статус + список городов
 *   GET  /cities         — доступные города (счётчики, bbox)
 *   GET  /city?city=id   — цифровой двойник (default astana)
 *   POST /route          — {from,to,city?} → 4D-маршрут (path+высоты+ETA)
 *   GET  /slots           — забронированные слоты
 *   POST /slots           — {routeId,t0,t1,holder} → бронь права (receipt = SHA-256)
 */

export const qskywayRouter = Router();

const DISCLAIMER =
  "Движок и доказательство концепции, не сертифицированное авиационное ПО. Данные зданий — OpenStreetMap (открытые, ODbL). Высоты частично оценены. Полёты в реальном небе требуют допуска регулятора (U-space/UTM/CAAC).";

// ── city registry ──────────────────────────────────────────────────────────
const CITIES: Record<string, CityData> = { astana: CITY, nyc: CITY_NYC };
const DEFAULT_CITY = "astana";
const resolveCity = (id: unknown): { id: string; city: CityData } | null => {
  const key = typeof id === "string" && id in CITIES ? id : id == null ? DEFAULT_CITY : null;
  return key ? { id: key, city: CITIES[key] } : null;
};

// ── engine constants ─────────────────────────────────────────────────────────
const FLOOR = 50;
const CLEAR = 15;
const BAND = 25;
const AVG_SPEED_KMH = 90;
const SLOT_CAPACITY = 4;

const obstOf = (g: CityData["grid"]) => (c: number, r: number): number =>
  c < 0 || r < 0 || c >= g.cols || r >= g.rows ? 999 : g.heights[r * g.cols + c];

/** Крейсерская высота при проходе (fc,fr)→(tc,tr): полоса над препятствием + смещение по курсу. */
function edgeAltOf(g: CityData["grid"]) {
  const obst = obstOf(g);
  return (fc: number, fr: number, tc: number, tr: number): number => {
    const required = Math.max(obst(fc, fr), obst(tc, tr)) + CLEAR;
    const band = Math.max(0, Math.ceil((required - FLOOR) / BAND));
    const eastOrNorth = tc - fc > 0 || tr - fr < 0;
    return FLOOR + band * BAND + (eastOrNorth ? 0 : BAND / 2);
  };
}

// ── binary-heap A* on the height field ────────────────────────────────────────
interface HeapNode { c: number; r: number; f: number; }
class MinHeap {
  private a: HeapNode[] = [];
  size(): number { return this.a.length; }
  push(n: HeapNode): void {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop(): HeapNode {
    const a = this.a;
    const top = a[0];
    const last = a.pop() as HeapNode;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let s = i;
        if (l < a.length && a[l].f < a[s].f) s = l;
        if (r < a.length && a[r].f < a[s].f) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]]; i = s;
      }
    }
    return top;
  }
}

interface Cell { c: number; r: number; }

function astar(g: CityData["grid"], s: Cell, goal: Cell): Cell[] | null {
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
  while (open.size()) {
    const cur = open.pop();
    if (cur.c === goal.c && cur.r === goal.r) break;
    const ci = idx(cur.c, cur.r);
    for (const [dc, dr] of D) {
      const nc = cur.c + dc, nr = cur.r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const alt = edgeAlt(cur.c, cur.r, nc, nr);
      const step = 1 + (alt - FLOOR) / 90; // предпочтение низких уличных каньонов
      const t = gsc[ci] + step, ni = idx(nc, nr);
      if (t < gsc[ni]) { gsc[ni] = t; came[ni] = ci; open.push({ c: nc, r: nr, f: t + h(nc, nr) }); }
    }
  }
  let ci = idx(goal.c, goal.r);
  if (came[ci] < 0 && ci !== idx(s.c, s.r)) return null;
  const path: Cell[] = [];
  while (ci >= 0) { path.unshift({ c: ci % cols, r: Math.floor(ci / cols) }); ci = came[ci]; }
  return path.length > 1 ? path : null;
}

interface RouteResult {
  city: string;
  from: number;
  to: number;
  path: Cell[];
  alts: number[];
  obstacles: number[];
  distanceKm: number;
  cruiseAltM: number;
  etaMin: number;
}

function buildRoute(cityId: string, city: CityData, fromVp: number, toVp: number): RouteResult | null {
  const vps = city.vertiports;
  if (fromVp < 0 || toVp < 0 || fromVp >= vps.length || toVp >= vps.length || fromVp === toVp) return null;
  const a = vps[fromVp], b = vps[toVp];
  const path = astar(city.grid, { c: a.c, r: a.r }, { c: b.c, r: b.r });
  if (!path) return null;
  const edgeAlt = edgeAltOf(city.grid);
  const obst = obstOf(city.grid);
  const alts: number[] = [];
  const obstacles: number[] = [];
  for (let k = 0; k < path.length - 1; k++) {
    alts.push(edgeAlt(path[k].c, path[k].r, path[k + 1].c, path[k + 1].r));
    obstacles.push(Math.max(obst(path[k].c, path[k].r), obst(path[k + 1].c, path[k + 1].r)));
  }
  const distanceKm = (alts.length * city.grid.cell) / 1000;
  const cruiseAltM = alts.reduce((m, v) => Math.max(m, v), 0);
  return {
    city: cityId, from: fromVp, to: toVp, path, alts, obstacles,
    distanceKm: +distanceKm.toFixed(3),
    cruiseAltM,
    etaMin: +((distanceKm / AVG_SPEED_KMH) * 60).toFixed(2),
  };
}

// ── QRight slot market (in-memory) ────────────────────────────────────────────
interface Slot { id: string; routeId: string; t0: string; t1: string; holder: string; issued: string; receipt: string; }
const slots: Slot[] = [];
const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean => a0 < b1 && b0 < a1;

// ── routes ────────────────────────────────────────────────────────────────────
qskywayRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    module: "qskyway",
    cities: Object.entries(CITIES).map(([id, c]) => ({ id, name: c.city, buildings: c.buildings.length, vertiports: c.vertiports.length })),
    // backward-compatible top-level fields (default city)
    city: CITY.city,
    buildings: CITY.buildings.length,
    vertiports: CITY.vertiports.length,
    grid: { cols: CITY.grid.cols, rows: CITY.grid.rows, cellM: CITY.grid.cell },
    altitude: { floorM: FLOOR, bandM: BAND, clearanceM: CLEAR },
    slotsBooked: slots.length,
    disclaimer: DISCLAIMER,
  });
});

qskywayRouter.get("/cities", (_req: Request, res: Response) => {
  res.json({
    default: DEFAULT_CITY,
    cities: Object.entries(CITIES).map(([id, c]) => ({
      id, name: c.city, buildings: c.buildings.length, vertiports: c.vertiports.length,
      bbox: c.bbox, meters: c.meters, maxHeightM: c.grid.heights.reduce((m, v) => Math.max(m, v), 0),
    })),
  });
});

qskywayRouter.get("/city", (req: Request, res: Response) => {
  const resolved = resolveCity(req.query.city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  res.json(resolved.city);
});

qskywayRouter.post("/route", (req: Request, res: Response) => {
  const { from, to, city } = req.body ?? {};
  if (typeof from !== "number" || typeof to !== "number")
    return res.status(400).json({ error: "нужны числовые from, to (индексы вертипортов)" });
  const resolved = resolveCity(city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  const route = buildRoute(resolved.id, resolved.city, from, to);
  if (!route) return res.status(422).json({ error: "маршрут не найден / некорректные вертипорты" });
  res.json(route);
});

qskywayRouter.get("/slots", (_req: Request, res: Response) => {
  res.json({ count: slots.length, capacityPerRoute: SLOT_CAPACITY, slots });
});

qskywayRouter.post("/slots", (req: Request, res: Response) => {
  const { routeId, t0, t1, holder } = req.body ?? {};
  if (!routeId || !t0 || !t1 || !holder)
    return res.status(400).json({ error: "нужны routeId, t0, t1, holder" });
  const a0 = Date.parse(t0), a1 = Date.parse(t1);
  if (isNaN(a0) || isNaN(a1) || a1 <= a0)
    return res.status(400).json({ error: "некорректное окно времени (ISO-8601, t1>t0)" });
  const concurrent = slots.filter((s) => s.routeId === routeId && overlaps(a0, a1, Date.parse(s.t0), Date.parse(s.t1))).length;
  if (concurrent >= SLOT_CAPACITY)
    return res.status(409).json({ error: "слот занят", routeId, capacity: SLOT_CAPACITY, concurrent });
  const rec: Slot = {
    id: "slot-" + (slots.length + 1), routeId, t0, t1, holder: String(holder),
    issued: new Date().toISOString().slice(0, 10), receipt: "",
  };
  rec.receipt = "qright:" + crypto.createHash("sha256").update(JSON.stringify(rec)).digest("hex").slice(0, 32);
  slots.push(rec);
  res.status(201).json({ ok: true, slot: rec, note: "Право на 4D-слот зафиксировано (QRight). receipt = SHA-256-якорь." });
});
