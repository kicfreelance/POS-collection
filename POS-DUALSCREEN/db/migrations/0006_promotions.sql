CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage_off', 'flat_off', 'buy_x_get_y', 'bundle')),
  target_type TEXT NOT NULL CHECK (target_type IN ('product', 'category')),
  target_id UUID NOT NULL,
  value NUMERIC(12, 4),
  buy_quantity INTEGER,
  get_quantity INTEGER,
  get_discount_percent NUMERIC(5, 2),
  bundle_quantity INTEGER,
  bundle_price NUMERIC(12, 2),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  recurring_days_of_week INTEGER[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotions_target ON promotions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
  value NUMERIC(12, 4) NOT NULL,
  min_purchase_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  usage_limit INTEGER,
  times_used INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  batch_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupons_batch ON coupons(batch_label);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id),
  sale_id UUID NOT NULL REFERENCES sales(id),
  discount_amount NUMERIC(12, 2) NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Manual/promotion/coupon discount trail per sale, for the checkout breakdown and reporting.
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES promotions(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS manual_discount_type TEXT CHECK (manual_discount_type IN ('percentage', 'flat'));
ALTER TABLE sales ADD COLUMN IF NOT EXISTS manual_discount_value NUMERIC(12, 4);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS manual_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS manual_discount_approved_by UUID REFERENCES users(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS coupon_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS promotion_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS product_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
