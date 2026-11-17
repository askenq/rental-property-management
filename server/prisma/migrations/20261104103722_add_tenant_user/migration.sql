ALTER TABLE "Tenant" ADD COLUMN     "userId" INTEGER;

CREATE UNIQUE INDEX "Tenant_userId_key" ON "Tenant"("userId");

ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
