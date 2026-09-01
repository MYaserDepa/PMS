# PMS form rules

This document lists the mandatory assignment and validation conditions for the five 2027 PMS forms. The PRD remains authoritative. Notes marked "Current implementation" describe stricter checks enforced by the application.

## Form assignment

Every employee needs a valid grade, department, and manager before HR can create a form.

| Form | Assignment condition |
| --- | --- |
| DUG Leadership Scorecard | Grade 18 or above, with an employer that resolves as DUG |
| KBU Leadership Scorecard | Grade 18 or above, with an employer that resolves as non-DUG |
| Department Heads / Senior Managers KPI Form | Grade below 18 and identified as a Department Head |
| Project Delivery / Professional KPI Form | Grade below 18, not a Department Head, with `RoleCategory = ProjectDeliveryProfessional` |
| Administrative / Support Non-KPI Form | Grade below 18, not a Department Head, with `RoleCategory = AdministrativeSupport` |

The application evaluates the conditions in that order. It does not evaluate Department Head status or RoleCategory for an employee in Grade 18 or above.

## Rules shared by all forms

- Every weight must be an integer from 1 to 100.
- The weights must total exactly 100%.
- Save as Draft is not a partial save. Save as Draft, Initiate, Resubmit, and Approve validate all applicable fields, evidence conditions, and the 100% weight total.
- A workflow comment is optional. The UI encourages a reason for rejection but does not require one.
- The application calculates the Overall Rating only after every required Manager Rating exists.
- The Overall Rating is `sum(Manager Rating * Weight / 100)`, rounded to one decimal place.
- Employee and manager evidence references are separate. One cannot satisfy the other's evidence requirement.
- The application accepts evidence as an external URL or text reference. It does not upload evidence files.
- Employee Development Notes and Manager Development Notes are mandatory during their respective Development workflow steps.

## 1. DUG Leadership Scorecard

### Goal Setting

- At least one objective is required.
- There is no hard maximum. Four to eight objectives is a recommendation only.
- Every objective requires:
  - a Perspective;
  - Objective / Key Result wording;
  - a seeded or approved Linked Strategy Reference;
  - a Measure;
  - a Target;
  - an integer Weight from 1 to 100.
- The Perspective must be one of:
  - Customer;
  - Financials;
  - People & Culture;
  - Strategic Initiatives.
- The weights must total exactly 100%.

## 2. KBU Leadership Scorecard

### Goal Setting

- At least one objective is required by the current implementation.
- There is no hard maximum. Four to eight objectives is a recommendation only.
- Every objective requires:
  - a Perspective;
  - Objective / Key Result wording;
  - a seeded or approved Linked Strategy Reference;
  - a Measure;
  - a Target;
  - an integer Weight from 1 to 100.
- The Perspective must be one of:
  - Business Development;
  - Backlog & New Awards;
  - Projects;
  - Financials;
  - Strategic Initiatives.
- The weights must total exactly 100%.

Current implementation: the KBU section of the PRD recommends four to eight objectives but does not state a hard minimum. The backend applies the same one-objective minimum used by the DUG form.

## 3. Department Heads / Senior Managers KPI Form

### Goal Setting

- A minimum of four KPIs is required.
- A maximum of six KPIs is allowed.
- Every KPI requires:
  - KPI / Outcome wording;
  - a linked DUG, KBU, or function objective;
  - a Measure;
  - a measurable Target;
  - an integer Weight from 1 to 100.
- The weights must total exactly 100%.

## 4. Project Delivery / Professional KPI Form

### Goal Setting

- A minimum of four KPIs is required.
- A maximum of six KPIs is allowed.
- Every KPI requires:
  - a Performance Area;
  - KPI / Outcome wording;
  - a linked department, function, or project objective;
  - a Measure;
  - a Target;
  - an integer Weight from 1 to 100.
- The Performance Area must be one of:
  - Project / Delivery;
  - Cost / Productivity;
  - Quality;
  - Schedule / Milestones;
  - Customer / Stakeholder;
  - Technical / Functional.
- The weights must total exactly 100%.

Current implementation: the PRD says Performance Areas "may include" the listed values. The backend treats the list as mandatory and exhaustive.

## 5. Administrative / Support Non-KPI Form

The form contains exactly six fixed standards. Employees cannot add or remove them.

| Performance standard | Weight |
| --- | ---: |
| Core Job Responsibilities | 40% |
| Quality & Accuracy | 15% |
| Timeliness & Reliability | 15% |
| Service & Responsiveness | 10% |
| Process & Compliance | 10% |
| Collaboration & Improvement | 10% |

- The fixed weights total exactly 100%.
- The employee does not enter an Actual or numerical Self Rating.
- At Year-End, the employee must enter an Employee Comment for every standard.
- At Year-End, the manager must enter a Manager Rating and Manager Comment for every standard.
- Manager evidence is required for every standard rated 4 or 5.
- The current backend does not conditionally require employee evidence because this form has no employee Self Rating.

## Mid-Year rules

The following conditions apply to the first four forms. The Administrative / Support form keeps its six fixed standards and 100% total but does not require KPI progress fields.

For every objective or KPI, the employee must:

- keep all Goal Setting fields valid;
- select `OnTrack`, `AtRisk`, or `Blocked` as the Mid-Year Status;
- enter a Mid-Year Comment.

The manager must enter a Manager Mid-Year Comment for every objective or KPI before saving or approving their step.

## Year-End rules

### Employee submission for the first four forms

For every objective or KPI, the employee must enter:

- Actual;
- Self Rating as an integer from 1 to 5;
- Employee Comment;
- Employee Evidence Reference when the Self Rating is 4 or 5.

### Manager approval for all five forms

For every objective, KPI, or fixed standard, the manager must enter:

- Manager Rating as an integer from 1 to 5;
- Manager Comment;
- Manager Evidence Reference when the Manager Rating is 4 or 5.

The Administrative / Support form must not contain an employee Self Rating.
