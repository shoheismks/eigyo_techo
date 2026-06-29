import { createRecordHook } from './useSupabaseRecords.js';

export function normalizeComplaint(complaint = {}, userId = '') {
  return {
    id: complaint.id ?? crypto.randomUUID(),
    userId: complaint.userId ?? userId,
    customerId: complaint.customerId ?? '',
    customerName: complaint.customerName ?? '',
    title: complaint.title ?? '',
    status: complaint.status ?? '未対応',
    severity: complaint.severity ?? '通常',
    memo: complaint.memo ?? '',
    createdBy: complaint.createdBy ?? userId,
    createdByName: complaint.createdByName ?? '',
    attachments: Array.isArray(complaint.attachments) ? complaint.attachments : [],
    createdAt: complaint.createdAt ?? new Date().toISOString(),
    updatedAt: complaint.updatedAt ?? new Date().toISOString(),
  };
}

function toRow(complaint) {
  return {
    id: complaint.id,
    user_id: complaint.userId,
    customer_id: complaint.customerId,
    customer_name: complaint.customerName,
    title: complaint.title,
    status: complaint.status,
    severity: complaint.severity,
    memo: complaint.memo,
    created_by: complaint.createdBy,
    created_by_name: complaint.createdByName,
    attachments: complaint.attachments,
    created_at: complaint.createdAt,
    updated_at: complaint.updatedAt,
  };
}

function fromRow(row) {
  return normalizeComplaint({
    id: row.id,
    userId: row.user_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    title: row.title,
    status: row.status,
    severity: row.severity,
    memo: row.memo,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    attachments: row.attachments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const useComplaints = createRecordHook({
  tableName: 'complaints',
  storageKey: 'eigyo-techo-complaints',
  normalize: normalizeComplaint,
  toRow,
  fromRow,
});
