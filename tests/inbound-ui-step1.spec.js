import { expect, test } from '@playwright/test';

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

async function openInboundList(page) {
  const group = page.locator('.sidebar-nav-group').nth(4);
  if (!(await group.locator('.sidebar-subnav').isVisible().catch(() => false))) await group.locator('.sidebar-group-button').click();
  await group.locator('.sidebar-subnav button').first().click();
  await page.getByRole('button', { name: '入荷予定', exact: true }).click();
  await expect(page.getByRole('heading', { name: '入荷予定', exact: true })).toBeVisible();
}

function monitorInboundNavigation(page) {
  const consoleErrors = [];
  const serverErrors = [];
  const writes = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('response', (response) => {
    if ([400, 404, 500].includes(response.status()) && response.url().includes('supabase')) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('request', (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && request.url().includes('/rest/v1/')) {
      writes.push(`${request.method()} ${request.url()}`);
    }
  });
  return { consoleErrors, serverErrors, writes };
}

test('inbound plans separate list, import, and detail views', async ({ page }) => {
  await login(page);
  const audit = monitorInboundNavigation(page);
  await openInboundList(page);

  await expect(page).toHaveURL(/tab=arrival/);
  await expect(page).not.toHaveURL(/view=/);
  await expect(page.getByRole('heading', { name: '入荷予定を取り込む' })).toHaveCount(0);
  await expect(page.locator('.delivery-notice-preview')).toHaveCount(0);
  await expect(page.locator('.delivery-notice-detail-editor')).toHaveCount(0);

  await page.getByRole('button', { name: '＋ 新しく取り込む' }).click();
  await expect(page).toHaveURL(/view=import/);
  await expect(page.getByRole('heading', { name: '入荷予定を取り込む' })).toBeVisible();
  await expect(page.getByText('PDFから取り込む', { exact: true })).toBeVisible();
  await expect(page.getByText('標準Excelから取り込む', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '← 入荷予定一覧' }).click();
  await expect(page.getByRole('heading', { name: '入荷予定', exact: true })).toBeVisible();

  const details = page.getByRole('button', { name: '詳細を見る' });
  if (await details.count()) {
    await details.first().click();
    await expect(page).toHaveURL(/view=detail&id=/);
    await expect(page.getByRole('heading', { name: '入荷予定詳細', exact: true })).toBeVisible();
    await expect(page.locator('.delivery-notice-detail-editor')).toBeVisible();
    await expect(page.getByRole('button', { name: '入荷確定' })).toBeVisible();
    await page.getByRole('button', { name: '← 入荷予定一覧' }).click();
    await expect(page.getByRole('heading', { name: '入荷予定', exact: true })).toBeVisible();
  }
  expect(audit.consoleErrors).toEqual([]);
  expect(audit.serverErrors).toEqual([]);
  expect(audit.writes).toEqual([]);
});

for (const width of [320, 375, 390, 430, 1440]) {
  test(`inbound list and import fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await login(page);
    const audit = monitorInboundNavigation(page);
    await openInboundList(page);
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await expect(page.getByRole('heading', { name: '入荷予定', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole('button', { name: '＋ 新しく取り込む' }).click();
    await expect(page.getByRole('heading', { name: '入荷予定を取り込む' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(audit.consoleErrors).toEqual([]);
    expect(audit.serverErrors).toEqual([]);
    expect(audit.writes).toEqual([]);
  });
}
