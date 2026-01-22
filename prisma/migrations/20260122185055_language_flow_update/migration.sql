/*
  Warnings:

  - You are about to drop the column `preferredLanguage` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `primaryLanguage` on the `Reservation` table. All the data in the column will be lost.
  - Added the required column `tourLanguage` to the `Reservation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "preferredLanguage",
DROP COLUMN "primaryLanguage",
ADD COLUMN     "extraTourLanguages" "LanguageCode"[] DEFAULT ARRAY[]::"LanguageCode"[],
ADD COLUMN     "languageNotes" TEXT,
ADD COLUMN     "tourLanguage" "LanguageBase" NOT NULL;
