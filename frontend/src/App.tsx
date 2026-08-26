import { type FormEvent, useEffect, useState } from 'react';
import {
  ArrowRight, Building2, FilePlus2, House, ListChecks, LogOut, Milestone,
  PanelLeftClose, PanelLeftOpen, ShieldCheck, UserCog, UsersRound, type LucideIcon
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
  roleCategory: string | null;
  managerName: string | null;
  formType: string | null;
  status: string;
};
type Mapping = { employee_number: string; role_category: string; department: string };
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

function WorkflowLoader() {
  return <main className="loading-page">
    <div className="loading-panel" role="status">
      <div className="workflow-loader" aria-hidden="true">{phaseOrder.map((phase) => <span key={phase} />)}</div>
      <div><p className="eyebrow">PMS 2027</p><p className="loading-title">Preparing your workspace</p><p className="loading-copy">Loading your identity and current performance cycle.</p></div>
      <span className="sr-only">Loading PMS...</span>
    </div>
  </main>;
}

type NavigationItem = { screen: Screen; label: string; icon: LucideIcon; visible: boolean };

export function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('home');
  const [departments, setDepartments] = useState<string[]>([]);
  const [department, setDepartment] = useState('');
  const [population, setPopulation] = useState<PopulationRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [summary, setSummary] = useState<GenerationSummary | null>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [mappingEmployee, setMappingEmployee] = useState('');
  const [roleCategory, setRoleCategory] = useState('ProjectDeliveryProfessional');
  const [operationMessage, setOperationMessage] = useState('');
  const [scorecards, setScorecards] = useState<ScorecardSummary[]>([]);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [scorecardDetail, setScorecardDetail] = useState<ScorecardDetail | null>(null);
  const [strategyReferences, setStrategyReferences] = useState<Array<{ id: string; title: string }>>([]);
  const [actionBusy, setActionBusy] = useState(false);
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
          if (response.ok) setScorecards(((await response.json()) as { scorecards: ScorecardSummary[] }).scorecards);
        }
      })
      .catch(() => setError('The PMS backend is unavailable.'))
      .finally(() => setLoading(false));
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ employeeNumber })
      });
      const result = await response.json() as { user?: CurrentUser; error?: { message: string } };
      if (!response.ok || !result.user) throw new Error(result.error?.message ?? 'Login failed');
      setUser(result.user);
      const scorecardResult = await api<{ scorecards: ScorecardSummary[] }>('/scorecards');
      setScorecards(scorecardResult.scorecards);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch(`${apiBaseUrl}/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
    setEmployeeNumber('');
    setScreen('home');
  }

  async function openScreen(nextScreen: Screen) {
    setScreen(nextScreen);
    setError('');
    setOperationMessage('');
    try {
      if (nextScreen === 'generate' && departments.length === 0) {
        const result = await api<{ departments: string[] }>('/hr/departments');
        setDepartments(result.departments);
        setDepartment(result.departments[0] ?? '');
      }
      if (nextScreen === 'mappings') {
        const result = await api<{ mappings: Mapping[] }>('/role-categories');
        setMappings(result.mappings);
      }
      if (['home', 'team', 'department', 'all'].includes(nextScreen)) {
        const result = await api<{ scorecards: ScorecardSummary[] }>('/scorecards');
        setScorecards(result.scorecards);
      }
      if (nextScreen === 'phase') {
        const result = await api<{ cycle: Cycle }>('/cycle');
        setCycle(result.cycle);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load screen');
    }
  }

  async function populate() {
    setError('');
    setSummary(null);
    try {
      const result = await api<{ rows: PopulationRow[] }>('/hr/populate', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ department })
      });
      setPopulation(result.rows);
      setSelected(result.rows.filter((row) => row.status === 'Ready').map((row) => row.employeeNumber));
    } catch (populateError) {
      setError(populateError instanceof Error ? populateError.message : 'Populate failed');
    }
  }

  async function generate() {
    setError('');
    try {
      const result = await api<GenerationSummary>('/hr/generate', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ employeeNumbers: selected })
      });
      setSummary(result);
      await populate();
      setSummary(result);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Generate failed');
    }
  }

  async function saveMapping(event: FormEvent) {
    event.preventDefault();
    setError('');
    setOperationMessage('');
    try {
      await api(`/role-categories/${encodeURIComponent(mappingEmployee)}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ roleCategory })
      });
      setOperationMessage(`RoleCategory saved for ${mappingEmployee}`);
      const result = await api<{ mappings: Mapping[] }>('/role-categories');
      setMappings(result.mappings);
    } catch (mappingError) {
      setError(mappingError instanceof Error ? mappingError.message : 'Mapping save failed');
    }
  }

  async function advancePhase() {
    if (!cycle) return;
    setError('');
    try {
      const result = await api<{ currentPhase: string; openedScorecards: number }>('/hr/phase/advance', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedCurrentPhase: cycle.current_phase })
      });
      setOperationMessage(`${result.currentPhase} opened for ${result.openedScorecards} scorecards`);
      const refreshed = await api<{ cycle: Cycle }>('/cycle');
      setCycle(refreshed.cycle);
    } catch (phaseError) {
      setError(phaseError instanceof Error ? phaseError.message : 'Phase advance failed');
    }
  }

  async function openScorecard(id: string) {
    setError('');
    try {
      const [detail, references] = await Promise.all([
        api<{ scorecard: ScorecardDetail }>(`/scorecards/${id}`),
        api<{ strategyReferences: Array<{ id: string; title: string }> }>('/strategy-references')
      ]);
      setScorecardDetail(detail.scorecard);
      setStrategyReferences(references.strategyReferences);
      setScreen('scorecard');
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Unable to open scorecard');
    }
  }

  async function performScorecardAction(action: string, payload: Record<string, unknown>) {
    if (!scorecardDetail) return;
    setActionBusy(true);
    setError('');
    try {
      const result = await api<{ scorecard: ScorecardDetail }>(`/scorecards/${scorecardDetail.id}/actions/${action}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
      });
      setScorecardDetail(result.scorecard);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Workflow action failed');
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
    { screen: 'mappings', label: 'RoleCategory Mapping', icon: UserCog, visible: user.isHrAdmin || user.departmentHeadStatus === 'Head' }
  ] : [];

  const accessLabel = user?.isHrAdmin ? 'HR Admin' : user?.isItAdmin ? 'IT System Admin' : user?.departmentHeadStatus === 'Head'
    ? 'Department Head' : user?.isManager ? 'Line Manager' : 'Employee';

  function scorecardList(items: ScorecardSummary[], emptyMessage: string) {
    if (items.length === 0) return <div className="empty-state"><span aria-hidden="true">0</span><div><strong>No records yet</strong><p>{emptyMessage}</p></div></div>;
    return <div className="table-scroll"><table className="data-table">
      <thead><tr><th scope="col">Employee</th><th scope="col">Form</th><th scope="col">Phase</th><th scope="col">Status</th><th scope="col">Pending participant</th><th scope="col">Action</th></tr></thead>
      <tbody>{items.map((item) => <tr key={item.id}>
        <td><strong>{item.employeeName}</strong><small className="utility-text">{item.employeeNumber}</small></td><td>{formNames[item.formType] ?? item.formType}</td>
        <td><span className="phase-label">{phaseLabels[item.currentPhase as keyof typeof phaseLabels] ?? item.currentPhase}</span></td><td><span className="status-chip">{item.status}</span></td><td>{item.pendingParticipant ?? 'None'}{item.currentAssigneeEmployeeNumber ? <small className="utility-text">{item.currentAssigneeEmployeeNumber}</small> : null}</td>
        <td><button className="table-action" type="button" onClick={() => openScorecard(item.id)}>Open {item.employeeName}<ArrowRight size={15} aria-hidden="true" /></button></td>
      </tr>)}</tbody>
    </table></div>;
  }

  if (loading && !user) {
    return <WorkflowLoader />;
  }

  if (!user) {
    return (
      <main className="login-shell">
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
              <span className="login-index utility-text">01 / TEST ACCESS</span>
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
                  required
                />
                <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Test Login'}<ArrowRight size={18} aria-hidden="true" /></button>
              </div>
            </form>
            {error && <p role="alert" className="error-message">{error}</p>}
            <div className="security-note"><ShieldCheck size={17} aria-hidden="true" /><p><strong>Development access</strong><span>Passwordless test identity for controlled development use only.</span></p></div>
          </div>
        </section>
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
            disabled={actionBusy}
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
          <button className="icon-button" type="button" disabled={actionBusy} onClick={logout} aria-label="Logout"><LogOut size={17} aria-hidden="true" /></button>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <div><span className="utility-text">Depa United Group</span><strong>Performance management system</strong></div>
          <div className="workspace-phase"><span>{phaseLabels[activePhase as keyof typeof phaseLabels] ?? activePhase}</span><small>Current phase</small></div>
        </header>
        <main className={`content ${screen === 'home' ? 'content-home' : ''}`}>
        {screen === 'home' && <section className="screen-section home-screen" aria-labelledby="home-title">
          <div className="screen-heading"><div><p className="eyebrow">Home / My PMS</p><h1 id="home-title">Welcome, {user.fullName}</h1><p>Your current record, ownership, and next workflow action.</p></div></div>
          <dl className="identity-card">
            <div><dt>Employee number</dt><dd className="utility-text">{user.employeeNumber}</dd></div>
            <div><dt>Department</dt><dd>{user.department ?? 'Not available'}</dd></div>
            <div><dt>Cycle position</dt><dd>{phaseLabels[activePhase as keyof typeof phaseLabels] ?? activePhase}</dd></div>
          </dl>
          <div className="content-panel"><div className="panel-heading"><div><span className="utility-text">2027 RECORD</span><h2>My submission</h2></div><span>{scorecards.filter((item) => item.employeeNumber === user.employeeNumber).length} record</span></div>
            {scorecardList(scorecards.filter((item) => item.employeeNumber === user.employeeNumber), 'No 2027 PMS submission has been generated for this employee yet.')}
          </div>
        </section>}

        {screen === 'team' && <section className="screen-section" aria-labelledby="team-title">
          <div className="screen-heading"><div><p className="eyebrow">Line Manager</p><h1 id="team-title">My Team</h1><p>Review direct reports and act when a submission is pending with you.</p></div></div>
          {scorecardList(scorecards.filter((item) => item.employeeNumber !== user.employeeNumber), 'No direct-report submissions are available.')}
        </section>}

        {screen === 'department' && <section className="screen-section" aria-labelledby="department-title">
          <div className="screen-heading"><div><p className="eyebrow">Department Head</p><h1 id="department-title">Department PMS</h1><p>{user.department ?? 'Your department'} submissions for the active 2027 cycle.</p></div></div>
          {scorecardList(scorecards.filter((item) => item.department === user.department), 'No department submissions are available.')}
        </section>}

        {screen === 'all' && <section className="screen-section" aria-labelledby="all-title">
          <div className="screen-heading"><div><p className="eyebrow">HR</p><h1 id="all-title">All 2027 Submissions</h1><p>Every generated scorecard in the current performance cycle.</p></div><span className="record-count utility-text">{scorecards.length.toString().padStart(2, '0')} RECORDS</span></div>
          {scorecardList(scorecards, 'No submissions have been generated.')}
        </section>}

        {screen === 'phase' && <section className="screen-section" aria-labelledby="phase-title">
          <div className="screen-heading"><div><p className="eyebrow">HR control</p><h1 id="phase-title">Phase Control</h1><p>Advance the cycle only after every eligible scorecard completes the current phase.</p></div></div>
          {cycle && <div className="phase-card"><div className="phase-card-top"><dl><div><dt>Cycle</dt><dd>{cycle.name}</dd></div><div><dt>Current phase</dt><dd>{cycle.current_phase}</dd></div><div><dt>Status</dt><dd><span className="status-chip">{cycle.status}</span></dd></div></dl>
            {cycle.current_phase !== 'Closed' && <button type="button" onClick={advancePhase}>Open next phase<ArrowRight size={17} aria-hidden="true" /></button>}</div>
            <PhaseSpine activePhase={cycle.current_phase} />
          </div>}
          {operationMessage && <p role="status" className="summary">{operationMessage}</p>}
        </section>}

        {screen === 'generate' && <section className="screen-section" aria-labelledby="generation-title">
          <div className="screen-heading"><div><p className="eyebrow">HR workspace</p><h1 id="generation-title">Create PMS Submissions</h1><p>Preview assignments first. Generate only rows that pass every assignment rule.</p></div></div>
          <div className="toolbar">
            <label htmlFor="department">Department<select id="department" value={department} onChange={(event) => setDepartment(event.target.value)}>
                {departments.map((item) => <option key={item}>{item}</option>)}
              </select></label>
            <button type="button" onClick={populate}>Populate<FilePlus2 size={16} aria-hidden="true" /></button>
            {population.length > 0 && <button className="secondary-action" type="button" onClick={generate} disabled={selected.length === 0}>Generate selected<ArrowRight size={16} aria-hidden="true" /></button>}
          </div>
          {summary && <p role="status" className="summary">{summary.created} Created · {summary.alreadyExisting} Already Exists · {summary.validationFailed} Validation Failed</p>}
          {population.length > 0 && <div className="table-scroll"><table className="data-table population-table">
            <thead><tr><th scope="col">Select</th><th scope="col">Employee</th><th scope="col">Grade</th><th scope="col">Employer / Classification</th><th scope="col">Department Head</th><th scope="col">RoleCategory</th><th scope="col">Manager</th><th scope="col">Form</th><th scope="col">Status</th></tr></thead>
            <tbody>{population.map((row) => <tr key={row.employeeNumber}>
              <td><input aria-label={`Select ${row.fullName}`} type="checkbox" disabled={row.status !== 'Ready'} checked={selected.includes(row.employeeNumber)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.employeeNumber] : selected.filter((number) => number !== row.employeeNumber))} /></td>
              <td><strong>{row.fullName}</strong><small className="utility-text">{row.employeeNumber}</small></td><td>{row.grade ?? 'Missing'}</td>
              <td>{row.employerClassification === 'NotApplicable' ? row.employer ?? 'Not applicable' : row.employerClassification}</td>
              <td>{row.departmentHeadStatus}</td><td>{row.roleCategory ?? 'Not applicable'}</td><td>{row.managerName ?? 'Missing'}</td>
              <td>{row.formType ? formNames[row.formType] : 'None'}</td><td><span className={`status status-${row.status === 'Ready' ? 'ready' : 'blocked'}`}>{row.status}</span></td>
            </tr>)}</tbody>
          </table></div>}
        </section>}

        {screen === 'mappings' && <section className="screen-section" aria-labelledby="mapping-title">
          <div className="screen-heading"><div><p className="eyebrow">Administration</p><h1 id="mapping-title">RoleCategory Mapping</h1><p>Classify eligible employees before HR generates their scorecards.</p></div></div>
          <form className="mapping-form content-panel" onSubmit={saveMapping}>
            <div className="mapping-field"><label htmlFor="mapping-employee">Employee Number</label><input id="mapping-employee" value={mappingEmployee} onChange={(event) => setMappingEmployee(event.target.value)} required /></div>
            <div className="mapping-field"><label htmlFor="role-category">RoleCategory</label><select id="role-category" value={roleCategory} onChange={(event) => setRoleCategory(event.target.value)}>
                <option value="ProjectDeliveryProfessional">Project Delivery / Professional</option>
                <option value="AdministrativeSupport">Administrative / Support</option>
              </select></div>
            <button type="submit">Save mapping<ArrowRight size={16} aria-hidden="true" /></button>
          </form>
          {operationMessage && <p role="status" className="summary">{operationMessage}</p>}
          <div className="table-scroll"><table className="data-table">
            <thead><tr><th scope="col">Employee Number</th><th scope="col">Department</th><th scope="col">RoleCategory</th></tr></thead>
            <tbody>{mappings.map((mapping) => <tr key={mapping.employee_number}><td>{mapping.employee_number}</td><td>{mapping.department}</td><td>{mapping.role_category}</td></tr>)}</tbody>
          </table></div>
        </section>}
        {screen === 'scorecard' && scorecardDetail && <ScorecardView
          scorecard={scorecardDetail}
          userEmployeeNumber={user.employeeNumber}
          strategyReferences={strategyReferences}
          busy={actionBusy}
          onAction={performScorecardAction}
        />}
        {error && <p role="alert" className="error-message">{error}</p>}
      </main>
      </div>
    </div>
  );
}
