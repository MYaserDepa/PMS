import type { BackendConfig } from '../../src/config.js';
import { OracleClient } from '../../src/oracle/client.js';
import type { OracleEmployee } from '../../src/oracle/types.js';

const baseEmployee = {
  FIRST_NAME: 'Test',
  LAST_NAME: 'Employee',
  EMAIL_ADDRESS: 'test.employee@example.invalid',
  DEPARTMENT: 'Delivery',
  JOB: 'Test Job',
  POSITION: 'P-100',
  POSITION_NAME: 'Test Position',
  SUPERVISOR_NO: '30001',
  SUPERVISOR: 'Fixture Manager',
  USER_EXISTS: 'Y' as const
};

export const oracleEmployees: OracleEmployee[] = [
  { ...baseEmployee, EMPLOYEE_NUMBER: '12245', FULL_NAME: 'Hana Admin', GRADE: 17, EMPLOYER: 'DUG Corporate', DEPARTMENT: 'Human Resources' },
  { ...baseEmployee, EMPLOYEE_NUMBER: '21975', FULL_NAME: 'Imran Systems', GRADE: 17, EMPLOYER: 'DUG Corporate', DEPARTMENT: 'Information Technology' },
  { ...baseEmployee, EMPLOYEE_NUMBER: '30001', FULL_NAME: 'Mariam Manager', GRADE: 17, EMPLOYER: 'DUG Corporate', SUPERVISOR_NO: '40001', SUPERVISOR: 'Executive Manager' },
  { ...baseEmployee, EMPLOYEE_NUMBER: '18001', FULL_NAME: 'Dalia Leader', GRADE: 18, EMPLOYER: 'DUG Corporate' },
  { ...baseEmployee, EMPLOYEE_NUMBER: '18002', FULL_NAME: 'Karim Leader', GRADE: 18, EMPLOYER: 'Depa Interiors' },
  { ...baseEmployee, EMPLOYEE_NUMBER: '17001', FULL_NAME: 'Noura Head', GRADE: 17, EMPLOYER: 'DUG Corporate' },
  { ...baseEmployee, EMPLOYEE_NUMBER: '17002', FULL_NAME: 'Peter Professional', GRADE: 17, EMPLOYER: 'DUG Corporate' },
  { ...baseEmployee, EMPLOYEE_NUMBER: '17003', FULL_NAME: 'Sara Support', GRADE: 17, EMPLOYER: 'DUG Corporate' },
  { ...baseEmployee, EMPLOYEE_NUMBER: '17004', FULL_NAME: 'Mina Unmapped', GRADE: 17, EMPLOYER: 'DUG Corporate' },
  { ...baseEmployee, EMPLOYEE_NUMBER: '17005', FULL_NAME: 'Noor NoManager', GRADE: 17, EMPLOYER: 'DUG Corporate', SUPERVISOR_NO: null, SUPERVISOR: null },
  { ...baseEmployee, EMPLOYEE_NUMBER: '17006', FULL_NAME: 'Gina NoGrade', GRADE: null, EMPLOYER: 'DUG Corporate' },
  { ...baseEmployee, EMPLOYEE_NUMBER: '17007', FULL_NAME: 'Maya NoDepartment', GRADE: 17, EMPLOYER: 'DUG Corporate', DEPARTMENT: null },
  { ...baseEmployee, EMPLOYEE_NUMBER: '18003', FULL_NAME: 'Uma Unknown', GRADE: 18, EMPLOYER: 'Unknown Employer' },
  { ...baseEmployee, EMPLOYEE_NUMBER: '99999', FULL_NAME: 'Ian Ineligible', GRADE: 17, EMPLOYER: 'DUG Corporate', USER_EXISTS: 'N' }
];

export const departmentHeads = [
  { NAME: 'Delivery', ORGANIZATION_ID: '10', ORG_INFORMATION2: null, FULL_NAME: 'Noura Head', EMPLOYEE_NUMBER: 17001 },
  { NAME: 'Delivery', ORGANIZATION_ID: '10', ORG_INFORMATION2: null, FULL_NAME: 'Noura Head', EMPLOYEE_NUMBER: '17001' }
];

export const employerMappings = [
  { org_Name: 'DEPA United Group PJSC', dataGrid1: [
    { fieldName: 'EMPLOYER', value: 'DUG Corporate' },
    { fieldName: 'EMPLOYER', value: 'DUG Holdings' }
  ] },
  { org_Name: 'Depa Interiors LLC', dataGrid1: [{ fieldName: 'EMPLOYER', value: 'Depa Interiors' }] }
];

export function employerMappingPayload(companies: unknown[] = employerMappings) {
  return { results: [{ formDataIds: [{ data: { dataGrid: companies } }] }] };
}

export const fixtureEmployees = oracleEmployees;
export const fixtureDepartmentHeads = departmentHeads;

export function createOracleFixtureFetch(urls: {
  employee: string;
  departmentHead: string;
  employerMapping: string;
}): typeof fetch {
  return async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const requestedUrl = new URL(url);
    const employeeUrl = new URL(urls.employee);
    if (requestedUrl.origin === employeeUrl.origin && requestedUrl.pathname === employeeUrl.pathname) {
      const employeeNumber = requestedUrl.searchParams.get('$filter')?.match(/EMPLOYEE_NUMBER eq '([^']+)'/)?.[1];
      const employees = employeeNumber
        ? fixtureEmployees.filter((employee) => employee.EMPLOYEE_NUMBER === employeeNumber)
        : fixtureEmployees;
      return jsonResponse({ items: employees });
    }
    if (url === urls.departmentHead) return jsonResponse({ items: fixtureDepartmentHeads });
    if (url === urls.employerMapping) return jsonResponse(employerMappingPayload());
    return jsonResponse({ error: 'Unknown fixture URL' }, 404);
  };
}

export function createFixtureOracleClient(config: Pick<BackendConfig,
  'ORACLE_EMPLOYEE_URL' | 'ORACLE_DEPARTMENT_HEAD_URL' | 'ORACLE_EMPLOYER_MAPPING_URL' | 'ORACLE_BEARER_TOKEN'>) {
  return new OracleClient(config, createOracleFixtureFetch({
    employee: config.ORACLE_EMPLOYEE_URL,
    departmentHead: config.ORACLE_DEPARTMENT_HEAD_URL,
    employerMapping: config.ORACLE_EMPLOYER_MAPPING_URL
  }));
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}
