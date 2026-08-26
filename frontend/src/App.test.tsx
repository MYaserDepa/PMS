import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('App', () => {
  it('shows test login when there is no restored session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Test Login' })).toBeInTheDocument();
    expect(screen.getByText(/controlled development use only/)).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'RoleCategory Mapping' })).toBeInTheDocument();
  });

  it('renders the HR Populate preview with form and validation results', async () => {
    const user = {
      employeeNumber: '12245', fullName: 'Hana Admin', department: 'Human Resources',
      isHrAdmin: true, isItAdmin: false, isManager: false, departmentHeadStatus: 'NotHead'
    };
    const rows = [
      { employeeNumber: '18001', fullName: 'Dalia Leader', grade: 18, employer: 'DUG Corporate', employerClassification: 'DUG', departmentHeadStatus: 'NotApplicable', roleCategory: null, managerName: 'Mariam Manager', formType: 'DUGLeadership', status: 'Ready' },
      { employeeNumber: '17005', fullName: 'Noor NoManager', grade: 17, employer: 'DUG Corporate', employerClassification: 'NotApplicable', departmentHeadStatus: 'NotHead', roleCategory: null, managerName: null, formType: null, status: 'Missing Manager' }
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
    expect(screen.getByText('Missing Manager')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Noor NoManager')).toBeDisabled();
  });
});
