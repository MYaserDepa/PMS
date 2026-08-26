import { ApplicationError } from '../errors.js';
import type { OracleClient } from './client.js';

export type DepartmentHeadResolution = 'Head' | 'NotHead';
export type EmployerClassification = 'DUG' | 'KBU';

const normalize = (value: string) => value.trim().toLocaleLowerCase('en');

export class AssignmentDataService {
  constructor(private readonly oracle: OracleClient) {}

  async departmentHeadStatus(employeeNumber: string): Promise<DepartmentHeadResolution> {
    const normalizedEmployeeNumber = employeeNumber.trim();
    const matches = (await this.oracle.listDepartmentHeads()).filter((head) => head.EMPLOYEE_NUMBER === normalizedEmployeeNumber);
    return matches.length > 0 ? 'Head' : 'NotHead';
  }

  async employerClassification(employer: string | null): Promise<EmployerClassification> {
    if (!employer?.trim()) throw new ApplicationError('Employee has no employer', 422, 'MISSING_EMPLOYER');
    const matches = (await this.oracle.listEmployerMappings()).filter(
      (mapping) => normalize(mapping.employerKey) === normalize(employer)
    );
    if (matches.length !== 1) {
      throw new ApplicationError('Employer could not be resolved unambiguously', 422, 'UNRESOLVED_EMPLOYER');
    }
    return matches[0]!.organizationName === 'DEPA United Group PJSC' ? 'DUG' : 'KBU';
  }
}
