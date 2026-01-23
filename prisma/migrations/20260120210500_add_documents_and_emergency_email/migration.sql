ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS emergency_contact_email VARCHAR(255);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_documents'
  ) THEN
    CREATE TABLE tenant_documents (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL,
      company_id UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(100) NOT NULL,
      category VARCHAR(100) NOT NULL,
      size INTEGER NOT NULL,
      url VARCHAR(500) NOT NULL,
      description TEXT,
      tags TEXT[] DEFAULT '{}'::text[],
      expiry_date DATE,
      status VARCHAR(20) DEFAULT 'pending',
      uploaded_by UUID NOT NULL,
      created_at TIMESTAMPTZ(6) DEFAULT now(),
      updated_at TIMESTAMPTZ(6) DEFAULT now(),
      CONSTRAINT tenant_documents_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT tenant_documents_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      CONSTRAINT tenant_documents_uploaded_by_fkey
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tenant_documents'
      AND constraint_name = 'tenant_documents_tenant_id_fkey'
  ) THEN
    ALTER TABLE tenant_documents
      ADD CONSTRAINT tenant_documents_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tenant_documents'
      AND constraint_name = 'tenant_documents_company_id_fkey'
  ) THEN
    ALTER TABLE tenant_documents
      ADD CONSTRAINT tenant_documents_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tenant_documents'
      AND constraint_name = 'tenant_documents_uploaded_by_fkey'
  ) THEN
    ALTER TABLE tenant_documents
      ADD CONSTRAINT tenant_documents_uploaded_by_fkey
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tenant_documents_tenant_id_idx
  ON tenant_documents(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_documents_company_id_idx
  ON tenant_documents(company_id);
