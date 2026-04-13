-- CreateTable
CREATE TABLE "MediaSubmission" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "qrightObjectId" TEXT,
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaVote" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaSubmission_qrightObjectId_key" ON "MediaSubmission"("qrightObjectId");

-- CreateIndex
CREATE INDEX "MediaSubmission_type_idx" ON "MediaSubmission"("type");

-- CreateIndex
CREATE INDEX "MediaSubmission_ownerUserId_idx" ON "MediaSubmission"("ownerUserId");

-- CreateIndex
CREATE INDEX "MediaSubmission_fileHash_idx" ON "MediaSubmission"("fileHash");

-- CreateIndex
CREATE INDEX "MediaVote_userId_idx" ON "MediaVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaVote_submissionId_userId_key" ON "MediaVote"("submissionId", "userId");

-- AddForeignKey
ALTER TABLE "MediaSubmission" ADD CONSTRAINT "MediaSubmission_qrightObjectId_fkey" FOREIGN KEY ("qrightObjectId") REFERENCES "QRightObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaVote" ADD CONSTRAINT "MediaVote_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "MediaSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaVote" ADD CONSTRAINT "MediaVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
