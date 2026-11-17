ALTER TABLE "Property" DROP COLUMN "updatedAt",
ALTER COLUMN "rent" SET DATA TYPE DOUBLE PRECISION;

ALTER TABLE "User" ADD COLUMN     "password" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE INDEX "Property_ownerId_idx" ON "Property"("ownerId");
