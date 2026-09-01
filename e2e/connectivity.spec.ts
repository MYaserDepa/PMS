import { expect, test, type Page } from '@playwright/test';

const browserFailures = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const failures: string[] = [];
  browserFailures.set(page, failures);
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => failures.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => {
    const navigationAbortedLogout = request.url().endsWith('/auth/logout') && request.failure()?.errorText === 'net::ERR_ABORTED';
    if (!navigationAbortedLogout) {
      failures.push(`request: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`);
    }
  });
});

test.afterEach(async ({ page }) => {
  expect(browserFailures.get(page) ?? [], 'browser console, page, and network failures').toEqual([]);
});

async function login(page: import('@playwright/test').Page, employeeNumber: string) {
  await page.goto('/');
  await page.getByLabel('Employee Number').fill(employeeNumber);
  await page.getByRole('button', { name: 'Test Login' }).click();
}

const backendUrl = 'http://127.0.0.1:3101/api';

async function apiLogin(page: import('@playwright/test').Page, employeeNumber: string) {
  await page.request.post(`${backendUrl}/auth/login`, { data: { employeeNumber } });
}

async function ownScorecard(page: import('@playwright/test').Page, employeeNumber: string) {
  await apiLogin(page, employeeNumber);
  const response = await page.request.get(`${backendUrl}/scorecards`);
  const body = await response.json();
  return body.scorecards.find((item: { employeeNumber: string }) => item.employeeNumber === employeeNumber);
}

async function scorecardDetail(page: import('@playwright/test').Page, id: string) {
  return (await (await page.request.get(`${backendUrl}/scorecards/${id}`)).json()).scorecard;
}

async function apiAction(page: import('@playwright/test').Page, id: string, action: string, data: Record<string, unknown> = {}) {
  const response = await page.request.post(`${backendUrl}/scorecards/${id}/actions/${action}`, { data });
  expect(response.ok(), `${action} failed: ${await response.text()}`).toBe(true);
}

async function confirmPhaseAdvance(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Open next phase' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Are you sure? This action cannot be undone.');
  await dialog.locator('button').last().click();
}

test('scenario 1: valid test login, session restoration, logout, and invalid feedback', async ({ page }) => {
  await page.route('**/api/scorecards', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  await page.route('**/api/cycle', (route) => route.fulfill({
    json: { cycle: { year: 2027, name: 'PMS 2027', status: 'Active', current_phase: 'MidYear' } }
  }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'PMS 2027' })).toBeVisible();
  await expect(page.locator('.login-context .phase-spine .phase-current')).toContainText('Mid-year');
  await expect(page.locator('.login-context .phase-spine .phase-current')).not.toContainText('Goals');
  await page.getByLabel('Employee Number').fill('12245');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await expect(page.getByRole('status')).toContainText('Getting submissions');
  await expect(page.getByRole('heading', { name: 'Welcome, Hana Admin' })).toBeVisible();
  await expect(page.locator('.phase-spine .phase-current')).toContainText('Mid-year');
  await expect(page.locator('.phase-spine .phase-current')).not.toContainText('Goals');
  await expect(page.locator('.user-context')).toContainText('Test Position');
  await expect(page.locator('.user-context')).not.toContainText('P-100');
  await expect(page.locator('.user-context')).not.toContainText('HR Admin');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome, Hana Admin' })).toBeVisible();
  await page.getByRole('button', { name: 'Phase Control' }).click();
  await expect(page.getByRole('button', { name: 'Open next phase' })).toBeDisabled();
  await expect(page.getByText(/No submissions have been created/)).toBeVisible();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('button', { name: 'Test Login' })).toBeVisible();
  await page.getByLabel('Employee Number').fill('unknown');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await expect(page.getByRole('alert')).toContainText('not found or is not eligible');
});

test('scenario 6: HR and Department Head maintain role categories within scope', async ({ page }) => {
  await page.route('**/api/role-categories/employees**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });
  await page.route('**/api/role-categories', async (route) => {
    if (route.request().method() === 'PUT') await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });
  await login(page, '12245');
  await page.getByRole('button', { name: 'Role Category Mapping' }).click();
  await expect(page.getByRole('heading', { name: 'Role Category Mapping' })).toBeVisible();
  await page.getByLabel('Department').selectOption('Delivery');
  await expect(page.getByRole('status')).toContainText('Loading department employees');
  await expect(page.getByRole('table')).toContainText('Peter Professional');
  await page.getByLabel('Role category for Mina Unmapped').selectOption('AdministrativeSupport');
  await page.getByLabel('Role category for Peter Professional').selectOption('AdministrativeSupport');
  await page.getByLabel('Role category for Sara Support').selectOption('AdministrativeSupport');
  await page.getByRole('button', { name: 'Save mappings' }).click();
  await expect(page.getByRole('status')).toContainText('Saving role category mappings');
  await expect(page.getByRole('status')).toContainText('3 role category mappings saved');
  await expect(page.getByRole('status')).toHaveClass(/toast/);
  await page.getByRole('button', { name: 'Logout' }).click();

  await page.getByLabel('Employee Number').fill('17001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'Role Category Mapping' }).click();
  await expect(page.getByLabel('Department')).toHaveValue('Delivery');
  await expect(page.getByLabel('Department').locator('option')).toHaveCount(1);
  await expect(page.getByRole('table')).toContainText('Peter Professional');
  await expect(page.getByRole('table')).not.toContainText('Hana Admin');
  await page.getByLabel('Role category for Peter Professional').selectOption('ProjectDeliveryProfessional');
  await page.getByRole('button', { name: 'Save mappings' }).click();
  await expect(page.getByRole('status')).toContainText('1 role category mapping saved');
});

test('scenarios 2 through 6: HR previews all assignment branches and generates selected scorecards', async ({ page }) => {
  await page.route('**/api/hr/populate', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });
  await page.route('**/api/hr/generate', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });
  await login(page, '12245');
  await page.getByRole('button', { name: 'Create PMS Submissions' }).click();
  await expect(page.getByRole('heading', { name: 'Create PMS Submissions' })).toBeVisible();
  await page.getByLabel('Department').selectOption('Delivery');
  await page.getByRole('button', { name: 'Populate' }).click();
  await expect(page.getByRole('status')).toContainText('Populating department employees');
  const table = page.getByRole('table');
  await expect(table).toContainText('DUG Leadership Scorecard');
  await expect(table).toContainText('KBU Leadership Scorecard');
  await expect(table).toContainText('Department Heads / Senior Managers KPI Form');
  await expect(table).toContainText('Project Delivery / Professional KPI Form');
  await expect(table).toContainText('Administrative / Support Non-KPI Form');
  await expect(table).toContainText('Missing Manager');
  await expect(table).toContainText('Missing Grade');
  await expect(table).toContainText('Unable to Resolve DUG/KBU');
  await expect(table.getByRole('row').filter({ hasText: 'Dalia Leader' })).toContainText('Noura Head');
  await page.getByRole('button', { name: 'Generate selected' }).click();
  await expect(page.getByRole('status')).toContainText('Creating PMS submissions');
  await expect(page.getByRole('status')).toContainText('6 created');
  await expect(table).toContainText('PMS Already Exists');
});

test('role-specific submission lists and phase control expose only authorized screens', async ({ page }) => {
  await login(page, '30001');
  await page.getByRole('button', { name: 'My Team' }).click();
  await expect(page.getByRole('heading', { name: 'My Team' })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Dalia Leader');
  await expect(page.getByRole('row').filter({ hasText: 'Dalia Leader' }).getByRole('cell').nth(4)).toHaveText('Dalia Leader');
  await expect(page.getByRole('button', { name: 'Create PMS Submissions' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Logout' }).click();

  await page.getByLabel('Employee Number').fill('17001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'Department PMS' }).click();
  await expect(page.getByRole('heading', { name: 'Department PMS' })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Sara Support');
  await expect(page.getByRole('button', { name: 'Phase Control' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Logout' }).click();

  await page.getByLabel('Employee Number').fill('12245');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'All 2027 Submissions' }).click();
  await expect(page.getByRole('table')).toContainText('Administrative / Support Non-KPI Form');
  await page.getByRole('button', { name: 'Phase Control' }).click();
  await expect(page.locator('.phase-card').getByText('Goals', { exact: true }).first()).toBeVisible();
  await confirmPhaseAdvance(page);
  await expect(page.getByRole('alert')).toContainText('Every scorecard must fully approve');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
});

test('all five generated form types render from the server-provided form assignment', async ({ page }) => {
  const examples = [
    ['18001', 'DUG Leadership Scorecard'],
    ['18002', 'KBU Leadership Scorecard'],
    ['17001', 'Department Heads / Senior Managers KPI Form'],
    ['17002', 'Project Delivery / Professional KPI Form'],
    ['17003', 'Administrative / Support Non-KPI Form']
  ];
  for (const [employeeNumber, heading] of examples) {
    await login(page, employeeNumber);
    const openButton = page.getByRole('button', { name: new RegExp(`Open .*`) });
    await expect(openButton).toHaveText('Open form');
    await openButton.click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByText('Total Weight:', { exact: false })).toBeVisible();
    if (employeeNumber === '18001' || employeeNumber === '18002') {
      await expect(page.getByLabel('Objective / KPI 1')).toBeVisible();
      await expect(page.getByLabel('Objective / KPI 2')).toHaveCount(0);
    }
    if (employeeNumber === '17001' || employeeNumber === '17002') {
      await expect(page.getByLabel(/Objective \/ KPI/)).toHaveCount(4);
    }
    await page.getByRole('button', { name: 'Logout' }).click();
  }
});

test('employee 21975 can work on their own Administrative Support scorecard', async ({ page }) => {
  await apiLogin(page, '12245');
  await expect((await page.request.put(`${backendUrl}/role-categories/21975`, { data: { roleCategory: 'AdministrativeSupport' } })).ok()).toBe(true);
  await expect((await page.request.post(`${backendUrl}/hr/generate`, { data: { employeeNumbers: ['21975'] } })).ok()).toBe(true);
  await page.request.post(`${backendUrl}/auth/logout`);

  await login(page, '21975');
  await page.getByRole('button', { name: 'Open Imran Systems' }).click();
  await expect(page.getByRole('heading', { name: 'Administrative / Support Non-KPI Form' })).toBeVisible();
  await page.getByRole('button', { name: 'Save as Draft' }).click();
  const history = page.getByRole('region', { name: 'Workflow history' });
  await expect(history).toContainText('Saved Draft');
  await expect(history).toContainText('Imran Systems');
  await expect(history).not.toContainText('21975');
  await expect(history).not.toContainText('Employee → Employee');
});

test('scenarios 7 through 9: Goal Setting draft, weight validation, rejection, resubmission, and approval', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, '18001');
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await expect(page.getByLabel('Objective / KPI 1')).toBeVisible();
  await page.getByRole('button', { name: 'Add row' }).click();
  await expect(page.getByLabel('Objective / KPI 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove' }).first()).toHaveText('Remove');
  await page.getByRole('button', { name: 'Remove' }).last().click();
  await expect(page.getByLabel('Objective / KPI 2')).toHaveCount(0);
  await expect(page.getByLabel('Weight 1')).toHaveAttribute('step', '1');
  await page.getByRole('button', { name: 'Save as Draft' }).click();
  await expect(page.getByRole('alert')).toContainText('requires wording, a measure, and a target');
  await page.getByLabel('Perspective 1').selectOption('Customer');
  await page.getByLabel('Objective / KPI 1').fill('Deliver the 2027 strategic outcome');
  await page.getByLabel('Linked Strategy Reference 1').selectOption({ label: 'Execution Excellence' });
  await page.getByLabel('Measure 1').fill('Completion rate');
  await page.getByLabel('Target 1').fill('100% completed');
  await page.getByLabel('Weight 1').fill('90');
  await page.getByRole('button', { name: 'Save as Draft' }).click();
  await expect(page.getByRole('alert')).toContainText('Total weight must equal exactly 100 percent');
  await page.getByLabel('Weight 1').fill('100');
  await page.getByRole('button', { name: 'Save as Draft' }).click();
  await expect(page.getByRole('region', { name: 'Workflow history' })).toContainText('Saved Draft');
  await page.reload();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await expect(page.getByLabel('Objective / KPI 1')).toHaveValue('Deliver the 2027 strategic outcome');
  await page.getByLabel('Weight 1').fill('90');
  await page.getByRole('button', { name: 'Initiate' }).click();
  await expect(page.getByRole('alert')).toContainText('Total weight must equal exactly 100 percent');
  await page.getByLabel('Weight 1').fill('100');
  await page.getByRole('button', { name: 'Initiate' }).click();
  await expect(page.getByLabel('Objective / KPI 1')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Initiate' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Logout' }).click();

  await page.getByLabel('Employee Number').fill('30001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'My Team' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await page.getByLabel('Workflow comment').fill('Please make the outcome more specific');
  await page.getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByRole('region', { name: 'Workflow history' })).toContainText('Rejected');
  await page.getByRole('button', { name: 'Logout' }).click();

  await page.getByLabel('Employee Number').fill('18001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await page.getByLabel('Objective / KPI 1').fill('Deliver the specific 2027 strategic outcome');
  await page.getByRole('button', { name: 'Resubmit' }).click();
  await expect(page.getByRole('region', { name: 'Workflow history' })).toContainText('Resubmitted');
  await page.getByRole('button', { name: 'Logout' }).click();

  await page.getByLabel('Employee Number').fill('30001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'My Team' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await page.getByLabel('Workflow comment').fill('Approved');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Fully Approved/)).toBeVisible();
  await expect(page.getByLabel('Objective / KPI 1')).toBeDisabled();
  const history = page.getByRole('region', { name: 'Workflow history' });
  await expect(history).toContainText('Saved Draft');
  await expect(history).toContainText('Initiated');
  await expect(history).toContainText('Rejected');
  await expect(history).toContainText('Resubmitted');
  await expect(history).toContainText('Approved');
});

test('scenarios 10 through 14: Mid-Year, Year-End evidence and privacy, Administrative rating, Development, and close', async ({ page }) => {
  test.setTimeout(240_000);
  await apiLogin(page, '12245');
  const strategyId = String((await (await page.request.get(`${backendUrl}/strategy-references`)).json()).strategyReferences[0].id);
  const goalSetup = [
    ['18002', [{ perspective: 'Business Development', title: 'KBU outcome', linkedStrategyReferenceId: strategyId, measureDescription: 'Completion', target: '100%', weight: 100 }]],
    ['17001', [1, 2, 3, 4].map((index) => ({ title: `Department KPI ${index}`, linkedStrategyReferenceId: strategyId, measureDescription: 'Completion', target: '100%', weight: 25 }))],
    ['17002', [1, 2, 3, 4].map((index) => ({ performanceArea: 'Quality', title: `Professional KPI ${index}`, linkedStrategyReferenceId: strategyId, measureDescription: 'Completion', target: '100%', weight: 25 }))],
    ['17003', undefined],
    ['17004', undefined],
    ['21975', undefined]
  ] as const;
  for (const [employeeNumber, lines] of goalSetup) {
    const scorecard = await ownScorecard(page, employeeNumber);
    await apiAction(page, scorecard.id, 'Initiated', lines ? { lines } : {});
    await apiLogin(page, '30001');
    await apiAction(page, scorecard.id, 'Approved');
  }

  await apiLogin(page, '12245');
  await page.goto('/');
  await page.getByRole('button', { name: 'Phase Control' }).click();
  await confirmPhaseAdvance(page);
  await expect(page.getByRole('status')).toContainText('Mid-year opened');
  await page.getByRole('button', { name: 'Logout' }).click();

  await page.getByLabel('Employee Number').fill('18001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await page.getByLabel('Target 1').fill('95% completed');
  await page.getByLabel('Mid-Year Status 1').selectOption('AtRisk');
  await page.getByLabel('Mid-Year Comment 1', { exact: true }).fill('Recovery plan agreed');
  await page.getByRole('button', { name: 'Initiate' }).click();
  await expect(page.getByLabel('Target 1')).toBeDisabled();
  await page.getByRole('button', { name: 'Logout' }).click();

  await page.getByLabel('Employee Number').fill('30001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'My Team' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await page.getByLabel('Manager Mid-Year Comment 1', { exact: true }).fill('Recovery plan accepted');
  await page.getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByRole('region', { name: 'Workflow history' })).toContainText('Rejected');
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByLabel('Employee Number').fill('18001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await page.getByRole('button', { name: 'Resubmit' }).click();
  await expect(page.getByRole('region', { name: 'Workflow history' })).toContainText('Resubmitted');
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByLabel('Employee Number').fill('30001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'My Team' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await page.getByLabel('Manager Mid-Year Comment 1', { exact: true }).fill('Recovery plan accepted');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Fully Approved/)).toBeVisible();

  for (const [employeeNumber] of goalSetup) {
    const scorecard = await ownScorecard(page, employeeNumber);
    const detail = await scorecardDetail(page, scorecard.id);
    if (detail.form_type === 'AdministrativeSupport') {
      await apiAction(page, scorecard.id, 'Initiated');
    } else {
      const lines = detail.lines.map((line: Record<string, unknown>) => ({
        id: String(line.id), perspective: line.perspective, performanceArea: line.performance_area,
        title: line.title, linkedStrategyReferenceId: String(line.linked_strategy_reference_id),
        measureDescription: line.measure_description, target: line.target, weight: Number(line.weight),
        midYearStatus: 'OnTrack', midYearComment: 'On plan'
      }));
      await apiAction(page, scorecard.id, 'Initiated', { lines });
    }
    await apiLogin(page, '30001');
    const managerDetail = await scorecardDetail(page, scorecard.id);
    await apiAction(page, scorecard.id, 'Approved', managerDetail.form_type === 'AdministrativeSupport' ? {} : {
      lines: managerDetail.lines.map((line: { id: string }) => ({ id: String(line.id), managerComment: 'Progress reviewed' }))
    });
  }

  await apiLogin(page, '12245');
  await page.goto('/');
  await page.getByRole('button', { name: 'Phase Control' }).click();
  await confirmPhaseAdvance(page);
  await expect(page.getByRole('status')).toContainText('Year-end opened');
  await page.getByRole('button', { name: 'Logout' }).click();

  await page.getByLabel('Employee Number').fill('18001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await page.getByLabel('Actual 1').fill('Delivered');
  await page.getByLabel('Self Rating 1').selectOption('3');
  await page.getByLabel('Employee Comment 1').fill('Exceeded the revised outcome');
  await page.getByRole('button', { name: 'Save as Draft' }).click();
  await expect(page.getByRole('region', { name: 'Workflow history' })).toContainText('Saved Draft');
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByLabel('Employee Number').fill('30001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'My Team' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await expect(page.getByLabel('Self Rating 1')).toHaveValue('');
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByLabel('Employee Number').fill('18001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await expect(page.getByLabel('Self Rating 1')).toHaveValue('3');
  await page.getByLabel('Self Rating 1').selectOption('4');
  await page.getByRole('button', { name: 'Initiate' }).click();
  await expect(page.getByRole('alert')).toContainText('Employee evidence is required');
  await page.getByLabel('Employee Evidence Reference 1').fill('EMP-EVIDENCE-2027');
  await page.getByRole('button', { name: 'Initiate' }).click();
  await expect(page.getByLabel('Actual 1')).toBeDisabled();
  await page.getByRole('button', { name: 'Logout' }).click();

  await page.getByLabel('Employee Number').fill('30001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'My Team' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await expect(page.getByLabel('Self Rating 1')).toHaveValue('4');
  await page.getByLabel('Manager Rating 1').selectOption('3');
  await page.getByLabel('Manager Comment 1').fill('Exceeded the outcome');
  await page.getByRole('button', { name: 'Save as Draft' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByLabel('Employee Number').fill('18001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await expect(page.getByLabel('Manager Rating 1')).toHaveValue('');
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByLabel('Employee Number').fill('30001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'My Team' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await expect(page.getByLabel('Manager Rating 1')).toHaveValue('3');
  await page.getByLabel('Manager Rating 1').selectOption('4');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('alert')).toContainText('Manager evidence is required');
  await page.getByLabel('Manager Evidence Reference 1').fill('MGR-EVIDENCE-2027');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Overall Rating: 4.0')).toBeVisible();

  await ownScorecard(page, '17003');
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Sara Support' }).click();
  await expect(page.getByLabel(/Self Rating/)).toHaveCount(0);
  for (let index = 1; index <= 6; index += 1) await page.getByLabel(`Employee Comment ${index}`).fill(`Employee comment ${index}`);
  await page.getByRole('button', { name: 'Initiate' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByLabel('Employee Number').fill('30001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'My Team' }).click();
  await page.getByRole('button', { name: 'Open Sara Support' }).click();
  for (let index = 1; index <= 6; index += 1) {
    await page.getByLabel(`Manager Rating ${index}`).selectOption('3');
    await page.getByLabel(`Manager Comment ${index}`).fill(`Manager comment ${index}`);
  }
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Overall Rating: 3.0')).toBeVisible();

  for (const employeeNumber of ['18002', '17001', '17002', '17004', '21975']) {
    const scorecard = await ownScorecard(page, employeeNumber);
    const employeeDetail = await scorecardDetail(page, scorecard.id);
    if (employeeDetail.form_type === 'AdministrativeSupport') {
      await apiAction(page, scorecard.id, 'Initiated', { standards: employeeDetail.standards.map((standard: { id: string }) => ({ id: String(standard.id), employeeComment: 'Completed' })) });
    } else {
      await apiAction(page, scorecard.id, 'Initiated', { lines: employeeDetail.lines.map((line: { id: string }) => ({ id: String(line.id), actual: 'Delivered', selfRating: 3, employeeComment: 'Completed' })) });
    }
    await apiLogin(page, '30001');
    const managerDetail = await scorecardDetail(page, scorecard.id);
    if (managerDetail.form_type === 'AdministrativeSupport') {
      await apiAction(page, scorecard.id, 'Approved', { standards: managerDetail.standards.map((standard: { id: string }) => ({ id: String(standard.id), managerRating: 3, managerComment: 'Meets expectations' })) });
    } else {
      await apiAction(page, scorecard.id, 'Approved', { lines: managerDetail.lines.map((line: { id: string }) => ({ id: String(line.id), managerRating: 3, managerComment: 'Meets expectations' })) });
    }
  }

  await apiLogin(page, '12245');
  await page.goto('/');
  await page.getByRole('button', { name: 'Phase Control' }).click();
  await confirmPhaseAdvance(page);
  await expect(page.getByRole('status')).toContainText('Development opened');

  for (const employeeNumber of ['18002', '17001', '17002', '17003', '17004', '21975']) {
    const scorecard = await ownScorecard(page, employeeNumber);
    await apiAction(page, scorecard.id, 'Initiated', { employeeDevelopmentNotes: 'Complete development priorities' });
    await apiLogin(page, '30001');
    await apiAction(page, scorecard.id, 'Approved', { managerDevelopmentNotes: 'Quarterly coaching' });
  }

  await apiLogin(page, '18001');
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await page.getByLabel('Employee Development Notes').fill('Complete the leadership programme');
  await page.getByRole('button', { name: 'Initiate' }).click();
  await expect(page.getByLabel('Employee Development Notes')).toHaveValue('Complete the leadership programme');
  await expect(page.getByLabel('Employee Development Notes')).toBeDisabled();
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByLabel('Employee Number').fill('30001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'My Team' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await expect(page.getByLabel('Employee Development Notes')).toHaveValue('Complete the leadership programme');
  await page.getByLabel('Manager Development Notes').fill('Quarterly leadership coaching');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Dalia Leader · Closed/)).toBeVisible();
  await expect(page.getByLabel('Employee Development Notes')).toHaveValue('Complete the leadership programme');
  await expect(page.getByLabel('Manager Development Notes')).toHaveValue('Quarterly leadership coaching');
  await expect(page.getByLabel('Manager Development Notes')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Workflow history' })).toContainText('Closed');
});
