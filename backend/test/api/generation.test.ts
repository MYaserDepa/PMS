import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { closePool, getPool } from '../../src/database/pool.js';
import { OracleClient } from '../../src/oracle/client.js';
import { createFixtureOracleClient, fixtureDepartmentHeads, fixtureEmployees, jsonResponse } from '../fixtures/oracle.js';

const config = parseConfig({
  NODE_ENV: 'test',
  DATABASE_URL: process.env.DATABASE_URL,
  ORACLE_EMPLOYEE_URL: 'https://fixtures.invalid/employees',
  ORACLE_DEPARTMENT_HEAD_URL: 'https://fixtures.invalid/heads',
  ORACLE_EMPLOYER_MAPPING_URL: 'https://fixtures.invalid/employers',
  ORACLE_BEARER_TOKEN: 'generation-fixture-token'
});

const app = createApp(config, { oracle: createFixtureOracleClient(config) });
const hr = request.agent(app);
const departmentHead = request.agent(app);
const itAdmin = request.agent(app);
const employee = request.agent(app);

beforeAll(async () => {
  await hr.post('/api/auth/login').send({ employeeNumber: '12245' }).expect(200);
  await departmentHead.post('/api/auth/login').send({ employeeNumber: '17001' }).expect(200);
  await itAdmin.post('/api/auth/login').send({ employeeNumber: '21975' }).expect(200);
  await employee.post('/api/auth/login').send({ employeeNumber: '17002' }).expect(200);
  await hr.put('/api/role-categories/17003').send({ roleCategory: 'AdministrativeSupport' }).expect(200);
});

afterAll(closePool);

describe('RoleCategory administration', () => {
  it('enforces HR, Department Head department scope, allowed values, and IT restrictions', async () => {
    await hr.put('/api/role-categories/17004').send({ roleCategory: 'ProjectDeliveryProfessional' }).expect(200);
    await departmentHead.put('/api/role-categories/17002').send({ roleCategory: 'ProjectDeliveryProfessional' }).expect(200);
    await departmentHead.put('/api/role-categories/12245').send({ roleCategory: 'AdministrativeSupport' }).expect(403);
    await employee.put('/api/role-categories/17003').send({ roleCategory: 'AdministrativeSupport' }).expect(403);
    await itAdmin.put('/api/role-categories/17003').send({ roleCategory: 'AdministrativeSupport' }).expect(403);
    await hr.put('/api/role-categories/17003').send({ roleCategory: 'Invalid' }).expect(400);

    const mappings = await departmentHead.get('/api/role-categories').expect(200);
    expect(mappings.body.mappings.every((mapping: { department: string }) => mapping.department === 'Delivery')).toBe(true);
  });

  it('uses a newly saved mapping in the next Populate preview', async () => {
    const response = await hr.post('/api/hr/populate').send({ department: 'Delivery' }).expect(200);
    expect(response.body.rows.find((row: { employeeNumber: string }) => row.employeeNumber === '17004')).toMatchObject({
      roleCategory: 'ProjectDeliveryProfessional',
      formType: 'ProjectDeliveryProfessionalKPI',
      status: 'Ready'
    });
  });

  it('revalidates assignment inputs during Generate instead of trusting a stale preview', async () => {
    await hr.put('/api/role-categories/17004').send({ roleCategory: 'AdministrativeSupport' }).expect(200);
    const response = await hr.post('/api/hr/generate').send({ employeeNumbers: ['17004'] }).expect(200);
    expect(response.body).toMatchObject({ created: 1, alreadyExisting: 0, validationFailed: 0 });
    const persisted = await getPool().query(
      `SELECT s.form_type, e.role_category_at_creation
       FROM scorecards s JOIN employee_snapshots e ON e.id = s.employee_snapshot_id
       WHERE s.employee_number = '17004'`
    );
    expect(persisted.rows[0]).toMatchObject({ form_type: 'AdministrativeSupport', role_category_at_creation: 'AdministrativeSupport' });
  });
});

describe('HR Populate and Generate', () => {
  it('restricts both operations to HR Admin', async () => {
    await employee.get('/api/hr/departments').expect(403);
    await employee.post('/api/hr/populate').send({ department: 'Delivery' }).expect(403);
    await employee.post('/api/hr/generate').send({ employeeNumbers: ['18001'] }).expect(403);
  });

  it('represents an employer-mapping upstream failure as unresolved without assigning a leadership form', async () => {
    const upstreamFailureOracle = new OracleClient(config, async (input) => {
      const url = String(input);
      if (url === config.ORACLE_EMPLOYER_MAPPING_URL) return jsonResponse({}, 503);
      if (url === config.ORACLE_DEPARTMENT_HEAD_URL) return jsonResponse({ items: fixtureDepartmentHeads });
      return jsonResponse({ items: fixtureEmployees });
    });
    const failureApp = createApp(config, { oracle: upstreamFailureOracle });
    const failureHr = request.agent(failureApp);
    await failureHr.post('/api/auth/login').send({ employeeNumber: '12245' }).expect(200);
    const response = await failureHr.post('/api/hr/populate').send({ department: 'Delivery' }).expect(200);
    expect(response.body.rows.find((row: { employeeNumber: string }) => row.employeeNumber === '18001')).toMatchObject({
      formType: null,
      status: 'Unable to Resolve DUG/KBU'
    });
  });

  it('returns a mixed assignment preview without writing scorecard data', async () => {
    const before = await getPool().query<{ snapshots: string; scorecards: string; history: string }>(
      `SELECT
        (SELECT COUNT(*) FROM employee_snapshots)::text AS snapshots,
        (SELECT COUNT(*) FROM scorecards)::text AS scorecards,
        (SELECT COUNT(*) FROM workflow_history)::text AS history`
    );
    const response = await hr.post('/api/hr/populate').send({ department: 'Delivery' }).expect(200);
    const rows = response.body.rows as Array<Record<string, unknown>>;
    expect(rows.find((row) => row.employeeNumber === '18001')).toMatchObject({ formType: 'DUGLeadership', status: 'Ready' });
    expect(rows.find((row) => row.employeeNumber === '18002')).toMatchObject({ formType: 'KBULeadership', status: 'Ready' });
    expect(rows.find((row) => row.employeeNumber === '17001')).toMatchObject({ formType: 'DepartmentHeadKPI', status: 'Ready' });
    expect(rows.find((row) => row.employeeNumber === '17002')).toMatchObject({ formType: 'ProjectDeliveryProfessionalKPI', status: 'Ready' });
    expect(rows.find((row) => row.employeeNumber === '17003')).toMatchObject({ formType: 'AdministrativeSupport', status: 'Ready' });
    expect(rows.find((row) => row.employeeNumber === '17005')).toMatchObject({ status: 'Missing Manager', formType: null });
    expect(rows.find((row) => row.employeeNumber === '17006')).toMatchObject({ status: 'Missing Grade', formType: null });
    expect(rows.find((row) => row.employeeNumber === '18003')).toMatchObject({ status: 'Unable to Resolve DUG/KBU', formType: null });
    const after = await getPool().query<{ snapshots: string; scorecards: string; history: string }>(
      `SELECT
        (SELECT COUNT(*) FROM employee_snapshots)::text AS snapshots,
        (SELECT COUNT(*) FROM scorecards)::text AS scorecards,
        (SELECT COUNT(*) FROM workflow_history)::text AS history`
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('generates valid employees transactionally and leaves an invalid employee with no partial data', async () => {
    const response = await hr.post('/api/hr/generate').send({ employeeNumbers: ['18001', '17003', '17005'] }).expect(200);
    expect(response.body).toMatchObject({ created: 2, alreadyExisting: 0, validationFailed: 1 });
    expect(response.body.outcomes.find((item: { employeeNumber: string }) => item.employeeNumber === '17005')).toMatchObject({
      outcome: 'ValidationFailed', status: 'Missing Manager'
    });

    const graph = await getPool().query<{
      form_type: string;
      standard_count: string;
      phase_count: string;
      step_count: string;
      history_count: string;
    }>(
      `SELECT s.form_type,
        (SELECT COUNT(*) FROM admin_standards a WHERE a.scorecard_id = s.id)::text AS standard_count,
        (SELECT COUNT(*) FROM scorecard_phase_states p WHERE p.scorecard_id = s.id)::text AS phase_count,
        (SELECT COUNT(*) FROM workflow_steps w WHERE w.scorecard_id = s.id)::text AS step_count,
        (SELECT COUNT(*) FROM workflow_history h WHERE h.scorecard_id = s.id)::text AS history_count
       FROM scorecards s WHERE s.employee_number = '17003'`
    );
    expect(graph.rows[0]).toEqual({
      form_type: 'AdministrativeSupport', standard_count: '6', phase_count: '1', step_count: '2', history_count: '1'
    });
    const invalid = await getPool().query('SELECT 1 FROM employee_snapshots WHERE employee_number = $1', ['17005']);
    expect(invalid.rowCount).toBe(0);
  });

  it('treats a repeated Generate click as already existing', async () => {
    const response = await hr.post('/api/hr/generate').send({ employeeNumbers: ['18001', '17003'] }).expect(200);
    expect(response.body).toMatchObject({ created: 0, alreadyExisting: 2, validationFailed: 0 });
    const duplicates = await getPool().query('SELECT id FROM scorecards WHERE employee_number IN ($1, $2)', ['18001', '17003']);
    expect(duplicates.rows).toHaveLength(2);
  });
});
