# PRD: Depa Performance Management System (PMS) - 2027 Cycle

## 1. Summary

Build a standalone Performance Management System for Depa's 2027 Performance Management Framework.

The PMS will manage the five performance form types defined by the business and support the annual performance lifecycle:

### Goal Setting → Mid-Year Review → Year-End Self-Review → Manager Rating → Development / Close

The upstream strategy-setting process is outside the PMS. Group Strategy and Annual OKRs, GCEO N-1 priorities, and KBU Heads' N-2/N-3 cascade are agreed outside the application through the business's normal management process. HR Administrators will configure the resulting approved objectives, measures, targets, weightings, and strategy references inside PMS.

The PMS will implement an Oracle-style sequential workflow. At any given point, exactly one participant owns the pending action. Only that participant may edit the fields assigned to them. They may save work as draft, initiate/resubmit it, approve it if they are an approver, or reject it where rejection is permitted.

When a phase is fully approved, that phase becomes locked. When HR opens the next annual phase, the relevant fields become available for that phase while previously completed information remains controlled according to field ownership and audit rules.

Once the full annual PMS cycle has been completed and closed, the form becomes permanently read-only through the application.

The system is expected to operate for approximately one year until the Oracle PMS module becomes available, so correctness, workflow integrity, auditability, ease of administration, and clean Oracle migration/export are higher priorities than extensive customization outside the PMS scope.

Employee master data and reporting information will be retrieved from the existing Oracle/Nexus APIs when HR creates PMS submissions. There will be no nightly employee synchronization.

Authentication will use Azure Active Directory SSO.

Notifications will be delivered by both email and in-app notification.

Calibration will take place outside the system and is not part of this solution.

---

## 2. Technical stack

The PMS will be built as a standalone web application with its own PMS data model, workflow logic, administration, and user interface.

The target stack is:

| Layer | Technology |
| --- | --- |
| Frontend | React + TypeScript |
| Backend | Node.js + TypeScript |
| Database | PostgreSQL |
| API style | REST |
| Authentication | Azure Active Directory SSO |
| Employee and organization data | Existing Oracle/Nexus APIs |
| Notifications | Email + in-app notifications |

The frontend and backend remain separate application layers, with PostgreSQL as the system database. The backend owns authorization, workflow rules, audit logging, Oracle/Nexus access, calculations, and all data mutations. The React client must not be trusted to enforce business permissions.

Keep the deployment simple. The initial solution should use one frontend application, one Node.js backend, and one PostgreSQL database. Do not introduce microservices, message brokers, distributed caches, or other infrastructure unless a real requirement appears during implementation.

All workflow transitions that change submission state must run through backend services and use PostgreSQL transactions or equivalent database protection. This includes initiate, approve, reject, resubmit, reassign, cancel, phase changes, and final close.

The codebase should keep PMS business rules separate from HTTP route handling. Workflow state changes, permission checks, rating validation, evidence rules, audit records, and notifications should be handled in application services rather than duplicated across API endpoints.

---

## 3. Branding and UI theme

Use the following Depa PMS colors throughout the application:

| Usage     | Color     |
| --------- | --------- |
| Primary   | `#CF2729` |
| Secondary | `#D7CCB8` |
| Tertiary  | `#F15B40` |
| Neutral   | `#414042` |

The theme should be applied consistently to:

* navigation;
* primary and secondary buttons;
* headings;
* workflow status indicators;
* form highlights;
* tables;
* tabs;
* notification indicators;
* dashboards.

Accessibility and readable contrast take priority where a brand color is unsuitable as a text/background combination.

---

## 4. Scope

### 4.1 In scope

The application will support exactly five PMS form types:

1. DUG Leadership Scorecard
2. KBU Leadership Scorecard
3. Department Heads / Senior Managers KPI Form
4. Project Delivery / Professional KPI Form
5. Administrative / Support Non-KPI Form

The application will support:

* PMS cycle administration;
* bulk form creation by HR;
* Oracle employee-data retrieval;
* RoleCategory assignment;
* configurable employee-specific workflows;
* goal setting;
* mid-year review;
* year-end employee review;
* manager assessment;
* weighted ratings;
* evidence URL/reference capture;
* comments;
* workflow rejection and resubmission;
* development notes;
* full workflow history;
* email notifications;
* in-app notifications;
* role-based dashboards;
* historical multi-year records;
* complete data export for eventual Oracle migration.

---

## 5. Non-goals

The following are explicitly outside scope:

* payroll;
* recruitment;
* leave management;
* other HR functionality outside the PMS scope;
* native mobile application;
* AI-assisted objective writing;
* AI coaching or performance recommendations;
* anonymous 360-degree feedback;
* calibration;
* forced-distribution/bell-curve logic;
* automatic daily Oracle employee synchronization;
* approval of Group Strategy / Annual OKRs inside PMS;
* approval of GCEO N-1 priorities inside PMS;
* approval of the N-2/N-3 strategic cascade inside PMS;
* acting/approving on behalf of another user;
* delegated approver functionality;
* business intelligence/reporting beyond operational dashboards in the initial release;
* storing evidence files directly in PMS in the initial release.

---

## 6. Business strategy context

The PMS begins after the strategic direction has already been agreed outside the application.

The five Group strategic ambitions are:

1. Execution Excellence
2. Disciplined Growth
3. Priority Markets
4. Shareholder Value
5. Institutional Readiness

The business process outside PMS is:

### Group Strategy / Annual OKRs

→

#### GCEO sets N-1 priorities

Approved objectives, measures, targets, and annual weightings for Group leadership.

→

#### KBU Heads cascade N-2 / N-3

Translate Group priorities into KBU, function, project, department, and role accountability.

→

#### HR configures the approved outcome in PMS

→

#### Five PMS forms are created and used

There is no separate workflow inside PMS for approving these upstream strategy layers.

---

## 7. User roles

### 7.1 Employee

An Employee can:

* view their own PMS submission;
* edit fields belonging to them when the workflow is pending with them;
* save their work as draft;
* initiate or resubmit when applicable;
* provide self-review information;
* add workflow comments;
* view previous workflow comments;
* view completed and historical PMS forms;
* enter evidence URLs where required.

An Employee cannot:

* edit the form while it is pending with another person;
* edit manager-owned fields;
* change a completed phase unless that phase has been reopened through the defined business process;
* edit the form after the entire cycle is closed.

---

### 7.2 Line manager / workflow approver

A manager or other workflow approver can:

* view PMS submissions assigned to them;
* view employee-entered information;
* view the employee's submitted self-rating;
* enter manager-owned ratings and comments during the appropriate phase;
* approve;
* reject where permitted;
* save manager-owned work as draft;
* view subordinate PMS submissions;
* view previous workflow comments.

Approvers must not silently overwrite fields owned by the employee or a previous workflow participant.

If information needs to be changed, the form must be rejected to the previous participant.

---

### 7.3 Department head

A Department Head can:

* view employees belonging to their department;
* view PMS forms within their authorized department;
* perform workflow actions when they are an assigned participant;
* maintain the `RoleCategory` mapping for employees in their department.

Department Heads are responsible for categorizing employees as:

* `ProjectDeliveryProfessional`; or
* `AdministrativeSupport`.

Changing the RoleCategory mapping does not transform or replace an already-created PMS form.

The updated mapping is used for future form creation unless HR explicitly cancels and recreates a form before the relevant process begins.

---

### 7.4 HR administrator

HR Administrators are the functional custodians of the PMS application.

HR Admin can:

* create and configure PMS cycles;
* manually open and close phases;
* retrieve employee information from Oracle;
* select employees by department;
* bulk-create PMS submissions;
* view all submissions;
* configure strategy reference data;
* configure workflow templates;
* modify workflow participants;
* reassign pending workflow steps;
* view workflow history;
* manage RoleCategory mappings where needed;
* cancel forms;
* view operational dashboards;
* configure form/cycle settings;
* export PMS data;
* manage PMS-related application configuration.

HR Admin must not impersonate another employee.

HR Admin must not approve on behalf of another person unless HR Admin is explicitly configured as a genuine participant in that workflow.

HR Admin cannot directly alter a closed annual PMS record through normal application functionality.

---

### 7.5 IT system administrator

IT System Administrators are technical administrators rather than functional custodians.

Their normal responsibilities are limited to:

* application incidents;
* infrastructure;
* integration failures;
* Azure AD configuration;
* database support;
* deployment;
* application-level technical troubleshooting;
* exceptional data repair subject to formal IT change control.

Routine PMS administration belongs to HR, not IT.

IT should not participate in normal PMS workflows.

---

## 8. Authentication

Authentication will use Azure Active Directory SSO.

Azure AD is used for authentication only.

The PMS application itself controls:

* employee identity mapping;
* business permissions;
* employee hierarchy;
* workflow membership;
* HR permissions;
* Department Head permissions.

No local password-based authentication is required for normal users.

### 8.1 PMS user mapping

Because Oracle employee records may not contain an email address for every employee, PMS must not rely solely on Oracle `EMAIL_ADDRESS` as the identity join key.

The application should maintain an internal user mapping between the authenticated Azure AD account and the applicable Oracle Employee Number.

Suggested fields:

* Azure AD Object ID
* Azure AD UPN
* Employee Number
* Active
* Mapping Source
* Last Updated

Automatic matching may be used where reliable information exists, but HR must be able to resolve unmatched users administratively.

Authentication success alone must not give a user access to another employee's PMS data.

---

## 9. Oracle employee integration

Employee data is retrieved from:

`https://nexus.depa.com/services/oracle/prd/employees`

Authentication uses an application bearer token.

The bearer token must:

* be stored server-side;
* never be sent to the browser;
* never be committed to source control;
* never appear in application logs;
* be configurable through environment/secret management.

---

## 10. Employee data fields

The Oracle employee API includes data such as:

* `EMPLOYEE_NUMBER`
* `FIRST_NAME`
* `LAST_NAME`
* `FULL_NAME`
* `EMAIL_ADDRESS`
* `DEPARTMENT`
* `JOB`
* `POSITION`
* `POSITION_NAME`
* `GRADE`
* `ASSIGNMENT_STATUS`
* `EMPLOYEE_CATEGORY`
* `SUPERVISOR_NO`
* `SUPERVISOR`
* `EMPLOYER`
* `ASSIGNMENT_ID`
* `PERSON_ID`
* `PRIMARY_FLAG`
* `USER_EXISTS`

The PMS should store the employee attributes necessary to preserve the context of each PMS cycle.

---

## 11. Oracle retrieval model

There is no scheduled daily synchronization.

Oracle employee data is retrieved as part of the HR form-generation process.

The intended workflow is:

1. HR selects **Create PMS Submissions**.
2. HR selects a Department.
3. PMS retrieves the current employee population from Oracle.
4. PMS displays the eligible employees belonging to that Department.
5. HR can select all employees or a subset.
6. HR confirms creation.
7. PMS creates one submission for every selected eligible employee.
8. Employee information required for that PMS submission is saved as a snapshot.

For example:

300 selected employees = 300 individual PMS submissions.

The system should optimize the Oracle interaction so a bulk creation operation does not unnecessarily make one complete employee-directory API request per employee.

---

## 12. Employee snapshot principle

Employee information associated with a PMS submission must be treated as a historical snapshot.

Once a form has been created, later Oracle data changes must not automatically rewrite the historical PMS record.

Examples:

* employee leaves the organization → existing PMS remains unchanged;
* employee changes department → existing PMS remains unchanged;
* employee changes job → existing PMS remains unchanged;
* employee changes grade → existing PMS remains unchanged;
* employee changes manager → existing PMS workflow remains unchanged unless HR deliberately reassigns it;
* RoleCategory changes → existing form type remains unchanged.

This ensures historical PMS data represents the organizational position at the time the form was created.

---

## 13. Department head integration

A separate Oracle/Nexus source will provide Department Head information.

This data will be used to determine which Department Head is responsible for each Department.

The Department Head relationship will be used for:

* Department Head dashboard access;
* RoleCategory administration;
* department-level PMS visibility.

The exact API contract can be finalized during integration development.

---

## 14. PMS cycle administration

Introduce a `PerformanceCycle` entity.

Suggested fields:

* ID
* Year
* Name
* Status
* CurrentPhase
* CreatedDate
* CreatedBy
* ActivatedDate
* ClosedDate

Suggested cycle statuses:

* `Draft`
* `Active`
* `Closed`

Suggested phases:

* `GoalSetting`
* `MidYear`
* `YearEnd`
* `Development`
* `Closed`

There should normally be one active PMS cycle for a given Year.

Historical cycles remain available in read-only form.

---

## 15. Phase administration

Phases are controlled manually by HR Admin.

HR Admin must be able to:

* open a phase;
* close a phase;
* see the current phase;
* see how many submissions are complete/incomplete;
* confirm a phase closure.

No automatic date-driven phase transitions are required.

When HR closes a phase:

* incomplete users cannot continue editing;
* incomplete users cannot submit;
* incomplete approvers cannot approve;
* the phase is hard-blocked.

HR may reopen a phase if required.

Reopening must:

* be recorded in the audit log;
* record who reopened it;
* record date/time;
* optionally capture an administrative reason.

---

## 16. Meaning of "fully approved"

`FullyApproved` applies to the current phase, not necessarily to the entire annual PMS lifecycle.

Example:

### Goal setting

Once all workflow participants approve:

`GoalSetting = FullyApproved`

Goal-setting activity is locked.

Later, HR opens Mid-Year.

The same PMS record continues into the Mid-Year phase.

At the end of Mid-Year:

`MidYear = FullyApproved`

The phase is locked again.

The same approach continues through Year-End and Development.

After the final annual phase is completed:

`CycleStatus = Closed`

At that point the entire PMS submission becomes permanently read-only through the application.

---

## 17. One PMS per employee per year

An employee can have only one PMS submission for a given Year.

The application must enforce an appropriate uniqueness constraint, conceptually:

`EmployeeNumber + PerformanceCycle`

A second active form for the same employee/year must be blocked.

If the original form was created incorrectly, HR should cancel it before creating a replacement where permitted.

---

## 18. Cancelled status

A PMS submission can be marked:

`Cancelled`

Typical use cases include:

* employee leaves before completing the annual process;
* form was created for the wrong employee;
* employee should not participate in that year's cycle;
* duplicate/administrative creation error.

Cancellation must:

* retain the record;
* retain all workflow history;
* retain comments;
* record who cancelled it;
* record cancellation date/time;
* require a cancellation reason.

Cancelled forms cannot be edited or resumed unless HR explicitly restores them.

---

## 19. Form assignment

The applicable form is determined when HR generates the PMS submission.

General mapping:

| Employee Population                | Form                            |
| ---------------------------------- | ------------------------------- |
| Grade 18+ DUG Leadership           | DUG Leadership                  |
| Grade 18+ KBU Leadership           | KBU Leadership                  |
| Department Heads / Senior Managers | Department Head KPI             |
| Project / Technical / Professional | Project Delivery / Professional |
| Administrative / Support           | Administrative / Support        |

Where Grade alone cannot determine the form, the Department Head-maintained `RoleCategory` is used.

The form type is snapshotted when the PMS submission is created.

Later RoleCategory changes do not automatically change an existing submission.

---

## 20. Strategy reference data

Because upstream strategy is agreed outside PMS, the application requires a configurable `StrategyReference` structure.

Suggested fields:

* ID
* Year
* Level
* ParentStrategyReferenceID
* Title
* Description
* Measure
* Target
* Weight
* OwnerEmployeeNumber
* DisplayOrder
* Active

Example levels:

* Group Ambition
* N-1 Priority
* KBU Objective
* Function Objective
* Department Objective
* Project Objective

HR Admin maintains this information based on decisions already made by the business.

---

## 21. Workflow architecture

There is not one universal workflow for each form.

Each individual PMS submission has its own instantiated workflow.

The initial default workflow is:

### Employee → Line Manager

The Line Manager is determined from the Oracle employee data using:

* `SUPERVISOR_NO`
* `SUPERVISOR`

The architecture must support future workflow variations without code changes.

HR Admin must be able to configure workflow templates and assignments through the UI.

Possible future workflows could therefore include:

* Employee → Line Manager
* Employee → Line Manager → Department Head
* Employee → Manager → KBU Head → GCEO

without requiring source-code modification.

---

## 22. Workflow definition

Suggested entity: `WorkflowDefinition`

Fields:

* ID
* Name
* Year
* FormType, if applicable
* Department/Scope, if applicable
* Active
* Version
* CreatedBy
* CreatedDate

---

## 23. Workflow step definition

Suggested entity: `WorkflowStepDefinition`

Fields:

* ID
* WorkflowDefinitionID
* StepNumber
* StepName
* ParticipantSource
* FixedEmployeeNumber, nullable
* AllowReject
* Active

Possible `ParticipantSource` values:

* Employee
* LineManager
* DepartmentHead
* FixedEmployee
* ConfiguredRole

This enables workflow configuration through UI rather than custom development.

---

## 24. Workflow instance

When a PMS submission is created, the relevant workflow definition is copied into a workflow instance.

Suggested entity: `WorkflowInstanceStep`

Fields:

* ID
* ScorecardID
* Phase
* StepNumber
* StepName
* AssignedEmployeeNumber
* OriginalAssignedEmployeeNumber
* Status
* StartedAt
* CompletedAt
* ActionByEmployeeNumber

Suggested statuses:

* `NotStarted`
* `Pending`
* `Approved`
* `Rejected`

The workflow instance preserves who was originally assigned even if HR later changes the pending participant.

---

## 25. Workflow reassignment

HR Admin must be able to reassign a currently pending workflow step.

Typical reason:

* approver leaves;
* reporting structure changes;
* wrong manager was captured;
* approver is unavailable;
* business administrative correction.

Reassignment must never erase the original assignment.

Every reassignment must capture:

* original assignee;
* new assignee;
* changed by;
* date/time;
* optional reason.

Reassignment affects the active workflow only.

Historical completed steps remain unchanged.

HR must also be able to update workflow templates separately for future submissions.

---

## 26. Workflow editing rule

At any moment, only the participant with whom the submission is currently pending can perform editable actions for that workflow step.

However, this does **not** mean the pending participant owns every field.

Field-level ownership must also be enforced.

Examples:

### Employee-owned fields

* employee goal proposals;
* self-review Actual;
* SelfRating;
* employee comments;
* evidence reference URL.

### Manager-owned fields

* ManagerRating;
* ManagerComment;
* manager mid-year comments;
* manager assessment.

An approver must not silently rewrite employee-owned content.

If employee-owned content needs correction, the approver rejects the submission to the previous workflow participant.

This preserves audit integrity.

---

## 27. Workflow actions

### 27.1 First step

The first participant can:

### Save as draft (first step)

* save current changes;
* remain the pending participant;
* no workflow movement.

### Initiate

* validate the phase;
* save the participant's content;
* complete the current step;
* move to the next participant.

If there is no next participant:

* the phase becomes `FullyApproved`.

---

## 28. Later workflow steps

A later workflow participant can:

### Save as draft (later steps)

Save their owned fields without advancing the workflow.

### Approve

* complete their step;
* move the submission to the next configured participant.

If there is no next participant:

* the phase becomes `FullyApproved`.

### Reject

* return the submission to the immediately previous workflow participant;
* allow the previous participant to modify their owned content;
* notify that participant.

---

## 29. Resubmission

When a rejected submission returns to a previous workflow participant, the forward action should be labelled:

### Resubmit

rather than `Approve`.

On Resubmit:

* the participant can modify any fields they own that are editable during that phase;
* the submission returns to the participant who rejected it;
* workflow history is preserved;
* previous rejection comments remain visible.

---

## 30. Repeated rejection

Rejection can occur repeatedly.

Example:

`Employee → Manager`

Manager Rejects

`Manager → Employee`

Employee modifies and Resubmits

`Employee → Manager`

Manager may Reject again

This loop can continue until approval or phase closure.

All iterations must remain visible in the audit trail.

---

## 31. Comments

Every workflow action must provide the ability to enter a comment.

Comments are not universally mandatory.

Defaults:

| Action                | Comment   |
| --------------------- | --------- |
| Save as Draft         | Optional  |
| Initiate              | Optional  |
| Resubmit              | Optional  |
| Approve               | Optional  |
| Reject                | Optional  |
| Phase Reopen          | Optional  |
| Cancellation          | Mandatory |
| Workflow Reassignment | Optional  |

Although reject comments are technically optional based on the current business decision, the UI should strongly encourage a rejection reason because otherwise the previous participant may not know what to correct.

All users who are authorized to open a submission can view its workflow comments.

---

## 32. Workflow audit trail

Every workflow action must create an immutable action-log record.

Suggested entity: `WorkflowActionLog`

Fields:

* ID
* ScorecardID
* Phase
* WorkflowInstanceStepID
* Action
* ActionByEmployeeNumber
* Comment
* ActionDateTime
* FromParticipant
* ToParticipant
* PreviousStatus
* NewStatus

Possible actions include:

* Created
* SavedDraft
* Initiated
* Approved
* Rejected
* Resubmitted
* Reassigned
* PhaseOpened
* PhaseClosed
* PhaseReopened
* Cancelled
* Closed

Audit history must never be overwritten.

---

## 33. Fully approved record locking

When the final workflow participant approves a phase:

* that phase becomes read-only;
* nobody can continue editing the completed phase;
* HR Admin cannot casually unlock or modify the data.

When HR opens the next phase, the fields permitted for that phase become editable.

When the entire annual PMS cycle reaches `Closed`:

* all fields become application read-only;
* normal APIs must reject updates;
* HR Admin cannot modify the form;
* System Admin cannot modify it through normal application screens.

Exceptional database-level correction is a technical incident/change-management process and is outside normal PMS workflow.

Any such correction should follow Depa IT change-control procedures.

---

## 34. Goal setting phase

Goal Setting uses the relevant one of the five PMS forms.

The employee completes their goal-setting fields and initiates the workflow.

The workflow follows the employee's configured workflow instance.

Approvers may:

* review;
* comment;
* approve;
* reject.

Approvers cannot silently rewrite employee-owned goals.

Once fully approved, the Goal Setting phase is locked.

---

## 35. Mid-year phase

HR manually opens Mid-Year.

Unlike a simple comments-only checkpoint, Mid-Year allows the employee to update the active performance plan where business circumstances have materially changed.

This is necessary to support the business framework rule that objectives must not be retrospectively changed at year-end and that material changes require approval.

During Mid-Year, the employee may propose updates to applicable fields including:

* objective/KPI wording;
* target;
* measure;
* weight;
* strategy linkage;
* MidYearStatus;
* MidYearComment.

Changes to controlled goal-setting fields must be recorded as amendments rather than silently replacing the historical approved value.

The application should preserve:

* previous value;
* proposed/new value;
* changed by;
* changed date;
* approving workflow.

The same workflow is then used to approve the revised Mid-Year position.

There is **no special Mid-Year reject/reopen process separate from the normal workflow**.

The Mid-Year business review itself is comments/progress focused, but where the employee proposes a material goal amendment, that amendment follows the normal approval mechanism.

Once Mid-Year is fully approved, the updated plan is locked.

---

## 36. Goal amendment history

Introduce either dedicated amendment records or field-level history for structural changes.

For any change to:

* KPI;
* objective;
* measure;
* target;
* weight;
* parent/strategy linkage;

the PMS must preserve the previously approved value.

This prevents retrospective rewriting and allows the system to show:

### Originally Approved

versus

### Approved Mid-Year Revision

Year-End must use the latest approved version.

Structural changes must not be made for the first time retrospectively during Year-End.

---

## 37. Year-end self-review

HR manually opens the Year-End phase.

The employee enters the employee-owned fields.

For KPI forms:

* Actual
* SelfRating
* YearEndComment
* EvidenceURL where required

The employee may save as draft.

While the employee has not submitted/resubmitted, the manager cannot simultaneously edit the submission.

When the employee submits:

* employee-owned fields become locked;
* the submission moves to the manager;
* the manager can view the employee's SelfRating;
* the manager can enter manager-owned assessment fields.

---

## 38. Employee vs manager field ownership

The manager can see employee-entered information but cannot modify it.

For example:

Employee enters:

`Actual = Project delivered on 15 November`

Manager cannot silently change it to:

`Actual = Project delivered late`

Instead, the manager provides their assessment through:

* ManagerRating;
* ManagerComment.

If the employee's entry genuinely needs correction, the manager rejects the submission.

This ensures that the record accurately preserves who stated what.

---

## 39. Manager rating phase

The manager enters:

* ManagerRating;
* ManagerComment.

ManagerRating uses the common 1-5 PMS scale.

The manager may save draft.

The employee must not see an unsubmitted manager rating while the manager is still working on it.

Manager draft content is therefore private to the active manager/authorized administrative viewers until the manager formally approves/submits the stage.

Once the manager completes the stage, the finalized manager rating becomes visible according to normal PMS permissions.

---

## 40. Administrative / support form self-review

The source business framework defines the Administrative / Support form using:

* Performance Standard
* Expected Standard
* Weight
* Employee Comments
* Manager Rating

It does not define an employee SelfRating.

Therefore, the initial PMS implementation will preserve this design.

Administrative / Support employees provide:

* Employee Comments;
* evidence reference where applicable.

They do **not** provide a numerical SelfRating unless the business later changes the framework.

Managers provide the numerical 1-5 rating.

---

## 41. Development and close

After Year-End assessment is complete, HR opens the Development phase.

The application provides a `DevelopmentNotes` section.

Development information may include:

* agreed development priorities;
* training/development actions;
* manager feedback;
* employee comments.

When the configured final workflow is completed:

`CycleStatus = Closed`

The submission becomes permanently read-only through the normal application.

---

## 42. Five-point rating scale

The same rating scale applies across all applicable forms.

| Rating | Label                | Meaning                               |
| ------ | -------------------- | ------------------------------------- |
| 5      | Exceptional          | Significantly exceeds agreed outcomes |
| 4      | Exceeds Expectations | Consistently exceeds targets          |
| 3      | Meets Expectations   | Delivers agreed expectations          |
| 2      | Partially Meets      | Material gaps remain                  |
| 1      | Does Not Meet        | Substantially below expectations      |

The scale is centrally configured and cannot vary by form.

---

## 43. Weighting

For all weighted forms:

`Total Weight = 100%`

Submission must be blocked if the applicable weights do not total exactly 100%.

The UI should display a live running total.

Recommended validation:

* minimum weight per row: greater than 0;
* maximum weight per row: 100;
* total: exactly 100;
* store weights to at least one decimal place if future business configuration requires it.

---

## 44. Overall rating

For weighted forms:

`OverallRating = Σ(ManagerRating × Weight / 100)`

The calculated score is rounded to one decimal place for display.

The final OverallRating must not be calculated until all required manager ratings are present.

For the Administrative / Support form, the same calculation uses the configured standard weights.

There is no calibration adjustment inside PMS.

---

## 45. Evidence

Evidence will not be uploaded or stored directly inside PMS for the initial implementation.

Instead, the employee provides an evidence URL/reference.

Suggested field:

`EvidenceURL`

An optional description may also be provided:

`EvidenceDescription`

Examples could include links to internally accessible corporate document repositories.

PMS does not copy or permanently store the linked document.

---

## 46. Evidence rule for ratings above expectations

The framework requires evidence for above-expectation ratings.

Therefore:

If:

`SelfRating = 4 or 5`

or

`ManagerRating = 4 or 5`

then the relevant evidence requirement must be satisfied.

For KPI-based forms, at least one evidence URL/reference should be associated with the relevant KPI where a rating of 4 or 5 is submitted.

If the manager enters a rating of 4 or 5 and the employee has not supplied suitable evidence, the manager must either:

* reference appropriate evidence; or
* reject the form to the employee for evidence completion.

The system must block final submission of a 4 or 5 rating where the required evidence reference is absent.

---

## 47. DUG leadership scorecard

Population:

Grade 18+ Group / DUG Leadership.

Perspectives:

* Customer
* Financials
* People & Culture
* Strategic Initiatives

Recommended line fields:

* Perspective
* Objective / Key Result
* Linked Strategy Reference
* Measure
* Target
* Weight
* Actual
* SelfRating
* ManagerRating
* EmployeeComment
* ManagerComment
* EvidenceURL

Form rules:

* user can add/remove objective rows during Goal Setting;
* minimum 1 objective;
* recommended 4-8 meaningful objectives;
* each objective must have a Perspective;
* each objective must link to an approved configured strategy reference;
* weights total 100%.

No artificial requirement is imposed that every perspective must contain a KPI unless HR configures such a rule.

---

## 48. KBU leadership scorecard

Population:

Grade 18+ KBU Leadership.

Perspectives:

* Business Development
* Backlog & New Awards
* Projects
* Financials
* Strategic Initiatives

Recommended line fields:

* Perspective
* Objective / Key Result
* Linked Strategy Reference
* Measure
* Target
* Weight
* Actual
* SelfRating
* ManagerRating
* EmployeeComment
* ManagerComment
* EvidenceURL

Recommended 4-8 meaningful objectives.

Weights must total 100%.

Strategic Initiatives may be unused where not applicable.

---

## 49. Department heads / senior managers KPI form

### Recommended KPI count (4-6)

Fields per KPI:

* KPI / Outcome
* Linked DUG / KBU / Function Objective
* Measure
* Target
* Weight
* Actual
* MidYearStatus
* MidYearComment
* SelfRating
* ManagerRating
* EmployeeComment
* ManagerComment
* EvidenceURL

Rules:

* minimum 4 KPIs;
* maximum 6 KPIs;
* each KPI requires linkage;
* each KPI requires a measurable target;
* weights total 100%.

---

## 50. Project delivery / professional KPI form

Performance Areas may include:

* Project / Delivery
* Cost / Productivity
* Quality
* Schedule / Milestones
* Customer / Stakeholder
* Technical / Functional

### Recommended KPI count for projects (4-6)

Fields:

* Performance Area
* KPI / Outcome
* Linked Department / Function / Project Objective
* Measure
* Target
* Weight
* Actual
* MidYearStatus
* MidYearComment
* SelfRating
* ManagerRating
* EmployeeComment
* ManagerComment
* EvidenceURL

Rules:

* 4-6 meaningful KPIs;
* do not create artificial activity-count KPIs;
* weights total 100%.

---

## 51. Administrative / support non-KPI form

The form uses fixed performance standards.

Initial standards:

| Standard                    | Illustrative Starting Weight |
| --------------------------- | ---------------------------: |
| Core Job Responsibilities   |                          40% |
| Quality & Accuracy          |                          15% |
| Timeliness & Reliability    |                          15% |
| Service & Responsiveness    |                          10% |
| Process & Compliance        |                          10% |
| Collaboration & Improvement |                          10% |

These values are configurable by HR.

Fields:

* Performance Standard
* Expected Standard
* Weight
* Employee Comment
* Manager Rating
* Manager Comment
* EvidenceURL

There is no employee numerical SelfRating in the initial design.

Total weight = 100%.

---

## 52. Field data types

To avoid premature complexity, performance measures and targets should generally be stored as text rather than forcing all targets into numerical types.

Recommended types:

| Field         | Type        |
| ------------- | ----------- |
| Objective/KPI | Text        |
| Measure       | Text        |
| Target        | Text        |
| Actual        | Text        |
| Weight        | Decimal     |
| Rating        | Integer 1-5 |
| Comments      | Long Text   |
| EvidenceURL   | URL/Text    |
| MidYearStatus | Enum        |
| Year          | Integer     |

Suggested practical limits:

* Objective/KPI title: 500 characters
* Measure: 1,000 characters
* Target: 1,000 characters
* Actual: 2,000 characters
* Comments: 4,000 characters
* Evidence URL: 2,000 characters

These are technical defaults and can be increased without changing the business model.

---

## 53. Linkage rules

KPI-based forms must maintain line of sight to the strategy/reference data configured by HR.

Each applicable KPI/objective should have one primary parent reference.

Initial implementation does not require multiple parent objectives for one KPI.

This keeps the cascade understandable and avoids ambiguous weighting/accountability.

If the business later needs many-to-many strategy linkage, the data model should be extensible to support it.

Administrative / Support standards do not require a strategy parent link.

---

## 54. Mid-year status

For KPI-based forms, initial values are:

* `OnTrack`
* `AtRisk`
* `Blocked`

The user may also provide a Mid-Year comment.

These values support the framework's progress-review requirement without assigning a forced numerical Mid-Year rating.

---

## 55. Notifications

Notifications are delivered through:

1. Email
2. In-app notification

A notification is generated whenever a workflow transition creates a new pending action.

Examples:

* submission initiated;
* submission approved to next participant;
* submission rejected;
* submission resubmitted;
* workflow reassigned.

Notification content should include:

* employee/form owner;
* form type;
* performance year;
* phase;
* action required;
* direct link to the submission;
* rejection comment if one was provided.

Only one transition notification is required.

No reminder/escalation engine is required initially.

---

## 56. Notification failure

Workflow processing must not depend on successful email delivery.

If email fails:

* workflow transition continues;
* in-app notification remains available;
* failure is logged;
* the application may retry asynchronously;
* HR/System support should be able to inspect failed notification logs.

A mail-server outage must never block an employee from initiating or a manager from approving a PMS submission.

---

## 57. Dashboards

### 57.1 Employee dashboard

Employee can see:

* My Current PMS
* Current phase
* Current workflow status
* Pending with
* My required action
* Previous/historical PMS cycles

---

### 57.2 Line manager dashboard

Manager can see:

* My PMS
* My Subordinates
* submissions pending with me;
* status of subordinate submissions;
* current phase;
* current workflow assignee.

---

### 57.3 Department head dashboard

Department Head can see:

* My PMS
* Department employees
* PMS status for department employees
* RoleCategory mapping
* submissions pending with me
* filters by employee/status/form type

---

### 57.4 HR admin dashboard

HR Admin can see all PMS submissions.

Required filters:

* Year
* Employee
* Employee Number
* Department
* Form Type
* Phase
* Workflow Status
* Pending With
* Line Manager
* RoleCategory
* Active/Cancelled

HR dashboard should also show operational counts such as:

* Total Forms
* Not Started
* In Progress
* Pending Approval
* Fully Approved for Current Phase
* Cancelled
* Closed

These are operational workflow metrics rather than a formal reporting/analytics module.

---

## 58. Search

Users should be able to search within their authorized scope by:

* employee name;
* employee number;
* department;
* form type;
* status;
* workflow participant.

Authorization must always be applied server-side before returning search results.

---

## 59. Visibility rules

Employee:

* own PMS only.

Line Manager:

* own PMS;
* direct subordinate PMS records.

Department Head:

* own PMS;
* employees belonging to their department.

HR Admin:

* all PMS records.

IT System Admin:

* technical access as required for support, not a normal business dashboard role.

All access must be enforced server-side.

---

## 60. Phase close behavior

When HR closes a phase, incomplete submissions are hard-blocked.

Users may still view their submission, but cannot:

* edit;
* save;
* initiate;
* resubmit;
* approve;
* reject.

The UI should clearly display:

**This phase is closed. Contact HR if further action is required.**

HR can reopen the phase if the business decides additional action is necessary.

---

## 61. Data model - core entities

Core entities should include:

### `PerformanceCycle`

Annual cycle and current phase.

### `EmployeeSnapshot`

Oracle employee data frozen for the PMS submission.

### `UserEmployeeMapping`

Azure AD authenticated account to Oracle Employee Number mapping.

### `RoleCategoryMapping`

Department Head-maintained category assignment.

### `StrategyReference`

Externally agreed strategy/cascade configuration.

### `Scorecard`

Employee/year PMS master record.

### `ScorecardLine`

KPI/objective records.

### `AdminStandard`

Administrative/Support standards.

### `WorkflowDefinition`

Reusable configurable workflow.

### `WorkflowStepDefinition`

Ordered workflow definition.

### `WorkflowInstanceStep`

Employee-specific instantiated workflow.

### `WorkflowActionLog`

Immutable workflow history.

### `GoalAmendmentHistory`

Approved structural changes during Mid-Year.

### `Notification`

In-app notification state.

---

## 62. Scorecard suggested fields

* ID
* EmployeeSnapshotID
* PerformanceCycleID
* FormType
* RoleCategoryAtCreation
* CurrentPhase
* CurrentWorkflowStepID
* Status
* WeightTotal
* OverallRating
* DevelopmentNotes
* CreatedBy
* CreatedDate
* CancelledDate
* CancellationReason
* ClosedDate

---

## 63. ScorecardLine suggested fields

* ID
* ScorecardID
* LinkedStrategyReferenceID
* Perspective
* PerformanceArea
* Title
* MeasureDescription
* Target
* Weight
* Actual
* MidYearStatus
* MidYearComment
* SelfRating
* EmployeeComment
* ManagerRating
* ManagerComment
* EvidenceURL
* EvidenceDescription

---

## 64. Administrative standard suggested fields

* ID
* ScorecardID
* StandardName
* ExpectedStandard
* Weight
* EmployeeComment
* ManagerRating
* ManagerComment
* EvidenceURL
* EvidenceDescription

---

## 65. Workflow concurrency

The system must prevent two users from simultaneously editing the same PMS workflow state.

Only the current pending participant can obtain edit permission.

If another user opens the form while it is pending elsewhere, the form is read-only.

Workflow transitions should use database transactions or equivalent concurrency protection to prevent duplicate approvals/rejections caused by multiple browser sessions or repeated clicks.

---

## 66. Audit and historical integrity

PMS data must preserve:

* original employee snapshot;
* original workflow;
* workflow reassignment;
* all workflow actions;
* every approval;
* every rejection;
* every resubmission;
* phase opening/closing;
* approved goal amendments;
* ratings;
* comments;
* cancellation;
* final closure.

Historical information must not be overwritten simply because the current Oracle organizational data changes.

---

## 67. Data export

The system must support complete export because the solution is temporary and data is expected to migrate to Oracle PMS.

Export should be available through:

* REST API; and/or
* bulk CSV/JSON export.

Exported data should include:

* employee identifiers;
* employee snapshot;
* department;
* employer;
* position;
* grade;
* supervisor;
* RoleCategory;
* cycle;
* form;
* KPI/objective data;
* targets;
* weights;
* actuals;
* employee ratings;
* manager ratings;
* final calculated rating;
* comments;
* evidence URLs;
* workflow;
* approvals;
* rejections;
* amendments;
* audit timestamps;
* development notes;
* cancellation/closure status.

Source identifiers should be preserved, including where available:

* `EMPLOYEE_NUMBER`
* `ASSIGNMENT_ID`
* `PERSON_ID`
* `SUPERVISOR_NO`
* `DEPARTMENT`
* `JOB`
* `POSITION`
* `GRADE`
* `EMPLOYER`

Export should contain both IDs and human-readable values.

The system should not assume a future Oracle PMS import schema that has not yet been supplied.

---

## 68. No calibration

There will be no calibration functionality inside PMS.

Specifically there will be no:

* CalibrationSession;
* CalibrationRecord;
* calibration dashboard;
* calibration rating override;
* forced curve;
* distribution-management feature.

Any calibration discussion or adjustment will happen outside PMS.

If the business later provides a final externally agreed rating that must be stored, that should be treated as a future change request rather than assumed in the initial system.

---

## 69. Security requirements

* Azure AD SSO for normal users.
* No normal local-password login.
* Authorization enforced server-side.
* Oracle bearer token stored securely.
* Users cannot modify API requests to access unauthorized submissions.
* Fully closed PMS records reject application/API writes.
* Workflow permissions must be validated on every server-side mutation.
* HR administrative actions must be audited.
* Workflow reassignment must be audited.
* Cancellation must be audited.
* Phase changes must be audited.

---

## 70. Performance and bulk processing

The primary performance-sensitive operation is HR bulk form generation.

The solution should support creating submissions for hundreds of employees in one HR operation.

Bulk creation should:

1. retrieve/prepare the employee population;
2. validate eligibility;
3. validate RoleCategory where required;
4. identify line managers;
5. identify workflow templates;
6. preview exceptions;
7. create valid submissions;
8. report failures without losing successful records.

HR should receive a result such as:

* 287 Created
* 8 Skipped - Already Exists
* 3 Missing RoleCategory
* 2 Missing Manager

The entire 300-employee operation should not fail because a small number of records contain data issues.

---

## 71. Bulk creation validation

Before HR confirms creation, PMS should identify employees who cannot be processed automatically.

Examples:

* employee already has PMS for that Year;
* missing Grade;
* missing Department;
* missing RoleCategory;
* missing supervisor;
* no valid form mapping;
* unresolved PMS login mapping, where applicable.

HR can correct the data/configuration and retry only the failed records.

---

## 72. No delegation

Workflow delegation is not included in the first release.

If an approver is unavailable:

HR Admin uses **Workflow Reassignment**.

This keeps the solution simpler while still resolving operational bottlenecks.

---

## 73. Reporting

A dedicated reporting/analytics module is not required for the initial release.

Operational dashboards and filters are required.

Advanced reporting such as:

* department rating comparisons;
* rating distributions;
* talent analytics;
* trend analysis;
* performance heatmaps;

is out of scope unless later requested by the business.

---

## 74. Application configuration principle

Where business rules are reasonably expected to change, they should be configuration-driven rather than hard-coded.

This especially applies to:

* workflow participants;
* workflow step count;
* workflow sequence;
* annual cycle;
* active phase;
* strategy references;
* Administrative form weights;
* form availability;
* RoleCategory mappings.

The intention is that HR can maintain normal PMS configuration without requesting code changes from IT.

---

## 75. Permissions summary

| Action                     | Employee               | Line Manager            | Department Head         | HR Admin                   | IT SysAdmin            |
| -------------------------- | ---------------------- | ----------------------- | ----------------------- | -------------------------- | ---------------------- |
| View own PMS               | Yes                    | Yes                     | Yes                     | Yes                        | Support only           |
| View direct reports        | No                     | Yes                     | If within scope         | Yes                        | Support only           |
| View department PMS        | No                     | Direct reports only     | Yes                     | Yes                        | Support only           |
| View all PMS               | No                     | No                      | No                      | Yes                        | Support only           |
| Edit employee-owned fields | When pending with self | No                      | Only own PMS            | Only own PMS               | No                     |
| Edit manager-owned fields  | No                     | When pending with self  | When assigned           | When legitimately assigned | No                     |
| Initiate                   | When first participant | If first participant    | If first participant    | If first participant       | No                     |
| Approve                    | If assigned            | If assigned             | If assigned             | If assigned                | No                     |
| Reject                     | If assigned            | If assigned             | If assigned             | If assigned                | No                     |
| Resubmit                   | If returned to user    | If returned             | If returned             | If returned                | No                     |
| Configure cycles           | No                     | No                      | No                      | Yes                        | Technical support      |
| Open/close phases          | No                     | No                      | No                      | Yes                        | No                     |
| Configure workflow         | No                     | No                      | No                      | Yes                        | Technical support      |
| Reassign pending workflow  | No                     | No                      | No                      | Yes                        | Incident support       |
| Assign RoleCategory        | No                     | No                      | Department scope        | Yes                        | No                     |
| Bulk-create forms          | No                     | No                      | No                      | Yes                        | No                     |
| Cancel PMS                 | No                     | No                      | No                      | Yes                        | No                     |
| Export data                | No                     | Scoped if later enabled | Scoped if later enabled | Yes                        | Technical support      |
| Edit Closed PMS            | No                     | No                      | No                      | No                         | DB/change control only |

---

## 76. Confirmed business decisions

The following decisions are considered confirmed for the initial implementation:

1. There are five PMS forms only.

2. Group Strategy, N-1 priorities, and N-2/N-3 cascade are agreed outside PMS.

3. HR Admin is the functional custodian of the application.

4. IT System Admin participates only for technical incidents/support.

5. HR creates PMS submissions in bulk by selecting a Department and employees.

6. There is one PMS submission per employee per Year.

7. The initial default workflow is:
   **Employee → Line Manager**

8. Workflow must be completely configurable through the HR Admin UI without code changes.

9. Each employee submission may have a different workflow.

10. Only one participant can actively edit at a time.

11. Field-level ownership prevents approvers from silently overwriting employee-authored content.

12. A rejection returns the submission to the immediately previous workflow participant.

13. Rejection/resubmission can occur repeatedly.

14. If a workflow has one participant only, Initiate immediately fully approves the phase.

15. Workflow reassignment must preserve the original assignee and audit history.

16. HR can reassign workflow when an approver leaves.

17. No impersonation.

18. No delegation functionality initially.

19. Every workflow step allows comments.

20. Comments are generally optional.

21. Anyone authorized to open the submission can view workflow comments.

22. Employee cannot see a manager's draft rating before the manager formally submits it.

23. Manager sees employee SelfRating after the employee submits.

24. Administrative / Support form has Employee Comments but no employee numerical SelfRating in accordance with the provided framework.

25. Mid-Year permits controlled updates, including material performance-plan amendments, with history and approval.

26. Objectives must not be silently or retrospectively rewritten.

27. RoleCategory changes do not transform an existing PMS form.

28. Department Heads are obtained through a separate Oracle source.

29. An employee belongs to only one relevant KBU/company structure for this process.

30. HR manually controls phase opening and closing.

31. Closing a phase is a hard system block.

32. Cancelled status is required.

33. No calibration functionality.

34. No formal analytics/reporting module initially.

35. Evidence is represented as an external URL/reference rather than a stored PMS file.

36. Rating 4 or 5 continues to require evidence.

37. Notifications are both email and in-app.

38. Email failure does not stop workflow.

39. No repeated reminder/escalation notifications initially.

40. Azure AD is used for SSO authentication, not as the source of organizational hierarchy.

41. Oracle employee data is retrieved during HR form-generation operations rather than through daily scheduled sync.

42. Later Oracle changes do not automatically alter existing PMS submissions.

---

## 77. Remaining technical inputs required before production

The functional PRD can proceed using the decisions above, but implementation will still require the following technical inputs:

1. Oracle Department Head API endpoint and schema.
2. Production bearer-token secret delivery mechanism.
3. Azure AD application registration details.
4. Method for initial Azure AD user ↔ Oracle Employee Number mapping.
5. Final HR Admin Azure AD access/group configuration.
6. Infrastructure/environment details.
7. Email service/SMTP configuration.
8. Exact internal repository URL rules allowed for evidence references.
9. Final workflow configurations once the business decides whether additional approvers beyond Employee → Line Manager are needed.
10. Oracle PMS target import specification once Oracle provides it.

These should be treated as implementation/configuration dependencies rather than blockers to defining the core PMS product behavior.
