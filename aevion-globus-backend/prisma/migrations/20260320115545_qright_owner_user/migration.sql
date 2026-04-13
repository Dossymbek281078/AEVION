-- AlterTable
ALTER TABLE "QRightObject" ADD COLUMN     "ownerUserId" TEXT;

-- CreateIndex
CREATE INDEX "QRightObject_ownerUserId_idx" ON "QRightObject"("ownerUserId");
