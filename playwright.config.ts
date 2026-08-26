import { defineConfig } from '@playwright/test';
import 'dotenv/config';

const testFrontendUrl = 'http://127.0.0.1:5273';
const testBackendUrl = 'http://127.0.0.1:3101';

function testDatabaseUrl(source: string): string {
  const url = new URL(source);
  const name = decodeURIComponent(url.pathname.slice(1));
  url.pathname = `/${name.endsWith('_test') ? name : `${name}_test`}`;
  return url.toString();
}

const testEnvironment = {
  NODE_ENV: 'test',
  DATABASE_URL: testDatabaseUrl(process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/pms'),
  ORACLE_EMPLOYEE_URL: 'https://fixtures.invalid/employees',
  ORACLE_DEPARTMENT_HEAD_URL: 'https://fixtures.invalid/department-heads',
  ORACLE_EMPLOYER_MAPPING_URL: 'https://fixtures.invalid/employer-mapping',
  ORACLE_BEARER_TOKEN: 'browser-fixture-token',
  BACKEND_PORT: '3101',
  FRONTEND_ORIGIN: testFrontendUrl
};

const browserLibraryPath = `${process.cwd()}/.browser-libs/usr/lib/x86_64-linux-gnu`;
process.env.LD_LIBRARY_PATH = [browserLibraryPath, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL: testFrontendUrl, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'npm run dev:e2e -w backend', url: `${testBackendUrl}/api/health`, reuseExistingServer: true, env: testEnvironment },
    { command: 'npm run dev -w frontend -- --host 127.0.0.1 --port 5273', url: testFrontendUrl, reuseExistingServer: true, env: { VITE_API_BASE_URL: `${testBackendUrl}/api` } }
  ]
});
