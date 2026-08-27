import { ApplicationError } from '../errors.js';
import type { OracleClient } from './client.js';
import type { DepartmentHead, EmployerMapping } from './types.js';

export type DepartmentHeadResolution = 'Head' | 'NotHead';
export type EmployerClassification = 'DUG' | 'KBU';

const normalize = (value: string) => value.trim().toLocaleLowerCase('en');

export class AssignmentDataService {
  constructor(private readonly oracle: OracleClient) {}

  async departmentHeadStatus(employeeNumber: string, records?: DepartmentHead[]): Promise<DepartmentHeadResolution> {
    const normalizedEmployeeNumber = employeeNumber.trim();
    const matches = (records ?? await this.oracle.listDepartmentHeads())
      .filter((head) => head.EMPLOYEE_NUMBER === normalizedEmployeeNumber);
    return matches.length > 0 ? 'Head' : 'NotHead';
  }

  async departmentHeadDepartments(employeeNumber: string, records?: DepartmentHead[]): Promise<string[]> {
    const normalizedEmployeeNumber = employeeNumber.trim();
    const departments = (records ?? await this.oracle.listDepartmentHeads())
      .filter((head) => head.EMPLOYEE_NUMBER === normalizedEmployeeNumber)
      .map((head) => head.NAME)
      .filter((department): department is string => Boolean(department));
    return [...new Map(departments.map((department) => [normalize(department), department])).values()]
      .sort((left, right) => left.localeCompare(right));
  }

  async departmentHeadNames(department: string | null, records?: DepartmentHead[]): Promise<string[]> {
    if (!department?.trim()) return [];
    const names = (records ?? await this.oracle.listDepartmentHeads())
      .filter((head) => head.NAME && normalize(head.NAME) === normalize(department))
      .map((head) => head.FULL_NAME)
      .filter((name): name is string => Boolean(name));
    return [...new Map(names.map((name) => [normalize(name), name])).values()]
      .sort((left, right) => left.localeCompare(right));
  }

  async employerClassification(employer: string | null, records?: EmployerMapping[]): Promise<EmployerClassification> {
    if (!employer?.trim()) throw new ApplicationError('Employee has no employer', 422, 'MISSING_EMPLOYER');
    const matches = (records ?? await this.oracle.listEmployerMappings()).filter(
      (mapping) => normalize(mapping.employerKey) === normalize(employer)
    );
    const classifications = new Set(matches.map(
      (mapping): EmployerClassification => mapping.organizationName === 'DEPA United Group PJSC' ? 'DUG' : 'KBU'
    ));
    if (classifications.size !== 1) {
      throw new ApplicationError('Employer could not be resolved unambiguously', 422, 'UNRESOLVED_EMPLOYER');
    }
    return [...classifications][0]!;
  }
}
