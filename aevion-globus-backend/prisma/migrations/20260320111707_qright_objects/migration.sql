-- CreateTable
CREATE TABLE "QRightObject" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "signature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QRightObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QRightObject_contentHash_key" ON "QRightObject"("contentHash");

-- CreateIndex
CREATE INDEX "QRightObject_contentHash_idx" ON "QRightObject"("contentHash");
