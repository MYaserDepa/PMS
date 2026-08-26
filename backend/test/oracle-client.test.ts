import { describe, expect, it, vi } from 'vitest';
import { AssignmentDataService } from '../src/oracle/assignment-data.js';
import { OracleClient } from '../src/oracle/client.js';
import { departmentHeads, employerMappingPayload, employerMappings, jsonResponse, oracleEmployees } from './fixtures/oracle.js';

const config = {
  ORACLE_EMPLOYEE_URL: 'https://oracle.example/employees',
  ORACLE_DEPARTMENT_HEAD_URL: 'https://oracle.example/heads',
  ORACLE_EMPLOYER_MAPPING_URL: 'https://oracle.example/employers',
  ORACLE_BEARER_TOKEN: 'test-token-that-must-not-leak'
};

describe('Oracle employee client', () => {
  it('maps eligible records, filters by department, and sends the token only upstream', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ metaData: [], rows: oracleEmployees }));
    const employees = await new OracleClient(config, request).listEmployees('Delivery');
    expect(employees.some((employee) => employee.EMPLOYEE_NUMBER === '99999')).toBe(false);
    expect(employees.some((employee) => employee.EMPLOYEE_NUMBER === '18001')).toBe(true);
    expect(request).toHaveBeenCalledWith(config.ORACLE_EMPLOYEE_URL, expect.objectContaining({
      headers: expect.objectContaining({ authorization: `Bearer ${config.ORACLE_BEARER_TOKEN}` })
    }));
  });

  it('rejects unknown, empty, malformed, unauthorized, and unavailable responses clearly', async () => {
    const unknown = new OracleClient(config, vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ items: oracleEmployees })));
    await expect(unknown.getEmployee('DOES-NOT-EXIST')).rejects.toMatchObject({ code: 'EMPLOYEE_NOT_FOUND', statusCode: 404 });
    const empty = new OracleClient(config, vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ items: [] })));
    await expect(empty.getEmployee('18001')).rejects.toMatchObject({ code: 'EMPLOYEE_NOT_FOUND' });
    const malformed = new OracleClient(config, vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ items: [{ EMPLOYEE_NUMBER: '1' }] })));
    await expect(malformed.listEmployees()).rejects.toMatchObject({ code: 'ORACLE_INVALID_EMPLOYEE_PAYLOAD' });
    const unauthorized = new OracleClient(config, vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 401)));
    await expect(unauthorized.listEmployees()).rejects.toMatchObject({ code: 'ORACLE_UPSTREAM_ERROR' });
    const unavailable = new OracleClient(config, vi.fn<typeof fetch>().mockRejectedValue(new Error('network')));
    await expect(unavailable.listEmployees()).rejects.toMatchObject({ code: 'ORACLE_UNAVAILABLE' });
  });
});

describe('assignment integration data', () => {
  function clientFor(headPayload: unknown = { value: departmentHeads }, mappingPayload: unknown = employerMappingPayload()) {
    return new OracleClient(config, vi.fn<typeof fetch>().mockImplementation((url) => {
      if (url === config.ORACLE_DEPARTMENT_HEAD_URL) return Promise.resolve(jsonResponse(headPayload));
      if (url === config.ORACLE_EMPLOYER_MAPPING_URL) return Promise.resolve(jsonResponse(mappingPayload));
      return Promise.resolve(jsonResponse({ items: oracleEmployees }));
    }));
  }

  it('normalizes numeric/string head numbers and tolerates duplicate matching head records', async () => {
    const service = new AssignmentDataService(clientFor());
    await expect(service.departmentHeadStatus('17001')).resolves.toBe('Head');
    await expect(service.departmentHeadStatus('17002')).resolves.toBe('NotHead');
  });

  it('classifies DUG and non-DUG employers only through an unambiguous mapping', async () => {
    const service = new AssignmentDataService(clientFor());
    await expect(service.employerClassification('DUG Corporate')).resolves.toBe('DUG');
    await expect(service.employerClassification('DUG Holdings')).resolves.toBe('DUG');
    await expect(service.employerClassification('depa interiors')).resolves.toBe('KBU');
    await expect(service.employerClassification(null)).rejects.toMatchObject({ code: 'MISSING_EMPLOYER' });
    await expect(service.employerClassification('Unknown')).rejects.toMatchObject({ code: 'UNRESOLVED_EMPLOYER' });
  });

  it('rejects malformed and duplicate employer mappings', async () => {
    await expect(new AssignmentDataService(clientFor(undefined, employerMappingPayload([{
      org_Name: 'DUG', dataGrid1: [{ fieldName: 'EMPLOYER', value: {} }]
    }]))).employerClassification('DUG')).rejects.toMatchObject({
      code: 'ORACLE_INVALID_EMPLOYER_PAYLOAD'
    });
    const duplicate = employerMappingPayload([...employerMappings, {
      org_Name: 'Other Company', dataGrid1: [{ fieldName: 'EMPLOYER', value: 'DUG Corporate' }]
    }]);
    await expect(new AssignmentDataService(clientFor(undefined, duplicate)).employerClassification('DUG Corporate')).rejects.toMatchObject({
      code: 'UNRESOLVED_EMPLOYER'
    });
  });
});
