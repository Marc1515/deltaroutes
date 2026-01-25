/*
  Warnings:

  - You are about to drop the column `extraTourLanguages` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `languageNotes` on the `Reservation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "extraTourLanguages",
DROP COLUMN "languageNotes",
ADD COLUMN     "browserLanguage" "LanguageCode";
