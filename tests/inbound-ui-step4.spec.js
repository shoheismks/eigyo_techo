import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL || '';
const PASSWORD = process.env.E2E_PASSWORD || '';

async function login(page) {
  await page.goto('/');
  if (await page.locator('.login-card').isVisible().catch(() => false)) {
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
  }
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
  const tutorial = page.locator('.tutorial-backdrop');
  if (await tutorial.isVisible({ timeout: 1_000 }).catch(() => false)) await tutorial.locator('button').first().click();
}

async function openInboundDetail(page) {
  const group = page.locator('.sidebar-nav-group').nth(4);
  if (!(await group.locator('.sidebar-subnav').isVisible().catch(() => false))) await group.locator('.sidebar-group-button').click();
  await group.locator('.sidebar-subnav button').first().click();
  await page.getByRole('button', { name: '入荷予定', exact: true }).click();
  await expect(page.getByRole('heading', { name: '入荷予定', exact: true })).toBeVisible();
  const details = page.getByRole('button', { name: '詳細を見る' });
  await expect(details.first()).toBeVisible();
  await details.first().click();
  await expect(page.getByRole('heading', { name: '入荷予定詳細', exact: true })).toBeVisible();
}

function monitorReadOnlyDetail(page) {
  const consoleErrors = [];
  const serverErrors = [];
  const writes = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('response', (response) => {
    if ([400, 404, 500].includes(response.status()) && response.url().includes('supabase')) serverErrors.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && request.url().includes('/rest/v1/')) writes.push(`${request.method()} ${request.url()}`);
  });
  return { consoleErrors, serverErrors, writes };
}

test('saved inbound detail is separated into URL-backed tabs', async ({ page }) => {
  await login(page);
  const audit = monitorReadOnlyDetail(page);
  await openInboundDetail(page);

  await expect(page).toHaveURL(/section=overview/);
  await expect(page.locator('.inbound-detail-tabs button')).toHaveCount(4);
  await expect(page.getByRole('button', { name: '入荷を確定' })).toHaveCount(0);

  await page.getByRole('button', { name: '商品確認', exact: true }).click();
  await expect(page).toHaveURL(/section=products/);
  await expect(page.getByRole('heading', { name: '商品確認', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '入荷・在庫', exact: true }).click();
  await expect(page).toHaveURL(/section=inventory/);
  await expect(page.getByRole('button', { name: '入荷を確定' })).toBeVisible();

  await page.getByRole('button', { name: '変更履歴', exact: true }).click();
  await expect(page).toHaveURL(/section=history/);
  await page.goBack();
  await expect(page).toHaveURL(/section=inventory/);
  await page.goForward();
  await expect(page).toHaveURL(/section=history/);

  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('section', 'invalid');
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/section=overview/);
  await expect(page.getByRole('button', { name: '概要', exact: true })).toHaveAttribute('aria-current', 'page');

  expect(audit.consoleErrors).toEqual([]);
  expect(audit.serverErrors).toEqual([]);
  expect(audit.writes).toEqual([]);
});

for (const width of [320, 375, 390, 430, 1440]) {
  test(`saved inbound detail tabs fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await login(page);
    const audit = monitorReadOnlyDetail(page);
    await openInboundDetail(page);
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });

    for (const name of ['概要', '商品確認', '入荷・在庫', '変更履歴']) {
      await page.getByRole('button', { name, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }

    expect(audit.consoleErrors).toEqual([]);
    expect(audit.serverErrors).toEqual([]);
    expect(audit.writes).toEqual([]);
  });
}
