-- CreateTable
CREATE TABLE "CyberPlayer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CyberPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CyberGame" (
    "id" TEXT NOT NULL,
    "whitePlayerId" TEXT NOT NULL,
    "blackPlayerId" TEXT NOT NULL,
    "fen" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CyberGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CyberMove" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "ply" INTEGER NOT NULL,
    "san" TEXT,
    "uci" TEXT,
    "fenAfter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CyberMove_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CyberGame_whitePlayerId_idx" ON "CyberGame"("whitePlayerId");

-- CreateIndex
CREATE INDEX "CyberGame_blackPlayerId_idx" ON "CyberGame"("blackPlayerId");

-- CreateIndex
CREATE INDEX "CyberMove_gameId_ply_idx" ON "CyberMove"("gameId", "ply");

-- CreateIndex
CREATE UNIQUE INDEX "CyberMove_gameId_ply_key" ON "CyberMove"("gameId", "ply");

-- AddForeignKey
ALTER TABLE "CyberGame" ADD CONSTRAINT "CyberGame_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "CyberPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberGame" ADD CONSTRAINT "CyberGame_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "CyberPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyberMove" ADD CONSTRAINT "CyberMove_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "CyberGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
