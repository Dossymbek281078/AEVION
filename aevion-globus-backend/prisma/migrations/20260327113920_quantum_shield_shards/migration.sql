-- CreateTable
CREATE TABLE "signature_shards" (
    "id" TEXT NOT NULL,
    "signatureRecordId" TEXT NOT NULL,
    "shardIndex" INTEGER NOT NULL,
    "shardHolder" TEXT NOT NULL,
    "shardData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_shards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signature_shards_signatureRecordId_idx" ON "signature_shards"("signatureRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "signature_shards_signatureRecordId_shardIndex_key" ON "signature_shards"("signatureRecordId", "shardIndex");
