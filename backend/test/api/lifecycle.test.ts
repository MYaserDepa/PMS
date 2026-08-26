import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { closePool, getPool } from '../../src/database/pool.js';
import { createFixtureOracleClient } from '../fixtures/oracle.js';

const config = parseConfig({
  NODE_ENV: 'test', DATABASE_URL: process.env.DATABASE_URL,
  ORACLE_EMPLOYEE_URL: 'https://fixtures.invalid/employees', ORACLE_DEPARTMENT_HEAD_URL: 'https://fixtures.invalid/heads',
  ORACLE_EMPLOYER_MAPPING_URL: 'https://fixtures.invalid/employers', ORACLE_BEARER_TOKEN: 'lifecycle-token'
});
const app = createApp(config, { oracle: createFixtureOracleClient(config) });
const hr = request.agent(app);
const manager = request.agent(app);
const dugEmployee = request.agent(app);
const adminEmployee = request.agent(app);
let dugId: string;
let adminId: string;
let strategyId: string;

async function action(agent: typeof hr, id: string, command: string, body: Record<string, unknown> = {}, status = 200) {
  return agent.post(`/api/scorecards/${id}/actions/${command}`).send(body).expect(status);
}

async function approveSimplePhase(employeeAgent: typeof hr, id: string) {
  await action(employeeAgent, id, 'Initiated');
  await action(manager, id, 'Approved');
}

beforeAll(async () => {
  await hr.post('/api/auth/login').send({ employeeNumber: '12245' }).expect(200);
  await manager.post('/api/auth/login').send({ employeeNumber: '30001' }).expect(200);
  await dugEmployee.post('/api/auth/login').send({ employeeNumber: '18001' }).expect(200);
  await adminEmployee.post('/api/auth/login').send({ employeeNumber: '17003' }).expect(200);
  await hr.put('/api/role-categories/17003').send({ roleCategory: 'AdministrativeSupport' }).expect(200);
  await hr.post('/api/hr/generate').send({ employeeNumbers: ['18001', '17003'] }).expect(200);
  const ids = await getPool().query<{ id: string; employee_number: string }>("SELECT id, employee_number FROM scorecards ORDER BY employee_number");
  dugId = ids.rows.find((row) => row.employee_number === '18001')!.id;
  adminId = ids.rows.find((row) => row.employee_number === '17003')!.id;
  strategyId = (await getPool().query<{ id: string }>('SELECT id FROM strategy_references ORDER BY id LIMIT 1')).rows[0]!.id;
});

afterAll(closePool);

describe('complete annual lifecycle rules', () => {
  it('completes valid Goal Setting for KPI and fixed-standard forms', async () => {
    await action(dugEmployee, dugId, 'Initiated', { lines: [{
      perspective: 'Customer', title: 'Deliver strategic outcome', linkedStrategyReferenceId: strategyId,
      measureDescription: 'Completion', target: '100%', weight: 100
    }] });
    await action(manager, dugId, 'Approved');
    await approveSimplePhase(adminEmployee, adminId);
    const result = await hr.post('/api/hr/phase/advance').send({ expectedCurrentPhase: 'GoalSetting' }).expect(200);
    expect(result.body.currentPhase).toBe('MidYear');
  });

  it('allows only Mid-Year plan fields and supports rejection and resubmission', async () => {
    const lineId = (await dugEmployee.get(`/api/scorecards/${dugId}`).expect(200)).body.scorecard.lines[0].id;
    await action(dugEmployee, dugId, 'SavedDraft', { lines: [{ id: lineId, actual: 'Future field' }] }, 403);
    const revised = [{
      id: lineId, perspective: 'Customer', title: 'Deliver revised strategic outcome', linkedStrategyReferenceId: strategyId,
      measureDescription: 'Completion', target: '95%', weight: 100, midYearStatus: 'AtRisk', midYearComment: 'Recovery plan agreed'
    }];
    await action(dugEmployee, dugId, 'SavedDraft', { lines: revised });
    await action(dugEmployee, dugId, 'Initiated', { lines: revised });
    const managerView = await manager.get(`/api/scorecards/${dugId}`).expect(200);
    const submittedLineId = managerView.body.scorecard.lines[0].id;
    await action(manager, dugId, 'SavedDraft', { lines: [{ id: submittedLineId, managerComment: 'Needs a firmer recovery date' }] });
    await action(manager, dugId, 'Rejected', { comment: 'Revise the recovery date' });
    await action(dugEmployee, dugId, 'Resubmitted', { lines: revised, comment: 'Recovery date added' });
    await action(manager, dugId, 'Approved', { lines: [{
      id: (await manager.get(`/api/scorecards/${dugId}`)).body.scorecard.lines[0].id,
      managerComment: 'Recovery plan accepted'
    }] });
    await approveSimplePhase(adminEmployee, adminId);
    await hr.post('/api/hr/phase/advance').send({ expectedCurrentPhase: 'MidYear' }).expect(200);
  });

  it('keeps Year-End drafts private and enforces separate employee and manager evidence', async () => {
    let lineId = (await dugEmployee.get(`/api/scorecards/${dugId}`).expect(200)).body.scorecard.lines[0].id;
    await action(dugEmployee, dugId, 'SavedDraft', { lines: [{ id: lineId, actual: 'Delivered', selfRating: 4, employeeComment: 'Strong result' }] });
    const hiddenEmployeeDraft = await manager.get(`/api/scorecards/${dugId}`).expect(200);
    expect(hiddenEmployeeDraft.body.scorecard.lines[0]).toMatchObject({ actual: null, self_rating: null, employee_comment: null });
    await action(dugEmployee, dugId, 'Initiated', { lines: [{ id: lineId, actual: 'Delivered', selfRating: 4, employeeComment: 'Strong result' }] }, 422);
    await action(dugEmployee, dugId, 'Initiated', { lines: [{
      id: lineId, actual: 'Delivered', selfRating: 4, employeeComment: 'Strong result', employeeEvidenceUrl: 'EMP-REF-2027'
    }] });
    lineId = (await manager.get(`/api/scorecards/${dugId}`).expect(200)).body.scorecard.lines[0].id;
    await action(manager, dugId, 'SavedDraft', { lines: [{ id: lineId, managerRating: 4, managerComment: 'Exceeds plan' }] });
    const hiddenManagerDraft = await dugEmployee.get(`/api/scorecards/${dugId}`).expect(200);
    expect(hiddenManagerDraft.body.scorecard.lines[0]).toMatchObject({ manager_rating: null, manager_comment: null });
    await action(manager, dugId, 'Approved', { lines: [{ id: lineId, managerRating: 4, managerComment: 'Exceeds plan' }] }, 422);
    await action(manager, dugId, 'Approved', { lines: [{
      id: lineId, managerRating: 4, managerComment: 'Exceeds plan', managerEvidenceUrl: 'MGR-REF-2027'
    }] });
    const finalized = await dugEmployee.get(`/api/scorecards/${dugId}`).expect(200);
    expect(finalized.body.scorecard.lines[0]).toMatchObject({ manager_rating: 4, manager_evidence_url: 'MGR-REF-2027' });
    expect(Number(finalized.body.scorecard.overall_rating)).toBe(4);
  });

  it('rates Administrative / Support without employee SelfRating and calculates its overall rating', async () => {
    const employeeView = await adminEmployee.get(`/api/scorecards/${adminId}`).expect(200);
    const employeeStandards = employeeView.body.scorecard.standards.map((standard: { id: string }, index: number) => ({
      id: standard.id, employeeComment: `Employee comment ${index + 1}`
    }));
    await action(adminEmployee, adminId, 'SavedDraft', { standards: [{ ...employeeStandards[0], selfRating: 3 }] }, 400);
    await action(adminEmployee, adminId, 'Initiated', { standards: employeeStandards });
    const managerView = await manager.get(`/api/scorecards/${adminId}`).expect(200);
    const managerStandards = managerView.body.scorecard.standards.map((standard: { id: string }, index: number) => ({
      id: standard.id, managerRating: 3, managerComment: `Manager comment ${index + 1}`
    }));
    await action(manager, adminId, 'Approved', { standards: managerStandards });
    const finalized = await adminEmployee.get(`/api/scorecards/${adminId}`).expect(200);
    expect(Number(finalized.body.scorecard.overall_rating)).toBe(3);
    expect(finalized.body.scorecard.standards.every((standard: Record<string, unknown>) => !('self_rating' in standard))).toBe(true);
    await hr.post('/api/hr/phase/advance').send({ expectedCurrentPhase: 'YearEnd' }).expect(200);
  });

  it('records owned Development notes, closes atomically, and rejects every later mutation', async () => {
    for (const [id, employeeAgent] of [[dugId, dugEmployee], [adminId, adminEmployee]] as const) {
      await action(employeeAgent, id, 'SavedDraft', { employeeDevelopmentNotes: 'Complete leadership development programme' });
      await action(employeeAgent, id, 'Initiated', { employeeDevelopmentNotes: 'Complete leadership development programme' });
      await action(manager, id, 'SavedDraft', { managerDevelopmentNotes: 'Quarterly coaching and feedback' });
      await action(manager, id, 'Approved', { managerDevelopmentNotes: 'Quarterly coaching and feedback' });
      const closed = await employeeAgent.get(`/api/scorecards/${id}`).expect(200);
      expect(closed.body.scorecard).toMatchObject({ status: 'Closed', current_phase: 'Closed' });
      expect(closed.body.scorecard.history.slice(-2).map((entry: { action: string }) => entry.action)).toEqual(['Approved', 'Closed']);
      await action(employeeAgent, id, 'SavedDraft', { employeeDevelopmentNotes: 'Mutation after close' }, 409);
    }
    const cycle = await hr.post('/api/hr/phase/advance').send({ expectedCurrentPhase: 'Development' }).expect(200);
    expect(cycle.body.currentPhase).toBe('Closed');
    const counts = await getPool().query<{ closed: string; total: string }>(
      "SELECT COUNT(*) FILTER (WHERE status = 'Closed')::text AS closed, COUNT(*)::text AS total FROM scorecards"
    );
    expect(counts.rows[0]!.closed).toBe(counts.rows[0]!.total);
  });
});
