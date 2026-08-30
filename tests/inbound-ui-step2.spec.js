import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import path from 'node:path';
import { classifyInboundDocument } from '../src/modules/inventory/services/inboundDocuments/documentClassifier.js';

const EMAIL = process.env.E2E_EMAIL || '';
const PASSWORD = process.env.E2E_PASSWORD || '';
const FIXTURE_DIR = process.env.E2E_INBOUND_FIXTURE_DIR || '';
const fixture = (name) => path.resolve(FIXTURE_DIR, name);
const M2302 = fixture('M2302.pdf');
const PRICE_LIST = fixture('NTIーJD Frozen単価表 HS5219.pdf');
const IMAGE_PDF = fixture('20260819091430915.pdf');

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

async function openImport(page) {
  const group = page.locator('.sidebar-nav-group').nth(4);
  if (!(await group.locator('.sidebar-subnav').isVisible().catch(() => false))) await group.locator('.sidebar-group-button').click();
  await group.locator('.sidebar-subnav button').first().click();
  await page.getByRole('button', { name: '入荷予定', exact: true }).click();
  await page.getByRole('button', { name: '＋ 新しく取り込む' }).click();
  await expect(page.getByRole('heading', { name: '入荷予定を取り込む' })).toBeVisible();
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

async function upload(page, filePath, selector = '.delivery-notice-upload-button input[accept*=".pdf"]') {
  await page.locator(selector).setInputFiles(filePath);
  await expect(page.getByRole('heading', { name: '内容確認', exact: true })).toBeVisible({ timeout: 20_000 });
}

async function excelFixture() {
  const headers = [
    'document_type', 'document_number', 'supplier_name', 'contract_no', 'source_line_no',
    'product_code', 'product_name', 'total_weight_kg', 'unit_price', 'currency', 'price_unit',
    'customs_clearance_planned_date', 'confidence', 'requires_review',
  ];
  const row = {
    document_type: 'delivery_notice', document_number: 'E2E_STEP2', supplier_name: 'E2E Supplier',
    contract_no: '000STEP2', source_line_no: 1, product_code: '0000001', product_name: 'E2E Step2 Product',
    total_weight_kg: 10, unit_price: '', currency: 'JPY', price_unit: 'KG',
    customs_clearance_planned_date: '2026/09/01', confidence: 'high', requires_review: false,
  };
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('IMPORT_TEMPLATE');
  sheet.addRow(headers);
  sheet.addRow(headers.map((key) => row[key] ?? ''));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('delivery notice follows content, product, and save steps with browser history', async ({ page }) => {
  await login(page);
  const audit = auditPage(page);
  await openImport(page);
  await upload(page, M2302);
  await expect(page).toHaveURL(/step=content/);
  await expect(page.getByText('入荷予定案内', { exact: true })).toBeVisible();
  await expect(page.locator('.inbound-content-table tbody tr')).toHaveCount(12);
  await page.getByRole('button', { name: '商品確認へ' }).click();
  await expect(page).toHaveURL(/step=products/);
  await expect(page.getByRole('heading', { name: '商品確認', exact: true })).toBeVisible();
  await expect(page.getByText(/確認済み \d+ \/ 12/)).toBeVisible();
  await page.getByRole('button', { name: '保存内容を確認' }).click();
  await expect(page).toHaveURL(/step=save/);
  await expect(page.getByRole('heading', { name: '保存内容の確認' })).toBeVisible();
  await expect(page.getByRole('button', { name: '入荷予定として保存' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: '商品確認', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: '内容確認', exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: '商品確認', exact: true })).toBeVisible();
  expect(audit.writes).toEqual([]);
  expect(audit.consoleErrors).toEqual([]);
  expect(audit.serverErrors).toEqual([]);
  audit.consoleErrors.length = 0;
  await page.reload();
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
  await openImport(page);
  await expect(page.locator('.standard-excel-upload-button input[type="file"]')).toBeVisible({ timeout: 20_000 });
  expect(audit.writes).toEqual([]);
  expect(audit.serverErrors).toEqual([]);
});

test('price list and image PDF remain content-only and cannot be saved', async ({ page }) => {
  await login(page);
  const audit = auditPage(page);
  await openImport(page);
  await upload(page, PRICE_LIST);
  await expect(page.getByText('商品価格表', { exact: true })).toBeVisible();
  await expect(page.getByText('この書類は入荷予定として保存できません。')).toBeVisible();
  await expect(page.getByRole('button', { name: '商品確認へ' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '入荷予定として保存' })).toHaveCount(0);
  await page.getByRole('button', { name: '取込をやり直す' }).click();
  await upload(page, IMAGE_PDF);
  await expect(page.getByText('倉庫受領書の可能性', { exact: true })).toBeVisible();
  await expect(page.getByText('読み取り結果の確認が必要です。')).toBeVisible();
  await expect(page.getByRole('button', { name: '商品確認へ' })).toHaveCount(0);
  expect(audit.writes).toEqual([]);
  expect(audit.serverErrors).toEqual([]);
});

test('standard Excel uses the same staged flow without filling unit price', async ({ page }) => {
  await login(page);
  const audit = auditPage(page);
  await openImport(page);
  await page.locator('.standard-excel-upload-button input[type="file"]').setInputFiles({
    name: 'E2E_STEP2.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await excelFixture(),
  });
  await expect(page.getByRole('heading', { name: '内容確認', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('標準Excel', { exact: true })).toBeVisible();
  await expect(page.getByText('000STEP2', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '商品確認へ' }).click();
  await expect(page.getByRole('heading', { name: '商品確認', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '保存内容を確認' }).click();
  await expect(page.getByRole('button', { name: '入荷予定として保存' })).toBeVisible();
  expect(audit.writes).toEqual([]);
  expect(audit.serverErrors).toEqual([]);
});

for (const width of [320, 375, 390, 430, 1440]) {
  test(`stepper and staged flow fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await openImport(page);
    await upload(page, M2302);
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await expect(page.locator('.inbound-import-stepper')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.getByRole('button', { name: '商品確認へ' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.getByRole('button', { name: '保存内容を確認' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
}

test('unknown classifier result never enables product or save steps', () => {
  const items = Array.from({ length: 5 }, (_, index) => ({ text: `misc-${index}`, x: index * 20, y: 100, width: 10, height: 10 }));
  const result = classifyInboundDocument({ text: 'miscellaneous document without known headers', pages: [{ pageNumber: 1, width: 500, height: 700, text: 'miscellaneous document without known headers', items }] });
  expect(result.documentType).toBe('unknown');
  expect(['medium', 'low']).toContain(result.confidence);
});
