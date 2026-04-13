-- CreateTable
CREATE TABLE "user_key_pairs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKeyEnc" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'Ed25519',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_key_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'Ed25519',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_key_pairs_userId_key" ON "user_key_pairs"("userId");

-- CreateIndex
CREATE INDEX "signature_records_userId_idx" ON "signature_records"("userId");

-- CreateIndex
CREATE INDEX "signature_records_payloadHash_idx" ON "signature_records"("payloadHash");
