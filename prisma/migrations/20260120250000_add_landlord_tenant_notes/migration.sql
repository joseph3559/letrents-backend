-- CreateTable
CREATE TABLE "landlord_tenant_notes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "company_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "notes" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landlord_tenant_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "landlord_tenant_notes_company_id_tenant_id_key" ON "landlord_tenant_notes"("company_id", "tenant_id");

-- CreateIndex
CREATE INDEX "landlord_tenant_notes_company_id_idx" ON "landlord_tenant_notes"("company_id");

-- CreateIndex
CREATE INDEX "landlord_tenant_notes_tenant_id_idx" ON "landlord_tenant_notes"("tenant_id");

-- AddForeignKey
ALTER TABLE "landlord_tenant_notes" ADD CONSTRAINT "landlord_tenant_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landlord_tenant_notes" ADD CONSTRAINT "landlord_tenant_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
