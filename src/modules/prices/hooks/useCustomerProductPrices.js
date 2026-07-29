import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';
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

const usePriceRecords = createRecordHook({
  tableName: 'customer_product_prices',
  storageKey: PRICE_STORAGE_KEY,
  normalize: normalizeCustomerProductPrice,
  toRow: priceToRow,
  fromRow: priceFromRow,
});

const usePriceHistoryRecords = createRecordHook({
  tableName: 'customer_product_price_history',
  storageKey: HISTORY_STORAGE_KEY,
  normalize: normalizeCustomerProductPriceHistory,
  toRow: historyToRow,
  fromRow: historyFromRow,
});

export function useCustomerProductPrices(userId = '') {
  const pricesHook = usePriceRecords(userId);
  const historyHook = usePriceHistoryRecords(userId);

  function addHistory(action, beforeData, afterData, reason = '') {
    historyHook.addRecord(normalizeCustomerProductPriceHistory({
      customerProductPriceId: afterData?.id || beforeData?.id || '',
      action,
      beforeData,
      afterData,
      reason,
      changedBy: userId,
      userId,
    }, userId));
  }

  function addPrice(price, reason = 'created') {
    const normalized = normalizeCustomerProductPrice(price, userId);
    const id = pricesHook.addRecord(normalized);
    addHistory('created', null, { ...normalized, id }, reason);
    return id;
  }

  function updatePrice(id, updates, reason = 'updated') {
    const before = pricesHook.records.find((item) => item.id === id);
    const after = normalizeCustomerProductPrice({ ...before, ...updates, id }, userId);
    pricesHook.updateRecord(id, after);
    addHistory('updated', before || null, after, reason);
  }

  function deactivatePrice(id, reason = 'deactivated') {
    updatePrice(id, { isActive: false }, reason);
  }

  function removePrice(id, reason = 'deleted') {
    updatePrice(id, { isActive: false, deletedAt: new Date().toISOString() }, reason);
  }

  return {
    records: pricesHook.records,
    history: historyHook.records,
    addRecord: addPrice,
    updateRecord: updatePrice,
    removeRecord: removePrice,
    deactivateRecord: deactivatePrice,
    addHistoryRecord: historyHook.addRecord,
    reload: pricesHook.reload,
    syncState: pricesHook.syncState,
    syncError: pricesHook.syncError,
  };
}
