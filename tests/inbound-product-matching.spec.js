import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import {
  matchInboundProduct,
  matchInboundPreview,
  matchInboundLineForPersistence,
} from '../src/modules/inventory/services/inboundProductMatcher.js';

const EMAIL = process.env.E2E_EMAIL || '';
const PASSWORD = process.env.E2E_PASSWORD || '';
const HS5220 = 'C:/Users/Shohei Shimokoshi/Downloads/eigyo_techo_inbound_HS5220.xlsx';
const HEADERS = [
  'document_type', 'document_number', 'supplier_name', 'warehouse_name', 'contract_no',
  'source_line_no', 'lot_no', 'product_code', 'brand_name', 'product_name', 'packing_from',
  'packing_to', 'production_date', 'expiry_date', 'customs_clearance_planned_date',
  'warehouse_arrival_date', 'received_date', 'quantity_pieces', 'unit_weight_kg',
  'total_weight_kg', 'unit_price', 'base_unit_price', 'coefficient', 'additional_cost',
  'billed_unit_price', 'currency', 'price_unit', 'category', 'origin_country', 'factory_no',
  'source_file', 'source_note', 'confidence', 'requires_review',
];

test('product code matching remains exact and has highest priority', () => {
  const products = [
    { id: 'one', productCode: '00123', name: 'Master name' },
    { id: 'other', productCode: '999', name: 'Same imported name' },
  ];
  expect(matchInboundProduct({ productCode: ' 00123 ', productName: 'Different name' }, products)).toMatchObject({
    productMatchStatus: 'matched', productMatchSource: 'product_code', matchedProductId: 'one',
  });
  expect(matchInboundProduct({ productCode: '', productName: 'Same imported name' }, products)).toMatchObject({
    productMatchStatus: 'candidate', matchedProductId: '',
  });
  expect(matchInboundProduct({ productCode: '00124', productName: 'Same imported name' }, products)).toMatchObject({
    productMatchStatus: 'candidate', matchedProductId: '',
  });
  expect(matchInboundProduct({ productCode: '00123' }, [...products, { id: 'duplicate', productCode: '00123' }])).toMatchObject({
    productMatchStatus: 'review', matchedProductId: '',
  });
});

test('product aliases match only in a safe supplier context and candidates never auto-match', () => {
  const products = [
    { id: 'f1', productCode: '00123', name: 'JD F1 Tongue 200days', brandName: 'J.Dee GOLD', origin: 'Australia', category: 'Chilled' },
    { id: 'gf', productCode: '00999', name: 'JD GF Tongue 200days', brandName: 'J.Dee GOLD', origin: 'Australia', category: 'Chilled' },
    { id: 'skirt', productCode: '00888', name: 'Beef Skirt Thick', brandName: 'Other' },
  ];
  const suppliers = [
    { id: 'supplier-a', name: 'Nippon Supplier' },
    { id: 'supplier-b', name: 'Other Supplier' },
  ];
  const aliases = [
    {
      id: 'supplier-code', productId: 'f1', aliasName: 'Supplier Tongue',
      normalizedAlias: 'supplier tongue', supplierId: 'supplier-a',
      supplierProductCode: '000777', normalizedSupplierProductCode: '000777', isActive: true,
    },
    {
      id: 'supplier-name', productId: 'f1', aliasName: 'Tongue swiss tro (200dgf)',
      normalizedAlias: 'tongue swiss tro 200dgf', supplierId: 'supplier-a', isActive: true,
    },
    {
      id: 'global-name', productId: 'skirt', aliasName: 'Global Skirt Name',
      normalizedAlias: 'global skirt name', supplierId: '', supplierNameSnapshot: '', isActive: true,
    },
  ];

  const options = { productAliases: aliases, suppliers, supplierName: 'Nippon Supplier' };

  expect(matchInboundProduct({ productCode: '000777', productName: 'Supplier Tongue' }, products, options)).toMatchObject({
    productMatchStatus: 'matched', productMatchSource: 'supplier_code_alias', matchedProductId: 'f1', matchedAliasId: 'supplier-code',
  });
  expect(matchInboundProduct({ productCode: '', productName: 'TONGUE SWISS TRO 200DGF' }, products, options)).toMatchObject({
    productMatchStatus: 'matched', productMatchSource: 'name_alias', matchedProductId: 'f1', matchedAliasId: 'supplier-name',
  });
  expect(matchInboundProduct(
    { productCode: '', productName: 'TONGUE SWISS TRO 200DGF' },
    products,
    { productAliases: aliases, suppliers, supplierName: 'Other Supplier' },
  ).productMatchStatus).not.toBe('matched');
  expect(matchInboundProduct(
    { productCode: '', productName: 'Global Skirt Name' },
    products,
    { productAliases: aliases, suppliers, supplierName: 'Other Supplier' },
  )).toMatchObject({ productMatchStatus: 'matched', productMatchSource: 'name_alias', matchedProductId: 'skirt' });

  const inactiveAliases = [
    { ...aliases[1], id: 'inactive-one', productId: 'f1', aliasName: 'Conflict Name', normalizedAlias: 'conflict name', isActive: false },
    { ...aliases[1], id: 'inactive-two', productId: 'gf', aliasName: 'Conflict Name', normalizedAlias: 'conflict name', isActive: false },
  ];
  expect(matchInboundProduct(
    { productName: 'Conflict Name' }, products,
    { productAliases: inactiveAliases, suppliers, supplierName: 'Nippon Supplier' },
  )).toMatchObject({ productMatchStatus: 'review', productMatchSource: 'inactive_alias_conflict', matchedProductId: '' });

  expect(matchInboundProduct({ productName: 'JD F1 Tongue 200day' }, products)).toMatchObject({
    productMatchStatus: 'candidate', productMatchSource: 'candidate', matchedProductId: '',
  });
  expect(matchInboundProduct({ productName: 'JD GF Tongue 200days' }, [products[0]])).toMatchObject({
    productMatchStatus: 'candidate', matchedProductId: '',
  });

  const codeMatch = matchInboundProduct({
    productCode: ' 00123 ', productName: 'Different document name', brand: 'Different brand',
    originCountry: 'Different origin', category: 'Different category',
  }, products, options);
  expect(codeMatch).toMatchObject({
    productMatchStatus: 'matched', productMatchSource: 'product_code', matchedProductId: 'f1',
  });
  expect(codeMatch.differences.map((difference) => difference.field)).toEqual(
    expect.arrayContaining(['productName', 'brand', 'origin', 'category']),
  );
});

test('active alias conflicts and missing targets require review', () => {
  const products = [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }];
  const aliases = [
    { id: 'a', productId: 'one', aliasName: 'Shared Alias', normalizedAlias: 'shared alias', isActive: true },
    { id: 'b', productId: 'two', aliasName: 'Shared Alias', normalizedAlias: 'shared alias', isActive: true },
  ];
  expect(matchInboundProduct({ productName: 'Shared Alias' }, products, { productAliases: aliases })).toMatchObject({
    productMatchStatus: 'review', productMatchSource: 'alias_conflict', matchedProductId: '',
  });
  expect(matchInboundProduct(
    { productName: 'Missing Alias' }, products,
    { productAliases: [{ id: 'missing', productId: 'absent', aliasName: 'Missing Alias', normalizedAlias: 'missing alias', isActive: true }] },
  )).toMatchObject({ productMatchStatus: 'review', productMatchSource: 'alias_conflict' });
});

test('preview and save mapping share the same matcher result', () => {
  const products = [{ id: 'master', name: 'Master Product' }];
  const aliases = [{
    id: 'global', productId: 'master', aliasName: 'Document Product',
    normalizedAlias: 'document product', isActive: true,
  }];
  const preview = matchInboundPreview(
    { supplier: '', lines: [{ productCode: '', productName: 'Document Product' }] },
    products,
    { productAliases: aliases, suppliers: [] },
  );
  const saveMatch = matchInboundLineForPersistence(preview.lines[0], products, {
    productAliases: aliases,
    suppliers: [],
    supplierName: '',
  });
  expect(preview.lines[0]).toMatchObject({
    productMatchStatus: 'matched', productMatchSource: 'name_alias', matchedProductId: 'master',
  });
  expect(saveMatch).toMatchObject({ productId: 'master', status: 'matched', source: 'name_alias' });
});

test('migrated inactive conflicts never auto-match and matcher stays read-only', async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD);
  const writes = [];
  page.on('request', (request) => {
    if (/\/rest\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(`${request.method()} ${request.url()}`);
    }
  });
  await login(page);
  writes.length = 0;

  const result = await page.evaluate(async () => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { matchInboundProduct } = await import('/src/modules/inventory/services/inboundProductMatcher.js');
    const [{ data: products }, { data: aliases }, { data: suppliers }] = await Promise.all([
      supabase.from('products').select('*'),
      supabase.from('product_aliases').select('*').like('source_note', 'migration_conflict:%'),
      supabase.from('suppliers').select('*'),
    ]);
    const matches = (aliases || []).map((alias) => matchInboundProduct(
      { productName: alias.alias_name, supplierName: alias.supplier_name_snapshot },
      products || [],
      { productAliases: aliases || [], suppliers: suppliers || [], supplierName: alias.supplier_name_snapshot },
    ));
    return {
      conflictCount: aliases?.length || 0,
      matchedCount: matches.filter((match) => match.productMatchStatus === 'matched').length,
    };
  });

  expect(result).toEqual({ conflictCount: 18, matchedCount: 0 });
  expect(writes).toEqual([]);
});

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

async function openInbound(page) {
  const group = page.locator('.sidebar-nav-group').nth(4);
  if (!(await group.locator('.sidebar-subnav').isVisible().catch(() => false))) await group.locator('.sidebar-group-button').click();
  await group.locator('.sidebar-subnav button').first().click();
  await page.getByRole('button', { name: '入荷予定', exact: true }).click();
  await expect(page.getByRole('heading', { name: '入荷予定', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '＋ 新しく取り込む' }).click();
  await expect(page.getByRole('heading', { name: '入荷予定を取り込む' })).toBeVisible();
}

async function openProductCheck(page) {
  await expect(page.getByRole('heading', { name: '内容確認', exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '商品確認へ' }).click();
  await expect(page.getByRole('heading', { name: '商品確認', exact: true })).toBeVisible();
}

async function restartImport(page) {
  await page.getByRole('button', { name: '内容確認へ戻る' }).click();
  await page.getByRole('button', { name: '取込をやり直す' }).click();
  await expect(page.locator('.standard-excel-upload-button input[type="file"]')).toBeVisible();
}

async function workbookBuffer(code) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('IMPORT_TEMPLATE');
  sheet.addRow(HEADERS);
  for (const line of [1, 2]) {
    const values = {
      document_type: 'delivery_notice', document_number: 'E2E_MATCH', supplier_name: 'E2E Supplier',
      contract_no: `E2E_${line}`, source_line_no: line, product_code: code,
      product_name: 'E2E Matching Product', brand_name: 'E2E Brand', origin_country: 'E2E Origin',
      category: 'その他', unit_price: '', price_unit: 'KG', total_weight_kg: 10,
      currency: 'JPY', source_file: 'E2E_MATCH.xlsx', confidence: 'high', requires_review: false,
    };
    sheet.addRow(HEADERS.map((header) => values[header] ?? ''));
  }
  return workbook.xlsx.writeBuffer();
}

async function aliasWorkbookBuffer({ supplierName, productName, documentNumber }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('IMPORT_TEMPLATE');
  sheet.addRow(HEADERS);
  for (const line of [1, 2]) {
    const values = {
      document_type: 'delivery_notice', document_number: documentNumber, supplier_name: supplierName,
      contract_no: `${documentNumber}_${line}`, source_line_no: line, product_code: '',
      product_name: productName, brand_name: 'E2E Alias Brand', origin_country: 'E2E Origin',
      category: 'その他', unit_price: '', price_unit: 'KG', total_weight_kg: 10,
      currency: 'JPY', source_file: `${documentNumber}.xlsx`, confidence: 'high', requires_review: false,
    };
    sheet.addRow(HEADERS.map((header) => values[header] ?? ''));
  }
  return workbook.xlsx.writeBuffer();
}

test('preview registers a confirmed alias once and immediately rematches identical lines', async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD);
  const consoleErrors = [];
  const apiErrors = [];
  const writes = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', (response) => {
    if ([400, 404, 500].includes(response.status()) && response.url().includes('supabase')) apiErrors.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', (request) => {
    if (/\/rest\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(`${request.method()} ${request.url()}`);
    }
  });

  await login(page);
  const token = Date.now();
  const fixture = await page.evaluate(async (suffix) => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { data: auth } = await supabase.auth.getUser();
    const { data: product, error: productError } = await supabase
      .from('products').select('id, name, product_code').eq('user_id', auth.user.id).limit(1).single();
    if (productError) throw productError;
    const now = new Date().toISOString();
    const supplier = {
      id: crypto.randomUUID(), user_id: auth.user.id, supplier_code: `E2EALIAS${suffix}`,
      name: `E2E Alias Supplier ${suffix}`, area: '', address: '', phone: '', email: '', website: '',
      tags: [], memo: 'e2e_test', deal_histories: [], created_at: now, updated_at: now,
    };
    const { error: supplierError } = await supabase.from('suppliers').insert(supplier);
    if (supplierError) throw supplierError;
    return { product, supplier };
  }, token);

  await page.reload();
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
  await openInbound(page);
  consoleErrors.length = 0;
  apiErrors.length = 0;
  writes.length = 0;
  const aliasName = `${fixture.product.name} E2E alias ${token}`;
  const workbook = Buffer.from(await aliasWorkbookBuffer({
    supplierName: fixture.supplier.name,
    productName: aliasName,
    documentNumber: `E2E_ALIAS_${token}`,
  }));
  const input = page.locator('.standard-excel-upload-button input[type="file"]');
  await input.setInputFiles({ name: `E2E_ALIAS_${token}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: workbook });
  await openProductCheck(page);
  await expect(page.locator('.delivery-notice-detail-table tbody tr')).toHaveCount(2);
  await expect(page.locator('.delivery-notice-detail-table').getByText(aliasName, { exact: true })).toHaveCount(2);
  await expect(page.locator('.delivery-notice-detail-table').getByRole('button', { name: '同じ商品として登録' }).first()).toBeVisible();

  writes.length = 0;
  await page.locator('.delivery-notice-detail-table').getByRole('button', { name: '同じ商品として登録' }).first().click();
  const dialog = page.getByRole('dialog', { name: '同じ商品として登録' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(fixture.product.name, { exact: true })).toBeVisible();
  await expect(dialog.getByLabel(/この仕入先のみ/)).toBeChecked();
  await expect(dialog.getByLabel(/仕入先商品コードとして登録/)).not.toBeChecked();
  for (const width of [1440, 430, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Aliasを登録' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  }
  await dialog.getByRole('button', { name: 'Aliasを登録' }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('.delivery-notice-detail-table').getByText('照合済み', { exact: true })).toHaveCount(2);
  await expect(page.locator('.delivery-notice-detail-table').getByText('登録済みの表記で確認', { exact: true })).toHaveCount(2);
  await expect(page.locator('.delivery-notice-detail-table').getByText(aliasName, { exact: true })).toHaveCount(2);

  const aliasWrites = writes.filter((entry) => entry.includes('/product_aliases'));
  expect(aliasWrites).toHaveLength(1);
  expect(writes.filter((entry) => !entry.includes('/product_aliases'))).toEqual([]);

  writes.length = 0;
  await restartImport(page);
  await page.locator('.standard-excel-upload-button input[type="file"]').setInputFiles({ name: `E2E_ALIAS_${token}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: workbook });
  await openProductCheck(page);
  await expect(page.locator('.delivery-notice-detail-table').getByText('登録済みの表記で確認', { exact: true })).toHaveCount(2);
  expect(writes).toEqual([]);

  for (const width of [1440, 430, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  }

  const cleanup = await page.evaluate(async ({ supplierId, alias }) => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { data: auth } = await supabase.auth.getUser();
    const { data: rows, error: findError } = await supabase.from('product_aliases')
      .select('id').eq('user_id', auth.user.id).eq('alias_name', alias);
    if (findError) throw findError;
    if (rows.length) {
      const { error } = await supabase.from('product_aliases').update({ is_active: false }).in('id', rows.map((row) => row.id));
      if (error) throw error;
    }
    const { error: supplierError } = await supabase.from('suppliers').delete().eq('id', supplierId);
    if (supplierError) throw supplierError;
    const [{ count: activeAliases, error: aliasCountError }, { count: suppliers, error: supplierCountError }] = await Promise.all([
      supabase.from('product_aliases').select('id', { count: 'exact', head: true }).eq('alias_name', alias).eq('is_active', true),
      supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('id', supplierId),
    ]);
    if (aliasCountError) throw aliasCountError;
    if (supplierCountError) throw supplierCountError;
    return { deactivated: rows.length, activeAliases, suppliers };
  }, { supplierId: fixture.supplier.id, alias: aliasName });
  expect(cleanup).toEqual({ deactivated: 1, activeAliases: 0, suppliers: 0 });
  expect(consoleErrors).toEqual([]);
  expect(apiErrors).toEqual([]);
});

test('HS5220 matching and explicit product creation', async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD || !fs.existsSync(HS5220));
  const consoleErrors = [];
  const apiErrors = [];
  const writes = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', (response) => {
    if ([400, 404, 500].includes(response.status()) && response.url().includes('supabase')) apiErrors.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', (request) => {
    if (/\/rest\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
  });

  await login(page);
  await page.evaluate(async () => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { error } = await supabase.from('products').delete().like('name', 'E2E HS5220 %');
    if (error) throw error;
  });
  const hsCodes = ['122781', '122807', '122808', '122810', '123795', '100081', '109517'];
  const seededIds = await page.evaluate(async (codes) => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { data: auth } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const rows = codes.map((code) => ({
      id: crypto.randomUUID(), user_id: auth.user.id, product_code: code,
      name: `E2E HS5220 ${code}`, category: 'その他', created_at: now, updated_at: now,
    }));
    const { data, error } = await supabase.from('products').insert(rows).select('id');
    if (error) throw error;
    return data.map((item) => item.id);
  }, hsCodes);
  await page.reload();
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
  await openInbound(page);
  consoleErrors.length = 0;
  apiErrors.length = 0;
  writes.length = 0;

  const input = page.locator('.standard-excel-upload-button input[type="file"]');
  await input.setInputFiles(HS5220);
  await openProductCheck(page);
  await expect(page.locator('.delivery-notice-detail-table tbody tr')).toHaveCount(7);
  await expect(page.locator('.delivery-notice-detail-table').getByText('照合済み', { exact: true })).toHaveCount(7);
  expect(writes).toEqual([]);

  const code = `000E2E${Date.now()}`;
  await restartImport(page);
  await page.locator('.standard-excel-upload-button input[type="file"]').setInputFiles({ name: 'E2E_MATCH.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await workbookBuffer(code)) });
  await openProductCheck(page);
  await expect(page.locator('.delivery-notice-detail-table tbody tr')).toHaveCount(2);
  const addProductButtons = page.locator('.delivery-notice-detail-table').getByRole('button', { name: /商品マスタへ追加|別の商品として登録/ });
  await expect(addProductButtons).toHaveCount(2);
  await addProductButtons.first().click();

  const dialog = page.getByRole('dialog', { name: '商品マスタへ追加' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('商品コード')).toHaveValue(code);
  await expect(dialog.getByLabel('商品名')).toHaveValue('E2E Matching Product');
  await expect(dialog.getByRole('textbox', { name: '原価', exact: true })).toHaveValue('');
  await dialog.getByLabel('温度帯').selectOption('冷凍');
  await dialog.getByRole('button', { name: '内容を確認して登録' }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('.delivery-notice-detail-table').getByText('照合済み', { exact: true })).toHaveCount(2);
  await expect(page.locator('.delivery-notice-detail-table').getByRole('button', { name: /商品マスタへ追加|別の商品として登録/ })).toHaveCount(0);

  for (const width of [1440, 430, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  }

  const created = await page.evaluate(async (productCode) => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { data, error } = await supabase.from('products').select('id, product_code, name, cost_price').eq('product_code', productCode).single();
    if (error) throw error;
    return data;
  }, code);
  expect(created).toMatchObject({ product_code: code, name: 'E2E Matching Product', cost_price: null });

  await page.evaluate(async (id) => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  }, created.id);
  await page.evaluate(async (ids) => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { error } = await supabase.from('products').delete().in('id', ids);
    if (error) throw error;
  }, seededIds);
  const remaining = await page.evaluate(async (productCode) => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { count, error } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('product_code', productCode);
    if (error) throw error;
    return count;
  }, code);
  expect(remaining).toBe(0);
  const remainingSeeded = await page.evaluate(async (ids) => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { count, error } = await supabase.from('products').select('id', { count: 'exact', head: true }).in('id', ids);
    if (error) throw error;
    return count;
  }, seededIds);
  expect(remainingSeeded).toBe(0);
  expect(writes.filter((entry) => entry.includes('/products'))).toHaveLength(3);
  expect(consoleErrors).toEqual([]);
  expect(apiErrors).toEqual([]);
});
