import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';

export const ADOPTION_STATUSES = ['採用中', '休止中', '終了'];

export const emptyAdoption = {
  userId: '',
  customerId: '',
  productId: '',
  adoptedDate: '',
  status: '採用中',
  monthlyVolume: '',
  sellingPrice: '',
  unit: '',
  grossMarginRate: '',
  memo: '',
};

export function normalizeAdoption(adoption = {}, userId = '') {
  return {
    ...emptyAdoption,
    ...adoption,
    id: adoption.id ?? crypto.randomUUID(),
    userId: adoption.userId ?? userId,
    customerId: adoption.customerId ?? '',
    productId: adoption.productId ?? '',
    status: adoption.status || '採用中',
    createdAt: adoption.createdAt ?? new Date().toISOString(),
    updatedAt: adoption.updatedAt ?? new Date().toISOString(),
  };
}

function toRow(adoption) {
  return {
    id: adoption.id,
    user_id: adoption.userId,
    customer_id: adoption.customerId,
    product_id: adoption.productId,
    adopted_date: adoption.adoptedDate || null,
    status: adoption.status,
    monthly_volume: adoption.monthlyVolume,
    selling_price: adoption.sellingPrice,
    unit: adoption.unit,
    gross_margin_rate: adoption.grossMarginRate,
    memo: adoption.memo,
    created_at: adoption.createdAt,
    updated_at: adoption.updatedAt,
  };
}

function fromRow(row) {
  return normalizeAdoption({
    id: row.id,
    userId: row.user_id,
    customerId: row.customer_id,
    productId: row.product_id,
    adoptedDate: row.adopted_date,
    status: row.status,
    monthlyVolume: row.monthly_volume,
    sellingPrice: row.selling_price,
    unit: row.unit,
    grossMarginRate: row.gross_margin_rate,
    memo: row.memo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const useAdoptions = createRecordHook({
  tableName: 'adoptions',
  storageKey: 'eigyo-techo-adoptions',
  normalize: normalizeAdoption,
  toRow,
  fromRow,
});
