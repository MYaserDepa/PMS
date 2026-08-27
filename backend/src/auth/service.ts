import type { BackendConfig } from '../config.js';
import type { AssignmentDataService, DepartmentHeadResolution } from '../oracle/assignment-data.js';
import type { OracleClient } from '../oracle/client.js';
import type { OracleEmployee } from '../oracle/types.js';

export interface CurrentUser {
  employeeNumber: string;
  fullName: string;
  department: string | null;
  position: string | null;
  isHrAdmin: boolean;
  isItAdmin: boolean;
  isManager: boolean;
  departmentHeadStatus: DepartmentHeadResolution | 'Unavailable';
}

export class IdentityService {
  constructor(
    private readonly oracle: OracleClient,
    private readonly assignmentData: AssignmentDataService,
    private readonly config: Pick<BackendConfig, 'HR_ADMIN_EMPLOYEE_NUMBER' | 'IT_ADMIN_EMPLOYEE_NUMBER'>
  ) {}

  private async currentUser(employee: OracleEmployee): Promise<CurrentUser> {
    let departmentHeadStatus: CurrentUser['departmentHeadStatus'];
    try {
      departmentHeadStatus = await this.assignmentData.departmentHeadStatus(employee.EMPLOYEE_NUMBER);
    } catch {
      departmentHeadStatus = 'Unavailable';
    }
    const employees = await this.oracle.listEmployees();
    return {
      employeeNumber: employee.EMPLOYEE_NUMBER,
      fullName: employee.FULL_NAME ?? (`${employee.FIRST_NAME ?? ''} ${employee.LAST_NAME ?? ''}`.trim() || employee.EMPLOYEE_NUMBER),
      department: employee.DEPARTMENT,
      position: employee.POSITION ?? employee.POSITION_NAME,
      isHrAdmin: employee.EMPLOYEE_NUMBER === this.config.HR_ADMIN_EMPLOYEE_NUMBER,
      isItAdmin: employee.EMPLOYEE_NUMBER === this.config.IT_ADMIN_EMPLOYEE_NUMBER,
      isManager: employees.some((candidate) => candidate.SUPERVISOR_NO === employee.EMPLOYEE_NUMBER),
      departmentHeadStatus
    };
  }

  async login(employeeNumber: string): Promise<CurrentUser> {
    return this.currentUser(await this.oracle.getEmployee(employeeNumber));
  }
}
