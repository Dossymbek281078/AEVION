import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
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
const BASE_XP = 100;
const GROWTH = 1.35;
export function xpForLevel(level) {
    if (level <= 1)
        return 0;
    return Math.floor(BASE_XP * Math.pow(GROWTH, level - 2));
}
export function calcLevel(totalXp) {
    let level = 1;
    let remaining = totalXp;
    while (true) {
        const needed = xpForLevel(level + 1);
        if (remaining < needed) {
            return { level, currentXp: remaining, nextLevelXp: needed };
        }
        remaining -= needed;
        level++;
    }
}
async function getPlanetUser(userId) {
    const db = getPrisma();
    let pu = await db.planetUser.findUnique({ where: { userId } });
    if (!pu) {
        pu = await db.planetUser.create({ data: { userId, xp: 0, level: 1, totalScore: 0 } });
    }
    return pu;
}
export async function awardXp(userId, amount, reason, metadata) {
    const db = getPrisma();
    const pu = await getPlanetUser(userId);
    const newXp = pu.xp + amount;
    const { level } = calcLevel(newXp);
    const updated = await db.planetUser.update({
        where: { userId },
        data: { xp: newXp, level, totalScore: { increment: amount } },
    });
    const xpLogData = {
        planetUserId: pu.id, amount, reason,
    };
    if (metadata) {
        xpLogData.metadata = metadata;
    }
    await db.xpLog.create({ data: xpLogData });
    await db.leaderboard.upsert({
        where: { userId },
        create: { userId, displayName: userId, xp: newXp, level, period: "ALL_TIME" },
        update: { xp: newXp, level },
    });
    return { ...updated, ...calcLevel(updated.xp) };
}
export async function getAllTerritories(userId) {
    const db = getPrisma();
    const pu = await getPlanetUser(userId);
    const territories = await db.territory.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: { userTerritories: { where: { planetUserId: pu.id } } },
    });
    return territories.map((t) => {
        const ut = t.userTerritories[0];
        return {
            id: t.id, slug: t.slug, name: t.name, description: t.description,
            icon: t.icon, xpReward: t.xpReward, order: t.order,
            unlocked: !!ut, progress: ut?.progress ?? 0, unlockedAt: ut?.unlockedAt ?? null,
        };
    });
}
export async function unlockTerritory(userId, slug) {
    const db = getPrisma();
    const pu = await getPlanetUser(userId);
    const territory = await db.territory.findUniqueOrThrow({ where: { slug } });
    const existing = await db.userTerritory.findUnique({
        where: { planetUserId_territoryId: { planetUserId: pu.id, territoryId: territory.id } },
    });
    if (existing)
        return existing;
    return db.userTerritory.create({
        data: { planetUserId: pu.id, territoryId: territory.id },
    });
}
export async function updateTerritoryProgress(userId, slug, progress) {
    const db = getPrisma();
    const pu = await getPlanetUser(userId);
    const territory = await db.territory.findUniqueOrThrow({ where: { slug } });
    const clamped = Math.min(100, Math.max(0, progress));
    return db.userTerritory.update({
        where: { planetUserId_territoryId: { planetUserId: pu.id, territoryId: territory.id } },
        data: { progress: clamped },
    });
}
export async function getAvailableQuests(userId) {
    const db = getPrisma();
    const pu = await getPlanetUser(userId);
    const quests = await db.quest.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        include: { userQuests: { where: { planetUserId: pu.id } } },
    });
    return quests.map((q) => {
        const uq = q.userQuests[0];
        return {
            id: q.id, title: q.title, description: q.description, type: q.type,
            xpReward: q.xpReward, territoryId: q.territoryId,
            status: uq?.status ?? null, userProgress: uq?.progress ?? 0,
            completedAt: uq?.completedAt ?? null,
        };
    });
}
export async function startQuest(userId, questId) {
    const db = getPrisma();
    const pu = await getPlanetUser(userId);
    await db.quest.findUniqueOrThrow({ where: { id: questId } });
    const existing = await db.userQuest.findUnique({
        where: { planetUserId_questId: { planetUserId: pu.id, questId } },
    });
    if (existing)
        throw new Error("Quest already started");
    return db.userQuest.create({
        data: { planetUserId: pu.id, questId, status: "IN_PROGRESS" },
    });
}
export async function completeQuest(userId, questId) {
    const db = getPrisma();
    const pu = await getPlanetUser(userId);
    const quest = await db.quest.findUniqueOrThrow({ where: { id: questId } });
    const uq = await db.userQuest.findUnique({
        where: { planetUserId_questId: { planetUserId: pu.id, questId } },
    });
    if (!uq)
        throw new Error("Quest not started");
    if (uq.status === "COMPLETED")
        throw new Error("Quest already completed");
    await db.userQuest.update({
        where: { planetUserId_questId: { planetUserId: pu.id, questId } },
        data: { status: "COMPLETED", progress: 100, completedAt: new Date() },
    });
    const result = await awardXp(userId, quest.xpReward, `Quest completed: ${quest.title}`);
    return { quest, xpAwarded: quest.xpReward, ...result };
}
export async function updateQuestProgress(userId, questId, progress) {
    const db = getPrisma();
    const pu = await getPlanetUser(userId);
    const clamped = Math.min(100, Math.max(0, progress));
    return db.userQuest.update({
        where: { planetUserId_questId: { planetUserId: pu.id, questId } },
        data: { progress: clamped },
    });
}
export async function getLeaderboard(limit = 50) {
    const db = getPrisma();
    return db.leaderboard.findMany({
        orderBy: { xp: "desc" },
        take: limit,
    });
}
export async function getUserRank(userId) {
    const db = getPrisma();
    const entry = await db.leaderboard.findUnique({ where: { userId } });
    if (!entry)
        return { rank: null, xp: 0 };
    const above = await db.leaderboard.count({ where: { xp: { gt: entry.xp } } });
    return { rank: above + 1, xp: entry.xp };
}
export async function seedPlanetEngine() {
    const db = getPrisma();
    const territories = [
        { name: "Onboarding Valley", slug: "onboarding", description: "Your first steps in AEVION", xpReward: 100, icon: null, order: 0 },
        { name: "Content Peaks", slug: "content-creation", description: "Master content creation tools", xpReward: 200, icon: null, order: 1 },
        { name: "Social Hub", slug: "social-hub", description: "Connect and collaborate", xpReward: 200, icon: null, order: 2 },
        { name: "Analytics Ocean", slug: "analytics", description: "Deep-dive into data", xpReward: 300, icon: null, order: 3 },
        { name: "Marketplace District", slug: "marketplace", description: "Trade and monetize", xpReward: 400, icon: null, order: 4 },
        { name: "AI Core", slug: "ai-core", description: "Unlock advanced AI features", xpReward: 500, icon: null, order: 5 },
    ];
    for (const t of territories) {
        await db.territory.upsert({ where: { slug: t.slug }, create: t, update: t });
    }
    const onboarding = await db.territory.findUnique({ where: { slug: "onboarding" } });
    const content = await db.territory.findUnique({ where: { slug: "content-creation" } });
    const social = await db.territory.findUnique({ where: { slug: "social-hub" } });
    const analytics = await db.territory.findUnique({ where: { slug: "analytics" } });
    const aicore = await db.territory.findUnique({ where: { slug: "ai-core" } });
    const quests = [
        { title: "Complete your profile", description: "Fill in your bio, avatar and links", type: "ONE_TIME", xpReward: 50, territoryId: onboarding?.id ?? null },
        { title: "First post", description: "Create your first piece of content", type: "DAILY", xpReward: 30, territoryId: content?.id ?? null },
        { title: "React to 5 posts", description: "Like or comment on 5 different posts", type: "DAILY", xpReward: 20, territoryId: social?.id ?? null },
        { title: "Invite a friend", description: "Send an invite link to someone", type: "ONE_TIME", xpReward: 100, territoryId: social?.id ?? null },
        { title: "7-day streak", description: "Log in 7 consecutive days", type: "WEEKLY", xpReward: 150, territoryId: onboarding?.id ?? null },
        { title: "Reach level 5", description: "Accumulate enough XP to reach level 5", type: "STORY", xpReward: 300, territoryId: analytics?.id ?? null },
        { title: "Explore AI Core", description: "Use an AI feature for the first time", type: "STORY", xpReward: 200, territoryId: aicore?.id ?? null },
    ];
    for (const q of quests) {
        const exists = await db.quest.findFirst({ where: { title: q.title } });
        if (!exists)
            await db.quest.create({ data: { ...q, isActive: true } });
    }
    return { territories: territories.length, quests: quests.length };
}
//# sourceMappingURL=planet-engine.js.map