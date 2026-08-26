import type { CurrentUser } from '../auth/service.js';
import type { FormType, PerformancePhase } from '../database/repositories.js';

export interface ScorecardAccessRecord {
  employeeNumber: string;
  supervisorNumber: string;
  department: string;
  status: string;
  currentAssigneeEmployeeNumber: string | null;
}

export function canViewScorecard(user: CurrentUser, scorecard: ScorecardAccessRecord): boolean {
  if (user.isHrAdmin || user.isItAdmin) return true;
  if (scorecard.employeeNumber === user.employeeNumber) return true;
  if (scorecard.supervisorNumber === user.employeeNumber) return true;
  return user.departmentHeadStatus === 'Head' && Boolean(user.department) && scorecard.department === user.department;
}

export function canMutateScorecard(user: CurrentUser, scorecard: ScorecardAccessRecord): boolean {
  return !user.isItAdmin && scorecard.status !== 'Closed' && scorecard.currentAssigneeEmployeeNumber === user.employeeNumber;
}

export type Participant = 'Employee' | 'LineManager';

const sharedEmployeeGoalFields = ['title', 'measureDescription', 'target', 'weight', 'linkedStrategyReferenceId'] as const;
const employeeYearEndFields = ['actual', 'selfRating', 'employeeComment', 'employeeEvidenceUrl'] as const;
const managerYearEndFields = ['managerRating', 'managerComment', 'managerEvidenceUrl'] as const;

export function allowedLineFields(formType: FormType, phase: PerformancePhase, participant: Participant): ReadonlySet<string> {
  if (phase === 'GoalSetting' && participant === 'Employee') {
    if (formType === 'AdministrativeSupport') return new Set();
    const formSpecific = formType === 'DUGLeadership' || formType === 'KBULeadership' ? ['perspective'] :
      formType === 'ProjectDeliveryProfessionalKPI' ? ['performanceArea'] : [];
    return new Set([...sharedEmployeeGoalFields, ...formSpecific]);
  }
  if (phase === 'MidYear') {
    if (participant === 'LineManager') return new Set(['managerComment']);
    if (formType === 'AdministrativeSupport') return new Set(['employeeComment']);
    return new Set([...sharedEmployeeGoalFields, 'perspective', 'performanceArea', 'midYearStatus', 'midYearComment']);
  }
  if (phase === 'YearEnd') {
    if (participant === 'LineManager') return new Set(managerYearEndFields);
    if (formType === 'AdministrativeSupport') return new Set(['employeeComment', 'employeeEvidenceUrl']);
    return new Set(employeeYearEndFields);
  }
  return new Set();
}

export function allowedScorecardFields(phase: PerformancePhase, participant: Participant): ReadonlySet<string> {
  if (phase !== 'Development') return new Set();
  return new Set([participant === 'Employee' ? 'employeeDevelopmentNotes' : 'managerDevelopmentNotes']);
}
