import { expect, test } from '@playwright/test';
import path from 'node:path';
import { parseDeliveryNoticeLayout } from '../src/modules/inventory/services/deliveryNoticeLayoutParser.js';

const AUTH_EMAIL = process.env.E2E_EMAIL || '';
const AUTH_PASSWORD = process.env.E2E_PASSWORD || '';
const FIXTURE_DIR = process.env.E2E_INBOUND_FIXTURE_DIR || '';
const fixturePath = (fileName) => {
  if (!FIXTURE_DIR) throw new Error('E2E_INBOUND_FIXTURE_DIR is required.');
  return path.resolve(FIXTURE_DIR, fileName);
};
const M2302_PATH = fixturePath('M2302.pdf');
const FA610_PATH = fixturePath('20260819_0083_FA610___A_.pdf');
const WAREHOUSE_RECEIPT_PATH = fixturePath('20260819091430915.pdf');
const PRICE_LIST_PATH = fixturePath('NTIーJD Frozen単価表 HS5219.pdf');

const HS5219_LINES = [
  ['122781', 'Small Intestine F1', 460, 1.025, 20, 492],
  ['122787', 'Large Intestine GF', 509, 1.025, 20, 542],
  ['122780', 'Large Intestine F1', 769, 1.025, 20, 808],
  ['122788', 'Small Intestine GF', 340, 1.025, 20, 369],
  ['122843', 'Honey Comb IWP', 880, 1.025, 21, 923],
  ['122844', 'Honey Comb Bulk', 812, 1.025, 20, 852],
  ['122816', 'Abomasum GF', 610, 1.025, 21, 646],
  ['122824', 'Abomasum WG', 695, 1.025, 21, 733],
  ['122763', 'Beef Liver', 290, 1.082, 21, 335],
  ['122811', 'Aorta', 1170, 1.025, 20, 1219],
];

async function login(page) {
  await page.goto('/');
  if (await page.locator('.login-card').isVisible().catch(() => false)) {
    await page.locator('input[type="email"]').fill(AUTH_EMAIL);
    await page.locator('input[type="password"]').fill(AUTH_PASSWORD);
    await page.locator('button[type="submit"]').click();
  }
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    const authEntry = Object.entries(window.localStorage).find(([key]) =>
      key.startsWith('sb-') && key.endsWith('-auth-token'),
    );
    if (!authEntry) return;
    const parsed = JSON.parse(authEntry[1]);
    const userId = parsed?.user?.id || parsed?.currentSession?.user?.id || parsed?.session?.user?.id || '';
    if (userId) window.localStorage.setItem(`eigyo-techo-tutorial-seen:${userId}`, 'true');
  });
  const tutorial = page.locator('.tutorial-backdrop');
  if (await tutorial.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await tutorial.locator('button').first().click();
  }
}

async function openInboundArrival(page) {
  const group = page.locator('.sidebar-nav-group').nth(4);
  const subnav = group.locator('.sidebar-subnav');
  if (!(await subnav.isVisible().catch(() => false))) {
    await group.locator('.sidebar-group-button').click();
  }
  await subnav.locator('button').first().click();
  await expect(page.locator('.inventory-page')).toBeVisible();
  await page.getByRole('button', { name: '入荷予定', exact: true }).click();
  await expect(page.getByRole('heading', { name: '入荷予定', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '＋ 新しく取り込む' }).click();
  await expect(page.getByRole('heading', { name: '入荷予定を取り込む' })).toBeVisible();
}

async function uploadInboundDocument(page, path) {
  await page.evaluate(() => {
    document.addEventListener('change', (event) => {
      if (event.target instanceof HTMLInputElement && event.target.type === 'file' && event.target.files?.[0]) {
        window.__deliveryNoticeFixtureFile = event.target.files[0];
      }
    }, { capture: true, once: true });
  });
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('.delivery-notice-upload-button input[type="file"][accept*=".pdf"]').click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path);
  await expect(page.locator('.delivery-notice-preview')).toBeVisible({ timeout: 20_000 });
}

function displayLine(line) {
  const number = (value) => value === '' || value === null || value === undefined
    ? '-'
    : Number(value).toLocaleString('ja-JP');
  return [
    String(line.lineNumber || '-'),
    line.contractNo || '-',
    line.brand || '-',
    line.productCode || '-',
    line.productName || '-',
    line.productCode ? '' : '要確認商品コードがないため確認が必要です。',
    line.productType || '-',
    number(line.pieceCount),
    line.weight === '' ? '-' : `${number(line.weight)} ${line.unit || ''}`.trim(),
    line.unitPrice === '' ? '-' : `${number(line.unitPrice)} ${line.currency || ''}${line.priceUnit ? `/${line.priceUnit}` : ''}`.trim(),
    line.originCountry || '-',
    line.factoryNo || '-',
    line.customsClearancePlannedDate || '-',
    line.packingFrom || line.packingTo ? `${line.packingFrom || '-'} ～ ${line.packingTo || '-'}` : '-',
    line.expiryDate || '-',
    line.warehouse || '-',
    line.warnings.length ? line.warnings.join(' / ') : 'なし',
  ];
}

test.describe('delivery notice preview integration', () => {
  test.skip(!AUTH_EMAIL || !AUTH_PASSWORD, 'E2E credentials are required.');

  test('M2302 parser output, preview state path, and rendered table stay identical', async ({ page }) => {
    const writes = [];
    page.on('request', (request) => {
      if (/\/(?:rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        writes.push(`${request.method()} ${request.url()}`);
      }
    });

    await login(page);
    await openInboundArrival(page);

    await uploadInboundDocument(page, M2302_PATH);
    await expect(page.locator('.delivery-notice-detail-table tbody tr')).toHaveCount(12);

    const directLines = await page.evaluate(async () => {
      const module = await import('/src/modules/inventory/services/deliveryNoticePdfParser.js');
      const preview = await module.parseDeliveryNoticePdfFile(window.__deliveryNoticeFixtureFile);
      return preview.lines;
    });
    const previewStateLines = await page.locator('.delivery-notice-preview').evaluate((element) => {
      const fiberKey = Object.keys(element).find((key) => key.startsWith('__reactFiber$'));
      let fiber = fiberKey ? element[fiberKey] : null;
      while (fiber) {
        let hook = fiber.memoizedState;
        while (hook) {
          const value = hook.memoizedState;
          if (value && Array.isArray(value.lines) && value.lines.length === 12) return value.lines;
          hook = hook.next;
        }
        fiber = fiber.return;
      }
      return null;
    });
    const expectedDisplay = directLines.map(displayLine);
    const renderedDisplay = await page.locator('.delivery-notice-detail-table tbody tr').evaluateAll((rows) =>
      rows.map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent.trim())),
    );

    expect(directLines).toHaveLength(12);
    expect(previewStateLines).toEqual(directLines);
    expect(directLines.every((line) => !line.customsClearancePlannedDate)).toBe(true);
    expect(directLines.every((line) => line.fieldMeta.weightKg.confidence === 'high')).toBe(true);
    expect(directLines[0]).toMatchObject({
      lineNumber: 1,
      contractNo: '0924267',
      brand: 'J.Dee GOLD',
      productName: 'Tongue swiss tro (200dgf)',
      productType: 'チルドビーフ',
      pieceCount: 27,
      weight: 291.6,
      unit: 'KG',
      unitPrice: 4182,
      currency: 'JPY',
      priceUnit: 'KG',
      originCountry: 'オーストラリア',
      factoryNo: '243',
      customsClearancePlannedDate: '',
      packingFrom: '2026/08/04',
      packingTo: '2026/08/04',
      expiryDate: '2026/10/12',
      warehouse: '港湾冷蔵 新南港',
    });
    const normalized = await page.evaluate(async () => {
      const module = await import('/src/modules/inventory/services/inboundDocuments/inboundDocumentParser.js');
      const result = await module.parseInboundDocumentFile(window.__deliveryNoticeFixtureFile);
      return result.normalizedDocument;
    });
    expect(normalized.fields.warehouseArrivalDate).toMatchObject({
      value: '2026/08/19',
      confidence: 'medium',
      source: 'document-note',
      rawValue: '8/19(水)港湾新南港入庫',
    });
    expect(normalized.lines.every((line) => !line.customsClearancePlannedDate.value)).toBe(true);
    const withoutProductMatchColumn = (rows) => rows.map((row) => row.filter((_, index) => index !== 5));
    expect(withoutProductMatchColumn(renderedDisplay)).toEqual(withoutProductMatchColumn(expectedDisplay));
    expect(writes).toEqual([]);
  });

  test('FA610 remains a delivery notice with its existing ten detail rows', async ({ page }) => {
    await login(page);
    await openInboundArrival(page);
    await uploadInboundDocument(page, FA610_PATH);

    await expect(page.getByText('デリバリー予定案内', { exact: true })).toBeVisible();
    await expect(page.locator('.delivery-notice-detail-table tbody tr')).toHaveCount(10);
    const parsed = await page.evaluate(async () => {
      const module = await import('/src/modules/inventory/services/inboundDocuments/inboundDocumentParser.js');
      return module.parseInboundDocumentFile(window.__deliveryNoticeFixtureFile);
    });
    expect(parsed.classification).toMatchObject({ documentType: 'delivery_notice', confidence: 'high' });
    expect(parsed.preview.warnings).toEqual([]);
    expect(parsed.preview.lines).toHaveLength(10);
    expect(parsed.preview.lines[0]).toMatchObject({
      lineNumber: 1,
      contractNo: '0919486',
      brand: 'BINDAREE',
      productName: 'Tongue swiss cut 150days angus 5週',
      pieceCount: 2,
      weight: 25.4,
      unitPrice: 3680,
      customsClearancePlannedDate: '2026/08/20',
      packingFrom: '2026/07/22',
      packingTo: '2026/07/22',
      expiryDate: '2026/09/29',
      originCountry: 'オーストラリア',
      factoryNo: '218',
      warehouse: '山手冷蔵 城南島',
    });
  });

  test('HS5219 is classified and parsed as a ten-line product price list without writes', async ({ page }) => {
    const writes = [];
    page.on('request', (request) => {
      if (/\/(?:rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        writes.push(`${request.method()} ${request.url()}`);
      }
    });
    await login(page);
    await openInboundArrival(page);
    await uploadInboundDocument(page, PRICE_LIST_PATH);

    await expect(page.getByText('商品単価表', { exact: true })).toBeVisible();
    await expect(page.getByText('高', { exact: true })).toBeVisible();
    await expect(page.locator('.product-price-list-preview-table tbody tr')).toHaveCount(10);
    await expect(page.getByRole('button', { name: '入荷予定として保存' })).toHaveCount(0);

    const parsed = await page.evaluate(async () => {
      const module = await import('/src/modules/inventory/services/inboundDocuments/inboundDocumentParser.js');
      return module.parseInboundDocumentFile(window.__deliveryNoticeFixtureFile);
    });
    expect(parsed.classification).toMatchObject({ documentType: 'product_price_list', confidence: 'high' });
    expect(parsed.normalizedDocument.warnings).toEqual([]);
    expect(parsed.normalizedDocument.fields.documentNumber.value).toBe('HS5219');
    expect(parsed.preview.lines.map((line) => [
      line.productCode,
      line.productName,
      line.baseUnitPrice,
      line.coefficient,
      line.additionalCost,
      line.billedUnitPrice,
    ])).toEqual(HS5219_LINES);
    for (const line of parsed.normalizedDocument.lines) {
      for (const key of ['productCode', 'productName', 'baseUnitPrice', 'coefficient', 'additionalCost', 'billedUnitPrice']) {
        expect(line[key]).toMatchObject({ confidence: 'high', source: 'table-column', sourceDocumentType: 'product_price_list' });
      }
    }
    expect(writes).toEqual([]);
  });

  test('image-only PDF is classified as an OCR candidate and is not parsed or saved', async ({ page }) => {
    const writes = [];
    page.on('request', (request) => {
      if (/\/(?:rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        writes.push(`${request.method()} ${request.url()}`);
      }
    });
    await login(page);
    await openInboundArrival(page);
    await uploadInboundDocument(page, WAREHOUSE_RECEIPT_PATH);

    await expect(page.getByText('画像PDF（要確認）', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '入荷予定として保存' })).toHaveCount(0);
    expect(writes).toEqual([]);
  });

  test('product price list preview remains usable at phone widths', async ({ page }) => {
    await login(page);
    const consoleErrors = [];
    const serverErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('response', (response) => {
      if ([400, 404, 500].includes(response.status()) && response.url().includes('supabase')) {
        serverErrors.push(`${response.status()} ${response.url()}`);
      }
    });
    await openInboundArrival(page);
    await uploadInboundDocument(page, PRICE_LIST_PATH);

    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator('.product-price-list-card-list .delivery-notice-card')).toHaveCount(10);
      await expect(page.getByRole('button', { name: '入荷予定として保存' })).toHaveCount(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
    }

    expect(consoleErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  test('generic layout parser supports English headers, shifted columns, and multiline products', () => {
    const headerY = 700;
    const rowY = 650;
    const item = (text, x, y, width = 48) => ({ text, x, y, width, height: 10 });
    const page = {
      pageNumber: 1,
      width: 1000,
      height: 800,
      items: [
        item('No.', 38, headerY, 24),
        item('Contract No.', 102, headerY, 78),
        item('Brand', 230, headerY, 42),
        item('Product Name', 352, headerY, 82),
        item('Quantity', 532, headerY, 56),
        item('Net Weight', 632, headerY, 72),
        item('Unit Price', 752, headerY, 62),
        item('Packing Date', 842, headerY, 82),
        item('1', 42, rowY, 8),
        item('0099123', 110, rowY, 50),
        item('Sample Brand', 232, rowY, 82),
        item('MULTILINE PRODUCT', 354, rowY + 5, 126),
        item('SECOND LINE', 354, rowY - 5, 80),
        item('12', 540, rowY, 16),
        item('123.400 KGS', 638, rowY, 80),
        item('1,234 JPY/KG', 754, rowY, 88),
        item('26/08/01 - 26/08/02', 844, rowY, 132),
      ],
    };

    const result = parseDeliveryNoticeLayout([page]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].fields.contractNo.value).toBe('0099123');
    expect(result.rows[0].fields.productName.value).toBe('Multiline product second line');
    expect(result.rows[0].fields.quantityPieces.value).toBe(12);
    expect(result.rows[0].fields.weightKg).toMatchObject({ value: 123.4, confidence: 'high' });
    expect(result.rows[0].fields.unitPrice.value).toBe(1234);
    expect(result.rows[0].fields.packingRange.value).toEqual({ from: '26/08/01', to: '26/08/02' });
  });
});
