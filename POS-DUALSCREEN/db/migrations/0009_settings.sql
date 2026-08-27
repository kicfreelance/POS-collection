CREATE TABLE IF NOT EXISTS business_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  business_name TEXT NOT NULL DEFAULT 'My Business',
  logo_url TEXT,
  address TEXT,
  tax_id TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  tax_inclusive_pricing BOOLEAN NOT NULL DEFAULT false,
  receipt_header TEXT,
  receipt_footer TEXT,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  currency_symbol TEXT NOT NULL DEFAULT '$',
  locale TEXT NOT NULL DEFAULT 'en-US',
  costing_method TEXT NOT NULL DEFAULT 'weighted_average' CHECK (costing_method IN ('weighted_average', 'batch_fifo')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO business_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
