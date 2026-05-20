/**
 * AEVION CyberChess — Puzzle Cloud API
 * Routes: GET /api/puzzles  GET /api/puzzles/themes  GET /api/puzzles/count  POST /api/puzzles/seed
 */
import { Router, Request, Response } from "express";
import { getPool } from "../lib/dbPool";
export const puzzlesRouter = Router();

let dbReady = false;
let dbInitTried = false;

async function ensureDb() {
  if (dbInitTried) return;
  dbInitTried = true;
  if (!process.env.DATABASE_URL) { console.log("[Puzzles] No DATABASE_URL — offline mode"); return; }
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "ChessPuzzle" (
        "id"        TEXT PRIMARY KEY,
        "fen"       TEXT NOT NULL,
        "sol"       TEXT NOT NULL,
        "name"      TEXT NOT NULL DEFAULT 'Тактика',
        "rating"    INT NOT NULL DEFAULT 1200,
        "theme"     TEXT NOT NULL DEFAULT 'Тактика',
        "phase"     TEXT NOT NULL DEFAULT 'Middlegame',
        "side"      TEXT NOT NULL DEFAULT 'w',
        "goal"      TEXT NOT NULL DEFAULT 'Best move',
        "mateIn"    INT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "ChessPuzzle_rating_idx" ON "ChessPuzzle" ("rating")`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "ChessPuzzle_theme_idx" ON "ChessPuzzle" ("theme")`);
    await pool.query(`SELECT 1 FROM "ChessPuzzle" LIMIT 1`);
    dbReady = true;
    console.log("[Puzzles] Postgres ready — puzzle cloud active");
  } catch (e) { console.warn("[Puzzles] DB init failed:", e instanceof Error ? e.message : e); }
}

function offline(res: Response) {
  return res.json({ puzzles: [], total: 0, offline: true, message: "Puzzle DB not configured — use bundled puzzles.json" });
}

puzzlesRouter.get("/", async (req: Request, res: Response) => {
  await ensureDb();
  if (!dbReady) return offline(res);
  try {
    const pool = getPool();
    const nb = Math.min(200, Math.max(1, parseInt(req.query.nb as string) || 50));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const theme = typeof req.query.theme === "string" && req.query.theme !== "all" ? req.query.theme : undefined;
    const minR = parseInt(req.query.minR as string) || 400;
    const maxR = parseInt(req.query.maxR as string) || 3000;
    const goal = typeof req.query.goal === "string" && req.query.goal !== "all" ? req.query.goal : undefined;
    const side = (req.query.side === "w" || req.query.side === "b") ? req.query.side : undefined;
    const mateIn = req.query.mateIn ? parseInt(req.query.mateIn as string) : undefined;
    const random = req.query.random === "1";
    const conditions: string[] = [`"rating" >= $1 AND "rating" <= $2`];
    const params: (string | number)[] = [minR, maxR];
    if (theme) { params.push(theme); conditions.push(`"theme" = $${params.length}`); }
    if (goal) { params.push(goal); conditions.push(`"goal" = $${params.length}`); }
    if (side) { params.push(side); conditions.push(`"side" = $${params.length}`); }
    if (mateIn) { params.push(mateIn); conditions.push(`"mateIn" = $${params.length}`); }
    const where = conditions.join(" AND ");
    const countR = await pool.query(`SELECT COUNT(*) FROM "ChessPuzzle" WHERE ${where}`, params);
    const total = Number(countR.rows[0].count);
    if (total === 0) return res.json({ puzzles: [], total: 0, returned: 0 });
    const safeOffset = random ? Math.floor(Math.random() * Math.max(1, total - nb)) : offset;
    params.push(nb, safeOffset);
    const rows = await pool.query(`SELECT * FROM "ChessPuzzle" WHERE ${where} ORDER BY "rating" ASC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    const puzzles = rows.rows.map((p: any) => ({ id: p.id, fen: p.fen, sol: (()=>{try{return JSON.parse(p.sol)}catch{return [p.sol]}})(), name: p.name, r: p.rating, theme: p.theme, phase: p.phase, side: p.side, goal: p.goal, ...(p.mateIn ? { mateIn: p.mateIn } : {}) }));
    res.json({ puzzles, total, returned: rows.rows.length });
  } catch (err) { console.error("[Puzzles] GET:", err); res.status(500).json({ error: "puzzle_fetch_failed" }); }
});

puzzlesRouter.get("/themes", async (_req: Request, res: Response) => {
  await ensureDb();
  if (!dbReady) return res.json({ themes: [], offline: true });
  try {
    const pool = getPool();
    const r = await pool.query(`SELECT "theme", COUNT(*) AS cnt FROM "ChessPuzzle" GROUP BY "theme" ORDER BY cnt DESC`);
    res.json({ themes: r.rows.map((g: any) => ({ name: g.theme, count: Number(g.cnt) })) });
  } catch { res.status(500).json({ error: "themes_fetch_failed" }); }
});

puzzlesRouter.get("/count", async (_req: Request, res: Response) => {
  await ensureDb();
  if (!dbReady) return res.json({ total: 0, offline: true });
  try {
    const pool = getPool();
    const totalR = await pool.query(`SELECT COUNT(*) FROM "ChessPuzzle"`);
    const byTheme = await pool.query(`SELECT "theme", COUNT(*) AS cnt FROM "ChessPuzzle" GROUP BY "theme" ORDER BY cnt DESC LIMIT 20`);
    res.json({ total: Number(totalR.rows[0].count), topThemes: byTheme.rows.map((b: any) => ({ theme: b.theme, count: Number(b.cnt) })) });
  } catch { res.status(500).json({ error: "count_failed" }); }
});

puzzlesRouter.post("/seed", async (req: Request, res: Response) => {
  await ensureDb();
  if (!dbReady) return res.status(503).json({ error: "db_not_ready" });
  const key = req.headers["x-puzzle-seed-key"] ?? req.body?.key;
  if (!process.env.PUZZLE_SEED_KEY || key !== process.env.PUZZLE_SEED_KEY) return res.status(403).json({ error: "forbidden" });
  const puzzles: any[] = req.body?.puzzles;
  if (!Array.isArray(puzzles) || !puzzles.length) return res.status(400).json({ error: "puzzles array required" });
  try {
    const pool = getPool();
    let upserted = 0;
    for (let i = 0; i < puzzles.length; i += 500) {
      const batch = puzzles.slice(i, i + 500).map((p: any) => ({
        id: String(p.id || `gen_${Date.now()}_${i}`),
        fen: String(p.fen || ""), sol: JSON.stringify(Array.isArray(p.sol) ? p.sol : [p.sol]),
        name: String(p.name || "Тактика"), rating: parseInt(p.r ?? p.rating) || 1200,
        theme: String(p.theme || "Тактика"), phase: String(p.phase || "Middlegame"),
        side: String(p.side || "w"), goal: String(p.goal || "Best move"),
        mateIn: p.mateIn ? parseInt(p.mateIn) : null,
      }));
      for (const p of batch) {
        await pool.query(
          `INSERT INTO "ChessPuzzle" ("id","fen","sol","name","rating","theme","phase","side","goal","mateIn") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT ("id") DO NOTHING`,
          [p.id, p.fen, p.sol, p.name, p.rating, p.theme, p.phase, p.side, p.goal, p.mateIn]
        );
        upserted++;
      }
    }
    res.json({ ok: true, upserted });
  } catch (err) { console.error("[Puzzles] seed:", err); res.status(500).json({ error: "seed_failed" }); }
});
