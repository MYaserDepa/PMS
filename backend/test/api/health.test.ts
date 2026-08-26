import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';

const config = parseConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pms_test',
  ORACLE_EMPLOYEE_URL: 'https://oracle.example/employees',
  ORACLE_DEPARTMENT_HEAD_URL: 'https://oracle.example/heads',
  ORACLE_EMPLOYER_MAPPING_URL: 'https://oracle.example/employers',
  ORACLE_BEARER_TOKEN: 'test-only-token'
});

describe('health API', () => {
  it('returns backend health without configuration or secret data', async () => {
    const response = await request(createApp(config)).get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', service: 'pms-backend' });
    expect(JSON.stringify(response.body)).not.toContain(config.ORACLE_BEARER_TOKEN);
  });
});
