import { useCallback, useEffect, useMemo, useState } from 'react';
import { canUseCloud, fetchRecords, upsertRecords } from '../../../shared/services/recordSyncService.js';
import { normalizePriceNumber } from '../services/customerProductPriceService.js';

const PRICE_STORAGE_KEY = 'eigyo-techo-customer-product-prices';
const HISTORY_STORAGE_KEY = 'eigyo-techo-customer-product-price-history';

export const emptyCustomerProductPrice = {
  userId: '',
  customerId: '',
  parentCustomerId: '',
  productId: '',
  brandId: '',
  priceType: 'regular',
  unitPrice: '',
  priceUnit: 'kg',
  currency: 'JPY',
  taxRate: '8',
  minimumQuantity: '',
  maximumQuantity: '',
  validFrom: '',
  validTo: '',
  priority: 0,
  notes: '',
  applyToChildCustomers: false,
  officeScope: 'customer',
  casePrice: '',
  kgPrice: '',
  piecePrice: '',
  packPrice: '',
  isActive: true,
  deletedAt: '',
  createdAt: '',
  updatedAt: '',
};

export function normalizeCustomerProductPrice(price = {}, userId = '') {
  return {
    ...emptyCustomerProductPrice,
    ...price,
    id: price.id ?? crypto.randomUUID(),
    userId: price.userId ?? price.user_id ?? userId,
    customerId: price.customerId ?? price.customer_id ?? '',
    parentCustomerId: price.parentCustomerId ?? price.parent_customer_id ?? '',
    productId: price.productId ?? price.product_id ?? '',
    brandId: price.brandId ?? price.brand_id ?? '',
    priceType: price.priceType ?? price.price_type ?? 'regular',
    unitPrice: normalizePriceNumber(price.unitPrice ?? price.unit_price ?? ''),
    priceUnit: price.priceUnit ?? price.price_unit ?? 'kg',
    currency: price.currency ?? 'JPY',
    taxRate: price.taxRate ?? price.tax_rate ?? '8',
    minimumQuantity: normalizePriceNumber(price.minimumQuantity ?? price.minimum_quantity ?? ''),
    maximumQuantity: normalizePriceNumber(price.maximumQuantity ?? price.maximum_quantity ?? ''),
    validFrom: price.validFrom ?? price.valid_from ?? '',
    validTo: price.validTo ?? price.valid_to ?? '',
    priority: Number(price.priority ?? 0),
    notes: price.notes ?? '',
    applyToChildCustomers: Boolean(price.applyToChildCustomers ?? price.apply_to_child_customers ?? false),
    officeScope: price.officeScope ?? price.office_scope ?? 'customer',
    casePrice: normalizePriceNumber(price.casePrice ?? price.case_price ?? ''),
    kgPrice: normalizePriceNumber(price.kgPrice ?? price.kg_price ?? ''),
    piecePrice: normalizePriceNumber(price.piecePrice ?? price.piece_price ?? ''),
    packPrice: normalizePriceNumber(price.packPrice ?? price.pack_price ?? ''),
    isActive: Boolean(price.isActive ?? price.is_active ?? true),
    deletedAt: price.deletedAt ?? price.deleted_at ?? '',
    createdAt: price.createdAt ?? price.created_at ?? new Date().toISOString(),
    updatedAt: price.updatedAt ?? price.updated_at ?? new Date().toISOString(),
  };
}

function priceToRow(price) {
  return {
    id: price.id,
    user_id: price.userId,
    customer_id: price.customerId || null,
    parent_customer_id: price.parentCustomerId || null,
    product_id: price.productId || null,
    brand_id: price.brandId || null,
    price_type: price.priceType,
    unit_price: price.unitPrice === '' ? null : price.unitPrice,
    price_unit: price.priceUnit,
    currency: price.currency,
    tax_rate: price.taxRate === '' ? null : Number(price.taxRate),
    minimum_quantity: price.minimumQuantity === '' ? null : price.minimumQuantity,
    maximum_quantity: price.maximumQuantity === '' ? null : price.maximumQuantity,
    valid_from: price.validFrom || null,
    valid_to: price.validTo || null,
    priority: price.priority,
    notes: price.notes,
    apply_to_child_customers: price.applyToChildCustomers,
    office_scope: price.officeScope,
    case_price: price.casePrice === '' ? null : price.casePrice,
    kg_price: price.kgPrice === '' ? null : price.kgPrice,
    piece_price: price.piecePrice === '' ? null : price.piecePrice,
    pack_price: price.packPrice === '' ? null : price.packPrice,
    is_active: price.isActive,
    deleted_at: price.deletedAt || null,
    created_at: price.createdAt,
    updated_at: price.updatedAt,
  };
}

function priceFromRow(row) {
  return normalizeCustomerProductPrice(row, row.user_id);
}

export const emptyCustomerProductPriceHistory = {
  userId: '',
  customerProductPriceId: '',
  action: 'updated',
  beforeData: null,
  afterData: null,
  reason: '',
  changedBy: '',
  createdAt: '',
};

export function normalizeCustomerProductPriceHistory(entry = {}, userId = '') {
  return {
    ...emptyCustomerProductPriceHistory,
    ...entry,
    id: entry.id ?? crypto.randomUUID(),
    userId: entry.userId ?? entry.user_id ?? userId,
    customerProductPriceId: entry.customerProductPriceId ?? entry.customer_product_price_id ?? '',
    action: entry.action ?? 'updated',
    beforeData: entry.beforeData ?? entry.before_data ?? null,
    afterData: entry.afterData ?? entry.after_data ?? null,
    reason: entry.reason ?? '',
    changedBy: entry.changedBy ?? entry.changed_by ?? userId,
    createdAt: entry.createdAt ?? entry.created_at ?? new Date().toISOString(),
  };
}

function historyToRow(entry) {
  return {
    id: entry.id,
    user_id: entry.userId,
    customer_product_price_id: entry.customerProductPriceId,
    action: entry.action,
    before_data: entry.beforeData,
    after_data: entry.afterData,
    reason: entry.reason,
    changed_by: entry.changedBy || null,
    created_at: entry.createdAt,
  };
}

function historyFromRow(row) {
  return normalizeCustomerProductPriceHistory(row, row.user_id);
}

function hasLegacyLocalRecords(storageKey) {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return Boolean(localStorage.getItem(storageKey));
  }
}

function cloudRequiredMessage() {
  if (!canUseCloud()) {
    return 'Supabaseに接続できないため、顧客別価格は保存できません。ネットワークと設定を確認してください。';
  }

  return '';
}

export function useCustomerProductPrices(userId = '') {
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [syncState, setSyncState] = useState(canUseCloud() ? 'syncing' : 'error');
  const [syncError, setSyncError] = useState('');
  const [legacyLocalDataWarning] = useState(() =>
    hasLegacyLocalRecords(PRICE_STORAGE_KEY) || hasLegacyLocalRecords(HISTORY_STORAGE_KEY)
      ? '旧ローカルデータがあります。安全のため自動移行は行いません。必要な場合は管理者が確認してください。'
      : '',
  );

  const sortByUpdatedAt = useCallback((items) =>
    [...items].sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))),
  []);

  const sortHistory = useCallback((items) =>
    [...items].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
  []);

  const reload = useCallback(async () => {
    const unavailableMessage = cloudRequiredMessage();
    if (unavailableMessage) {
      setRecords([]);
      setHistory([]);
      setSyncState('error');
      setSyncError(unavailableMessage);
      return;
    }

    try {
      setSyncState('syncing');
      setSyncError('');
      const [remotePrices, remoteHistory] = await Promise.all([
        fetchRecords('customer_product_prices', userId, priceFromRow, 'updated_at'),
        fetchRecords('customer_product_price_history', userId, historyFromRow, 'created_at'),
      ]);
      setRecords(sortByUpdatedAt(remotePrices.map((price) => normalizeCustomerProductPrice(price, userId))));
      setHistory(sortHistory(remoteHistory.map((entry) => normalizeCustomerProductPriceHistory(entry, userId))));
      setSyncState('supabase');
    } catch (error) {
      setRecords([]);
      setHistory([]);
      setSyncState('error');
      setSyncError(error.message || '顧客別価格の取得に失敗しました。');
    }
  }, [sortByUpdatedAt, sortHistory, userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const recordsById = useMemo(() => new Map(records.map((price) => [price.id, price])), [records]);

  async function persistPrice(price) {
    const unavailableMessage = cloudRequiredMessage();
    if (unavailableMessage) {
      setSyncState('error');
      setSyncError(unavailableMessage);
      throw new Error(unavailableMessage);
    }

    try {
      setSyncState('syncing');
      setSyncError('');
      await upsertRecords('customer_product_prices', [price], priceToRow);
      setSyncState('supabase');
    } catch (error) {
      setSyncState('error');
      setSyncError(error.message || '顧客別価格の保存に失敗しました。');
      throw error;
    }
  }

  async function persistHistory(entry) {
    const unavailableMessage = cloudRequiredMessage();
    if (unavailableMessage) {
      setSyncState('error');
      setSyncError(unavailableMessage);
      throw new Error(unavailableMessage);
    }

    try {
      setSyncState('syncing');
      setSyncError('');
      await upsertRecords('customer_product_price_history', [entry], historyToRow);
      setSyncState('supabase');
    } catch (error) {
      setSyncState('error');
      setSyncError(error.message || '価格履歴の保存に失敗しました。');
      throw error;
    }
  }

  async function addHistory(action, beforeData, afterData, reason = '') {
    const entry = normalizeCustomerProductPriceHistory({
      customerProductPriceId: afterData?.id || beforeData?.id || '',
      action,
      beforeData,
      afterData,
      reason,
      changedBy: userId,
      userId,
    }, userId);

    await persistHistory(entry);
    setHistory((current) => sortHistory([entry, ...current]));
    return entry.id;
  }

  async function addPrice(price, reason = 'created') {
    const now = new Date().toISOString();
    const normalized = normalizeCustomerProductPrice({
      ...price,
      id: price.id ?? crypto.randomUUID(),
      userId,
      createdAt: price.createdAt || now,
      updatedAt: now,
    }, userId);

    await persistPrice(normalized);
    await addHistory('created', null, normalized, reason);
    setRecords((current) => sortByUpdatedAt([normalized, ...current.filter((item) => item.id !== normalized.id)]));
    return normalized.id;
  }

  async function updatePrice(id, updates, reason = 'updated') {
    const before = recordsById.get(id);
    const after = normalizeCustomerProductPrice({
      ...before,
      ...updates,
      id,
      userId,
      updatedAt: new Date().toISOString(),
    }, userId);

    await persistPrice(after);
    await addHistory('updated', before || null, after, reason);
    setRecords((current) => sortByUpdatedAt(current.map((item) => (item.id === id ? after : item))));
  }

  async function deactivatePrice(id, reason = 'deactivated') {
    await updatePrice(id, { isActive: false }, reason);
  }

  async function removePrice(id, reason = 'deleted') {
    await updatePrice(id, { isActive: false, deletedAt: new Date().toISOString() }, reason);
  }

  return {
    records,
    history,
    addRecord: addPrice,
    updateRecord: updatePrice,
    removeRecord: removePrice,
    deactivateRecord: deactivatePrice,
    addHistoryRecord: async (entry) => {
      const normalized = normalizeCustomerProductPriceHistory(entry, userId);
      await persistHistory(normalized);
      setHistory((current) => sortHistory([normalized, ...current]));
      return normalized.id;
    },
    reload,
    syncState,
    syncError,
    legacyLocalDataWarning,
  };
}
