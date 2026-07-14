import { PIPELINE_STATUSES } from '../modules/deals/constants.js';
import { productDisplayName } from '../modules/products/hooks/useProducts.js';

const LABELS = {
  unset: '\u672a\u8a2d\u5b9a',
  sample: '\u30b5\u30f3\u30d7\u30eb',
  totalQuoteAmount: '\u898b\u7a4d\u91d1\u984d\u5408\u8a08',
  expectedGrossMargin: '\u898b\u8fbc\u7c97\u5229',
  grossMarginRate: '\u7c97\u5229\u7387',
  productCost: '\u5546\u54c1\u539f\u4fa1',
  expenseTotal: '\u8af8\u7d4c\u8cbb\u5408\u8a08',
  operatingProfit: '\u55b6\u696d\u5229\u76ca',
  operatingProfitRate: '\u55b6\u696d\u5229\u76ca\u7387',
  realProfit: '\u5b9f\u8cea\u5229\u76ca',
  realProfitRate: '\u5b9f\u8cea\u5229\u76ca\u7387',
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
  return productDisplayName(productMap.get(productId), LABELS.unset);
}

function getSupplierName(supplierId, supplierMap) {
  const supplier = supplierMap.get(supplierId);
  return supplier?.name || supplier?.companyName || '-';
}

function getQuoteAmount(quote) {
  const subtotal = toNumber(quote.subtotal);
  if (subtotal > 0) return subtotal;
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
  const amount = getQuoteAmount(quote);
  const cost = getQuoteCost(quote);
  return amount > 0 ? amount - cost : 0;
}

function getQuoteExpenseBreakdown(quote) {
  const freight = toNumber(quote.freight);
  const storageFee = toNumber(quote.storageFee);
  const customsFee = toNumber(quote.customsFee);
  const inspectionFee = toNumber(quote.inspectionFee);
  const processingFee = toNumber(quote.processingFee);
  const salesCommission = toNumber(quote.salesCommission);
  const otherExpense = toNumber(quote.otherExpense);
  const commonExpenseAmount = toNumber(quote.commonExpenseAmount);
  const discount = toNumber(quote.discount);
  const disposalLoss = toNumber(quote.disposalLoss);
  const fxGainLoss = toNumber(quote.fxGainLoss);
  const expenseTotal =
    freight +
    storageFee +
    customsFee +
    inspectionFee +
    processingFee +
    salesCommission +
    otherExpense +
    commonExpenseAmount;
  const grossMargin = getQuoteGrossMargin(quote);
  const operatingProfit = grossMargin - expenseTotal;
  const realProfit = operatingProfit + fxGainLoss - discount - disposalLoss;

  return {
    freight,
    storageFee,
    customsFee,
    inspectionFee,
    processingFee,
    salesCommission,
    otherExpense,
    commonExpenseAmount,
    discount,
    disposalLoss,
    fxGainLoss,
    expenseTotal,
    operatingProfit,
    realProfit,
  };
}

function getLineAllocationWeight(line = {}, quote = {}) {
  const basis = quote.allocationBasis || 'sales';
  if (basis === 'weight') return toNumber(line.weight) || toNumber(line.quantity) || 1;
  if (basis === 'quantity') return toNumber(line.quantity) || 1;
  return toNumber(line.amount) || toNumber(line.quantity) * toNumber(line.unitPrice) || 1;
}

function getQuoteLinesForAllocation(quote = {}) {
  if (Array.isArray(quote.quoteLines) && quote.quoteLines.length > 0) return quote.quoteLines;
  return [{
    productId: Array.isArray(quote.productIds) ? quote.productIds[0] : '',
    inventoryId: Array.isArray(quote.inventoryIds) ? quote.inventoryIds[0] : '',
    quantity: quote.quantity,
    unitPrice: quote.unitPrice,
    costPrice: quote.costPrice,
    amount: getQuoteAmount(quote),
    costAmount: getQuoteCost(quote),
  }];
}

function createFinancialRow(extra = {}) {
  return {
    ...extra,
    quoteCount: 0,
    sales: 0,
    productCost: 0,
    grossMarginAmount: 0,
    expenseTotal: 0,
    operatingProfit: 0,
    realProfit: 0,
  };
}

function addFinancials(map, key, values, extra = {}) {
  const current = map.get(key) || createFinancialRow(extra);
  map.set(key, {
    ...current,
    ...extra,
    quoteCount: current.quoteCount + values.quoteCount,
    sales: current.sales + values.sales,
    productCost: current.productCost + values.productCost,
    grossMarginAmount: current.grossMarginAmount + values.grossMarginAmount,
    expenseTotal: current.expenseTotal + values.expenseTotal,
    operatingProfit: current.operatingProfit + values.operatingProfit,
    realProfit: current.realProfit + values.realProfit,
  });
}

function withProfitRates(row) {
  return {
    ...row,
    grossMarginRate: row.sales > 0 ? (row.grossMarginAmount / row.sales) * 100 : 0,
    operatingProfitRate: row.sales > 0 ? (row.operatingProfit / row.sales) * 100 : 0,
    realProfitRate: row.sales > 0 ? (row.realProfit / row.sales) * 100 : 0,
  };
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
      grossMarginRate: row.quoteAmount > 0 ? (row.grossMarginAmount / row.quoteAmount) * 100 : row.grossMarginRate || 0,
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
  const quoteProfitRows = [];
  const customerProfitMap = new Map();
  const productProfitMap = new Map();
  const projectProfitMap = new Map();
  const inventoryProfitMap = new Map();
  const supplierProfitMap = new Map();
  const monthProfitMap = new Map();

  const totalQuoteAmount = quotes.reduce((sum, quote) => sum + getQuoteAmount(quote), 0);
  const totalProductCost = quotes.reduce((sum, quote) => sum + getQuoteCost(quote), 0);
  const totalGrossMargin = quotes.reduce((sum, quote) => sum + getQuoteGrossMargin(quote), 0);
  const totalExpenses = quotes.reduce((sum, quote) => sum + getQuoteExpenseBreakdown(quote).expenseTotal, 0);
  const totalOperatingProfit = quotes.reduce((sum, quote) => sum + getQuoteExpenseBreakdown(quote).operatingProfit, 0);
  const totalRealProfit = quotes.reduce((sum, quote) => sum + getQuoteExpenseBreakdown(quote).realProfit, 0);
  const totalGrossMarginRate = totalQuoteAmount > 0 ? (totalGrossMargin / totalQuoteAmount) * 100 : 0;
  const totalOperatingProfitRate = totalQuoteAmount > 0 ? (totalOperatingProfit / totalQuoteAmount) * 100 : 0;
  const totalRealProfitRate = totalQuoteAmount > 0 ? (totalRealProfit / totalQuoteAmount) * 100 : 0;

  quotes.forEach((quote) => {
    const amount = getQuoteAmount(quote);
    const grossMargin = getQuoteGrossMargin(quote);
    const productCost = getQuoteCost(quote);
    const expenses = getQuoteExpenseBreakdown(quote);
    const productIds = Array.isArray(quote.productIds) && quote.productIds.length ? quote.productIds : [''];
    const quoteFinancials = {
      quoteCount: 1,
      sales: amount,
      productCost,
      grossMarginAmount: grossMargin,
      expenseTotal: expenses.expenseTotal,
      operatingProfit: expenses.operatingProfit,
      realProfit: expenses.realProfit,
    };
    const quoteNumber = quote.quoteNumber || LABELS.unset;
    const monthKey = String(quote.submittedDate || quote.issueDate || quote.createdAt || '').slice(0, 7) || LABELS.unset;

    quoteProfitRows.push(withProfitRates({
      id: quote.id,
      quoteId: quote.id,
      quoteNumber,
      customerName: getCustomerName(quote.customerId, customerMap),
      projectName: quote.projectName || LABELS.unset,
      supplierName: getSupplierName(quote.supplierId, supplierMap),
      expenseBreakdown: expenses,
      allocationBasis: quote.allocationBasis || 'sales',
      ...quoteFinancials,
    }));

    addFinancials(customerProfitMap, quote.customerId || 'unknown', quoteFinancials, {
      customerId: quote.customerId || '',
      customerName: getCustomerName(quote.customerId, customerMap),
    });
    addFinancials(projectProfitMap, quote.projectName || 'unknown', quoteFinancials, {
      projectName: quote.projectName || LABELS.unset,
    });
    addFinancials(supplierProfitMap, quote.supplierId || 'unknown', quoteFinancials, {
      supplierId: quote.supplierId || '',
      supplierName: getSupplierName(quote.supplierId, supplierMap),
    });
    addFinancials(monthProfitMap, monthKey, quoteFinancials, {
      month: monthKey,
    });

    const lines = getQuoteLinesForAllocation(quote);
    const totalWeight = lines.reduce((sum, line) => sum + getLineAllocationWeight(line, quote), 0) || 1;
    lines.forEach((line) => {
      const weightRatio = getLineAllocationWeight(line, quote) / totalWeight;
      const lineSales = toNumber(line.amount) || amount * weightRatio;
      const lineCost = toNumber(line.costAmount) || productCost * weightRatio;
      const lineGross = lineSales - lineCost;
      const lineExpenses = expenses.expenseTotal * weightRatio;
      const lineOperatingProfit = lineGross - lineExpenses;
      const lineRealProfit =
        lineOperatingProfit +
        expenses.fxGainLoss * weightRatio -
        expenses.discount * weightRatio -
        expenses.disposalLoss * weightRatio;
      const lineFinancials = {
        quoteCount: 1,
        sales: lineSales,
        productCost: lineCost,
        grossMarginAmount: lineGross,
        expenseTotal: lineExpenses,
        operatingProfit: lineOperatingProfit,
        realProfit: lineRealProfit,
      };

      addFinancials(productProfitMap, line.productId || 'unknown', lineFinancials, {
        productId: line.productId || '',
        productName: getProductName(line.productId, productMap),
      });
      addFinancials(inventoryProfitMap, line.inventoryId || 'unknown', lineFinancials, {
        inventoryId: line.inventoryId || '',
        inventoryName: line.inventoryId || LABELS.unset,
        productName: getProductName(line.productId, productMap),
      });
    });

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
      { label: LABELS.productCost, value: formatMoney(totalProductCost), tone: 'blue' },
      { label: LABELS.expectedGrossMargin, value: formatMoney(totalGrossMargin), tone: 'gold' },
      { label: LABELS.grossMarginRate, value: formatPercent(totalGrossMarginRate), tone: 'purple' },
      { label: LABELS.expenseTotal, value: formatMoney(totalExpenses), tone: 'orange' },
      { label: LABELS.operatingProfit, value: formatMoney(totalOperatingProfit), tone: 'green' },
      { label: LABELS.operatingProfitRate, value: formatPercent(totalOperatingProfitRate), tone: 'green' },
      { label: LABELS.realProfit, value: formatMoney(totalRealProfit), tone: 'gold' },
      { label: LABELS.realProfitRate, value: formatPercent(totalRealProfitRate), tone: 'gold' },
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
    profitByQuote: quoteProfitRows.sort((a, b) => b.sales - a.sales),
    profitByCustomer: [...customerProfitMap.values()].map(withProfitRates).sort((a, b) => b.sales - a.sales),
    profitByProduct: [...productProfitMap.values()].map(withProfitRates).sort((a, b) => b.sales - a.sales),
    profitByProject: [...projectProfitMap.values()].map(withProfitRates).sort((a, b) => b.sales - a.sales),
    profitByInventory: [...inventoryProfitMap.values()].map(withProfitRates).sort((a, b) => b.sales - a.sales),
    profitBySupplier: [...supplierProfitMap.values()].map(withProfitRates).sort((a, b) => b.sales - a.sales),
    profitByMonth: [...monthProfitMap.values()].map(withProfitRates).sort((a, b) => String(b.month).localeCompare(String(a.month))),
    inventoryRows: inventoryRows.sort((a, b) => b.allocatedQuoteAmount - a.allocatedQuoteAmount),
    overdueFollowRows,
    sampleAwaitingRows,
    openComplaintRows,
    totals: {
      quoteAmount: totalQuoteAmount,
      productCost: totalProductCost,
      grossMargin: totalGrossMargin,
      grossMarginRate: totalGrossMarginRate,
      expenseTotal: totalExpenses,
      operatingProfit: totalOperatingProfit,
      operatingProfitRate: totalOperatingProfitRate,
      realProfit: totalRealProfit,
      realProfitRate: totalRealProfitRate,
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
