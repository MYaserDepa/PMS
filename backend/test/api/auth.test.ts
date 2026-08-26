import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';
import { OracleClient } from '../../src/oracle/client.js';
import { createFixtureOracleClient, fixtureDepartmentHeads, fixtureEmployees, jsonResponse } from '../fixtures/oracle.js';

const config = parseConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pms_test',
  ORACLE_EMPLOYEE_URL: 'https://fixtures.invalid/employees',
  ORACLE_DEPARTMENT_HEAD_URL: 'https://fixtures.invalid/heads',
  ORACLE_EMPLOYER_MAPPING_URL: 'https://fixtures.invalid/employers',
  ORACLE_BEARER_TOKEN: 'api-fixture-token'
});

const fixtureApp = () => createApp(config, { oracle: createFixtureOracleClient(config) });

describe('test identity API', () => {
  it.each([
    ['12245', { isHrAdmin: true, isItAdmin: false }],
    ['21975', { isHrAdmin: false, isItAdmin: true }],
    ['30001', { isHrAdmin: false, isItAdmin: false, isManager: true }],
    ['17001', { departmentHeadStatus: 'Head' }]
  ] as const)('logs in valid identity %s with server-derived capabilities', async (employeeNumber, capabilities) => {
    const response = await request(fixtureApp()).post('/api/auth/login').send({ employeeNumber }).expect(200);
    expect(response.body.user).toMatchObject({ employeeNumber, ...capabilities });
    expect(JSON.stringify(response.body)).not.toContain(config.ORACLE_BEARER_TOKEN);
    expect(response.headers['set-cookie']?.[0]).toMatch(/pms_session=.*HttpOnly/);
  });

  it('restores and logs out a session', async () => {
    const agent = request.agent(fixtureApp());
    await agent.post('/api/auth/login').send({ employeeNumber: '17002' }).expect(200);
    await agent.get('/api/auth/session').expect(200).expect(({ body }) => {
      expect(body.user.employeeNumber).toBe('17002');
    });
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/session').expect(401);
  });

  it.each(['unknown', '99999'])('rejects unknown or ineligible identity %s', async (employeeNumber) => {
    const response = await request(fixtureApp()).post('/api/auth/login').send({ employeeNumber }).expect(404);
    expect(response.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
  });

  it('rejects malformed login requests', async () => {
    await request(fixtureApp()).post('/api/auth/login').send({ employeeNumber: '' }).expect(400);
  });

  it('maps unauthorized and malformed Oracle responses to safe API errors', async () => {
    const unauthorizedOracle = new OracleClient(config, vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 401)));
    const unauthorized = await request(createApp(config, { oracle: unauthorizedOracle }))
      .post('/api/auth/login').send({ employeeNumber: '12245' }).expect(502);
    expect(unauthorized.body.error).toMatchObject({ code: 'ORACLE_UPSTREAM_ERROR' });

    const malformedOracle = new OracleClient(config, vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ items: [{}] })));
    const malformed = await request(createApp(config, { oracle: malformedOracle }))
      .post('/api/auth/login').send({ employeeNumber: '12245' }).expect(502);
    expect(malformed.body.error).toMatchObject({ code: 'ORACLE_INVALID_EMPLOYEE_PAYLOAD' });
  });

  it('reports unavailable Department Head status without guessing non-head', async () => {
    const unavailableHeadOracle = new OracleClient(config, async (input) => {
      const url = String(input);
      if (url === config.ORACLE_DEPARTMENT_HEAD_URL) return jsonResponse({}, 503);
      if (url === config.ORACLE_EMPLOYEE_URL) return jsonResponse({ items: fixtureEmployees });
      return jsonResponse({ items: fixtureDepartmentHeads });
    });
    const response = await request(createApp(config, { oracle: unavailableHeadOracle }))
      .post('/api/auth/login').send({ employeeNumber: '17001' }).expect(200);
    expect(response.body.user.departmentHeadStatus).toBe('Unavailable');
  });
});
