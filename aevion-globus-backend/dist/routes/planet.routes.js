import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { awardXp, calcLevel, getAllTerritories, unlockTerritory, updateTerritoryProgress, getAvailableQuests, startQuest, completeQuest, updateQuestProgress, getLeaderboard, getUserRank, seedPlanetEngine } from "../services/planet-engine.js";
let prisma = null;
function getPrisma() {
    if (prisma)
        return prisma;
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
function requireUser(req, res, next) {
    const userId = req.headers["x-user-id"];
    if (!userId) {
        res.status(401).json({ error: "x-user-id header required" });
        return;
    }
    req.userId = userId;
    next();
}
router.use(requireUser);
function uid(req) { return req.userId; }
router.get("/me", async (req, res) => {
    try {
        const db = getPrisma();
        const userId = uid(req);
        let pu = await db.planetUser.findUnique({ where: { userId } });
        if (!pu)
            pu = await db.planetUser.create({ data: { userId, xp: 0, level: 1, totalScore: 0 } });
        res.json({ ...pu, ...calcLevel(pu.xp) });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post("/xp/award", async (req, res) => {
    try {
        const { amount, reason, metadata } = req.body;
        if (!amount || !reason) {
            res.status(400).json({ error: "amount and reason required" });
            return;
        }
        const result = await awardXp(uid(req), Number(amount), reason, metadata);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get("/xp/history", async (req, res) => {
    try {
        const db = getPrisma();
        const pu = await db.planetUser.findUnique({ where: { userId: uid(req) } });
        if (!pu) {
            res.json([]);
            return;
        }
        const limit = Math.min(Number(req.query["limit"]) || 50, 200);
        const logs = await db.xpLog.findMany({ where: { planetUserId: pu.id }, orderBy: { createdAt: "desc" }, take: limit });
        res.json(logs);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get("/territories", async (req, res) => {
    try {
        res.json(await getAllTerritories(uid(req)));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post("/territories/:slug/unlock", async (req, res) => {
    try {
        res.json(await unlockTerritory(uid(req), req.params["slug"]));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch("/territories/:slug/progress", async (req, res) => {
    try {
        const { progress } = req.body;
        if (progress === undefined) {
            res.status(400).json({ error: "progress required" });
            return;
        }
        res.json(await updateTerritoryProgress(uid(req), req.params["slug"], Number(progress)));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get("/quests", async (req, res) => {
    try {
        res.json(await getAvailableQuests(uid(req)));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post("/quests/:id/start", async (req, res) => {
    try {
        res.json(await startQuest(uid(req), req.params["id"]));
    }
    catch (e) {
        const s = e.message.includes("already") ? 409 : 500;
        res.status(s).json({ error: e.message });
    }
});
router.post("/quests/:id/complete", async (req, res) => {
    try {
        res.json(await completeQuest(uid(req), req.params["id"]));
    }
    catch (e) {
        const s = e.message.includes("already") ? 409 : 500;
        res.status(s).json({ error: e.message });
    }
});
router.patch("/quests/:id/progress", async (req, res) => {
    try {
        const { progress } = req.body;
        if (progress === undefined) {
            res.status(400).json({ error: "progress required" });
            return;
        }
        res.json(await updateQuestProgress(uid(req), req.params["id"], Number(progress)));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get("/leaderboard", async (req, res) => {
    try {
        const limit = Math.min(Number(req.query["limit"]) || 50, 100);
        res.json(await getLeaderboard(limit));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get("/leaderboard/me", async (req, res) => {
    try {
        res.json(await getUserRank(uid(req)));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post("/seed", async (req, res) => {
    try {
        res.json({ ok: true, seeded: await seedPlanetEngine() });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export { router as planetRouter };
//# sourceMappingURL=planet.routes.js.map