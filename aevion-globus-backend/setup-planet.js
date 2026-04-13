const fs = require('fs');

const engine = import { PrismaClient } from "@prisma/client";
import type { LeaderboardPeriod as LeaderboardPeriodType } from "@prisma/client";
const prisma = new PrismaClient();
const QuestStatusVal = { active: "active", completed: "completed", expired: "expired" };
const LeaderboardPeriodVal = { weekly: "weekly", monthly: "monthly", allTime: "allTime" };
const BASE_XP = 100;
const GROWTH = 1.35;
export function xpForLevel(level) { if (level <= 1) return 0; return Math.floor(BASE_XP * Math.pow(GROWTH, level - 2)); }
export function calcLevel(totalXp) { let level = 1; let remaining = totalXp; while (true) { const needed = xpForLevel(level + 1); if (remaining < needed) return { level, currentXp: remaining, nextLevelXp: needed }; remaining -= needed; level++; } }
export async function awardXp(userId, amount, reason, sourceType, sourceId) { const planetUser = await prisma.planetUser.upsert({ where: { userId }, create: { userId, totalXp: amount, level: 1 }, update: { totalXp: { increment: amount } } }); await prisma.xpLog.create({ data: { userId, amount, reason, sourceType, sourceId } }); const { level } = calcLevel(planetUser.totalXp); if (level !== planetUser.level) { await prisma.planetUser.update({ where: { userId }, data: { level } }); } const periods = [LeaderboardPeriodVal.weekly, LeaderboardPeriodVal.monthly, LeaderboardPeriodVal.allTime]; for (const period of periods) { await prisma.leaderboard.upsert({ where: { userId_period: { userId, period } }, create: { userId, period, xp: amount }, update: { xp: { increment: amount } } }); } const updated = await prisma.planetUser.findUniqueOrThrow({ where: { userId } }); return { ...updated, ...calcLevel(updated.totalXp) }; }


fs.writeFileSync('src/services/planet-engine.ts', engine);
console.log('Done: planet-engine.ts');