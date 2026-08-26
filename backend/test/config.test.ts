import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config.js';

const validEnvironment = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pms_test',
  ORACLE_EMPLOYEE_URL: 'https://oracle.example/employees',
  ORACLE_DEPARTMENT_HEAD_URL: 'https://oracle.example/heads',
  ORACLE_EMPLOYER_MAPPING_URL: 'https://oracle.example/employers',
  ORACLE_BEARER_TOKEN: 'test-only-token'
};

describe('parseConfig', () => {
  it('parses required server settings and fixed POC identity defaults', () => {
    const config = parseConfig(validEnvironment);
    expect(config.HR_ADMIN_EMPLOYEE_NUMBER).toBe('12245');
    expect(config.IT_ADMIN_EMPLOYEE_NUMBER).toBe('21975');
    expect(config.BACKEND_PORT).toBe(3001);
  });

  it('reports missing server-only configuration', () => {
    expect(() => parseConfig({})).toThrow(/DATABASE_URL.*ORACLE_EMPLOYEE_URL.*ORACLE_BEARER_TOKEN/s);
  });

  it('rejects malformed URLs and employee numbers', () => {
    expect(() => parseConfig({ ...validEnvironment, DATABASE_URL: 'sqlite:test', HR_ADMIN_EMPLOYEE_NUMBER: 'HR' })).toThrow(
      /Invalid backend configuration/
    );
  });
});
