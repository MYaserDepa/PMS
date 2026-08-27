DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM strategy_references WHERE weight IS NOT NULL AND weight <> TRUNC(weight)
    UNION ALL
    SELECT 1 FROM admin_standard_templates WHERE weight <> TRUNC(weight)
    UNION ALL
    SELECT 1 FROM scorecard_lines WHERE weight IS NOT NULL AND weight <> TRUNC(weight)
    UNION ALL
    SELECT 1 FROM admin_standards WHERE weight <> TRUNC(weight)
    UNION ALL
    SELECT 1 FROM scorecards WHERE weight_total <> TRUNC(weight_total)
  ) THEN
    RAISE EXCEPTION 'Cannot convert fractional weights to integers';
  END IF;
END $$;

ALTER TABLE strategy_references ALTER COLUMN weight TYPE INTEGER USING weight::INTEGER;
ALTER TABLE admin_standard_templates ALTER COLUMN weight TYPE INTEGER USING weight::INTEGER;
ALTER TABLE scorecard_lines ALTER COLUMN weight TYPE INTEGER USING weight::INTEGER;
ALTER TABLE admin_standards ALTER COLUMN weight TYPE INTEGER USING weight::INTEGER;
ALTER TABLE scorecards ALTER COLUMN weight_total TYPE INTEGER USING weight_total::INTEGER;

-- migrate:down
ALTER TABLE strategy_references ALTER COLUMN weight TYPE NUMERIC(7, 3) USING weight::NUMERIC(7, 3);
ALTER TABLE admin_standard_templates ALTER COLUMN weight TYPE NUMERIC(7, 3) USING weight::NUMERIC(7, 3);
ALTER TABLE scorecard_lines ALTER COLUMN weight TYPE NUMERIC(7, 3) USING weight::NUMERIC(7, 3);
ALTER TABLE admin_standards ALTER COLUMN weight TYPE NUMERIC(7, 3) USING weight::NUMERIC(7, 3);
ALTER TABLE scorecards ALTER COLUMN weight_total TYPE NUMERIC(7, 3) USING weight_total::NUMERIC(7, 3);
