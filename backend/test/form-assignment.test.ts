import { describe, expect, it } from 'vitest';
import { assignForm, type AssignmentInput } from '../src/assignment/form-assignment.js';

const validBelowGrade18: AssignmentInput = {
  grade: 17,
  department: 'Delivery',
  employer: null,
  supervisorNumber: '30001',
  departmentHeadStatus: 'NotHead',
  employerClassification: 'NotApplicable',
  roleCategory: 'ProjectDeliveryProfessional'
};

describe('strict form assignment decision tree', () => {
  it.each([
    [{ ...validBelowGrade18, grade: 18, employer: 'DUG Corporate', employerClassification: 'DUG', departmentHeadStatus: 'Head', roleCategory: 'AdministrativeSupport' }, 'DUGLeadership'],
    [{ ...validBelowGrade18, grade: 18, employer: 'Depa Interiors', employerClassification: 'KBU', departmentHeadStatus: 'Head' }, 'KBULeadership'],
    [{ ...validBelowGrade18, departmentHeadStatus: 'Head' }, 'DepartmentHeadKPI'],
    [validBelowGrade18, 'ProjectDeliveryProfessionalKPI'],
    [{ ...validBelowGrade18, roleCategory: 'AdministrativeSupport' }, 'AdministrativeSupport']
  ] as const)('assigns one form with branch precedence for %#', (input, formType) => {
    expect(assignForm(input)).toEqual({ status: 'Ready', formType });
  });

  it.each([
    [{ ...validBelowGrade18, scorecardAlreadyExists: true }, 'PMS Already Exists'],
    [{ ...validBelowGrade18, grade: null }, 'Missing Grade'],
    [{ ...validBelowGrade18, department: null }, 'Missing Department'],
    [{ ...validBelowGrade18, supervisorNumber: null }, 'Missing Manager'],
    [{ ...validBelowGrade18, grade: 18, employer: null, employerClassification: 'Unresolved' }, 'Missing Employer'],
    [{ ...validBelowGrade18, grade: 18, employer: 'Unknown', employerClassification: 'Unresolved' }, 'Unable to Resolve DUG/KBU'],
    [{ ...validBelowGrade18, departmentHeadStatus: 'Unavailable' }, 'Unable to Determine Department Head Status'],
    [{ ...validBelowGrade18, roleCategory: null }, 'Missing RoleCategory'],
    [{ ...validBelowGrade18, roleCategory: 'Invalid' }, 'No Valid Form Mapping']
  ] as const)('returns the blocking Populate status for %#', (input, status) => {
    expect(assignForm(input)).toEqual({ status, formType: null });
  });

  it('does not evaluate lower-priority inputs for Grade 18', () => {
    expect(assignForm({
      ...validBelowGrade18,
      grade: 18,
      employer: 'DUG Corporate',
      employerClassification: 'DUG',
      departmentHeadStatus: 'Unavailable',
      roleCategory: null
    })).toEqual({ status: 'Ready', formType: 'DUGLeadership' });
  });
});
