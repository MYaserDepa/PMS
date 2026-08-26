import { ApplicationError } from '../errors.js';
import type { BackendConfig } from '../config.js';
import {
  departmentHeadSchema,
  extractEmployerMappings,
  extractCollection,
  oracleEmployeeSchema,
  type DepartmentHead,
  type EmployerMapping,
  type OracleEmployee
} from './types.js';

type Fetch = typeof fetch;

export class OracleClient {
  constructor(
    private readonly config: Pick<BackendConfig, 'ORACLE_EMPLOYEE_URL' | 'ORACLE_DEPARTMENT_HEAD_URL' | 'ORACLE_EMPLOYER_MAPPING_URL' | 'ORACLE_BEARER_TOKEN'>,
    private readonly request: Fetch = fetch
  ) {}

  private async get(url: string, operation: string): Promise<unknown> {
    let response: Response;
    try {
      response = await this.request(url, {
        headers: { authorization: `Bearer ${this.config.ORACLE_BEARER_TOKEN}`, accept: 'application/json' },
        signal: AbortSignal.timeout(15_000)
      });
    } catch {
      throw new ApplicationError(`${operation} is unavailable`, 502, 'ORACLE_UNAVAILABLE');
    }
    if (!response.ok) {
      throw new ApplicationError(`${operation} failed with upstream status ${response.status}`, 502, 'ORACLE_UPSTREAM_ERROR');
    }
    try {
      return await response.json();
    } catch {
      throw new ApplicationError(`${operation} returned invalid JSON`, 502, 'ORACLE_INVALID_RESPONSE');
    }
  }

  async listEmployees(department?: string): Promise<OracleEmployee[]> {
    const payload = await this.get(this.config.ORACLE_EMPLOYEE_URL, 'Employee lookup');
    let employees: OracleEmployee[];
    try {
      employees = extractCollection(payload).map((record) => oracleEmployeeSchema.parse(record));
    } catch {
      throw new ApplicationError('Employee lookup returned an invalid payload', 502, 'ORACLE_INVALID_EMPLOYEE_PAYLOAD');
    }
    return employees.filter((employee) => employee.USER_EXISTS === 'Y' && (!department || employee.DEPARTMENT === department));
  }

  async getEmployee(employeeNumber: string): Promise<OracleEmployee> {
    const matches = (await this.listEmployees()).filter((employee) => employee.EMPLOYEE_NUMBER === employeeNumber.trim());
    if (matches.length === 0) throw new ApplicationError('Employee was not found or is not eligible', 404, 'EMPLOYEE_NOT_FOUND');
    if (matches.length > 1) throw new ApplicationError('Employee lookup returned duplicate employee numbers', 502, 'ORACLE_DUPLICATE_EMPLOYEE');
    return matches[0]!;
  }

  async listDepartmentHeads(): Promise<DepartmentHead[]> {
    const payload = await this.get(this.config.ORACLE_DEPARTMENT_HEAD_URL, 'Department Head lookup');
    try {
      return extractCollection(payload).map((record) => departmentHeadSchema.parse(record));
    } catch {
      throw new ApplicationError('Department Head lookup returned an invalid payload', 502, 'ORACLE_INVALID_HEAD_PAYLOAD');
    }
  }

  async listEmployerMappings(): Promise<EmployerMapping[]> {
    const payload = await this.get(this.config.ORACLE_EMPLOYER_MAPPING_URL, 'Employer mapping lookup');
    try {
      return extractEmployerMappings(payload);
    } catch {
      throw new ApplicationError('Employer mapping lookup returned an invalid payload', 502, 'ORACLE_INVALID_EMPLOYER_PAYLOAD');
    }
  }
}
