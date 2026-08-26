import { type FormEvent, useEffect, useState } from 'react';
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

  async function api<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', ...options });
    const result = response.status === 204 ? null : await response.json() as T & { error?: { message: string } };
    if (!response.ok) throw new Error(result?.error?.message ?? 'Request failed');
    return result as T;
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

  function scorecardList(items: ScorecardSummary[], emptyMessage: string) {
    if (items.length === 0) return <p>{emptyMessage}</p>;
    return <div className="table-scroll"><table>
      <thead><tr><th scope="col">Employee</th><th scope="col">Form</th><th scope="col">Phase</th><th scope="col">Status</th><th scope="col">Pending participant</th><th scope="col">Action</th></tr></thead>
      <tbody>{items.map((item) => <tr key={item.id}>
        <td>{item.employeeName}<small>{item.employeeNumber}</small></td><td>{formNames[item.formType] ?? item.formType}</td>
        <td>{item.currentPhase}</td><td>{item.status}</td><td>{item.pendingParticipant ?? 'None'}{item.currentAssigneeEmployeeNumber ? <small>{item.currentAssigneeEmployeeNumber}</small> : null}</td>
        <td><button type="button" onClick={() => openScorecard(item.id)}>Open {item.employeeName}</button></td>
      </tr>)}</tbody>
    </table></div>;
  }

  if (loading && !user) {
    return <main className="page-shell"><p role="status">Loading PMS...</p></main>;
  }

  if (!user) {
    return (
      <main className="page-shell">
        <section className="welcome-card" aria-labelledby="page-title">
          <p className="eyebrow">Depa United Group</p>
          <h1 id="page-title">PMS 2027</h1>
          <p>Enter a valid employee number to use the development test login.</p>
          <form onSubmit={login}>
            <label htmlFor="employee-number">Employee Number</label>
            <input
              id="employee-number"
              name="employeeNumber"
              value={employeeNumber}
              onChange={(event) => setEmployeeNumber(event.target.value)}
              autoComplete="username"
              required
            />
            <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Test Login'}</button>
          </form>
          {error && <p role="alert" className="error-message">{error}</p>}
          <p className="security-note">Passwordless test identity for controlled development use only.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header>
        <div><span className="brand-mark">PMS</span><span>2027</span></div>
        <nav aria-label="Primary navigation">
          <button className="nav-button" type="button" disabled={actionBusy} onClick={() => openScreen('home')}>My PMS</button>
          {user.isManager && <button className="nav-button" type="button" disabled={actionBusy} onClick={() => openScreen('team')}>My Team</button>}
          {user.departmentHeadStatus === 'Head' && <button className="nav-button" type="button" disabled={actionBusy} onClick={() => openScreen('department')}>Department PMS</button>}
          {user.isHrAdmin && <button className="nav-button" type="button" disabled={actionBusy} onClick={() => openScreen('generate')}>Create PMS Submissions</button>}
          {user.isHrAdmin && <button className="nav-button" type="button" disabled={actionBusy} onClick={() => openScreen('all')}>All 2027 Submissions</button>}
          {user.isHrAdmin && <button className="nav-button" type="button" disabled={actionBusy} onClick={() => openScreen('phase')}>Phase Control</button>}
          {(user.isHrAdmin || user.departmentHeadStatus === 'Head') && <button className="nav-button" type="button" disabled={actionBusy} onClick={() => openScreen('mappings')}>RoleCategory Mapping</button>}
        </nav>
        <button className="secondary-button" type="button" disabled={actionBusy} onClick={logout}>Logout</button>
      </header>
      <main className="content">
        {screen === 'home' && <>
          <p className="eyebrow">Home / My PMS</p>
          <h1>Welcome, {user.fullName}</h1>
          <dl className="identity-card">
            <div><dt>Employee Number</dt><dd>{user.employeeNumber}</dd></div>
            <div><dt>Department</dt><dd>{user.department ?? 'Not available'}</dd></div>
            <div><dt>Access</dt><dd>{user.isHrAdmin ? 'HR Admin' : user.isItAdmin ? 'IT System Admin' : user.departmentHeadStatus === 'Head' ? 'Department Head' : user.isManager ? 'Line Manager' : 'Employee'}</dd></div>
          </dl>
          {scorecardList(scorecards.filter((item) => item.employeeNumber === user.employeeNumber), 'No 2027 PMS submission has been generated for this employee yet.')}
        </>}

        {screen === 'team' && <section aria-labelledby="team-title">
          <p className="eyebrow">Line Manager</p><h1 id="team-title">My Team</h1>
          {scorecardList(scorecards.filter((item) => item.employeeNumber !== user.employeeNumber), 'No direct-report submissions are available.')}
        </section>}

        {screen === 'department' && <section aria-labelledby="department-title">
          <p className="eyebrow">Department Head</p><h1 id="department-title">Department PMS</h1>
          {scorecardList(scorecards.filter((item) => item.department === user.department), 'No department submissions are available.')}
        </section>}

        {screen === 'all' && <section aria-labelledby="all-title">
          <p className="eyebrow">HR</p><h1 id="all-title">All 2027 Submissions</h1>
          {scorecardList(scorecards, 'No submissions have been generated.')}
        </section>}

        {screen === 'phase' && <section aria-labelledby="phase-title">
          <p className="eyebrow">HR</p><h1 id="phase-title">Phase Control</h1>
          {cycle && <div className="phase-card"><dl><div><dt>Cycle</dt><dd>{cycle.name}</dd></div><div><dt>Current phase</dt><dd>{cycle.current_phase}</dd></div><div><dt>Status</dt><dd>{cycle.status}</dd></div></dl>
            {cycle.current_phase !== 'Closed' && <button type="button" onClick={advancePhase}>Open next phase</button>}
          </div>}
          {operationMessage && <p role="status" className="summary">{operationMessage}</p>}
        </section>}

        {screen === 'generate' && <section aria-labelledby="generation-title">
          <p className="eyebrow">HR</p>
          <h1 id="generation-title">Create PMS Submissions</h1>
          <div className="toolbar">
            <label htmlFor="department">Department</label>
            <select id="department" value={department} onChange={(event) => setDepartment(event.target.value)}>
              {departments.map((item) => <option key={item}>{item}</option>)}
            </select>
            <button type="button" onClick={populate}>Populate</button>
            {population.length > 0 && <button type="button" onClick={generate} disabled={selected.length === 0}>Generate selected</button>}
          </div>
          {summary && <p role="status" className="summary">{summary.created} Created · {summary.alreadyExisting} Already Exists · {summary.validationFailed} Validation Failed</p>}
          {population.length > 0 && <div className="table-scroll"><table>
            <thead><tr><th scope="col">Select</th><th scope="col">Employee</th><th scope="col">Grade</th><th scope="col">Employer / Classification</th><th scope="col">Department Head</th><th scope="col">RoleCategory</th><th scope="col">Manager</th><th scope="col">Form</th><th scope="col">Status</th></tr></thead>
            <tbody>{population.map((row) => <tr key={row.employeeNumber}>
              <td><input aria-label={`Select ${row.fullName}`} type="checkbox" disabled={row.status !== 'Ready'} checked={selected.includes(row.employeeNumber)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.employeeNumber] : selected.filter((number) => number !== row.employeeNumber))} /></td>
              <td>{row.fullName}<small>{row.employeeNumber}</small></td><td>{row.grade ?? 'Missing'}</td>
              <td>{row.employerClassification === 'NotApplicable' ? row.employer ?? 'Not applicable' : row.employerClassification}</td>
              <td>{row.departmentHeadStatus}</td><td>{row.roleCategory ?? 'Not applicable'}</td><td>{row.managerName ?? 'Missing'}</td>
              <td>{row.formType ? formNames[row.formType] : 'None'}</td><td><span className={`status status-${row.status === 'Ready' ? 'ready' : 'blocked'}`}>{row.status}</span></td>
            </tr>)}</tbody>
          </table></div>}
        </section>}

        {screen === 'mappings' && <section aria-labelledby="mapping-title">
          <p className="eyebrow">Administration</p>
          <h1 id="mapping-title">RoleCategory Mapping</h1>
          <form className="mapping-form" onSubmit={saveMapping}>
            <label htmlFor="mapping-employee">Employee Number</label>
            <input id="mapping-employee" value={mappingEmployee} onChange={(event) => setMappingEmployee(event.target.value)} required />
            <label htmlFor="role-category">RoleCategory</label>
            <select id="role-category" value={roleCategory} onChange={(event) => setRoleCategory(event.target.value)}>
              <option value="ProjectDeliveryProfessional">Project Delivery / Professional</option>
              <option value="AdministrativeSupport">Administrative / Support</option>
            </select>
            <button type="submit">Save mapping</button>
          </form>
          {operationMessage && <p role="status" className="summary">{operationMessage}</p>}
          <div className="table-scroll"><table>
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
  );
}
