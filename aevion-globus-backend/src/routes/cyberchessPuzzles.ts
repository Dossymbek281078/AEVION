// AEVION CyberChess — server-side puzzle pool
// Mount expected at: /api/cyberchess-puzzles
//
// Serves the puzzle pool from data/cyberchess-puzzles.json with server-side
// filtering (theme / rating / phase) + pagination, instead of the frontend
// downloading the whole 2.4 MB file and filtering client-side. The pool is
// growable: run scripts/import-lichess-puzzles-dump.mjs against a Lichess CSV
// dump to expand it toward lichess-scale without touching this code.
//
// All handlers are defensive: a missing/corrupt pool file degrades to an empty
// result (the frontend falls back to its bundled copy), never a crash.

import { Router, type Request, type Response } from "express";
import * as fs from "node:fs";
import { getPool } from "../lib/dbPool";

const router = Router();

interface Puzzle {
  fen: string;
  sol: string[];
  name: string;
  r: number; // rating
  theme: string;
  phase?: string;
  side?: string;
  goal?: string;
  mateIn?: number;
}

// Optional LOCAL pool file — for ops who mount a large imported dump on a
// volume. NOTE: on Railway a persistent volume is mounted at data/ (so
// tournament writes survive redeploys), which SHADOWS any seed committed under
// data/. So we do NOT ship a seed file there; instead the default source is the
// already-public puzzles.json served by the frontend (single source of truth).
const POOL_PATH = process.env.CYBERCHESS_PUZZLES_PATH || "";
const POOL_URL =
  process.env.CYBERCHESS_PUZZLES_URL ||
  "https://aevion.vercel.app/puzzles.json";

let POOL: Puzzle[] = [];
// theme (lowercased) -> index list, built once for cheap filtered lookups
const THEME_INDEX = new Map<string, number[]>();
let loadPromise: Promise<void> | null = null;

function ingest(arr: unknown, source: string): void {
  if (!Array.isArray(arr)) {
    console.warn(`[cyberchess-puzzles] ${source}: unexpected shape — serving empty`);
    return;
  }
  POOL = (arr as Puzzle[]).filter(
    (p) => p && typeof p.fen === "string" && Array.isArray(p.sol) && p.sol.length > 0,
  );
  THEME_INDEX.clear();
  for (let i = 0; i < POOL.length; i++) {
    const key = String(POOL[i].theme || "").toLowerCase();
    const bucket = THEME_INDEX.get(key);
    if (bucket) bucket.push(i);
    else THEME_INDEX.set(key, [i]);
  }
  console.log(`[cyberchess-puzzles] loaded ${POOL.length} puzzles, ${THEME_INDEX.size} themes (${source})`);
}

// Load once, cached via a shared promise. Local file (if configured) wins;
// otherwise fetch the public pool URL. Any failure → empty pool (frontend
// falls back to its bundled copy). Never throws.
function ensureLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    // 1) explicit local file (large mounted dump)
    if (POOL_PATH) {
      try {
        if (fs.existsSync(POOL_PATH)) {
          const parsed = JSON.parse(fs.readFileSync(POOL_PATH, "utf-8"));
          ingest(Array.isArray(parsed) ? parsed : parsed && parsed.puzzles, `file ${POOL_PATH}`);
          if (POOL.length > 0) return;
        }
      } catch (e) {
        console.warn("[cyberchess-puzzles] local file load failed:", e instanceof Error ? e.message : e);
      }
    }
    // 2) Postgres ChessPuzzle table — масштабируемый источник истины, как только
    //    он засеян (scripts/seed-puzzles.mjs → POST /api/puzzles/seed из CC0-дампа
    //    Lichess). Это недостающее звено: DB-пайплайн (модель+/api/puzzles+seed)
    //    уже был, но фронт зовёт ЭТОТ роут — теперь при непустой таблице игроки
    //    получают расширенный пул. Zero-regression: нет DB/таблица пуста/ошибка →
    //    проваливаемся на публичный URL (bundled 10.8k) ниже.
    if (process.env.DATABASE_URL) {
      try {
        const cap = Math.max(1, Math.min(2_000_000, Number(process.env.CYBERCHESS_PUZZLES_DB_CAP) || 500_000));
        const pool = getPool();
        const q = await pool.query(
          `SELECT "fen","sol","name","rating","theme","phase","side","goal","mateIn" FROM "ChessPuzzle" LIMIT $1`,
          [cap],
        );
        if (q.rows && q.rows.length > 0) {
          const mapped = q.rows.map((row: Record<string, unknown>) => {
            let sol: string[];
            const raw = String(row.sol ?? "");
            try { const a = JSON.parse(raw); sol = Array.isArray(a) ? a.map(String) : raw.split(/\s+/).filter(Boolean); }
            catch { sol = raw.split(/\s+/).filter(Boolean); }
            return {
              fen: String(row.fen ?? ""),
              sol,
              name: String(row.name ?? "Тактика"),
              r: Number(row.rating ?? 1200),
              theme: String(row.theme ?? "Тактика"),
              phase: row.phase != null ? String(row.phase) : undefined,
              side: row.side != null ? String(row.side) : undefined,
              goal: row.goal != null ? String(row.goal) : undefined,
              mateIn: row.mateIn != null ? Number(row.mateIn) : undefined,
            } as Puzzle;
          });
          ingest(mapped, `db ChessPuzzle (${q.rows.length})`);
          if (POOL.length > 0) return;
        }
      } catch (e) {
        console.warn("[cyberchess-puzzles] DB load failed (falling back to URL):", e instanceof Error ? e.message : e);
      }
    }
    // 3) public URL (default source of truth — bundled 10.8k)
    try {
      const r = await fetch(POOL_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const parsed = await r.json();
      ingest(Array.isArray(parsed) ? parsed : parsed && (parsed as { puzzles?: unknown }).puzzles, `url ${POOL_URL}`);
    } catch (e) {
      console.warn("[cyberchess-puzzles] url load failed:", e instanceof Error ? e.message : e);
    }
  })();
  return loadPromise;
}

// warm the pool at startup (non-blocking)
void ensureLoaded();

function toInt(v: unknown, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : dflt;
}

// GET / — filtered, paginated puzzle query.
// Query: theme, minRating, maxRating, phase, limit (<=200), offset,
//        shuffle=1 (random sample within the filtered set).
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureLoaded();
    const theme = String(req.query.theme || "").trim().toLowerCase();
    const phase = String(req.query.phase || "").trim().toLowerCase();
    const minRating = toInt(req.query.minRating, 0);
    const maxRating = toInt(req.query.maxRating, 4000);
    // Cap high enough to serve a full initial training bank in one request
    // (the whole current pool is ~10.8k). Bounded so a grown million-scale pool
    // still returns a sane sample per request.
    const limit = Math.min(25000, Math.max(1, toInt(req.query.limit, 50)));
    const offset = Math.max(0, toInt(req.query.offset, 0));
    const shuffle = req.query.shuffle === "1" || req.query.shuffle === "true";

    // Candidate index set: use the theme index when a theme is given.
    const candidateIdx =
      theme && THEME_INDEX.has(theme)
        ? THEME_INDEX.get(theme)!
        : theme
          ? [] // theme requested but unknown → no matches
          : POOL.map((_, i) => i);

    const matched: Puzzle[] = [];
    for (const i of candidateIdx) {
      const p = POOL[i];
      if (p.r < minRating || p.r > maxRating) continue;
      if (phase && String(p.phase || "").toLowerCase() !== phase) continue;
      matched.push(p);
    }

    const total = matched.length;
    let page: Puzzle[];
    if (shuffle) {
      // Fisher-Yates partial shuffle to sample `limit` without bias.
      const idxs = matched.map((_, i) => i);
      const take = Math.min(limit, idxs.length);
      for (let i = 0; i < take; i++) {
        const j = i + Math.floor(Math.random() * (idxs.length - i));
        [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
      }
      page = idxs.slice(0, take).map((i) => matched[i]);
    } else {
      page = matched.slice(offset, offset + limit);
    }

    res.json({ ok: true, total, count: page.length, offset, poolSize: POOL.length, puzzles: page });
  } catch (e) {
    console.warn("[cyberchess-puzzles] query failed:", e instanceof Error ? e.message : e);
    res.json({ ok: true, total: 0, count: 0, offset: 0, poolSize: POOL.length, puzzles: [] });
  }
});

// GET /themes — distinct themes with counts, for building filter UIs.
router.get("/themes", async (_req: Request, res: Response): Promise<void> => {
  await ensureLoaded();
  const themes = [...THEME_INDEX.entries()]
    .map(([key, idxs]) => ({ theme: POOL[idxs[0]]?.theme ?? key, count: idxs.length }))
    .sort((a, b) => b.count - a.count);
  res.json({ ok: true, poolSize: POOL.length, themes });
});

// GET /meta — pool health/size (cheap smoke).
router.get("/meta", async (_req: Request, res: Response): Promise<void> => {
  await ensureLoaded();
  res.json({ ok: true, poolSize: POOL.length, themes: THEME_INDEX.size, source: POOL_PATH || POOL_URL });
});

export default router;
