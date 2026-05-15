/**
 * AEVION CyberChess — Puzzle Cloud API
 * Routes: GET /api/puzzles  GET /api/puzzles/themes  GET /api/puzzles/count  POST /api/puzzles/seed
 */
import { Router, Request, Response } from "express";
export const puzzlesRouter = Router();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
let dbReady = false;
let dbInitTried = false;

async function ensureDb() {
  if (dbInitTried) return;
  dbInitTried = true;
  if (!process.env.DATABASE_URL) { console.log("[Puzzles] No DATABASE_URL — offline mode"); return; }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient } = require("@prisma/client");
    const client = new PrismaClient();
    await client.chessPuzzle.count();
    db = client; dbReady = true;
    console.log("[Puzzles] Prisma connected — puzzle cloud ready");
  } catch (e) { console.warn("[Puzzles] Prisma init failed:", e instanceof Error ? e.message : e); }
}

function offline(res: Response) {
  return res.json({ puzzles: [], total: 0, offline: true, message: "Puzzle DB not configured — use bundled puzzles.json" });
}

puzzlesRouter.get("/", async (req: Request, res: Response) => {
  await ensureDb();
  if (!dbReady) return offline(res);
  try {
    const nb = Math.min(200, Math.max(1, parseInt(req.query.nb as string) || 50));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const theme = typeof req.query.theme === "string" && req.query.theme !== "all" ? req.query.theme : undefined;
    const minR = parseInt(req.query.minR as string) || 400;
    const maxR = parseInt(req.query.maxR as string) || 3000;
    const goal = typeof req.query.goal === "string" && req.query.goal !== "all" ? req.query.goal : undefined;
    const side = (req.query.side === "w" || req.query.side === "b") ? req.query.side : undefined;
    const mateIn = req.query.mateIn ? parseInt(req.query.mateIn as string) : undefined;
    const random = req.query.random === "1";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { rating: { gte: minR, lte: maxR }, ...(theme?{theme}:{}), ...(goal?{goal}:{}), ...(side?{side}:{}), ...(mateIn?{mateIn}:{}) };
    const total: number = await db.chessPuzzle.count({ where });
    if (total === 0) return res.json({ puzzles: [], total: 0, returned: 0 });
    let rows;
    if (random) {
      const safeOffset = Math.floor(Math.random() * Math.max(1, total - nb));
      rows = await db.chessPuzzle.findMany({ where, skip: safeOffset, take: nb, orderBy: { rating: "asc" } });
    } else {
      rows = await db.chessPuzzle.findMany({ where, skip: offset, take: nb, orderBy: { rating: "asc" } });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puzzles = rows.map((p: any) => ({ id: p.id, fen: p.fen, sol: (()=>{try{return JSON.parse(p.sol)}catch{return [p.sol]}})(), name: p.name, r: p.rating, theme: p.theme, phase: p.phase, side: p.side, goal: p.goal, ...(p.mateIn ? { mateIn: p.mateIn } : {}) }));
    res.json({ puzzles, total, returned: rows.length });
  } catch (err) { console.error("[Puzzles] GET:", err); res.status(500).json({ error: "puzzle_fetch_failed" }); }
});

puzzlesRouter.get("/themes", async (_req: Request, res: Response) => {
  await ensureDb();
  if (!dbReady) return res.json({ themes: [], offline: true });
  try {
    const grouped = await db.chessPuzzle.groupBy({ by: ["theme"], _count: { theme: true }, orderBy: { _count: { theme: "desc" } } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.json({ themes: grouped.map((g: any) => ({ name: g.theme, count: g._count.theme })) });
  } catch { res.status(500).json({ error: "themes_fetch_failed" }); }
});

puzzlesRouter.get("/count", async (_req: Request, res: Response) => {
  await ensureDb();
  if (!dbReady) return res.json({ total: 0, offline: true });
  try {
    const total: number = await db.chessPuzzle.count();
    const byTheme = await db.chessPuzzle.groupBy({ by: ["theme"], _count: { theme: true }, orderBy: { _count: { theme: "desc" } }, take: 20 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.json({ total, topThemes: byTheme.map((b: any) => ({ theme: b.theme, count: b._count.theme })) });
  } catch { res.status(500).json({ error: "count_failed" }); }
});

puzzlesRouter.post("/seed", async (req: Request, res: Response) => {
  await ensureDb();
  if (!dbReady) return res.status(503).json({ error: "db_not_ready" });
  const key = req.headers["x-puzzle-seed-key"] ?? req.body?.key;
  if (!process.env.PUZZLE_SEED_KEY || key !== process.env.PUZZLE_SEED_KEY) return res.status(403).json({ error: "forbidden" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const puzzles: any[] = req.body?.puzzles;
  if (!Array.isArray(puzzles) || !puzzles.length) return res.status(400).json({ error: "puzzles array required" });
  try {
    let upserted = 0;
    for (let i = 0; i < puzzles.length; i += 500) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = puzzles.slice(i, i+500).map((p: any) => ({ id: String(p.id||`gen_${Date.now()}_${i}`), fen: String(p.fen||""), sol: JSON.stringify(Array.isArray(p.sol)?p.sol:[p.sol]), name: String(p.name||"Тактика"), rating: parseInt(p.r??p.rating)||1200, theme: String(p.theme||"Тактика"), phase: String(p.phase||"Middlegame"), side: String(p.side||"w"), goal: String(p.goal||"Best move"), mateIn: p.mateIn?parseInt(p.mateIn):null }));
      await db.chessPuzzle.createMany({ data, skipDuplicates: true });
      upserted += data.length;
    }
    res.json({ ok: true, upserted });
  } catch (err) { console.error("[Puzzles] seed:", err); res.status(500).json({ error: "seed_failed" }); }
});
