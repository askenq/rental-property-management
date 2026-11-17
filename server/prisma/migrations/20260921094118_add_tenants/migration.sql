CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "Property" ADD COLUMN     "tenantId" INTEGER;

CREATE TABLE "Tenant" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passportSeries" TEXT,
    "passportNumber" TEXT,
    "passportIssuedAt" TIMESTAMP(3),
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" INTEGER NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Tenant_ownerId_idx" ON "Tenant"("ownerId");

CREATE INDEX "Tenant_fullName_idx" ON "Tenant"("fullName");

CREATE INDEX "Property_tenantId_idx" ON "Property"("tenantId");

ALTER TABLE "Property" ADD CONSTRAINT "Property_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
