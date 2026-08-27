-- Centimetre as a sub-unit of metre, so length products sold in `m` can also be
-- billed in `cm` (alongside the existing `mm`).
INSERT INTO units (code, name, category) VALUES ('cm', 'Centimetre', 'length')
  ON CONFLICT (code) DO NOTHING;

INSERT INTO unit_conversions (base_unit, sub_unit, factor) VALUES ('m', 'cm', 100)
  ON CONFLICT (base_unit, sub_unit) DO NOTHING;
