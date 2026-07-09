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
import * as path from "node:path";

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

// Pool path is overridable so ops can point at a large imported dump on a
// mounted volume without a redeploy.
const POOL_PATH =
  process.env.CYBERCHESS_PUZZLES_PATH ||
  path.resolve(process.cwd(), "data", "cyberchess-puzzles.json");

let POOL: Puzzle[] = [];
let loaded = false;
// theme (lowercased) -> index list, built once for cheap filtered lookups
const THEME_INDEX = new Map<string, number[]>();

function loadPool(): void {
  if (loaded) return;
  loaded = true;
  try {
    if (!fs.existsSync(POOL_PATH)) {
      console.log("[cyberchess-puzzles] no pool file at", POOL_PATH, "— serving empty (frontend falls back)");
      return;
    }
    const raw = fs.readFileSync(POOL_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const arr: unknown = Array.isArray(parsed) ? parsed : (parsed && parsed.puzzles);
    if (!Array.isArray(arr)) {
      console.warn("[cyberchess-puzzles] pool file has unexpected shape — serving empty");
      return;
    }
    POOL = (arr as Puzzle[]).filter(
      (p) => p && typeof p.fen === "string" && Array.isArray(p.sol) && p.sol.length > 0,
    );
    for (let i = 0; i < POOL.length; i++) {
      const key = String(POOL[i].theme || "").toLowerCase();
      const bucket = THEME_INDEX.get(key);
      if (bucket) bucket.push(i);
      else THEME_INDEX.set(key, [i]);
    }
    console.log(`[cyberchess-puzzles] loaded ${POOL.length} puzzles, ${THEME_INDEX.size} themes`);
  } catch (e) {
    console.warn("[cyberchess-puzzles] load failed:", e instanceof Error ? e.message : e);
    POOL = [];
  }
}

loadPool();

function toInt(v: unknown, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : dflt;
}

// GET / — filtered, paginated puzzle query.
// Query: theme, minRating, maxRating, phase, limit (<=200), offset,
//        shuffle=1 (random sample within the filtered set).
router.get("/", (req: Request, res: Response): void => {
  try {
    const theme = String(req.query.theme || "").trim().toLowerCase();
    const phase = String(req.query.phase || "").trim().toLowerCase();
    const minRating = toInt(req.query.minRating, 0);
    const maxRating = toInt(req.query.maxRating, 4000);
    const limit = Math.min(200, Math.max(1, toInt(req.query.limit, 50)));
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
router.get("/themes", (_req: Request, res: Response): void => {
  const themes = [...THEME_INDEX.entries()]
    .map(([key, idxs]) => ({ theme: POOL[idxs[0]]?.theme ?? key, count: idxs.length }))
    .sort((a, b) => b.count - a.count);
  res.json({ ok: true, poolSize: POOL.length, themes });
});

// GET /meta — pool health/size (cheap smoke).
router.get("/meta", (_req: Request, res: Response): void => {
  res.json({ ok: true, poolSize: POOL.length, themes: THEME_INDEX.size, source: POOL_PATH });
});

export default router;
