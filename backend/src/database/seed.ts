import { inTransaction, type Queryable } from './pool.js';

const forms = [
  ['DUGLeadership', 'DUG Leadership Scorecard', 1],
  ['KBULeadership', 'KBU Leadership Scorecard', 2],
  ['DepartmentHeadKPI', 'Department Heads / Senior Managers KPI Form', 3],
  ['ProjectDeliveryProfessionalKPI', 'Project Delivery / Professional KPI Form', 4],
  ['AdministrativeSupport', 'Administrative / Support Non-KPI Form', 5]
] as const;

const ratings = [
  [1, 'Does Not Meet', 'Substantially below expectations'],
  [2, 'Partially Meets', 'Material gaps remain'],
  [3, 'Meets Expectations', 'Delivers agreed expectations'],
  [4, 'Exceeds Expectations', 'Consistently exceeds targets'],
  [5, 'Exceptional', 'Significantly exceeds agreed outcomes']
] as const;

const ambitions = [
  'Execution Excellence',
  'Disciplined Growth',
  'Priority Markets',
  'Shareholder Value',
  'Institutional Readiness'
] as const;

const standards = [
  ['Core Job Responsibilities', 'Consistently delivers the responsibilities agreed for the role.', 40, 1],
  ['Quality & Accuracy', 'Produces complete and accurate work that meets agreed standards.', 15, 2],
  ['Timeliness & Reliability', 'Meets commitments and communicates risks to delivery promptly.', 15, 3],
  ['Service & Responsiveness', 'Responds constructively to internal and external service needs.', 10, 4],
  ['Process & Compliance', 'Follows required processes, controls, and policies.', 10, 5],
  ['Collaboration & Improvement', 'Works effectively with others and improves day-to-day work.', 10, 6]
] as const;

export async function seedDatabase(queryable?: Queryable): Promise<void> {
  const execute = async (database: Queryable) => {
    await database.query(
      `INSERT INTO performance_cycles (year, name, status, current_phase)
       VALUES (2027, 'PMS 2027', 'Active', 'GoalSetting')
       ON CONFLICT (year) DO UPDATE SET name = EXCLUDED.name`
    );
    for (const [formType, displayName, displayOrder] of forms) {
      await database.query(
        `INSERT INTO form_definitions (form_type, display_name, display_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (form_type) DO UPDATE SET display_name = EXCLUDED.display_name, display_order = EXCLUDED.display_order`,
        [formType, displayName, displayOrder]
      );
    }
    for (const [rating, label, meaning] of ratings) {
      await database.query(
        `INSERT INTO rating_labels (rating, label, meaning) VALUES ($1, $2, $3)
         ON CONFLICT (rating) DO UPDATE SET label = EXCLUDED.label, meaning = EXCLUDED.meaning`,
        [rating, label, meaning]
      );
    }
    for (const [index, title] of ambitions.entries()) {
      await database.query(
        `INSERT INTO strategy_references (year, level, title, description, display_order, active)
         VALUES (2027, 'GroupAmbition', $1, $2, $3, TRUE)
         ON CONFLICT (year, level, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order, active = TRUE`,
        [title, `2027 Group strategic ambition: ${title}`, index + 1]
      );
    }
    for (const [standardName, expectedStandard, weight, displayOrder] of standards) {
      await database.query(
        `INSERT INTO admin_standard_templates (standard_name, expected_standard, weight, display_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (standard_name) DO UPDATE SET expected_standard = EXCLUDED.expected_standard, weight = EXCLUDED.weight, display_order = EXCLUDED.display_order`,
        [standardName, expectedStandard, weight, displayOrder]
      );
    }
  };

  if (queryable) await execute(queryable);
  else await inTransaction(execute);
}
