import { describe, expect, it } from 'vitest';
import { allowedLineFields, canMutateScorecard, canViewScorecard } from '../src/authorization/policies.js';
import type { CurrentUser } from '../src/auth/service.js';

const employee: CurrentUser = {
  employeeNumber: 'E1', fullName: 'Employee One', department: 'Delivery', isHrAdmin: false, isItAdmin: false,
  isManager: false, departmentHeadStatus: 'NotHead'
};
const scorecard = {
  employeeNumber: 'E1', supervisorNumber: 'M1', department: 'Delivery', status: 'NotStarted', currentAssigneeEmployeeNumber: 'E1'
};

describe('scorecard authorization policies', () => {
  it('allows own, direct-report, Department Head department, HR, and IT technical visibility', () => {
    expect(canViewScorecard(employee, scorecard)).toBe(true);
    expect(canViewScorecard({ ...employee, employeeNumber: 'M1', isManager: true }, scorecard)).toBe(true);
    expect(canViewScorecard({ ...employee, employeeNumber: 'H1', departmentHeadStatus: 'Head' }, scorecard)).toBe(true);
    expect(canViewScorecard({ ...employee, employeeNumber: 'HR', isHrAdmin: true }, scorecard)).toBe(true);
    expect(canViewScorecard({ ...employee, employeeNumber: 'IT', isItAdmin: true }, scorecard)).toBe(true);
  });

  it('denies unrelated users and Department Heads from another department', () => {
    expect(canViewScorecard({ ...employee, employeeNumber: 'OTHER' }, scorecard)).toBe(false);
    expect(canViewScorecard({ ...employee, employeeNumber: 'H2', department: 'Finance', departmentHeadStatus: 'Head' }, scorecard)).toBe(false);
  });

  it('limits mutation to the current assignee and excludes IT and closed scorecards', () => {
    expect(canMutateScorecard(employee, scorecard)).toBe(true);
    expect(canMutateScorecard({ ...employee, employeeNumber: 'M1', isManager: true }, scorecard)).toBe(false);
    expect(canMutateScorecard({ ...employee, isItAdmin: true }, scorecard)).toBe(false);
    expect(canMutateScorecard(employee, { ...scorecard, status: 'Closed' })).toBe(false);
  });
});

describe('field ownership policies', () => {
  it('keeps employee and manager fields separate by phase and form', () => {
    expect(allowedLineFields('DUGLeadership', 'GoalSetting', 'Employee')).toEqual(expect.objectContaining(new Set(['title', 'perspective', 'weight'])));
    expect(allowedLineFields('DUGLeadership', 'GoalSetting', 'LineManager').size).toBe(0);
    expect(allowedLineFields('DUGLeadership', 'YearEnd', 'Employee')).toEqual(new Set(['actual', 'selfRating', 'employeeComment', 'employeeEvidenceUrl']));
    expect(allowedLineFields('DUGLeadership', 'YearEnd', 'LineManager')).toEqual(new Set(['managerRating', 'managerComment', 'managerEvidenceUrl']));
    expect(allowedLineFields('AdministrativeSupport', 'YearEnd', 'Employee').has('selfRating')).toBe(false);
  });
});
