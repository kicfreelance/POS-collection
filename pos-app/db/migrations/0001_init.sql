CREATE TABLE IF NOT EXISTS system_info (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO system_info (key, value)
VALUES ('schema_version', '1')
ON CONFLICT (key) DO NOTHING;
