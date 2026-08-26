import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { AssignmentDataService } from './oracle/assignment-data.js';
import { OracleClient } from './oracle/client.js';
import { IdentityService } from './auth/service.js';
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
  const identity = new IdentityService(oracle, new AssignmentDataService(oracle), config);
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
      setSessionCookie(response, sessions.create(user.employeeNumber), config.NODE_ENV === 'production');
      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/session', async (request, response, next) => {
    const sessionId = readSessionId(request);
    const employeeNumber = sessions.employeeNumber(sessionId);
    if (!employeeNumber) {
      response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: 'No active test session' } });
      return;
    }
    try {
      response.json({ user: await identity.restore(employeeNumber) });
    } catch (error) {
      sessions.delete(sessionId);
      clearSessionCookie(response, config.NODE_ENV === 'production');
      next(error);
    }
  });

  app.post('/api/auth/logout', (request, response) => {
    sessions.delete(readSessionId(request));
    clearSessionCookie(response, config.NODE_ENV === 'production');
    response.status(204).send();
  });

  async function requireCurrentUser(request: express.Request) {
    const employeeNumber = sessions.employeeNumber(readSessionId(request));
    if (!employeeNumber) throw new ApplicationError('No active test session', 401, 'NOT_AUTHENTICATED');
    return identity.restore(employeeNumber);
  }

  app.get('/api/role-categories', async (request, response, next) => {
    try {
      const user = await requireCurrentUser(request);
      if (!user.isHrAdmin && user.departmentHeadStatus !== 'Head') throw new ApplicationError('RoleCategory access is forbidden', 403, 'FORBIDDEN');
      const mappings = await new RoleCategoryRepository(getPool()).list();
      response.json({ mappings: user.isHrAdmin ? mappings : mappings.filter((mapping) => mapping.department === user.department) });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/role-categories/:employeeNumber', async (request, response, next) => {
    try {
      const user = await requireCurrentUser(request);
      if (!user.isHrAdmin && user.departmentHeadStatus !== 'Head') throw new ApplicationError('RoleCategory changes are forbidden', 403, 'FORBIDDEN');
      const body = z.object({ roleCategory: z.enum(['ProjectDeliveryProfessional', 'AdministrativeSupport']) }).parse(request.body);
      const employee = await oracle.getEmployee(request.params.employeeNumber);
      if (!employee.DEPARTMENT) throw new ApplicationError('Target employee has no department', 422, 'MISSING_DEPARTMENT');
      if (!user.isHrAdmin && employee.DEPARTMENT !== user.department) {
        throw new ApplicationError('Target employee is outside the Department Head scope', 403, 'OUTSIDE_DEPARTMENT_SCOPE');
      }
      const mapping = await inTransaction((client) =>
        new RoleCategoryRepository(client).upsert(employee.EMPLOYEE_NUMBER, body.roleCategory, employee.DEPARTMENT!, user.employeeNumber)
      );
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
