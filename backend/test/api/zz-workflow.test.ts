import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { closePool, getPool } from '../../src/database/pool.js';
import { createFixtureOracleClient } from '../fixtures/oracle.js';

const config = parseConfig({
  NODE_ENV: 'test', DATABASE_URL: process.env.DATABASE_URL,
  ORACLE_EMPLOYEE_URL: 'https://fixtures.invalid/employees',
  ORACLE_DEPARTMENT_HEAD_URL: 'https://fixtures.invalid/heads',
  ORACLE_EMPLOYER_MAPPING_URL: 'https://fixtures.invalid/employers',
  ORACLE_BEARER_TOKEN: 'workflow-fixture-token'
});
const app = createApp(config, { oracle: createFixtureOracleClient(config) });
const hr = request.agent(app);
const manager = request.agent(app);
const employee = request.agent(app);
const otherEmployee = request.agent(app);
const departmentHead = request.agent(app);
const itAdmin = request.agent(app);
let scorecardId: string;
let itAdminScorecardId: string;
let strategyReferenceId: string;

function goalLines(employeeNumber: string) {
  const base = { title: 'Deliver 2027 outcome', linkedStrategyReferenceId: strategyReferenceId, measureDescription: 'Completion', target: '100%' };
  if (employeeNumber === '18001') return [{ ...base, perspective: 'Customer', weight: 100 }];
  if (employeeNumber === '18002') return [{ ...base, perspective: 'Business Development', weight: 100 }];
  if (employeeNumber === '17001') return [1, 2, 3, 4].map((index) => ({ ...base, title: `${base.title} ${index}`, weight: 25 }));
  if (employeeNumber === '17002') return [1, 2, 3, 4].map((index) => ({ ...base, title: `${base.title} ${index}`, performanceArea: 'Quality', weight: 25 }));
  return undefined;
}

beforeAll(async () => {
  await hr.post('/api/auth/login').send({ employeeNumber: '12245' }).expect(200);
  await manager.post('/api/auth/login').send({ employeeNumber: '30001' }).expect(200);
  await employee.post('/api/auth/login').send({ employeeNumber: '18001' }).expect(200);
  await otherEmployee.post('/api/auth/login').send({ employeeNumber: '17003' }).expect(200);
  await departmentHead.post('/api/auth/login').send({ employeeNumber: '17001' }).expect(200);
  await itAdmin.post('/api/auth/login').send({ employeeNumber: '21975' }).expect(200);
  await hr.put('/api/role-categories/17002').send({ roleCategory: 'ProjectDeliveryProfessional' }).expect(200);
  await hr.put('/api/role-categories/17003').send({ roleCategory: 'AdministrativeSupport' }).expect(200);
  await hr.put('/api/role-categories/21975').send({ roleCategory: 'AdministrativeSupport' }).expect(200);
  await hr.post('/api/hr/generate').send({ employeeNumbers: ['18001', '18002', '17001', '17002', '17003', '21975'] }).expect(200);
  const result = await getPool().query<{ id: string; employee_number: string }>("SELECT id, employee_number FROM scorecards WHERE employee_number IN ('18001', '21975')");
  scorecardId = result.rows.find((row) => row.employee_number === '18001')!.id;
  itAdminScorecardId = result.rows.find((row) => row.employee_number === '21975')!.id;
  strategyReferenceId = (await getPool().query<{ id: string }>('SELECT id FROM strategy_references ORDER BY id LIMIT 1')).rows[0]!.id;
});

afterAll(closePool);

describe('scorecard visibility API', () => {
  it('applies the same authorization to list and detail routes', async () => {
    const own = await employee.get('/api/scorecards').expect(200);
    expect(own.body.scorecards.map((item: { employeeNumber: string }) => item.employeeNumber)).toEqual(['18001']);
    const team = await manager.get('/api/scorecards').expect(200);
    expect(team.body.scorecards.every((item: { employeeNumber: string }) => item.employeeNumber !== '30001')).toBe(true);
    expect(team.body.scorecards.some((item: { employeeNumber: string }) => item.employeeNumber === '18001')).toBe(true);
    const department = await departmentHead.get('/api/scorecards').expect(200);
    expect(department.body.scorecards.every((item: { department: string }) => item.department === 'Delivery')).toBe(true);
    const total = Number((await getPool().query<{ count: string }>('SELECT COUNT(*)::text AS count FROM scorecards')).rows[0]!.count);
    expect((await hr.get('/api/scorecards').expect(200)).body.scorecards).toHaveLength(total);
    expect((await itAdmin.get('/api/scorecards').expect(200)).body.scorecards).toHaveLength(total);
    await employee.get(`/api/scorecards/${scorecardId}`).expect(200);
    await otherEmployee.get(`/api/scorecards/${scorecardId}`).expect(403);
  });
});

describe('transactional Employee to Line Manager workflow', () => {
  it('allows IT admin to act only when their employee number owns the pending workflow', async () => {
    await itAdmin.post(`/api/scorecards/${scorecardId}/actions/SavedDraft`).send({}).expect(409);
    await itAdmin.post(`/api/scorecards/${itAdminScorecardId}/actions/SavedDraft`).send({}).expect(200);
    await manager.post(`/api/scorecards/${scorecardId}/actions/Approved`).send({}).expect(409);
  });

  it('supports draft, initiate, reject, resubmit, approve, and stale-click protection', async () => {
    await employee.post(`/api/scorecards/${scorecardId}/actions/SavedDraft`).send({
      comment: 'Goal draft', lines: [{ title: 'Partial draft' }]
    }).expect(422);
    await employee.post(`/api/scorecards/${scorecardId}/actions/SavedDraft`).send({
      comment: 'Invalid total', lines: [{ ...goalLines('18001')![0], weight: 90 }]
    }).expect(422);
    await employee.post(`/api/scorecards/${scorecardId}/actions/SavedDraft`).send({
      comment: 'Goal draft', lines: goalLines('18001')
    }).expect(200);
    const draft = await employee.get(`/api/scorecards/${scorecardId}`).expect(200);
    expect(draft.body.scorecard.lines[0]).toMatchObject({ title: 'Deliver 2027 outcome', weight: 100 });
    await employee.post(`/api/scorecards/${scorecardId}/actions/Initiated`).send({
      lines: [{ ...goalLines('18001')![0], weight: 90 }]
    }).expect(422);
    await employee.post(`/api/scorecards/${scorecardId}/actions/SavedDraft`).send({
      lines: [{ ...goalLines('18001')![0], performanceArea: 'Quality' }]
    }).expect(403);
    await employee.post(`/api/scorecards/${scorecardId}/actions/Initiated`).send({
      comment: 'Ready for review', lines: goalLines('18001')
    }).expect(200);
    await employee.post(`/api/scorecards/${scorecardId}/actions/Initiated`).send({}).expect(409);
    await manager.post(`/api/scorecards/${scorecardId}/actions/SavedDraft`).send({ lines: [{ id: draft.body.scorecard.lines[0].id, title: 'Manager overwrite' }] }).expect(403);
    await manager.post(`/api/scorecards/${scorecardId}/actions/Rejected`).send({ comment: 'Please revise' }).expect(200);
    await employee.post(`/api/scorecards/${scorecardId}/actions/Initiated`).send({}).expect(409);
    await employee.post(`/api/scorecards/${scorecardId}/actions/Resubmitted`).send({ comment: 'Revised', lines: goalLines('18001') }).expect(200);
    await manager.post(`/api/scorecards/${scorecardId}/actions/Approved`).send({ comment: 'Approved' }).expect(200);
    await manager.post(`/api/scorecards/${scorecardId}/actions/Approved`).send({}).expect(409);

    const history = await employee.get(`/api/scorecards/${scorecardId}`).expect(200);
    expect(history.body.scorecard.history.map((item: { action: string }) => item.action)).toEqual([
      'Created', 'SavedDraft', 'Initiated', 'Rejected', 'Resubmitted', 'Approved'
    ]);
    expect(history.body.scorecard.history.find((item: { action: string }) => item.action === 'Rejected')).toMatchObject({
      comment: 'Please revise', from_participant: 'LineManager', to_participant: 'Employee'
    });
  });
});

describe('HR phase control', () => {
  it('rejects unauthorized and incomplete phase changes', async () => {
    await employee.post('/api/hr/phase/advance').send({ expectedCurrentPhase: 'GoalSetting' }).expect(403);
    await hr.post('/api/hr/phase/advance').send({ expectedCurrentPhase: 'GoalSetting' }).expect(409);
  });

  it('opens Mid-Year only after every current scorecard is fully approved', async () => {
    const open = await getPool().query<{ id: string; employee_number: string }>(
      "SELECT id, employee_number FROM scorecards WHERE status <> 'FullyApproved' ORDER BY id"
    );
    for (const item of open.rows) {
      const participant = request.agent(app);
      await participant.post('/api/auth/login').send({ employeeNumber: item.employee_number }).expect(200);
      await participant.post(`/api/scorecards/${item.id}/actions/Initiated`).send({ lines: goalLines(item.employee_number) }).expect(200);
      await manager.post(`/api/scorecards/${item.id}/actions/Approved`).send({}).expect(200);
    }
    const advanced = await hr.post('/api/hr/phase/advance').send({ expectedCurrentPhase: 'GoalSetting' }).expect(200);
    expect(advanced.body).toMatchObject({ previousPhase: 'GoalSetting', currentPhase: 'MidYear' });
    await hr.post('/api/hr/phase/advance').send({ expectedCurrentPhase: 'GoalSetting' }).expect(409);
    const states = await getPool().query("SELECT * FROM scorecard_phase_states WHERE phase = 'MidYear'");
    expect(states.rowCount).toBe(Number((await getPool().query<{ count: string }>('SELECT COUNT(*)::text AS count FROM scorecards')).rows[0]!.count));
    const history = await getPool().query(
      "SELECT action FROM workflow_history WHERE scorecard_id = $1 AND action IN ('PhaseClosed', 'PhaseOpened') ORDER BY id",
      [scorecardId]
    );
    expect(history.rows.map((item) => item.action)).toEqual(['PhaseClosed', 'PhaseOpened']);
  });
});
