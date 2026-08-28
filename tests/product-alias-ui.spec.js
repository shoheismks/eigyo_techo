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

async function openProducts(page) {
  const group = page.locator('.sidebar-nav-group').nth(3);
  if (!(await group.locator('.sidebar-subnav').isVisible().catch(() => false))) await group.locator('.sidebar-group-button').click();
  await group.locator('.sidebar-subnav button').first().click();
  await expect(page.locator('.products-common-table')).toBeVisible();
}

test('product detail manages supplier and global aliases without updating products', async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD);
  test.setTimeout(60_000);
  const token = Date.now();
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
  const fixture = await page.evaluate(async (suffix) => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { data: auth } = await supabase.auth.getUser();
    const { data: staleAliases, error: staleAliasFindError } = await supabase.from('product_aliases')
      .select('id').eq('user_id', auth.user.id).or('alias_name.like.E2E Supplier Alias %,alias_name.like.E2E Global Alias %');
    if (staleAliasFindError) throw staleAliasFindError;
    if (staleAliases.length) {
      const { error: staleAliasError } = await supabase.from('product_aliases')
        .update({ is_active: false }).in('id', staleAliases.map((item) => item.id));
      if (staleAliasError) throw staleAliasError;
    }
    const { data: staleSuppliers, error: staleFindError } = await supabase.from('suppliers')
      .select('id').eq('user_id', auth.user.id).like('name', 'E2E Product Alias Supplier %');
    if (staleFindError) throw staleFindError;
    if (staleSuppliers.length) {
      const { error: staleDeleteError } = await supabase.from('suppliers').delete().in('id', staleSuppliers.map((item) => item.id));
      if (staleDeleteError) throw staleDeleteError;
    }
    const { data: products, error: productError } = await supabase.from('products')
      .select('id, name, product_code').eq('user_id', auth.user.id).limit(2);
    if (productError) throw productError;
    if (products.length < 2) throw new Error('E2E user requires two products.');
    const now = new Date().toISOString();
    const supplier = {
      id: crypto.randomUUID(), user_id: auth.user.id, supplier_code: `E2EPA${suffix}`,
      name: `E2E Product Alias Supplier ${suffix}`, area: '', address: '', phone: '', email: '', website: '',
      tags: [], memo: 'e2e_test', deal_histories: [], created_at: now, updated_at: now,
    };
    const { error: supplierError } = await supabase.from('suppliers').insert(supplier);
    if (supplierError) throw supplierError;
    return { products, supplier };
  }, token);

  await page.reload();
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
  await openProducts(page);
  await page.locator('.products-common-table .desktop-table-actions button').first().click();
  await expect(page.getByRole('heading', { name: '商品名・仕入先表記' })).toBeVisible();
  consoleErrors.length = 0;
  apiErrors.length = 0;
  writes.length = 0;

  const supplierAlias = `E2E Supplier Alias ${token}`;
  await page.getByRole('button', { name: '商品表記を追加' }).click();
  let dialog = page.getByRole('dialog', { name: '商品表記を追加' });
  await dialog.getByLabel('商品表記').fill(supplierAlias);
  await dialog.getByLabel('仕入先', { exact: true }).selectOption(fixture.supplier.id);
  await dialog.getByLabel('仕入先商品コード', { exact: true }).fill('000123');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toBeHidden();
  let card = page.locator('.product-alias-card').filter({ hasText: supplierAlias }).first();
  await expect(card).toContainText('000123');
  await expect(card).toContainText('この仕入先のみ');

  const matchedBeforeDeactivate = await page.evaluate(async ({ alias, supplierName }) => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { matchInboundProduct } = await import('/src/modules/inventory/services/inboundProductMatcher.js');
    const [{ data: products }, { data: aliases }, { data: suppliers }] = await Promise.all([
      supabase.from('products').select('*'), supabase.from('product_aliases').select('*'), supabase.from('suppliers').select('*'),
    ]);
    return matchInboundProduct({ productName: alias, supplierName }, products, { productAliases: aliases, suppliers, supplierName });
  }, { alias: supplierAlias, supplierName: fixture.supplier.name });
  expect(matchedBeforeDeactivate).toMatchObject({ productMatchStatus: 'matched', productMatchSource: 'name_alias' });

  await card.getByRole('button', { name: '解除', exact: true }).click();
  const deactivateDialog = page.getByRole('dialog', { name: 'この商品表記の紐付けを解除しますか？' });
  await deactivateDialog.getByRole('button', { name: '解除する' }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: /解除済みを表示/ }).click();
  await expect(page.locator('.product-alias-list.inactive').filter({ hasText: supplierAlias })).toBeVisible();

  const matchedAfterDeactivate = await page.evaluate(async ({ alias, supplierName }) => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { matchInboundProduct } = await import('/src/modules/inventory/services/inboundProductMatcher.js');
    const [{ data: products }, { data: aliases }, { data: suppliers }] = await Promise.all([
      supabase.from('products').select('*'), supabase.from('product_aliases').select('*'), supabase.from('suppliers').select('*'),
    ]);
    return matchInboundProduct({ productName: alias, supplierName }, products, { productAliases: aliases, suppliers, supplierName });
  }, { alias: supplierAlias, supplierName: fixture.supplier.name });
  expect(matchedAfterDeactivate.productMatchStatus).not.toBe('matched');

  const globalAlias = `E2E Global Alias ${token}`;
  await page.getByRole('button', { name: '商品表記を追加' }).click();
  dialog = page.getByRole('dialog', { name: '商品表記を追加' });
  await dialog.getByLabel('商品表記').fill(globalAlias);
  await dialog.getByLabel('すべての仕入先').check();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog.getByText('すべての仕入先へ適用することを確認してください。')).toBeVisible();
  await dialog.getByLabel('影響範囲を確認しました').check();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toBeHidden();
  card = page.locator('.product-alias-card').filter({ hasText: globalAlias }).first();
  await expect(card).toContainText('すべての仕入先');

  await card.getByRole('button', { name: '修正・別商品へ変更' }).click();
  dialog = page.getByRole('dialog', { name: '商品表記を修正' });
  const revisedAlias = `${globalAlias} revised`;
  await dialog.getByLabel('商品表記').fill(revisedAlias);
  await dialog.getByLabel('影響範囲を確認しました').check();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  card = page.locator('.product-alias-card').filter({ hasText: revisedAlias }).first();
  await expect(card).toBeVisible();

  await card.getByRole('button', { name: '修正・別商品へ変更' }).click();
  dialog = page.getByRole('dialog', { name: '商品表記を修正' });
  await dialog.getByLabel('紐付け先商品').selectOption(fixture.products[1].id);
  await expect(dialog.getByText(`変更先: ${fixture.products[1].name}`)).toBeVisible();
  await dialog.getByLabel('影響範囲を確認しました').check();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('.product-alias-list:not(.inactive)').filter({ hasText: revisedAlias })).toHaveCount(0);

  const writesBeforeConflict = writes.length;
  await page.getByRole('button', { name: '商品表記を追加' }).click();
  dialog = page.getByRole('dialog', { name: '商品表記を追加' });
  await dialog.getByLabel('商品表記').fill(revisedAlias);
  await dialog.getByLabel('すべての仕入先').check();
  await dialog.getByLabel('影響範囲を確認しました').check();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog.getByText(/すでに「.*」に登録されています/)).toBeVisible();
  expect(writes).toHaveLength(writesBeforeConflict);
  await dialog.getByRole('button', { name: '閉じる' }).click();

  for (const width of [1440, 430, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: '商品表記を追加' }).click();
    dialog = page.getByRole('dialog', { name: '商品表記を追加' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: '保存', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await dialog.getByRole('button', { name: '閉じる' }).click();
  }

  const aliasRows = await page.evaluate(async ({ names, targetId }) => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { data, error } = await supabase.from('product_aliases').select('*').in('alias_name', names);
    if (error) throw error;
    return { rows: data, moved: data.find((row) => row.alias_name === names[2] && row.is_active)?.product_id === targetId };
  }, { names: [supplierAlias, globalAlias, revisedAlias], targetId: fixture.products[1].id });
  expect(aliasRows.moved).toBe(true);
  expect(aliasRows.rows.find((row) => row.alias_name === supplierAlias)).toMatchObject({ supplier_id: fixture.supplier.id, supplier_product_code: '000123', is_active: false });

  const productWrites = writes.filter((entry) => /\/rest\/v1\/products(?:\?|$)/.test(entry));
  const supplierWrites = writes.filter((entry) => /\/rest\/v1\/suppliers(?:\?|$)/.test(entry));
  const aliasDeletes = writes.filter((entry) => entry.startsWith('DELETE ') && entry.includes('/product_aliases'));
  expect(productWrites).toEqual([]);
  expect(supplierWrites).toEqual([]);
  expect(aliasDeletes).toEqual([]);

  const cleanup = await page.evaluate(async ({ supplierId, ids }) => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { error: aliasError } = await supabase.from('product_aliases').update({ is_active: false }).in('id', ids);
    if (aliasError) throw aliasError;
    const { error: supplierError } = await supabase.from('suppliers').delete().eq('id', supplierId);
    if (supplierError) throw supplierError;
    const { count, error } = await supabase.from('product_aliases').select('id', { count: 'exact', head: true }).in('id', ids).eq('is_active', true);
    if (error) throw error;
    return count;
  }, { supplierId: fixture.supplier.id, ids: aliasRows.rows.map((row) => row.id) });
  expect(cleanup).toBe(0);
  expect(consoleErrors).toEqual([]);
  expect(apiErrors).toEqual([]);
});
