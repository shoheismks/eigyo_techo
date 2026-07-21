import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { canUseCloud, getLocalSyncReason } from '../../../shared/services/recordSyncService.js';
import { DEFAULT_QUOTE_TAX_RATE, calculateQuoteTotals } from '../../quotes/hooks/useQuotes.js';
import { parsePrice } from '../../products/hooks/useProducts.js';

const STORAGE_KEY = 'eigyo-techo-sales-orders';

export const SALES_ORDER_STATUSES = ['下書き', '受注確定', '変更中', '完了', '取消'];

export const emptySalesOrder = {
  userId: '',
  salesOrderNumber: '',
  issuerId: '',
  issuerSnapshot: null,
  customerId: '',
  customerSnapshot: null,
  contactId: '',
  projectId: '',
  quoteId: '',
  confirmationQuoteId: '',
  sourceType: 'manual',
  sourceSnapshot: null,
  subject: '',
  orderDate: '',
  expectedDeliveryDate: '',
  priority: 3,
  reservationStatus: 'unreserved',
  reservedTotal: 0,
  shortageTotal: 0,
  status: '下書き',
  currency: 'JPY',
  subtotal: 0,
  taxAmount: 0,
  grandTotal: 0,
  memo: '',
  salesOrderLines: [],
  history: [],
  createdBy: '',
  createdByName: '',
  updatedBy: '',
  updatedByName: '',
  confirmedAt: '',
  isDeleted: false,
  deletedAt: '',
  createdAt: '',
  updatedAt: '',
};

export function emptySalesOrderLine() {
  return {
    id: crypto.randomUUID(),
    productId: '',
    inventoryId: '',
    lineNumber: 1,
    productCode: '',
    productName: '',
    specification: '',
    temperatureZone: '',
    expirationText: '',
    quantity: '',
    unit: 'kg',
    unitPrice: '',
    taxRate: DEFAULT_QUOTE_TAX_RATE,
    amount: '',
    taxAmount: '',
    taxIncludedAmount: '',
    reservedQuantity: 0,
    shortageQuantity: 0,
    reservationStatus: 'unreserved',
    memo: '',
    sourceLineSnapshot: null,
  };
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberOrZero(value) {
  const parsed = parsePrice(value);
  return parsed === '' ? 0 : parsed;
}

function normalizeLine(line = {}, index = 0, userId = '', orderId = '') {
  const quantity = numberOrZero(line.quantity);
  const unitPrice = numberOrZero(line.unitPrice ?? line.unit_price);
  const taxRate = numberOrZero(line.taxRate ?? line.tax_rate ?? DEFAULT_QUOTE_TAX_RATE);
  const amount = quantity && unitPrice ? quantity * unitPrice : numberOrZero(line.amount);
  const taxAmount = amount ? Math.round(amount * (taxRate / 100)) : numberOrZero(line.taxAmount ?? line.tax_amount);

  return {
    ...emptySalesOrderLine(),
    ...line,
    id: line.id ?? crypto.randomUUID(),
    userId: line.userId ?? line.user_id ?? userId,
    salesOrderId: line.salesOrderId ?? line.sales_order_id ?? orderId,
    productId: line.productId ?? line.product_id ?? '',
    inventoryId: line.inventoryId ?? line.inventory_id ?? '',
    lineNumber: line.lineNumber ?? line.line_number ?? index + 1,
    productCode: line.productCode ?? line.product_code ?? '',
    productName: line.productName ?? line.product_name ?? line.description ?? '',
    specification: line.specification ?? line.packageStyle ?? line.package_style ?? '',
    temperatureZone: line.temperatureZone ?? line.temperature_zone ?? '',
    expirationText: line.expirationText ?? line.expiration_text ?? line.inventoryExpiryDate ?? '',
    quantity: line.quantity ?? '',
    unit: line.unit || 'kg',
    unitPrice: line.unitPrice ?? line.unit_price ?? '',
    taxRate: line.taxRate ?? line.tax_rate ?? DEFAULT_QUOTE_TAX_RATE,
    amount,
    taxAmount,
    taxIncludedAmount: amount + taxAmount,
    reservedQuantity: line.reservedQuantity ?? line.reserved_quantity ?? 0,
    shortageQuantity: line.shortageQuantity ?? line.shortage_quantity ?? Math.max(0, quantity - numberOrZero(line.reservedQuantity ?? line.reserved_quantity)),
    reservationStatus: line.reservationStatus ?? line.reservation_status ?? 'unreserved',
    memo: line.memo ?? '',
    sourceLineSnapshot: line.sourceLineSnapshot ?? line.source_line_snapshot ?? null,
  };
}

function calculateOrderTotals(lines = []) {
  const normalizedLines = lines.map((line, index) => normalizeLine(line, index));
  const subtotal = normalizedLines.reduce((sum, line) => sum + numberOrZero(line.amount), 0);
  const taxAmount = normalizedLines.reduce((sum, line) => sum + numberOrZero(line.taxAmount), 0);
  return { subtotal, taxAmount, grandTotal: subtotal + taxAmount, lines: normalizedLines };
}

export function normalizeSalesOrder(order = {}, userId = '') {
  const id = order.id ?? crypto.randomUUID();
  const rawLines = asArray(order.salesOrderLines ?? order.sales_order_lines ?? order.lines);
  const totals = calculateOrderTotals(rawLines);

  return {
    ...emptySalesOrder,
    ...order,
    id,
    userId: order.userId ?? order.user_id ?? userId,
    salesOrderNumber: order.salesOrderNumber ?? order.sales_order_number ?? '',
    issuerId: order.issuerId ?? order.issuer_id ?? '',
    issuerSnapshot: order.issuerSnapshot ?? order.issuer_snapshot ?? null,
    customerId: order.customerId ?? order.customer_id ?? '',
    customerSnapshot: order.customerSnapshot ?? order.customer_snapshot ?? null,
    contactId: order.contactId ?? order.contact_id ?? '',
    projectId: order.projectId ?? order.project_id ?? '',
    quoteId: order.quoteId ?? order.quote_id ?? '',
    confirmationQuoteId: order.confirmationQuoteId ?? order.confirmation_quote_id ?? '',
    sourceType: order.sourceType ?? order.source_type ?? 'manual',
    sourceSnapshot: order.sourceSnapshot ?? order.source_snapshot ?? null,
    subject: order.subject ?? '',
    orderDate: order.orderDate ?? order.order_date ?? todayString(),
    expectedDeliveryDate: order.expectedDeliveryDate ?? order.expected_delivery_date ?? '',
    priority: Number(order.priority ?? 3),
    reservationStatus: order.reservationStatus ?? order.reservation_status ?? 'unreserved',
    reservedTotal: order.reservedTotal ?? order.reserved_total ?? 0,
    shortageTotal: order.shortageTotal ?? order.shortage_total ?? 0,
    status: SALES_ORDER_STATUSES.includes(order.status) ? order.status : '下書き',
    currency: order.currency || 'JPY',
    subtotal: order.subtotal ?? totals.subtotal,
    taxAmount: order.taxAmount ?? order.tax_amount ?? totals.taxAmount,
    grandTotal: order.grandTotal ?? order.grand_total ?? totals.grandTotal,
    memo: order.memo ?? '',
    salesOrderLines: totals.lines.map((line, index) => normalizeLine(line, index, userId, id)),
    history: asArray(order.history ?? order.salesOrderHistory ?? order.sales_order_history),
    createdBy: order.createdBy ?? order.created_by ?? userId,
    createdByName: order.createdByName ?? order.created_by_name ?? '',
    updatedBy: order.updatedBy ?? order.updated_by ?? '',
    updatedByName: order.updatedByName ?? order.updated_by_name ?? '',
    confirmedAt: order.confirmedAt ?? order.confirmed_at ?? '',
    isDeleted: Boolean(order.isDeleted ?? order.is_deleted ?? false),
    deletedAt: order.deletedAt ?? order.deleted_at ?? '',
    createdAt: order.createdAt ?? order.created_at ?? new Date().toISOString(),
    updatedAt: order.updatedAt ?? order.updated_at ?? new Date().toISOString(),
  };
}

function orderToRow(order) {
  return {
    id: order.id,
    user_id: order.userId,
    sales_order_number: order.salesOrderNumber || null,
    issuer_id: order.issuerId || null,
    issuer_snapshot: order.issuerSnapshot,
    customer_id: order.customerId || null,
    customer_snapshot: order.customerSnapshot,
    contact_id: order.contactId || null,
    project_id: order.projectId || null,
    quote_id: order.quoteId || null,
    confirmation_quote_id: order.confirmationQuoteId || null,
    source_type: order.sourceType,
    source_snapshot: order.sourceSnapshot,
    subject: order.subject,
    order_date: order.orderDate || null,
    expected_delivery_date: order.expectedDeliveryDate || null,
    priority: order.priority || 3,
    reservation_status: order.reservationStatus || 'unreserved',
    reserved_total: order.reservedTotal || 0,
    shortage_total: order.shortageTotal || 0,
    status: order.status,
    currency: order.currency,
    subtotal: order.subtotal,
    tax_amount: order.taxAmount,
    grand_total: order.grandTotal,
    memo: order.memo,
    created_by: order.createdBy,
    created_by_name: order.createdByName,
    updated_by: order.updatedBy,
    updated_by_name: order.updatedByName,
    confirmed_at: order.confirmedAt || null,
    is_deleted: order.isDeleted,
    deleted_at: order.deletedAt || null,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };
}

function lineToRow(line, order) {
  return {
    id: line.id,
    user_id: order.userId,
    sales_order_id: order.id,
    product_id: line.productId || null,
    inventory_id: line.inventoryId || null,
    line_number: line.lineNumber,
    product_code: line.productCode,
    product_name: line.productName,
    specification: line.specification,
    temperature_zone: line.temperatureZone,
    expiration_text: line.expirationText,
    quantity: line.quantity === '' ? null : Number(line.quantity),
    unit: line.unit,
    unit_price: line.unitPrice === '' ? null : Number(line.unitPrice),
    tax_rate: line.taxRate === '' ? null : Number(line.taxRate),
    amount: line.amount,
    tax_amount: line.taxAmount,
    tax_included_amount: line.taxIncludedAmount,
    reserved_quantity: line.reservedQuantity || 0,
    shortage_quantity: line.shortageQuantity || 0,
    reservation_status: line.reservationStatus || 'unreserved',
    memo: line.memo,
    source_line_snapshot: line.sourceLineSnapshot,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };
}

function historyToRow(entry, order) {
  return {
    id: entry.id ?? crypto.randomUUID(),
    user_id: order.userId,
    sales_order_id: order.id,
    event_type: entry.eventType ?? entry.event_type ?? 'updated',
    summary: entry.summary ?? '',
    before_snapshot: entry.beforeSnapshot ?? entry.before_snapshot ?? null,
    after_snapshot: entry.afterSnapshot ?? entry.after_snapshot ?? null,
    created_by: entry.createdBy ?? entry.created_by ?? order.updatedBy ?? order.createdBy,
    created_by_name: entry.createdByName ?? entry.created_by_name ?? order.updatedByName ?? order.createdByName,
    created_at: entry.createdAt ?? entry.created_at ?? new Date().toISOString(),
  };
}

function rowToOrder(row, lines = [], history = [], userId = '') {
  return normalizeSalesOrder({
    id: row.id,
    userId: row.user_id,
    salesOrderNumber: row.sales_order_number,
    issuerId: row.issuer_id,
    issuerSnapshot: row.issuer_snapshot,
    customerId: row.customer_id,
    customerSnapshot: row.customer_snapshot,
    contactId: row.contact_id,
    projectId: row.project_id,
    quoteId: row.quote_id,
    confirmationQuoteId: row.confirmation_quote_id,
    sourceType: row.source_type,
    sourceSnapshot: row.source_snapshot,
    subject: row.subject,
    orderDate: row.order_date,
    expectedDeliveryDate: row.expected_delivery_date,
    priority: row.priority,
    reservationStatus: row.reservation_status,
    reservedTotal: row.reserved_total,
    shortageTotal: row.shortage_total,
    status: row.status,
    currency: row.currency,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    grandTotal: row.grand_total,
    memo: row.memo,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
    confirmedAt: row.confirmed_at,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    salesOrderLines: lines,
    history,
  }, userId);
}

function readLocal(userId = '') {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return saved.map((order) => normalizeSalesOrder(order, userId)).filter((order) => !userId || order.userId === userId);
  } catch {
    return [];
  }
}

function saveLocal(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.map((record) => normalizeSalesOrder(record))));
}

export function generateSalesOrderNumber(orders = [], issuerId = '') {
  const year = new Date().getFullYear();
  const prefix = `SO-${year}-`;
  const sameIssuer = orders.filter((order) => !issuerId || order.issuerId === issuerId);
  const max = sameIssuer.reduce((currentMax, order) => {
    const number = order.salesOrderNumber || '';
    if (!number.startsWith(prefix)) return currentMax;
    const parsed = Number(number.replace(prefix, ''));
    return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax;
  }, 0);
  return `${prefix}${String(max + 1).padStart(6, '0')}`;
}

function customerSnapshot(customer = {}) {
  return customer ? {
    id: customer.id || '',
    companyName: customer.companyName || '',
    customerCode: customer.customerCode || '',
    address: customer.address || '',
    phone: customer.phone || '',
    email: customer.email || '',
  } : null;
}

function issuerSnapshot(issuer = {}) {
  return issuer ? {
    id: issuer.id || '',
    name: issuer.name || issuer.legalName || '',
    legalName: issuer.legalName || issuer.name || '',
    registrationNumber: issuer.registrationNumber || issuer.invoiceRegistrationNumber || '',
    address: issuer.address || '',
    phone: issuer.phone || '',
    email: issuer.email || '',
    contactPerson: issuer.contactPerson || '',
  } : null;
}

function quoteLineToOrderLine(line = {}, index = 0, defaultTaxRate = DEFAULT_QUOTE_TAX_RATE) {
  const calculated = calculateQuoteTotals({ quoteLines: [line], defaultTaxRate }).lines?.[0] || line;
  return normalizeLine({
    ...emptySalesOrderLine(),
    productId: line.productId || '',
    inventoryId: line.inventoryId || '',
    lineNumber: index + 1,
    productCode: line.productCode || '',
    productName: line.productName || line.description || '',
    specification: line.packageStyle || line.specification || line.category || '',
    temperatureZone: line.temperatureZone || '',
    expirationText: line.expirationText || line.inventoryExpiryDate || '',
    quantity: line.quantity || '',
    unit: line.unit || 'kg',
    unitPrice: line.unitPrice || '',
    taxRate: line.taxRate || defaultTaxRate,
    amount: calculated.amount || '',
    taxAmount: calculated.taxAmount || '',
    taxIncludedAmount: (numberOrZero(calculated.amount) + numberOrZero(calculated.taxAmount)) || '',
    memo: line.memo || '',
    sourceLineSnapshot: { ...line },
  }, index);
}

export function buildSalesOrderDraft({
  sourceType = 'manual',
  quote = null,
  customer = null,
  contact = null,
  project = null,
  issuer = null,
  orders = [],
  user = null,
  initial = {},
}) {
  const selectedIssuer = quote?.issuerSnapshot || issuer || {};
  const defaultTaxRate = quote?.defaultTaxRate || selectedIssuer.defaultTaxRate || DEFAULT_QUOTE_TAX_RATE;
  const sourceLines = quote?.quoteLines?.length ? quote.quoteLines : [];
  const salesOrderLines = sourceLines.map((line, index) => quoteLineToOrderLine(line, index, defaultTaxRate));
  const totals = calculateOrderTotals(salesOrderLines);
  const now = new Date().toISOString();
  const resolvedSourceType = quote
    ? sourceType === 'confirmation' || quote.confirmationPdfUrl ? sourceType : 'quote'
    : sourceType;

  return normalizeSalesOrder({
    ...emptySalesOrder,
    ...initial,
    id: crypto.randomUUID(),
    userId: user?.id || quote?.userId || '',
    salesOrderNumber: generateSalesOrderNumber(orders, quote?.issuerId || selectedIssuer.id || ''),
    issuerId: quote?.issuerId || selectedIssuer.id || '',
    issuerSnapshot: issuerSnapshot(selectedIssuer),
    customerId: quote?.customerId || customer?.id || '',
    customerSnapshot: customerSnapshot(customer),
    contactId: quote?.contactIds?.[0] || contact?.id || '',
    projectId: quote?.projectId || project?.id || '',
    quoteId: quote?.id || '',
    confirmationQuoteId: resolvedSourceType === 'confirmation' ? quote?.id || '' : '',
    sourceType: resolvedSourceType,
    sourceSnapshot: quote ? { ...quote } : null,
    subject: quote?.projectName || project?.title || initial.subject || '受注',
    orderDate: todayString(),
    expectedDeliveryDate: quote?.deliveryDate || '',
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    grandTotal: totals.grandTotal,
    salesOrderLines: totals.lines.length ? totals.lines : [emptySalesOrderLine()],
    createdBy: user?.id || '',
    createdByName: user?.email || '',
    updatedBy: user?.id || '',
    updatedByName: user?.email || '',
    createdAt: now,
    updatedAt: now,
  }, user?.id || quote?.userId || '');
}

async function fetchRemote(userId = '') {
  if (!canUseCloud()) return [];
  const orderQuery = supabase.from('sales_orders').select('*').order('updated_at', { ascending: false });
  const lineQuery = supabase.from('sales_order_lines').select('*').order('line_number', { ascending: true });
  const historyQuery = supabase.from('sales_order_history').select('*').order('created_at', { ascending: false });
  const [orderResult, lineResult, historyResult] = await Promise.all([
    userId ? orderQuery.eq('user_id', userId) : orderQuery,
    userId ? lineQuery.eq('user_id', userId) : lineQuery,
    userId ? historyQuery.eq('user_id', userId) : historyQuery,
  ]);
  if (orderResult.error) throw orderResult.error;
  if (lineResult.error) throw lineResult.error;
  if (historyResult.error) throw historyResult.error;

  const linesByOrder = new Map();
  (lineResult.data ?? []).forEach((row) => {
    const line = normalizeLine(row, Number(row.line_number || 1) - 1, userId, row.sales_order_id);
    linesByOrder.set(row.sales_order_id, [...(linesByOrder.get(row.sales_order_id) ?? []), line]);
  });
  const historyByOrder = new Map();
  (historyResult.data ?? []).forEach((row) => {
    const entry = {
      id: row.id,
      eventType: row.event_type,
      summary: row.summary,
      beforeSnapshot: row.before_snapshot,
      afterSnapshot: row.after_snapshot,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
    };
    historyByOrder.set(row.sales_order_id, [...(historyByOrder.get(row.sales_order_id) ?? []), entry]);
  });

  return (orderResult.data ?? []).map((row) => rowToOrder(row, linesByOrder.get(row.id) ?? [], historyByOrder.get(row.id) ?? [], userId));
}

async function persistOrder(order, historyEntry = null) {
  if (!canUseCloud()) return;
  await supabase.from('sales_orders').upsert(orderToRow(order), { onConflict: 'id' }).throwOnError();
  await supabase.from('sales_order_lines').delete().eq('sales_order_id', order.id).eq('user_id', order.userId).throwOnError();
  if (order.salesOrderLines.length) {
    await supabase.from('sales_order_lines').insert(order.salesOrderLines.map((line, index) => lineToRow(normalizeLine(line, index, order.userId, order.id), order))).throwOnError();
  }
  if (historyEntry) {
    await supabase.from('sales_order_history').insert(historyToRow(historyEntry, order)).throwOnError();
  }
}

export function useSalesOrders(userId = '') {
  const [records, setRecords] = useState(() => (canUseCloud() ? [] : readLocal(userId)));
  const [syncState, setSyncState] = useState(canUseCloud() ? 'syncing' : 'local');
  const [syncError, setSyncError] = useState('');
  const writeSequenceRef = useRef(0);

  async function reload(writeSequence = null) {
    if (!canUseCloud()) {
      setRecords(readLocal(userId));
      setSyncState('local');
      setSyncError(getLocalSyncReason());
      return;
    }
    try {
      setSyncState('syncing');
      const remote = await fetchRemote(userId);
      if (writeSequence !== null && writeSequence !== writeSequenceRef.current) return;
      setRecords(remote);
      saveLocal(remote);
      setSyncState('supabase');
      setSyncError('');
    } catch (error) {
      setRecords(readLocal(userId));
      setSyncState('local');
      setSyncError(getLocalSyncReason(error.message));
    }
  }

  useEffect(() => {
    reload();
  }, [userId]);

  const sortedRecords = useMemo(() => [...records].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [records]);

  function upsertLocal(nextRecord, previousRecord = null) {
    const eventType = !previousRecord ? 'created' : previousRecord.status !== nextRecord.status ? 'status_changed' : 'updated';
    const historyEntry = {
      id: crypto.randomUUID(),
      eventType,
      summary: eventType === 'created' ? '受注を作成しました' : eventType === 'status_changed' ? `ステータスを${nextRecord.status}へ変更しました` : '受注を更新しました',
      beforeSnapshot: previousRecord ? { ...previousRecord } : null,
      afterSnapshot: { ...nextRecord },
      createdBy: nextRecord.updatedBy || nextRecord.createdBy,
      createdByName: nextRecord.updatedByName || nextRecord.createdByName,
      createdAt: new Date().toISOString(),
    };
    const withHistory = normalizeSalesOrder({ ...nextRecord, history: [historyEntry, ...(nextRecord.history ?? [])] }, userId);

    setRecords((current) => {
      const exists = current.some((record) => record.id === withHistory.id);
      const next = exists ? current.map((record) => (record.id === withHistory.id ? withHistory : record)) : [withHistory, ...current];
      saveLocal(next);
      return next;
    });

    if (canUseCloud()) {
      const writeSequence = ++writeSequenceRef.current;
      setSyncState('syncing');
      persistOrder(withHistory, historyEntry)
        .then(() => reload(writeSequence))
        .catch((error) => {
          setSyncState('local');
          setSyncError(getLocalSyncReason(error.message));
        });
    }

    return withHistory.id;
  }

  function addRecord(order) {
    const now = new Date().toISOString();
    const normalized = normalizeSalesOrder({ ...order, userId, createdAt: now, updatedAt: now }, userId);
    return upsertLocal(normalized);
  }

  function updateRecord(id, updates) {
    const previous = records.find((record) => record.id === id);
    if (!previous) return;
    const now = new Date().toISOString();
    const normalized = normalizeSalesOrder({
      ...previous,
      ...updates,
      id,
      userId,
      updatedAt: now,
      confirmedAt: updates.status === '受注確定' ? previous.confirmedAt || now : previous.confirmedAt,
    }, userId);
    upsertLocal(normalized, previous);
  }

  function removeRecord(id) {
    updateRecord(id, { isDeleted: true, status: '取消', deletedAt: new Date().toISOString() });
  }

  async function runReservationRpc(functionName, params) {
    if (!canUseCloud()) {
      throw new Error('Supabase接続時のみ在庫引当を実行できます。');
    }
    setSyncState('syncing');
    const { data, error } = await supabase.rpc(functionName, params);
    if (error) {
      setSyncError(getLocalSyncReason(error.message));
      throw error;
    }
    await reload(++writeSequenceRef.current);
    return data;
  }

  function reserveLineFefo(orderId, lineId, quantity = null) {
    return runReservationRpc('reserve_sales_order_line_fefo', {
      p_sales_order_id: orderId,
      p_sales_order_line_id: lineId,
      p_quantity: quantity === '' ? null : quantity,
      p_notes: null,
    });
  }

  function reserveLineLot(orderId, lineId, lotId, quantity = null) {
    return runReservationRpc('reserve_sales_order_line_lot', {
      p_sales_order_id: orderId,
      p_sales_order_line_id: lineId,
      p_inventory_lot_id: lotId,
      p_quantity: quantity === '' ? null : quantity,
      p_notes: null,
    });
  }

  function releaseLineReservations(orderId, lineId, reservationId = null, quantity = null) {
    return runReservationRpc('release_sales_order_line_reservations', {
      p_sales_order_id: orderId,
      p_sales_order_line_id: lineId,
      p_reservation_id: reservationId || null,
      p_release_quantity: quantity === '' ? null : quantity,
      p_notes: null,
    });
  }

  function reallocateLineFefo(orderId, lineId, quantity = null) {
    return runReservationRpc('reallocate_sales_order_line_fefo', {
      p_sales_order_id: orderId,
      p_sales_order_line_id: lineId,
      p_quantity: quantity === '' ? null : quantity,
      p_notes: null,
    });
  }

  return {
    records: sortedRecords,
    addRecord,
    updateRecord,
    removeRecord,
    reserveLineFefo,
    reserveLineLot,
    releaseLineReservations,
    reallocateLineFefo,
    reload,
    syncState,
    syncError,
  };
}
