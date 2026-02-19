/*
  Warnings:

  - A unique constraint covering the columns `[experienceId,startAt]` on the table `Session` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Session_experienceId_startAt_key" ON "Session"("experienceId", "startAt");
