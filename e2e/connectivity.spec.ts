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

const backendUrl = 'http://127.0.0.1:3001/api';

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

test('scenario 1: valid test login, session restoration, logout, and invalid feedback', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'PMS 2027' })).toBeVisible();
  await page.getByLabel('Employee Number').fill('12245');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Hana Admin' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome, Hana Admin' })).toBeVisible();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('button', { name: 'Test Login' })).toBeVisible();
  await page.getByLabel('Employee Number').fill('unknown');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await expect(page.getByRole('alert')).toContainText('not found or is not eligible');
});

test('scenario 6: HR and Department Head maintain RoleCategory within scope', async ({ page }) => {
  await login(page, '12245');
  await page.getByRole('button', { name: 'RoleCategory Mapping' }).click();
  await expect(page.getByRole('heading', { name: 'RoleCategory Mapping' })).toBeVisible();
  await page.getByLabel('Employee Number').fill('17004');
  await page.getByLabel('RoleCategory', { exact: true }).selectOption('AdministrativeSupport');
  await page.getByRole('button', { name: 'Save mapping' }).click();
  await expect(page.getByRole('status')).toContainText('RoleCategory saved for 17004');
  await page.getByLabel('Employee Number').fill('17003');
  await page.getByLabel('RoleCategory', { exact: true }).selectOption('AdministrativeSupport');
  await page.getByRole('button', { name: 'Save mapping' }).click();
  await expect(page.getByRole('status')).toContainText('RoleCategory saved for 17003');
  await page.getByRole('button', { name: 'Logout' }).click();

  await page.getByLabel('Employee Number').fill('17001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'RoleCategory Mapping' }).click();
  await page.getByLabel('Employee Number').fill('12245');
  await page.getByLabel('RoleCategory', { exact: true }).selectOption('AdministrativeSupport');
  await page.getByRole('button', { name: 'Save mapping' }).click();
  await expect(page.getByRole('alert')).toContainText('outside the Department Head scope');
  await page.getByLabel('Employee Number').fill('17002');
  await page.getByLabel('RoleCategory', { exact: true }).selectOption('ProjectDeliveryProfessional');
  await page.getByRole('button', { name: 'Save mapping' }).click();
  await expect(page.getByRole('status')).toContainText('RoleCategory saved for 17002');
});

test('scenarios 2 through 6: HR previews all assignment branches and generates selected scorecards', async ({ page }) => {
  await login(page, '12245');
  await page.getByRole('button', { name: 'Create PMS Submissions' }).click();
  await expect(page.getByRole('heading', { name: 'Create PMS Submissions' })).toBeVisible();
  await page.getByLabel('Department').selectOption('Delivery');
  await page.getByRole('button', { name: 'Populate' }).click();
  const table = page.getByRole('table');
  await expect(table).toContainText('DUG Leadership Scorecard');
  await expect(table).toContainText('KBU Leadership Scorecard');
  await expect(table).toContainText('Department Heads / Senior Managers KPI Form');
  await expect(table).toContainText('Project Delivery / Professional KPI Form');
  await expect(table).toContainText('Administrative / Support Non-KPI Form');
  await expect(table).toContainText('Missing Manager');
  await expect(table).toContainText('Missing Grade');
  await expect(table).toContainText('Unable to Resolve DUG/KBU');
  await page.getByRole('button', { name: 'Generate selected' }).click();
  await expect(page.getByRole('status')).toContainText('6 Created');
  await expect(table).toContainText('PMS Already Exists');
});

test('role-specific submission lists and phase control expose only authorized screens', async ({ page }) => {
  await login(page, '30001');
  await page.getByRole('button', { name: 'My Team' }).click();
  await expect(page.getByRole('heading', { name: 'My Team' })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Dalia Leader');
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
  await expect(page.getByText('GoalSetting', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open next phase' }).click();
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
    await page.getByRole('button', { name: new RegExp(`Open .*`) }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByText('Total Weight:', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Logout' }).click();
  }
});

test('scenarios 7 through 9: Goal Setting draft, weight validation, rejection, resubmission, and approval', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, '18001');
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await page.getByRole('button', { name: 'Add row' }).click();
  await page.getByLabel('Perspective 1').selectOption('Customer');
  await page.getByLabel('Objective / KPI 1').fill('Deliver the 2027 strategic outcome');
  await page.getByLabel('Linked Strategy Reference 1').selectOption({ label: 'Execution Excellence' });
  await page.getByLabel('Measure 1').fill('Completion rate');
  await page.getByLabel('Target 1').fill('100% completed');
  await page.getByLabel('Weight 1').fill('90');
  await page.getByRole('button', { name: 'Save as Draft' }).click();
  await expect(page.getByText('SavedDraft')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await expect(page.getByLabel('Objective / KPI 1')).toHaveValue('Deliver the 2027 strategic outcome');
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
  await expect(page.getByText(/FullyApproved/)).toBeVisible();
  await expect(page.getByLabel('Objective / KPI 1')).toBeDisabled();
  const history = page.getByRole('region', { name: 'Workflow history' });
  await expect(history).toContainText('SavedDraft');
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
    ['17004', undefined]
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
  await page.getByRole('button', { name: 'Open next phase' }).click();
  await expect(page.getByRole('status')).toContainText('MidYear opened');
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
  await expect(page.getByText(/FullyApproved/)).toBeVisible();

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
    await apiAction(page, scorecard.id, 'Approved');
  }

  await apiLogin(page, '12245');
  await page.goto('/');
  await page.getByRole('button', { name: 'Phase Control' }).click();
  await page.getByRole('button', { name: 'Open next phase' }).click();
  await expect(page.getByRole('status')).toContainText('YearEnd opened');
  await page.getByRole('button', { name: 'Logout' }).click();

  await page.getByLabel('Employee Number').fill('18001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await page.getByLabel('Actual 1').fill('Delivered');
  await page.getByLabel('SelfRating 1').selectOption('4');
  await page.getByLabel('Employee Comment 1').fill('Exceeded the revised outcome');
  await page.getByRole('button', { name: 'Save as Draft' }).click();
  await expect(page.getByRole('region', { name: 'Workflow history' })).toContainText('SavedDraft');
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByLabel('Employee Number').fill('30001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'My Team' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await expect(page.getByLabel('SelfRating 1')).toHaveValue('');
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByLabel('Employee Number').fill('18001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await expect(page.getByLabel('SelfRating 1')).toHaveValue('4');
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
  await expect(page.getByLabel('SelfRating 1')).toHaveValue('4');
  await page.getByLabel('Manager Rating 1').selectOption('4');
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
  await expect(page.getByLabel('Manager Rating 1')).toHaveValue('4');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('alert')).toContainText('Manager evidence is required');
  await page.getByLabel('Manager Evidence Reference 1').fill('MGR-EVIDENCE-2027');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Overall Rating: 4.0')).toBeVisible();

  await ownScorecard(page, '17003');
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Sara Support' }).click();
  await expect(page.getByLabel(/SelfRating/)).toHaveCount(0);
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

  for (const employeeNumber of ['18002', '17001', '17002', '17004']) {
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
  await page.getByRole('button', { name: 'Open next phase' }).click();
  await expect(page.getByRole('status')).toContainText('Development opened');

  for (const employeeNumber of ['18002', '17001', '17002', '17003', '17004']) {
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
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByLabel('Employee Number').fill('30001');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await page.getByRole('button', { name: 'My Team' }).click();
  await page.getByRole('button', { name: 'Open Dalia Leader' }).click();
  await page.getByLabel('Manager Development Notes').fill('Quarterly leadership coaching');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Dalia Leader · Closed/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Workflow history' })).toContainText('Closed');
});
