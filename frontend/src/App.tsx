import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Building2, FilePlus2, House, ListChecks, LogOut, Milestone,
  PanelLeftClose, PanelLeftOpen, UserCog, UsersRound, type LucideIcon
} from 'lucide-react';
import { ScorecardView, type ScorecardDetail } from './ScorecardView.js';

type CurrentUser = {
  employeeNumber: string;
  fullName: string;
  department: string | null;
  isHrAdmin: boolean;
  isItAdmin: boolean;
  isManager: boolean;
  departmentHeadStatus: 'Head' | 'NotHead' | 'Unavailable';
};

type Screen = 'home' | 'team' | 'department' | 'all' | 'phase' | 'generate' | 'mappings' | 'scorecard';
type PopulationRow = {
  employeeNumber: string;
  fullName: string;
  grade: number | null;
  employer: string | null;
  employerClassification: string;
  departmentHeadStatus: string;
  departmentHeadName: string | null;
  roleCategory: string | null;
  managerName: string | null;
  formType: string | null;
  status: string;
};
type RoleCategory = 'ProjectDeliveryProfessional' | 'AdministrativeSupport';
type MappingEmployee = {
  employeeNumber: string;
  fullName: string;
  department: string | null;
  grade: number | null;
  mappingRequired: boolean;
  mappingNote: string;
  roleCategory: RoleCategory | null;
};
type GenerationSummary = { created: number; alreadyExisting: number; validationFailed: number };
type ScorecardSummary = {
  id: string;
  employeeNumber: string;
  employeeName: string;
  department: string;
  formType: string;
  currentPhase: string;
  status: string;
  currentAssigneeEmployeeNumber: string | null;
  pendingParticipant: string | null;
};
type Cycle = { year: number; name: string; status: string; current_phase: string };

const formNames: Record<string, string> = {
  DUGLeadership: 'DUG Leadership Scorecard',
  KBULeadership: 'KBU Leadership Scorecard',
  DepartmentHeadKPI: 'Department Heads / Senior Managers KPI Form',
  ProjectDeliveryProfessionalKPI: 'Project Delivery / Professional KPI Form',
  AdministrativeSupport: 'Administrative / Support Non-KPI Form'
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';
const phaseOrder = ['GoalSetting', 'MidYear', 'YearEnd', 'Development', 'Closed'] as const;
const phaseLabels: Record<(typeof phaseOrder)[number], string> = {
  GoalSetting: 'Goals', MidYear: 'Mid-year', YearEnd: 'Year-end', Development: 'Development', Closed: 'Closed'
};
const navigationPreferenceKey = 'pms-navigation-collapsed';
const roleCategoryNames: Record<RoleCategory, string> = {
  ProjectDeliveryProfessional: 'Project Delivery / Professional',
  AdministrativeSupport: 'Administrative / Support'
};

function readableLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\bKpi\b/gi, 'KPI')
    .replace(/\bDug\b/gi, 'DUG')
    .replace(/\bKbu\b/gi, 'KBU');
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'brand-compact' : ''}`} aria-label="Depa PMS 2027">
    <img className="brand-logo" src="/assets/depa-logo.png" alt="" aria-hidden="true" />
    <span className="brand-copy"><small>Performance · 2027</small></span>
  </div>;
}

function PhaseSpine({ activePhase, compact = false }: { activePhase: string; compact?: boolean }) {
  const activeIndex = Math.max(0, phaseOrder.indexOf(activePhase as (typeof phaseOrder)[number]));
  return <ol className={`phase-spine ${compact ? 'phase-spine-compact' : ''}`} aria-label="2027 performance cycle">
    {phaseOrder.map((phase, index) => <li key={phase} className={index < activeIndex ? 'phase-complete' : index === activeIndex ? 'phase-current' : ''}>
      <span className="phase-node" aria-hidden="true">{index < activeIndex ? '✓' : String(index + 1).padStart(2, '0')}</span>
      <span><small>{phaseLabels[phase]}</small>{index === activeIndex && <strong>Current</strong>}</span>
    </li>)}
  </ol>;
}

function RequestLoader({ title }: { title: string }) {
  return <div className="loading-panel request-loader" role="status" aria-live="polite">
      <div className="workflow-loader" aria-hidden="true">{phaseOrder.map((phase) => <span key={phase} />)}</div>
      <p className="loading-message">{title}</p>
    </div>;
}

type ToastMessage = { message: string; tone: 'success' | 'error' | 'info' };

function Toast({ toast }: { toast: ToastMessage }) {
  return <p
    className={`toast toast-${toast.tone}`}
    role={toast.tone === 'error' ? 'alert' : 'status'}
    aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
  >{toast.message}</p>;
}

type NavigationItem = { screen: Screen; label: string; icon: LucideIcon; visible: boolean };

type MemoryCache = {
  scorecardsLoaded: boolean;
  departmentsLoaded: boolean;
  mappingDepartmentsLoaded: boolean;
  cycleLoaded: boolean;
  strategyReferencesLoaded: boolean;
  mappingEmployees: Map<string, MappingEmployee[]>;
  scorecardDetails: Map<string, ScorecardDetail>;
};

function createMemoryCache(): MemoryCache {
  return {
    scorecardsLoaded: false,
    departmentsLoaded: false,
    mappingDepartmentsLoaded: false,
    cycleLoaded: false,
    strategyReferencesLoaded: false,
    mappingEmployees: new Map(),
    scorecardDetails: new Map()
  };
}

export function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [sessionBusy, setSessionBusy] = useState(true);
  const [loginBusy, setLoginBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [screenBusy, setScreenBusy] = useState('');
  const [screen, setScreen] = useState<Screen>('home');
  const [departments, setDepartments] = useState<string[]>([]);
  const [department, setDepartment] = useState('');
  const [population, setPopulation] = useState<PopulationRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [populationBusy, setPopulationBusy] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [mappingDepartments, setMappingDepartments] = useState<string[]>([]);
  const [mappingDepartment, setMappingDepartment] = useState('');
  const [mappingEmployees, setMappingEmployees] = useState<MappingEmployee[]>([]);
  const [mappingEdits, setMappingEdits] = useState<Record<string, RoleCategory>>({});
  const [mappingBusy, setMappingBusy] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [scorecards, setScorecards] = useState<ScorecardSummary[]>([]);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [scorecardDetail, setScorecardDetail] = useState<ScorecardDetail | null>(null);
  const [strategyReferences, setStrategyReferences] = useState<Array<{ id: string; title: string }>>([]);
  const [actionBusy, setActionBusy] = useState(false);
  const memoryCache = useRef<MemoryCache>(createMemoryCache());
  const [navigationCollapsed, setNavigationCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(navigationPreferenceKey) === 'true';
    } catch {
      return false;
    }
  });

  async function api<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', ...options });
    const result = response.status === 204 ? null : await response.json() as T & { error?: { message: string } };
    if (!response.ok) throw new Error(result?.error?.message ?? 'Request failed');
    return result as T;
  }

  function showToast(message: string, tone: ToastMessage['tone'] = 'info') {
    setToast({ message, tone });
  }

  function resetSessionCache() {
    memoryCache.current = createMemoryCache();
    setDepartments([]);
    setDepartment('');
    setPopulation([]);
    setSelected([]);
    setMappingDepartments([]);
    setMappingDepartment('');
    setMappingEmployees([]);
    setMappingEdits({});
    setScorecards([]);
    setCycle(null);
    setScorecardDetail(null);
    setStrategyReferences([]);
  }

  function toggleNavigation() {
    setNavigationCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(navigationPreferenceKey, String(next));
      } catch {
        // The shell still collapses when browser storage is unavailable.
      }
      return next;
    });
  }

  useEffect(() => {
    fetch(`${apiBaseUrl}/auth/session`, { credentials: 'include' })
      .then(async (response) => response.ok ? response.json() as Promise<{ user: CurrentUser }> : null)
      .then(async (result) => {
        const restoredUser = result?.user ?? null;
        setUser(restoredUser);
        if (restoredUser) {
          const response = await fetch(`${apiBaseUrl}/scorecards`, { credentials: 'include' });
          if (response.ok) {
            setScorecards(((await response.json()) as { scorecards: ScorecardSummary[] }).scorecards);
            memoryCache.current.scorecardsLoaded = true;
          }
        }
      })
      .catch(() => setToast({ message: 'The PMS backend is unavailable.', tone: 'error' }))
      .finally(() => setSessionBusy(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setToast(null);
    setLoginBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ employeeNumber })
      });
      const result = await response.json() as { user?: CurrentUser; error?: { message: string } };
      if (!response.ok || !result.user) throw new Error(result.error?.message ?? 'Login failed');
      resetSessionCache();
      setUser(result.user);
      const scorecardResult = await api<{ scorecards: ScorecardSummary[] }>('/scorecards');
      setScorecards(scorecardResult.scorecards);
      memoryCache.current.scorecardsLoaded = true;
    } catch (loginError) {
      showToast(loginError instanceof Error ? loginError.message : 'Login failed', 'error');
    } finally {
      setLoginBusy(false);
    }
  }

  async function logout() {
    setToast(null);
    setLogoutBusy(true);
    setScreenBusy('Signing out');
    try {
      const response = await fetch(`${apiBaseUrl}/auth/logout`, { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error('Logout failed');
      setUser(null);
      setEmployeeNumber('');
      setScreen('home');
      resetSessionCache();
    } catch (logoutError) {
      showToast(logoutError instanceof Error ? logoutError.message : 'Logout failed', 'error');
    } finally {
      setLogoutBusy(false);
      setScreenBusy('');
    }
  }

  async function openScreen(nextScreen: Screen) {
    setScreen(nextScreen);
    setToast(null);
    try {
      if (nextScreen === 'generate' && !memoryCache.current.departmentsLoaded) {
        setScreenBusy('Loading departments');
        const result = await api<{ departments: string[] }>('/hr/departments');
        setDepartments(result.departments);
        setDepartment(result.departments[0] ?? '');
        memoryCache.current.departmentsLoaded = true;
      }
      if (nextScreen === 'mappings') {
        let availableDepartments = mappingDepartments;
        if (!memoryCache.current.mappingDepartmentsLoaded) {
          setScreenBusy('Loading departments');
          const result = await api<{ departments: string[] }>('/role-categories/departments');
          availableDepartments = result.departments;
          setMappingDepartments(availableDepartments);
          memoryCache.current.mappingDepartmentsLoaded = true;
        }
        const firstDepartment = mappingDepartment || availableDepartments[0] || '';
        if (!mappingDepartment) setMappingDepartment(firstDepartment);
        if (!user?.isHrAdmin && availableDepartments.length === 1 && firstDepartment) {
          setScreenBusy('');
          await loadMappingEmployees(firstDepartment);
        }
      }
      if (['home', 'team', 'department', 'all'].includes(nextScreen) && !memoryCache.current.scorecardsLoaded) {
        setScreenBusy('Loading submissions');
        const result = await api<{ scorecards: ScorecardSummary[] }>('/scorecards');
        setScorecards(result.scorecards);
        memoryCache.current.scorecardsLoaded = true;
      }
      if (nextScreen === 'phase' && !memoryCache.current.cycleLoaded) {
        setScreenBusy('Loading phase control');
        const result = await api<{ cycle: Cycle }>('/cycle');
        setCycle(result.cycle);
        memoryCache.current.cycleLoaded = true;
      }
    } catch (loadError) {
      showToast(loadError instanceof Error ? loadError.message : 'Unable to load screen', 'error');
    } finally {
      setScreenBusy('');
    }
  }

  async function populate() {
    setToast(null);
    setPopulationBusy(true);
    try {
      const result = await api<{ rows: PopulationRow[] }>('/hr/populate', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ department })
      });
      setPopulation(result.rows);
      setSelected(result.rows.filter((row) => row.status === 'Ready').map((row) => row.employeeNumber));
      showToast(`${result.rows.length} ${result.rows.length === 1 ? 'employee' : 'employees'} loaded`, 'info');
    } catch (populateError) {
      showToast(populateError instanceof Error ? populateError.message : 'Populate failed', 'error');
    } finally {
      setPopulationBusy(false);
    }
  }

  async function generate() {
    setToast(null);
    setGenerationBusy(true);
    try {
      const result = await api<GenerationSummary>('/hr/generate', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ employeeNumbers: selected })
      });
      const [refreshed, refreshedScorecards] = await Promise.all([
        api<{ rows: PopulationRow[] }>('/hr/populate', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ department })
        }),
        api<{ scorecards: ScorecardSummary[] }>('/scorecards')
      ]);
      setPopulation(refreshed.rows);
      setSelected(refreshed.rows.filter((row) => row.status === 'Ready').map((row) => row.employeeNumber));
      setScorecards(refreshedScorecards.scorecards);
      memoryCache.current.scorecardsLoaded = true;
      showToast(`${result.created} created · ${result.alreadyExisting} already exist · ${result.validationFailed} failed validation`, 'success');
    } catch (generateError) {
      showToast(generateError instanceof Error ? generateError.message : 'Generate failed', 'error');
    } finally {
      setGenerationBusy(false);
    }
  }

  async function loadMappingEmployees(targetDepartment = mappingDepartment, forceRefresh = false) {
    const cachedEmployees = memoryCache.current.mappingEmployees.get(targetDepartment);
    if (cachedEmployees && !forceRefresh) {
      setMappingEmployees(cachedEmployees);
      setMappingEdits({});
      return;
    }
    setToast(null);
    setMappingBusy('Loading department employees');
    try {
      const result = await api<{ employees: MappingEmployee[] }>(
        `/role-categories/employees?department=${encodeURIComponent(targetDepartment)}`
      );
      setMappingEmployees(result.employees);
      setMappingEdits({});
      memoryCache.current.mappingEmployees.set(targetDepartment, result.employees);
    } catch (mappingError) {
      showToast(mappingError instanceof Error ? mappingError.message : 'Unable to load department employees', 'error');
    } finally {
      setMappingBusy('');
    }
  }

  function updateMapping(employee: MappingEmployee, value: string) {
    if (!value) return;
    const roleCategory = value as RoleCategory;
    setMappingEdits((current) => {
      const next = { ...current };
      if (roleCategory === employee.roleCategory) delete next[employee.employeeNumber];
      else next[employee.employeeNumber] = roleCategory;
      return next;
    });
  }

  async function saveMappings() {
    const changes = Object.entries(mappingEdits).map(([employeeNumber, roleCategory]) => ({ employeeNumber, roleCategory }));
    if (changes.length === 0) return;
    setToast(null);
    setMappingBusy('Saving role category mappings');
    try {
      await api('/role-categories', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mappings: changes })
      });
      const refreshed = await api<{ employees: MappingEmployee[] }>(
        `/role-categories/employees?department=${encodeURIComponent(mappingDepartment)}`
      );
      setMappingEmployees(refreshed.employees);
      setMappingEdits({});
      memoryCache.current.mappingEmployees.set(mappingDepartment, refreshed.employees);
      showToast(`${changes.length} role category ${changes.length === 1 ? 'mapping' : 'mappings'} saved`, 'success');
    } catch (mappingError) {
      showToast(mappingError instanceof Error ? mappingError.message : 'Bulk mapping save failed', 'error');
    } finally {
      setMappingBusy('');
    }
  }

  async function advancePhase() {
    if (!cycle) return;
    setToast(null);
    setScreenBusy('Opening the next phase');
    try {
      const result = await api<{ currentPhase: string; openedScorecards: number }>('/hr/phase/advance', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedCurrentPhase: cycle.current_phase })
      });
      const [refreshed, refreshedScorecards] = await Promise.all([
        api<{ cycle: Cycle }>('/cycle'),
        api<{ scorecards: ScorecardSummary[] }>('/scorecards')
      ]);
      setCycle(refreshed.cycle);
      setScorecards(refreshedScorecards.scorecards);
      memoryCache.current.cycleLoaded = true;
      memoryCache.current.scorecardsLoaded = true;
      memoryCache.current.scorecardDetails.clear();
      const openedPhase = phaseLabels[result.currentPhase as keyof typeof phaseLabels] ?? readableLabel(result.currentPhase);
      showToast(`${openedPhase} opened for ${result.openedScorecards} scorecards`, 'success');
    } catch (phaseError) {
      showToast(phaseError instanceof Error ? phaseError.message : 'Phase advance failed', 'error');
    } finally {
      setScreenBusy('');
    }
  }

  async function openScorecard(id: string) {
    setToast(null);
    const cachedDetail = memoryCache.current.scorecardDetails.get(id);
    if (cachedDetail && memoryCache.current.strategyReferencesLoaded) {
      setScorecardDetail(cachedDetail);
      setScreen('scorecard');
      return;
    }
    setScreenBusy('Opening scorecard');
    try {
      const [detail, references] = await Promise.all([
        cachedDetail
          ? Promise.resolve({ scorecard: cachedDetail })
          : api<{ scorecard: ScorecardDetail }>(`/scorecards/${id}`),
        memoryCache.current.strategyReferencesLoaded
          ? Promise.resolve({ strategyReferences })
          : api<{ strategyReferences: Array<{ id: string; title: string }> }>('/strategy-references')
      ]);
      setScorecardDetail(detail.scorecard);
      setStrategyReferences(references.strategyReferences);
      memoryCache.current.scorecardDetails.set(id, detail.scorecard);
      memoryCache.current.strategyReferencesLoaded = true;
      setScreen('scorecard');
    } catch (openError) {
      showToast(openError instanceof Error ? openError.message : 'Unable to open scorecard', 'error');
    } finally {
      setScreenBusy('');
    }
  }

  async function performScorecardAction(action: string, payload: Record<string, unknown>) {
    if (!scorecardDetail) return;
    setActionBusy(true);
    setToast(null);
    try {
      const result = await api<{ scorecard: ScorecardDetail }>(`/scorecards/${scorecardDetail.id}/actions/${action}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
      });
      setScorecardDetail(result.scorecard);
      memoryCache.current.scorecardDetails.set(result.scorecard.id, result.scorecard);
      setScorecards((current) => current.map((item) => item.id === result.scorecard.id ? {
        ...item,
        currentPhase: result.scorecard.current_phase,
        status: result.scorecard.status,
        currentAssigneeEmployeeNumber: result.scorecard.current_workflow_assignee_employee_number,
        pendingParticipant: result.scorecard.pending_participant
      } : item));
      showToast(`${readableLabel(action)} completed`, 'success');
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : 'Workflow action failed', 'error');
    } finally {
      setActionBusy(false);
    }
  }

  const ownScorecard = user ? scorecards.find((item) => item.employeeNumber === user.employeeNumber) : null;
  const activePhase = scorecardDetail?.current_phase ?? cycle?.current_phase ?? ownScorecard?.currentPhase ?? 'GoalSetting';
  const navigationItems: NavigationItem[] = user ? [
    { screen: 'home', label: 'My PMS', icon: House, visible: true },
    { screen: 'team', label: 'My Team', icon: UsersRound, visible: user.isManager },
    { screen: 'department', label: 'Department PMS', icon: Building2, visible: user.departmentHeadStatus === 'Head' },
    { screen: 'generate', label: 'Create PMS Submissions', icon: FilePlus2, visible: user.isHrAdmin },
    { screen: 'all', label: 'All 2027 Submissions', icon: ListChecks, visible: user.isHrAdmin },
    { screen: 'phase', label: 'Phase Control', icon: Milestone, visible: user.isHrAdmin },
    { screen: 'mappings', label: 'Role Category Mapping', icon: UserCog, visible: user.isHrAdmin || user.departmentHeadStatus === 'Head' }
  ] : [];

  const accessLabel = user?.isHrAdmin ? 'HR Admin' : user?.isItAdmin ? 'IT System Admin' : user?.departmentHeadStatus === 'Head'
    ? 'Department Head' : user?.isManager ? 'Line Manager' : 'Employee';

  function scorecardList(items: ScorecardSummary[], emptyMessage: string) {
    if (items.length === 0) return <div className="empty-state"><span aria-hidden="true">0</span><div><strong>No records yet</strong><p>{emptyMessage}</p></div></div>;
    return <div className="table-scroll"><table className="data-table">
      <thead><tr><th scope="col">Employee</th><th scope="col">Form</th><th scope="col">Phase</th><th scope="col">Status</th><th scope="col">Pending participant</th><th scope="col">Action</th></tr></thead>
      <tbody>{items.map((item) => <tr key={item.id}>
        <td><strong>{item.employeeName}</strong><small className="utility-text">{item.employeeNumber}</small></td><td>{formNames[item.formType] ?? readableLabel(item.formType)}</td>
        <td><span className="phase-label">{phaseLabels[item.currentPhase as keyof typeof phaseLabels] ?? readableLabel(item.currentPhase)}</span></td><td><span className="status-chip">{readableLabel(item.status)}</span></td><td>{item.pendingParticipant ? readableLabel(item.pendingParticipant) : 'None'}{item.currentAssigneeEmployeeNumber ? <small className="utility-text">{item.currentAssigneeEmployeeNumber}</small> : null}</td>
        <td><button className="table-action" type="button" onClick={() => openScorecard(item.id)}>Open {item.employeeName}<ArrowRight size={15} aria-hidden="true" /></button></td>
      </tr>)}</tbody>
    </table></div>;
  }

  if (!user) {
    return (
      <main className="login-shell" aria-busy={sessionBusy || loginBusy}>
        <section className="login-frame" aria-labelledby="page-title">
          <div className="login-context">
            <Brand />
            <div className="login-thesis">
              <p className="eyebrow eyebrow-light">2027 performance cycle</p>
              <h1 id="page-title">PMS 2027</h1>
              <p>One clear record for goals, reviews, ratings, and development.</p>
            </div>
            <PhaseSpine activePhase="GoalSetting" />
          </div>
          <div className="login-entry">
            <div className="login-heading">
              <h2>Enter your workspace</h2>
              <p>Use any eligible Oracle employee number.</p>
            </div>
            <form className="login-form" onSubmit={login}>
              <label htmlFor="employee-number">Employee Number</label>
              <div className="input-with-action">
                <input
                  id="employee-number"
                  name="employeeNumber"
                  value={employeeNumber}
                  onChange={(event) => setEmployeeNumber(event.target.value)}
                  autoComplete="username"
                  inputMode="numeric"
                  placeholder="e.g. 12245"
                  disabled={sessionBusy || loginBusy}
                  required
                />
                <button type="submit" disabled={sessionBusy || loginBusy}>{loginBusy ? 'Signing in...' : 'Test Login'}<ArrowRight size={18} aria-hidden="true" /></button>
              </div>
              {sessionBusy && <RequestLoader title="Checking for an existing session" />}
              {loginBusy && <RequestLoader title="Checking employee access" />}
            </form>
          </div>
        </section>
        {toast && <Toast toast={toast} />}
      </main>
    );
  }

  return (
    <div className={`app-shell ${navigationCollapsed ? 'navigation-collapsed' : ''}`}>
      <aside className="navigation-shell">
        <div className="navigation-brand"><Brand compact /><button
          className="navigation-toggle"
          type="button"
          aria-label={navigationCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!navigationCollapsed}
          onClick={toggleNavigation}
        >{navigationCollapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}</button></div>
        <nav aria-label="Primary navigation" className="primary-navigation">
          {navigationItems.filter((item) => item.visible).map(({ screen: destination, label, icon: Icon }) => <button
            key={destination}
            className={`nav-button ${screen === destination || destination === 'home' && screen === 'scorecard' ? 'nav-button-active' : ''}`}
            type="button"
            disabled={actionBusy || Boolean(screenBusy) || logoutBusy}
            aria-current={screen === destination ? 'page' : undefined}
            aria-label={navigationCollapsed ? label : undefined}
            title={navigationCollapsed ? label : undefined}
            onClick={() => openScreen(destination)}
          ><Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span></button>)}
        </nav>
        <div className="navigation-cycle"><span className="utility-text">2027 cycle</span><PhaseSpine activePhase={activePhase} compact /></div>
        <div className="user-context">
          <div className="user-avatar" aria-hidden="true">{user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div>
          <div><strong>{user.fullName}</strong><span>{accessLabel}</span></div>
          <button className="icon-button" type="button" disabled={actionBusy || logoutBusy} onClick={logout} aria-label="Logout"><LogOut size={17} aria-hidden="true" /></button>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <div><span className="utility-text">Depa United Group</span><strong>Performance management system</strong></div>
          <div className="workspace-phase"><span>{phaseLabels[activePhase as keyof typeof phaseLabels] ?? readableLabel(activePhase)}</span><small>Current phase</small></div>
        </header>
        <main className={`content ${screen === 'home' ? 'content-home' : ''}`}>
        {screen === 'home' && <section className="screen-section home-screen" aria-labelledby="home-title">
          <div className="screen-heading"><div><p className="eyebrow">Home / My PMS</p><h1 id="home-title">Welcome, {user.fullName}</h1></div></div>
          <dl className="identity-card">
            <div><dt>Employee number</dt><dd className="utility-text">{user.employeeNumber}</dd></div>
            <div><dt>Department</dt><dd>{user.department ?? 'Not available'}</dd></div>
            <div><dt>Cycle position</dt><dd>{phaseLabels[activePhase as keyof typeof phaseLabels] ?? readableLabel(activePhase)}</dd></div>
          </dl>
          {screenBusy && <RequestLoader title={screenBusy} />}
          <div className="content-panel"><div className="panel-heading"><div><span className="utility-text">2027 RECORD</span><h2>My submission</h2></div><span>{scorecards.filter((item) => item.employeeNumber === user.employeeNumber).length} record</span></div>
            {scorecardList(scorecards.filter((item) => item.employeeNumber === user.employeeNumber), 'No 2027 PMS submission has been generated for this employee yet.')}
          </div>
        </section>}

        {screen === 'team' && <section className="screen-section" aria-labelledby="team-title">
          <div className="screen-heading"><div><p className="eyebrow">Line Manager</p><h1 id="team-title">My Team</h1><p>Review direct reports and act when a submission is pending with you.</p></div></div>
          {screenBusy && <RequestLoader title={screenBusy} />}
          {scorecardList(scorecards.filter((item) => item.employeeNumber !== user.employeeNumber), 'No direct-report submissions are available.')}
        </section>}

        {screen === 'department' && <section className="screen-section" aria-labelledby="department-title">
          <div className="screen-heading"><div><p className="eyebrow">Department Head</p><h1 id="department-title">Department PMS</h1><p>{user.department ?? 'Your department'} submissions for the active 2027 cycle.</p></div></div>
          {screenBusy && <RequestLoader title={screenBusy} />}
          {scorecardList(scorecards.filter((item) => item.department === user.department), 'No department submissions are available.')}
        </section>}

        {screen === 'all' && <section className="screen-section" aria-labelledby="all-title">
          <div className="screen-heading"><div><p className="eyebrow">HR</p><h1 id="all-title">All 2027 Submissions</h1><p>Every generated scorecard in the current performance cycle.</p></div><span className="record-count utility-text">{scorecards.length.toString().padStart(2, '0')} RECORDS</span></div>
          {screenBusy && <RequestLoader title={screenBusy} />}
          {scorecardList(scorecards, 'No submissions have been generated.')}
        </section>}

        {screen === 'phase' && <section className="screen-section" aria-labelledby="phase-title">
          <div className="screen-heading"><div><p className="eyebrow">HR control</p><h1 id="phase-title">Phase Control</h1><p>Advance the cycle only after every eligible scorecard completes the current phase.</p></div></div>
          {screenBusy && <RequestLoader title={screenBusy} />}
          {cycle && <div className="phase-card"><div className="phase-card-top"><dl><div><dt>Cycle</dt><dd>{cycle.name}</dd></div><div><dt>Current phase</dt><dd>{phaseLabels[cycle.current_phase as keyof typeof phaseLabels] ?? readableLabel(cycle.current_phase)}</dd></div><div><dt>Status</dt><dd><span className="status-chip">{readableLabel(cycle.status)}</span></dd></div></dl>
            {cycle.current_phase !== 'Closed' && <button type="button" onClick={advancePhase} disabled={Boolean(screenBusy)}>Open next phase<ArrowRight size={17} aria-hidden="true" /></button>}</div>
            <PhaseSpine activePhase={cycle.current_phase} />
          </div>}
        </section>}

        {screen === 'generate' && <section className="screen-section" aria-labelledby="generation-title">
          <div className="screen-heading"><div><p className="eyebrow">HR workspace</p><h1 id="generation-title">Create PMS Submissions</h1><p>Preview assignments first. Generate only rows that pass every assignment rule.</p></div></div>
          <div className="toolbar">
            <label htmlFor="department">Department<select id="department" value={department} disabled={Boolean(screenBusy) || populationBusy || generationBusy} onChange={(event) => setDepartment(event.target.value)}>
                {departments.map((item) => <option key={item}>{item}</option>)}
              </select></label>
            <button type="button" onClick={populate} disabled={!department || Boolean(screenBusy) || populationBusy || generationBusy}>Populate<FilePlus2 size={16} aria-hidden="true" /></button>
            {population.length > 0 && <button className="secondary-action" type="button" onClick={generate} disabled={selected.length === 0 || populationBusy || generationBusy}>Generate selected<ArrowRight size={16} aria-hidden="true" /></button>}
          </div>
          {screenBusy && <RequestLoader title={screenBusy} />}
          {populationBusy && <RequestLoader title="Populating department employees" />}
          {generationBusy && <RequestLoader title="Creating PMS submissions" />}
          {population.length > 0 && <div className="table-scroll"><table className="data-table population-table">
            <thead><tr><th scope="col">Select</th><th scope="col">Employee</th><th scope="col">Grade</th><th scope="col">Employer / Classification</th><th scope="col">Department Head</th><th scope="col">Role Category</th><th scope="col">Manager</th><th scope="col">Form</th><th scope="col">Status</th></tr></thead>
            <tbody>{population.map((row) => <tr key={row.employeeNumber}>
              <td><input aria-label={`Select ${row.fullName}`} type="checkbox" disabled={row.status !== 'Ready'} checked={selected.includes(row.employeeNumber)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.employeeNumber] : selected.filter((number) => number !== row.employeeNumber))} /></td>
              <td><strong>{row.fullName}</strong><small className="utility-text">{row.employeeNumber}</small></td><td>{row.grade ?? 'Missing'}</td>
              <td>{row.employerClassification === 'NotApplicable' ? row.employer ?? 'Not applicable' : readableLabel(row.employerClassification)}</td>
              <td>{row.departmentHeadName ?? 'Not available'}</td><td>{row.roleCategory ? roleCategoryNames[row.roleCategory as RoleCategory] ?? readableLabel(row.roleCategory) : 'Not applicable'}</td><td>{row.managerName ?? 'Missing'}</td>
              <td>{row.formType ? formNames[row.formType] ?? readableLabel(row.formType) : 'None'}</td><td><span className={`status status-${row.status === 'Ready' ? 'ready' : 'blocked'}`}>{readableLabel(row.status)}</span></td>
            </tr>)}</tbody>
          </table></div>}
        </section>}

        {screen === 'mappings' && <section className="screen-section" aria-labelledby="mapping-title">
          <div className="screen-heading"><div><p className="eyebrow">Administration</p><h1 id="mapping-title">Role Category Mapping</h1><p>Choose a department, classify one or more eligible employees, then save the changes together.</p></div></div>
          <div className="toolbar mapping-toolbar">
            <label htmlFor="mapping-department">Department<select id="mapping-department" value={mappingDepartment} disabled={Boolean(screenBusy) || Boolean(mappingBusy)} onChange={(event) => {
              const nextDepartment = event.target.value;
              setMappingDepartment(nextDepartment);
              setMappingEmployees([]);
              setMappingEdits({});
              void loadMappingEmployees(nextDepartment);
            }}>
              {mappingDepartments.map((item) => <option key={item}>{item}</option>)}
            </select></label>
            <button type="button" onClick={() => loadMappingEmployees(mappingDepartment, true)} disabled={!mappingDepartment || Boolean(mappingBusy) || Boolean(screenBusy)}>
              Load employees<UsersRound size={16} aria-hidden="true" />
            </button>
          </div>
          {screenBusy && <RequestLoader title={screenBusy} />}
          {mappingBusy && <RequestLoader title={mappingBusy} />}
          {mappingEmployees.length > 0 && <div className="mapping-worklist content-panel">
            <div className="panel-heading mapping-worklist-heading"><div><span className="utility-text">{mappingDepartment.toUpperCase()}</span><h2>Department employees</h2></div><span>{Object.keys(mappingEdits).length} pending</span></div>
            <div className="table-scroll"><table className="data-table mapping-table">
              <thead><tr><th scope="col">Employee</th><th scope="col">Grade</th><th scope="col">Mapping use</th><th scope="col">Role Category</th></tr></thead>
              <tbody>{mappingEmployees.map((employee) => <tr key={employee.employeeNumber} className={!employee.mappingRequired ? 'mapping-row-inactive' : undefined}>
                <td><strong>{employee.fullName}</strong><small className="utility-text">{employee.employeeNumber}</small></td>
                <td>{employee.grade ?? 'Missing'}</td>
                <td><span className={`status ${employee.mappingRequired ? 'status-ready' : ''}`}>{employee.mappingNote}</span></td>
                <td><div className="mapping-category"><select
                  aria-label={`Role category for ${employee.fullName}`}
                  value={mappingEdits[employee.employeeNumber] ?? employee.roleCategory ?? ''}
                  disabled={!employee.mappingRequired || Boolean(mappingBusy)}
                  onChange={(event) => updateMapping(employee, event.target.value)}
                >
                  <option value="" disabled>Select category</option>
                  <option value="ProjectDeliveryProfessional">{roleCategoryNames.ProjectDeliveryProfessional}</option>
                  <option value="AdministrativeSupport">{roleCategoryNames.AdministrativeSupport}</option>
                </select></div></td>
              </tr>)}</tbody>
            </table></div>
            <div className="mapping-actions"><p>{Object.keys(mappingEdits).length === 0 ? 'Change a role category to add it to this save.' : `${Object.keys(mappingEdits).length} employee ${Object.keys(mappingEdits).length === 1 ? 'change' : 'changes'} ready to save.`}</p>
              <button type="button" onClick={saveMappings} disabled={Object.keys(mappingEdits).length === 0 || Boolean(mappingBusy)}>Save mappings<ArrowRight size={16} aria-hidden="true" /></button></div>
          </div>}
          {!mappingBusy && !screenBusy && mappingDepartment && mappingEmployees.length === 0 && <div className="empty-state"><span aria-hidden="true">0</span><div><strong>No employees loaded</strong><p>Load the selected department to edit its role category mappings.</p></div></div>}
        </section>}
        {screen === 'scorecard' && scorecardDetail && <ScorecardView
          scorecard={scorecardDetail}
          userEmployeeNumber={user.employeeNumber}
          strategyReferences={strategyReferences}
          busy={actionBusy}
          onAction={performScorecardAction}
        />}
      </main>
      </div>
      {toast && <Toast toast={toast} />}
    </div>
  );
}
