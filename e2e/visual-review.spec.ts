import { expect, test } from '@playwright/test';

async function expectNoPageOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    overflowingElements: [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: element.className,
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth
      }))
      .filter((element) => element.right > window.innerWidth + 1)
      .slice(0, 12)
  }));
  expect(dimensions.document, JSON.stringify(dimensions.overflowingElements, null, 2)).toBeLessThanOrEqual(dimensions.viewport);
}

async function expectPageFitsViewport(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerHeight,
    document: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
}

test('capture the desktop and mobile redesign for visual review', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/auth/session', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });
  const navigation = page.goto('/');
  await expect(page.getByRole('status')).toContainText('Checking for an existing session');
  await expect(page.locator('.login-form .request-loader')).toBeVisible();
  await expect(page.locator('.request-loader')).toHaveCSS('position', 'fixed');
  await expect(page.locator('.request-loader .eyebrow')).toHaveCount(0);
  expect(await page.locator('.request-loader').evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(80);
  await page.screenshot({ path: 'test-results/visual-review/desktop-loading.png', fullPage: true });
  await navigation;

  await expect(page.getByRole('heading', { name: 'PMS 2027' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.locator('.login-context')).toHaveCSS('background-size', 'auto');
  await expectNoPageOverflow(page);
  await page.screenshot({ path: 'test-results/visual-review/desktop-login.png', fullPage: true });

  await page.route('**/api/auth/login', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.getByLabel('Employee Number').fill('12245');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await expect(page.getByRole('status')).toContainText('Checking employee access');
  await expect(page.locator('.input-with-action + .request-loader')).toBeVisible();
  await page.screenshot({ path: 'test-results/visual-review/desktop-login-loading.png', fullPage: true });
  await expect(page.getByRole('heading', { name: 'Welcome, Hana Admin' })).toBeVisible();
  await page.setViewportSize({ width: 1366, height: 768 });
  await expectNoPageOverflow(page);
  await expectPageFitsViewport(page);
  await expect(page.locator('body')).toHaveCSS('background-size', '32px 32px, 32px 32px');
  await page.screenshot({ path: 'test-results/visual-review/desktop-home.png', fullPage: true });

  await page.setViewportSize({ width: 1366, height: 500 });
  await expect(page.getByText('No records yet')).toBeInViewport();
  await expectNoPageOverflow(page);
  await expectPageFitsViewport(page);
  await page.screenshot({ path: 'test-results/visual-review/desktop-home-short.png', fullPage: true });
  await page.setViewportSize({ width: 1366, height: 768 });

  const navigationToggle = page.getByRole('button', { name: 'Collapse navigation' });
  const restingTransform = await navigationToggle.evaluate((element) => getComputedStyle(element).transform);
  await navigationToggle.hover();
  expect(await navigationToggle.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
  expect(await navigationToggle.evaluate((element) => getComputedStyle(element).transform)).toBe(restingTransform);
  await navigationToggle.click();
  await expect(page.getByRole('button', { name: 'Expand navigation' })).toBeVisible();
  await expect(page.locator('.navigation-shell')).toHaveCSS('transition-duration', '0s');
  await expect(page.locator('.workspace')).toHaveCSS('transition-duration', '0s');
  await expectNoPageOverflow(page);
  await expectPageFitsViewport(page);
  await page.screenshot({ path: 'test-results/visual-review/desktop-home-collapsed.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Expand navigation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome, Hana Admin' })).toBeVisible();
  await page.getByRole('button', { name: 'Expand navigation' }).click();

  let cycleRequests = 0;
  let departmentRequests = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/cycle')) cycleRequests += 1;
    if (request.url().endsWith('/api/hr/departments')) departmentRequests += 1;
  });
  await page.route('**/api/cycle', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.route('**/api/hr/departments', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.getByRole('button', { name: 'Phase Control' }).click();
  await expect(page.getByRole('button', { name: 'Open next phase' })).toBeVisible();
  await page.getByRole('button', { name: 'Create PMS Submissions' }).click();
  await expect(page.getByRole('status')).toContainText('Loading departments');
  await expect(page.getByLabel('Department')).toHaveValue(/.+/);
  await page.getByRole('button', { name: 'Phase Control' }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create PMS Submissions' }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(cycleRequests).toBe(0);
  expect(departmentRequests).toBe(1);

  await page.getByRole('button', { name: 'Role Category Mapping' }).click();
  await page.route('**/api/role-categories/employees**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.getByLabel('Department').selectOption('Delivery');
  await expect(page.getByRole('status')).toContainText('Loading department employees');
  await page.screenshot({ path: 'test-results/visual-review/desktop-role-mapping-loading.png' });
  await expect(page.getByRole('table')).toContainText('Peter Professional');
  await expect(page.locator('.navigation-shell')).toHaveCSS('width', '272px');
  await expectNoPageOverflow(page);
  await page.screenshot({ path: 'test-results/visual-review/desktop-role-mapping.png' });

  await page.getByRole('button', { name: 'Create PMS Submissions' }).click();
  await page.route('**/api/hr/populate', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.getByLabel('Department').selectOption('Delivery');
  await page.getByRole('button', { name: 'Populate' }).click();
  await expect(page.getByRole('status')).toContainText('Populating department employees');
  await page.screenshot({ path: 'test-results/visual-review/desktop-generation-loading.png', fullPage: true });
  await expect(page.getByRole('table')).toContainText('Dalia Leader');
  await expectNoPageOverflow(page);
  await page.screenshot({ path: 'test-results/visual-review/desktop-generation.png', fullPage: true });

  await page.getByRole('button', { name: 'Logout' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'PMS 2027' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expectNoPageOverflow(page);
  await page.screenshot({ path: 'test-results/visual-review/mobile-login.png', fullPage: true });

  await page.getByLabel('Employee Number').fill('12245');
  await page.getByRole('button', { name: 'Test Login' }).click();
  await expect(page.getByRole('status')).toContainText('Checking employee access');
  expect(await page.locator('.request-loader').evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(80);
  await page.screenshot({ path: 'test-results/visual-review/mobile-login-loading.png', fullPage: true });
  await expect(page.getByRole('heading', { name: 'Welcome, Hana Admin' })).toBeVisible();
  await expectNoPageOverflow(page);
  await page.screenshot({ path: 'test-results/visual-review/mobile-home.png', fullPage: true });

  await page.getByRole('button', { name: 'Role Category Mapping' }).click();
  await page.getByLabel('Department').selectOption('Delivery');
  await expect(page.getByRole('table')).toContainText('Peter Professional');
  await expectNoPageOverflow(page);
  await page.screenshot({ path: 'test-results/visual-review/mobile-role-mapping.png', fullPage: true });
});
