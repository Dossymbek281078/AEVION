import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { awardXp, calcLevel, getAllTerritories, unlockTerritory, updateTerritoryProgress, getAvailableQuests, startQuest, completeQuest, updateQuestProgress, getLeaderboard, getUserRank, seedPlanetEngine } from "../services/planet-engine";

let prisma: PrismaClient | null = null;

function getPrisma() {
  if (prisma) return prisma;
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL || typeof DATABASE_URL !== "string") {
    throw new Error("DATABASE_URL is missing or not a string. Check .env");
  }
  const pool = new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
  return prisma;
}

const router = Router();

function requireUser(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!userId) { res.status(401).json({ error: "x-user-id header required" }); return; }
  (req as any).userId = userId;
  next();
}

router.use(requireUser);

function uid(req: Request): string { return (req as any).userId; }

router.get("/me", async (req: Request, res: Response) => {
  try {
    const db = getPrisma();
    const userId = uid(req);
    let pu = await db.planetUser.findUnique({ where: { userId } });
    if (!pu) pu = await db.planetUser.create({ data: { userId, xp: 0, level: 1, totalScore: 0 } });
    res.json({ ...pu, ...calcLevel(pu.xp) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/xp/award", async (req: Request, res: Response) => {
  try {
    const { amount, reason, metadata } = req.body;
    if (!amount || !reason) { res.status(400).json({ error: "amount and reason required" }); return; }
    const result = await awardXp(uid(req), Number(amount), reason, metadata);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/xp/history", async (req: Request, res: Response) => {
  try {
    const db = getPrisma();
    const pu = await db.planetUser.findUnique({ where: { userId: uid(req) } });
    if (!pu) { res.json([]); return; }
    const limit = Math.min(Number(req.query["limit"]) || 50, 200);
    const logs = await db.xpLog.findMany({ where: { planetUserId: pu.id }, orderBy: { createdAt: "desc" }, take: limit });
    res.json(logs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/territories", async (req: Request, res: Response) => {
  try { res.json(await getAllTerritories(uid(req))); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/territories/:slug/unlock", async (req: Request, res: Response) => {
  try { res.json(await unlockTerritory(uid(req), req.params["slug"]!)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/territories/:slug/progress", async (req: Request, res: Response) => {
  try {
    const { progress } = req.body;
    if (progress === undefined) { res.status(400).json({ error: "progress required" }); return; }
    res.json(await updateTerritoryProgress(uid(req), req.params["slug"]!, Number(progress)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/quests", async (req: Request, res: Response) => {
  try { res.json(await getAvailableQuests(uid(req))); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/quests/:id/start", async (req: Request, res: Response) => {
  try { res.json(await startQuest(uid(req), req.params["id"]!)); }
  catch (e: any) { const s = e.message.includes("already") ? 409 : 500; res.status(s).json({ error: e.message }); }
});

router.post("/quests/:id/complete", async (req: Request, res: Response) => {
  try { res.json(await completeQuest(uid(req), req.params["id"]!)); }
  catch (e: any) { const s = e.message.includes("already") ? 409 : 500; res.status(s).json({ error: e.message }); }
});

router.patch("/quests/:id/progress", async (req: Request, res: Response) => {
  try {
    const { progress } = req.body;
    if (progress === undefined) { res.status(400).json({ error: "progress required" }); return; }
    res.json(await updateQuestProgress(uid(req), req.params["id"]!, Number(progress)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query["limit"]) || 50, 100);
    res.json(await getLeaderboard(limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/leaderboard/me", async (req: Request, res: Response) => {
  try { res.json(await getUserRank(uid(req))); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/seed", async (req: Request, res: Response) => {
  try { res.json({ ok: true, seeded: await seedPlanetEngine() }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

export { router as planetRouter };