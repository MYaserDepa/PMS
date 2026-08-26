import { z } from 'zod';

const backendConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  ORACLE_EMPLOYEE_URL: z.string().url(),
  ORACLE_DEPARTMENT_HEAD_URL: z.string().url(),
  ORACLE_EMPLOYER_MAPPING_URL: z.string().url(),
  ORACLE_BEARER_TOKEN: z.string().min(1, 'ORACLE_BEARER_TOKEN is required'),
  HR_ADMIN_EMPLOYEE_NUMBER: z.string().regex(/^\d+$/).default('12245'),
  IT_ADMIN_EMPLOYEE_NUMBER: z.string().regex(/^\d+$/).default('21975'),
  BACKEND_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173')
});

export type BackendConfig = z.infer<typeof backendConfigSchema>;

export function parseConfig(environment: NodeJS.ProcessEnv): BackendConfig {
  const result = backendConfigSchema.safeParse(environment);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'configuration'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid backend configuration: ${details}`);
  }
  return result.data;
}
