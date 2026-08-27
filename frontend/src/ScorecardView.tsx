import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Plus, RotateCcw, Save, Send, Trash2, X } from 'lucide-react';

export interface ScorecardDetail {
  id: string;
  employee_number: string;
  full_name: string;
  form_type: string;
  current_phase: string;
  status: string;
  current_workflow_assignee_employee_number: string | null;
  pending_participant: 'Employee' | 'LineManager' | null;
  lines: Array<Record<string, unknown>>;
  standards: Array<Record<string, unknown>>;
  phaseStates: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
  overall_rating: string | null;
  employee_development_notes?: string | null;
  manager_development_notes?: string | null;
}

export interface WorkLine {
  id?: string;
  perspective: string;
  performanceArea: string;
  title: string;
  linkedStrategyReferenceId: string;
  measureDescription: string;
  target: string;
  weight: number | null;
  actual: string;
  midYearStatus: string;
  midYearComment: string;
  selfRating: number | null;
  employeeComment: string;
  managerRating: number | null;
  managerComment: string;
  employeeEvidenceUrl: string;
  managerEvidenceUrl: string;
}

interface WorkStandard {
  id: string;
  standardName: string;
  expectedStandard: string;
  weight: number;
  employeeComment: string;
  employeeEvidenceUrl: string;
  managerRating: number | null;
  managerComment: string;
  managerEvidenceUrl: string;
}

interface Props {
  scorecard: ScorecardDetail;
  userEmployeeNumber: string;
  strategyReferences: Array<{ id: string; title: string }>;
  busy: boolean;
  onAction: (action: string, payload: Record<string, unknown>) => Promise<void>;
}

const formNames: Record<string, string> = {
  DUGLeadership: 'DUG Leadership Scorecard', KBULeadership: 'KBU Leadership Scorecard',
  DepartmentHeadKPI: 'Department Heads / Senior Managers KPI Form',
  ProjectDeliveryProfessionalKPI: 'Project Delivery / Professional KPI Form',
  AdministrativeSupport: 'Administrative / Support Non-KPI Form'
};

const options: Record<string, string[]> = {
  DUGLeadership: ['Customer', 'Financials', 'People & Culture', 'Strategic Initiatives'],
  KBULeadership: ['Business Development', 'Backlog & New Awards', 'Projects', 'Financials', 'Strategic Initiatives'],
  ProjectDeliveryProfessionalKPI: ['Project / Delivery', 'Cost / Productivity', 'Quality', 'Schedule / Milestones', 'Customer / Stakeholder', 'Technical / Functional']
};

const emptyLine = (): WorkLine => ({
  perspective: '', performanceArea: '', title: '', linkedStrategyReferenceId: '', measureDescription: '', target: '', weight: null,
  actual: '', midYearStatus: '', midYearComment: '', selfRating: null, employeeComment: '', managerRating: null,
  managerComment: '', employeeEvidenceUrl: '', managerEvidenceUrl: ''
});

function fromServer(line: Record<string, unknown>): WorkLine {
  return {
    ...emptyLine(), id: String(line.id), perspective: String(line.perspective ?? ''),
    performanceArea: String(line.performance_area ?? ''), title: String(line.title ?? ''),
    linkedStrategyReferenceId: String(line.linked_strategy_reference_id ?? ''),
    measureDescription: String(line.measure_description ?? ''), target: String(line.target ?? ''),
    weight: line.weight === null ? null : Number(line.weight), actual: String(line.actual ?? ''),
    midYearStatus: String(line.mid_year_status ?? ''), midYearComment: String(line.mid_year_comment ?? ''),
    selfRating: line.self_rating === null ? null : Number(line.self_rating), employeeComment: String(line.employee_comment ?? ''),
    managerRating: line.manager_rating === null ? null : Number(line.manager_rating), managerComment: String(line.manager_comment ?? ''),
    employeeEvidenceUrl: String(line.employee_evidence_url ?? ''), managerEvidenceUrl: String(line.manager_evidence_url ?? '')
  };
}

function actionTime(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function readableLabel(value: unknown): string {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\bKpi\b/gi, 'KPI')
    .replace(/\bDug\b/gi, 'DUG')
    .replace(/\bKbu\b/gi, 'KBU');
}

function ActionLoader() {
  return <div className="loading-panel request-loader" role="status" aria-live="polite">
    <div className="workflow-loader" aria-hidden="true">{[1, 2, 3, 4, 5].map((stage) => <span key={stage} />)}</div>
    <p className="loading-message">Updating submission</p>
  </div>;
}

export function ScorecardView({ scorecard, userEmployeeNumber, strategyReferences, busy, onAction }: Props) {
  const [lines, setLines] = useState<WorkLine[]>([]);
  const [standards, setStandards] = useState<WorkStandard[]>([]);
  const [comment, setComment] = useState('');
  const [employeeDevelopmentNotes, setEmployeeDevelopmentNotes] = useState('');
  const [managerDevelopmentNotes, setManagerDevelopmentNotes] = useState('');
  useEffect(() => {
    setLines(scorecard.lines.map(fromServer));
    setStandards(scorecard.standards.map((standard) => ({
      id: String(standard.id), standardName: String(standard.standard_name), expectedStandard: String(standard.expected_standard),
      weight: Number(standard.weight), employeeComment: String(standard.employee_comment ?? ''),
      employeeEvidenceUrl: String(standard.employee_evidence_url ?? ''),
      managerRating: standard.manager_rating === null ? null : Number(standard.manager_rating),
      managerComment: String(standard.manager_comment ?? ''), managerEvidenceUrl: String(standard.manager_evidence_url ?? '')
    })));
    setEmployeeDevelopmentNotes(scorecard.employee_development_notes ?? '');
    setManagerDevelopmentNotes(scorecard.manager_development_notes ?? '');
  }, [scorecard]);
  const employeePending = scorecard.pending_participant === 'Employee' && scorecard.current_workflow_assignee_employee_number === userEmployeeNumber;
  const managerPending = scorecard.pending_participant === 'LineManager' && scorecard.current_workflow_assignee_employee_number === userEmployeeNumber;
  const editablePlan = employeePending && (scorecard.current_phase === 'GoalSetting' || scorecard.current_phase === 'MidYear') && scorecard.form_type !== 'AdministrativeSupport';
  const employeeYearEnd = employeePending && scorecard.current_phase === 'YearEnd';
  const managerYearEnd = managerPending && scorecard.current_phase === 'YearEnd';
  const totalWeight = useMemo(() => {
    const values = scorecard.form_type === 'AdministrativeSupport' ? standards.map((item) => item.weight) : lines.map((line) => line.weight ?? 0);
    return values.reduce((sum, weight) => sum + weight, 0);
  }, [lines, scorecard.form_type, standards]);
  const currentPhaseState = scorecard.phaseStates.find((state) => state.phase === scorecard.current_phase);

  function change(index: number, field: keyof WorkLine, value: string | number | null) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line));
  }

  function changeStandard(index: number, field: keyof WorkStandard, value: string | number | null) {
    setStandards((current) => current.map((standard, standardIndex) => standardIndex === index ? { ...standard, [field]: value } : standard));
  }

  function payload() {
    if (employeePending && scorecard.form_type !== 'AdministrativeSupport' && (scorecard.current_phase === 'GoalSetting' || scorecard.current_phase === 'MidYear')) {
      return { lines: lines.map((line) => ({
        ...(line.id ? { id: line.id } : {}),
        ...(scorecard.form_type === 'DUGLeadership' || scorecard.form_type === 'KBULeadership' ? { perspective: line.perspective || null } : {}),
        ...(scorecard.form_type === 'ProjectDeliveryProfessionalKPI' ? { performanceArea: line.performanceArea || null } : {}),
        title: line.title || null, linkedStrategyReferenceId: line.linkedStrategyReferenceId || null,
        measureDescription: line.measureDescription || null, target: line.target || null, weight: line.weight,
        ...(scorecard.current_phase === 'MidYear'
          ? { midYearStatus: line.midYearStatus || null, midYearComment: line.midYearComment || null } : {})
      })) };
    }
    if (managerPending && scorecard.current_phase === 'MidYear' && scorecard.form_type !== 'AdministrativeSupport') {
      return { lines: lines.map((line) => ({ id: line.id, managerComment: line.managerComment || null })) };
    }
    if (scorecard.current_phase === 'YearEnd' && scorecard.form_type !== 'AdministrativeSupport') {
      return { lines: lines.map((line) => employeePending ? {
        id: line.id, actual: line.actual || null, selfRating: line.selfRating,
        employeeComment: line.employeeComment || null, employeeEvidenceUrl: line.employeeEvidenceUrl || null
      } : {
        id: line.id, managerRating: line.managerRating, managerComment: line.managerComment || null,
        managerEvidenceUrl: line.managerEvidenceUrl || null
      }) };
    }
    if (scorecard.current_phase === 'YearEnd' && scorecard.form_type === 'AdministrativeSupport') {
      return { standards: standards.map((standard) => employeePending ? {
        id: standard.id, employeeComment: standard.employeeComment || null, employeeEvidenceUrl: standard.employeeEvidenceUrl || null
      } : {
        id: standard.id, managerRating: standard.managerRating, managerComment: standard.managerComment || null,
        managerEvidenceUrl: standard.managerEvidenceUrl || null
      }) };
    }
    if (scorecard.current_phase === 'Development') {
      return employeePending ? { employeeDevelopmentNotes } : { managerDevelopmentNotes };
    }
    return {};
  }

  async function act(action: string) {
    await onAction(action, { comment, ...payload() });
    setComment('');
  }

  return <section className="scorecard-page" aria-labelledby="scorecard-title">
    <header className="scorecard-heading">
      <div><p className="eyebrow">{scorecard.current_phase.replace(/([a-z])([A-Z])/g, '$1 $2')}</p><h1 id="scorecard-title">{formNames[scorecard.form_type]}</h1>
        <div className="scorecard-context"><span className="scorecard-record">{scorecard.full_name} · <strong>{readableLabel(scorecard.status)}</strong></span>{scorecard.pending_participant && <span>Pending with {scorecard.pending_participant === 'LineManager' ? 'line manager' : 'employee'}</span>}</div>
      </div>
      <div className="scorecard-metrics">
        {scorecard.overall_rating !== null && <p className="overall-rating"><span>Overall Rating: {Number(scorecard.overall_rating).toFixed(1)}</span><small>Final manager score · 5.0 scale</small></p>}
        <p className={`weight-total ${totalWeight === 100 ? 'weight-valid' : ''}`}><span>Total Weight: {totalWeight}%</span><small>{totalWeight === 100 ? 'Ready to submit' : 'Must equal 100%'}</small></p>
      </div>
    </header>

    {scorecard.form_type === 'AdministrativeSupport' ? <div className="table-scroll"><table className="data-table scorecard-table">
      <thead><tr><th>Performance Standard</th><th>Expected Standard</th><th>Weight</th>{scorecard.current_phase === 'YearEnd' && <><th>Employee review</th><th>Manager review</th></>}</tr></thead>
      <tbody>{standards.map((standard, index) => <tr key={standard.id}><td>{standard.standardName}</td><td>{standard.expectedStandard}</td><td>{standard.weight}%</td>
        {scorecard.current_phase === 'YearEnd' && <><td><label>Employee Comment<textarea aria-label={`Employee Comment ${index + 1}`} disabled={!employeeYearEnd} required={employeeYearEnd} value={standard.employeeComment} onChange={(event) => changeStandard(index, 'employeeComment', event.target.value)} /></label><label>Employee Evidence Reference<input aria-label={`Employee Evidence Reference ${index + 1}`} disabled={!employeeYearEnd} value={standard.employeeEvidenceUrl} onChange={(event) => changeStandard(index, 'employeeEvidenceUrl', event.target.value)} /></label></td>
          <td><label>Manager Rating<select aria-label={`Manager Rating ${index + 1}`} disabled={!managerYearEnd} required={managerYearEnd} value={standard.managerRating ?? ''} onChange={(event) => changeStandard(index, 'managerRating', event.target.value ? Number(event.target.value) : null)}><option value="">Select</option>{[1, 2, 3, 4, 5].map((rating) => <option key={rating}>{rating}</option>)}</select></label><label>Manager Comment<textarea aria-label={`Manager Comment ${index + 1}`} disabled={!managerYearEnd} required={managerYearEnd} value={standard.managerComment} onChange={(event) => changeStandard(index, 'managerComment', event.target.value)} /></label><label>Manager Evidence Reference<input aria-label={`Manager Evidence Reference ${index + 1}`} disabled={!managerYearEnd} required={managerYearEnd && (standard.managerRating ?? 0) >= 4} value={standard.managerEvidenceUrl} onChange={(event) => changeStandard(index, 'managerEvidenceUrl', event.target.value)} /></label></td></>}
      </tr>)}</tbody>
    </table></div> : <div className="form-lines">
      {lines.map((line, index) => <fieldset className="scorecard-fieldset" key={`${line.id ?? 'new'}-${index}`}>
        <legend><span className="utility-text">{String(index + 1).padStart(2, '0')}</span>{scorecard.form_type.includes('Leadership') ? 'Objective' : 'KPI'} {index + 1}</legend>
        {(scorecard.form_type === 'DUGLeadership' || scorecard.form_type === 'KBULeadership') && <label>Perspective<select aria-label={`Perspective ${index + 1}`} disabled={!editablePlan} required={editablePlan} value={line.perspective} onChange={(event) => change(index, 'perspective', event.target.value)}><option value="">Select</option>{options[scorecard.form_type].map((item) => <option key={item}>{item}</option>)}</select></label>}
        {scorecard.form_type === 'ProjectDeliveryProfessionalKPI' && <label>Performance Area<select aria-label={`Performance Area ${index + 1}`} disabled={!editablePlan} required={editablePlan} value={line.performanceArea} onChange={(event) => change(index, 'performanceArea', event.target.value)}><option value="">Select</option>{options.ProjectDeliveryProfessionalKPI.map((item) => <option key={item}>{item}</option>)}</select></label>}
        <label>Objective / KPI<input aria-label={`Objective / KPI ${index + 1}`} disabled={!editablePlan} required={editablePlan} value={line.title} onChange={(event) => change(index, 'title', event.target.value)} /></label>
        <label>Linked Strategy Reference<select aria-label={`Linked Strategy Reference ${index + 1}`} disabled={!editablePlan} required={editablePlan} value={line.linkedStrategyReferenceId} onChange={(event) => change(index, 'linkedStrategyReferenceId', event.target.value)}><option value="">Select</option>{strategyReferences.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label>Measure<input aria-label={`Measure ${index + 1}`} disabled={!editablePlan} required={editablePlan} value={line.measureDescription} onChange={(event) => change(index, 'measureDescription', event.target.value)} /></label>
        <label>Target<input aria-label={`Target ${index + 1}`} disabled={!editablePlan} required={editablePlan} value={line.target} onChange={(event) => change(index, 'target', event.target.value)} /></label>
        <label>Weight<input aria-label={`Weight ${index + 1}`} disabled={!editablePlan} required={editablePlan} type="number" min="1" max="100" step="1" value={line.weight ?? ''} onChange={(event) => change(index, 'weight', event.target.value === '' ? null : Number(event.target.value))} /></label>
        {scorecard.current_phase === 'MidYear' && <>
          <label>Mid-Year Status<select aria-label={`Mid-Year Status ${index + 1}`} disabled={!editablePlan} required={editablePlan} value={line.midYearStatus} onChange={(event) => change(index, 'midYearStatus', event.target.value)}><option value="">Select</option><option value="OnTrack">On Track</option><option value="AtRisk">At Risk</option><option value="Blocked">Blocked</option></select></label>
          <label>Mid-Year Comment<textarea aria-label={`Mid-Year Comment ${index + 1}`} disabled={!editablePlan} required={editablePlan} value={line.midYearComment} onChange={(event) => change(index, 'midYearComment', event.target.value)} /></label>
          <label>Manager Mid-Year Comment<textarea aria-label={`Manager Mid-Year Comment ${index + 1}`} disabled={!managerPending} required={managerPending} value={line.managerComment} onChange={(event) => change(index, 'managerComment', event.target.value)} /></label>
        </>}
        {scorecard.current_phase === 'YearEnd' && <>
          <label>Actual<input aria-label={`Actual ${index + 1}`} disabled={!employeeYearEnd} required={employeeYearEnd} value={line.actual} onChange={(event) => change(index, 'actual', event.target.value)} /></label>
          <label>Self Rating<select aria-label={`Self Rating ${index + 1}`} disabled={!employeeYearEnd} required={employeeYearEnd} value={line.selfRating ?? ''} onChange={(event) => change(index, 'selfRating', event.target.value ? Number(event.target.value) : null)}><option value="">Select</option>{[1, 2, 3, 4, 5].map((rating) => <option key={rating}>{rating}</option>)}</select></label>
          <label>Employee Comment<textarea aria-label={`Employee Comment ${index + 1}`} disabled={!employeeYearEnd} required={employeeYearEnd} value={line.employeeComment} onChange={(event) => change(index, 'employeeComment', event.target.value)} /></label>
          <label>Employee Evidence Reference<input aria-label={`Employee Evidence Reference ${index + 1}`} disabled={!employeeYearEnd} required={employeeYearEnd && (line.selfRating ?? 0) >= 4} value={line.employeeEvidenceUrl} onChange={(event) => change(index, 'employeeEvidenceUrl', event.target.value)} /></label>
          <label>Manager Rating<select aria-label={`Manager Rating ${index + 1}`} disabled={!managerYearEnd} required={managerYearEnd} value={line.managerRating ?? ''} onChange={(event) => change(index, 'managerRating', event.target.value ? Number(event.target.value) : null)}><option value="">Select</option>{[1, 2, 3, 4, 5].map((rating) => <option key={rating}>{rating}</option>)}</select></label>
          <label>Manager Comment<textarea aria-label={`Manager Comment ${index + 1}`} disabled={!managerYearEnd} required={managerYearEnd} value={line.managerComment} onChange={(event) => change(index, 'managerComment', event.target.value)} /></label>
          <label>Manager Evidence Reference<input aria-label={`Manager Evidence Reference ${index + 1}`} disabled={!managerYearEnd} required={managerYearEnd && (line.managerRating ?? 0) >= 4} value={line.managerEvidenceUrl} onChange={(event) => change(index, 'managerEvidenceUrl', event.target.value)} /></label>
        </>}
        {editablePlan && <button className="remove-button" type="button" onClick={() => setLines(lines.filter((_, lineIndex) => lineIndex !== index))}><Trash2 size={15} aria-hidden="true" />Remove row {index + 1}</button>}
      </fieldset>)}
      {editablePlan && <button className="add-row-button" type="button" onClick={() => setLines([...lines, emptyLine()])}><Plus size={17} aria-hidden="true" />Add row</button>}
    </div>}

    {scorecard.current_phase === 'Development' && <div className="development-fields">
      <label>Employee Development Notes<textarea disabled={!employeePending} required={employeePending} value={employeeDevelopmentNotes} onChange={(event) => setEmployeeDevelopmentNotes(event.target.value)} /></label>
      <label>Manager Development Notes<textarea disabled={!managerPending} required={managerPending} value={managerDevelopmentNotes} onChange={(event) => setManagerDevelopmentNotes(event.target.value)} /></label>
    </div>}

    {(employeePending || managerPending) && <div className="workflow-actions">
      <div className="workflow-heading"><div><span className="utility-text">NEXT ACTION</span><h2>{managerPending ? 'Manager decision' : 'Complete your submission'}</h2></div><span className="status-chip">Pending with you</span></div>
      <label htmlFor="workflow-comment">Workflow comment<textarea id="workflow-comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder={managerPending ? 'Add a review comment. Give a reason when rejecting.' : 'Optional comment'} /></label>
      <div className="workflow-buttons">
        <button className="secondary-action" type="button" disabled={busy} onClick={() => act('SavedDraft')}><Save size={16} aria-hidden="true" />Save as Draft</button>
        {employeePending && <button type="button" disabled={busy} onClick={() => act(currentPhaseState?.requires_resubmission ? 'Resubmitted' : 'Initiated')}>{currentPhaseState?.requires_resubmission ? <RotateCcw size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}{currentPhaseState?.requires_resubmission ? 'Resubmit' : 'Initiate'}</button>}
        {managerPending && <><button type="button" disabled={busy} onClick={() => act('Approved')}><Check size={16} aria-hidden="true" />Approve</button><button className="reject-button" type="button" disabled={busy} onClick={() => act('Rejected')}><X size={16} aria-hidden="true" />Reject</button></>}
      </div>
      {busy && <ActionLoader />}
    </div>}

    <section aria-labelledby="history-title" className="history"><div className="history-heading"><div><span className="utility-text">AUDIT TRAIL</span><h2 id="history-title">Workflow history</h2></div><Clock3 size={19} aria-hidden="true" /></div>
      {scorecard.history.length === 0 ? <p>No workflow history yet.</p> : <ol>{scorecard.history.map((entry) => {
        const timestamp = actionTime(entry.action_at);
        return <li key={String(entry.id)}><span className="history-node" aria-hidden="true" />
          <div><strong>{readableLabel(entry.action)}</strong><span>{readableLabel(entry.phase)} · {String(entry.action_by_employee_number)}</span>
          {timestamp ? <time dateTime={String(entry.action_at)}>{timestamp}</time> : null}
          {entry.comment ? <p>{String(entry.comment)}</p> : null}
          </div>
        </li>;
      })}</ol>}
    </section>
  </section>;
}
