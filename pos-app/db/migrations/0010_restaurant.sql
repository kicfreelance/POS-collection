ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'retail' CHECK (business_type IN ('retail', 'restaurant')),
  ADD COLUMN IF NOT EXISTS receipt_printer_name TEXT,
  ADD COLUMN IF NOT EXISTS kot_printer_name TEXT;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_data_url TEXT;

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS restaurant_order_number_seq START 1;

CREATE TABLE IF NOT EXISTS restaurant_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  order_type TEXT NOT NULL CHECK (order_type IN ('dine_in', 'take_away')),
  table_id UUID REFERENCES restaurant_tables(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'served', 'completed', 'voided')),
  cashier_id UUID NOT NULL REFERENCES users(id),
  shift_id UUID NOT NULL REFERENCES shifts(id),
  customer_id UUID REFERENCES customers(id),
  notes TEXT,
  subtotal NUMERIC(12, 2) NOT NULL,
  product_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  promotion_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL,
  sale_id UUID REFERENCES sales(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  served_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS restaurant_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC(12, 3) NOT NULL,
  unit_code TEXT NOT NULL,
  unit_price NUMERIC(12, 4) NOT NULL,
  line_subtotal NUMERIC(12, 2) NOT NULL,
  line_discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  line_tax NUMERIC(12, 2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12, 2) NOT NULL,
  promotion_id UUID REFERENCES promotions(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_order_item_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES restaurant_order_items(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id),
  quantity NUMERIC(12, 3) NOT NULL,
  cost_price NUMERIC(12, 4) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_status ON restaurant_orders(status);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_table ON restaurant_orders(table_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_order ON restaurant_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_order_item_batches_item ON restaurant_order_item_batches(order_item_id);
