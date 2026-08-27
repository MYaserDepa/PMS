import type { CurrentUser } from '../auth/service.js';
import { ApplicationError } from '../errors.js';
import { inTransaction } from '../database/pool.js';
import { canMutateScorecard } from '../authorization/policies.js';
import type { PoolClient } from 'pg';

export type WorkflowCommand = 'SavedDraft' | 'Initiated' | 'Approved' | 'Rejected' | 'Resubmitted';

export interface WorkflowRow {
  id: string;
  employee_number: string;
  supervisor_number: string;
  department: string;
  current_phase: 'GoalSetting' | 'MidYear' | 'YearEnd' | 'Development';
  form_type: 'DUGLeadership' | 'KBULeadership' | 'DepartmentHeadKPI' | 'ProjectDeliveryProfessionalKPI' | 'AdministrativeSupport';
  scorecard_status: string;
  current_workflow_assignee_employee_number: string | null;
  phase_status: string;
  pending_participant: 'Employee' | 'LineManager' | null;
  requires_resubmission: boolean;
}

export class WorkflowService {
  async command(
    scorecardId: string,
    actor: CurrentUser,
    action: WorkflowCommand,
    comment?: string,
    mutation?: (client: PoolClient, row: WorkflowRow) => Promise<void>
  ): Promise<void> {
    await inTransaction(async (client) => {
      const loaded = await client.query<WorkflowRow>(
        `SELECT s.id, s.employee_number, e.supervisor_number, e.department, s.current_phase, s.form_type,
           s.status AS scorecard_status, s.current_workflow_assignee_employee_number,
           p.status AS phase_status, p.pending_participant, p.requires_resubmission
         FROM scorecards s
         JOIN employee_snapshots e ON e.id = s.employee_snapshot_id
         JOIN scorecard_phase_states p ON p.scorecard_id = s.id AND p.phase = s.current_phase
         WHERE s.id = $1 FOR UPDATE OF s, p`,
        [scorecardId]
      );
      const row = loaded.rows[0];
      if (!row) {
        const scorecard = await client.query<{ status: string }>('SELECT status FROM scorecards WHERE id = $1 FOR UPDATE', [scorecardId]);
        if (scorecard.rows[0]?.status === 'Closed') throw new ApplicationError('Closed scorecards are immutable', 409, 'SCORECARD_CLOSED');
        throw new ApplicationError('Scorecard was not found', 404, 'SCORECARD_NOT_FOUND');
      }
      if (!canMutateScorecard(actor, {
        employeeNumber: row.employee_number,
        supervisorNumber: row.supervisor_number,
        department: row.department,
        status: row.scorecard_status,
        currentAssigneeEmployeeNumber: row.current_workflow_assignee_employee_number
      })) throw new ApplicationError('The scorecard is not pending with this participant', 409, 'NOT_CURRENT_PARTICIPANT');

      const participant = row.pending_participant;
      if (!participant) throw new ApplicationError('The phase has no pending participant', 409, 'PHASE_NOT_PENDING');
      if (mutation) await mutation(client, row);

      if (action === 'SavedDraft') {
        if (participant === 'Employee' && (row.phase_status === 'NotStarted' || row.phase_status === 'InProgress')) {
          await client.query("UPDATE scorecard_phase_states SET status = 'InProgress' WHERE scorecard_id = $1 AND phase = $2", [scorecardId, row.current_phase]);
          await client.query("UPDATE scorecards SET status = 'InProgress' WHERE id = $1", [scorecardId]);
        } else if (participant !== 'LineManager' || row.phase_status !== 'PendingApproval') {
          throw new ApplicationError('Save as Draft is invalid in the current workflow state', 409, 'INVALID_WORKFLOW_ACTION');
        }
        await this.history(client, row, action, actor, comment, participant, participant);
        return;
      }

      if (action === 'Initiated') {
        if (participant !== 'Employee' || row.requires_resubmission || !['NotStarted', 'InProgress'].includes(row.phase_status)) {
          throw new ApplicationError('Initiate is invalid in the current workflow state', 409, 'INVALID_WORKFLOW_ACTION');
        }
        await this.toManager(client, row, action, actor, comment);
        return;
      }

      if (action === 'Resubmitted') {
        if (participant !== 'Employee' || !row.requires_resubmission || row.phase_status !== 'InProgress') {
          throw new ApplicationError('Resubmit is invalid in the current workflow state', 409, 'INVALID_WORKFLOW_ACTION');
        }
        await this.toManager(client, row, action, actor, comment);
        return;
      }

      if (action === 'Rejected') {
        if (participant !== 'LineManager' || row.phase_status !== 'PendingApproval') {
          throw new ApplicationError('Reject is invalid in the current workflow state', 409, 'INVALID_WORKFLOW_ACTION');
        }
        await client.query(
          `UPDATE scorecard_phase_states SET status = 'InProgress', pending_participant = 'Employee', requires_resubmission = TRUE
           WHERE scorecard_id = $1 AND phase = $2`, [scorecardId, row.current_phase]
        );
        await client.query(
          `UPDATE workflow_steps SET status = CASE WHEN step_number = 1 THEN 'Pending'::workflow_step_status ELSE 'Rejected'::workflow_step_status END,
             started_at = CASE WHEN step_number = 1 THEN CURRENT_TIMESTAMP ELSE started_at END,
             completed_at = CASE WHEN step_number = 2 THEN CURRENT_TIMESTAMP ELSE NULL END
           WHERE scorecard_id = $1 AND phase = $2`, [scorecardId, row.current_phase]
        );
        await client.query(
          "UPDATE scorecards SET status = 'InProgress', current_workflow_assignee_employee_number = employee_number WHERE id = $1",
          [scorecardId]
        );
        await this.history(client, row, action, actor, comment, 'LineManager', 'Employee');
        return;
      }

      if (participant !== 'LineManager' || row.phase_status !== 'PendingApproval') {
        throw new ApplicationError('Approve is invalid in the current workflow state', 409, 'INVALID_WORKFLOW_ACTION');
      }
      await client.query(
        `UPDATE scorecard_phase_states SET status = 'FullyApproved', pending_participant = NULL,
           requires_resubmission = FALSE, approved_at = CURRENT_TIMESTAMP
         WHERE scorecard_id = $1 AND phase = $2`, [scorecardId, row.current_phase]
      );
      await client.query(
        `UPDATE workflow_steps SET status = 'Approved', completed_at = CURRENT_TIMESTAMP
         WHERE scorecard_id = $1 AND phase = $2 AND step_number = 2`, [scorecardId, row.current_phase]
      );
      if (row.current_phase === 'Development') {
        await client.query(
          `UPDATE scorecards SET current_phase = 'Closed', status = 'Closed',
             current_workflow_assignee_employee_number = NULL, closed_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [scorecardId]
        );
      } else {
        await client.query(
          "UPDATE scorecards SET status = 'FullyApproved', current_workflow_assignee_employee_number = NULL WHERE id = $1",
          [scorecardId]
        );
      }
      await this.history(client, row, action, actor, comment, 'LineManager', undefined);
      if (row.current_phase === 'Development') {
        await client.query(
          `INSERT INTO workflow_history (scorecard_id, phase, action, action_by_employee_number, action_by_name)
           VALUES ($1, 'Development', 'Closed', $2, $3)`, [row.id, actor.employeeNumber, actor.fullName]
        );
      }
    });
  }

  private async toManager(
    client: PoolClient,
    row: WorkflowRow,
    action: WorkflowCommand,
    actor: Pick<CurrentUser, 'employeeNumber' | 'fullName'>,
    comment?: string
  ) {
    await client.query(
      `UPDATE scorecard_phase_states SET status = 'PendingApproval', pending_participant = 'LineManager', requires_resubmission = FALSE
       WHERE scorecard_id = $1 AND phase = $2`, [row.id, row.current_phase]
    );
    await client.query(
      `UPDATE workflow_steps SET
         status = CASE WHEN step_number = 1 THEN 'Approved'::workflow_step_status ELSE 'Pending'::workflow_step_status END,
         completed_at = CASE WHEN step_number = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
         started_at = CASE WHEN step_number = 2 THEN CURRENT_TIMESTAMP ELSE started_at END
       WHERE scorecard_id = $1 AND phase = $2`, [row.id, row.current_phase]
    );
    await client.query(
      "UPDATE scorecards SET status = 'PendingApproval', current_workflow_assignee_employee_number = $2 WHERE id = $1",
      [row.id, row.supervisor_number]
    );
    await this.history(client, row, action, actor, comment, 'Employee', 'LineManager');
  }

  private async history(
    client: PoolClient,
    row: WorkflowRow,
    action: WorkflowCommand,
    actor: Pick<CurrentUser, 'employeeNumber' | 'fullName'>,
    comment: string | undefined,
    from: 'Employee' | 'LineManager',
    to: 'Employee' | 'LineManager' | undefined
  ) {
    await client.query(
      `INSERT INTO workflow_history (
         scorecard_id, phase, action, action_by_employee_number, action_by_name, comment, from_participant, to_participant
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [row.id, row.current_phase, action, actor.employeeNumber, actor.fullName, comment ?? null, from, to ?? null]
    );
  }
}
