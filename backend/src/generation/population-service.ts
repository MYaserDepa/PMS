import type { BackendConfig } from '../config.js';
import { ApplicationError } from '../errors.js';
import { assignForm, type AssignmentResult } from '../assignment/form-assignment.js';
import { AssignmentDataService } from '../oracle/assignment-data.js';
import type { OracleClient } from '../oracle/client.js';
import type { OracleEmployee } from '../oracle/types.js';
import { getPool, inTransaction } from '../database/pool.js';
import { repositories, RoleCategoryRepository, ScorecardRepository, type RoleCategory } from '../database/repositories.js';

export interface PopulationRow {
  employeeNumber: string;
  fullName: string;
  grade: number | null;
  department: string | null;
  employer: string | null;
  employerClassification: 'DUG' | 'KBU' | 'Unresolved' | 'NotApplicable';
  departmentHeadStatus: 'Head' | 'NotHead' | 'Unavailable' | 'NotApplicable';
  roleCategory: RoleCategory | null;
  managerNumber: string | null;
  managerName: string | null;
  formType: AssignmentResult['formType'];
  status: AssignmentResult['status'];
}

export interface GenerationOutcome {
  employeeNumber: string;
  outcome: 'Created' | 'AlreadyExists' | 'ValidationFailed';
  status: string;
  scorecardId?: string;
}

export interface GenerationSummary {
  created: number;
  alreadyExisting: number;
  validationFailed: number;
  outcomes: GenerationOutcome[];
}

export class PopulationService {
  private readonly assignmentData: AssignmentDataService;

  constructor(
    private readonly oracle: OracleClient,
    private readonly config: Pick<BackendConfig, 'HR_ADMIN_EMPLOYEE_NUMBER'>
  ) {
    this.assignmentData = new AssignmentDataService(oracle);
  }

  async departments(): Promise<string[]> {
    const departments = (await this.oracle.listEmployees())
      .map((employee) => employee.DEPARTMENT)
      .filter((department): department is string => Boolean(department));
    return [...new Set(departments)].sort((left, right) => left.localeCompare(right));
  }

  private async roleCategory(employeeNumber: string): Promise<RoleCategory | null> {
    return (await new RoleCategoryRepository(getPool()).find(employeeNumber))?.role_category ?? null;
  }

  private async resolve(employee: OracleEmployee): Promise<PopulationRow> {
    const alreadyExists = await new ScorecardRepository(getPool()).exists(employee.EMPLOYEE_NUMBER);
    let departmentHeadStatus: PopulationRow['departmentHeadStatus'] = 'NotApplicable';
    let employerClassification: PopulationRow['employerClassification'] = 'NotApplicable';
    let roleCategory: RoleCategory | null = null;

    if (employee.GRADE !== null && employee.GRADE >= 18) {
      try {
        employerClassification = await this.assignmentData.employerClassification(employee.EMPLOYER);
      } catch {
        employerClassification = 'Unresolved';
      }
    } else if (employee.GRADE !== null) {
      try {
        departmentHeadStatus = await this.assignmentData.departmentHeadStatus(employee.EMPLOYEE_NUMBER);
      } catch {
        departmentHeadStatus = 'Unavailable';
      }
      if (departmentHeadStatus === 'NotHead') roleCategory = await this.roleCategory(employee.EMPLOYEE_NUMBER);
    }

    const assignment = assignForm({
      grade: employee.GRADE,
      department: employee.DEPARTMENT,
      employer: employee.EMPLOYER,
      supervisorNumber: employee.SUPERVISOR_NO && employee.SUPERVISOR ? employee.SUPERVISOR_NO : null,
      departmentHeadStatus,
      employerClassification,
      roleCategory,
      scorecardAlreadyExists: alreadyExists
    });
    return {
      employeeNumber: employee.EMPLOYEE_NUMBER,
      fullName: employee.FULL_NAME ?? employee.EMPLOYEE_NUMBER,
      grade: employee.GRADE,
      department: employee.DEPARTMENT,
      employer: employee.EMPLOYER,
      employerClassification,
      departmentHeadStatus,
      roleCategory,
      managerNumber: employee.SUPERVISOR_NO,
      managerName: employee.SUPERVISOR,
      formType: assignment.formType,
      status: assignment.status
    };
  }

  async populate(department: string): Promise<PopulationRow[]> {
    if (!department.trim()) throw new ApplicationError('Department is required', 400, 'INVALID_DEPARTMENT');
    const employees = await this.oracle.listEmployees(department);
    return Promise.all(employees.map((employee) => this.resolve(employee)));
  }

  async generate(employeeNumbers: string[]): Promise<GenerationSummary> {
    const uniqueNumbers = [...new Set(employeeNumbers.map((number) => number.trim()).filter(Boolean))];
    if (uniqueNumbers.length === 0) throw new ApplicationError('Select at least one employee', 400, 'NO_EMPLOYEES_SELECTED');
    const outcomes: GenerationOutcome[] = [];

    for (const employeeNumber of uniqueNumbers) {
      let employee: OracleEmployee;
      try {
        employee = await this.oracle.getEmployee(employeeNumber);
      } catch (error) {
        if (error instanceof ApplicationError && error.statusCode === 404) {
          outcomes.push({ employeeNumber, outcome: 'ValidationFailed', status: 'No Valid Form Mapping' });
          continue;
        }
        throw error;
      }
      const current = await this.resolve(employee);
      if (current.status === 'PMS Already Exists') {
        outcomes.push({ employeeNumber, outcome: 'AlreadyExists', status: current.status });
        continue;
      }
      if (current.status !== 'Ready' || !current.formType || !current.managerNumber || !current.managerName || !current.department || current.grade === null) {
        outcomes.push({ employeeNumber, outcome: 'ValidationFailed', status: current.status });
        continue;
      }
      const formType = current.formType;
      const managerNumber = current.managerNumber;
      const managerName = current.managerName;
      const department = current.department;
      const grade = current.grade;

      try {
        const scorecardId = await inTransaction(async (client) => {
          const store = repositories(client);
          const cycle = await store.cycles.get2027();
          if (!cycle) throw new ApplicationError('PMS 2027 cycle is not configured', 500, 'CYCLE_NOT_CONFIGURED');
          const snapshotId = await store.snapshots.create({
            employeeNumber: employee.EMPLOYEE_NUMBER,
            ...(employee.FIRST_NAME ? { firstName: employee.FIRST_NAME } : {}),
            ...(employee.LAST_NAME ? { lastName: employee.LAST_NAME } : {}),
            fullName: current.fullName,
            ...(employee.EMAIL_ADDRESS ? { emailAddress: employee.EMAIL_ADDRESS } : {}),
            department,
            ...(employee.JOB ? { job: employee.JOB } : {}),
            ...(employee.POSITION ? { position: employee.POSITION } : {}),
            ...(employee.POSITION_NAME ? { positionName: employee.POSITION_NAME } : {}),
            grade,
            ...(employee.EMPLOYER ? { employer: employee.EMPLOYER } : {}),
            supervisorNumber: managerNumber,
            supervisorName: managerName,
            ...(current.departmentHeadStatus !== 'NotApplicable' && current.departmentHeadStatus !== 'Unavailable'
              ? { departmentHeadAtCreation: current.departmentHeadStatus === 'Head' }
              : {}),
            ...(current.roleCategory ? { roleCategoryAtCreation: current.roleCategory } : {}),
            resolvedFormType: formType
          });
          const id = await store.scorecards.create({
            employeeSnapshotId: snapshotId,
            cycleId: cycle.id,
            employeeNumber: current.employeeNumber,
            formType,
            assigneeEmployeeNumber: current.employeeNumber
          });
          if (formType === 'AdministrativeSupport') await store.standards.createFromTemplates(id);
          await store.phases.createInitial(id);
          await store.steps.createPhaseSteps(id, 'GoalSetting', current.employeeNumber, managerNumber);
          await store.history.append({
            scorecardId: id,
            phase: 'GoalSetting',
            action: 'Created',
            actorEmployeeNumber: this.config.HR_ADMIN_EMPLOYEE_NUMBER,
            toParticipant: 'Employee'
          });
          return id;
        });
        outcomes.push({ employeeNumber, outcome: 'Created', status: 'Created', scorecardId });
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
          outcomes.push({ employeeNumber, outcome: 'AlreadyExists', status: 'PMS Already Exists' });
          continue;
        }
        throw error;
      }
    }

    return {
      created: outcomes.filter((item) => item.outcome === 'Created').length,
      alreadyExisting: outcomes.filter((item) => item.outcome === 'AlreadyExists').length,
      validationFailed: outcomes.filter((item) => item.outcome === 'ValidationFailed').length,
      outcomes
    };
  }
}
