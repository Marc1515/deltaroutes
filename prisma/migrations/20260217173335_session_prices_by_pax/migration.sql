/*
  Warnings:

  - You are about to drop the column `priceCents` on the `Session` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Session" DROP COLUMN "priceCents",
ADD COLUMN     "adultPriceCents" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "minorPriceCents" INTEGER NOT NULL DEFAULT 2500;
