import type { CurrentUser } from '../auth/service.js';
import { canViewScorecard, type ScorecardAccessRecord } from '../authorization/policies.js';
import { ApplicationError } from '../errors.js';
import { getPool } from '../database/pool.js';

interface ScorecardRow {
  id: string;
  full_name: string;
  form_type: string;
  current_phase: string;
  pending_participant: string | null;
  overall_rating: string | null;
  employee_number: string;
  supervisor_number: string;
  department: string;
  current_workflow_assignee_employee_number: string | null;
  current_assignee_name: string | null;
  status: string;
  employee_development_notes: string | null;
  manager_development_notes: string | null;
}

const scorecardSelect = `
  SELECT s.id, s.employee_number, e.full_name, e.department, e.supervisor_number, s.form_type,
    s.current_phase, s.status, s.current_workflow_assignee_employee_number, s.overall_rating,
    s.employee_development_notes, s.manager_development_notes,
    p.pending_participant,
    CASE
      WHEN s.current_workflow_assignee_employee_number = e.employee_number THEN e.full_name
      WHEN s.current_workflow_assignee_employee_number = e.supervisor_number THEN e.supervisor_name
      ELSE NULL
    END AS current_assignee_name
  FROM scorecards s
  JOIN employee_snapshots e ON e.id = s.employee_snapshot_id
  LEFT JOIN scorecard_phase_states p ON p.scorecard_id = s.id AND p.phase = s.current_phase
`;

function accessRecord(row: ScorecardRow): ScorecardAccessRecord {
  return {
    employeeNumber: row.employee_number,
    supervisorNumber: row.supervisor_number,
    department: row.department,
    status: row.status,
    currentAssigneeEmployeeNumber: row.current_workflow_assignee_employee_number
  };
}

export class ScorecardQueryService {
  async list(user: CurrentUser) {
    const result = await getPool().query<ScorecardRow>(`${scorecardSelect} ORDER BY e.full_name`);
    return result.rows.filter((row) => canViewScorecard(user, accessRecord(row))).map((row) => ({
      id: row.id,
      employeeNumber: row.employee_number,
      employeeName: row.full_name,
      department: row.department,
      formType: row.form_type,
      currentPhase: row.current_phase,
      status: row.status,
      currentAssigneeEmployeeNumber: row.current_workflow_assignee_employee_number,
      currentAssigneeName: row.current_assignee_name,
      pendingParticipant: row.pending_participant,
      overallRating: row.overall_rating === null ? null : Number(row.overall_rating)
    }));
  }

  async detail(user: CurrentUser, id: string) {
    const result = await getPool().query<ScorecardRow>(`${scorecardSelect} WHERE s.id = $1`, [id]);
    const row = result.rows[0];
    if (!row) throw new ApplicationError('Scorecard was not found', 404, 'SCORECARD_NOT_FOUND');
    if (!canViewScorecard(user, accessRecord(row))) throw new ApplicationError('Scorecard access is forbidden', 403, 'FORBIDDEN');
    const [lines, standards, phases, steps, history] = await Promise.all([
      getPool().query('SELECT * FROM scorecard_lines WHERE scorecard_id = $1 ORDER BY display_order', [id]),
      getPool().query('SELECT * FROM admin_standards WHERE scorecard_id = $1 ORDER BY display_order', [id]),
      getPool().query('SELECT * FROM scorecard_phase_states WHERE scorecard_id = $1 ORDER BY id', [id]),
      getPool().query('SELECT * FROM workflow_steps WHERE scorecard_id = $1 ORDER BY phase, step_number', [id]),
      getPool().query('SELECT * FROM workflow_history WHERE scorecard_id = $1 ORDER BY action_at, id', [id])
    ]);
    const visibleLines = lines.rows.map((item) => ({ ...item }));
    const visibleStandards = standards.rows.map((item) => ({ ...item }));
    if (row.current_phase === 'YearEnd' && row.pending_participant === 'Employee' && user.employeeNumber !== row.employee_number && !user.isHrAdmin && !user.isItAdmin) {
      for (const item of [...visibleLines, ...visibleStandards]) {
        item.actual = null;
        item.self_rating = null;
        item.employee_comment = null;
        item.employee_evidence_url = null;
      }
    }
    if (row.current_phase === 'YearEnd' && row.pending_participant === 'LineManager' && user.employeeNumber === row.employee_number) {
      for (const item of [...visibleLines, ...visibleStandards]) {
        item.manager_rating = null;
        item.manager_comment = null;
        item.manager_evidence_url = null;
      }
    }
    return {
      ...row,
      lines: visibleLines,
      standards: visibleStandards,
      phaseStates: phases.rows,
      workflowSteps: steps.rows,
      history: history.rows
    };
  }
}
