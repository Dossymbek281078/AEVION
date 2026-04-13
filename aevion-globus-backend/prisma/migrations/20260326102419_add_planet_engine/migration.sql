-- CreateEnum
CREATE TYPE "QuestType" AS ENUM ('DAILY', 'WEEKLY', 'ONE_TIME', 'STORY');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LeaderboardPeriod" AS ENUM ('ALL_TIME', 'MONTHLY', 'WEEKLY');

-- DropForeignKey
ALTER TABLE "MediaVote" DROP CONSTRAINT "MediaVote_userId_fkey";

-- CreateTable
CREATE TABLE "planet_users" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planet_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "territories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "xpReward" INTEGER NOT NULL DEFAULT 100,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "territories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_territories" (
    "id" TEXT NOT NULL,
    "planetUserId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_territories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "xpReward" INTEGER NOT NULL DEFAULT 50,
    "type" "QuestType" NOT NULL DEFAULT 'DAILY',
    "territoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_quests" (
    "id" TEXT NOT NULL,
    "planetUserId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" "QuestStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "progress" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_logs" (
    "id" TEXT NOT NULL,
    "planetUserId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "rank" INTEGER,
    "period" "LeaderboardPeriod" NOT NULL DEFAULT 'ALL_TIME',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "planet_users_userId_key" ON "planet_users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "territories_name_key" ON "territories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "territories_slug_key" ON "territories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_territories_planetUserId_territoryId_key" ON "user_territories"("planetUserId", "territoryId");

-- CreateIndex
CREATE UNIQUE INDEX "user_quests_planetUserId_questId_key" ON "user_quests"("planetUserId", "questId");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_userId_key" ON "leaderboard"("userId");

-- CreateIndex
CREATE INDEX "leaderboard_xp_idx" ON "leaderboard"("xp" DESC);

-- AddForeignKey
ALTER TABLE "user_territories" ADD CONSTRAINT "user_territories_planetUserId_fkey" FOREIGN KEY ("planetUserId") REFERENCES "planet_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_territories" ADD CONSTRAINT "user_territories_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_planetUserId_fkey" FOREIGN KEY ("planetUserId") REFERENCES "planet_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_questId_fkey" FOREIGN KEY ("questId") REFERENCES "quests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_logs" ADD CONSTRAINT "xp_logs_planetUserId_fkey" FOREIGN KEY ("planetUserId") REFERENCES "planet_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
