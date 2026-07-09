import { PIPELINE_STATUSES } from '../modules/deals/constants.js';

const LABELS = {
  unset: '\u672a\u8a2d\u5b9a',
  sample: '\u30b5\u30f3\u30d7\u30eb',
  totalQuoteAmount: '\u898b\u7a4d\u91d1\u984d\u5408\u8a08',
  expectedGrossMargin: '\u898b\u8fbc\u7c97\u5229',
  grossMarginRate: '\u7c97\u5229\u7387',
  freeInventory: '\u30d5\u30ea\u30fc\u5728\u5eab',
  firmInventory: '\u30d5\u30a1\u30fc\u30e0\u5728\u5eab',
  waitingShipment: '\u51fa\u5eab\u5f85\u3061',
  sampleEvaluation: '\u30b5\u30f3\u30d7\u30eb\u8a55\u4fa1\u5f85\u3061',
  complaintCount: '\u30af\u30ec\u30fc\u30e0\u4ef6\u6570',
  overdueFollow: '\u671f\u9650\u5207\u308c\u30d5\u30a9\u30ed\u30fc',
  complaint: '\u30af\u30ec\u30fc\u30e0',
};

const CLOSED_CUSTOMER_STATUSES = ['\u6210\u7d04', '\u5931\u6ce8'];
const FREE_STATUS_HINTS = ['\u30d5\u30ea\u30fc', 'free'];
const FIRM_STATUS_HINTS = ['\u30d5\u30a1\u30fc\u30e0', 'firm'];
const WAITING_SHIPMENT_HINTS = ['\u51fa\u5eab', 'shipment'];
const SAMPLE_EVALUATION_HINTS = ['\u8a55\u4fa1\u5f85\u3061', 'evaluation'];
const RESOLVED_COMPLAINT_STATUSES = ['\u89e3\u6c7a', '\u5b8c\u4e86', 'closed', 'resolved'];

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value).replace(/,/g, '').replace(/%/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  return `\u00a5${Math.round(toNumber(value)).toLocaleString('ja-JP')}`;
}

function formatPercent(value) {
  const numeric = toNumber(value);
  return `${numeric.toFixed(1).replace(/\.0$/, '')}%`;
}

function matchesStatus(value, hints) {
  const status = String(value || '').toLowerCase();
  return hints.some((hint) => status.includes(String(hint).toLowerCase()));
}

function getCustomerName(customerId, customerMap) {
  return customerMap.get(customerId)?.companyName || LABELS.unset;
}

function getProductName(productId, productMap) {
  return productMap.get(productId)?.name || LABELS.unset;
}

function getSupplierName(supplierId, supplierMap) {
  const supplier = supplierMap.get(supplierId);
  return supplier?.name || supplier?.companyName || '-';
}

function getQuoteAmount(quote) {
  const totalAmount = toNumber(quote.totalAmount);
  if (totalAmount > 0) return totalAmount;
  return toNumber(quote.quantity) * toNumber(quote.unitPrice);
}

function getQuoteCost(quote) {
  const inventoryCostTotal = toNumber(quote.inventoryCostTotal);
  if (inventoryCostTotal > 0) return inventoryCostTotal;
  return toNumber(quote.quantity) * toNumber(quote.costPrice);
}

function getQuoteGrossMargin(quote) {
  const storedGrossMargin = toNumber(quote.grossMarginAmount);
  if (storedGrossMargin !== 0) return storedGrossMargin;
  const amount = getQuoteAmount(quote);
  const cost = getQuoteCost(quote);
  return amount > 0 ? amount - cost : 0;
}

function isOverdue(dateValue) {
  if (!dateValue) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date < today;
}

function isOverdueFollow(customer) {
  const followDate = customer.nextFollowUpDate || customer.nextFollowDate;
  return Boolean(followDate) && isOverdue(followDate) && !CLOSED_CUSTOMER_STATUSES.includes(customer.status);
}

function isOpenComplaint(complaint) {
  return !RESOLVED_COMPLAINT_STATUSES.includes(complaint.status);
}

function isSampleAwaitingEvaluation(sample) {
  if (matchesStatus(sample.status, SAMPLE_EVALUATION_HINTS)) return true;
  return Boolean(sample.followUpDate) && !['\u63a1\u7528', '\u4e0d\u63a1\u7528'].includes(sample.status);
}

function incrementGroupedAmount(map, key, amount, grossMargin, extra = {}) {
  const current = map.get(key) || {
    ...extra,
    quoteCount: 0,
    quoteAmount: 0,
    grossMarginAmount: 0,
  };

  map.set(key, {
    ...current,
    ...extra,
    quoteCount: current.quoteCount + 1,
    quoteAmount: current.quoteAmount + amount,
    grossMarginAmount: current.grossMarginAmount + grossMargin,
  });
}

function sortByAmount(rows) {
  return rows
    .map((row) => ({
      ...row,
      grossMarginRate: row.quoteAmount > 0 ? (row.grossMarginAmount / row.quoteAmount) * 100 : 0,
    }))
    .sort((a, b) => b.quoteAmount - a.quoteAmount);
}

export function buildManagementDashboard({
  customers = [],
  products = [],
  suppliers = [],
  complaints = [],
  quotes = [],
  samples = [],
  inventories = [],
}) {
  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const productQuoteMap = new Map();
  const customerQuoteMap = new Map();

  const totalQuoteAmount = quotes.reduce((sum, quote) => sum + getQuoteAmount(quote), 0);
  const totalGrossMargin = quotes.reduce((sum, quote) => sum + getQuoteGrossMargin(quote), 0);
  const totalGrossMarginRate = totalQuoteAmount > 0 ? (totalGrossMargin / totalQuoteAmount) * 100 : 0;

  quotes.forEach((quote) => {
    const amount = getQuoteAmount(quote);
    const grossMargin = getQuoteGrossMargin(quote);
    const productIds = Array.isArray(quote.productIds) && quote.productIds.length ? quote.productIds : [''];

    productIds.forEach((productId) => {
      incrementGroupedAmount(productQuoteMap, productId || 'unknown', amount, grossMargin, {
        productId: productId || '',
        productName: getProductName(productId, productMap),
      });
    });

    incrementGroupedAmount(customerQuoteMap, quote.customerId || 'unknown', amount, grossMargin, {
      customerId: quote.customerId || '',
      customerName: getCustomerName(quote.customerId, customerMap),
      latestStatus: quote.status || '-',
    });
  });

  const overdueFollowRows = customers.filter(isOverdueFollow).map((customer) => ({
    id: customer.id,
    companyName: customer.companyName || LABELS.unset,
    status: customer.status || '-',
    nextFollowDate: customer.nextFollowUpDate || customer.nextFollowDate || '',
  }));

  const sampleAwaitingRows = samples.filter(isSampleAwaitingEvaluation).map((sample) => ({
    id: sample.id,
    sampleName: sample.sampleName || LABELS.sample,
    customerName: getCustomerName(sample.customerId, customerMap),
    status: sample.status || '-',
    followUpDate: sample.followUpDate || '',
  }));

  const openComplaintRows = complaints.filter(isOpenComplaint).map((complaint) => ({
    id: complaint.id,
    title: complaint.summary || complaint.content || complaint.type || LABELS.complaint,
    customerName: getCustomerName(complaint.customerId, customerMap),
    status: complaint.status || '-',
    dueDate: complaint.dueDate || complaint.responseDeadline || '',
  }));

  const inventoryRows = inventories.map((inventory) => {
    const relatedQuotes = quotes.filter((quote) => quote.inventoryId === inventory.id || quote.inventoryIds?.includes?.(inventory.id));
    const allocatedQuoteAmount = relatedQuotes.reduce((sum, quote) => sum + getQuoteAmount(quote), 0);

    return {
      id: inventory.id,
      productName: getProductName(inventory.productId, productMap),
      supplierName: getSupplierName(inventory.supplierId, supplierMap),
      status: inventory.inventoryStatus || inventory.status || '-',
      quantity: inventory.quantity !== '' && inventory.quantity !== undefined ? `${inventory.quantity}${inventory.unit || ''}` : '-',
      lot: inventory.lot || '-',
      eta: inventory.eta || '-',
      expiryDate: inventory.expiryDate || '-',
      allocatedQuoteCount: relatedQuotes.length,
      allocatedQuoteAmount,
    };
  });

  const freeInventoryCount = inventoryRows.filter((row) => matchesStatus(row.status, FREE_STATUS_HINTS)).length;
  const firmInventoryCount = inventoryRows.filter((row) => matchesStatus(row.status, FIRM_STATUS_HINTS)).length;
  const waitingShipmentCount = inventoryRows.filter((row) => matchesStatus(row.status, WAITING_SHIPMENT_HINTS)).length;

  const statusCounts = PIPELINE_STATUSES.map((status) => ({
    status,
    count: customers.filter((customer) => customer.status === status).length,
  }));

  return {
    kpis: [
      { label: LABELS.totalQuoteAmount, value: formatMoney(totalQuoteAmount), tone: 'blue' },
      { label: LABELS.expectedGrossMargin, value: formatMoney(totalGrossMargin), tone: 'gold' },
      { label: LABELS.grossMarginRate, value: formatPercent(totalGrossMarginRate), tone: 'purple' },
      { label: LABELS.freeInventory, value: freeInventoryCount, tone: 'green' },
      { label: LABELS.firmInventory, value: firmInventoryCount, tone: 'orange' },
      { label: LABELS.waitingShipment, value: waitingShipmentCount, tone: 'blue' },
      { label: LABELS.sampleEvaluation, value: sampleAwaitingRows.length, tone: 'orange' },
      { label: LABELS.complaintCount, value: openComplaintRows.length, tone: 'red' },
      { label: LABELS.overdueFollow, value: overdueFollowRows.length, tone: 'red' },
    ],
    statusCounts,
    productQuoteAmounts: sortByAmount([...productQuoteMap.values()]).slice(0, 10),
    customerQuoteAmounts: sortByAmount([...customerQuoteMap.values()]).slice(0, 10),
    inventoryRows: inventoryRows.sort((a, b) => b.allocatedQuoteAmount - a.allocatedQuoteAmount),
    overdueFollowRows,
    sampleAwaitingRows,
    openComplaintRows,
    totals: {
      quoteAmount: totalQuoteAmount,
      grossMargin: totalGrossMargin,
      grossMarginRate: totalGrossMarginRate,
      freeInventoryCount,
      firmInventoryCount,
      waitingShipmentCount,
      sampleAwaitingCount: sampleAwaitingRows.length,
      complaintCount: openComplaintRows.length,
      overdueFollowCount: overdueFollowRows.length,
    },
  };
}

export const dashboardFormatters = {
  money: formatMoney,
  percent: formatPercent,
};
