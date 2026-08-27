-- Receipt template + style options, and per-purpose printer config that also
-- applies in retail mode (label printer). Single-row business_settings table.
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS receipt_template     TEXT NOT NULL DEFAULT 'classic'
    CHECK (receipt_template IN ('classic','compact','modern','detailed','minimal')),
  ADD COLUMN IF NOT EXISTS receipt_paper_width  TEXT NOT NULL DEFAULT '80mm'
    CHECK (receipt_paper_width IN ('58mm','80mm')),
  ADD COLUMN IF NOT EXISTS receipt_font_size    TEXT NOT NULL DEFAULT 'medium'
    CHECK (receipt_font_size IN ('small','medium','large')),
  ADD COLUMN IF NOT EXISTS receipt_show_logo    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_tax_id  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_cashier BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_barcode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_auto_print   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS label_printer_name   TEXT;
