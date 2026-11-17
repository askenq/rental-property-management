CREATE TYPE "RequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED');

CREATE TYPE "RequestPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TYPE "RequestType" AS ENUM ('REPAIR', 'PLUMBING', 'ELECTRICITY', 'HEATING', 'CLEANING', 'OTHER');

CREATE TABLE "Request" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "RequestType" NOT NULL DEFAULT 'OTHER',
    "status" "RequestStatus" NOT NULL DEFAULT 'NEW',
    "priority" "RequestPriority" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "ownerId" INTEGER NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "tenantId" INTEGER,
    "assignedToId" INTEGER,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Request_ownerId_idx" ON "Request"("ownerId");

CREATE INDEX "Request_propertyId_idx" ON "Request"("propertyId");

CREATE INDEX "Request_tenantId_idx" ON "Request"("tenantId");

CREATE INDEX "Request_assignedToId_idx" ON "Request"("assignedToId");

CREATE INDEX "Request_status_idx" ON "Request"("status");

CREATE INDEX "Request_priority_idx" ON "Request"("priority");

CREATE INDEX "Request_createdAt_idx" ON "Request"("createdAt");

ALTER TABLE "Request" ADD CONSTRAINT "Request_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Request" ADD CONSTRAINT "Request_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Request" ADD CONSTRAINT "Request_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Request" ADD CONSTRAINT "Request_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
