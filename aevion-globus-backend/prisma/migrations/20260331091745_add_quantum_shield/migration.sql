-- CreateTable
CREATE TABLE "QRightObject" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "ownerUserId" TEXT,
    "country" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QRightObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuantumShield" (
    "id" TEXT NOT NULL,
    "objectId" TEXT,
    "objectTitle" TEXT,
    "algorithm" TEXT NOT NULL DEFAULT 'Shamir''s Secret Sharing + Ed25519',
    "threshold" INTEGER NOT NULL DEFAULT 2,
    "totalShards" INTEGER NOT NULL DEFAULT 3,
    "shards" TEXT NOT NULL,
    "signature" TEXT,
    "publicKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuantumShield_pkey" PRIMARY KEY ("id")
);
