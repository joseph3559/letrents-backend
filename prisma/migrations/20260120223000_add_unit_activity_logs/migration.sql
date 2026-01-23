-- Add unit activity logs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'unit_activity_logs'
  ) THEN
    CREATE TABLE unit_activity_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      unit_id UUID NOT NULL,
      company_id UUID NOT NULL,
      actor_id UUID,
      event_type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      metadata JSON NOT NULL DEFAULT '{}'::json,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT unit_activity_logs_unit_id_fkey
        FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
      CONSTRAINT unit_activity_logs_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      CONSTRAINT unit_activity_logs_actor_id_fkey
        FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS unit_activity_logs_unit_id_idx
  ON unit_activity_logs(unit_id);
CREATE INDEX IF NOT EXISTS unit_activity_logs_company_id_idx
  ON unit_activity_logs(company_id);
CREATE INDEX IF NOT EXISTS unit_activity_logs_event_type_idx
  ON unit_activity_logs(event_type);
