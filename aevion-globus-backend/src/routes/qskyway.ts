import { Router, Request, Response } from "express";
import crypto from "crypto";
import { CITY } from "./qskyway.city";

/**
 * AEVION QSkyway — навигационный слой городского неба для аэротакси.
 *
 * Провайдер-независимый «Google Maps + ПДД неба»: 3D-аэрокоридоры поверх
 * реального цифрового двойника города (318 зданий центра Астаны из OpenStreetMap,
 * растеризованы в поле высот 20 м). Детерминированный, DB-free.
 *
 * Ядро: A* по полю высот с раскладкой коридора по высотным полосам — нижняя
 * кромка = высота застройки + запас; курс задаёт полосу (одностороннее движение
 * в 3D). Плюс рынок 4D-слотов (QRight): право на (коридор × окно времени).
 *
 * Честно: это движок и доказательство концепции, НЕ сертифицированное авиационное
 * ПО. Высоты, где нет тега OSM, оценены по этажности (×3.2 м) или дефолту 12 м.
 *
 * Endpoints:
 *   GET  /health   — статус + счётчики сети
 *   GET  /city     — цифровой двойник (здания + поле высот + вертипорты) для отрисовки
 *   POST /route    — {from,to} индексы вертипортов → 4D-маршрут (path+высоты+ETA)
 *   GET  /slots     — список забронированных слотов
 *   POST /slots     — {routeId,t0,t1,holder} → бронь права на слот (receipt = SHA-256)
 */

export const qskywayRouter = Router();

const DISCLAIMER =
  "Движок и доказательство концепции, не сертифицированное авиационное ПО. Высоты застройки частично оценены (этажность/дефолт). Полёты в реальном небе требуют допуска регулятора (U-space/UTM/CAAC).";

// ── engine constants ─────────────────────────────────────────────────────────
const G = CITY.grid;
const COLS = G.cols;
const ROWS = G.rows;
const CELL = G.cell;
const HH = G.heights;
const KM_PER_SEG = CELL / 1000;

const FLOOR = 50;
const CLEAR = 15;
const BAND = 25;
const AVG_SPEED_KMH = 90;
const SLOT_CAPACITY = 4;

const obst = (c: number, r: number): number =>
  c < 0 || r < 0 || c >= COLS || r >= ROWS ? 999 : HH[r * COLS + c];

/** Крейсерская высота при проходе (fc,fr)→(tc,tr): полоса над препятствием + смещение по курсу. */
function edgeAlt(fc: number, fr: number, tc: number, tr: number): number {
  const required = Math.max(obst(fc, fr), obst(tc, tr)) + CLEAR;
  const band = Math.max(0, Math.ceil((required - FLOOR) / BAND));
  const eastOrNorth = tc - fc > 0 || tr - fr < 0;
  return FLOOR + band * BAND + (eastOrNorth ? 0 : BAND / 2);
}

// ── binary-heap A* on the height field ────────────────────────────────────────
interface HeapNode {
  c: number;
  r: number;
  f: number;
}
class MinHeap {
  private a: HeapNode[] = [];
  size(): number {
    return this.a.length;
  }
  push(n: HeapNode): void {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): HeapNode {
    const a = this.a;
    const top = a[0];
    const last = a.pop() as HeapNode;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let s = i;
        if (l < a.length && a[l].f < a[s].f) s = l;
        if (r < a.length && a[r].f < a[s].f) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]];
        i = s;
      }
    }
    return top;
  }
}

interface Cell {
  c: number;
  r: number;
}

function astar(s: Cell, g: Cell): Cell[] | null {
  const idx = (c: number, r: number): number => r * COLS + c;
  const gsc = new Float64Array(COLS * ROWS).fill(Infinity);
  const came = new Int32Array(COLS * ROWS).fill(-1);
  const h = (c: number, r: number): number => Math.abs(c - g.c) + Math.abs(r - g.r);
  const open = new MinHeap();
  gsc[idx(s.c, s.r)] = 0;
  open.push({ c: s.c, r: s.r, f: h(s.c, s.r) });
  const D = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (open.size()) {
    const cur = open.pop();
    if (cur.c === g.c && cur.r === g.r) break;
    const ci = idx(cur.c, cur.r);
    for (const [dc, dr] of D) {
      const nc = cur.c + dc;
      const nr = cur.r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const alt = edgeAlt(cur.c, cur.r, nc, nr);
      const step = 1 + (alt - FLOOR) / 90; // предпочтение низких уличных каньонов
      const t = gsc[ci] + step;
      const ni = idx(nc, nr);
      if (t < gsc[ni]) {
        gsc[ni] = t;
        came[ni] = ci;
        open.push({ c: nc, r: nr, f: t + h(nc, nr) });
      }
    }
  }
  let ci = idx(g.c, g.r);
  if (came[ci] < 0 && ci !== idx(s.c, s.r)) return null;
  const path: Cell[] = [];
  while (ci >= 0) {
    path.unshift({ c: ci % COLS, r: Math.floor(ci / COLS) });
    ci = came[ci];
  }
  return path.length > 1 ? path : null;
}

interface RouteResult {
  from: number;
  to: number;
  path: Cell[];
  alts: number[];
  obstacles: number[];
  distanceKm: number;
  cruiseAltM: number;
  etaMin: number;
}

function buildRoute(fromVp: number, toVp: number): RouteResult | null {
  const vps = CITY.vertiports;
  if (fromVp < 0 || toVp < 0 || fromVp >= vps.length || toVp >= vps.length || fromVp === toVp)
    return null;
  const a = vps[fromVp];
  const b = vps[toVp];
  const path = astar({ c: a.c, r: a.r }, { c: b.c, r: b.r });
  if (!path) return null;
  const alts: number[] = [];
  const obstacles: number[] = [];
  for (let k = 0; k < path.length - 1; k++) {
    alts.push(edgeAlt(path[k].c, path[k].r, path[k + 1].c, path[k + 1].r));
    obstacles.push(Math.max(obst(path[k].c, path[k].r), obst(path[k + 1].c, path[k + 1].r)));
  }
  const distanceKm = alts.length * KM_PER_SEG;
  const cruiseAltM = alts.reduce((m, v) => Math.max(m, v), 0);
  return {
    from: fromVp,
    to: toVp,
    path,
    alts,
    obstacles,
    distanceKm: +distanceKm.toFixed(3),
    cruiseAltM,
    etaMin: +((distanceKm / AVG_SPEED_KMH) * 60).toFixed(2),
  };
}

// ── QRight slot market (in-memory) ────────────────────────────────────────────
interface Slot {
  id: string;
  routeId: string;
  t0: string;
  t1: string;
  holder: string;
  issued: string;
  receipt: string;
}
const slots: Slot[] = [];
const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean => a0 < b1 && b0 < a1;

// ── routes ────────────────────────────────────────────────────────────────────
qskywayRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    module: "qskyway",
    city: CITY.city,
    buildings: CITY.buildings.length,
    vertiports: CITY.vertiports.length,
    grid: { cols: COLS, rows: ROWS, cellM: CELL },
    altitude: { floorM: FLOOR, bandM: BAND, clearanceM: CLEAR },
    slotsBooked: slots.length,
    disclaimer: DISCLAIMER,
  });
});

qskywayRouter.get("/city", (_req: Request, res: Response) => {
  res.json(CITY);
});

qskywayRouter.post("/route", (req: Request, res: Response) => {
  const { from, to } = req.body ?? {};
  if (typeof from !== "number" || typeof to !== "number")
    return res.status(400).json({ error: "нужны числовые from, to (индексы вертипортов)" });
  const route = buildRoute(from, to);
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
  const a0 = Date.parse(t0);
  const a1 = Date.parse(t1);
  if (isNaN(a0) || isNaN(a1) || a1 <= a0)
    return res.status(400).json({ error: "некорректное окно времени (ISO-8601, t1>t0)" });
  const concurrent = slots.filter(
    (s) => s.routeId === routeId && overlaps(a0, a1, Date.parse(s.t0), Date.parse(s.t1))
  ).length;
  if (concurrent >= SLOT_CAPACITY)
    return res
      .status(409)
      .json({ error: "слот занят", routeId, capacity: SLOT_CAPACITY, concurrent });
  const rec: Slot = {
    id: "slot-" + (slots.length + 1),
    routeId,
    t0,
    t1,
    holder: String(holder),
    issued: new Date().toISOString().slice(0, 10),
    receipt: "",
  };
  rec.receipt =
    "qright:" + crypto.createHash("sha256").update(JSON.stringify(rec)).digest("hex").slice(0, 32);
  slots.push(rec);
  res.status(201).json({
    ok: true,
    slot: rec,
    note: "Право на 4D-слот зафиксировано (QRight). receipt = SHA-256-якорь.",
  });
});
