import { createRecordHook } from '../shared/hooks/useSupabaseRecords.js';

export const QUOTE_STATUSES = ['作成中', '提出済', '再見積', '採用', '失注', '期限切れ'];

export const emptyQuote = {
  userId: '',
  customerId: '',
  supplierId: '',
  productIds: [],
  contactIds: [],
  quoteNumber: '',
  submittedDate: '',
  validUntil: '',
  currency: 'JPY',
  totalAmount: '',
  grossMarginRate: '',
  status: '提出済',
  fileUrl: '',
  fileName: '',
  memo: '',
  lostReason: '',
  createdBy: '',
  createdByName: '',
};

export function normalizeQuote(quote = {}, userId = '') {
  return {
    ...emptyQuote,
    ...quote,
    id: quote.id ?? crypto.randomUUID(),
    userId: quote.userId ?? userId,
    customerId: quote.customerId ?? '',
    supplierId: quote.supplierId ?? '',
    productIds: Array.isArray(quote.productIds) ? quote.productIds : [],
    contactIds: Array.isArray(quote.contactIds) ? quote.contactIds : [],
    currency: quote.currency || 'JPY',
    status: quote.status || '提出済',
    createdBy: quote.createdBy ?? userId,
    createdByName: quote.createdByName ?? '',
    createdAt: quote.createdAt ?? new Date().toISOString(),
    updatedAt: quote.updatedAt ?? new Date().toISOString(),
  };
}

function toRow(quote) {
  return {
    id: quote.id,
    user_id: quote.userId,
    customer_id: quote.customerId,
    supplier_id: quote.supplierId,
    product_ids: quote.productIds,
    contact_ids: quote.contactIds,
    quote_number: quote.quoteNumber,
    submitted_date: quote.submittedDate || null,
    valid_until: quote.validUntil || null,
    currency: quote.currency,
    total_amount: quote.totalAmount === '' ? null : quote.totalAmount,
    gross_margin_rate: quote.grossMarginRate,
    status: quote.status,
    file_url: quote.fileUrl,
    file_name: quote.fileName,
    memo: quote.memo,
    lost_reason: quote.lostReason,
    created_by: quote.createdBy,
    created_by_name: quote.createdByName,
    created_at: quote.createdAt,
    updated_at: quote.updatedAt,
  };
}

function fromRow(row) {
  return normalizeQuote({
    id: row.id,
    userId: row.user_id,
    customerId: row.customer_id,
    supplierId: row.supplier_id,
    productIds: row.product_ids,
    contactIds: row.contact_ids,
    quoteNumber: row.quote_number,
    submittedDate: row.submitted_date,
    validUntil: row.valid_until,
    currency: row.currency,
    totalAmount: row.total_amount ?? '',
    grossMarginRate: row.gross_margin_rate,
    status: row.status,
    fileUrl: row.file_url,
    fileName: row.file_name,
    memo: row.memo,
    lostReason: row.lost_reason,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const useQuotes = createRecordHook({
  tableName: 'quotes',
  storageKey: 'eigyo-techo-quotes',
  normalize: normalizeQuote,
  toRow,
  fromRow,
});
