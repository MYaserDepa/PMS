ALTER TABLE scorecard_lines ALTER COLUMN title DROP NOT NULL;
ALTER TABLE scorecard_lines ALTER COLUMN weight DROP NOT NULL;

-- migrate:down
ALTER TABLE scorecard_lines ALTER COLUMN title SET NOT NULL;
ALTER TABLE scorecard_lines ALTER COLUMN weight SET NOT NULL;
