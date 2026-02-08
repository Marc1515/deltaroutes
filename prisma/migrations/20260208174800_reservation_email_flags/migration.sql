-- CreateEnum
CREATE TYPE "ReservationCreatedEmailKind" AS ENUM ('HOLD', 'WAITING');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "confirmedEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "createdEmailKind" "ReservationCreatedEmailKind",
ADD COLUMN     "createdEmailSentAt" TIMESTAMP(3);
