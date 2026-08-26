# Depa PMS 2027 POC

This repository contains separate React and Node.js TypeScript applications for the 2027 PMS proof of concept. The backend owns business rules and exposes REST endpoints under `http://localhost:3001/api` by default. The frontend reads `VITE_API_BASE_URL` at build time.

The application is for local development and controlled demonstrations. Login uses an employee number without a password and is not production authentication.

## Local prerequisites

- Node.js 22 or newer
- npm 9 or newer
- PostgreSQL running on port 5432

Copy `.env.example` to `.env` and fill in local values. The three Oracle URLs are listed in the PRD and the bearer token must remain only in this ignored file. Then run:

```sh
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The frontend runs at `http://localhost:5173`; the backend health endpoint is `http://localhost:3001/api/health`.

The running application always resolves login and employee data through the configured Oracle endpoints. Any employee returned by `ORACLE_EMPLOYEE_URL` with `USER_EXISTS = Y` can use Test Login. The application has no runtime fixture mode and does not seed employee identities.

## Checks

```sh
npm run build
npm run lint
npm run typecheck
npm test
npm run test:db
npm run test:api
npm run test:e2e
```

Database and API tests derive an isolated database name by adding `_test` to the configured development database name. They recreate that test database, apply every committed migration, and seed it. Browser tests do the same, then launch the real frontend, backend, and Chromium. Automated API and browser tests inject fictional Oracle responses from test-only files. Those records are not available to the normal backend server. Install the browser once with `npx playwright install chromium`; Linux hosts may also need `npx playwright install-deps chromium`.

Run the optional read-only live integration smoke after setting a valid token and the PRD URLs:

```sh
npm run oracle:smoke
```

The smoke prints record counts only. An HTTP 401 means the configured token is not valid for the employee endpoint.

## Demonstration order

1. Start with a migrated and seeded database and the live Oracle settings in the ignored `.env` file.
2. Log in with the configured HR Admin employee number. Open RoleCategory Mapping and assign a category to any eligible below-Grade-18 non-Department Head who needs one.
3. Open Create PMS Submissions, select a department, Populate, review the assignments and validation statuses, then Generate selected valid employees.
4. Log in with a generated employee number, open My PMS, complete Goal Setting, save a draft, and Initiate.
5. Log in with that employee's Oracle supervisor number, use My Team, then Reject or Approve. Demonstrate employee Resubmit after rejection.
6. As HR, use Phase Control after every scorecard has approved the current phase. Open Mid-Year, Year-End, and Development in order.
7. Complete the employee and manager Mid-Year workflow. At Year-End, demonstrate that ratings 4 and 5 need the matching participant's evidence reference.
8. Show the calculated Overall Rating, complete Development notes for both participants, and Approve. The scorecard status becomes Closed and every control becomes read-only.

No database row needs a manual edit during this path. RoleCategory mappings are created through the application, not seeded for named employees. The application does not include deployment, SSO, notifications, dashboards, reports, uploads, advanced search, reassignment, reopening, or other features excluded by the PRD.
