import { expect, test } from '@playwright/test';
import path from 'node:path';
import { inboundProductReviewCounts, inboundProductReviewGroup } from '../src/modules/inventory/components/InboundProductReview.jsx';

const EMAIL = process.env.E2E_EMAIL || '';
const PASSWORD = process.env.E2E_PASSWORD || '';
const FIXTURE_DIR = process.env.E2E_INBOUND_FIXTURE_DIR || '';
const M2302 = path.resolve(FIXTURE_DIR, 'M2302.pdf');

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

async function openProductReview(page) {
  const group = page.locator('.sidebar-nav-group').nth(4);
  if (!(await group.locator('.sidebar-subnav').isVisible().catch(() => false))) await group.locator('.sidebar-group-button').click();
  await group.locator('.sidebar-subnav button').first().click();
  await page.getByRole('button', { name: '入荷予定', exact: true }).click();
  await page.getByRole('button', { name: '＋ 新しく取り込む' }).click();
  await page.locator('.delivery-notice-upload-button input[accept*=".pdf"]').setInputFiles(M2302);
  await expect(page.getByRole('heading', { name: '内容確認', exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '商品確認へ' }).click();
  await expect(page.locator('.inbound-product-review')).toBeVisible();
}

function auditPage(page) {
  const consoleErrors = [];
  const serverErrors = [];
  const writes = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('response', (response) => {
    if ([400, 404, 500].includes(response.status()) && response.url().includes('supabase')) serverErrors.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && request.url().includes('/rest/v1/')) writes.push(`${request.method()} ${request.url()}`);
  });
  return { consoleErrors, serverErrors, writes };
}

test('review grouping keeps confirmed, human review, and excluded states separate', () => {
  const lines = [
    { matchedProductId: 'p1', productMatchStatus: 'matched', productMatchSource: 'product_code' },
    { matchedProductId: 'p2', productMatchStatus: 'matched', productMatchSource: 'name_alias' },
    { matchedProductId: 'p3', matchStatus: 'manual' },
    { productMatchStatus: 'candidate' },
    { productMatchStatus: 'unmatched' },
    { productMatchStatus: 'review' },
    { matchedProductId: 'p4', productMatchStatus: 'matched', requiresReview: true },
    { status: 'excluded', productMatchStatus: 'unmatched' },
  ];
  expect(lines.map(inboundProductReviewGroup)).toEqual(['confirmed', 'confirmed', 'confirmed', 'review', 'review', 'review', 'review', 'excluded']);
  expect(inboundProductReviewCounts(lines)).toEqual({ review: 4, confirmed: 3, excluded: 1, total: 8 });
});

test('product review defaults to items needing attention and remains read-only', async ({ page }) => {
  await login(page);
  const audit = auditPage(page);
  await openProductReview(page);
  const review = page.locator('.inbound-product-review');
  await expect(review.getByRole('tab', { name: /要確認 \d+/ })).toHaveAttribute('aria-selected', 'true');
  await expect(review.getByRole('tab', { name: /確認済み \d+/ })).toBeVisible();
  await expect(review.getByRole('tab', { name: /除外 \d+/ })).toBeVisible();
  await review.getByRole('tab', { name: /確認済み \d+/ }).click();
  await review.getByRole('tab', { name: /要確認 \d+/ }).click();
  expect(audit.writes).toEqual([]);
  expect(audit.consoleErrors).toEqual([]);
  expect(audit.serverErrors).toEqual([]);
});

for (const width of [320, 375, 390, 430, 1440]) {
  test(`product review cards fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await openProductReview(page);
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await expect(page.locator('.inbound-product-review')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
}
