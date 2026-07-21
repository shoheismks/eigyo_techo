import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';
import { parsePrice } from '../../products/hooks/useProducts.js';
import { DEFAULT_QUOTE_TAX_RATE, ROUNDING_MODES } from '../../quotes/hooks/useQuotes.js';

export const INVOICE_STATUSES = ['下書き', '発行済み', '送付済み', '一部入金', '入金済み', '期限超過', '取消'];
export const INVOICE_PAYMENT_METHODS = ['銀行振込', '現金', '小切手', '相殺', 'その他'];
export const DEFAULT_INVOICE_TAX_RATE = DEFAULT_QUOTE_TAX_RATE || '8';

export { ROUNDING_MODES };

export function emptyInvoiceLine() {
  return {
    id: crypto.randomUUID(),
    productId: '',
    inventoryId: '',
    productCode: '',
    productName: '',
    specification: '',
    quantity: '',
    unit: 'kg',
    unitPrice: '',
    taxRate: DEFAULT_INVOICE_TAX_RATE,
    taxExcludedAmount: '',
    taxAmount: '',
    taxIncludedAmount: '',
    reducedTax: true,
    memo: '',
  };
}

export function emptyInvoicePayment() {
  return {
    id: crypto.randomUUID(),
    paidAt: new Date().toISOString().slice(0, 10),
    amount: '',
    method: '銀行振込',
    memo: '',
    createdAt: new Date().toISOString(),
  };
}

export const emptyInvoice = {
  userId: '',
  invoiceNumber: '',
  issueDate: '',
  invoiceDate: '',
  dueDate: '',
  transactionDate: '',
  customerId: '',
  contactId: '',
  projectId: '',
  quoteId: '',
  confirmationQuoteId: '',
  issuerId: '',
  subject: '',
  billingName: '',
  billingAddress: '',
  billingDepartment: '',
  billingContactName: '',
  issuerSnapshot: null,
  customerSnapshot: null,
  sourceQuoteSnapshot: null,
  sourceConfirmationSnapshot: null,
  bankSnapshot: null,
  paymentTerms: '',
  transferFeeText: '',
  remarks: '',
  status: '下書き',
  statusHistory: [],
  invoiceLines: [],
  subtotal: 0,
  taxAmount: 0,
  taxBreakdown: [],
  grandTotal: 0,
  paidAmount: 0,
  unpaidAmount: 0,
  payments: [],
  invoicePdfUrl: '',
  invoicePdfFileName: '',
  invoicePdfStoragePath: '',
  invoicePdfGeneratedAt: '',
  invoicePdfHistory: [],
  createdBy: '',
  createdByName: '',
  updatedBy: '',
  updatedByName: '',
  isDeleted: false,
  createdAt: '',
  updatedAt: '',
};

export function roundInvoiceAmount(value, mode = 'round') {
  if (!Number.isFinite(value)) return 0;
  if (mode === 'floor') return Math.floor(value);
  if (mode === 'ceil') return Math.ceil(value);
  return Math.round(value);
}

function calculateInvoiceLine(line = {}, defaultTaxRate = DEFAULT_INVOICE_TAX_RATE, roundingMode = 'round') {
  const quantity = parsePrice(line.quantity);
  const unitPrice = parsePrice(line.unitPrice);
  const taxRate = parsePrice(line.taxRate === '' || line.taxRate === undefined ? defaultTaxRate : line.taxRate);
  const taxExcludedAmount = quantity !== '' && unitPrice !== ''
    ? quantity * unitPrice
    : parsePrice(line.taxExcludedAmount);
  const taxAmount = taxExcludedAmount !== '' && taxRate !== ''
    ? roundInvoiceAmount(taxExcludedAmount * (taxRate / 100), roundingMode)
    : '';
  const taxIncludedAmount = taxExcludedAmount !== '' ? taxExcludedAmount + (taxAmount || 0) : '';

  return {
    ...emptyInvoiceLine(),
    ...line,
    id: line.id ?? crypto.randomUUID(),
    productId: line.productId ?? line.product_id ?? '',
    inventoryId: line.inventoryId ?? line.inventory_id ?? '',
    productCode: line.productCode ?? line.product_code ?? '',
    productName: line.productName ?? line.product_name ?? line.description ?? '',
    specification: line.specification ?? line.packageStyle ?? line.package_style ?? '',
    quantity: line.quantity ?? '',
    unit: line.unit || 'kg',
    unitPrice: line.unitPrice ?? line.unit_price ?? '',
    taxRate: line.taxRate === '' || line.taxRate === undefined ? defaultTaxRate : line.taxRate,
    taxExcludedAmount,
    taxAmount,
    taxIncludedAmount,
    reducedTax: line.reducedTax ?? line.reduced_tax ?? String(taxRate) === '8',
    memo: line.memo ?? '',
  };
}

export function calculateInvoiceTotals(invoice = {}) {
  const defaultTaxRate = invoice.defaultTaxRate ?? invoice.taxRate ?? DEFAULT_INVOICE_TAX_RATE;
  const roundingMode = invoice.roundingMode || invoice.issuerSnapshot?.invoiceRoundingMode || 'round';
  const invoiceLines = Array.isArray(invoice.invoiceLines)
    ? invoice.invoiceLines.map((line) => calculateInvoiceLine(line, defaultTaxRate, roundingMode))
    : [];
  const subtotal = invoiceLines.reduce((sum, line) => sum + (parsePrice(line.taxExcludedAmount) || 0), 0);
  const taxGroups = new Map();

  invoiceLines.forEach((line) => {
    const rate = String(line.taxRate === '' || line.taxRate === undefined ? defaultTaxRate : line.taxRate);
    const current = taxGroups.get(rate) || { rate, taxableAmount: 0, tax: 0 };
    current.taxableAmount += parsePrice(line.taxExcludedAmount) || 0;
    current.tax += parsePrice(line.taxAmount) || 0;
    taxGroups.set(rate, current);
  });

  const taxBreakdown = [...taxGroups.values()].filter((item) => item.taxableAmount !== 0 || item.tax !== 0);
  const taxAmount = taxBreakdown.reduce((sum, item) => sum + item.tax, 0);
  const grandTotal = subtotal + taxAmount;
  const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
  const paidAmount = payments.reduce((sum, payment) => sum + (parsePrice(payment.amount) || 0), 0);
  const unpaidAmount = grandTotal - paidAmount;

  return {
    invoiceLines,
    subtotal,
    taxAmount,
    taxBreakdown,
    grandTotal,
    paidAmount,
    unpaidAmount,
  };
}

function resolveInvoiceStatus(invoice, totals) {
  if (invoice.status === '取消') return '取消';
  if (totals.grandTotal > 0 && totals.unpaidAmount <= 0) return '入金済み';
  if (totals.paidAmount > 0 && totals.unpaidAmount > 0) return '一部入金';
  if (invoice.dueDate && totals.unpaidAmount > 0 && new Date(`${invoice.dueDate}T23:59:59`) < new Date() && invoice.status !== '下書き') {
    return '期限超過';
  }
  return invoice.status || '下書き';
}

export function normalizeInvoice(invoice = {}, userId = '') {
  const totals = calculateInvoiceTotals(invoice);
  const status = resolveInvoiceStatus(invoice, totals);

  return {
    ...emptyInvoice,
    ...invoice,
    id: invoice.id ?? crypto.randomUUID(),
    userId: invoice.userId ?? invoice.user_id ?? userId,
    invoiceNumber: invoice.invoiceNumber ?? invoice.invoice_number ?? '',
    issueDate: invoice.issueDate ?? invoice.issue_date ?? '',
    invoiceDate: invoice.invoiceDate ?? invoice.invoice_date ?? '',
    dueDate: invoice.dueDate ?? invoice.due_date ?? '',
    transactionDate: invoice.transactionDate ?? invoice.transaction_date ?? '',
    customerId: invoice.customerId ?? invoice.customer_id ?? '',
    contactId: invoice.contactId ?? invoice.contact_id ?? '',
    projectId: invoice.projectId ?? invoice.project_id ?? '',
    quoteId: invoice.quoteId ?? invoice.quote_id ?? '',
    confirmationQuoteId: invoice.confirmationQuoteId ?? invoice.confirmation_quote_id ?? '',
    issuerId: invoice.issuerId ?? invoice.issuer_id ?? '',
    subject: invoice.subject ?? '',
    billingName: invoice.billingName ?? invoice.billing_name ?? '',
    billingAddress: invoice.billingAddress ?? invoice.billing_address ?? '',
    billingDepartment: invoice.billingDepartment ?? invoice.billing_department ?? '',
    billingContactName: invoice.billingContactName ?? invoice.billing_contact_name ?? '',
    issuerSnapshot: invoice.issuerSnapshot ?? invoice.issuer_snapshot ?? null,
    customerSnapshot: invoice.customerSnapshot ?? invoice.customer_snapshot ?? null,
    sourceQuoteSnapshot: invoice.sourceQuoteSnapshot ?? invoice.source_quote_snapshot ?? null,
    sourceConfirmationSnapshot: invoice.sourceConfirmationSnapshot ?? invoice.source_confirmation_snapshot ?? null,
    bankSnapshot: invoice.bankSnapshot ?? invoice.bank_snapshot ?? null,
    paymentTerms: invoice.paymentTerms ?? invoice.payment_terms ?? '',
    transferFeeText: invoice.transferFeeText ?? invoice.transfer_fee_text ?? '',
    remarks: invoice.remarks ?? '',
    status,
    statusHistory: Array.isArray(invoice.statusHistory ?? invoice.status_history) ? (invoice.statusHistory ?? invoice.status_history) : [],
    invoiceLines: totals.invoiceLines,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    taxBreakdown: totals.taxBreakdown,
    grandTotal: totals.grandTotal,
    paidAmount: totals.paidAmount,
    unpaidAmount: totals.unpaidAmount,
    payments: Array.isArray(invoice.payments) ? invoice.payments : [],
    invoicePdfUrl: invoice.invoicePdfUrl ?? invoice.invoice_pdf_url ?? '',
    invoicePdfFileName: invoice.invoicePdfFileName ?? invoice.invoice_pdf_file_name ?? '',
    invoicePdfStoragePath: invoice.invoicePdfStoragePath ?? invoice.invoice_pdf_storage_path ?? '',
    invoicePdfGeneratedAt: invoice.invoicePdfGeneratedAt ?? invoice.invoice_pdf_generated_at ?? '',
    invoicePdfHistory: Array.isArray(invoice.invoicePdfHistory ?? invoice.invoice_pdf_history) ? (invoice.invoicePdfHistory ?? invoice.invoice_pdf_history) : [],
    createdBy: invoice.createdBy ?? invoice.created_by ?? userId,
    createdByName: invoice.createdByName ?? invoice.created_by_name ?? '',
    updatedBy: invoice.updatedBy ?? invoice.updated_by ?? '',
    updatedByName: invoice.updatedByName ?? invoice.updated_by_name ?? '',
    isDeleted: Boolean(invoice.isDeleted ?? invoice.is_deleted ?? false),
    createdAt: invoice.createdAt ?? invoice.created_at ?? new Date().toISOString(),
    updatedAt: invoice.updatedAt ?? invoice.updated_at ?? new Date().toISOString(),
  };
}

function nullableNumber(value) {
  return value === '' || value === undefined ? null : value;
}

function toRow(invoice) {
  return {
    id: invoice.id,
    user_id: invoice.userId,
    invoice_number: invoice.invoiceNumber || null,
    issue_date: invoice.issueDate || null,
    invoice_date: invoice.invoiceDate || null,
    due_date: invoice.dueDate || null,
    transaction_date: invoice.transactionDate || null,
    customer_id: invoice.customerId || null,
    contact_id: invoice.contactId || null,
    project_id: invoice.projectId || null,
    quote_id: invoice.quoteId || null,
    confirmation_quote_id: invoice.confirmationQuoteId || null,
    issuer_id: invoice.issuerId || null,
    subject: invoice.subject,
    billing_name: invoice.billingName,
    billing_address: invoice.billingAddress,
    billing_department: invoice.billingDepartment,
    billing_contact_name: invoice.billingContactName,
    issuer_snapshot: invoice.issuerSnapshot,
    customer_snapshot: invoice.customerSnapshot,
    source_quote_snapshot: invoice.sourceQuoteSnapshot,
    source_confirmation_snapshot: invoice.sourceConfirmationSnapshot,
    bank_snapshot: invoice.bankSnapshot,
    payment_terms: invoice.paymentTerms,
    transfer_fee_text: invoice.transferFeeText,
    remarks: invoice.remarks,
    status: invoice.status,
    status_history: invoice.statusHistory,
    invoice_lines: invoice.invoiceLines,
    subtotal: nullableNumber(invoice.subtotal),
    tax_amount: nullableNumber(invoice.taxAmount),
    tax_breakdown: invoice.taxBreakdown,
    grand_total: nullableNumber(invoice.grandTotal),
    paid_amount: nullableNumber(invoice.paidAmount),
    unpaid_amount: nullableNumber(invoice.unpaidAmount),
    payments: invoice.payments,
    invoice_pdf_url: invoice.invoicePdfUrl,
    invoice_pdf_file_name: invoice.invoicePdfFileName,
    invoice_pdf_storage_path: invoice.invoicePdfStoragePath,
    invoice_pdf_generated_at: invoice.invoicePdfGeneratedAt || null,
    invoice_pdf_history: invoice.invoicePdfHistory,
    created_by: invoice.createdBy,
    created_by_name: invoice.createdByName,
    updated_by: invoice.updatedBy,
    updated_by_name: invoice.updatedByName,
    is_deleted: invoice.isDeleted,
    created_at: invoice.createdAt,
    updated_at: invoice.updatedAt,
  };
}

function fromRow(row) {
  return normalizeInvoice({
    id: row.id,
    userId: row.user_id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    transactionDate: row.transaction_date,
    customerId: row.customer_id,
    contactId: row.contact_id,
    projectId: row.project_id,
    quoteId: row.quote_id,
    confirmationQuoteId: row.confirmation_quote_id,
    issuerId: row.issuer_id,
    subject: row.subject,
    billingName: row.billing_name,
    billingAddress: row.billing_address,
    billingDepartment: row.billing_department,
    billingContactName: row.billing_contact_name,
    issuerSnapshot: row.issuer_snapshot,
    customerSnapshot: row.customer_snapshot,
    sourceQuoteSnapshot: row.source_quote_snapshot,
    sourceConfirmationSnapshot: row.source_confirmation_snapshot,
    bankSnapshot: row.bank_snapshot,
    paymentTerms: row.payment_terms,
    transferFeeText: row.transfer_fee_text,
    remarks: row.remarks,
    status: row.status,
    statusHistory: row.status_history,
    invoiceLines: row.invoice_lines,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    taxBreakdown: row.tax_breakdown,
    grandTotal: row.grand_total,
    paidAmount: row.paid_amount,
    unpaidAmount: row.unpaid_amount,
    payments: row.payments,
    invoicePdfUrl: row.invoice_pdf_url,
    invoicePdfFileName: row.invoice_pdf_file_name,
    invoicePdfStoragePath: row.invoice_pdf_storage_path,
    invoicePdfGeneratedAt: row.invoice_pdf_generated_at,
    invoicePdfHistory: row.invoice_pdf_history,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const useInvoices = createRecordHook({
  tableName: 'invoices',
  storageKey: 'eigyo-techo-invoices',
  normalize: normalizeInvoice,
  toRow,
  fromRow,
});
