import { supabase } from '../../../lib/supabase.js';
import { fetchRecords, upsertRecords } from '../../../shared/services/recordSyncService.js';
import {
  PRODUCT_ALIAS_NORMALIZATION_VERSION,
  normalizeProductAliasText,
  normalizeSupplierProductCode,
} from './productAliasNormalization.js';

export {
  PRODUCT_ALIAS_NORMALIZATION_VERSION,
  normalizeProductAliasText,
  normalizeSupplierProductCode,
} from './productAliasNormalization.js';

const TABLE_NAME = 'product_aliases';

export function normalizeProductAlias(alias = {}, userId = '') {
  const now = new Date().toISOString();
  const aliasName = String(alias.aliasName ?? alias.alias_name ?? '').trim();
  const supplierProductCode = String(
    alias.supplierProductCode ?? alias.supplier_product_code ?? '',
  ).trim();

  return {
    id: alias.id ?? crypto.randomUUID(),
    userId: alias.userId ?? alias.user_id ?? userId,
    productId: alias.productId ?? alias.product_id ?? '',
    aliasName,
    normalizedAlias: normalizeProductAliasText(aliasName),
    supplierId: alias.supplierId ?? alias.supplier_id ?? '',
    supplierNameSnapshot: alias.supplierNameSnapshot ?? alias.supplier_name_snapshot ?? '',
    supplierProductCode,
    normalizedSupplierProductCode: normalizeSupplierProductCode(supplierProductCode),
    sourceType: alias.sourceType ?? alias.source_type ?? '',
    sourceDocumentType: alias.sourceDocumentType ?? alias.source_document_type ?? '',
    sourceNote: alias.sourceNote ?? alias.source_note ?? '',
    normalizationVersion:
      Number(alias.normalizationVersion ?? alias.normalization_version) ||
      PRODUCT_ALIAS_NORMALIZATION_VERSION,
    isActive: alias.isActive ?? alias.is_active ?? true,
    confirmedBy: alias.confirmedBy ?? alias.confirmed_by ?? userId,
    confirmedAt: alias.confirmedAt ?? alias.confirmed_at ?? now,
    createdAt: alias.createdAt ?? alias.created_at ?? now,
    updatedAt: alias.updatedAt ?? alias.updated_at ?? now,
  };
}

function toRow(alias) {
  return {
    id: alias.id,
    user_id: alias.userId,
    product_id: alias.productId,
    alias_name: alias.aliasName,
    normalized_alias: alias.normalizedAlias,
    supplier_id: alias.supplierId || null,
    supplier_name_snapshot: alias.supplierNameSnapshot,
    supplier_product_code: alias.supplierProductCode,
    normalized_supplier_product_code: alias.normalizedSupplierProductCode,
    source_type: alias.sourceType,
    source_document_type: alias.sourceDocumentType,
    source_note: alias.sourceNote,
    normalization_version: alias.normalizationVersion,
    is_active: alias.isActive,
    confirmed_by: alias.confirmedBy || null,
    confirmed_at: alias.confirmedAt,
    created_at: alias.createdAt,
    updated_at: alias.updatedAt,
  };
}

export async function loadProductAliases(userId = '') {
  return fetchRecords(TABLE_NAME, userId, (row) => normalizeProductAlias(row, userId));
}

export async function addProductAlias(alias, userId = '') {
  const normalized = normalizeProductAlias(alias, userId);
  if (!normalized.userId || !normalized.productId || !normalized.normalizedAlias) {
    throw new Error('User, product, and alias name are required.');
  }

  await upsertRecords(TABLE_NAME, [normalized], toRow);
  return normalized;
}

export async function deactivateProductAlias(aliasId, userId = '') {
  if (!aliasId || !userId) {
    throw new Error('Alias and user are required.');
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', aliasId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return normalizeProductAlias(data, userId);
}
