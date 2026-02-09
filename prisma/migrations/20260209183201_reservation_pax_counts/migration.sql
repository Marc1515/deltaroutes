-- DropIndex
DROP INDEX "Reservation_sessionId_guideUserId_status_idx";

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "adultsCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "availabilityEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "minorsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalPax" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "tourLanguage" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Reservation_sessionId_status_holdExpiresAt_idx" ON "Reservation"("sessionId", "status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "Reservation_status_availabilityEmailSentAt_idx" ON "Reservation"("status", "availabilityEmailSentAt");

-- CreateIndex
CREATE INDEX "Reservation_guideUserId_status_idx" ON "Reservation"("guideUserId", "status");
