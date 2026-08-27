import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('App', () => {
  it('shows test login when there is no restored session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Test Login' })).toBeInTheDocument();
    expect(document.querySelector('.login-index')).not.toBeInTheDocument();
    expect(document.querySelector('.security-note')).not.toBeInTheDocument();
  });

  it('logs in and renders server-derived identity', async () => {
    const currentUser = {
      employeeNumber: '12245', fullName: 'Hana Admin', department: 'Human Resources',
      isHrAdmin: true, isItAdmin: false, isManager: false, departmentHeadStatus: 'NotHead'
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ user: currentUser }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ scorecards: [] }) }));
    render(<App />);
    fireEvent.change(await screen.findByLabelText('Employee Number'), { target: { value: '12245' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test Login' }));
    expect(await screen.findByRole('heading', { name: 'Welcome, Hana Admin' })).toBeInTheDocument();
    expect(screen.getByText('HR Admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create PMS Submissions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Role Category Mapping' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument();
    expect(document.querySelector('.app-shell')).toHaveClass('navigation-collapsed');
    expect(window.localStorage.getItem('pms-navigation-collapsed')).toBe('true');
  });

  it('reuses page data from memory when revisiting screens', async () => {
    const user = {
      employeeNumber: '12245', fullName: 'Hana Admin', department: 'Human Resources',
      isHrAdmin: true, isItAdmin: false, isManager: false, departmentHeadStatus: 'NotHead'
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/session')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ user }) });
      if (url.endsWith('/scorecards')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ scorecards: [] }) });
      if (url.endsWith('/cycle')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ cycle: { year: 2027, name: 'PMS 2027', status: 'Active', current_phase: 'GoalSetting' } }) });
      if (url.endsWith('/hr/departments')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ departments: ['Delivery'] }) });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Welcome, Hana Admin' })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/scorecards'))).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'Phase Control' }));
    expect(await screen.findByRole('button', { name: 'Open next phase' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create PMS Submissions' }));
    expect(await screen.findByLabelText('Department')).toHaveValue('Delivery');
    fireEvent.click(screen.getByRole('button', { name: 'Phase Control' }));
    expect(await screen.findByRole('button', { name: 'Open next phase' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create PMS Submissions' }));
    expect(await screen.findByLabelText('Department')).toHaveValue('Delivery');

    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/cycle'))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/hr/departments'))).toHaveLength(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders the HR Populate preview with form and validation results', async () => {
    const user = {
      employeeNumber: '12245', fullName: 'Hana Admin', department: 'Human Resources',
      isHrAdmin: true, isItAdmin: false, isManager: false, departmentHeadStatus: 'NotHead'
    };
    const rows = [
      { employeeNumber: '18001', fullName: 'Dalia Leader', grade: 18, employer: 'DUG Corporate', employerClassification: 'DUG', departmentHeadStatus: 'NotApplicable', departmentHeadName: 'Noura Head', roleCategory: null, managerName: 'Mariam Manager', formType: 'DUGLeadership', status: 'Ready' },
      { employeeNumber: '17005', fullName: 'Noor NoManager', grade: 17, employer: 'DUG Corporate', employerClassification: 'NotApplicable', departmentHeadStatus: 'NotHead', departmentHeadName: 'Noura Head', roleCategory: null, managerName: null, formType: null, status: 'Missing Manager' }
    ];
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ user }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ scorecards: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ departments: ['Delivery'] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ rows }) }));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create PMS Submissions' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Populate' }));
    expect(await screen.findByText('DUG Leadership Scorecard')).toBeInTheDocument();
    expect(screen.getAllByText('Noura Head')).toHaveLength(2);
    expect(screen.getByText('Missing Manager')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Noor NoManager')).toBeDisabled();
  });

  it('auto-loads the only department for a Department Head mapping worklist', async () => {
    const user = {
      employeeNumber: '17001', fullName: 'Noura Head', department: 'Delivery',
      isHrAdmin: false, isItAdmin: false, isManager: true, departmentHeadStatus: 'Head'
    };
    const employees = [
      { employeeNumber: '17001', fullName: 'Noura Head', department: 'Delivery', grade: 17, mappingRequired: false, mappingNote: 'Department Head form', roleCategory: null },
      { employeeNumber: '17002', fullName: 'Peter Professional', department: 'Delivery', grade: 17, mappingRequired: true, mappingNote: 'Mapping required', roleCategory: 'ProjectDeliveryProfessional' }
    ];
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ user }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ scorecards: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ departments: ['Delivery'] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ employees }) }));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Role Category Mapping' }));
    expect(await screen.findByRole('table')).toHaveTextContent('Peter Professional');
    expect(screen.getByLabelText('Department')).toHaveValue('Delivery');
    expect(screen.getByLabelText('Role category for Noura Head')).toBeDisabled();
    expect(screen.getByLabelText('Role category for Peter Professional')).toHaveValue('ProjectDeliveryProfessional');
  });
});
