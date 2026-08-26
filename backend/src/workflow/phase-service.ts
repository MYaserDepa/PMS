import type { CurrentUser } from '../auth/service.js';
import { ApplicationError } from '../errors.js';
import { inTransaction } from '../database/pool.js';

const nextPhase = {
  GoalSetting: 'MidYear',
  MidYear: 'YearEnd',
  YearEnd: 'Development',
  Development: 'Closed'
} as const;

export class PhaseService {
  async advance(actor: CurrentUser, expectedCurrentPhase?: string) {
    if (!actor.isHrAdmin) throw new ApplicationError('HR access is required', 403, 'FORBIDDEN');
    return inTransaction(async (client) => {
      const cycleResult = await client.query<{ id: string; current_phase: keyof typeof nextPhase | 'Closed' }>(
        "SELECT id, current_phase FROM performance_cycles WHERE year = 2027 FOR UPDATE"
      );
      const cycle = cycleResult.rows[0];
      if (!cycle) throw new ApplicationError('PMS 2027 cycle is not configured', 500, 'CYCLE_NOT_CONFIGURED');
      if (expectedCurrentPhase && expectedCurrentPhase !== cycle.current_phase) {
        throw new ApplicationError('The phase control is stale', 409, 'STALE_PHASE');
      }
      if (cycle.current_phase === 'Closed') throw new ApplicationError('The cycle is already closed', 409, 'CYCLE_CLOSED');
      const target = nextPhase[cycle.current_phase];
      const incomplete = await client.query(
        `SELECT s.id FROM scorecards s
         JOIN scorecard_phase_states p ON p.scorecard_id = s.id AND p.phase = $1
         WHERE p.status <> 'FullyApproved' LIMIT 1`, [cycle.current_phase]
      );
      if (incomplete.rowCount) throw new ApplicationError('Every scorecard must fully approve the current phase before it can close', 409, 'INCOMPLETE_PHASE');

      if (target === 'Closed') {
        const openScorecard = await client.query("SELECT id FROM scorecards WHERE status <> 'Closed' LIMIT 1");
        if (openScorecard.rowCount) throw new ApplicationError('Every scorecard must close before the cycle can close', 409, 'OPEN_SCORECARDS');
        await client.query("UPDATE performance_cycles SET current_phase = 'Closed', status = 'Closed' WHERE id = $1", [cycle.id]);
        return { previousPhase: cycle.current_phase, currentPhase: target, openedScorecards: 0 };
      }

      const scorecards = await client.query<{ id: string; employee_number: string; supervisor_number: string }>(
        `SELECT s.id, s.employee_number, e.supervisor_number
         FROM scorecards s JOIN employee_snapshots e ON e.id = s.employee_snapshot_id
         ORDER BY s.id FOR UPDATE OF s`
      );
      for (const scorecard of scorecards.rows) {
        await client.query(
          `INSERT INTO workflow_history (scorecard_id, phase, action, action_by_employee_number)
           VALUES ($1, $2, 'PhaseClosed', $3)`, [scorecard.id, cycle.current_phase, actor.employeeNumber]
        );
        await client.query(
          `INSERT INTO scorecard_phase_states (scorecard_id, phase, status, pending_participant, opened_at)
           VALUES ($1, $2, 'NotStarted', 'Employee', CURRENT_TIMESTAMP)`, [scorecard.id, target]
        );
        await client.query(
          `INSERT INTO workflow_steps (scorecard_id, phase, step_number, step_name, assigned_employee_number, status, started_at)
           VALUES ($1, $2, 1, 'Employee', $3, 'Pending', CURRENT_TIMESTAMP),
                  ($1, $2, 2, 'LineManager', $4, 'NotStarted', NULL)`,
          [scorecard.id, target, scorecard.employee_number, scorecard.supervisor_number]
        );
        await client.query(
          `UPDATE scorecards SET current_phase = $2, status = 'NotStarted',
             current_workflow_assignee_employee_number = employee_number WHERE id = $1`, [scorecard.id, target]
        );
        await client.query(
          `INSERT INTO workflow_history (scorecard_id, phase, action, action_by_employee_number, to_participant)
           VALUES ($1, $2, 'PhaseOpened', $3, 'Employee')`, [scorecard.id, target, actor.employeeNumber]
        );
      }
      await client.query('UPDATE performance_cycles SET current_phase = $2 WHERE id = $1', [cycle.id, target]);
      return { previousPhase: cycle.current_phase, currentPhase: target, openedScorecards: scorecards.rowCount ?? 0 };
    });
  }
}
