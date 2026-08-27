import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrateUp } from '../../src/database/migrate.js';
import { closePool, getPool, inTransaction } from '../../src/database/pool.js';
import { repositories } from '../../src/database/repositories.js';
import { seedDatabase } from '../../src/database/seed.js';

beforeAll(async () => {
  await migrateUp();
  await seedDatabase();
});

afterAll(closePool);

describe('migrations and fixed seed configuration', () => {
  it('seeds one active 2027 cycle, exactly five forms, five ratings, and six standards totaling 100', async () => {
    const cycle = await getPool().query("SELECT * FROM performance_cycles WHERE status = 'Active'");
    const forms = await getPool().query('SELECT * FROM form_definitions');
    const ratings = await getPool().query('SELECT * FROM rating_labels');
    const standards = await getPool().query<{ count: string; weight: string }>(
      'SELECT COUNT(*) AS count, SUM(weight)::text AS weight FROM admin_standard_templates'
    );
    expect(cycle.rows).toHaveLength(1);
    expect(cycle.rows[0]).toMatchObject({ year: 2027, name: 'PMS 2027', current_phase: 'GoalSetting' });
    expect(forms.rows).toHaveLength(5);
    expect(ratings.rows.map((row) => row.rating).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(standards.rows[0]).toEqual({ count: '6', weight: '100' });
    const weightColumns = await getPool().query<{ table_name: string; data_type: string }>(
      `SELECT table_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'weight'
         AND table_name IN ('strategy_references', 'admin_standard_templates', 'scorecard_lines', 'admin_standards')
       ORDER BY table_name`
    );
    expect(weightColumns.rows).toHaveLength(4);
    expect(weightColumns.rows.every((column) => column.data_type === 'integer')).toBe(true);
  });

  it('is repeatable without changing seeded row counts', async () => {
    await seedDatabase();
    const result = await getPool().query<{ forms: string; standards: string; strategies: string }>(
      `SELECT
        (SELECT COUNT(*) FROM form_definitions)::text AS forms,
        (SELECT COUNT(*) FROM admin_standard_templates)::text AS standards,
        (SELECT COUNT(*) FROM strategy_references)::text AS strategies`
    );
    expect(result.rows[0]).toEqual({ forms: '5', standards: '6', strategies: '5' });
  });
});

describe('relational constraints and transactional persistence', () => {
  it('creates a complete scorecard graph and rolls it back as one transaction', async () => {
    const employeeNumber = `TX-${process.pid}`;
    await expect(
      inTransaction(async (client) => {
        const store = repositories(client);
        const cycle = await store.cycles.get2027();
        const snapshotId = await store.snapshots.create({
          employeeNumber,
          fullName: 'Transaction Test Employee',
          department: 'Test',
          grade: 17,
          supervisorNumber: 'M-1',
          supervisorName: 'Test Manager',
          roleCategoryAtCreation: 'AdministrativeSupport',
          resolvedFormType: 'AdministrativeSupport'
        });
        const scorecardId = await store.scorecards.create({
          employeeSnapshotId: snapshotId,
          cycleId: cycle!.id,
          employeeNumber,
          formType: 'AdministrativeSupport',
          assigneeEmployeeNumber: employeeNumber
        });
        await store.standards.createFromTemplates(scorecardId);
        await store.phases.createInitial(scorecardId);
        await store.steps.createPhaseSteps(scorecardId, 'GoalSetting', employeeNumber, 'M-1');
        await store.history.append({ scorecardId, phase: 'GoalSetting', action: 'Created', actorEmployeeNumber: '12245' });
        expect(await store.standards.list(scorecardId)).toHaveLength(6);
        throw new Error('expected rollback');
      })
    ).rejects.toThrow('expected rollback');
    const persisted = await getPool().query('SELECT 1 FROM scorecards WHERE employee_number = $1', [employeeNumber]);
    expect(persisted.rowCount).toBe(0);
  });

  it('enforces rating bounds and role category values', async () => {
    await expect(getPool().query("INSERT INTO rating_labels (rating, label, meaning) VALUES (6, 'Invalid', 'Invalid')")).rejects.toMatchObject({ code: '23514' });
    await expect(
      getPool().query(
        "INSERT INTO role_category_mappings (employee_number, role_category, department, updated_by_employee_number) VALUES ('INVALID-RC', 'Other', 'Test', '12245')"
      )
    ).rejects.toMatchObject({ code: '22P02' });
    await expect(
      getPool().query(
        "INSERT INTO workflow_history (scorecard_id, phase, action, action_by_employee_number) VALUES (999999999, 'GoalSetting', 'Created', '12245')"
      )
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      getPool().query(
        "INSERT INTO admin_standard_templates (standard_name, expected_standard, weight, display_order) VALUES ('Invalid Weight', 'Invalid', 0, 99)"
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('blocks duplicate employee-year scorecards and keeps history append-only', async () => {
    await inTransaction(async (client) => {
      const store = repositories(client);
      const cycle = await store.cycles.get2027();
      const employeeNumber = `CONSTRAINT-${process.pid}`;
      const makeSnapshot = () => store.snapshots.create({
        employeeNumber,
        fullName: 'Constraint Test Employee',
        department: 'Test',
        grade: 18,
        employer: 'DUG',
        supervisorNumber: 'M-1',
        supervisorName: 'Test Manager',
        resolvedFormType: 'DUGLeadership'
      });
      const snapshotId = await makeSnapshot();
      const scorecardId = await store.scorecards.create({
        employeeSnapshotId: snapshotId,
        cycleId: cycle!.id,
        employeeNumber,
        formType: 'DUGLeadership',
        assigneeEmployeeNumber: employeeNumber
      });
      const historyId = await store.history.append({
        scorecardId,
        phase: 'GoalSetting',
        action: 'Created',
        actorEmployeeNumber: '12245'
      });
      await expect(client.query('UPDATE workflow_history SET comment = $1 WHERE id = $2', ['changed', historyId])).rejects.toThrow(
        /append-only/
      );
      throw new Error('ROLLBACK_AFTER_ABORT');
    }).catch((error: unknown) => {
      if (!(error instanceof Error) || (!error.message.includes('append-only') && error.message !== 'ROLLBACK_AFTER_ABORT')) throw error;
    });

    await inTransaction(async (client) => {
      const store = repositories(client);
      const cycle = await store.cycles.get2027();
      const employeeNumber = `DUPLICATE-${process.pid}`;
      const snapshot = async () => store.snapshots.create({
        employeeNumber,
        fullName: 'Duplicate Test Employee',
        department: 'Test',
        grade: 18,
        employer: 'DUG',
        supervisorNumber: 'M-1',
        supervisorName: 'Test Manager',
        resolvedFormType: 'DUGLeadership'
      });
      await store.scorecards.create({ employeeSnapshotId: await snapshot(), cycleId: cycle!.id, employeeNumber, formType: 'DUGLeadership', assigneeEmployeeNumber: employeeNumber });
      await expect(
        store.scorecards.create({ employeeSnapshotId: await snapshot(), cycleId: cycle!.id, employeeNumber, formType: 'DUGLeadership', assigneeEmployeeNumber: employeeNumber })
      ).rejects.toMatchObject({ code: '23505' });
    }).catch(() => undefined);
  });
});
