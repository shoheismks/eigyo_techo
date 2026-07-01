import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';

export const SAMPLE_STATUSES = ['発送前', '発送済', '到着済', '評価待ち', '採用', '不採用', '保留'];

export const emptySample = {
  userId: '',
  customerId: '',
  contactIds: [],
  productIds: [],
  sampleName: '',
  shippedDate: '',
  arrivalDate: '',
  followUpDate: '',
  status: '発送前',
  feedback: '',
  nextAction: '',
  shippingMethod: '',
  trackingNumber: '',
  memo: '',
  createdBy: '',
  createdByName: '',
};

export function normalizeSample(sample = {}, userId = '') {
  return {
    ...emptySample,
    ...sample,
    id: sample.id ?? crypto.randomUUID(),
    userId: sample.userId ?? userId,
    customerId: sample.customerId ?? '',
    contactIds: Array.isArray(sample.contactIds) ? sample.contactIds : [],
    productIds: Array.isArray(sample.productIds) ? sample.productIds : [],
    status: sample.status || '発送前',
    createdBy: sample.createdBy ?? userId,
    createdByName: sample.createdByName ?? '',
    createdAt: sample.createdAt ?? new Date().toISOString(),
    updatedAt: sample.updatedAt ?? new Date().toISOString(),
  };
}

function toRow(sample) {
  return {
    id: sample.id,
    user_id: sample.userId,
    customer_id: sample.customerId,
    contact_ids: sample.contactIds,
    product_ids: sample.productIds,
    sample_name: sample.sampleName,
    shipped_date: sample.shippedDate || null,
    arrival_date: sample.arrivalDate || null,
    follow_up_date: sample.followUpDate || null,
    status: sample.status,
    feedback: sample.feedback,
    next_action: sample.nextAction,
    shipping_method: sample.shippingMethod,
    tracking_number: sample.trackingNumber,
    memo: sample.memo,
    created_by: sample.createdBy,
    created_by_name: sample.createdByName,
    created_at: sample.createdAt,
    updated_at: sample.updatedAt,
  };
}

function fromRow(row) {
  return normalizeSample({
    id: row.id,
    userId: row.user_id,
    customerId: row.customer_id,
    contactIds: row.contact_ids,
    productIds: row.product_ids,
    sampleName: row.sample_name,
    shippedDate: row.shipped_date,
    arrivalDate: row.arrival_date,
    followUpDate: row.follow_up_date,
    status: row.status,
    feedback: row.feedback,
    nextAction: row.next_action,
    shippingMethod: row.shipping_method,
    trackingNumber: row.tracking_number,
    memo: row.memo,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const useSamples = createRecordHook({
  tableName: 'samples',
  storageKey: 'eigyo-techo-samples',
  normalize: normalizeSample,
  toRow,
  fromRow,
});
