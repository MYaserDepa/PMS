import { z } from 'zod';
import type { PoolClient } from 'pg';
import { allowedLineFields, allowedScorecardFields, type Participant } from '../authorization/policies.js';
import { ApplicationError } from '../errors.js';
import type { WorkflowCommand, WorkflowRow } from '../workflow/workflow-service.js';
import { calculateOverallRating, validateEmployeeSubmission, validateManagerApproval, type FormLine } from './rules.js';

const lineInputSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String).optional(),
  perspective: z.string().nullable().optional(),
  performanceArea: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  linkedStrategyReferenceId: z.union([z.string(), z.number()]).transform(String).nullable().optional(),
  measureDescription: z.string().nullable().optional(),
  target: z.string().nullable().optional(),
  weight: z.number().positive().max(100).nullable().optional(),
  actual: z.string().nullable().optional(),
  midYearStatus: z.enum(['OnTrack', 'AtRisk', 'Blocked']).nullable().optional(),
  midYearComment: z.string().nullable().optional(),
  selfRating: z.number().int().min(1).max(5).nullable().optional(),
  employeeComment: z.string().nullable().optional(),
  managerRating: z.number().int().min(1).max(5).nullable().optional(),
  managerComment: z.string().nullable().optional(),
  employeeEvidenceUrl: z.string().nullable().optional(),
  managerEvidenceUrl: z.string().nullable().optional()
}).strict();

const standardInputSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  employeeComment: z.string().nullable().optional(),
  employeeEvidenceUrl: z.string().nullable().optional(),
  managerRating: z.number().int().min(1).max(5).nullable().optional(),
  managerComment: z.string().nullable().optional(),
  managerEvidenceUrl: z.string().nullable().optional(),
  selfRating: z.never().optional()
}).strict();

export interface FormWorkPayload {
  lines?: unknown[];
  standards?: unknown[];
  employeeDevelopmentNotes?: unknown;
  managerDevelopmentNotes?: unknown;
}

const columnNames: Record<string, string> = {
  perspective: 'perspective', performanceArea: 'performance_area', title: 'title',
  linkedStrategyReferenceId: 'linked_strategy_reference_id', measureDescription: 'measure_description',
  target: 'target', weight: 'weight', actual: 'actual', midYearStatus: 'mid_year_status',
  midYearComment: 'mid_year_comment', selfRating: 'self_rating', employeeComment: 'employee_comment',
  managerRating: 'manager_rating', managerComment: 'manager_comment', employeeEvidenceUrl: 'employee_evidence_url',
  managerEvidenceUrl: 'manager_evidence_url'
};

export class FormService {
  async process(client: PoolClient, row: WorkflowRow, action: WorkflowCommand, payload: FormWorkPayload): Promise<void> {
    const participant = row.pending_participant as Participant;
    if (payload.lines !== undefined) await this.saveLines(client, row, participant, payload.lines);
    if (payload.standards !== undefined) await this.saveStandards(client, row, participant, payload.standards);
    await this.saveDevelopment(client, row, participant, payload);

    if ((action === 'Initiated' || action === 'Resubmitted') && participant === 'Employee') {
      const rows = await this.validationRows(client, row);
      validateEmployeeSubmission(row.form_type, row.current_phase, rows);
    }
    if (action === 'Approved' && participant === 'LineManager') {
      const rows = await this.validationRows(client, row);
      validateManagerApproval(row.form_type, row.current_phase, rows);
      if (row.current_phase === 'YearEnd') {
        const overall = calculateOverallRating(rows.map((item) => ({ weight: item.weight ?? 0, managerRating: item.managerRating ?? null })));
        if (overall === null) throw new ApplicationError('Every required manager rating is needed for OverallRating', 422, 'INCOMPLETE_MANAGER_RATINGS');
        await client.query('UPDATE scorecards SET overall_rating = $2 WHERE id = $1', [row.id, overall]);
      }
    }
  }

  private async saveLines(client: PoolClient, row: WorkflowRow, participant: Participant, rawLines: unknown[]): Promise<void> {
    if (row.form_type === 'AdministrativeSupport') throw new ApplicationError('This form uses fixed standards, not KPI lines', 400, 'WRONG_FORM_PAYLOAD');
    const lines = rawLines.map((line) => lineInputSchema.parse(line));
    const allowed = allowedLineFields(row.form_type, row.current_phase, participant);
    for (const line of lines) {
      for (const key of Object.keys(line)) {
        if (key !== 'id' && !allowed.has(key)) throw new ApplicationError(`Field ${key} is not owned by the current participant`, 403, 'FIELD_NOT_OWNED');
      }
    }

    if (participant === 'Employee' && (row.current_phase === 'GoalSetting' || row.current_phase === 'MidYear')) {
      await client.query('DELETE FROM scorecard_lines WHERE scorecard_id = $1', [row.id]);
      for (const [index, line] of lines.entries()) {
        await client.query(
          `INSERT INTO scorecard_lines (
             scorecard_id, display_order, linked_strategy_reference_id, perspective, performance_area,
             title, measure_description, target, weight, mid_year_status, mid_year_comment
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [row.id, index + 1, line.linkedStrategyReferenceId ?? null, line.perspective ?? null, line.performanceArea ?? null,
            line.title ?? null, line.measureDescription ?? null, line.target ?? null, line.weight ?? null,
            line.midYearStatus ?? null, line.midYearComment ?? null]
        );
      }
      return;
    }
    await this.updateOwnedLines(client, row.id, lines, allowed);
  }

  private async updateOwnedLines(client: PoolClient, scorecardId: string, lines: Array<z.infer<typeof lineInputSchema>>, allowed: ReadonlySet<string>) {
    for (const line of lines) {
      if (!line.id) throw new ApplicationError('Existing line ID is required', 400, 'LINE_ID_REQUIRED');
      const existing = await client.query('SELECT 1 FROM scorecard_lines WHERE id = $1 AND scorecard_id = $2', [line.id, scorecardId]);
      if (!existing.rowCount) throw new ApplicationError('Scorecard line was not found', 404, 'LINE_NOT_FOUND');
      const fields = Object.keys(line).filter((key) => key !== 'id' && allowed.has(key));
      if (fields.length === 0) continue;
      const assignments = fields.map((key, index) => `${columnNames[key]} = $${index + 3}`).join(', ');
      await client.query(`UPDATE scorecard_lines SET ${assignments} WHERE id = $1 AND scorecard_id = $2`, [
        line.id, scorecardId, ...fields.map((key) => line[key as keyof typeof line] ?? null)
      ]);
    }
  }

  private async saveStandards(client: PoolClient, row: WorkflowRow, participant: Participant, rawStandards: unknown[]) {
    if (row.form_type !== 'AdministrativeSupport') throw new ApplicationError('This form uses KPI lines, not fixed standards', 400, 'WRONG_FORM_PAYLOAD');
    if (row.current_phase !== 'YearEnd' && row.current_phase !== 'MidYear') {
      throw new ApplicationError('Standards are not editable in this phase', 403, 'FIELD_NOT_OWNED');
    }
    const standards = rawStandards.map((standard) => standardInputSchema.parse(standard));
    const allowed = allowedLineFields(row.form_type, row.current_phase, participant);
    for (const standard of standards) {
      const fields = Object.keys(standard).filter((key) => key !== 'id');
      if (fields.some((key) => !allowed.has(key))) throw new ApplicationError('A standard field is not owned by the current participant', 403, 'FIELD_NOT_OWNED');
      const existing = await client.query('SELECT 1 FROM admin_standards WHERE id = $1 AND scorecard_id = $2', [standard.id, row.id]);
      if (!existing.rowCount) throw new ApplicationError('Administrative standard was not found', 404, 'STANDARD_NOT_FOUND');
      if (fields.length === 0) continue;
      const assignments = fields.map((key, index) => `${columnNames[key]} = $${index + 3}`).join(', ');
      await client.query(`UPDATE admin_standards SET ${assignments} WHERE id = $1 AND scorecard_id = $2`, [
        standard.id, row.id, ...fields.map((key) => standard[key as keyof typeof standard] ?? null)
      ]);
    }
  }

  private async saveDevelopment(client: PoolClient, row: WorkflowRow, participant: Participant, payload: FormWorkPayload) {
    for (const key of ['employeeDevelopmentNotes', 'managerDevelopmentNotes'] as const) {
      if (payload[key] === undefined) continue;
      if (!allowedScorecardFields(row.current_phase, participant).has(key)) {
        throw new ApplicationError(`Field ${key} is not owned by the current participant`, 403, 'FIELD_NOT_OWNED');
      }
      const value = z.string().nullable().parse(payload[key]);
      const column = key === 'employeeDevelopmentNotes' ? 'employee_development_notes' : 'manager_development_notes';
      await client.query(`UPDATE scorecards SET ${column} = $2 WHERE id = $1`, [row.id, value]);
    }
  }

  private async validationRows(client: PoolClient, row: WorkflowRow): Promise<FormLine[]> {
    if (row.form_type === 'AdministrativeSupport') {
      const result = await client.query(
        `SELECT weight::float8 AS weight, employee_comment AS "employeeComment", manager_rating AS "managerRating",
           manager_comment AS "managerComment", employee_evidence_url AS "employeeEvidenceUrl",
           manager_evidence_url AS "managerEvidenceUrl"
         FROM admin_standards WHERE scorecard_id = $1 ORDER BY display_order`, [row.id]
      );
      return result.rows;
    }
    const result = await client.query<FormLine>(
      `SELECT id, perspective, performance_area AS "performanceArea", title,
         linked_strategy_reference_id AS "linkedStrategyReferenceId", measure_description AS "measureDescription",
         target, weight::float8 AS weight, actual, mid_year_status AS "midYearStatus", mid_year_comment AS "midYearComment",
         self_rating AS "selfRating", employee_comment AS "employeeComment", manager_rating AS "managerRating",
         manager_comment AS "managerComment", employee_evidence_url AS "employeeEvidenceUrl",
         manager_evidence_url AS "managerEvidenceUrl"
       FROM scorecard_lines WHERE scorecard_id = $1 ORDER BY display_order`, [row.id]
    );
    return result.rows;
  }
}
