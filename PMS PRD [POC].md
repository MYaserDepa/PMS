# PRD: Depa Performance Management System (PMS) — 2027 Proof of Concept

> **Authoritative standalone specification:** This document is the complete specification for the 2027 PMS proof of concept. The implementation must be based on this document alone. No other PMS PRD, production specification, or prior draft is required to interpret the requirements below. If a feature is not stated as in scope here, it must not be assumed to be required.

## 1. Purpose

Build a Proof of Concept (POC) for Depa's 2027 Performance Management System.

The purpose of the POC is to prove the core PMS business logic and end-to-end user journey while intentionally limiting the deliverable to the requirements defined in this document.

The POC must demonstrate the five PMS form types and the main annual lifecycle:

### Goal Setting → Mid-Year Review → Year-End Self-Review → Manager Rating → Development / Close

The POC should prioritize:

- correctness of form assignment;
- correctness of workflow behavior;
- employee/manager field ownership;
- phase progression and locking;
- rating and weighting rules;
- evidence requirements;
- clear demonstration of the 2027 PMS business process.

The POC is intended for controlled development and demonstration use only, not live operational use.

---

## 2. Scope boundaries and exclusions

The following are explicitly out of scope and must not be implemented as required product features:

- email notifications;
- in-app notifications;
- Oracle migration/export deliverables;
- Azure AD SSO;
- password-based authentication or enterprise authentication security;
- hosting or deployment;
- hosted or live environments;
- dashboards;
- multi-year or historical-cycle browsing;
- workflow-template configuration UI;
- workflow reassignment UI;
- complex cancellation/reopening scenarios;
- detailed Mid-Year amendment/version history;
- advanced audit trail;
- advanced search, filtering, or pagination;
- large-scale performance and bulk optimization;
- separate evidence description fields;
- strategy-reference administration UI;
- advanced form/cycle configuration UI;
- queues;
- retry infrastructure;
- operational monitoring;
- deployment/operations concerns.

The POC focuses only on the **2027 cycle**.

---

## 3. Technical stack

The POC will use:

| Layer | Technology |
| --- | --- |
| Frontend | React + TypeScript |
| Backend | Node.js + TypeScript |
| Database | PostgreSQL |
| API style | REST |
| Login | Test login using `EMPLOYEE_NUMBER` |
| Employee and organization data | Existing Oracle/Nexus APIs |

The frontend and backend remain separate application layers.

The backend should own the important business rules, including:

- form assignment;
- workflow progression;
- permissions/field ownership;
- phase rules;
- rating validation;
- evidence validation;
- data mutations.

The React client should not be the only place where core business rules are enforced.

The application runs in a development environment only.

No deployment architecture is required.

---

## 4. Branding and UI theme

Use the following Depa PMS colors:

| Usage | Color |
| --- | --- |
| Primary | `#CF2729` |
| Secondary | `#D7CCB8` |
| Tertiary | `#F15B40` |
| Neutral | `#414042` |

The UI should be:

- clean;
- minimal;
- professional;
- easy to scan;
- consistent;
- free of unnecessary animation or decoration.

Brand colors should be used selectively for navigation, actions, statuses, headings, and highlights.

---

## 5. Core scope

The POC must support exactly five PMS form types:

1. DUG Leadership Scorecard
2. KBU Leadership Scorecard
3. Department Heads / Senior Managers KPI Form
4. Project Delivery / Professional KPI Form
5. Administrative / Support Non-KPI Form

The POC must demonstrate:

- test login by Employee Number;
- Oracle employee retrieval;
- Department Head retrieval;
- employer/company mapping for DUG/KBU determination;
- RoleCategory mapping;
- 2027 PMS submission creation;
- correct automatic form assignment;
- predefined workflow execution;
- Goal Setting;
- Mid-Year Review;
- Year-End Self-Review;
- Manager Rating;
- Development / Close;
- save as draft;
- initiate;
- approve;
- reject;
- resubmit;
- field ownership;
- comments;
- weighting rules;
- five-point ratings;
- overall rating calculation;
- evidence URL/reference rules;
- basic workflow history;
- phase locking;
- final read-only closure.

---

## 6. Non-goals

The following remain outside the POC:

- HR functionality unrelated to PMS;
- anonymous 360-degree feedback;
- calibration;
- forced-distribution/bell-curve logic;
- delegated approvals;
- impersonation;
- automatic daily Oracle synchronization;
- approval of Group Strategy inside PMS;
- approval of GCEO N-1 priorities inside PMS;
- approval of the N-2/N-3 strategic cascade inside PMS;
- advanced reporting or analytics;
- enterprise-grade security or infrastructure.

---

## 7. Business strategy context

The PMS begins after strategic direction has already been agreed outside the application.

The five Group strategic ambitions are:

1. Execution Excellence
2. Disciplined Growth
3. Priority Markets
4. Shareholder Value
5. Institutional Readiness

The business process remains:

### Group Strategy / Annual OKRs

→

### GCEO sets N-1 priorities

→

### KBU Heads cascade N-2 / N-3

→

### Approved strategy/reference data is made available to PMS

→

### The five PMS forms are used

There is no workflow inside the POC for approving the upstream strategy layers.

Strategy/reference data may be seeded directly into the database or application configuration for the POC.

No strategy-reference administration UI is required.

---

## 8. Test login

The POC does not use Azure AD SSO.

The login screen should allow the tester to enter any valid `EMPLOYEE_NUMBER`.

The backend uses that Employee Number as the current test user.

No password is required.

This login mechanism exists only to test role-based and workflow behavior in the POC.

It is only a test identity mechanism for this development POC.

Initial administrative assignments:

- `EMPLOYEE_NUMBER = "12245"` → HR Admin
- `EMPLOYEE_NUMBER = "21975"` → IT System Admin

Other employees use their normal PMS role based on their employee record and workflow context.

---

## 9. User roles

### 9.1 Employee

An Employee can:

- view their own 2027 PMS submission;
- edit employee-owned fields when the submission is pending with them;
- save their work as draft;
- initiate or resubmit when applicable;
- provide self-review information;
- enter comments;
- view workflow comments/history;
- enter employee evidence URLs/references where required.

An Employee cannot:

- edit while the form is pending with another participant;
- edit manager-owned fields;
- edit a fully approved phase;
- edit the form after the annual submission is closed.

### 9.2 Line Manager / Approver

A Line Manager can:

- view their own 2027 PMS submission;
- view direct-report submissions;
- open submissions pending with them;
- review employee-entered information;
- enter manager-owned ratings/comments where applicable;
- save manager-owned work as draft;
- approve;
- reject;
- view workflow comments/history.

A manager must not overwrite employee-owned content.

If employee-owned information needs correction, the manager rejects the submission back to the employee.

### 9.3 Department Head

A Department Head can:

- view their own PMS;
- view PMS records for employees in their department;
- perform workflow actions when assigned;
- maintain `RoleCategory` mappings for employees in their department.

RoleCategory values are:

- `ProjectDeliveryProfessional`
- `AdministrativeSupport`

For the POC, a simple RoleCategory administration screen or direct seeded mapping is sufficient.

### 9.4 HR Admin

`EMPLOYEE_NUMBER = "12245"` is the HR Admin for the POC.

HR Admin can:

- retrieve employees from Oracle;
- select a department;
- populate and review the department's employee population;
- see the calculated form assignment for each employee;
- see the resolved manager/workflow;
- see validation problems;
- generate 2027 PMS submissions;
- view all 2027 PMS submissions;
- manage RoleCategory mappings where needed;
- manually open/close the current phase;
- view basic workflow history;
- seed or maintain simple POC configuration where a small UI is useful.

The POC does not require:

- workflow-template configuration UI;
- workflow reassignment UI;
- advanced cycle configuration UI;
- strategy-reference administration UI;
- dashboards;
- advanced cancellation/reopening administration.

HR Admin must not impersonate another employee through the workflow.

### 9.5 IT System Admin

`EMPLOYEE_NUMBER = "21975"` is the IT System Admin for the POC.

The IT System Admin role grants no elevated participation in normal PMS business workflow.

If employee `21975` has their own generated PMS submission, they may still act as the Employee when the pending workflow assignee is exactly `21975`.

For the POC, IT SysAdmin may be allowed to inspect technical data/screens needed for testing and troubleshooting.

---

## 10. Oracle employee integration

Employee data is retrieved from:

`https://appstoredev01.uaenorth.cloudapp.azure.com/services/oracle/dug/employees?$select=EMPLOYEE_NUMBER,FIRST_NAME,LAST_NAME,FULL_NAME,EMAIL_ADDRESS,DEPARTMENT,JOB,POSITION,POSITION_NAME,GRADE,SUPERVISOR_NO,SUPERVISOR,EMPLOYER,USER_EXISTS&$filter=USER_EXISTS eq 'Y'`

Required employee fields include:

- `EMPLOYEE_NUMBER`
- `FIRST_NAME`
- `LAST_NAME`
- `FULL_NAME`
- `EMAIL_ADDRESS`
- `DEPARTMENT`
- `JOB`
- `POSITION`
- `POSITION_NAME`
- `GRADE`
- `SUPERVISOR_NO`
- `SUPERVISOR`
- `EMPLOYER`
- `USER_EXISTS`

The Oracle bearer token is stored server-side through:

`ORACLE_BEARER_TOKEN`

The browser must not call the Oracle API directly with the bearer token.

No scheduled Oracle synchronization is required.

---

## 11. Employer-to-company mapping

For employees with:

`GRADE >= 18`

PMS must determine whether the employee belongs to DUG or a KBU.

The employee's `EMPLOYER` value is resolved against:

`https://nexus.depa.com/api/v1/module/submissions/67065de0ed9c6b400a66187f`

An employee is considered a DUG employee when the `EMPLOYER` maps to a company record whose:

`org_Name = "DEPA United Group PJSC"`

Form determination:

- `GRADE >= 18` and DUG employee → **DUG Leadership Scorecard**
- `GRADE >= 18` and not DUG employee → **KBU Leadership Scorecard**

If the employer cannot be resolved, the POC should show a clear validation error instead of assigning a form silently.

---

## 12. Department Head integration

Department Head information is retrieved from:

`https://appstoredev01.uaenorth.cloudapp.azure.com/services/oracle/dug/hr-department/heads`

Relevant fields:

- `NAME`
- `ORGANIZATION_ID`
- `ORG_INFORMATION2`
- `FULL_NAME`
- `EMPLOYEE_NUMBER`

For employees with `GRADE < 18`, Department Head status is determined by comparing the employee's `EMPLOYEE_NUMBER` with the Department Head API's `EMPLOYEE_NUMBER` values.

A match means the employee is treated as a Department Head for form assignment.

The Grade 18+ leadership branch always takes precedence.

---

## 13. RoleCategory mapping

For employees with `GRADE < 18` who are not Department Heads, form assignment depends on `RoleCategory`.

Allowed values:

- `ProjectDeliveryProfessional`
- `AdministrativeSupport`

For the POC, RoleCategory may be stored in a simple database table and managed through a minimal screen or seeded directly.

If RoleCategory is missing when it is required, the employee cannot receive a PMS form until the mapping is supplied.

---

## 14. Form assignment decision tree

Exactly one form must be selected for each employee.

The rules must execute in this order.

### Step 1 — Grade 18+ leadership

If:

`GRADE >= 18`

then:

- DUG employer → **DUG Leadership Scorecard**
- non-DUG employer → **KBU Leadership Scorecard**

Do not evaluate Department Head status or RoleCategory for this branch.

### Step 2 — Below Grade 18 Department Head

If:

`GRADE < 18`

and the employee is a Department Head:

→ **Department Heads / Senior Managers KPI Form**

Otherwise continue to Step 3.

### Step 3 — Below Grade 18 RoleCategory

If:

`GRADE < 18`

and the employee is not a Department Head:

- `ProjectDeliveryProfessional` → **Project Delivery / Professional KPI Form**
- `AdministrativeSupport` → **Administrative / Support Non-KPI Form**

If RoleCategory is missing or invalid, no form is created.

### Precedence examples

- Grade 18 DUG employee who is also a Department Head → DUG Leadership Scorecard
- Grade 18 KBU employee who is also a Department Head → KBU Leadership Scorecard
- Grade 17 Department Head → Department Heads / Senior Managers KPI Form
- Grade 17 non-Department Head + `ProjectDeliveryProfessional` → Project Delivery / Professional KPI Form
- Grade 17 non-Department Head + `AdministrativeSupport` → Administrative / Support Non-KPI Form

---

## 15. One PMS per employee for 2027

An employee can have only one PMS submission for the 2027 cycle.

The database should enforce uniqueness conceptually on:

`EmployeeNumber + Year`

For the POC:

`Year = 2027`

Duplicate creation must be blocked.

---

## 16. Employee snapshot

When a 2027 PMS submission is created, the employee data used for that submission should be stored as a snapshot.

At minimum, preserve the fields needed to understand the employee at creation time, including:

- Employee Number;
- Full Name;
- Department;
- Job/Position;
- Grade;
- Employer;
- Supervisor Number;
- Supervisor Name;
- RoleCategory where applicable;
- Department Head status where applicable;
- resolved form type.

Later Oracle changes do not need to update an already-created POC submission automatically.

---

## 17. HR Populate → Generate flow

The POC should preserve the two-step HR generation model.

### Step 1 — Populate

1. HR opens **Create PMS Submissions**.
2. HR selects a Department.
3. HR clicks **Populate**.
4. PMS retrieves the eligible employee population from Oracle.
5. PMS resolves the necessary form-assignment data.
6. PMS shows a review table.

Suggested columns:

| Employee | Grade | Employer / Classification | Department Head | RoleCategory | Manager | Form | Status |
| --- | ---: | --- | --- | --- | --- | --- | --- |

Typical statuses:

- `Ready`
- `PMS Already Exists`
- `Missing RoleCategory`
- `Missing Manager`
- `Missing Grade`
- `Missing Department`
- `Missing Employer`
- `Unable to Resolve DUG/KBU`
- `Unable to Determine Department Head Status`
- `No Valid Form Mapping`

Populate is a preview only.

It must not create PMS submissions.

The POC does not require advanced filtering, pagination, or large-volume optimization on this screen.

### Step 2 — Generate

When HR clicks **Generate**:

1. validate the selected employees again;
2. create a PMS submission only for valid/Ready employees;
3. create the predefined workflow instance;
4. save the employee snapshot;
5. return a simple result summary.

Example:

- 10 Created
- 1 Skipped — Already Exists
- 2 Not Created — Validation Failed

Large-scale bulk optimization is out of scope.

---

## 18. 2027 cycle and phases

Only the 2027 PMS cycle is required.

The POC may seed a single cycle such as:

- Year: `2027`
- Name: `PMS 2027`
- Status: `Active`

Supported phases:

- `GoalSetting`
- `MidYear`
- `YearEnd`
- `Development`
- `Closed`

HR manually controls the active phase.

No date-driven automatic phase transitions are required.

No multi-year browsing is required.

---

## 19. Phase locking

When a phase is active, only submissions in the active workflow state may progress.

When a phase becomes fully approved for a submission:

- that phase becomes read-only for that submission.

When HR opens the next phase:

- the appropriate fields for the new phase become available;
- previously approved content remains read-only except where the Mid-Year rules explicitly allow an update.

When the annual PMS submission reaches `Closed`:

- the entire form becomes read-only.

For the POC, only a straightforward open/close phase control is required.

Complex phase reopening scenarios are out of scope.

---

## 20. Predefined workflow

The POC uses the predefined workflow:

### Employee → Line Manager

The employee is the first workflow participant.

The Line Manager is determined from Oracle employee data using:

- `SUPERVISOR_NO`
- `SUPERVISOR`

No workflow-template configuration UI is required.

No workflow assignment/configuration engine is required beyond what is necessary to instantiate the predefined workflow for each submission.

The data model may still keep workflow steps separate from the scorecard so the POC demonstrates clean workflow behavior.

---

## 21. Workflow ownership rule

At any moment, exactly one participant owns the pending workflow action.

Only the current pending participant may perform editable workflow actions.

However, being the pending participant does not grant ownership of every field.

Field ownership must also be enforced.

### Employee-owned fields

Examples:

- employee goal proposals;
- Actual;
- SelfRating;
- EmployeeComment;
- employee evidence URL/reference;
- employee Mid-Year updates/comments where applicable.

### Manager-owned fields

Examples:

- ManagerRating;
- ManagerComment;
- manager Mid-Year comments;
- manager assessment;
- manager evidence URL/reference.

A manager must not silently edit employee-owned content.

---

## 22. Workflow actions

### Save as Draft

The current participant may save changes without advancing the workflow.

Save as Draft is not a partial-save mechanism in this POC. It must validate every applicable field owned by the current participant, conditional evidence requirements, and the exact 100% weight total before persisting.

### Initiate

Used by the employee when starting or submitting the current phase.

Initiate:

- validates the participant's fields;
- saves their content;
- completes their step;
- moves the submission to the Line Manager.

### Approve

Used by the Line Manager.

Approve:

- validates manager-owned fields;
- completes the manager step;
- marks the current phase `FullyApproved`.

### Reject

The Line Manager may reject the submission back to the employee.

Reject:

- returns the submission to the employee;
- allows the employee to modify employee-owned fields;
- preserves the rejection in workflow history.

### Resubmit

After rejection, the employee uses **Resubmit** rather than Initiate.

Resubmit returns the form to the manager.

Rejection/resubmission may happen repeatedly.

---

## 23. Comments

Workflow actions may include a comment.

Comments are generally optional.

The UI should strongly encourage a reason when rejecting.

All users authorized to open a submission may view its workflow comments/history.

No separate notification is generated from comments in the POC.

---

## 24. Basic workflow history

The POC requires a basic immutable workflow history sufficient to demonstrate the sequence of actions.

Each history entry should contain at least:

- Scorecard ID;
- Phase;
- Action;
- Action By Employee Number;
- Comment;
- Date/Time;
- From Participant;
- To Participant where applicable.

The history UI does not need to display From Participant or To Participant movement text. Keeping those values in the immutable history record is sufficient.

Typical actions:

- `Created`
- `SavedDraft`
- `Initiated`
- `Approved`
- `Rejected`
- `Resubmitted`
- `PhaseOpened`
- `PhaseClosed`
- `Closed`

Only the basic workflow history defined in this document is required; no advanced audit subsystem or detailed field-level history is required.

---

## 25. Goal Setting

Goal Setting uses the applicable one of the five PMS forms.

The employee completes employee-owned goal-setting fields and submits the phase.

The Line Manager may:

- review;
- comment;
- approve;
- reject.

The manager cannot silently rewrite employee-owned goals.

When the manager approves, Goal Setting becomes `FullyApproved` and is locked.

---

## 26. Mid-Year Review

HR manually opens the Mid-Year phase.

The Mid-Year phase should demonstrate progress review and limited plan updates.

For KPI-based forms, the employee may update applicable fields such as:

- objective/KPI wording;
- target;
- measure;
- weight;
- strategy linkage;
- `MidYearStatus`;
- `MidYearComment`.

Supported Mid-Year statuses:

- `OnTrack`
- `AtRisk`
- `Blocked`

The revised Mid-Year position follows the same Employee → Line Manager workflow.

The POC does **not** require detailed amendment/version history showing every previous field value.

It is sufficient to preserve the current approved Mid-Year state and the basic workflow history showing that the Mid-Year submission was reviewed and approved.

Structural changes must not first be introduced retrospectively at Year-End.

---

## 27. Year-End Self-Review

HR manually opens Year-End.

For KPI-based forms, the employee enters:

- `Actual`
- `SelfRating`
- `EmployeeComment`
- `EmployeeEvidenceURL` when required

The employee may save as draft.

When the employee submits:

- employee-owned fields become locked while pending with the manager;
- the Line Manager can see the submitted SelfRating;
- the Line Manager can enter manager-owned assessment fields.

The manager cannot see or edit an unsubmitted employee draft as if it were submitted workflow content.

---

## 28. Manager Rating

The manager enters:

- `ManagerRating`
- `ManagerComment`
- `ManagerEvidenceURL` when required

The manager may save as draft.

The employee must not see an unsubmitted manager rating while the manager is still working on it.

After the manager approves the phase, the finalized manager rating becomes visible to the employee.

---

## 29. Administrative / Support self-review

The Administrative / Support form does not use an employee numerical SelfRating.

Employees provide:

- Employee Comment;
- employee evidence reference where applicable.

Managers provide:

- Manager Rating;
- Manager Comment;
- manager evidence reference where applicable.

---

## 30. Development and Close

After Year-End is completed, HR opens the Development phase.

The POC should provide a simple `DevelopmentNotes` area.

Development information may include:

- agreed development priorities;
- training/development actions;
- manager feedback;
- employee comments.

Once the final Development workflow is approved:

`Status = Closed`

The submission becomes read-only.

---

## 31. Five-point rating scale

The common scale is:

| Rating | Label | Meaning |
| --- | --- | --- |
| 5 | Exceptional | Significantly exceeds agreed outcomes |
| 4 | Exceeds Expectations | Consistently exceeds targets |
| 3 | Meets Expectations | Delivers agreed expectations |
| 2 | Partially Meets | Material gaps remain |
| 1 | Does Not Meet | Substantially below expectations |

The scale is the same across all applicable forms.

---

## 32. Weighting

For all weighted forms:

`Total Weight = 100%`

Save as Draft, Initiate, Resubmit, and Approve must be blocked if the applicable weights do not total exactly 100%.

The UI should show a running total.

Recommended validation:

- each weight is an integer;
- each weight > 0;
- each weight <= 100;
- total = 100%.

---

## 33. Overall rating

For weighted forms:

`OverallRating = Σ(ManagerRating × Weight / 100)`

Display the calculated score rounded to one decimal place.

Do not calculate the final OverallRating until all required manager ratings are present.

The Administrative / Support form uses the same weighted calculation based on its configured standards.

No calibration adjustment is included.

---

## 34. Evidence

Evidence is captured as an external URL/reference only.

The POC does not upload or store evidence files.

Use only:

- `EmployeeEvidenceURL`
- `ManagerEvidenceURL`

No separate evidence-description fields are required.

The employee and manager evidence references remain separate.

---

## 35. Evidence requirement for ratings 4 or 5

If:

`SelfRating = 4 or 5`

then an employee evidence URL/reference is required for that KPI.

If:

`ManagerRating = 4 or 5`

then a manager evidence URL/reference is required for that KPI.

The employee evidence does not satisfy the manager evidence requirement and vice versa.

The application must block the relevant submission/approval when required evidence is missing.

---

## 36. DUG Leadership Scorecard

Population:

Employees with `GRADE >= 18` whose `EMPLOYER` maps to `DEPA United Group PJSC`.

Perspectives:

- Customer
- Financials
- People & Culture
- Strategic Initiatives

Fields per objective:

- Perspective
- Objective / Key Result
- Linked Strategy Reference
- Measure
- Target
- Weight
- Actual
- SelfRating
- ManagerRating
- EmployeeComment
- ManagerComment
- EmployeeEvidenceURL
- ManagerEvidenceURL

Rules:

- employee may add/remove objective rows during Goal Setting;
- minimum 1 objective;
- recommended 4-8 meaningful objectives;
- each objective requires a Perspective;
- each objective links to a seeded/approved strategy reference;
- total weight = 100%.

---

## 37. KBU Leadership Scorecard

Population:

Employees with `GRADE >= 18` whose `EMPLOYER` does not map to `DEPA United Group PJSC`.

Perspectives:

- Business Development
- Backlog & New Awards
- Projects
- Financials
- Strategic Initiatives

Fields per objective:

- Perspective
- Objective / Key Result
- Linked Strategy Reference
- Measure
- Target
- Weight
- Actual
- SelfRating
- ManagerRating
- EmployeeComment
- ManagerComment
- EmployeeEvidenceURL
- ManagerEvidenceURL

Rules:

- recommended 4-8 meaningful objectives;
- total weight = 100%;
- strategy references are seeded/configured directly for the POC.

---

## 38. Department Heads / Senior Managers KPI Form

Population:

Employees with `GRADE < 18` who are identified as Department Heads.

Recommended KPI count:

`4-6`

Fields per KPI:

- KPI / Outcome
- Linked DUG / KBU / Function Objective
- Measure
- Target
- Weight
- Actual
- MidYearStatus
- MidYearComment
- SelfRating
- ManagerRating
- EmployeeComment
- ManagerComment
- EmployeeEvidenceURL
- ManagerEvidenceURL

Rules:

- minimum 4 KPIs;
- maximum 6 KPIs;
- each KPI requires linkage;
- each KPI requires a measurable target;
- total weight = 100%.

---

## 39. Project Delivery / Professional KPI Form

Population:

Employees with `GRADE < 18` who are not Department Heads and whose:

`RoleCategory = ProjectDeliveryProfessional`

Performance Areas may include:

- Project / Delivery
- Cost / Productivity
- Quality
- Schedule / Milestones
- Customer / Stakeholder
- Technical / Functional

Recommended KPI count:

`4-6`

Fields per KPI:

- Performance Area
- KPI / Outcome
- Linked Department / Function / Project Objective
- Measure
- Target
- Weight
- Actual
- MidYearStatus
- MidYearComment
- SelfRating
- ManagerRating
- EmployeeComment
- ManagerComment
- EmployeeEvidenceURL
- ManagerEvidenceURL

Rules:

- 4-6 meaningful KPIs;
- total weight = 100%.

---

## 40. Administrative / Support Non-KPI Form

Population:

Employees with `GRADE < 18` who are not Department Heads and whose:

`RoleCategory = AdministrativeSupport`

The form uses fixed performance standards.

Initial standards:

| Standard | Starting Weight |
| --- | ---: |
| Core Job Responsibilities | 40% |
| Quality & Accuracy | 15% |
| Timeliness & Reliability | 15% |
| Service & Responsiveness | 10% |
| Process & Compliance | 10% |
| Collaboration & Improvement | 10% |

For the POC, these values may be seeded directly.

Fields:

- Performance Standard
- Expected Standard
- Weight
- Employee Comment
- Manager Rating
- Manager Comment
- EmployeeEvidenceURL
- ManagerEvidenceURL

There is no employee numerical SelfRating.

Total weight = 100%.

---

## 41. Field data types

Recommended types:

| Field | Type |
| --- | --- |
| Objective/KPI | Text |
| Measure | Text |
| Target | Text |
| Actual | Text |
| Weight | Integer |
| Rating | Integer 1-5 |
| Comments | Long Text |
| EmployeeEvidenceURL | URL/Text |
| ManagerEvidenceURL | URL/Text |
| MidYearStatus | Enum |
| Year | Integer |

Targets and Actual values should remain text in the POC to avoid unnecessary data-model complexity.

---

## 42. Strategy linkage

KPI-based forms should maintain a line of sight to seeded strategy/reference data.

Each applicable KPI/objective should have one primary strategy/reference link.

Administrative / Support standards do not require a strategy parent link.

No strategy-reference administration UI is required.

---

## 43. Visibility rules

### Employee

Can view:

- own 2027 PMS only.

### Line Manager

Can view:

- own 2027 PMS;
- direct-report PMS records.

### Department Head

Can view:

- own 2027 PMS;
- PMS records for employees in their department.

### HR Admin

Can view:

- all 2027 PMS records.

### IT System Admin

May inspect technical data for POC troubleshooting but is not a normal PMS business participant.

The backend should apply these visibility rules.

---

## 44. Simple application screens

The POC should contain only the screens needed to demonstrate the business process.

Suggested screens:

1. **Test Login**
   - enter `EMPLOYEE_NUMBER`;
   - login as that employee.

2. **Home / My PMS**
   - show the current user's 2027 PMS;
   - show current phase;
   - show current workflow status;
   - provide access to the form.

3. **My Team**
   - for managers;
   - list direct-report 2027 submissions;
   - indicate current status/pending participant.

4. **Department PMS**
   - for Department Heads;
   - list department employees and their PMS submissions.

5. **HR — Create PMS Submissions**
   - Department selector;
   - Populate;
   - validation table;
   - Generate.

6. **HR — All 2027 Submissions**
   - simple list of all submissions;
   - basic status information;
   - no advanced dashboard metrics required.

7. **RoleCategory Mapping**
   - minimal screen for required employee mappings.

8. **Phase Control**
   - show current 2027 phase;
   - simple HR action to move/open the next phase.

9. **PMS Form**
   - render the correct form type;
   - enforce field ownership;
   - expose workflow actions;
   - show workflow history/comments.

No dashboard-specific UI is required.

---

## 45. Data model

The POC should use a small, clear relational model.

Suggested core entities:

### `PerformanceCycle`

Represents the 2027 cycle and active phase.

Suggested fields:

- ID
- Year
- Name
- Status
- CurrentPhase

### `EmployeeSnapshot`

Stores employee information used when creating the PMS submission.

Suggested fields:

- ID
- EmployeeNumber
- FullName
- Department
- Job
- Position
- Grade
- Employer
- SupervisorNumber
- SupervisorName
- DepartmentHeadAtCreation
- RoleCategoryAtCreation

### `RoleCategoryMapping`

Suggested fields:

- EmployeeNumber
- RoleCategory

### `StrategyReference`

Seeded POC strategy/reference data.

Suggested fields:

- ID
- Year
- Level
- Title
- Description
- Measure
- Target
- Weight
- ParentStrategyReferenceID
- DisplayOrder
- Active

### `Scorecard`

Master PMS submission.

Suggested fields:

- ID
- EmployeeSnapshotID
- PerformanceCycleID
- FormType
- CurrentPhase
- Status
- CurrentWorkflowAssigneeEmployeeNumber
- WeightTotal
- OverallRating
- DevelopmentNotes
- CreatedDate
- ClosedDate

### `ScorecardLine`

KPI/objective rows for the four KPI-based forms.

Suggested fields:

- ID
- ScorecardID
- LinkedStrategyReferenceID
- Perspective
- PerformanceArea
- Title
- MeasureDescription
- Target
- Weight
- Actual
- MidYearStatus
- MidYearComment
- SelfRating
- EmployeeComment
- ManagerRating
- ManagerComment
- EmployeeEvidenceURL
- ManagerEvidenceURL

### `AdminStandard`

Rows for the Administrative / Support form.

Suggested fields:

- ID
- ScorecardID
- StandardName
- ExpectedStandard
- Weight
- EmployeeComment
- ManagerRating
- ManagerComment
- EmployeeEvidenceURL
- ManagerEvidenceURL

### `WorkflowStep`

Instantiated predefined Employee → Line Manager workflow.

Suggested fields:

- ID
- ScorecardID
- Phase
- StepNumber
- StepName
- AssignedEmployeeNumber
- Status
- StartedAt
- CompletedAt

### `WorkflowHistory`

Basic workflow action history.

Suggested fields:

- ID
- ScorecardID
- Phase
- Action
- ActionByEmployeeNumber
- Comment
- ActionDateTime
- FromParticipant
- ToParticipant

No Notification entity is required.

No detailed GoalAmendmentHistory entity is required for the POC.

---

## 46. Status model

Suggested submission statuses:

- `NotStarted`
- `InProgress`
- `PendingApproval`
- `FullyApproved`
- `Closed`

Suggested workflow step statuses:

- `NotStarted`
- `Pending`
- `Approved`
- `Rejected`

The exact implementation may use separate phase status and annual submission status if that makes the code clearer.

---

## 47. Concurrency and duplicate actions

The POC does not require advanced concurrency infrastructure.

However, the backend should still prevent obvious duplicate workflow transitions caused by repeated clicks or stale screens.

At minimum:

- verify the current pending participant before every transition;
- verify the current workflow state before approval/rejection/resubmission;
- use database transactions for workflow state changes where practical.

---

## 48. Search and filtering

Advanced search, filtering, and pagination are out of scope.

Simple lists may provide lightweight client-side or basic server-side filtering if useful for testing, but this is not a POC acceptance requirement.

---

## 49. Performance expectations

The POC does not need to demonstrate large-scale bulk performance.

It should work reliably for a practical test dataset and allow HR to create multiple submissions in one operation.

No queues, parallel job framework, background workers, retry mechanisms, or performance tuning for hundreds/thousands of users is required.

Correctness is more important than throughput.

---

## 50. Notifications

Notifications are completely excluded from the POC.

Do not implement:

- email notifications;
- in-app notifications;
- notification retry logic;
- reminder/escalation logic;
- notification failure logs.

Workflow state shown inside the application is sufficient for the POC.

---

## 51. Authentication and security limitations

The POC intentionally does not implement enterprise authentication security.

The test login accepts an `EMPLOYEE_NUMBER` without a password.

This is acceptable only because the application is being used in a controlled development environment for demonstration/testing.

Core business authorization should still be represented so the POC can demonstrate:

- own-form visibility;
- manager/subordinate visibility;
- Department Head department visibility;
- HR visibility;
- current-workflow-participant editing;
- employee vs manager field ownership.

Azure AD, secure session hardening, enterprise secrets-management design, penetration testing, and deployment security are outside this specification.

The Oracle bearer token must still remain server-side because it is an integration credential.

---

## 52. Hosting and deployment

No hosting or deployment is required.

The POC should run in the development environment only.

A local/development setup with:

- React frontend;
- Node.js backend;
- PostgreSQL database;

is sufficient.

No CI/CD pipeline, cloud infrastructure, reverse proxy, high availability, queues, monitoring, alerting, or disaster recovery is required.

---

## 53. Data export and Oracle migration

Oracle migration/export is not a POC deliverable.

No formal bulk export schema is required.

Developers may use simple database inspection or ad-hoc test export functionality during development if useful, but this is not part of the POC product requirements.

---

## 54. Cancellation and reopening

Complex cancellation and reopening scenarios are out of scope.

The POC does not need a full cancellation/reopen administrative workflow.

If a simple `Cancelled` status is implemented for testing, it may make the form read-only, but detailed cancellation reasons, reopen rules, audit records, and restoration logic are not required.

---

## 55. Configuration approach

The POC intentionally avoids advanced configuration UIs. Seeded configuration is part of the required implementation approach and does not imply that another configuration specification exists.

The following may be seeded directly in the database, backend configuration, or development fixtures:

- 2027 PerformanceCycle;
- default Employee → Line Manager workflow;
- strategy/reference data;
- Administrative / Support standards and weights;
- fixed form definitions;
- HR Admin Employee Number;
- IT System Admin Employee Number;
- any initial RoleCategory mappings needed for demonstration.

Only create configuration screens where they are required to demonstrate an important business operation, such as RoleCategory mapping or phase control.

---

## 56. Permissions summary

| Action | Employee | Line Manager | Department Head | HR Admin | IT SysAdmin |
| --- | --- | --- | --- | --- | --- |
| Test login as self | Yes | Yes | Yes | Yes | Yes |
| View own PMS | Yes | Yes | Yes | Yes | Yes |
| View direct reports | No | Yes | If applicable | Yes | Technical/testing only |
| View department PMS | No | Direct reports only | Yes | Yes | Technical/testing only |
| View all PMS | No | No | No | Yes | Technical/testing only |
| Edit employee-owned fields | When pending with self | No | Only own PMS | Only own PMS | No |
| Edit manager-owned fields | No | When pending with self | When assigned | When legitimately assigned | No |
| Initiate / Resubmit | When pending with self | If workflow returns to them | If workflow returns to them | If legitimately assigned | No |
| Approve | If assigned | If assigned | If assigned | If legitimately assigned | No |
| Reject | If assigned | If assigned | If assigned | If legitimately assigned | No |
| Assign RoleCategory | No | No | Department scope | Yes | No |
| Populate / Generate | No | No | No | Yes | No |
| Change active phase | No | No | No | Yes | No |
| View basic workflow history | Own/authorized | Authorized | Authorized | Yes | Technical/testing only |

---

## 57. POC acceptance scenarios

The POC is successful when the following scenarios can be demonstrated.

### Scenario 1 — Test login

- Tester enters an Employee Number.
- PMS resolves the corresponding employee.
- PMS opens the application as that test user.

### Scenario 2 — HR form generation

- HR logs in using `12245`.
- HR selects a department.
- HR clicks Populate.
- PMS retrieves employees and resolves the correct form for each employee.
- HR clicks Generate.
- PMS creates valid 2027 submissions.

### Scenario 3 — DUG leadership assignment

- A Grade 18+ employee whose Employer maps to `DEPA United Group PJSC` receives the DUG Leadership Scorecard.

### Scenario 4 — KBU leadership assignment

- A Grade 18+ employee whose Employer does not map to `DEPA United Group PJSC` receives the KBU Leadership Scorecard.

### Scenario 5 — Department Head assignment

- A Grade <18 employee appearing in the Department Head API receives the Department Heads / Senior Managers KPI Form.

### Scenario 6 — RoleCategory assignment

- A Grade <18 non-Department Head with `ProjectDeliveryProfessional` receives the Project Delivery / Professional KPI Form.
- A Grade <18 non-Department Head with `AdministrativeSupport` receives the Administrative / Support Non-KPI Form.

### Scenario 7 — Goal Setting workflow

- Employee edits owned fields.
- Employee saves draft.
- Employee initiates.
- Form moves to Line Manager.
- Manager can approve or reject.
- Employee cannot edit while the form is pending with the manager.

### Scenario 8 — Rejection and resubmission

- Manager rejects with a comment.
- Form returns to Employee.
- Employee edits owned fields.
- Employee resubmits.
- Form returns to Manager.
- Workflow history shows the sequence.

### Scenario 9 — Weight validation

- A weighted form cannot be saved as draft or submitted if total weight is not exactly 100%.
- A fractional weight is rejected.

### Scenario 10 — Evidence validation

- SelfRating 4/5 requires EmployeeEvidenceURL.
- ManagerRating 4/5 requires ManagerEvidenceURL.

### Scenario 11 — Mid-Year

- HR opens Mid-Year.
- Employee records Mid-Year status/comment and can update allowed plan fields.
- Employee submits to manager.
- Manager approves/rejects through the same workflow.

### Scenario 12 — Year-End

- Employee enters Actual, SelfRating, comment, and required evidence.
- Manager enters ManagerRating, ManagerComment, and required evidence.
- Overall rating is calculated correctly.

### Scenario 13 — Administrative / Support form

- Employee provides comments but no numerical SelfRating.
- Manager provides the 1-5 rating.

### Scenario 14 — Close

- Development information can be recorded.
- Final approval closes the submission.
- Closed form becomes read-only.

---

## 58. Authoritative implementation decisions

1. The POC is for the **2027 cycle only**.
2. There are exactly five PMS forms.
3. Form assignment follows the strict Grade → DUG/KBU → Department Head → RoleCategory decision tree.
4. `GRADE >= 18` takes precedence over Department Head status and RoleCategory.
5. DUG is determined when Employer maps to `DEPA United Group PJSC`.
6. Department Head status below Grade 18 is determined from the Department Head API.
7. Below-18 non-Department Heads use RoleCategory.
8. There is one PMS submission per employee for 2027.
9. The predefined workflow is **Employee → Line Manager**.
10. No workflow-template configuration UI is required.
11. No workflow reassignment UI is required.
12. Only the current workflow participant may perform editable actions.
13. Employee and manager field ownership remains separate.
14. Reject returns the form to the employee and Resubmit returns it to the manager.
15. Rejection/resubmission may repeat.
16. Goal Setting, Mid-Year, Year-End, Manager Rating, and Development/Close remain in scope.
17. HR controls phases manually.
18. Complex phase reopening is out of scope.
19. Mid-Year may update the performance plan, but detailed amendment/version history is out of scope.
20. The five-point rating scale remains unchanged.
21. Weighted forms must total 100%.
22. Overall Rating uses manager ratings and weights.
23. Employee and manager evidence references remain separate.
24. Rating 4 or 5 requires the corresponding evidence URL/reference.
25. Evidence descriptions are not required.
26. Notifications are completely out of scope.
27. Dashboards are out of scope.
28. Multi-year/history browsing is out of scope.
29. Oracle migration/export deliverables are out of scope.
30. Azure AD SSO is out of scope.
31. Login uses any valid `EMPLOYEE_NUMBER` with no password for testing.
32. Employee `12245` is HR Admin for the POC.
33. Employee `21975` is IT System Admin for the POC.
34. Hosting/deployment is out of scope; development environment only.
35. Advanced search/filtering/pagination is out of scope.
36. Large-scale bulk/performance optimization is out of scope.
37. Strategy data may be seeded/configured directly with no administration UI.
38. Cycle/form configuration may be seeded directly with no advanced UI.
39. Basic workflow history is sufficient; no advanced audit subsystem is required.
40. Save as Draft requires all applicable participant-owned fields and the exact 100% weight total; incomplete drafts are not supported.
41. Weights are integers from 1 to 100.
42. IT System Admin status does not block employee `21975` from acting on a submission pending specifically with `21975`.
43. Participant movement remains stored in workflow history but is not displayed in the history UI.
44. Operational infrastructure such as queues, retries, monitoring, alerting, and deployment concerns is out of scope.

---

## 59. Interpretation rule for the coding agent

Implement the application exactly from this PRD. In particular:

- do not infer requirements from another PMS document;
- do not add excluded features merely because they are common in enterprise PMS products;
- where this PRD permits seeded data or a minimal screen, choose the simplest implementation that demonstrates the stated business rule;
- preserve the business-rule precedence and workflow behavior exactly as written;
- when a requirement is ambiguous during implementation, prefer the simpler behavior that remains consistent with the acceptance scenarios and the authoritative implementation decisions in this document.

---

## 60. Completion definition

The POC is considered complete when a developer can demonstrate the core PMS journey end-to-end in the development environment using real or representative Oracle employee data:

### HR Populate/Generate → Correct Form → Employee Goal Setting → Manager Approval/Rejection → Mid-Year → Year-End → Manager Rating → Development → Closed

The POC should prove that the business rules and user interactions are viable.

Anything related to enterprise hardening, operational scale, enterprise authentication, notifications, reporting, deployment, long-term history, migration, or advanced administration is outside this specification unless explicitly stated otherwise above.
