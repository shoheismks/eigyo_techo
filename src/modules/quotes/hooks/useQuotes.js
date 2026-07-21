import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';
import { normalizeBusinessCode } from '../../../shared/utils/businessCode.js';
import { parsePrice } from '../../products/hooks/useProducts.js';
import { DEFAULT_QUOTE_TERMS_SUMMARY, normalizeVisibleTerms } from '../services/termsTemplateService.js';

export const QUOTE_STATUSES = ['作成中', '提出済', '採用', '失注', '期限切れ'];

export const EXPENSE_ALLOCATION_BASIS = [
  { value: 'quantity', label: '数量比' },
  { value: 'weight', label: '重量比' },
  { value: 'sales', label: '売上額比' },
];

export const TAX_DISPLAY_MODES = [
  { value: 'tax_excluded', label: '税抜' },
  { value: 'tax_included', label: '税込' },
];

export const ROUNDING_MODES = [
  { value: 'round', label: '四捨五入' },
  { value: 'floor', label: '切捨て' },
  { value: 'ceil', label: '切上げ' },
];

export const DEFAULT_QUOTE_TAX_RATE = '8';

export function emptyQuoteLine() {
  return {
    id: crypto.randomUUID(),
    productId: '',
    inventoryId: '',
    productCode: '',
    productName: '',
    brandId: '',
    brandName: '',
    category: '',
    manufacturerName: '',
    origin: '',
    packageStyle: '',
    temperatureZone: '',
    shelfLife: '',
    expirationText: '',
    inventoryCode: '',
    inventoryOwner: '',
    inventoryStockType: '',
    inventoryLot: '',
    inventoryExpiryDate: '',
    description: '',
    quantity: '',
    weight: '',
    unit: 'kg',
    unitPrice: '',
    costPrice: '',
    taxRate: '',
    amount: '',
    costAmount: '',
    taxAmount: '',
    grossMarginAmount: '',
    grossMarginRate: '',
    memo: '',
    snapshotCreatedAt: '',
    sourceProductUpdatedAt: '',
    sourceInventoryUpdatedAt: '',
  };
}

export const emptyQuote = {
  userId: '',
  customerId: '',
  supplierId: '',
  projectId: '',
  issuerId: '',
  issuerSnapshot: null,
  pdfTemplate: 'standard',
  transactionCustomerSnapshot: null,
  billingCustomerId: '',
  billingCustomerSnapshot: null,
  shippingCustomerId: '',
  shippingCustomerSnapshot: null,
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
  storageFee: '',
  customsFee: '',
  inspectionFee: '',
  processingFee: '',
  salesCommission: '',
  discount: '',
  disposalLoss: '',
  fxGainLoss: '',
  otherExpense: '',
  commonExpenseAmount: '',
  allocationBasis: 'sales',
  expenseMemo: '',
  taxRate: DEFAULT_QUOTE_TAX_RATE,
  defaultTaxRate: DEFAULT_QUOTE_TAX_RATE,
  taxDisplayMode: 'tax_excluded',
  roundingMode: 'round',
  subtotal: '',
  taxAmount: '',
  taxBreakdown: [],
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
  pdfGeneratedBy: '',
  pdfGeneratedByName: '',
  pdfHistory: [],
  quoteTermsSummary: DEFAULT_QUOTE_TERMS_SUMMARY,
  confirmationPdfUrl: '',
  confirmationPdfFileName: '',
  confirmationPdfStoragePath: '',
  confirmationPdfGeneratedAt: '',
  confirmationGeneratedBy: '',
  confirmationGeneratedByName: '',
  confirmationPdfHistory: [],
  submittedAt: '',
  acceptedAt: '',
  updatedBy: '',
  updatedByName: '',
  paymentTerms: '',
  deliveryTerms: '',
  deliveryDate: '',
  termsSnapshot: null,
  disclaimerSnapshot: null,
  visibleTerms: {},
  specialTerms: '',
  termsVersion: '',
  termsEffectiveDate: '',
  acceptedByCustomerName: '',
  acceptanceMethod: '',
  confirmationRevision: 1,
  confirmationHistory: [],
  remarks: '',
  memo: '',
  lostReason: '',
  createdBy: '',
  createdByName: '',
};

function roundAmount(value, mode = 'round') {
  if (!Number.isFinite(value)) return 0;
  if (mode === 'floor') return Math.floor(value);
  if (mode === 'ceil') return Math.ceil(value);
  return Math.round(value);
}

function calculateLine(line = {}, defaultTaxRate = DEFAULT_QUOTE_TAX_RATE, roundingMode = 'round', taxDisplayMode = 'tax_excluded') {
  const quantity = parsePrice(line.quantity);
  const unitPrice = parsePrice(line.unitPrice);
  const costPrice = parsePrice(line.costPrice);
  const taxRate = parsePrice(line.taxRate === '' || line.taxRate === undefined ? defaultTaxRate : line.taxRate);
  const amount = quantity !== '' && unitPrice !== '' ? quantity * unitPrice : parsePrice(line.amount);
  const costAmount = quantity !== '' && costPrice !== '' ? quantity * costPrice : parsePrice(line.costAmount);
  const taxAmount =
    amount !== '' && taxRate !== ''
      ? taxDisplayMode === 'tax_included'
        ? roundAmount(amount - amount / (1 + taxRate / 100), roundingMode)
        : roundAmount(amount * (taxRate / 100), roundingMode)
      : '';
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
    productCode: line.productCode ?? '',
    productName: line.productName ?? line.description ?? '',
    brandId: line.brandId ?? line.brand_id ?? '',
    brandName: line.brandName ?? line.brand_name ?? '',
    category: line.category ?? '',
    manufacturerName: line.manufacturerName ?? '',
    origin: line.origin ?? '',
    packageStyle: line.packageStyle ?? '',
    temperatureZone: line.temperatureZone ?? '',
    shelfLife: line.shelfLife ?? '',
    expirationText: line.expirationText ?? '',
    inventoryCode: line.inventoryCode ?? '',
    inventoryOwner: line.inventoryOwner ?? '',
    inventoryStockType: line.inventoryStockType ?? '',
    inventoryLot: line.inventoryLot ?? '',
    inventoryExpiryDate: line.inventoryExpiryDate ?? '',
    description: line.description ?? line.productName ?? '',
    quantity: line.quantity ?? '',
    weight: line.weight ?? '',
    unit: line.unit || 'kg',
    unitPrice: line.unitPrice ?? '',
    costPrice: line.costPrice ?? '',
    taxRate: line.taxRate === undefined || line.taxRate === '' ? defaultTaxRate : line.taxRate,
    amount,
    costAmount,
    taxAmount,
    grossMarginAmount,
    grossMarginRate,
    memo: line.memo ?? '',
    snapshotCreatedAt: line.snapshotCreatedAt ?? '',
    sourceProductUpdatedAt: line.sourceProductUpdatedAt ?? '',
    sourceInventoryUpdatedAt: line.sourceInventoryUpdatedAt ?? '',
  };
}

export function calculateQuoteTotals(quote = {}) {
  const defaultTaxRate = quote.defaultTaxRate ?? quote.taxRate ?? DEFAULT_QUOTE_TAX_RATE;
  const roundingMode = quote.roundingMode || 'round';
  const taxDisplayMode = quote.taxDisplayMode || 'tax_excluded';
  const lines = Array.isArray(quote.quoteLines)
    ? quote.quoteLines.map((line) => calculateLine(line, defaultTaxRate, roundingMode, taxDisplayMode))
    : [];
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
  const taxRate = parsePrice(defaultTaxRate);
  const subtotal = lineSubtotal > 0 ? lineSubtotal : fallbackSubtotal || 0;
  const costTotal = lineCostTotal > 0 ? lineCostTotal : fallbackCostTotal || 0;
  const totalAmount = subtotal + (freight || 0) - (discount || 0);
  const taxGroups = new Map();

  lines.forEach((line) => {
    const rate = String(line.taxRate === '' || line.taxRate === undefined ? defaultTaxRate : line.taxRate);
    taxGroups.set(rate, (taxGroups.get(rate) || 0) + (parsePrice(line.amount) || 0));
  });

  if (lines.length === 0 || freight || discount) {
    const rate = String(defaultTaxRate);
    taxGroups.set(rate, (taxGroups.get(rate) || 0) + (freight || 0) - (discount || 0));
  }

  const taxBreakdown = [...taxGroups.entries()]
    .map(([rate, taxableAmount]) => {
      const parsedRate = parsePrice(rate);
      const tax =
        parsedRate !== ''
          ? taxDisplayMode === 'tax_included'
            ? roundAmount(taxableAmount - taxableAmount / (1 + parsedRate / 100), roundingMode)
            : roundAmount(taxableAmount * (parsedRate / 100), roundingMode)
          : 0;
      return { rate, taxableAmount, tax };
    })
    .filter((item) => item.taxableAmount !== 0 || item.tax !== 0);

  const fallbackTaxAmount =
    taxRate !== ''
      ? taxDisplayMode === 'tax_included'
        ? roundAmount(totalAmount - totalAmount / (1 + taxRate / 100), roundingMode)
        : roundAmount(totalAmount * (taxRate / 100), roundingMode)
      : 0;
  const taxAmount = taxBreakdown.length > 0
    ? taxBreakdown.reduce((sum, item) => sum + item.tax, 0)
    : fallbackTaxAmount;
  const grandTotal = taxDisplayMode === 'tax_included' ? totalAmount : totalAmount + taxAmount;
  const grossMarginAmount = subtotal - costTotal;
  const grossMarginRate = subtotal > 0 ? `${((grossMarginAmount / subtotal) * 100).toFixed(1).replace(/\.0$/, '')}%` : '';

  return {
    lines,
    subtotal,
    costTotal,
    totalAmount,
    taxAmount,
    taxBreakdown,
    grandTotal,
    grossMarginAmount,
    grossMarginRate,
  };
}

export function normalizeQuote(quote = {}, userId = '') {
  const defaultTaxRate = quote.defaultTaxRate ?? quote.default_tax_rate ?? quote.taxRate ?? quote.tax_rate ?? DEFAULT_QUOTE_TAX_RATE;
  const roundingMode = quote.roundingMode ?? quote.rounding_mode ?? 'round';
  const taxDisplayMode = quote.taxDisplayMode ?? quote.tax_display_mode ?? 'tax_excluded';
  const quoteLines = Array.isArray(quote.quoteLines)
    ? quote.quoteLines.map((line) => calculateLine(line, defaultTaxRate, roundingMode, taxDisplayMode))
    : [];
  const totals = calculateQuoteTotals({ ...quote, defaultTaxRate, roundingMode, taxDisplayMode, quoteLines });

  return {
    ...emptyQuote,
    ...quote,
    id: quote.id ?? crypto.randomUUID(),
    userId: quote.userId ?? userId,
    customerId: quote.customerId ?? '',
    supplierId: quote.supplierId ?? '',
    projectId: quote.projectId ?? quote.project_id ?? '',
    issuerId: quote.issuerId ?? quote.issuer_id ?? '',
    issuerSnapshot: quote.issuerSnapshot ?? quote.issuer_snapshot ?? null,
    pdfTemplate: quote.pdfTemplate ?? quote.pdf_template ?? quote.issuerSnapshot?.defaultPdfTemplate ?? 'standard',
    transactionCustomerSnapshot: quote.transactionCustomerSnapshot ?? quote.transaction_customer_snapshot ?? null,
    billingCustomerId: quote.billingCustomerId ?? quote.billing_customer_id ?? '',
    billingCustomerSnapshot: quote.billingCustomerSnapshot ?? quote.billing_customer_snapshot ?? null,
    shippingCustomerId: quote.shippingCustomerId ?? quote.shipping_customer_id ?? '',
    shippingCustomerSnapshot: quote.shippingCustomerSnapshot ?? quote.shipping_customer_snapshot ?? null,
    projectName: quote.projectName ?? '',
    productIds: Array.isArray(quote.productIds) ? quote.productIds : [],
    contactIds: Array.isArray(quote.contactIds) ? quote.contactIds : [],
    inventoryIds: Array.isArray(quote.inventoryIds) ? quote.inventoryIds : [],
    quoteLines,
    quantity: quote.quantity ?? '',
    unitPrice: quote.unitPrice ?? '',
    unit: quote.unit ?? '',
    costPrice: quote.costPrice ?? '',
    quoteNumber: normalizeBusinessCode(quote.quoteNumber ?? quote.quote_number ?? ''),
    issueDate: quote.issueDate ?? quote.issue_date ?? '',
    submittedDate: quote.submittedDate ?? quote.submitted_date ?? '',
    validUntil: quote.validUntil ?? quote.valid_until ?? '',
    freight: quote.freight ?? '',
    storageFee: quote.storageFee ?? '',
    customsFee: quote.customsFee ?? '',
    inspectionFee: quote.inspectionFee ?? '',
    processingFee: quote.processingFee ?? '',
    salesCommission: quote.salesCommission ?? '',
    discount: quote.discount ?? '',
    disposalLoss: quote.disposalLoss ?? '',
    fxGainLoss: quote.fxGainLoss ?? '',
    otherExpense: quote.otherExpense ?? '',
    commonExpenseAmount: quote.commonExpenseAmount ?? '',
    allocationBasis: quote.allocationBasis ?? 'sales',
    expenseMemo: quote.expenseMemo ?? '',
    taxRate: quote.taxRate ?? quote.tax_rate ?? defaultTaxRate,
    defaultTaxRate,
    taxDisplayMode,
    roundingMode,
    subtotal: quote.subtotal ?? totals.subtotal,
    taxAmount: quote.taxAmount ?? totals.taxAmount,
    taxBreakdown: Array.isArray(quote.taxBreakdown) ? quote.taxBreakdown : totals.taxBreakdown,
    grandTotal: quote.grandTotal ?? totals.grandTotal,
    totalAmount: quote.totalAmount ?? totals.totalAmount,
    inventoryCostTotal: quote.inventoryCostTotal ?? totals.costTotal,
    grossMarginAmount: quote.grossMarginAmount ?? totals.grossMarginAmount,
    grossMarginRate: quote.grossMarginRate || totals.grossMarginRate,
    currency: quote.currency || 'JPY',
    status: quote.status || '作成中',
    pdfHistory: Array.isArray(quote.pdfHistory) ? quote.pdfHistory : [],
    pdfGeneratedBy: quote.pdfGeneratedBy ?? quote.pdf_generated_by ?? '',
    pdfGeneratedByName: quote.pdfGeneratedByName ?? quote.pdf_generated_by_name ?? '',
    quoteTermsSummary: quote.quoteTermsSummary ?? quote.quote_terms_summary ?? quote.issuerSnapshot?.defaultQuoteTermsSummary ?? DEFAULT_QUOTE_TERMS_SUMMARY,
    confirmationPdfUrl: quote.confirmationPdfUrl ?? quote.confirmation_pdf_url ?? '',
    confirmationPdfFileName: quote.confirmationPdfFileName ?? quote.confirmation_pdf_file_name ?? '',
    confirmationPdfStoragePath: quote.confirmationPdfStoragePath ?? quote.confirmation_pdf_storage_path ?? '',
    confirmationPdfGeneratedAt: quote.confirmationPdfGeneratedAt ?? quote.confirmation_pdf_generated_at ?? '',
    confirmationGeneratedBy: quote.confirmationGeneratedBy ?? quote.confirmation_generated_by ?? '',
    confirmationGeneratedByName: quote.confirmationGeneratedByName ?? quote.confirmation_generated_by_name ?? '',
    confirmationPdfHistory: Array.isArray(quote.confirmationPdfHistory ?? quote.confirmation_pdf_history) ? (quote.confirmationPdfHistory ?? quote.confirmation_pdf_history) : [],
    submittedAt: quote.submittedAt ?? '',
    acceptedAt: quote.acceptedAt ?? '',
    updatedBy: quote.updatedBy ?? '',
    updatedByName: quote.updatedByName ?? '',
    deliveryDate: quote.deliveryDate ?? quote.delivery_date ?? '',
    termsSnapshot: quote.termsSnapshot ?? quote.terms_snapshot ?? null,
    disclaimerSnapshot: quote.disclaimerSnapshot ?? quote.disclaimer_snapshot ?? null,
    visibleTerms: normalizeVisibleTerms(quote.visibleTerms ?? quote.visible_terms ?? {}),
    specialTerms: quote.specialTerms ?? quote.special_terms ?? '',
    termsVersion: quote.termsVersion ?? quote.terms_version ?? quote.issuerSnapshot?.termsVersion ?? '',
    termsEffectiveDate: quote.termsEffectiveDate ?? quote.terms_effective_date ?? quote.issuerSnapshot?.termsEffectiveDate ?? '',
    acceptedByCustomerName: quote.acceptedByCustomerName ?? quote.accepted_by_customer_name ?? '',
    acceptanceMethod: quote.acceptanceMethod ?? quote.acceptance_method ?? '',
    confirmationRevision: quote.confirmationRevision ?? quote.confirmation_revision ?? 1,
    confirmationHistory: Array.isArray(quote.confirmationHistory) ? quote.confirmationHistory : [],
    createdBy: quote.createdBy ?? userId,
    createdByName: quote.createdByName ?? '',
    createdAt: quote.createdAt ?? new Date().toISOString(),
    updatedAt: quote.updatedAt ?? new Date().toISOString(),
  };
}

function nullableNumber(value) {
  return value === '' ? null : value;
}

function toRow(quote) {
  return {
    id: quote.id,
    user_id: quote.userId,
    customer_id: quote.customerId,
    supplier_id: quote.supplierId,
    project_id: quote.projectId || null,
    issuer_id: quote.issuerId || null,
    issuer_snapshot: quote.issuerSnapshot,
    pdf_template: quote.pdfTemplate,
    transaction_customer_snapshot: quote.transactionCustomerSnapshot,
    billing_customer_id: quote.billingCustomerId || null,
    billing_customer_snapshot: quote.billingCustomerSnapshot,
    shipping_customer_id: quote.shippingCustomerId || null,
    shipping_customer_snapshot: quote.shippingCustomerSnapshot,
    project_name: quote.projectName,
    product_ids: quote.productIds,
    contact_ids: quote.contactIds,
    inventory_ids: quote.inventoryIds,
    quote_lines: quote.quoteLines,
    quantity: nullableNumber(quote.quantity),
    unit_price: nullableNumber(quote.unitPrice),
    unit: quote.unit,
    cost_price: nullableNumber(quote.costPrice),
    quote_number: quote.quoteNumber || null,
    issue_date: quote.issueDate || null,
    submitted_date: quote.submittedDate || null,
    valid_until: quote.validUntil || null,
    currency: quote.currency,
    freight: nullableNumber(quote.freight),
    storage_fee: nullableNumber(quote.storageFee),
    customs_fee: nullableNumber(quote.customsFee),
    inspection_fee: nullableNumber(quote.inspectionFee),
    processing_fee: nullableNumber(quote.processingFee),
    sales_commission: nullableNumber(quote.salesCommission),
    discount: nullableNumber(quote.discount),
    disposal_loss: nullableNumber(quote.disposalLoss),
    fx_gain_loss: nullableNumber(quote.fxGainLoss),
    other_expense: nullableNumber(quote.otherExpense),
    common_expense_amount: nullableNumber(quote.commonExpenseAmount),
    allocation_basis: quote.allocationBasis,
    expense_memo: quote.expenseMemo,
    tax_rate: nullableNumber(quote.taxRate),
    default_tax_rate: nullableNumber(quote.defaultTaxRate),
    tax_display_mode: quote.taxDisplayMode,
    rounding_mode: quote.roundingMode,
    subtotal: nullableNumber(quote.subtotal),
    tax_amount: nullableNumber(quote.taxAmount),
    tax_breakdown: quote.taxBreakdown,
    grand_total: nullableNumber(quote.grandTotal),
    total_amount: nullableNumber(quote.totalAmount),
    inventory_cost_total: nullableNumber(quote.inventoryCostTotal),
    gross_margin_amount: nullableNumber(quote.grossMarginAmount),
    gross_margin_rate: quote.grossMarginRate,
    status: quote.status,
    file_url: quote.fileUrl,
    file_name: quote.fileName,
    pdf_url: quote.pdfUrl,
    pdf_file_name: quote.pdfFileName,
    pdf_storage_path: quote.pdfStoragePath,
    pdf_generated_at: quote.pdfGeneratedAt || null,
    pdf_generated_by: quote.pdfGeneratedBy || null,
    pdf_generated_by_name: quote.pdfGeneratedByName,
    pdf_history: quote.pdfHistory,
    quote_terms_summary: quote.quoteTermsSummary,
    confirmation_pdf_url: quote.confirmationPdfUrl,
    confirmation_pdf_file_name: quote.confirmationPdfFileName,
    confirmation_pdf_storage_path: quote.confirmationPdfStoragePath,
    confirmation_pdf_generated_at: quote.confirmationPdfGeneratedAt || null,
    confirmation_generated_by: quote.confirmationGeneratedBy || null,
    confirmation_generated_by_name: quote.confirmationGeneratedByName,
    confirmation_pdf_history: quote.confirmationPdfHistory,
    submitted_at: quote.submittedAt || null,
    accepted_at: quote.acceptedAt || null,
    updated_by: quote.updatedBy,
    updated_by_name: quote.updatedByName,
    payment_terms: quote.paymentTerms,
    delivery_terms: quote.deliveryTerms,
    delivery_date: quote.deliveryDate,
    terms_snapshot: quote.termsSnapshot,
    disclaimer_snapshot: quote.disclaimerSnapshot,
    visible_terms: quote.visibleTerms,
    special_terms: quote.specialTerms,
    terms_version: quote.termsVersion,
    terms_effective_date: quote.termsEffectiveDate || null,
    accepted_by_customer_name: quote.acceptedByCustomerName,
    acceptance_method: quote.acceptanceMethod,
    confirmation_revision: quote.confirmationRevision,
    confirmation_history: quote.confirmationHistory,
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
    projectId: row.project_id,
    issuerId: row.issuer_id,
    issuerSnapshot: row.issuer_snapshot,
    pdfTemplate: row.pdf_template,
    transactionCustomerSnapshot: row.transaction_customer_snapshot,
    billingCustomerId: row.billing_customer_id,
    billingCustomerSnapshot: row.billing_customer_snapshot,
    shippingCustomerId: row.shipping_customer_id,
    shippingCustomerSnapshot: row.shipping_customer_snapshot,
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
    storageFee: row.storage_fee ?? '',
    customsFee: row.customs_fee ?? '',
    inspectionFee: row.inspection_fee ?? '',
    processingFee: row.processing_fee ?? '',
    salesCommission: row.sales_commission ?? '',
    discount: row.discount ?? '',
    disposalLoss: row.disposal_loss ?? '',
    fxGainLoss: row.fx_gain_loss ?? '',
    otherExpense: row.other_expense ?? '',
    commonExpenseAmount: row.common_expense_amount ?? '',
    allocationBasis: row.allocation_basis ?? 'sales',
    expenseMemo: row.expense_memo ?? '',
    taxRate: row.tax_rate ?? DEFAULT_QUOTE_TAX_RATE,
    defaultTaxRate: row.default_tax_rate ?? row.tax_rate ?? DEFAULT_QUOTE_TAX_RATE,
    taxDisplayMode: row.tax_display_mode ?? 'tax_excluded',
    roundingMode: row.rounding_mode ?? 'round',
    subtotal: row.subtotal ?? '',
    taxAmount: row.tax_amount ?? '',
    taxBreakdown: row.tax_breakdown ?? [],
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
    pdfGeneratedBy: row.pdf_generated_by,
    pdfGeneratedByName: row.pdf_generated_by_name,
    pdfHistory: row.pdf_history,
    quoteTermsSummary: row.quote_terms_summary,
    confirmationPdfUrl: row.confirmation_pdf_url,
    confirmationPdfFileName: row.confirmation_pdf_file_name,
    confirmationPdfStoragePath: row.confirmation_pdf_storage_path,
    confirmationPdfGeneratedAt: row.confirmation_pdf_generated_at,
    confirmationGeneratedBy: row.confirmation_generated_by,
    confirmationGeneratedByName: row.confirmation_generated_by_name,
    confirmationPdfHistory: row.confirmation_pdf_history,
    submittedAt: row.submitted_at,
    acceptedAt: row.accepted_at,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
    paymentTerms: row.payment_terms,
    deliveryTerms: row.delivery_terms,
    deliveryDate: row.delivery_date,
    termsSnapshot: row.terms_snapshot,
    disclaimerSnapshot: row.disclaimer_snapshot,
    visibleTerms: row.visible_terms,
    specialTerms: row.special_terms,
    termsVersion: row.terms_version,
    termsEffectiveDate: row.terms_effective_date,
    acceptedByCustomerName: row.accepted_by_customer_name,
    acceptanceMethod: row.acceptance_method,
    confirmationRevision: row.confirmation_revision,
    confirmationHistory: row.confirmation_history,
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
