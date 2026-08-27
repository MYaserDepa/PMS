import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { AssignmentDataService } from './oracle/assignment-data.js';
import { OracleClient } from './oracle/client.js';
import { IdentityService, type CurrentUser } from './auth/service.js';
import { clearSessionCookie, readSessionId, SessionStore, setSessionCookie } from './auth/session.js';
import { ApplicationError } from './errors.js';
import { PopulationService } from './generation/population-service.js';
import { getPool, inTransaction } from './database/pool.js';
import { RoleCategoryRepository } from './database/repositories.js';
import { ScorecardQueryService } from './scorecards/query-service.js';
import { WorkflowService, type WorkflowCommand } from './workflow/workflow-service.js';
import { PhaseService } from './workflow/phase-service.js';
import { FormService } from './forms/form-service.js';
import type { BackendConfig } from './config.js';

export interface AppDependencies {
  oracle?: OracleClient;
  sessions?: SessionStore;
}

export function createApp(config: BackendConfig, dependencies: AppDependencies = {}) {
  const app = express();
  const oracle = dependencies.oracle ?? new OracleClient(config);
  const assignmentData = new AssignmentDataService(oracle);
  const identity = new IdentityService(oracle, assignmentData, config);
  const population = new PopulationService(oracle, config);
  const scorecardQueries = new ScorecardQueryService();
  const workflow = new WorkflowService();
  const phases = new PhaseService();
  const forms = new FormService();
  const sessions = dependencies.sessions ?? new SessionStore();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'pms-backend' });
  });

  app.post('/api/auth/login', async (request, response, next) => {
    try {
      const body = z.object({ employeeNumber: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1)) }).parse(request.body);
      const user = await identity.login(body.employeeNumber);
      setSessionCookie(response, sessions.create(user), config.NODE_ENV === 'production');
      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/session', (request, response) => {
    const sessionId = readSessionId(request);
    const user = sessions.currentUser(sessionId);
    if (!user) {
      response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: 'No active test session' } });
      return;
    }
    response.json({ user });
  });

  app.post('/api/auth/logout', (request, response) => {
    sessions.delete(readSessionId(request));
    clearSessionCookie(response, config.NODE_ENV === 'production');
    response.status(204).send();
  });

  async function requireCurrentUser(request: express.Request) {
    const user = sessions.currentUser(readSessionId(request));
    if (!user) throw new ApplicationError('No active test session', 401, 'NOT_AUTHENTICATED');
    return user;
  }

  async function roleCategoryDepartments(user: CurrentUser): Promise<string[]> {
    if (user.isHrAdmin) return population.departments();
    if (user.departmentHeadStatus !== 'Head') {
      throw new ApplicationError('RoleCategory access is forbidden', 403, 'FORBIDDEN');
    }
    return assignmentData.departmentHeadDepartments(user.employeeNumber);
  }

  async function saveRoleCategoryMappings(
    user: CurrentUser,
    requestedMappings: Array<{ employeeNumber: string; roleCategory: 'ProjectDeliveryProfessional' | 'AdministrativeSupport' }>
  ) {
    const employeeNumbers = requestedMappings.map((mapping) => mapping.employeeNumber);
    if (new Set(employeeNumbers).size !== employeeNumbers.length) {
      throw new ApplicationError('Each employee can appear only once in a bulk mapping save', 400, 'DUPLICATE_EMPLOYEE_MAPPING');
    }
    const allowedDepartments = new Set(await roleCategoryDepartments(user));
    const [employees, departmentHeads] = await Promise.all([oracle.listEmployees(), oracle.listDepartmentHeads()]);
    const employeeByNumber = new Map(employees.map((employee) => [employee.EMPLOYEE_NUMBER, employee]));

    const resolved = await Promise.all(requestedMappings.map(async (mapping) => {
      const employee = employeeByNumber.get(mapping.employeeNumber);
      if (!employee) throw new ApplicationError('Employee was not found or is not eligible', 404, 'EMPLOYEE_NOT_FOUND');
      if (!employee.DEPARTMENT) throw new ApplicationError('Target employee has no department', 422, 'MISSING_DEPARTMENT');
      if (!allowedDepartments.has(employee.DEPARTMENT)) {
        throw new ApplicationError('Target employee is outside the Department Head scope', 403, 'OUTSIDE_DEPARTMENT_SCOPE');
      }
      const isDepartmentHead = await assignmentData.departmentHeadStatus(employee.EMPLOYEE_NUMBER, departmentHeads) === 'Head';
      if (employee.GRADE === null || employee.GRADE >= 18 || isDepartmentHead) {
        throw new ApplicationError(
          `RoleCategory does not apply to employee ${employee.EMPLOYEE_NUMBER}`,
          422,
          'ROLE_CATEGORY_NOT_APPLICABLE'
        );
      }
      return { ...mapping, department: employee.DEPARTMENT };
    }));

    return inTransaction(async (client) => {
      const repository = new RoleCategoryRepository(client);
      const saved = [];
      for (const mapping of resolved) {
        saved.push(await repository.upsert(
          mapping.employeeNumber,
          mapping.roleCategory,
          mapping.department,
          user.employeeNumber
        ));
      }
      return saved;
    });
  }

  app.get('/api/role-categories', async (request, response, next) => {
    try {
      const user = await requireCurrentUser(request);
      const departments = new Set(await roleCategoryDepartments(user));
      const mappings = await new RoleCategoryRepository(getPool()).list();
      response.json({ mappings: mappings.filter((mapping) => departments.has(mapping.department)) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/role-categories/departments', async (request, response, next) => {
    try {
      response.json({ departments: await roleCategoryDepartments(await requireCurrentUser(request)) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/role-categories/employees', async (request, response, next) => {
    try {
      const user = await requireCurrentUser(request);
      const { department } = z.object({ department: z.string().trim().min(1) }).parse(request.query);
      const allowedDepartments = new Set(await roleCategoryDepartments(user));
      if (!allowedDepartments.has(department)) {
        throw new ApplicationError('Department is outside the Department Head scope', 403, 'OUTSIDE_DEPARTMENT_SCOPE');
      }
      const [employees, departmentHeads, mappings] = await Promise.all([
        oracle.listEmployees(department),
        oracle.listDepartmentHeads(),
        new RoleCategoryRepository(getPool()).list()
      ]);
      const mappingByEmployee = new Map(mappings.map((mapping) => [mapping.employee_number, mapping.role_category]));
      const rows = await Promise.all(employees.map(async (employee) => {
        const isDepartmentHead = await assignmentData.departmentHeadStatus(employee.EMPLOYEE_NUMBER, departmentHeads) === 'Head';
        const mappingRequired = employee.GRADE !== null && employee.GRADE < 18 && !isDepartmentHead;
        const mappingNote = employee.GRADE === null
          ? 'Missing grade'
          : employee.GRADE >= 18
            ? 'Leadership form'
            : isDepartmentHead ? 'Department Head form' : 'Mapping required';
        return {
          employeeNumber: employee.EMPLOYEE_NUMBER,
          fullName: employee.FULL_NAME ?? employee.EMPLOYEE_NUMBER,
          department: employee.DEPARTMENT,
          grade: employee.GRADE,
          mappingRequired,
          mappingNote,
          roleCategory: mappingByEmployee.get(employee.EMPLOYEE_NUMBER) ?? null
        };
      }));
      rows.sort((left, right) => left.fullName.localeCompare(right.fullName));
      response.json({ employees: rows });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/role-categories', async (request, response, next) => {
    try {
      const user = await requireCurrentUser(request);
      const body = z.object({
        mappings: z.array(z.object({
          employeeNumber: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1)),
          roleCategory: z.enum(['ProjectDeliveryProfessional', 'AdministrativeSupport'])
        })).min(1)
      }).parse(request.body);
      response.json({ mappings: await saveRoleCategoryMappings(user, body.mappings) });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/role-categories/:employeeNumber', async (request, response, next) => {
    try {
      const user = await requireCurrentUser(request);
      const body = z.object({ roleCategory: z.enum(['ProjectDeliveryProfessional', 'AdministrativeSupport']) }).parse(request.body);
      const [mapping] = await saveRoleCategoryMappings(user, [{
        employeeNumber: request.params.employeeNumber.trim(),
        roleCategory: body.roleCategory
      }]);
      response.json({ mapping });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/hr/departments', async (request, response, next) => {
    try {
      const user = await requireCurrentUser(request);
      if (!user.isHrAdmin) throw new ApplicationError('HR access is required', 403, 'FORBIDDEN');
      response.json({ departments: await population.departments() });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/hr/populate', async (request, response, next) => {
    try {
      const user = await requireCurrentUser(request);
      if (!user.isHrAdmin) throw new ApplicationError('HR access is required', 403, 'FORBIDDEN');
      const body = z.object({ department: z.string().trim().min(1) }).parse(request.body);
      response.json({ rows: await population.populate(body.department) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/hr/generate', async (request, response, next) => {
    try {
      const user = await requireCurrentUser(request);
      if (!user.isHrAdmin) throw new ApplicationError('HR access is required', 403, 'FORBIDDEN');
      const body = z.object({ employeeNumbers: z.array(z.union([z.string(), z.number()]).transform(String)) }).parse(request.body);
      response.json(await population.generate(body.employeeNumbers));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/scorecards', async (request, response, next) => {
    try {
      response.json({ scorecards: await scorecardQueries.list(await requireCurrentUser(request)) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/scorecards/:id', async (request, response, next) => {
    try {
      response.json({ scorecard: await scorecardQueries.detail(await requireCurrentUser(request), request.params.id) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/scorecards/:id/actions/:action', async (request, response, next) => {
    try {
      const action = z.enum(['SavedDraft', 'Initiated', 'Approved', 'Rejected', 'Resubmitted']).parse(request.params.action) as WorkflowCommand;
      const body = z.object({
        comment: z.string().max(10_000).optional(),
        lines: z.array(z.record(z.string(), z.unknown())).optional(),
        standards: z.array(z.record(z.string(), z.unknown())).optional(),
        employeeDevelopmentNotes: z.unknown().optional(),
        managerDevelopmentNotes: z.unknown().optional()
      }).strict().parse(request.body ?? {});
      const payload = {
        ...(body.lines ? { lines: body.lines } : {}),
        ...(body.standards ? { standards: body.standards } : {}),
        ...(body.employeeDevelopmentNotes !== undefined ? { employeeDevelopmentNotes: body.employeeDevelopmentNotes } : {}),
        ...(body.managerDevelopmentNotes !== undefined ? { managerDevelopmentNotes: body.managerDevelopmentNotes } : {})
      };
      await workflow.command(
        request.params.id,
        await requireCurrentUser(request),
        action,
        body.comment,
        (client, row) => forms.process(client, row, action, payload)
      );
      response.json({ scorecard: await scorecardQueries.detail(await requireCurrentUser(request), request.params.id) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/hr/phase/advance', async (request, response, next) => {
    try {
      const body = z.object({ expectedCurrentPhase: z.string().optional() }).parse(request.body ?? {});
      response.json(await phases.advance(await requireCurrentUser(request), body.expectedCurrentPhase));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/cycle', async (request, response, next) => {
    try {
      await requireCurrentUser(request);
      const result = await getPool().query(
        "SELECT year, name, status, current_phase FROM performance_cycles WHERE year = 2027"
      );
      response.json({ cycle: result.rows[0] ?? null });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/strategy-references', async (request, response, next) => {
    try {
      await requireCurrentUser(request);
      const result = await getPool().query(
        'SELECT id, level, title, description FROM strategy_references WHERE year = 2027 AND active = TRUE ORDER BY display_order, id'
      );
      response.json({ strategyReferences: result.rows });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof ApplicationError) {
      response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error instanceof z.ZodError) {
      response.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Request validation failed' } });
      return;
    }
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
  });

  return app;
}
