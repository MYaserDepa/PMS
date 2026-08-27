# PMS 2027 POC implementation plan

## Planning basis

- Authoritative specification: `PMS PRD [POC].md`.
- Repository baseline on 2026-08-26: no frontend, backend, database migrations, seeds, or tests exist yet.
- Target stack: React with TypeScript, Node.js with TypeScript, PostgreSQL, and REST.
- Target cycle: 2027 only.
- Product scope: exactly five form types and the Employee to Line Manager workflow described in the PRD.
- Database changes must be delivered and exercised as migrations. Do not alter database state manually.
- A task stays unchecked until its acceptance criteria and listed tests pass. Important workflows must also pass in a real browser.
- Controlled Oracle identities exist only as injected automated-test data. The running application always uses the configured live endpoints and accepts any eligible Oracle employee number.

## Delivery rules

- [x] Keep the PRD decision tree, permissions, phase rules, rating rules, evidence rules, and exclusions intact.
- [x] Keep the Oracle bearer token on the server. Never expose it in frontend code, browser requests, logs, fixtures, or committed files.
- [x] Enforce business rules in the backend. Client-side validation may improve feedback but cannot be the only enforcement.
- [x] Use transactions for generation and workflow transitions where practical.
- [x] Do not add notifications, dashboards, SSO, deployment work, advanced reporting, workflow configuration, reassignment, advanced audit, file uploads, search infrastructure, queues, retries, monitoring, multi-year browsing, or other excluded features.
- [x] Record implementation discoveries or PRD clarifications in this file before changing scope.

## Test levels used below

- **Unit:** pure business rules, calculations, validation, and permission decisions.
- **Database integration:** migrations, constraints, repositories, transactions, and seeded data against PostgreSQL.
- **API integration:** REST behavior with the frontend excluded, including authentication context and authorization failures.
- **Component:** React rendering, field states, validation feedback, and role-specific controls.
- **Browser:** the application running through the React UI, Node API, and PostgreSQL database. Use controlled Oracle fixtures for repeatable runs, then perform a separate configured Oracle smoke test when credentials are available.

## Milestone 0: project foundation

Goal: establish a local development structure that can support the POC without adding deployment or operational work.

### M0-T1: Create the application workspace

- [x] Create separate `frontend` and `backend` TypeScript applications with shared root scripts for local development, build, lint, type-check, and test.
- Dependencies: none.
- Acceptance criteria:
  - The frontend is React and the backend is Node.js.
  - The layers communicate through a documented REST base URL.
  - A developer can start both applications locally from the repository.
  - No hosting, cloud infrastructure, CI/CD, queue, worker, or monitoring setup is introduced.
- Testing requirements:
  - Run clean installs from the committed manifests and lockfile.
  - Run frontend and backend build, lint, and type-check commands.
  - Open the frontend in a browser and confirm it can reach a backend health endpoint.

### M0-T2: Add runtime configuration and secret handling

- [x] Define validated backend configuration for PostgreSQL, the Oracle employee URL, Department Head URL, employer mapping URL, `ORACLE_BEARER_TOKEN`, HR Admin employee `12245`, and IT System Admin employee `21975`.
- [x] Define frontend configuration only for non-secret values such as the REST base URL.
- Dependencies: M0-T1.
- Acceptance criteria:
  - Startup fails with a clear server-side message when required configuration is absent or malformed.
  - Secrets are excluded from version control and never included in client bundles or API responses.
  - A safe example environment file documents required keys without values.
- Testing requirements:
  - Unit-test configuration parsing and failure cases.
  - Inspect the built frontend for the Oracle token name and test token values.
  - Verify repository status contains no secret-bearing environment file.

### M0-T3: Establish the test harness

- [x] Configure backend unit and API integration tests, frontend component tests, PostgreSQL database integration tests, and browser automation.
- [x] Add deterministic Oracle response fixtures at the backend integration boundary.
- Dependencies: M0-T1.
- Acceptance criteria:
  - Each test level has one passing smoke test and one documented command.
  - Database tests use migrations rather than hand-built tables.
  - Oracle fixtures cover DUG, KBU, Department Head, both RoleCategory values, and validation failures.
- Testing requirements:
  - Run every test command from a fresh local checkout setup.
  - Confirm the browser suite launches the actual frontend and backend.

### Milestone 0 gate

- [x] Builds, type checks, lints, smoke tests, and the browser connectivity check pass.
- [x] No product behavior beyond the PRD foundation has been added.

## Milestone 1: database model and seeded 2027 configuration

Goal: create the relational base for one 2027 cycle, five fixed form types, per-phase workflow state, and immutable history.

### M1-T1: Create the initial database migration

- [x] Add migrations for `PerformanceCycle`, `EmployeeSnapshot`, `RoleCategoryMapping`, `StrategyReference`, `Scorecard`, `ScorecardLine`, `AdminStandard`, per-scorecard phase state, `WorkflowStep`, and `WorkflowHistory`.
- Dependencies: M0-T1, M0-T2.
- Acceptance criteria:
  - The schema can represent every field listed in PRD sections 41 and 45.
  - Snapshot data includes employee number, name, department, job, position, grade, employer, supervisor details, Department Head status, RoleCategory when applicable, and resolved form type.
  - Form type, phase, status, workflow action, workflow step status, RoleCategory, Mid-Year status, and rating values use constrained values.
  - A database constraint prevents more than one scorecard for the same employee number and year.
  - Ratings accept only integers 1 through 5. Weights accept only integers from 1 through 100.
  - Targets and actuals remain text.
  - Workflow history rows cannot be updated or deleted through the application repository.
- Testing requirements:
  - Apply all migrations to an empty PostgreSQL database.
  - Test uniqueness, enum or check constraints, foreign keys, rating bounds, and required relationships.
  - Revert and reapply migrations in a disposable test database if the selected migration tool supports rollback.

### M1-T2: Seed fixed POC configuration through migrations or seed scripts

- [x] Seed the 2027 cycle, five form definitions, rating labels, Group strategy ambitions and representative linked strategy references, Administrative / Support standards and starting weights, and any explicitly chosen demo RoleCategory mappings.
- Dependencies: M1-T1.
- Acceptance criteria:
  - Exactly one active `PMS 2027` cycle exists with `GoalSetting` as its initial phase.
  - Exactly five supported form types exist.
  - Administrative / Support standards are 40, 15, 15, 10, 10, and 10 percent in the PRD order and total 100 percent.
  - Seed operations are repeatable and do not duplicate records.
  - Seeded strategy references support a primary link for each KPI-based form without requiring an administration UI.
- Testing requirements:
  - Run seeds twice and confirm stable row counts and identifiers.
  - Query seeded totals and allowed values in a database integration test.

### M1-T3: Add transactional persistence services

- [x] Implement repositories or equivalent data access for cycles, mappings, snapshots, scorecards, lines, standards, phase state, workflow steps, and workflow history.
- Dependencies: M1-T1.
- Acceptance criteria:
  - Business services do not issue ad hoc schema changes.
  - Generation and workflow callers can execute multiple writes in one transaction.
  - History creation is append-only through the supported API.
- Testing requirements:
  - Database integration tests cover create, read, constrained update, rollback, and append-only history behavior.

### Milestone 1 gate

- [x] A fresh database can be migrated and seeded with one command sequence.
- [x] Schema and seed integration tests pass.

## Milestone 2: Oracle integration and test identity

Goal: resolve valid test users and all external data required for form assignment without exposing the Oracle credential.

### M2-T1: Implement the server-side Oracle employee client

- [x] Fetch the required employee fields from the PRD employee endpoint and provide employee lookup plus department population operations.
- Dependencies: M0-T2, M0-T3.
- Acceptance criteria:
  - Requests use `ORACLE_BEARER_TOKEN` only on the server.
  - The client maps all required Oracle employee fields without silently inventing defaults.
  - Invalid payloads, upstream failures, and unknown employee numbers produce clear application errors.
  - Only employees with `USER_EXISTS = Y` are eligible.
- Testing requirements:
  - Unit-test payload mapping and validation.
  - API integration-test successful, empty, malformed, unauthorized, and upstream-failure fixtures.
  - Perform one configured live Oracle smoke test outside the repeatable suite when a valid token is available.

### M2-T2: Implement Department Head lookup

- [x] Fetch Department Head records and compare employee numbers exactly for below-Grade-18 form assignment and Department Head permissions.
- Dependencies: M2-T1.
- Acceptance criteria:
  - Grade 18 and above does not depend on Department Head lookup for form choice.
  - A below-18 match is classified as Department Head.
  - An unavailable or invalid Department Head response becomes `Unable to Determine Department Head Status`, not a guessed non-head result.
- Testing requirements:
  - Unit-test matches, non-matches, numeric/string normalization, duplicates, and malformed records.
  - API integration-test the unavailable lookup path.

### M2-T3: Implement employer-to-company resolution

- [x] Resolve leadership employees' employer values against company records and classify only `org_Name = "DEPA United Group PJSC"` as DUG.
- Dependencies: M2-T1.
- Acceptance criteria:
  - Grade 18 and above employees resolve to DUG or KBU only from the mapping response.
  - An unresolved employer becomes `Unable to Resolve DUG/KBU` and blocks generation.
  - Below-18 assignment does not require employer mapping unless needed for another displayed validation field explicitly required by the PRD.
- Testing requirements:
  - Unit-test DUG, non-DUG, missing employer, unmatched employer, duplicate mapping, and invalid payload cases.
  - API integration-test upstream error handling.

### M2-T4: Implement test login and current-user context

- [x] Add passwordless login by valid `EMPLOYEE_NUMBER`, server-side current-user resolution, logout, and session restoration suitable for the development POC.
- Dependencies: M2-T1.
- Acceptance criteria:
  - Any valid Oracle employee can log in with an employee number and no password.
  - `12245` receives HR Admin capabilities and `21975` receives IT System Admin identity.
  - Manager and Department Head capabilities come from employee and workflow context, not user-selected roles.
  - An unknown or ineligible employee cannot enter the application.
  - The identity mechanism does not claim enterprise security.
- Testing requirements:
  - API integration-test valid, HR, IT, unknown, and ineligible identities.
  - Browser-test login, refresh/session restoration, logout, and invalid login feedback.

### Milestone 2 gate

- [x] Oracle fixture tests pass and a browser user can log in by employee number.
- [x] The browser never sends a request to Oracle and never receives the bearer token.

## Milestone 3: form assignment, RoleCategory, and HR generation

Goal: prove the strict assignment decision tree and the two-step Populate then Generate process.

### M3-T1: Implement the pure form-assignment decision service

- [x] Encode the strict Grade, employer classification, Department Head, then RoleCategory precedence from PRD section 14.
- Dependencies: M2-T2, M2-T3.
- Acceptance criteria:
  - Grade 18 or above plus DUG maps to DUG Leadership Scorecard.
  - Grade 18 or above plus non-DUG maps to KBU Leadership Scorecard.
  - Below Grade 18 plus Department Head maps to Department Heads / Senior Managers KPI Form.
  - A below-18 non-head maps by the two allowed RoleCategory values.
  - Missing grade, department, employer where required, manager, RoleCategory where required, unresolved employer, unavailable head status, and invalid mapping yield the PRD review statuses and no form.
  - Exactly one form or one blocking result is returned. Higher-priority branches never evaluate lower-priority criteria.
- Testing requirements:
  - Table-driven unit tests cover every precedence example and every typical Populate status in PRD section 17.
  - Include boundary grades 17 and 18 and an employee who is both Grade 18 and a Department Head.

### M3-T2: Implement RoleCategory administration

- [x] Add backend operations and a minimal screen to view and assign only `ProjectDeliveryProfessional` or `AdministrativeSupport` mappings.
- Dependencies: M1-T3, M2-T4.
- Acceptance criteria:
  - HR Admin can manage all mappings.
  - A Department Head can manage mappings only for employees in their own department.
  - Other users and IT System Admin cannot mutate mappings.
  - Invalid values and out-of-scope department changes fail in the backend.
  - A newly saved mapping is used by the next Populate preview.
- Testing requirements:
  - Unit and API integration tests cover both values, invalid values, HR scope, Department Head scope, and forbidden access.
  - Component-test validation and role-specific controls.
  - Browser-test HR assignment and Department Head in-scope versus out-of-scope assignment.

### M3-T3: Implement HR Populate preview

- [x] Add the Department selector and Populate operation that fetches eligible employees, resolves assignment inputs, checks existing 2027 scorecards, and displays the review table without writing scorecards.
- Dependencies: M3-T1, M3-T2, M2-T4.
- Acceptance criteria:
  - Only HR Admin can call Populate.
  - The table shows employee, grade, employer or classification, Department Head status, RoleCategory, manager, form, and status.
  - Every PRD status can be represented, including `Ready` and `PMS Already Exists`.
  - Populate creates no snapshot, scorecard, lines, phase state, workflow step, or history row.
  - No advanced filtering, pagination, or background processing is introduced.
- Testing requirements:
  - API integration-test mixed valid and invalid fixture populations and prove that database row counts do not change.
  - Component-test table content and validation messages.
  - Browser-test HR department selection and Populate preview.

### M3-T4: Implement transactional Generate

- [x] Revalidate selected employees and create valid 2027 snapshots, scorecards, initial phase state, predefined Employee to Line Manager workflow steps, appropriate fixed standard rows, and `Created` history entries.
- Dependencies: M3-T3, M1-T3.
- Acceptance criteria:
  - Only HR Admin can call Generate.
  - Generate does not trust stale client preview results.
  - Each snapshot preserves the creation-time data required by the PRD.
  - KPI-based scorecards start without invented employee goals. Administrative / Support scorecards receive the six seeded standards.
  - The employee is the pending Goal Setting participant and the Oracle supervisor is the Line Manager step assignee.
  - Duplicate 2027 creation is blocked by service logic and the database constraint.
  - A result summary reports created, already-existing, and validation-failed counts and per-employee outcomes.
  - One employee's expected validation failure does not create partial records for that employee.
- Testing requirements:
  - Database and API integration tests cover mixed batches, revalidation changes, duplicates, transaction rollback, snapshots, standards, workflow steps, and history.
  - Simulate a repeated Generate click and confirm only one scorecard per employee.
  - Browser-test Populate then Generate and verify the result summary.

### Milestone 3 gate

- [x] Browser acceptance scenarios 2 through 6 pass with controlled fixture data.
- [x] Database inspection confirms one scorecard per employee for 2027 and no writes from Populate.

## Milestone 4: authorization, workflow engine, and phase control

Goal: centralize backend visibility, field ownership, workflow transitions, locking, history, and duplicate-action protection.

### M4-T1: Implement scorecard visibility authorization

- [x] Add backend policies for own scorecard, direct reports, Department Head department scope, HR all-record access, and IT technical read-only inspection where needed for POC troubleshooting.
- Dependencies: M2-T4, M3-T4.
- Acceptance criteria:
  - Employees see only their own scorecard.
  - Managers see their own and direct-report scorecards.
  - Department Heads see their own and their department's scorecards.
  - HR Admin sees all 2027 scorecards.
  - IT System Admin does not participate in business mutations.
  - List and detail endpoints apply the same rules and return no hidden scorecard data.
- Testing requirements:
  - Table-driven authorization unit tests.
  - API integration tests for allowed and forbidden list and detail access across all roles.

### M4-T2: Implement field-level read and write policies

- [x] Define backend allowlists for employee-owned, manager-owned, phase-specific, and form-specific fields.
- Dependencies: M4-T1.
- Acceptance criteria:
  - Only the current pending participant can save or transition.
  - Pending ownership never grants access to the other participant's fields.
  - The API rejects over-posted, disallowed, previously approved, future-phase, and closed-form changes.
  - Employees cannot see unsubmitted manager ratings or drafts.
  - Managers cannot treat unsubmitted employee Year-End drafts as submitted content.
  - Finalized manager ratings become employee-visible only after manager approval.
- Testing requirements:
  - Unit-test policy decisions for each form, phase, participant, and status.
  - API integration-test forged payloads, hidden draft fields, another user's scorecard, approved phases, and closed records.

### M4-T3: Implement workflow state transitions

- [x] Add transactional Save as Draft, Initiate, Approve, Reject, and Resubmit commands for the predefined Employee to Line Manager workflow.
- Dependencies: M4-T2, M1-T3.
- Acceptance criteria:
  - Save as Draft persists only the current participant's allowed fields and does not advance.
  - Initiate moves the employee phase step to the manager.
  - Approve completes the manager step and marks the scorecard phase `FullyApproved`.
  - Reject returns the phase to the employee. The next employee transition is Resubmit, not Initiate.
  - Resubmit returns the phase to the manager, and rejection cycles may repeat.
  - Each command verifies current phase, pending participant, expected state, and allowed action before writing.
  - Repeated or stale requests cannot advance the workflow twice.
- Testing requirements:
  - State-machine unit tests cover valid transitions and every invalid action/state combination.
  - Database/API integration tests cover rollback, repeated clicks, stale requests, and repeated reject/resubmit cycles.

### M4-T4: Implement immutable workflow history and comments

- [x] Append the required history record for Created, SavedDraft, Initiated, Approved, Rejected, Resubmitted, PhaseOpened, PhaseClosed, and Closed actions.
- Dependencies: M4-T3.
- Acceptance criteria:
  - Entries contain scorecard, phase, action, actor employee number, comment, timestamp, from participant, and to participant when applicable.
  - Authorized scorecard viewers can read the ordered history.
  - History cannot be edited or deleted through the REST API.
  - Comments are optional, while the rejection UI clearly prompts for a reason without making it a new backend requirement.
- Testing requirements:
  - Database/API integration tests assert exact entry order and fields for approve and repeated reject/resubmit paths.
  - API tests prove mutation routes for history do not exist or are forbidden.

### M4-T5: Implement HR phase control and scorecard phase opening

- [x] Add a simple HR-only control that advances the 2027 cycle through GoalSetting, MidYear, YearEnd, Development, and Closed and opens the corresponding phase for eligible scorecards.
- Dependencies: M4-T3, M4-T4.
- Acceptance criteria:
  - There is no date-driven transition and no multi-year selector.
  - Only HR Admin can advance the active phase.
  - The next phase opens only for scorecards whose prior phase is fully approved.
  - Previously approved phases remain read-only, except allowed Mid-Year plan updates apply to the current scorecard data as specified.
  - Complex reopening and arbitrary phase jumps are rejected.
  - Phase actions are transactional, concurrency-safe, and recorded in history.
- Testing requirements:
  - Unit-test allowed phase order and eligibility.
  - API integration-test unauthorized access, skipped phase, incomplete prior phase, repeated clicks, and history creation.
  - Browser-test the HR phase control and resulting employee access.

### Milestone 4 gate

- [x] Authorization and workflow test matrices pass.
- [x] No REST request can bypass current participant, field ownership, phase locking, or closed-state rules.

## Milestone 5: application shell and role-specific lists

Goal: expose only the simple screens needed to navigate the POC.

### M5-T1: Build the branded application shell and login screen

- [x] Implement Test Login and a responsive application shell using Depa PMS colors `#CF2729`, `#D7CCB8`, `#F15B40`, and `#414042` selectively.
- Dependencies: M2-T4.
- Acceptance criteria:
  - The interface is clean, minimal, professional, easy to scan, and free of unnecessary animation.
  - Navigation shows only screens available to the current user.
  - Login asks only for `EMPLOYEE_NUMBER`.
  - Error, empty, loading, and forbidden states are understandable.
- Testing requirements:
  - Component-test navigation and states by role.
  - Browser-test login and keyboard access at common desktop and narrow viewport sizes.
  - Check labels, focus order, contrast, and actionable control names.

### M5-T2: Build Home / My PMS and authorized scorecard routing

- [x] Show the current user's 2027 scorecard, form type, active phase, workflow status, pending participant, and link to the form.
- Dependencies: M4-T1, M5-T1.
- Acceptance criteria:
  - A user with no generated scorecard sees a clear empty state.
  - A scorecard route cannot display data the API denies.
  - Closed status is visibly read-only.
- Testing requirements:
  - Component-test empty, active, pending-manager, fully-approved, and closed states.
  - Browser-test own scorecard navigation and a forbidden direct URL.

### M5-T3: Build My Team and Department PMS lists

- [x] Add simple manager and Department Head lists showing employee, form, current phase, status, and pending participant.
- Dependencies: M4-T1, M5-T1.
- Acceptance criteria:
  - Managers receive only direct reports.
  - Department Heads receive only their department.
  - No dashboard metrics, advanced search, pagination, or historical-cycle browsing is added.
- Testing requirements:
  - API integration and component tests cover correct scope and empty lists.
  - Browser-test manager and Department Head navigation with an attempted out-of-scope record.

### M5-T4: Build HR All 2027 Submissions and phase screen

- [x] Add the simple all-submissions list and connect the phase control from M4-T5.
- Dependencies: M4-T5, M5-T1.
- Acceptance criteria:
  - Only HR Admin can access the screens.
  - The list shows basic employee, form, phase, status, and pending participant information.
  - The interface remains a list and control screen, not a dashboard.
- Testing requirements:
  - Component and API integration tests cover HR and forbidden users.
  - Browser-test all-submissions navigation and one phase advance.

### Milestone 5 gate

- [x] Each role can reach every in-scope screen it is authorized to use and no others.
- [x] Browser checks confirm simple responsive navigation and accessible controls.

## Milestone 6: the five forms and Goal Setting

Goal: render exactly the five forms and complete the Goal Setting draft, submit, reject, resubmit, and approval journey.

### M6-T1: Define form-specific REST contracts and validation

- [x] Implement backend schemas for the fields and row rules of each form type.
- Dependencies: M4-T2, M3-T4.
- Acceptance criteria:
  - DUG objectives contain the PRD fields, require at least one row, a Perspective, a seeded strategy link, and total weight 100 percent. The UI may recommend 4 to 8 without treating 8 as a PRD hard maximum.
  - KBU objectives contain the PRD fields and total weight 100 percent. The UI may recommend 4 to 8.
  - Department Head KPIs require 4 to 6 rows, linkage, measurable targets, and total weight 100 percent.
  - Project Delivery / Professional KPIs require 4 to 6 rows and total weight 100 percent.
  - Administrative / Support uses the six fixed standards, has no SelfRating field, and totals 100 percent.
  - Each individual weight is greater than 0 and no more than 100.
  - Strategy linkage is required for KPI-based forms and absent from Administrative / Support standards.
  - Target and Actual remain text values.
- Testing requirements:
  - Unit-test each form's allowed fields, required fields, row count boundaries, strategy linkage, and weight validation.
  - API integration-test that a client cannot submit fields from a different form type.

### M6-T2: Build the five form renderers

- [x] Render the correct scorecard from server-provided form type using shared controls where fields genuinely match.
- Dependencies: M6-T1, M5-T2.
- Acceptance criteria:
  - DUG shows only the DUG perspectives and fields.
  - KBU shows only the KBU perspectives and fields.
  - Department Head and Project Delivery / Professional forms show their exact KPI fields and constraints.
  - Administrative / Support shows fixed standards and no employee numerical SelfRating.
  - A running weight total is always visible on weighted forms.
  - Controls become editable, read-only, or hidden from drafts according to backend ownership and phase metadata.
- Testing requirements:
  - Component-test all five renderers, perspective or performance-area choices, running totals, ownership, locked states, and validation messages.
  - Browser-smoke each form type with representative data.

### M6-T3: Implement Goal Setting row editing and draft save

- [x] Allow employees pending in Goal Setting to edit employee-owned goal fields and save a draft without advancing.
- Dependencies: M6-T2, M4-T3.
- Acceptance criteria:
  - DUG employees can add and remove objective rows while preserving the minimum of one at submission.
  - Other forms obey their PRD row model and fixed versus editable structure.
  - Draft saves may be incomplete but must remain structurally safe and must not bypass field ownership.
  - The manager cannot overwrite employee goals or edit employee-owned fields.
  - A `SavedDraft` history entry records the action.
- Testing requirements:
  - API integration-test incomplete draft rejection, forged manager edits, and complete draft persistence.
  - Component-test add/remove behavior and running totals.
  - Browser-test employee draft save, refresh, and continued editing.

### M6-T4: Complete the Goal Setting workflow

- [x] Connect Initiate, manager draft where applicable, Approve, Reject, and employee Resubmit to the form UI.
- Dependencies: M6-T3, M4-T4.
- Acceptance criteria:
  - Initiate blocks invalid row counts, missing links or targets, and totals other than exactly 100 percent.
  - After Initiate, the employee cannot edit and the manager becomes pending.
  - The manager can approve or reject but cannot rewrite employee fields.
  - Reject returns the form to the employee and exposes Resubmit.
  - Repeated rejection and resubmission works and remains in ordered history.
  - Manager approval locks Goal Setting as fully approved.
- Testing requirements:
  - Browser-test acceptance scenarios 7, 8, and 9 on at least one KPI form.
  - Browser-test manager attempts to alter employee content and employee attempts to edit while manager-pending.
  - API integration-test the same authorization failures without relying on disabled UI controls.

### M6-T5: Display workflow history and comments

- [x] Add an ordered history view to the scorecard for all authorized viewers and comment inputs on workflow actions.
- Dependencies: M4-T4, M6-T4.
- Acceptance criteria:
  - The view shows phase, action, actor, comment, date/time, and participant movement when present.
  - Reject visibly encourages a reason.
  - There are no notification controls or field-level audit screens.
- Testing requirements:
  - Component-test empty and populated history plus long comments.
  - Browser-test the history sequence after draft, initiate, reject, resubmit, and approve.

### Milestone 6 gate

- [x] All five forms render correctly in the browser.
- [x] Browser acceptance scenarios 7 through 9 pass and Goal Setting becomes read-only after approval.

## Milestone 7: Mid-Year Review

Goal: allow limited plan changes and progress review through the same employee-manager workflow without building amendment history.

### M7-T1: Implement Mid-Year backend rules

- [x] Allow the employee to update applicable KPI or objective wording, target, measure, weight, strategy link, Mid-Year status, and Mid-Year comment only while pending in Mid-Year.
- Dependencies: M4-T5, M6-T4.
- Acceptance criteria:
  - Supported statuses are exactly `OnTrack`, `AtRisk`, and `Blocked` where the form has Mid-Year status.
  - Updated weights and rows still meet each form's submission constraints and total 100 percent.
  - The current approved Mid-Year position replaces the working plan without detailed amendment or version history.
  - Year-End does not allow structural plan changes.
  - Previously approved Goal Setting history and workflow entries remain intact.
- Testing requirements:
  - Unit and API integration tests cover allowed updates, forbidden fields, weight validation, wrong phase, wrong participant, and structural Year-End rejection.

### M7-T2: Build the Mid-Year user journey

- [x] Add phase-specific employee fields and the shared draft, Initiate, Approve, Reject, and Resubmit controls.
- Dependencies: M7-T1, M6-T5.
- Acceptance criteria:
  - HR can open Mid-Year only after Goal Setting approval.
  - Employee updates remain editable until submission, then lock while manager-pending.
  - Manager uses manager-owned Mid-Year comments or assessment without overwriting employee content.
  - Approval locks Mid-Year and history shows the phase sequence.
  - No detailed amendment history UI is present.
- Testing requirements:
  - Component-test phase-specific fields and locked states.
  - Browser-test acceptance scenario 11, including rejection and resubmission.

### Milestone 7 gate

- [x] Browser acceptance scenario 11 passes.
- [x] Approved Mid-Year content is read-only and Year-End cannot introduce structural plan changes.

## Milestone 8: Year-End self-review, manager rating, and calculation

Goal: enforce confidential drafts, rating rules, separate evidence, and weighted overall rating.

### M8-T1: Implement Year-End employee validation and draft privacy

- [x] Allow KPI-form employees to enter Actual, SelfRating, EmployeeComment, and EmployeeEvidenceURL, while Administrative / Support employees enter comments and applicable employee evidence without SelfRating.
- Dependencies: M7-T2, M4-T2.
- Acceptance criteria:
  - SelfRating accepts only 1 through 5 where present.
  - SelfRating 4 or 5 requires that line's EmployeeEvidenceURL at Initiate or Resubmit.
  - Employee and manager evidence remain separate URL or text references with no uploads and no description field.
  - Managers cannot see an employee Year-End draft as submitted content before Initiate.
  - Employee-owned fields lock after Initiate while the manager is pending.
- Testing requirements:
  - Unit-test rating bounds and evidence rules for 1 through 5.
  - API integration-test draft privacy, missing evidence, cross-field evidence substitution, and Administrative / Support absence of SelfRating.
  - Component-test rating and evidence feedback.

### M8-T2: Implement manager rating validation and draft privacy

- [x] Allow the pending Line Manager to save ManagerRating, ManagerComment, and ManagerEvidenceURL drafts and then approve or reject.
- Dependencies: M8-T1, M4-T3.
- Acceptance criteria:
  - ManagerRating accepts only 1 through 5.
  - ManagerRating 4 or 5 requires that line's ManagerEvidenceURL before approval.
  - Employee evidence never satisfies manager evidence validation.
  - The employee cannot see unsubmitted manager rating data.
  - Rejection returns the submission to the employee while preserving role ownership.
  - Final manager ratings become employee-visible after approval.
- Testing requirements:
  - Unit and API integration tests cover rating bounds, missing evidence, separate evidence, draft privacy, rejection, and final visibility.
  - Browser-test manager draft privacy using separate employee and manager sessions.

### M8-T3: Calculate and display OverallRating

- [x] Calculate `sum(ManagerRating * Weight / 100)` only after every required manager rating exists and display one decimal place.
- Dependencies: M8-T2.
- Acceptance criteria:
  - The persisted or derived result uses manager ratings, never SelfRating.
  - Weighted KPI forms and Administrative / Support standards use the same formula.
  - No partial final OverallRating is shown when a required manager rating is missing.
  - No calibration or forced distribution adjustment is applied.
- Testing requirements:
  - Unit-test integer weights, overall-rating rounding to one decimal, all five forms, missing ratings, and known sample calculations.
  - API and component tests confirm the displayed result matches the backend result.

### M8-T4: Complete the Year-End browser journey

- [x] Connect Year-End employee and manager screens, draft actions, rejection or resubmission, approval, history, final rating visibility, and OverallRating.
- Dependencies: M8-T3, M6-T5.
- Acceptance criteria:
  - The browser journey matches PRD acceptance scenarios 10, 12, and 13.
  - Year-End approval locks Year-End content.
  - Administrative / Support never exposes an employee SelfRating control or field.
- Testing requirements:
  - Browser-test evidence requirements for both participant types at ratings 4 and 5.
  - Browser-test KPI-form Year-End and Administrative / Support Year-End.
  - Browser-test rejection, resubmission, draft privacy, final visibility, and calculation.

### Milestone 8 gate

- [x] Browser acceptance scenarios 10, 12, and 13 pass.
- [x] API tests prove neither hidden drafts nor invalid evidence/rating payloads can bypass backend rules.

## Milestone 9: Development and final close

Goal: record simple development information, complete the final workflow, and make the annual scorecard permanently read-only.

### M9-T1: Implement Development phase fields and ownership

- [x] Add a simple `DevelopmentNotes` experience for agreed development priorities, actions, manager feedback, and employee comments without adding a separate development-planning product.
- Dependencies: M8-T4, M4-T5.
- Acceptance criteria:
  - HR opens Development only after Year-End approval.
  - Employee and manager can edit only their defined portion while pending with them.
  - The phase uses the same draft, Initiate, Approve, Reject, and Resubmit behavior.
  - No unrelated HR, training catalog, notification, or reporting features are added.
- Testing requirements:
  - Unit and API integration tests cover ownership, phase restrictions, and transition rules.
  - Component-test Development fields for employee, manager, and read-only viewers.

### M9-T2: Close the scorecard after final approval

- [x] On final Development approval, set scorecard status to `Closed`, record the close time and `Closed` history action, and reject all later mutations.
- Dependencies: M9-T1, M4-T4.
- Acceptance criteria:
  - Closing happens atomically with final approval.
  - Every field and workflow action is read-only after close.
  - All authorized viewers can still read the scorecard and history.
  - There is no reopen workflow, cancellation workflow, or multi-year navigation.
- Testing requirements:
  - Database/API integration tests cover atomic close, repeated approval, stale actions, and every mutation endpoint after close.
  - Browser-test acceptance scenario 14 from Development entry through final read-only view.

### Milestone 9 gate

- [x] Browser acceptance scenario 14 passes.
- [x] Closed records remain readable to authorized users and immutable through the UI and REST API.

## Milestone 10: complete POC validation and handoff

Goal: prove the full journey against the authoritative acceptance scenarios and leave a reproducible local development setup.

### M10-T1: Build the representative test-only end-to-end dataset

- [x] Provide non-secret, test-only fixtures for HR, IT, a manager, and employees representing DUG leadership, KBU leadership, below-18 Department Head, Project Delivery / Professional, and Administrative / Support.
- Dependencies: M3-T4, M9-T2.
- Acceptance criteria:
  - The dataset exercises Grade 17 and 18 boundaries, missing mappings, missing manager, duplicate scorecard, and evidence ratings.
  - Fixture identities and expected assignments are contained under automated test code and cannot be enabled in the running application.
  - No real bearer token or unnecessary personal data is committed.
- Testing requirements:
  - Recreate the test database from migrations and seeds and confirm every fixture resolves to its documented result.

### M10-T2: Automate the 14 PRD acceptance scenarios in the browser

- [x] Add browser tests for login, generation, all assignment branches, Goal Setting, rejection/resubmission, weights, evidence, Mid-Year, Year-End, Administrative / Support, and close.
- Dependencies: M10-T1.
- Acceptance criteria:
  - Scenarios 1 through 14 each have a named test or a clearly identified section of one ordered end-to-end test.
  - Tests use the real frontend, REST API, PostgreSQL schema, and controlled Oracle fixtures.
  - Tests assert both visible outcomes and important persisted state through supported APIs or test-safe database assertions.
- Testing requirements:
  - Run the suite from a freshly migrated and seeded database.
  - Save failure screenshots and traces locally for diagnosis without turning them into a product monitoring feature.

### M10-T3: Run the authorization and business-rule regression matrix

- [x] Execute the full unit, database integration, API integration, component, and browser suites and close any coverage gaps found in critical rules.
- Dependencies: M10-T2.
- Acceptance criteria:
  - All five forms, five phases, participant transitions, role scopes, field ownership combinations, rating values, evidence requirements, weight rules, and duplicate actions have passing tests.
  - A negative test exists for each important permission and transition, not only the happy path.
  - No task is marked complete because the UI looks correct while the API remains untested.
- Testing requirements:
  - Run build, lint, type-check, every automated suite, migration-from-empty, and seed-repeatability checks.
  - Review browser results for console errors and failed network requests.

### M10-T4: Document local setup and demonstration procedure

- [x] Write concise development instructions for prerequisites, configuration keys, migrations, seeds, start commands, test commands, Oracle smoke testing, and the end-to-end demo order.
- Dependencies: M10-T3.
- Acceptance criteria:
  - A developer can start from an empty database and reach the login screen without undocumented manual database edits.
  - The demo procedure follows HR Populate/Generate, correct form, Goal Setting, manager decision, Mid-Year, Year-End, manager rating, Development, and Closed.
  - Security and environment notes state that login is passwordless test identity and the application is development-only.
  - Documentation does not include deployment instructions or claim production readiness.
- Testing requirements:
  - Follow the setup instructions from a clean local state.
  - Perform one final browser walkthrough of the full completion path.

### Milestone 10 gate

- [x] All automated checks pass from a clean database.
- [x] All 14 PRD acceptance scenarios pass in the browser.
- [x] The full annual journey can be demonstrated locally without manual database changes.
- [x] A final scope review confirms that excluded features were not implemented.

## Milestone 11: corporate frontend redesign

Goal: give the existing PMS workflows a compact, executive-grade interface without changing product scope or backend behavior.

### M11-T1: Establish the visual system

- [x] Integrate Tailwind CSS through the Vite plugin and define the Depa color, typography, spacing, focus, and motion tokens.
- [x] Use locally bundled interface and utility fonts. Do not depend on a third-party font request at runtime.
- Acceptance criteria:
  - The interface uses the PRD colors selectively rather than flooding the page with brand red.
  - Typography, density, borders, shadows, and controls follow one consistent system.
  - Motion respects `prefers-reduced-motion`.

### M11-T2: Redesign login, application shell, and loading states

- [x] Build a compact login screen, responsive navigation rail, mobile header, user context, and phase spine.
- [x] Replace plain loading text with an accessible workflow-stage loading mark.
- Acceptance criteria:
  - Navigation remains role-specific and keyboard accessible.
  - Desktop and mobile layouts avoid large unused areas and horizontal page overflow.
  - Loading states retain visible status text for assistive technology.

### M11-T3: Redesign working screens and scorecards

- [x] Restyle lists, tables, empty states, generation, RoleCategory mapping, phase control, scorecard fields, actions, and history with compact corporate components.
- Acceptance criteria:
  - Existing labels and accessible names used by the acceptance tests remain stable.
  - Dense tables remain readable and scroll within their own container on narrow screens.
  - Current phase, status, pending participant, weight, and next actions have a clear visual hierarchy.

### Milestone 11 gate

- [x] Frontend unit, component, build, lint, and type checks pass.
- [x] All browser acceptance scenarios still pass against the real frontend and backend.
- [x] Desktop and mobile screenshots have been reviewed for density, hierarchy, overflow, focus, and loading presentation.

## Milestone 12: shell refinements

Goal: incorporate the supplied Depa brand asset and give desktop users direct control over navigation density without adding unnecessary home-page scrolling.

- [x] Move `depa-logo.png` into the frontend public assets and use it in every product wordmark.
- [x] Add an accessible desktop navigation collapse control and persist the user's choice locally.
- [x] Keep the desktop home screen within the available viewport whenever its content fits, while retaining normal mobile scrolling.

### Milestone 12 gate

- [x] Frontend tests, build, lint, and type checks pass.
- [x] Browser workflows pass with expanded and collapsed navigation.
- [x] Desktop and mobile screenshots confirm correct logo sizing, home-page height, and navigation behavior.

## Milestone 13: functional corrections

Goal: remove repetitive RoleCategory entry and correct the live assignment preview without changing the PRD decision tree.

### M13-T1: Department-based bulk RoleCategory mapping

- [x] Replace employee-number entry with a department selector and employee worklist.
- [x] Give HR access to all departments and Department Heads access only to every department assigned to them by the Department Head API.
- [x] Auto-load the worklist when a Department Head has exactly one department.
- [x] Save one or more changed RoleCategory values in one transactional request and reject out-of-scope or inapplicable employees in the backend.

### M13-T2: Correct KBU employer resolution

- [x] Treat multiple employer records as resolved when every match produces the same DUG or KBU classification.
- [x] Keep conflicting DUG and KBU matches blocked as `Unable to Resolve DUG/KBU`.
- [x] Confirm employee `4090` resolves to the KBU Leadership Scorecard from the configured live Oracle and Nexus data.

### M13-T3: Show the employee's Department Head

- [x] Resolve the Department Head name by the employee's department for every Populate row.
- [x] Display the resolved name in the `Department Head` column instead of internal assignment states such as `NotHead` or `NotApplicable`.

### Milestone 13 gate

- [x] Backend unit, API integration, frontend component, build, lint, and type checks pass.
- [x] Browser tests validate HR bulk mapping, single-department head auto-load, assignment preview names, and form generation.
- [x] Browser screenshots confirm the revised mapping worklist is usable at desktop and mobile sizes.

## Milestone 14: localized feedback and UI copy

Goal: keep request feedback beside the active workflow, use short-lived toasts for outcomes, and remove implementation names from user-facing copy.

### M14-T1: Simplify the login and home presentation

- [x] Remove the test-access index, development security note, and redundant home-page description.
- [x] Keep the dark branded login context and apply the shared 32-pixel grid pattern only to the signed-in home page.
- [x] Remove the desktop navigation width and workspace padding transition.

### M14-T2: Localize request loading states

- [x] Place the workflow loader beneath the login controls instead of taking over the viewport.
- [x] Show section-level loading for department retrieval, submission lists, Populate, Generate, role category worklists and saves, phase changes, and scorecard actions.
- [x] Auto-load the role category worklist when the department selection changes.

### M14-T3: Standardize feedback and plain-language labels

- [x] Show success, information, and error outcomes as short-lived bottom-right toasts without shifting tables or forms.
- [x] Display spaced role category, phase, status, workflow action, and participant labels while preserving API values internally.

### Milestone 14 gate

- [x] Frontend unit, build, lint, and type checks pass.
- [x] Browser workflows validate localized loaders, auto-loaded departments, toasts, and the revised desktop and mobile presentation.

## Milestone 15: in-memory page cache and compact loading toast

Goal: avoid repeated page requests during one login and keep request feedback small enough that it never obscures the working area.

- [x] Cache scorecard lists, department options, phase control, mapping departments, mapping worklists, strategy references, and scorecard details for the active login.
- [x] Clear the cache on logout and update or refresh affected entries after generation, phase changes, mapping saves, and workflow actions.
- [x] Replace the large loading panel with a fixed bottom-right toast containing only the compact workflow spinner and loading message.
- [x] Verify that revisiting Phase Control and Create PMS Submissions performs no additional request and shows no loading toast.

### Milestone 15 gate

- [x] Frontend unit, build, lint, and type checks pass.
- [x] Browser review confirms the compact loader and in-memory page reuse at desktop and mobile sizes.

## Milestone 16: session identity request performance

Goal: keep the trusted login identity in the server session and avoid full-population Oracle reads for individual login lookup.

- [x] Fetch the login employee with an Oracle `EMPLOYEE_NUMBER` OData filter while retaining the configured eligibility filter.
- [x] Store the resolved `CurrentUser` in the server-side session and reuse it for session restoration and protected API authorization.
- [x] Verify that session restoration and protected local workflows make no Oracle identity requests after login.

### Milestone 16 gate

- [x] Backend unit, API integration, build, lint, and type checks pass.
- [x] Browser login, refresh/session restoration, role category, and submission workflow paths pass.

## Milestone 17: workflow and form validation corrections

Goal: let configured admin identities complete their own assigned PMS workflow and apply complete integer-weight validation consistently.

- [x] Allow employee `21975` to act on a scorecard assigned to `21975` without granting IT System Admin workflow rights over other scorecards.
- [x] Remove participant movement text from the workflow history presentation while retaining the required immutable history data.
- [x] Require the current participant's applicable fields and an exact 100% total for Save as Draft, Initiate, Resubmit, and Approve actions.
- [x] Store and accept KPI weights as whole numbers from 1 to 100 and use a UI step of 1.
- [x] Apply the integer weight schema change through a migration and validate the affected API and browser workflows.

### Milestone 17 gate

- [x] Backend unit, database integration, API integration, frontend component, build, lint, and type checks pass.
- [x] Browser tests cover employee `21975`, incomplete draft rejection, exact weight validation, integer weight entry, and simplified workflow history.

## Milestone 18: participant-focused UI copy

Goal: identify people by their Oracle position and name while making submission actions and loading feedback concise.

- [x] Show the signed-in employee's Oracle position in the navigation user context.
- [x] Show `Getting submissions` while My PMS loads and avoid showing the empty state before the request finishes.
- [x] Use `Open form` and `Remove` as the visible action labels.
- [x] Show the current assignee's name as the pending participant without an employee number or participant category.
- [x] Store the workflow actor's name through a migration and show that name in workflow history.

### Milestone 18 gate

- [x] Migration, backend API, frontend component, build, lint, and type checks pass.
- [x] Browser checks validate the loading state, position label, participant names, form action, and history names.

## Dependency summary

1. Milestone 0 establishes the codebase, safe configuration, and test runners.
2. Milestone 1 supplies migrations, constraints, seeds, and transactional persistence.
3. Milestone 2 supplies trusted employee identity and external assignment data.
4. Milestone 3 creates correct 2027 scorecards and predefined workflows.
5. Milestone 4 centralizes authorization, field ownership, transitions, phase locking, and history.
6. Milestone 5 exposes the minimum role-specific navigation and lists.
7. Milestone 6 proves all five forms and Goal Setting.
8. Milestones 7 through 9 add Mid-Year, Year-End, rating, Development, and final close in lifecycle order.
9. Milestone 10 validates the whole POC and documents the local demonstration path.

## PRD acceptance scenario traceability

| PRD scenario | Primary tasks | Required proof |
| --- | --- | --- |
| 1. Test login | M2-T4, M5-T1 | API and browser |
| 2. HR form generation | M3-T3, M3-T4 | Database, API, and browser |
| 3. DUG leadership assignment | M2-T3, M3-T1 | Unit, API, and browser |
| 4. KBU leadership assignment | M2-T3, M3-T1 | Unit, API, and browser |
| 5. Department Head assignment | M2-T2, M3-T1 | Unit, API, and browser |
| 6. RoleCategory assignment | M3-T1, M3-T2 | Unit, API, and browser |
| 7. Goal Setting workflow | M4-T2, M4-T3, M6-T3, M6-T4 | API and browser |
| 8. Rejection and resubmission | M4-T3, M4-T4, M6-T4, M6-T5 | Database, API, and browser |
| 9. Weight validation | M6-T1, M6-T4 | Unit, API, component, and browser |
| 10. Evidence validation | M8-T1, M8-T2, M8-T4 | Unit, API, component, and browser |
| 11. Mid-Year | M4-T5, M7-T1, M7-T2 | API and browser |
| 12. Year-End | M8-T1 through M8-T4 | Unit, API, component, and browser |
| 13. Administrative / Support | M6-T1, M6-T2, M8-T1, M8-T4 | Unit, API, component, and browser |
| 14. Close | M9-T1, M9-T2 | Database, API, and browser |

## Explicitly deferred and excluded

The following are not backlog items for this POC: notifications, dashboards, Azure AD or password authentication, hosting and deployment, Oracle migration or export, multi-year browsing, advanced reporting, calibration, 360 feedback, workflow-template configuration, reassignment, impersonation, scheduled Oracle synchronization, advanced audit or amendment history, advanced search or pagination, file evidence uploads, evidence descriptions, strategy administration, advanced cycle or form configuration, cancellation or reopening workflows, queues, background workers, retry infrastructure, operational monitoring, alerting, and bulk-scale optimization.
