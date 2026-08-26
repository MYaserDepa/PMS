import type { FormType, RoleCategory } from '../database/repositories.js';
import type { DepartmentHeadResolution, EmployerClassification } from '../oracle/assignment-data.js';

export type PopulateStatus =
  | 'Ready'
  | 'PMS Already Exists'
  | 'Missing RoleCategory'
  | 'Missing Manager'
  | 'Missing Grade'
  | 'Missing Department'
  | 'Missing Employer'
  | 'Unable to Resolve DUG/KBU'
  | 'Unable to Determine Department Head Status'
  | 'No Valid Form Mapping';

export interface AssignmentInput {
  grade: number | null;
  department: string | null;
  employer: string | null;
  supervisorNumber: string | null;
  departmentHeadStatus: DepartmentHeadResolution | 'Unavailable' | 'NotApplicable';
  employerClassification: EmployerClassification | 'Unresolved' | 'NotApplicable';
  roleCategory: RoleCategory | string | null;
  scorecardAlreadyExists?: boolean;
}

export type AssignmentResult =
  | { status: 'Ready'; formType: FormType }
  | { status: Exclude<PopulateStatus, 'Ready'>; formType: null };

const blocked = (status: Exclude<PopulateStatus, 'Ready'>): AssignmentResult => ({ status, formType: null });

export function assignForm(input: AssignmentInput): AssignmentResult {
  if (input.scorecardAlreadyExists) return blocked('PMS Already Exists');
  if (input.grade === null || !Number.isFinite(input.grade)) return blocked('Missing Grade');
  if (!input.department?.trim()) return blocked('Missing Department');
  if (!input.supervisorNumber?.trim()) return blocked('Missing Manager');

  if (input.grade >= 18) {
    if (!input.employer?.trim()) return blocked('Missing Employer');
    if (input.employerClassification === 'Unresolved' || input.employerClassification === 'NotApplicable') {
      return blocked('Unable to Resolve DUG/KBU');
    }
    return {
      status: 'Ready',
      formType: input.employerClassification === 'DUG' ? 'DUGLeadership' : 'KBULeadership'
    };
  }

  if (input.departmentHeadStatus === 'Unavailable' || input.departmentHeadStatus === 'NotApplicable') {
    return blocked('Unable to Determine Department Head Status');
  }
  if (input.departmentHeadStatus === 'Head') return { status: 'Ready', formType: 'DepartmentHeadKPI' };
  if (!input.roleCategory) return blocked('Missing RoleCategory');
  if (input.roleCategory === 'ProjectDeliveryProfessional') {
    return { status: 'Ready', formType: 'ProjectDeliveryProfessionalKPI' };
  }
  if (input.roleCategory === 'AdministrativeSupport') return { status: 'Ready', formType: 'AdministrativeSupport' };
  return blocked('No Valid Form Mapping');
}
