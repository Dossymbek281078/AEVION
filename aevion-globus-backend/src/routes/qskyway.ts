import { Router, Request, Response } from "express";
import crypto from "crypto";
import { CITY, CityData } from "./qskyway.city";
import { CITY_NYC } from "./qskyway.city.nyc";
import { CITY_TOKYO } from "./qskyway.city.tokyo";
import { NOFLY, WIND, NoFlyZone } from "./qskyway.zones";
import { getPool } from "../lib/dbPool";

/**
 * AEVION QSkyway — навигационный слой городского неба для аэротакси.
 *
 * Провайдер-независимый «Google Maps + ПДД неба»: 3D-аэрокоридоры поверх
 * реального цифрового двойника города. Мультигородской (Астана, Нью-Йорк) —
 * реальные здания из OpenStreetMap, поле высот 20 м. Детерминированный, DB-free.
 *
 * Фаза 4: полигональные запретные зоны (обход в маршрутизации), послойная
 * ветровая модель (влияет на ETA), подпись двойника Ed25519 (QSign-аттестация),
 * скоринг пригодности посадочных площадок (шаг к муниципальным вертипортам).
 *
 * Честно: движок/PoC, не сертифицированное авиационное ПО. Данные зданий —
 * OpenStreetMap (ODbL, открытые). Запретные зоны/ветер здесь ИЛЛЮСТРАТИВНЫ; в
 * проде подключаются к официальным фидам (FAA/EASA/CAAC + METAR/прогноз).
 *
 * Endpoints:
 *   GET  /health          — статус + список городов
 *   GET  /cities          — города (счётчики, bbox, подпись, площадки)
 *   GET  /city?city=id    — двойник + запретные зоны + ветер + подпись
 *   GET  /vertiports?city=id — площадки со скорингом пригодности
 *   POST /route           — {from,to,city?} → 4D-маршрут (обход зон + ветер в ETA)
 *   GET  /verify?city=id  — проверка подписи Ed25519 двойника
 *   GET  /slots  · POST /slots — рынок 4D-слотов прав (QRight)
 */

export const qskywayRouter = Router();

const DISCLAIMER =
  "Движок/PoC, не сертифицированное авиационное ПО. Данные зданий — OpenStreetMap (ODbL). Запретные зоны и ветер иллюстративны; в проде — официальные фиды регулятора и METAR. Полёты требуют допуска (U-space/UTM/CAAC).";

// ── city registry ──────────────────────────────────────────────────────────
const CITIES: Record<string, CityData> = { astana: CITY, nyc: CITY_NYC, tokyo: CITY_TOKYO };
const DEFAULT_CITY = "astana";
const resolveCity = (id: unknown): { id: string; city: CityData } | null => {
  const key = typeof id === "string" && id in CITIES ? id : id == null ? DEFAULT_CITY : null;
  return key ? { id: key, city: CITIES[key] } : null;
};

// ── engine constants ─────────────────────────────────────────────────────────
const FLOOR = 50;
const CLEAR = 15;
const BAND = 25;
// Phase 5: extra safety clearance by height-data confidence (metres), indexed by
// height source: 0=measured (explicit height tag), 1=derived (levels×3.2),
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
function windAt(cityId: string, altM: number): { fromDeg: number; speedMs: number } {
  const w = WIND[cityId] ?? { fromDeg: 270, baseMs: 3, perBandMs: 1 };
  const band = Math.max(0, (altM - FLOOR) / BAND);
  return { fromDeg: w.fromDeg, speedMs: +(w.baseMs + band * w.perBandMs).toFixed(2) };
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

function astar(g: CityData["grid"], s: Cell, goal: Cell, blocked: (c: number, r: number) => boolean): Cell[] | null {
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

interface RouteResult {
  city: string; from: number; to: number; path: Cell[]; alts: number[]; obstacles: number[];
  distanceKm: number; cruiseAltM: number;
  etaMinStill: number; etaMinWind: number; avgWindMs: number; windFromDeg: number;
  avoidsNoFly: boolean;
  avgConfClearM: number; heightConfidencePct: number;
}

function buildRoute(cityId: string, city: CityData, fromVp: number, toVp: number): RouteResult | null {
  const vps = city.vertiports;
  if (fromVp < 0 || toVp < 0 || fromVp >= vps.length || toVp >= vps.length || fromVp === toVp) return null;
  const zones = zonesMeters(cityId, city);
  const blocked = noFlyTest(city, zones);
  const a = vps[fromVp], b = vps[toVp];
  const path = astar(city.grid, { c: a.c, r: a.r }, { c: b.c, r: b.r }, blocked);
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
  };
}

// ── vertiport suitability (шаг к муниципальным площадкам) ──────────────────────
interface VertiportScore {
  id: string; c: number; r: number; x: number; y: number;
  openRadiusM: number; clearanceM: number; distNoFlyM: number;
  suitability: number; class: "candidate-pad" | "needs-infrastructure" | "unsuitable";
}
function suitability(cityId: string, city: CityData): VertiportScore[] {
  const g = city.grid;
  const obst = obstOf(g);
  const zones = zonesMeters(cityId, city);
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
    return { id: `vp${i}`, c: v.c, r: v.r, x: v.x, y: v.y, openRadiusM: openR, clearanceM: clearance, distNoFlyM: Math.round(distNoFly), suitability: score, class: cls };
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
    cities: Object.entries(CITIES).map(([id, c]) => ({ id, name: c.city, buildings: c.buildings.length, vertiports: c.vertiports.length, noFlyZones: (NOFLY[id] ?? []).length, heightMeasuredPct: c.dataQuality.measuredPct, heightRealPct: c.dataQuality.realPct })),
    city: CITY.city,
    buildings: CITY.buildings.length,
    vertiports: CITY.vertiports.length,
    grid: { cols: CITY.grid.cols, rows: CITY.grid.rows, cellM: CITY.grid.cell },
    altitude: { floorM: FLOOR, bandM: BAND, clearanceM: CLEAR },
    clearanceModel: { baseM: CLEAR, byHeightSourceM: { measured: SRC_CLEARANCE[0], derived: SRC_CLEARANCE[1], guessed: SRC_CLEARANCE[2] }, note: "Страховочный просвет растёт при низкой уверенности высоты; лучше данные (LiDAR/LOD2/3D Tiles) → ниже крейсер." },
    features: ["nofly-avoidance", "layered-wind", "ed25519-signed-twin", "vertiport-suitability", "height-provenance", "confidence-clearance"],
    slotsStore: slotsDbAvailable ? "postgres" : "memory",
    slotsBooked,
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
      signature: { alg: "Ed25519", contentHash: signCity(id, c).contentHash },
    })),
  });
});

qskywayRouter.get("/city", (req: Request, res: Response) => {
  const resolved = resolveCity(req.query.city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  const { id, city } = resolved;
  const zones = zonesMeters(id, city);
  res.json({
    ...city,
    nofly: zones.map((z) => ({ id: z.id, name: z.name, kind: z.kind, x: Math.round(z.x), y: Math.round(z.y), radiusM: z.radiusM, until: z.until ?? null })),
    wind: { fromDeg: WIND[id]?.fromDeg ?? 270, groundMs: windAt(id, FLOOR).speedMs, topMs: windAt(id, city.grid.heights.reduce((m, v) => Math.max(m, v), 0) + CLEAR).speedMs, note: "иллюстративная послойная модель" },
    vertiportScores: suitability(id, city),
    _signature: signCity(id, city),
  });
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
  const { from, to, city } = req.body ?? {};
  if (typeof from !== "number" || typeof to !== "number")
    return res.status(400).json({ error: "нужны числовые from, to (индексы вертипортов)" });
  const resolved = resolveCity(city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  const route = buildRoute(resolved.id, resolved.city, from, to);
  if (!route) return res.status(422).json({ error: "маршрут не найден / некорректные вертипорты / отрезан запретными зонами" });
  res.json(route);
});

qskywayRouter.get("/verify", (req: Request, res: Response) => {
  const resolved = resolveCity(req.query.city);
  if (!resolved) return res.status(404).json({ error: "неизвестный город", available: Object.keys(CITIES) });
  const sig = signCity(resolved.id, resolved.city);
  res.json({ city: resolved.id, valid: verifyCity(resolved.city, sig), alg: "Ed25519", contentHash: sig.contentHash, publicKey: sig.publicKey });
});

qskywayRouter.get("/slots", async (_req: Request, res: Response) => {
  const slots = await listSlots();
  res.json({ count: slots.length, capacityPerRoute: SLOT_CAPACITY, store: slotsDbAvailable ? "postgres" : "memory", slots });
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
