import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScorecardView, type ScorecardDetail } from './ScorecardView.js';

afterEach(cleanup);

const line = {
  id: '1', perspective: 'Customer', performance_area: 'Quality', title: 'Deliver outcome',
  linked_strategy_reference_id: '1', measure_description: 'Completion', target: '100%', weight: '100.000',
  actual: null, mid_year_status: null, mid_year_comment: null, self_rating: null, employee_comment: null,
  manager_rating: null, manager_comment: null, employee_evidence_url: null, manager_evidence_url: null
};

function detail(formType: string, overrides: Partial<ScorecardDetail> = {}): ScorecardDetail {
  return {
    id: '10', employee_number: '18001', full_name: 'Dalia Leader', form_type: formType,
    current_phase: 'GoalSetting', status: 'InProgress', current_workflow_assignee_employee_number: '18001',
    current_assignee_name: 'Dalia Leader',
    pending_participant: 'Employee', lines: formType === 'AdministrativeSupport' ? [] : [line],
    standards: formType === 'AdministrativeSupport' ? [1, 2, 3, 4, 5, 6].map((id) => ({
      id: String(id), standard_name: `Standard ${id}`, expected_standard: 'Expected', weight: id === 1 ? '40' : id < 4 ? '15' : '10'
    })) : [],
    phaseStates: [{ phase: 'GoalSetting', requires_resubmission: false }],
    history: [{ id: '1', action: 'Created', phase: 'GoalSetting', action_by_employee_number: '12245', action_by_name: 'Hana Admin' }],
    overall_rating: null, employee_development_notes: null, manager_development_notes: null,
    ...overrides
  };
}

const references = [{ id: '1', title: 'Execution Excellence' }];

describe('the five form renderers', () => {
  it.each([
    ['DUGLeadership', 'DUG Leadership Scorecard', 'Perspective 1'],
    ['KBULeadership', 'KBU Leadership Scorecard', 'Perspective 1'],
    ['DepartmentHeadKPI', 'Department Heads / Senior Managers KPI Form', 'Objective / KPI 1'],
    ['ProjectDeliveryProfessionalKPI', 'Project Delivery / Professional KPI Form', 'Performance Area 1']
  ])('renders %s with its form-specific controls', async (formType, heading, control) => {
    render(<ScorecardView scorecard={detail(formType)} userEmployeeNumber="18001" strategyReferences={references} busy={false} onAction={vi.fn()} />);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(await screen.findByLabelText(control)).toBeInTheDocument();
    expect(screen.getByText('Total Weight: 100%')).toBeInTheDocument();
  });

  it('renders the six fixed Administrative / Support standards without Self Rating', () => {
    render(<ScorecardView scorecard={detail('AdministrativeSupport')} userEmployeeNumber="18001" strategyReferences={references} busy={false} onAction={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Administrative / Support Non-KPI Form' })).toBeInTheDocument();
    expect(screen.getAllByText(/Standard \d/)).toHaveLength(6);
    expect(screen.queryByLabelText(/Self Rating/)).not.toBeInTheDocument();
    expect(screen.getByText('Total Weight: 100%')).toBeInTheDocument();
  });
});

describe('Goal Setting controls and history', () => {
  it.each([
    ['DUGLeadership', 1],
    ['KBULeadership', 1],
    ['DepartmentHeadKPI', 4],
    ['ProjectDeliveryProfessionalKPI', 4]
  ])('starts a new %s form with its minimum row count', (formType, expectedCount) => {
    render(<ScorecardView scorecard={detail(formType, { lines: [] })} userEmployeeNumber="18001" strategyReferences={references} busy={false} onAction={vi.fn()} />);
    expect(screen.getAllByLabelText(/Objective \/ KPI \d+/)).toHaveLength(expectedCount);
    expect(screen.getByLabelText('Objective / KPI 1')).toHaveValue('');
  });

  it('marks fields required from the current participant without changing their accessible labels', () => {
    render(<ScorecardView scorecard={detail('DUGLeadership', { lines: [] })} userEmployeeNumber="18001" strategyReferences={references} busy={false} onAction={vi.fn()} />);
    const title = screen.getByLabelText('Objective / KPI 1');
    expect(title).toBeRequired();
    expect(title.closest('label')).toHaveTextContent('Objective / KPI*');
    expect(title.closest('label')?.querySelector('.required-mark')).toHaveAttribute('aria-hidden', 'true');
  });

  it('adds and removes employee rows and keeps the running total visible', async () => {
    render(<ScorecardView scorecard={detail('DUGLeadership')} userEmployeeNumber="18001" strategyReferences={references} busy={false} onAction={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add row' }));
    expect(screen.getByText('Total Weight: 100%')).toBeInTheDocument();
    expect(screen.getByLabelText('Objective / KPI 2')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Weight 2'), { target: { value: '20' } });
    expect(screen.getByText('Total Weight: 120%')).toBeInTheDocument();
    expect(screen.getByLabelText('Weight 2')).toHaveAttribute('step', '1');
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]!);
    expect(screen.queryByLabelText('Objective / KPI 2')).not.toBeInTheDocument();
  });

  it('locks employee plan controls while manager-pending and shows ordered history', async () => {
    render(<ScorecardView scorecard={detail('DUGLeadership', {
      current_workflow_assignee_employee_number: '30001', pending_participant: 'LineManager', status: 'PendingApproval',
      history: [
        { id: '1', action: 'Created', phase: 'GoalSetting', action_by_employee_number: '12245', action_by_name: 'Hana Admin' },
        { id: '2', action: 'Initiated', phase: 'GoalSetting', action_by_employee_number: '18001', action_by_name: 'Dalia Leader', comment: 'A long workflow comment',
          action_at: '2027-01-02T10:00:00.000Z', from_participant: 'Employee', to_participant: 'LineManager' }
      ]
    })} userEmployeeNumber="18001" strategyReferences={references} busy={false} onAction={vi.fn()} />);
    expect(await screen.findByLabelText('Objective / KPI 1')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add row' })).not.toBeInTheDocument();
    expect(screen.getByText('A long workflow comment')).toBeInTheDocument();
    expect(screen.getByText('Goal Setting · Dalia Leader')).toBeInTheDocument();
    expect(screen.queryByText(/18001/)).not.toBeInTheDocument();
    expect(screen.queryByText('Employee → Line Manager')).not.toBeInTheDocument();
    expect(document.querySelector('time')).toHaveAttribute('datetime', '2027-01-02T10:00:00.000Z');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Created'), expect.stringContaining('Initiated')
    ]);
  });

  it('shows a clear empty-history state', () => {
    render(<ScorecardView scorecard={detail('DUGLeadership', { history: [] })} userEmployeeNumber="18001" strategyReferences={references} busy={false} onAction={vi.fn()} />);
    expect(screen.getByText('No workflow history yet.')).toBeInTheDocument();
  });
});

describe('phase-specific ownership', () => {
  it('edits employee Mid-Year fields while keeping the manager assessment locked', async () => {
    render(<ScorecardView scorecard={detail('DUGLeadership', { current_phase: 'MidYear' })} userEmployeeNumber="18001" strategyReferences={references} busy={false} onAction={vi.fn()} />);
    expect(await screen.findByLabelText('Mid-Year Status 1')).toBeEnabled();
    expect(screen.getByLabelText('Mid-Year Comment 1')).toBeEnabled();
    expect(screen.getByLabelText('Manager Mid-Year Comment 1')).toBeDisabled();
  });

  it('separates employee and manager Year-End controls', async () => {
    const employeeView = render(<ScorecardView scorecard={detail('DUGLeadership', { current_phase: 'YearEnd' })} userEmployeeNumber="18001" strategyReferences={references} busy={false} onAction={vi.fn()} />);
    expect(await screen.findByLabelText('Self Rating 1')).toBeEnabled();
    expect(screen.getByLabelText('Manager Rating 1')).toBeDisabled();
    employeeView.unmount();

    render(<ScorecardView scorecard={detail('DUGLeadership', {
      current_phase: 'YearEnd', pending_participant: 'LineManager', current_workflow_assignee_employee_number: '30001'
    })} userEmployeeNumber="30001" strategyReferences={references} busy={false} onAction={vi.fn()} />);
    expect(await screen.findByLabelText('Self Rating 1')).toBeDisabled();
    expect(screen.getByLabelText('Manager Rating 1')).toBeEnabled();
  });

  it('separates employee and manager Development notes and locks read-only viewers', () => {
    const employeeView = render(<ScorecardView scorecard={detail('DUGLeadership', { current_phase: 'Development' })} userEmployeeNumber="18001" strategyReferences={references} busy={false} onAction={vi.fn()} />);
    expect(screen.getByLabelText('Employee Development Notes')).toBeEnabled();
    expect(screen.getByLabelText('Manager Development Notes')).toBeDisabled();
    employeeView.unmount();

    render(<ScorecardView scorecard={detail('DUGLeadership', {
      current_phase: 'Closed', pending_participant: null, current_workflow_assignee_employee_number: null, status: 'Closed',
      employee_development_notes: 'Complete the leadership programme',
      manager_development_notes: 'Quarterly leadership coaching'
    })} userEmployeeNumber="12245" strategyReferences={references} busy={false} onAction={vi.fn()} />);
    expect(screen.getByLabelText('Employee Development Notes')).toBeDisabled();
    expect(screen.getByLabelText('Employee Development Notes')).toHaveValue('Complete the leadership programme');
    expect(screen.getByLabelText('Manager Development Notes')).toBeDisabled();
    expect(screen.getByLabelText('Manager Development Notes')).toHaveValue('Quarterly leadership coaching');
    expect(screen.queryByRole('button', { name: 'Save as Draft' })).not.toBeInTheDocument();
  });
});
