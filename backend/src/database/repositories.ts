import type { PoolClient } from 'pg';
import type { Queryable } from './pool.js';

export type FormType =
  | 'DUGLeadership'
  | 'KBULeadership'
  | 'DepartmentHeadKPI'
  | 'ProjectDeliveryProfessionalKPI'
  | 'AdministrativeSupport';
export type RoleCategory = 'ProjectDeliveryProfessional' | 'AdministrativeSupport';
export type PerformancePhase = 'GoalSetting' | 'MidYear' | 'YearEnd' | 'Development' | 'Closed';

export interface EmployeeSnapshotInput {
  employeeNumber: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  emailAddress?: string;
  department: string;
  job?: string;
  position?: string;
  positionName?: string;
  grade: number;
  employer?: string;
  supervisorNumber: string;
  supervisorName: string;
  departmentHeadAtCreation?: boolean;
  roleCategoryAtCreation?: RoleCategory;
  resolvedFormType: FormType;
}

export class CycleRepository {
  constructor(private readonly database: Queryable) {}

  async get2027() {
    const result = await this.database.query<{ id: string; year: number; name: string; current_phase: PerformancePhase }>(
      'SELECT id, year, name, current_phase FROM performance_cycles WHERE year = 2027'
    );
    return result.rows[0] ?? null;
  }
}

export class RoleCategoryRepository {
  constructor(private readonly database: Queryable) {}

  async find(employeeNumber: string) {
    const result = await this.database.query<{ employee_number: string; role_category: RoleCategory; department: string }>(
      'SELECT employee_number, role_category, department FROM role_category_mappings WHERE employee_number = $1',
      [employeeNumber]
    );
    return result.rows[0] ?? null;
  }

  async list() {
    const result = await this.database.query<{ employee_number: string; role_category: RoleCategory; department: string }>(
      'SELECT employee_number, role_category, department FROM role_category_mappings ORDER BY employee_number'
    );
    return result.rows;
  }

  async upsert(employeeNumber: string, roleCategory: RoleCategory, department: string, actorEmployeeNumber: string) {
    const result = await this.database.query<{ employee_number: string; role_category: RoleCategory; department: string }>(
      `INSERT INTO role_category_mappings (employee_number, role_category, department, updated_by_employee_number)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (employee_number) DO UPDATE SET
         role_category = EXCLUDED.role_category,
         department = EXCLUDED.department,
         updated_by_employee_number = EXCLUDED.updated_by_employee_number,
         updated_at = CURRENT_TIMESTAMP
       RETURNING employee_number, role_category, department`,
      [employeeNumber, roleCategory, department, actorEmployeeNumber]
    );
    return result.rows[0]!;
  }
}

export class SnapshotRepository {
  constructor(private readonly database: Queryable) {}

  async create(input: EmployeeSnapshotInput): Promise<string> {
    const result = await this.database.query<{ id: string }>(
      `INSERT INTO employee_snapshots (
         employee_number, first_name, last_name, full_name, email_address, department, job, position,
         position_name, grade, employer, supervisor_number, supervisor_name, department_head_at_creation,
         role_category_at_creation, resolved_form_type
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
       ) RETURNING id`,
      [
        input.employeeNumber,
        input.firstName ?? null,
        input.lastName ?? null,
        input.fullName,
        input.emailAddress ?? null,
        input.department,
        input.job ?? null,
        input.position ?? null,
        input.positionName ?? null,
        input.grade,
        input.employer ?? null,
        input.supervisorNumber,
        input.supervisorName,
        input.departmentHeadAtCreation ?? null,
        input.roleCategoryAtCreation ?? null,
        input.resolvedFormType
      ]
    );
    return result.rows[0]!.id;
  }
}

export class ScorecardRepository {
  constructor(private readonly database: Queryable) {}

  async exists(employeeNumber: string): Promise<boolean> {
    const result = await this.database.query('SELECT 1 FROM scorecards WHERE employee_number = $1 AND year = 2027', [employeeNumber]);
    return result.rowCount === 1;
  }

  async create(input: {
    employeeSnapshotId: string;
    cycleId: string;
    employeeNumber: string;
    formType: FormType;
    assigneeEmployeeNumber: string;
  }): Promise<string> {
    const result = await this.database.query<{ id: string }>(
      `INSERT INTO scorecards (
         employee_snapshot_id, performance_cycle_id, employee_number, year, form_type, current_phase,
         status, current_workflow_assignee_employee_number
       ) VALUES ($1, $2, $3, 2027, $4, 'GoalSetting', 'NotStarted', $5) RETURNING id`,
      [input.employeeSnapshotId, input.cycleId, input.employeeNumber, input.formType, input.assigneeEmployeeNumber]
    );
    return result.rows[0]!.id;
  }

  async findById(id: string) {
    const result = await this.database.query('SELECT * FROM scorecards WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }
}

export class ScorecardLineRepository {
  constructor(private readonly database: Queryable) {}

  async list(scorecardId: string) {
    const result = await this.database.query('SELECT * FROM scorecard_lines WHERE scorecard_id = $1 ORDER BY display_order', [scorecardId]);
    return result.rows;
  }
}

export class AdminStandardRepository {
  constructor(private readonly database: Queryable) {}

  async createFromTemplates(scorecardId: string): Promise<void> {
    await this.database.query(
      `INSERT INTO admin_standards (
         scorecard_id, template_id, display_order, standard_name, expected_standard, weight
       ) SELECT $1, id, display_order, standard_name, expected_standard, weight
         FROM admin_standard_templates ORDER BY display_order`,
      [scorecardId]
    );
  }

  async list(scorecardId: string) {
    const result = await this.database.query('SELECT * FROM admin_standards WHERE scorecard_id = $1 ORDER BY display_order', [scorecardId]);
    return result.rows;
  }
}

export class PhaseStateRepository {
  constructor(private readonly database: Queryable) {}

  async createInitial(scorecardId: string): Promise<void> {
    await this.database.query(
      `INSERT INTO scorecard_phase_states (scorecard_id, phase, status, pending_participant, opened_at)
       VALUES ($1, 'GoalSetting', 'NotStarted', 'Employee', CURRENT_TIMESTAMP)`,
      [scorecardId]
    );
  }
}

export class WorkflowStepRepository {
  constructor(private readonly database: Queryable) {}

  async createPhaseSteps(scorecardId: string, phase: PerformancePhase, employeeNumber: string, managerNumber: string): Promise<void> {
    await this.database.query(
      `INSERT INTO workflow_steps (scorecard_id, phase, step_number, step_name, assigned_employee_number, status, started_at)
       VALUES
         ($1, $2, 1, 'Employee', $3, 'Pending', CURRENT_TIMESTAMP),
         ($1, $2, 2, 'LineManager', $4, 'NotStarted', NULL)`,
      [scorecardId, phase, employeeNumber, managerNumber]
    );
  }
}

export class WorkflowHistoryRepository {
  constructor(private readonly database: Queryable) {}

  async append(input: {
    scorecardId: string;
    phase: PerformancePhase;
    action: string;
    actorEmployeeNumber: string;
    comment?: string;
    fromParticipant?: 'Employee' | 'LineManager';
    toParticipant?: 'Employee' | 'LineManager';
  }): Promise<string> {
    const result = await this.database.query<{ id: string }>(
      `INSERT INTO workflow_history (
         scorecard_id, phase, action, action_by_employee_number, comment, from_participant, to_participant
       ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        input.scorecardId,
        input.phase,
        input.action,
        input.actorEmployeeNumber,
        input.comment ?? null,
        input.fromParticipant ?? null,
        input.toParticipant ?? null
      ]
    );
    return result.rows[0]!.id;
  }

  async list(scorecardId: string) {
    const result = await this.database.query(
      'SELECT * FROM workflow_history WHERE scorecard_id = $1 ORDER BY action_at, id',
      [scorecardId]
    );
    return result.rows;
  }
}

export function repositories(database: PoolClient) {
  return {
    cycles: new CycleRepository(database),
    mappings: new RoleCategoryRepository(database),
    snapshots: new SnapshotRepository(database),
    scorecards: new ScorecardRepository(database),
    lines: new ScorecardLineRepository(database),
    standards: new AdminStandardRepository(database),
    phases: new PhaseStateRepository(database),
    steps: new WorkflowStepRepository(database),
    history: new WorkflowHistoryRepository(database)
  };
}
