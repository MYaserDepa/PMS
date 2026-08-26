CREATE TYPE performance_phase AS ENUM ('GoalSetting', 'MidYear', 'YearEnd', 'Development', 'Closed');
CREATE TYPE cycle_status AS ENUM ('Active', 'Closed');
CREATE TYPE form_type AS ENUM (
  'DUGLeadership',
  'KBULeadership',
  'DepartmentHeadKPI',
  'ProjectDeliveryProfessionalKPI',
  'AdministrativeSupport'
);
CREATE TYPE role_category AS ENUM ('ProjectDeliveryProfessional', 'AdministrativeSupport');
CREATE TYPE submission_status AS ENUM ('NotStarted', 'InProgress', 'PendingApproval', 'FullyApproved', 'Closed');
CREATE TYPE phase_status AS ENUM ('NotStarted', 'InProgress', 'PendingApproval', 'FullyApproved', 'Closed');
CREATE TYPE workflow_step_status AS ENUM ('NotStarted', 'Pending', 'Approved', 'Rejected');
CREATE TYPE workflow_action AS ENUM (
  'Created',
  'SavedDraft',
  'Initiated',
  'Approved',
  'Rejected',
  'Resubmitted',
  'PhaseOpened',
  'PhaseClosed',
  'Closed'
);
CREATE TYPE participant_type AS ENUM ('Employee', 'LineManager');
CREATE TYPE mid_year_status AS ENUM ('OnTrack', 'AtRisk', 'Blocked');

CREATE TABLE performance_cycles (
  id BIGSERIAL PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE CHECK (year = 2027),
  name TEXT NOT NULL,
  status cycle_status NOT NULL,
  current_phase performance_phase NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX one_active_performance_cycle ON performance_cycles (status) WHERE status = 'Active';

CREATE TABLE form_definitions (
  form_type form_type PRIMARY KEY,
  display_name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL UNIQUE CHECK (display_order BETWEEN 1 AND 5)
);

CREATE TABLE rating_labels (
  rating INTEGER PRIMARY KEY CHECK (rating BETWEEN 1 AND 5),
  label TEXT NOT NULL UNIQUE,
  meaning TEXT NOT NULL
);

CREATE TABLE role_category_mappings (
  employee_number TEXT PRIMARY KEY CHECK (employee_number <> ''),
  role_category role_category NOT NULL,
  department TEXT NOT NULL CHECK (department <> ''),
  updated_by_employee_number TEXT NOT NULL CHECK (updated_by_employee_number <> ''),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE strategy_references (
  id BIGSERIAL PRIMARY KEY,
  year INTEGER NOT NULL CHECK (year = 2027),
  level TEXT NOT NULL CHECK (level <> ''),
  title TEXT NOT NULL CHECK (title <> ''),
  description TEXT,
  measure TEXT,
  target TEXT,
  weight NUMERIC(7, 3) CHECK (weight > 0 AND weight <= 100),
  parent_strategy_reference_id BIGINT REFERENCES strategy_references(id),
  display_order INTEGER NOT NULL CHECK (display_order > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (year, level, title)
);

CREATE TABLE admin_standard_templates (
  id BIGSERIAL PRIMARY KEY,
  standard_name TEXT NOT NULL UNIQUE,
  expected_standard TEXT NOT NULL,
  weight NUMERIC(7, 3) NOT NULL CHECK (weight > 0 AND weight <= 100),
  display_order INTEGER NOT NULL UNIQUE CHECK (display_order BETWEEN 1 AND 6)
);

CREATE TABLE employee_snapshots (
  id BIGSERIAL PRIMARY KEY,
  employee_number TEXT NOT NULL CHECK (employee_number <> ''),
  first_name TEXT,
  last_name TEXT,
  full_name TEXT NOT NULL CHECK (full_name <> ''),
  email_address TEXT,
  department TEXT NOT NULL CHECK (department <> ''),
  job TEXT,
  position TEXT,
  position_name TEXT,
  grade NUMERIC(5, 2) NOT NULL,
  employer TEXT,
  supervisor_number TEXT NOT NULL CHECK (supervisor_number <> ''),
  supervisor_name TEXT NOT NULL CHECK (supervisor_name <> ''),
  department_head_at_creation BOOLEAN,
  role_category_at_creation role_category,
  resolved_form_type form_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scorecards (
  id BIGSERIAL PRIMARY KEY,
  employee_snapshot_id BIGINT NOT NULL UNIQUE REFERENCES employee_snapshots(id),
  performance_cycle_id BIGINT NOT NULL REFERENCES performance_cycles(id),
  employee_number TEXT NOT NULL CHECK (employee_number <> ''),
  year INTEGER NOT NULL CHECK (year = 2027),
  form_type form_type NOT NULL,
  current_phase performance_phase NOT NULL,
  status submission_status NOT NULL,
  current_workflow_assignee_employee_number TEXT,
  weight_total NUMERIC(7, 3) NOT NULL DEFAULT 0 CHECK (weight_total >= 0 AND weight_total <= 100),
  overall_rating NUMERIC(3, 1) CHECK (overall_rating BETWEEN 1 AND 5),
  employee_development_notes TEXT,
  manager_development_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMPTZ,
  UNIQUE (employee_number, year),
  CHECK ((status = 'Closed' AND closed_at IS NOT NULL) OR (status <> 'Closed' AND closed_at IS NULL))
);

CREATE TABLE scorecard_lines (
  id BIGSERIAL PRIMARY KEY,
  scorecard_id BIGINT NOT NULL REFERENCES scorecards(id) ON DELETE CASCADE,
  linked_strategy_reference_id BIGINT REFERENCES strategy_references(id),
  display_order INTEGER NOT NULL CHECK (display_order > 0),
  perspective TEXT,
  performance_area TEXT,
  title TEXT NOT NULL,
  measure_description TEXT,
  target TEXT,
  weight NUMERIC(7, 3) NOT NULL CHECK (weight > 0 AND weight <= 100),
  actual TEXT,
  mid_year_status mid_year_status,
  mid_year_comment TEXT,
  self_rating INTEGER CHECK (self_rating BETWEEN 1 AND 5),
  employee_comment TEXT,
  manager_rating INTEGER CHECK (manager_rating BETWEEN 1 AND 5),
  manager_comment TEXT,
  employee_evidence_url TEXT,
  manager_evidence_url TEXT,
  UNIQUE (scorecard_id, display_order)
);

CREATE TABLE admin_standards (
  id BIGSERIAL PRIMARY KEY,
  scorecard_id BIGINT NOT NULL REFERENCES scorecards(id) ON DELETE CASCADE,
  template_id BIGINT NOT NULL REFERENCES admin_standard_templates(id),
  display_order INTEGER NOT NULL CHECK (display_order BETWEEN 1 AND 6),
  standard_name TEXT NOT NULL,
  expected_standard TEXT NOT NULL,
  weight NUMERIC(7, 3) NOT NULL CHECK (weight > 0 AND weight <= 100),
  employee_comment TEXT,
  manager_rating INTEGER CHECK (manager_rating BETWEEN 1 AND 5),
  manager_comment TEXT,
  employee_evidence_url TEXT,
  manager_evidence_url TEXT,
  UNIQUE (scorecard_id, template_id),
  UNIQUE (scorecard_id, display_order)
);

CREATE TABLE scorecard_phase_states (
  id BIGSERIAL PRIMARY KEY,
  scorecard_id BIGINT NOT NULL REFERENCES scorecards(id) ON DELETE CASCADE,
  phase performance_phase NOT NULL CHECK (phase <> 'Closed'),
  status phase_status NOT NULL,
  pending_participant participant_type,
  requires_resubmission BOOLEAN NOT NULL DEFAULT FALSE,
  opened_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  UNIQUE (scorecard_id, phase),
  CHECK ((status = 'FullyApproved' AND approved_at IS NOT NULL) OR status <> 'FullyApproved')
);

CREATE TABLE workflow_steps (
  id BIGSERIAL PRIMARY KEY,
  scorecard_id BIGINT NOT NULL REFERENCES scorecards(id) ON DELETE CASCADE,
  phase performance_phase NOT NULL CHECK (phase <> 'Closed'),
  step_number INTEGER NOT NULL CHECK (step_number IN (1, 2)),
  step_name participant_type NOT NULL,
  assigned_employee_number TEXT NOT NULL CHECK (assigned_employee_number <> ''),
  status workflow_step_status NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (scorecard_id, phase, step_number),
  CHECK ((step_number = 1 AND step_name = 'Employee') OR (step_number = 2 AND step_name = 'LineManager'))
);

CREATE TABLE workflow_history (
  id BIGSERIAL PRIMARY KEY,
  scorecard_id BIGINT NOT NULL REFERENCES scorecards(id) ON DELETE RESTRICT,
  phase performance_phase NOT NULL,
  action workflow_action NOT NULL,
  action_by_employee_number TEXT NOT NULL CHECK (action_by_employee_number <> ''),
  comment TEXT,
  action_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  from_participant participant_type,
  to_participant participant_type
);

CREATE INDEX employee_snapshots_department_idx ON employee_snapshots (department);
CREATE INDEX employee_snapshots_supervisor_idx ON employee_snapshots (supervisor_number);
CREATE INDEX scorecards_assignee_idx ON scorecards (current_workflow_assignee_employee_number);
CREATE INDEX workflow_history_scorecard_order_idx ON workflow_history (scorecard_id, action_at, id);

CREATE FUNCTION prevent_workflow_history_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'workflow history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_history_no_update_or_delete
BEFORE UPDATE OR DELETE ON workflow_history
FOR EACH ROW EXECUTE FUNCTION prevent_workflow_history_mutation();

-- migrate:down
DROP TRIGGER IF EXISTS workflow_history_no_update_or_delete ON workflow_history;
DROP FUNCTION IF EXISTS prevent_workflow_history_mutation();
DROP TABLE IF EXISTS workflow_history;
DROP TABLE IF EXISTS workflow_steps;
DROP TABLE IF EXISTS scorecard_phase_states;
DROP TABLE IF EXISTS admin_standards;
DROP TABLE IF EXISTS scorecard_lines;
DROP TABLE IF EXISTS scorecards;
DROP TABLE IF EXISTS employee_snapshots;
DROP TABLE IF EXISTS admin_standard_templates;
DROP TABLE IF EXISTS strategy_references;
DROP TABLE IF EXISTS role_category_mappings;
DROP TABLE IF EXISTS rating_labels;
DROP TABLE IF EXISTS form_definitions;
DROP TABLE IF EXISTS performance_cycles;
DROP TYPE IF EXISTS mid_year_status;
DROP TYPE IF EXISTS participant_type;
DROP TYPE IF EXISTS workflow_action;
DROP TYPE IF EXISTS workflow_step_status;
DROP TYPE IF EXISTS phase_status;
DROP TYPE IF EXISTS submission_status;
DROP TYPE IF EXISTS role_category;
DROP TYPE IF EXISTS form_type;
DROP TYPE IF EXISTS cycle_status;
DROP TYPE IF EXISTS performance_phase;
