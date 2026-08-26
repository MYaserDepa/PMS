import { describe, expect, it } from 'vitest';
import { calculateOverallRating, validateEmployeeSubmission, validateManagerApproval, type FormLine } from '../src/forms/rules.js';

const linked = (overrides: Partial<FormLine> = {}): FormLine => ({
  title: 'Deliver outcome', measureDescription: 'Completion', target: '100%', weight: 25,
  linkedStrategyReferenceId: '1', ...overrides
});

describe('form plan validation', () => {
  it('validates DUG and KBU perspectives, required links, and exact total weight', () => {
    expect(() => validateEmployeeSubmission('DUGLeadership', 'GoalSetting', [linked({ perspective: 'Customer', weight: 100 })])).not.toThrow();
    expect(() => validateEmployeeSubmission('KBULeadership', 'GoalSetting', [linked({ perspective: 'Projects', weight: 100 })])).not.toThrow();
    expect(() => validateEmployeeSubmission('DUGLeadership', 'GoalSetting', [linked({ perspective: 'Projects', weight: 100 })])).toThrow(/valid DUG perspective/);
    expect(() => validateEmployeeSubmission('DUGLeadership', 'GoalSetting', [linked({ perspective: 'Customer', weight: 99.999 })])).toThrow(/exactly 100/);
    expect(() => validateEmployeeSubmission('DUGLeadership', 'GoalSetting', [linked({ perspective: 'Customer', linkedStrategyReferenceId: null, weight: 100 })])).toThrow(/strategy link/);
  });

  it('requires 4 to 6 rows for Department Head and Project forms', () => {
    const four = [linked(), linked(), linked(), linked()];
    expect(() => validateEmployeeSubmission('DepartmentHeadKPI', 'GoalSetting', four)).not.toThrow();
    expect(() => validateEmployeeSubmission('DepartmentHeadKPI', 'GoalSetting', four.slice(0, 3))).toThrow(/4 to 6/);
    expect(() => validateEmployeeSubmission('ProjectDeliveryProfessionalKPI', 'GoalSetting', four.map((row) => ({ ...row, performanceArea: 'Quality' })))).not.toThrow();
    expect(() => validateEmployeeSubmission('ProjectDeliveryProfessionalKPI', 'GoalSetting', four.map((row) => ({ ...row, performanceArea: 'Invalid' })))).toThrow(/performance area/);
  });

  it('allows only the three Mid-Year statuses where applicable', () => {
    const rows = ['OnTrack', 'AtRisk', 'Blocked', 'OnTrack'].map((midYearStatus) => linked({ midYearStatus }));
    expect(() => validateEmployeeSubmission('DepartmentHeadKPI', 'MidYear', rows)).not.toThrow();
    expect(() => validateEmployeeSubmission('DepartmentHeadKPI', 'MidYear', rows.map((row, index) => index ? row : { ...row, midYearStatus: 'Done' }))).toThrow(/Mid-Year status/);
  });
});

describe('rating, evidence, and calculation rules', () => {
  it.each([1, 2, 3])('accepts SelfRating %s without evidence', (selfRating) => {
    expect(() => validateEmployeeSubmission('DUGLeadership', 'YearEnd', [linked({ actual: 'Done', selfRating })])).not.toThrow();
  });

  it.each([4, 5])('requires employee evidence for SelfRating %s', (selfRating) => {
    expect(() => validateEmployeeSubmission('DUGLeadership', 'YearEnd', [linked({ actual: 'Done', selfRating })])).toThrow(/Employee evidence/);
    expect(() => validateEmployeeSubmission('DUGLeadership', 'YearEnd', [linked({ actual: 'Done', selfRating, employeeEvidenceUrl: 'REF-1' })])).not.toThrow();
  });

  it.each([4, 5])('requires separate manager evidence for ManagerRating %s', (managerRating) => {
    expect(() => validateManagerApproval('DUGLeadership', 'YearEnd', [linked({ managerRating, employeeEvidenceUrl: 'EMP-1' })])).toThrow(/Manager evidence/);
    expect(() => validateManagerApproval('DUGLeadership', 'YearEnd', [linked({ managerRating, managerEvidenceUrl: 'MGR-1' })])).not.toThrow();
  });

  it('enforces integer rating bounds and omits partial overall ratings', () => {
    expect(() => validateManagerApproval('DUGLeadership', 'YearEnd', [linked({ managerRating: 0 })])).toThrow(/integer from 1 to 5/);
    expect(() => validateManagerApproval('DUGLeadership', 'YearEnd', [linked({ managerRating: 3.5 })])).toThrow(/integer from 1 to 5/);
    expect(calculateOverallRating([{ weight: 40, managerRating: 4 }, { weight: 60, managerRating: 3 }])).toBe(3.4);
    expect(calculateOverallRating([{ weight: 50.5, managerRating: 5 }, { weight: 49.5, managerRating: 4 }])).toBe(4.5);
    expect(calculateOverallRating([{ weight: 50, managerRating: 4 }, { weight: 50, managerRating: null }])).toBeNull();
  });

  it.each(['DUGLeadership', 'KBULeadership', 'DepartmentHeadKPI', 'ProjectDeliveryProfessionalKPI', 'AdministrativeSupport']) (
    'uses the same weighted formula for %s',
    () => expect(calculateOverallRating([{ weight: 40, managerRating: 5 }, { weight: 60, managerRating: 3 }])).toBe(3.8)
  );

  it('does not require Administrative / Support SelfRating', () => {
    expect(() => validateEmployeeSubmission('AdministrativeSupport', 'YearEnd', [{ employeeComment: 'Completed' }])).not.toThrow();
  });
});
