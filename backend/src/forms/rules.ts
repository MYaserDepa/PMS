import type { FormType, PerformancePhase } from '../database/repositories.js';
import { ApplicationError } from '../errors.js';

export interface RatingRow {
  weight: number;
  managerRating: number | null;
}

export interface FormLine {
  id?: string;
  perspective?: string | null;
  performanceArea?: string | null;
  title?: string | null;
  linkedStrategyReferenceId?: string | null;
  measureDescription?: string | null;
  target?: string | null;
  weight?: number | null;
  actual?: string | null;
  midYearStatus?: string | null;
  midYearComment?: string | null;
  selfRating?: number | null;
  employeeComment?: string | null;
  managerRating?: number | null;
  managerComment?: string | null;
  employeeEvidenceUrl?: string | null;
  managerEvidenceUrl?: string | null;
}

const dugPerspectives = new Set(['Customer', 'Financials', 'People & Culture', 'Strategic Initiatives']);
const kbuPerspectives = new Set(['Business Development', 'Backlog & New Awards', 'Projects', 'Financials', 'Strategic Initiatives']);
const performanceAreas = new Set([
  'Project / Delivery', 'Cost / Productivity', 'Quality', 'Schedule / Milestones',
  'Customer / Stakeholder', 'Technical / Functional'
]);
const midYearStatuses = new Set(['OnTrack', 'AtRisk', 'Blocked']);

function fail(message: string, code = 'FORM_VALIDATION_FAILED'): never {
  throw new ApplicationError(message, 422, code);
}

function present(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function validateWeightTotal(rows: FormLine[]): void {
  if (rows.some((row) => row.weight === null || row.weight === undefined || row.weight <= 0 || row.weight > 100)) {
    fail('Each weight must be greater than 0 and no more than 100', 'INVALID_WEIGHT');
  }
  const thousandths = rows.reduce((sum, row) => sum + Math.round(row.weight! * 1000), 0);
  if (thousandths !== 100_000) fail('Total weight must equal exactly 100 percent', 'INVALID_WEIGHT_TOTAL');
}

function validatePlan(formType: FormType, rows: FormLine[], phase: PerformancePhase): void {
  if (formType === 'DUGLeadership' || formType === 'KBULeadership') {
    if (rows.length < 1) fail('At least one objective is required', 'INVALID_ROW_COUNT');
  } else if (formType === 'DepartmentHeadKPI' || formType === 'ProjectDeliveryProfessionalKPI') {
    if (rows.length < 4 || rows.length > 6) fail('This form requires 4 to 6 KPIs', 'INVALID_ROW_COUNT');
  }
  for (const row of rows) {
    if (!present(row.title) || !present(row.measureDescription) || !present(row.target)) {
      fail('Every objective or KPI requires wording, a measure, and a target', 'MISSING_PLAN_FIELD');
    }
    if (!row.linkedStrategyReferenceId) fail('Every objective or KPI requires a strategy link', 'MISSING_STRATEGY_LINK');
    if (formType === 'DUGLeadership' && !dugPerspectives.has(row.perspective ?? '')) fail('A valid DUG perspective is required', 'INVALID_PERSPECTIVE');
    if (formType === 'KBULeadership' && !kbuPerspectives.has(row.perspective ?? '')) fail('A valid KBU perspective is required', 'INVALID_PERSPECTIVE');
    if (formType === 'ProjectDeliveryProfessionalKPI' && !performanceAreas.has(row.performanceArea ?? '')) {
      fail('A valid performance area is required', 'INVALID_PERFORMANCE_AREA');
    }
    if (phase === 'MidYear') {
      if (!midYearStatuses.has(row.midYearStatus ?? '')) fail('Mid-Year status must be OnTrack, AtRisk, or Blocked', 'INVALID_MID_YEAR_STATUS');
    }
  }
  validateWeightTotal(rows);
}

function validateRating(rating: number | null | undefined, label: string): asserts rating is number {
  if (!Number.isInteger(rating) || rating! < 1 || rating! > 5) fail(`${label} must be an integer from 1 to 5`, 'INVALID_RATING');
}

export function validateEmployeeSubmission(formType: FormType, phase: PerformancePhase, rows: FormLine[]): void {
  if (phase === 'GoalSetting' || phase === 'MidYear') {
    if (formType !== 'AdministrativeSupport') validatePlan(formType, rows, phase);
    else {
      if (rows.length !== 6) fail('Administrative / Support requires the six fixed standards', 'INVALID_ROW_COUNT');
      validateWeightTotal(rows);
    }
    return;
  }
  if (phase !== 'YearEnd') return;
  for (const row of rows) {
    if (formType !== 'AdministrativeSupport') {
      if (!present(row.actual)) fail('Actual is required for every KPI or objective', 'MISSING_ACTUAL');
      validateRating(row.selfRating, 'SelfRating');
      if (row.selfRating >= 4 && !present(row.employeeEvidenceUrl)) {
        fail('Employee evidence is required for SelfRating 4 or 5', 'EMPLOYEE_EVIDENCE_REQUIRED');
      }
    }
  }
}

export function validateManagerApproval(formType: FormType, phase: PerformancePhase, rows: FormLine[]): void {
  if (phase !== 'YearEnd') return;
  for (const row of rows) {
    validateRating(row.managerRating, 'ManagerRating');
    if (row.managerRating >= 4 && !present(row.managerEvidenceUrl)) {
      fail('Manager evidence is required for ManagerRating 4 or 5', 'MANAGER_EVIDENCE_REQUIRED');
    }
  }
  if (formType === 'AdministrativeSupport' && rows.some((row) => row.selfRating !== null && row.selfRating !== undefined)) {
    fail('Administrative / Support does not use SelfRating', 'SELF_RATING_NOT_ALLOWED');
  }
}

export function calculateOverallRating(rows: RatingRow[]): number | null {
  if (rows.length === 0 || rows.some((row) => !Number.isInteger(row.managerRating) || row.managerRating! < 1 || row.managerRating! > 5)) return null;
  const value = rows.reduce((sum, row) => sum + row.managerRating! * row.weight / 100, 0);
  return Math.round(value * 10) / 10;
}

export const formOptions = {
  dugPerspectives: [...dugPerspectives],
  kbuPerspectives: [...kbuPerspectives],
  performanceAreas: [...performanceAreas],
  midYearStatuses: [...midYearStatuses]
};
