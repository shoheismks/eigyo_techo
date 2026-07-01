import { createRecordHook } from '../shared/hooks/useSupabaseRecords.js';

export const emptySupplier = {
  userId: '',
  name: '',
  area: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  tags: [],
  memo: '',
  dealHistories: [],
};

export function normalizeSupplier(supplier = {}, userId = '') {
  return {
    ...emptySupplier,
    ...supplier,
    id: supplier.id ?? crypto.randomUUID(),
    userId: supplier.userId ?? userId,
    tags: Array.isArray(supplier.tags) ? supplier.tags : [],
    dealHistories: Array.isArray(supplier.dealHistories) ? supplier.dealHistories : [],
    createdAt: supplier.createdAt ?? new Date().toISOString(),
    updatedAt: supplier.updatedAt ?? new Date().toISOString(),
  };
}

function toRow(supplier) {
  return {
    id: supplier.id,
    user_id: supplier.userId,
    name: supplier.name,
    area: supplier.area,
    address: supplier.address,
    phone: supplier.phone,
    email: supplier.email,
    website: supplier.website,
    tags: supplier.tags,
    memo: supplier.memo,
    deal_histories: supplier.dealHistories,
    created_at: supplier.createdAt,
    updated_at: supplier.updatedAt,
  };
}

function fromRow(row) {
  return normalizeSupplier({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    area: row.area,
    address: row.address,
    phone: row.phone,
    email: row.email,
    website: row.website,
    tags: row.tags,
    memo: row.memo,
    dealHistories: row.deal_histories,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const useSuppliers = createRecordHook({
  tableName: 'suppliers',
  storageKey: 'eigyo-techo-suppliers',
  normalize: normalizeSupplier,
  toRow,
  fromRow,
});
