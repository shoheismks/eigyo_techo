import { expect, test } from '@playwright/test';
import { replaceProductAlias } from '../src/modules/products/services/productAliasChangeService.js';

test('alias replacement preserves the original on create, deactivate, and activation failures', async () => {
  const original = { id: 'old', aliasName: 'Old alias', isActive: true };
  const next = { id: 'new', aliasName: 'New alias' };

  const createFailureCalls = [];
  await expect(replaceProductAlias({
    originalAlias: original,
    nextAlias: next,
    addProductAlias: async (alias) => {
      createFailureCalls.push(['add', alias]);
      throw new Error('create failed');
    },
    deactivateProductAlias: async (id) => createFailureCalls.push(['deactivate', id]),
  })).rejects.toThrow('create failed');
  expect(createFailureCalls).toHaveLength(1);

  const deactivateFailureCalls = [];
  await expect(replaceProductAlias({
    originalAlias: original,
    nextAlias: next,
    addProductAlias: async (alias) => {
      deactivateFailureCalls.push(['add', alias]);
      return { ...alias, id: alias.id || 'staged' };
    },
    deactivateProductAlias: async (id) => {
      deactivateFailureCalls.push(['deactivate', id]);
      if (id === 'old') throw new Error('deactivate failed');
      return { id, isActive: false };
    },
  })).rejects.toThrow('deactivate failed');
  expect(deactivateFailureCalls).toEqual(expect.arrayContaining([
    ['add', expect.objectContaining({ id: 'old', isActive: true })],
    ['deactivate', 'new'],
  ]));

  const activationFailureCalls = [];
  let addCount = 0;
  await expect(replaceProductAlias({
    originalAlias: original,
    nextAlias: next,
    addProductAlias: async (alias) => {
      addCount += 1;
      activationFailureCalls.push(['add', alias]);
      if (addCount === 2) throw new Error('activation failed');
      return { ...alias, id: alias.id || 'staged' };
    },
    deactivateProductAlias: async (id) => {
      activationFailureCalls.push(['deactivate', id]);
      return { id, isActive: false };
    },
  })).rejects.toThrow('activation failed');
  expect(activationFailureCalls).toEqual(expect.arrayContaining([
    ['add', expect.objectContaining({ id: 'old', isActive: true })],
    ['deactivate', 'new'],
  ]));
});

test('matcher keeps priority and remains fast with hundreds of products and aliases', async () => {
  const { matchInboundPreview } = await import('../src/modules/inventory/services/inboundProductMatcher.js');
  const products = Array.from({ length: 500 }, (_, index) => ({
    id: `product-${index}`,
    productCode: `P${String(index).padStart(5, '0')}`,
    name: `Performance Product ${index}`,
  }));
  const aliases = Array.from({ length: 500 }, (_, index) => ({
    id: `alias-${index}`,
    productId: `product-${index}`,
    aliasName: `Performance Alias ${index}`,
    normalizedAlias: `performance alias ${index}`,
    isActive: true,
  }));
  const lines = Array.from({ length: 50 }, (_, index) => ({
    productCode: index < 25 ? `P${String(index).padStart(5, '0')}` : '',
    productName: index < 25 ? `Conflicting Alias ${index}` : `Performance Alias ${index}`,
  }));
  const startedAt = performance.now();
  const preview = matchInboundPreview({ lines }, products, { productAliases: aliases, suppliers: [] });
  const elapsedMs = performance.now() - startedAt;

  expect(preview.lines.slice(0, 25).every((line) => line.productMatchSource === 'product_code')).toBe(true);
  expect(preview.lines.slice(25).every((line) => line.productMatchSource === 'name_alias')).toBe(true);
  expect(elapsedMs).toBeLessThan(250);
});

const AUTH_EMAIL = process.env.E2E_EMAIL || '';
const AUTH_PASSWORD = process.env.E2E_PASSWORD || '';

async function login(page) {
  await page.goto('/');
  if (await page.locator('.login-card').isVisible().catch(() => false)) {
    await page.locator('input[type="email"]').fill(AUTH_EMAIL);
    await page.locator('input[type="password"]').fill(AUTH_PASSWORD);
    await page.locator('button[type="submit"]').click();
  }
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
}

test.describe('product alias data layer', () => {
  test.skip(!AUTH_EMAIL || !AUTH_PASSWORD, 'E2E credentials are required.');

  test('normalizes, persists, enforces uniqueness, and deactivates aliases', async ({ page }) => {
    await login(page);

    const result = await page.evaluate(async () => {
      const { supabase } = await import('/src/lib/supabase.js');
      const service = await import('/src/modules/products/services/productAliasService.js');
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user?.id || '';
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', userId)
        .limit(2);
      if ((products || []).length < 2) {
        return { skipped: true };
      }

      const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const aliasName = `  ＪＤ　F1‑Tongue / 200DGF ${token}  `;
      const supplierCode = `000${Date.now()}`;
      const createdIds = [];

      try {
        const first = await service.addProductAlias({
          id: `e2e-product-alias-${token}-1`,
          productId: products[0].id,
          aliasName,
          supplierProductCode: supplierCode,
          sourceType: 'e2e_test',
          sourceDocumentType: 'test_fixture',
          sourceNote: 'E2E_PRODUCT_ALIAS_DATA_LAYER',
        }, userId);
        createdIds.push(first.id);

        const loaded = await service.loadProductAliases(userId);
        const selected = loaded.find((item) => item.id === first.id);

        let duplicateAliasRejected = false;
        try {
          await service.addProductAlias({
            id: `e2e-product-alias-${token}-2`,
            productId: products[1].id,
            aliasName,
            supplierProductCode: `${supplierCode}-other`,
          }, userId);
        } catch {
          duplicateAliasRejected = true;
        }

        let duplicateCodeRejected = false;
        try {
          await service.addProductAlias({
            id: `e2e-product-alias-${token}-3`,
            productId: products[1].id,
            aliasName: `Different ${token}`,
            supplierProductCode: supplierCode,
          }, userId);
        } catch {
          duplicateCodeRejected = true;
        }

        const otherContext = await service.addProductAlias({
          id: `e2e-product-alias-${token}-other-context`,
          productId: products[1].id,
          aliasName: `Other context ${token}`,
          supplierNameSnapshot: `E2E Supplier ${token}`,
          supplierProductCode: `00GLOBAL${Date.now()}`,
          sourceType: 'e2e_test',
        }, userId);
        createdIds.push(otherContext.id);

        const deactivated = await service.deactivateProductAlias(first.id, userId);
        await service.deactivateProductAlias(otherContext.id, userId);

        return {
          skipped: false,
          normalized: service.normalizeProductAliasText(aliasName),
          code: selected?.supplierProductCode,
          duplicateAliasRejected,
          duplicateCodeRejected,
          globalSupplierId: first.supplierId,
          deactivated: deactivated.isActive === false,
          sourcePreserved:
            selected?.sourceType === 'e2e_test' &&
            selected?.sourceDocumentType === 'test_fixture',
        };
      } finally {
        for (const id of createdIds) {
          await service.deactivateProductAlias(id, userId).catch(() => {});
        }
      }
    });

    test.skip(result.skipped, 'E2E user needs at least two products.');
    expect(result.normalized).toMatch(/^jd f1-tongue 200dgf /);
    expect(result.code).toMatch(/^000/);
    expect(result.duplicateAliasRejected).toBe(true);
    expect(result.duplicateCodeRejected).toBe(true);
    expect(result.globalSupplierId).toBe('');
    expect(result.deactivated).toBe(true);
    expect(result.sourcePreserved).toBe(true);
  });

  test('legacy alias migration exposes only the current user rows and leaves conflicts inactive', async ({ page }) => {
    await login(page);
    const result = await page.evaluate(async () => {
      const { supabase } = await import('/src/lib/supabase.js');
      const [{ data: legacy, error: legacyError }, { data: migrated, error: migratedError }] = await Promise.all([
        supabase.from('supplier_product_aliases').select('id, product_id, alias_name, supplier_name'),
        supabase.from('product_aliases').select('id, product_id, normalized_alias, supplier_id, supplier_name_snapshot, is_active, source_note')
          .like('id', 'legacy-supplier-alias-%'),
      ]);
      if (legacyError) throw legacyError;
      if (migratedError) throw migratedError;
      const conflicts = migrated.filter((alias) => alias.source_note.startsWith('migration_conflict:'));
      const conflictGroups = new Set(conflicts.map((alias) => [
        alias.supplier_id || alias.supplier_name_snapshot || 'global', alias.normalized_alias,
      ].join('|')));
      const active = migrated.filter((alias) => alias.is_active);
      const activeProductIds = [...new Set(active.map((alias) => alias.product_id))];
      const { data: products, error: productError } = await supabase.from('products').select('id').in('id', activeProductIds);
      if (productError) throw productError;
      const deleteProbeId = migrated[0]?.id || 'missing-product-alias';
      const { error: deleteError } = await supabase.from('product_aliases').delete().eq('id', deleteProbeId);
      return {
        legacyCount: legacy.length,
        migratedCount: migrated.length,
        activeCount: active.length,
        inactiveCount: migrated.filter((alias) => !alias.is_active).length,
        conflictCount: conflicts.length,
        conflictGroupCount: conflictGroups.size,
        activeTargetsExist: products.length === activeProductIds.length,
        deleteRejected: Boolean(deleteError),
      };
    });
    expect(result).toEqual({
      legacyCount: 18,
      migratedCount: 18,
      activeCount: 0,
      inactiveCount: 18,
      conflictCount: 18,
      conflictGroupCount: 3,
      activeTargetsExist: true,
      deleteRejected: true,
    });
  });

  test('backup and restore preserve product alias FK order', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const { createBackupPayload, restoreBackupPayload } = await import(
        '/src/modules/settings/services/backupService.js'
      );
      const order = [];
      const records = {
        products: [{ id: 'product-1' }],
        suppliers: [{ id: 'supplier-1' }],
        productAliases: [{
          id: 'alias-1', productId: 'product-1', supplierId: 'supplier-1',
          aliasName: 'Document Product', normalizedAlias: 'document product',
          supplierNameSnapshot: 'Supplier One', supplierProductCode: '000123',
          normalizedSupplierProductCode: '000123', sourceType: 'product_detail',
          sourceDocumentType: 'delivery_notice', sourceNote: 'DOC-1', normalizationVersion: 1,
          isActive: true, confirmedBy: 'test-user', confirmedAt: '2026-08-28T00:00:00.000Z',
        }],
      };
      const payload = createBackupPayload({ userId: 'test-user', datasets: records });
      const handlers = Object.fromEntries(
        Object.entries(records).map(([key]) => [key, {
          records: [],
          add: async () => order.push(key),
          update: async () => order.push(key),
        }]),
      );
      await restoreBackupPayload(payload, handlers);
      return { order, aliases: payload.datasets.productAliases };
    });

    expect(result.order).toEqual(['products', 'suppliers', 'productAliases']);
    expect(result.aliases[0]).toMatchObject({
      id: 'alias-1', aliasName: 'Document Product', normalizedAlias: 'document product',
      supplierId: 'supplier-1', supplierNameSnapshot: 'Supplier One',
      supplierProductCode: '000123', normalizedSupplierProductCode: '000123',
      sourceType: 'product_detail', sourceDocumentType: 'delivery_notice', sourceNote: 'DOC-1',
      normalizationVersion: 1, isActive: true, confirmedBy: 'test-user',
      confirmedAt: '2026-08-28T00:00:00.000Z',
    });
  });
});
