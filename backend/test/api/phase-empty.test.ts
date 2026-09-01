import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { closePool } from '../../src/database/pool.js';
import { createFixtureOracleClient } from '../fixtures/oracle.js';

const config = parseConfig({
  NODE_ENV: 'test', DATABASE_URL: process.env.DATABASE_URL,
  ORACLE_EMPLOYEE_URL: 'https://fixtures.invalid/employees',
  ORACLE_DEPARTMENT_HEAD_URL: 'https://fixtures.invalid/heads',
  ORACLE_EMPLOYER_MAPPING_URL: 'https://fixtures.invalid/employers',
  ORACLE_BEARER_TOKEN: 'phase-empty-fixture-token'
});
const app = createApp(config, { oracle: createFixtureOracleClient(config) });
const hr = request.agent(app);

beforeAll(async () => {
  await hr.post('/api/auth/login').send({ employeeNumber: '12245' }).expect(200);
});

afterAll(closePool);

describe('HR phase control without submissions', () => {
  it('does not open the next phase when no PMS submissions exist', async () => {
    const response = await hr.post('/api/hr/phase/advance')
      .send({ expectedCurrentPhase: 'GoalSetting' })
      .expect(409);

    expect(response.body.error).toMatchObject({
      code: 'NO_SUBMISSIONS',
      message: 'No PMS submissions have been created. Generate at least one submission before opening the next phase'
    });

    const cycle = await request(app).get('/api/cycle').expect(200);
    expect(cycle.body.cycle.current_phase).toBe('GoalSetting');
  });
});
