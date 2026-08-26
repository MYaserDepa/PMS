import { z } from 'zod';

const employeeNumber = z.union([z.string(), z.number()]).transform((value) => String(value).trim()).pipe(z.string().min(1));
const nullableText = z.union([z.string(), z.number(), z.null()]).transform((value) => value === null ? null : String(value).trim() || null);
const nullableGrade = z.union([z.string(), z.number(), z.null()]).transform((value, context) => {
  if (value === null || value === '') return null;
  const grade = Number(value);
  if (!Number.isFinite(grade)) {
    context.addIssue({ code: 'custom', message: 'GRADE must be numeric or null' });
    return z.NEVER;
  }
  return grade;
});

export const oracleEmployeeSchema = z.object({
  EMPLOYEE_NUMBER: employeeNumber,
  FIRST_NAME: nullableText,
  LAST_NAME: nullableText,
  FULL_NAME: nullableText,
  EMAIL_ADDRESS: nullableText,
  DEPARTMENT: nullableText,
  JOB: nullableText,
  POSITION: nullableText,
  POSITION_NAME: nullableText,
  GRADE: nullableGrade,
  SUPERVISOR_NO: nullableText,
  SUPERVISOR: nullableText,
  EMPLOYER: nullableText,
  USER_EXISTS: z.enum(['Y', 'N'])
});

export type OracleEmployee = z.infer<typeof oracleEmployeeSchema>;

export const departmentHeadSchema = z.object({
  NAME: nullableText,
  ORGANIZATION_ID: nullableText,
  ORG_INFORMATION2: nullableText,
  FULL_NAME: nullableText,
  EMPLOYEE_NUMBER: employeeNumber
});

export type DepartmentHead = z.infer<typeof departmentHeadSchema>;

export interface EmployerMapping {
  employerKey: string;
  organizationName: string;
}

export function extractCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['items', 'value', 'data', 'rows']) {
      if (Array.isArray(record[key])) return record[key];
    }
  }
  throw new Error('Expected an array response or an object containing items, value, data, or rows');
}

export function parseEmployerMappings(record: unknown): EmployerMapping[] {
  if (!record || typeof record !== 'object') throw new Error('Employer mapping record must be an object');
  const source = record as Record<string, unknown>;
  const organizationName = source.org_Name;
  if (typeof organizationName !== 'string' || !organizationName.trim()) throw new Error('Employer mapping requires org_Name');
  const nestedGrid: unknown[] | null = Array.isArray(source.dataGrid1) ? source.dataGrid1 : null;
  const nestedEmployerValues: unknown[] = nestedGrid
    ? nestedGrid
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && (item as Record<string, unknown>).fieldName === 'EMPLOYER')
      .map((item) => item.value)
    : [];
  const directEmployer = source.EMPLOYER ?? source.employer ?? source.employerName ?? source.company ?? source.org_Code;
  const values: unknown[] = nestedGrid ? nestedEmployerValues : [directEmployer];
  if (values.some((value) => typeof value !== 'string' && typeof value !== 'number')) {
    throw new Error('Employer mapping requires an explicit employer key');
  }
  const nonBlankValues = values
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .filter((value) => String(value).trim());
  const uniqueKeys = [...new Map(nonBlankValues.map((value) => [String(value).trim().toLocaleLowerCase(), String(value).trim()])).values()];
  return uniqueKeys.map((employerKey) => ({ employerKey, organizationName: organizationName.trim() }));
}

export function extractEmployerMappings(payload: unknown): EmployerMapping[] {
  if (payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).results)) {
    const companies: unknown[] = [];
    for (const submission of (payload as Record<string, unknown>).results as unknown[]) {
      if (!submission || typeof submission !== 'object') throw new Error('Employer mapping submission must be an object');
      const formDataIds = (submission as Record<string, unknown>).formDataIds;
      if (!Array.isArray(formDataIds)) throw new Error('Employer mapping submission requires formDataIds');
      for (const formData of formDataIds) {
        if (!formData || typeof formData !== 'object') throw new Error('Employer mapping form data must be an object');
        const data = (formData as Record<string, unknown>).data;
        if (!data || typeof data !== 'object' || !Array.isArray((data as Record<string, unknown>).dataGrid)) {
          throw new Error('Employer mapping form data requires data.dataGrid');
        }
        companies.push(...((data as Record<string, unknown>).dataGrid as unknown[]));
      }
    }
    return companies.flatMap(parseEmployerMappings);
  }
  return extractCollection(payload).flatMap(parseEmployerMappings);
}
