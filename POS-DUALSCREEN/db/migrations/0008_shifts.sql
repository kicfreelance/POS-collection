CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID NOT NULL REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_cash NUMERIC(12, 2) NOT NULL,
  opening_denominations JSONB,
  closing_cash NUMERIC(12, 2),
  closing_denominations JSONB,
  expected_cash NUMERIC(12, 2),
  cash_variance NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shifts_cashier ON shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_shifts_one_open_per_cashier ON shifts (cashier_id) WHERE status = 'open';

ALTER TABLE sales ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id);
CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales(shift_id);

ALTER TABLE sales ADD COLUMN IF NOT EXISTS change_given NUMERIC(12, 2) NOT NULL DEFAULT 0;
