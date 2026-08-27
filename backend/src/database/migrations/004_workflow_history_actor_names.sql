ALTER TABLE workflow_history
  ADD COLUMN action_by_name TEXT;

ALTER TABLE workflow_history DISABLE TRIGGER workflow_history_no_update_or_delete;

UPDATE workflow_history history
SET action_by_name = COALESCE(
  (
    SELECT CASE
      WHEN history.action_by_employee_number = snapshot.employee_number THEN snapshot.full_name
      WHEN history.action_by_employee_number = snapshot.supervisor_number THEN snapshot.supervisor_name
      ELSE NULL
    END
    FROM scorecards scorecard
    JOIN employee_snapshots snapshot ON snapshot.id = scorecard.employee_snapshot_id
    WHERE scorecard.id = history.scorecard_id
  ),
  (
    SELECT snapshot.full_name
    FROM employee_snapshots snapshot
    WHERE snapshot.employee_number = history.action_by_employee_number
    ORDER BY snapshot.created_at DESC, snapshot.id DESC
    LIMIT 1
  ),
  'Name unavailable'
);

ALTER TABLE workflow_history ENABLE TRIGGER workflow_history_no_update_or_delete;

ALTER TABLE workflow_history
  ALTER COLUMN action_by_name SET NOT NULL,
  ADD CONSTRAINT workflow_history_action_by_name_not_blank CHECK (action_by_name <> '');

-- migrate:down
ALTER TABLE workflow_history
  DROP CONSTRAINT workflow_history_action_by_name_not_blank,
  DROP COLUMN action_by_name;
