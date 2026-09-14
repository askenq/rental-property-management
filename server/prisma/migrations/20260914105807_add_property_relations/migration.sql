/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `Property` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Property" DROP COLUMN "updatedAt",
ALTER COLUMN "rent" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Property_ownerId_idx" ON "Property"("ownerId");
