import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';
import { parsePrice } from '../../products/hooks/useProducts.js';

export const QUOTE_STATUSES = ['作成中', '提出済', '採用', '失注', '期限切れ'];

export function emptyQuoteLine() {
  return {
    id: crypto.randomUUID(),
    productId: '',
    inventoryId: '',
    description: '',
    quantity: '',
    unit: 'kg',
    unitPrice: '',
    costPrice: '',
    amount: '',
    costAmount: '',
    grossMarginAmount: '',
    grossMarginRate: '',
    memo: '',
  };
}

export const emptyQuote = {
  userId: '',
  customerId: '',
  supplierId: '',
  projectName: '',
  productIds: [],
  contactIds: [],
  inventoryIds: [],
  quoteLines: [],
  quantity: '',
  unitPrice: '',
  unit: '',
  costPrice: '',
  quoteNumber: '',
  issueDate: '',
  submittedDate: '',
  validUntil: '',
  currency: 'JPY',
  freight: '',
  discount: '',
  taxRate: '10',
  subtotal: '',
  taxAmount: '',
  grandTotal: '',
  totalAmount: '',
  inventoryCostTotal: '',
  grossMarginAmount: '',
  grossMarginRate: '',
  status: '作成中',
  fileUrl: '',
  fileName: '',
  pdfUrl: '',
  pdfFileName: '',
  pdfStoragePath: '',
  pdfGeneratedAt: '',
  pdfHistory: [],
  submittedAt: '',
  acceptedAt: '',
  updatedBy: '',
  updatedByName: '',
  paymentTerms: '',
  deliveryTerms: '',
  remarks: '',
  memo: '',
  lostReason: '',
  createdBy: '',
  createdByName: '',
};

function calculateLine(line = {}) {
  const quantity = parsePrice(line.quantity);
  const unitPrice = parsePrice(line.unitPrice);
  const costPrice = parsePrice(line.costPrice);
  const amount = quantity !== '' && unitPrice !== '' ? quantity * unitPrice : parsePrice(line.amount);
  const costAmount = quantity !== '' && costPrice !== '' ? quantity * costPrice : parsePrice(line.costAmount);
  const grossMarginAmount = amount !== '' && costAmount !== '' ? amount - costAmount : '';
  const grossMarginRate =
    amount !== '' && amount > 0 && grossMarginAmount !== ''
      ? `${((grossMarginAmount / amount) * 100).toFixed(1).replace(/\.0$/, '')}%`
      : '';

  return {
    ...line,
    id: line.id ?? crypto.randomUUID(),
    productId: line.productId ?? '',
    inventoryId: line.inventoryId ?? '',
    description: line.description ?? '',
    quantity: line.quantity ?? '',
    unit: line.unit || 'kg',
    unitPrice: line.unitPrice ?? '',
    costPrice: line.costPrice ?? '',
    amount,
    costAmount,
    grossMarginAmount,
    grossMarginRate,
    memo: line.memo ?? '',
  };
}

export function calculateQuoteTotals(quote = {}) {
  const lines = Array.isArray(quote.quoteLines) ? quote.quoteLines.map(calculateLine) : [];
  const lineSubtotal = lines.reduce((sum, line) => sum + (parsePrice(line.amount) || 0), 0);
  const lineCostTotal = lines.reduce((sum, line) => sum + (parsePrice(line.costAmount) || 0), 0);
  const fallbackQuantity = parsePrice(quote.quantity);
  const fallbackUnitPrice = parsePrice(quote.unitPrice);
  const fallbackCostPrice = parsePrice(quote.costPrice);
  const fallbackSubtotal =
    fallbackQuantity !== '' && fallbackUnitPrice !== '' ? fallbackQuantity * fallbackUnitPrice : parsePrice(quote.totalAmount);
  const fallbackCostTotal =
    fallbackQuantity !== '' && fallbackCostPrice !== '' ? fallbackQuantity * fallbackCostPrice : parsePrice(quote.inventoryCostTotal);
  const freight = parsePrice(quote.freight);
  const discount = parsePrice(quote.discount);
  const taxRate = parsePrice(quote.taxRate);
  const subtotal = lineSubtotal > 0 ? lineSubtotal : fallbackSubtotal || 0;
  const costTotal = lineCostTotal > 0 ? lineCostTotal : fallbackCostTotal || 0;
  const totalAmount = subtotal + (freight || 0) - (discount || 0);
  const taxAmount = taxRate !== '' ? Math.round(totalAmount * (taxRate / 100)) : 0;
  const grandTotal = totalAmount + taxAmount;
  const grossMarginAmount = totalAmount - costTotal;
  const grossMarginRate = totalAmount > 0 ? `${((grossMarginAmount / totalAmount) * 100).toFixed(1).replace(/\.0$/, '')}%` : '';

  return {
    lines,
    subtotal,
    costTotal,
    totalAmount,
    taxAmount,
    grandTotal,
    grossMarginAmount,
    grossMarginRate,
  };
}

export function normalizeQuote(quote = {}, userId = '') {
  const quoteLines = Array.isArray(quote.quoteLines) ? quote.quoteLines.map(calculateLine) : [];
  const totals = calculateQuoteTotals({ ...quote, quoteLines });

  return {
    ...emptyQuote,
    ...quote,
    id: quote.id ?? crypto.randomUUID(),
    userId: quote.userId ?? userId,
    customerId: quote.customerId ?? '',
    supplierId: quote.supplierId ?? '',
    projectName: quote.projectName ?? '',
    productIds: Array.isArray(quote.productIds) ? quote.productIds : [],
    contactIds: Array.isArray(quote.contactIds) ? quote.contactIds : [],
    inventoryIds: Array.isArray(quote.inventoryIds) ? quote.inventoryIds : [],
    quoteLines,
    quantity: quote.quantity ?? '',
    unitPrice: quote.unitPrice ?? '',
    unit: quote.unit ?? '',
    costPrice: quote.costPrice ?? '',
    quoteNumber: quote.quoteNumber ?? '',
    issueDate: quote.issueDate ?? quote.issue_date ?? '',
    submittedDate: quote.submittedDate ?? quote.submitted_date ?? '',
    validUntil: quote.validUntil ?? quote.valid_until ?? '',
    freight: quote.freight ?? '',
    discount: quote.discount ?? '',
    taxRate: quote.taxRate ?? '10',
    subtotal: quote.subtotal ?? totals.subtotal,
    taxAmount: quote.taxAmount ?? totals.taxAmount,
    grandTotal: quote.grandTotal ?? totals.grandTotal,
    totalAmount: quote.totalAmount ?? totals.totalAmount,
    inventoryCostTotal: quote.inventoryCostTotal ?? totals.costTotal,
    grossMarginAmount: quote.grossMarginAmount ?? totals.grossMarginAmount,
    grossMarginRate: quote.grossMarginRate || totals.grossMarginRate,
    currency: quote.currency || 'JPY',
    status: quote.status || '作成中',
    pdfHistory: Array.isArray(quote.pdfHistory) ? quote.pdfHistory : [],
    submittedAt: quote.submittedAt ?? '',
    acceptedAt: quote.acceptedAt ?? '',
    updatedBy: quote.updatedBy ?? '',
    updatedByName: quote.updatedByName ?? '',
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
    project_name: quote.projectName,
    product_ids: quote.productIds,
    contact_ids: quote.contactIds,
    inventory_ids: quote.inventoryIds,
    quote_lines: quote.quoteLines,
    quantity: quote.quantity === '' ? null : quote.quantity,
    unit_price: quote.unitPrice === '' ? null : quote.unitPrice,
    unit: quote.unit,
    cost_price: quote.costPrice === '' ? null : quote.costPrice,
    quote_number: quote.quoteNumber,
    issue_date: quote.issueDate || null,
    submitted_date: quote.submittedDate || null,
    valid_until: quote.validUntil || null,
    currency: quote.currency,
    freight: quote.freight === '' ? null : quote.freight,
    discount: quote.discount === '' ? null : quote.discount,
    tax_rate: quote.taxRate === '' ? null : quote.taxRate,
    subtotal: quote.subtotal === '' ? null : quote.subtotal,
    tax_amount: quote.taxAmount === '' ? null : quote.taxAmount,
    grand_total: quote.grandTotal === '' ? null : quote.grandTotal,
    total_amount: quote.totalAmount === '' ? null : quote.totalAmount,
    inventory_cost_total: quote.inventoryCostTotal === '' ? null : quote.inventoryCostTotal,
    gross_margin_amount: quote.grossMarginAmount === '' ? null : quote.grossMarginAmount,
    gross_margin_rate: quote.grossMarginRate,
    status: quote.status,
    file_url: quote.fileUrl,
    file_name: quote.fileName,
    pdf_url: quote.pdfUrl,
    pdf_file_name: quote.pdfFileName,
    pdf_storage_path: quote.pdfStoragePath,
    pdf_generated_at: quote.pdfGeneratedAt || null,
    pdf_history: quote.pdfHistory,
    submitted_at: quote.submittedAt || null,
    accepted_at: quote.acceptedAt || null,
    updated_by: quote.updatedBy,
    updated_by_name: quote.updatedByName,
    payment_terms: quote.paymentTerms,
    delivery_terms: quote.deliveryTerms,
    remarks: quote.remarks,
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
    projectName: row.project_name,
    productIds: row.product_ids,
    contactIds: row.contact_ids,
    inventoryIds: row.inventory_ids,
    quoteLines: row.quote_lines,
    quantity: row.quantity ?? '',
    unitPrice: row.unit_price ?? '',
    unit: row.unit ?? '',
    costPrice: row.cost_price ?? '',
    quoteNumber: row.quote_number,
    issueDate: row.issue_date,
    submittedDate: row.submitted_date,
    validUntil: row.valid_until,
    currency: row.currency,
    freight: row.freight ?? '',
    discount: row.discount ?? '',
    taxRate: row.tax_rate ?? '10',
    subtotal: row.subtotal ?? '',
    taxAmount: row.tax_amount ?? '',
    grandTotal: row.grand_total ?? '',
    totalAmount: row.total_amount ?? '',
    inventoryCostTotal: row.inventory_cost_total ?? '',
    grossMarginAmount: row.gross_margin_amount ?? '',
    grossMarginRate: row.gross_margin_rate,
    status: row.status,
    fileUrl: row.file_url,
    fileName: row.file_name,
    pdfUrl: row.pdf_url,
    pdfFileName: row.pdf_file_name,
    pdfStoragePath: row.pdf_storage_path,
    pdfGeneratedAt: row.pdf_generated_at,
    pdfHistory: row.pdf_history,
    submittedAt: row.submitted_at,
    acceptedAt: row.accepted_at,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
    paymentTerms: row.payment_terms,
    deliveryTerms: row.delivery_terms,
    remarks: row.remarks,
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
