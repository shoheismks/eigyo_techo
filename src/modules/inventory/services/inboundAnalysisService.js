const CLOSED_STATUSES = new Set(['received', 'skipped', 'cancelled', 'failed', 'excluded', 'deleted']);
const ACTIVE_STATUSES = new Set(['pending', 'partially_received', 'draft', 'confirmed']);

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateOnly(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function dateDiffDays(fromDate, toDate) {
  const from = toDateOnly(fromDate);
  const to = toDateOnly(toDate);
  if (!from || !to) return null;
  const fromTime = new Date(`${from}T00:00:00Z`).getTime();
  const toTime = new Date(`${to}T00:00:00Z`).getTime();
  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return null;
  return Math.round((toTime - fromTime) / 86400000);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
}

function average(values = []) {
  const numeric = values.filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
  if (numeric.length === 0) return 0;
  return round(numeric.reduce((sum, value) => sum + Number(value), 0) / numeric.length, 2);
}

function monthKey(value) {
  const date = toDateOnly(value);
  return date ? date.slice(0, 7) : '未設定';
}

function productName(product, fallback = '') {
  return product?.name || product?.productName || product?.product_name || fallback || '商品未設定';
}

function productCode(product) {
  return product?.productCode || product?.product_code || '';
}

function lineProductId(line = {}) {
  return line.matchedProductId ?? line.matched_product_id ?? '';
}

function lineShipmentId(line = {}) {
  return line.inboundShipmentId ?? line.inbound_shipment_id ?? '';
}

function receiptId(receipt = {}) {
  return receipt.id || receipt.inboundReceiptId || receipt.inbound_receipt_id || '';
}

function receiptLineInboundLineId(line = {}) {
  return line.inboundShipmentLineId ?? line.inbound_shipment_line_id ?? '';
}

function receiptLineReceiptId(line = {}) {
  return line.inboundReceiptId ?? line.inbound_receipt_id ?? '';
}

function receiptLineProductId(line = {}) {
  return line.productId ?? line.product_id ?? '';
}

function receiptDate(receipt = {}) {
  return toDateOnly(receipt.receivedAt ?? receipt.received_at);
}

function isVoidedReceipt(receipt = {}) {
  return Boolean(receipt.voidedAt ?? receipt.voided_at);
}

function isVoidedReceiptLine(line = {}) {
  return Boolean(line.voidedAt ?? line.voided_at);
}

function scheduleChangeLineId(change = {}) {
  return change.inboundShipmentLineId ?? change.inbound_shipment_line_id ?? '';
}

function scheduleChangeReason(change = {}) {
  return change.reason || '理由未設定';
}

function scheduleChangeCreatedAt(change = {}) {
  return change.createdAt ?? change.created_at ?? '';
}

function plannedWeight(line = {}) {
  return toNumber(line.plannedWeight ?? line.planned_weight ?? line.weight);
}

function plannedPieces(line = {}) {
  return toNumber(line.plannedPieces ?? line.planned_pieces ?? line.quantityPieces ?? line.quantity_pieces);
}

function lineStatus(line = {}) {
  return line.status || 'pending';
}

function isDeletedOrCancelled(line = {}) {
  return Boolean(line.deletedAt ?? line.deleted_at ?? line.cancelledAt ?? line.cancelled_at);
}

function normalizeRows({
  inboundShipments = [],
  inboundReceipts = [],
  inboundReceiptLines = [],
  inboundScheduleChanges = [],
  products = [],
  today = new Date().toISOString().slice(0, 10),
  toleranceDays = 1,
} = {}) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const receiptMap = new Map(inboundReceipts.map((receipt) => [receiptId(receipt), receipt]));
  const shipmentMap = new Map(inboundShipments.map((shipment) => [shipment.id, shipment]));
  const lineReceiptLines = new Map();
  const lineChanges = new Map();

  inboundReceiptLines
    .filter((line) => !isVoidedReceiptLine(line))
    .forEach((line) => {
      const receipt = receiptMap.get(receiptLineReceiptId(line));
      if (!receipt || isVoidedReceipt(receipt)) return;
      const inboundLineId = receiptLineInboundLineId(line);
      if (!lineReceiptLines.has(inboundLineId)) lineReceiptLines.set(inboundLineId, []);
      lineReceiptLines.get(inboundLineId).push({ ...line, receipt });
    });

  inboundScheduleChanges.forEach((change) => {
    const lineId = scheduleChangeLineId(change);
    if (!lineChanges.has(lineId)) lineChanges.set(lineId, []);
    lineChanges.get(lineId).push(change);
  });

  return inboundShipments.flatMap((shipment) => (shipment.lines || [])
    .filter((line) => !isDeletedOrCancelled(line))
    .map((line) => {
      const shipmentForLine = shipmentMap.get(lineShipmentId(line)) || shipment;
      const productId = lineProductId(line);
      const product = productMap.get(productId);
      const receipts = (lineReceiptLines.get(line.id) || [])
        .sort((a, b) => String(receiptDate(a.receipt)).localeCompare(String(receiptDate(b.receipt))));
      const changes = (lineChanges.get(line.id) || [])
        .sort((a, b) => String(scheduleChangeCreatedAt(a)).localeCompare(String(scheduleChangeCreatedAt(b))));
      const receiptDates = receipts.map((lineReceipt) => receiptDate(lineReceipt.receipt)).filter(Boolean);
      const firstReceiptDate = receiptDates[0] || '';
      const finalReceiptDate = receiptDates[receiptDates.length - 1] || '';
      const originalCustomsDate = toDateOnly(line.originalCustomsClearancePlannedDate ?? line.original_customs_clearance_planned_date ?? line.customsClearancePlannedDate ?? line.customs_clearance_planned_date);
      const finalCustomsDate = toDateOnly(line.customsClearancePlannedDate ?? line.customs_clearance_planned_date);
      const plannedWeightValue = plannedWeight(line);
      const actualWeight = round(receipts.reduce((sum, receiptLine) => sum + toNumber(receiptLine.receivedWeight ?? receiptLine.received_weight), 0), 3);
      const plannedPiecesValue = plannedPieces(line);
      const actualPieces = round(receipts.reduce((sum, receiptLine) => sum + toNumber(receiptLine.receivedPieces ?? receiptLine.received_pieces), 0), 3);
      const status = lineStatus(line);
      const completed = status === 'received' || (plannedWeightValue > 0 && actualWeight >= plannedWeightValue);
      const actualDate = finalReceiptDate;
      const originalVarianceDays = actualDate ? dateDiffDays(originalCustomsDate, actualDate) : null;
      const finalVarianceDays = actualDate ? dateDiffDays(finalCustomsDate, actualDate) : null;
      const scheduleChangeDays = dateDiffDays(originalCustomsDate, finalCustomsDate);
      const overdueDays = !completed && finalCustomsDate && today > finalCustomsDate ? dateDiffDays(finalCustomsDate, today) : 0;
      const onTime = completed && finalVarianceDays !== null ? Math.abs(finalVarianceDays) <= toleranceDays : false;
      const delayed = completed
        ? finalVarianceDays !== null && finalVarianceDays > toleranceDays
        : overdueDays > 0;
      const weightVariance = round(actualWeight - plannedWeightValue, 3);
      const arrivalRate = plannedWeightValue > 0 ? round((actualWeight / plannedWeightValue) * 100, 1) : 0;

      return {
        id: line.id,
        shipmentId: shipmentForLine?.id || lineShipmentId(line),
        supplierName: shipmentForLine?.supplierName || shipmentForLine?.supplier_name || '',
        productId,
        productName: productName(product, line.productNameRaw ?? line.product_name_raw),
        productCode: productCode(product),
        brandName: line.brandNameRaw ?? line.brand_name_raw ?? product?.brandName ?? product?.brand_name ?? '',
        warehouseName: line.warehouseName ?? line.warehouse_name ?? '',
        contractNo: line.contractNo ?? line.contract_no ?? '',
        originalCustomsDate,
        finalCustomsDate,
        firstReceiptDate,
        finalReceiptDate,
        actualDate,
        originalVarianceDays,
        finalVarianceDays,
        scheduleChangeDays: scheduleChangeDays ?? 0,
        scheduleChangeCount: changes.length,
        scheduleReasons: [...new Set(changes.map(scheduleChangeReason).filter(Boolean))],
        plannedWeight: round(plannedWeightValue, 3),
        actualWeight,
        weightVariance,
        arrivalRate,
        plannedPieces: round(plannedPiecesValue, 3),
        actualPieces,
        receiptCount: receipts.length,
        status,
        completed,
        delayed,
        overdueDays,
        onTime,
        month: monthKey(actualDate || finalCustomsDate || originalCustomsDate),
      };
    }));
}

function aggregateBy(rows, key, labelKey = key) {
  const map = new Map();
  rows.forEach((row) => {
    const label = row[key] || '未設定';
    const current = map.get(label) || {
      [labelKey]: label,
      count: 0,
      completedCount: 0,
      delayedCount: 0,
      plannedWeight: 0,
      actualWeight: 0,
      weightVariance: 0,
      averageDelayDays: 0,
      complianceRate: 0,
      _delayValues: [],
    };
    current.count += 1;
    current.completedCount += row.completed ? 1 : 0;
    current.delayedCount += row.delayed ? 1 : 0;
    current.plannedWeight = round(current.plannedWeight + row.plannedWeight, 3);
    current.actualWeight = round(current.actualWeight + row.actualWeight, 3);
    current.weightVariance = round(current.weightVariance + row.weightVariance, 3);
    if (row.finalVarianceDays !== null) current._delayValues.push(row.finalVarianceDays);
    map.set(label, current);
  });

  return [...map.values()].map((row) => ({
    ...row,
    averageDelayDays: average(row._delayValues),
    complianceRate: row.completedCount > 0 ? round((rows.filter((item) => (item[key] || '未設定') === row[labelKey] && item.onTime).length / row.completedCount) * 100, 1) : 0,
    _delayValues: undefined,
  }));
}

function aggregateReasons(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (row.scheduleReasons.length === 0) return;
    row.scheduleReasons.forEach((reason) => {
      map.set(reason, (map.get(reason) || 0) + 1);
    });
  });
  return [...map.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, 'ja'));
}

function filterRows(rows, filters = {}) {
  const from = toDateOnly(filters.from);
  const to = toDateOnly(filters.to);
  return rows.filter((row) => {
    const date = row.actualDate || row.finalCustomsDate || row.originalCustomsDate;
    const matchesDate = (!from || !date || date >= from) && (!to || !date || date <= to);
    const matchesSupplier = !filters.supplierName || filters.supplierName === 'all' || row.supplierName === filters.supplierName;
    const matchesProduct = !filters.productId || filters.productId === 'all' || row.productId === filters.productId;
    const matchesStatus = !filters.status || filters.status === 'all' || row.status === filters.status;
    const matchesCompletion =
      !filters.completion ||
      filters.completion === 'all' ||
      (filters.completion === 'completed' && row.completed) ||
      (filters.completion === 'open' && !row.completed);
    const matchesDelay =
      !filters.delay ||
      filters.delay === 'all' ||
      (filters.delay === 'delayed' && row.delayed) ||
      (filters.delay === 'on-time' && row.completed && row.onTime) ||
      (filters.delay === 'overdue-open' && !row.completed && row.overdueDays > 0);
    return matchesDate && matchesSupplier && matchesProduct && matchesStatus && matchesCompletion && matchesDelay;
  });
}

export function buildInboundAnalysis({
  inboundShipments = [],
  inboundReceipts = [],
  inboundReceiptLines = [],
  inboundScheduleChanges = [],
  products = [],
  filters = {},
  today = new Date().toISOString().slice(0, 10),
  toleranceDays = 1,
} = {}) {
  const allRows = normalizeRows({
    inboundShipments,
    inboundReceipts,
    inboundReceiptLines,
    inboundScheduleChanges,
    products,
    today,
    toleranceDays,
  }).filter((row) => ACTIVE_STATUSES.has(row.status) || CLOSED_STATUSES.has(row.status));
  const rows = filterRows(allRows, filters);
  const completedRows = rows.filter((row) => row.completed);
  const delayValues = completedRows.map((row) => row.finalVarianceDays).filter((value) => value !== null);
  const onTimeCount = completedRows.filter((row) => row.onTime).length;
  const delayedCount = rows.filter((row) => row.delayed).length;
  const totalWeightVariance = round(rows.reduce((sum, row) => sum + row.weightVariance, 0), 3);

  const monthly = aggregateBy(rows, 'month', 'month').sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const bySupplier = aggregateBy(rows, 'supplierName', 'supplierName').sort((a, b) => b.plannedWeight - a.plannedWeight);
  const byProduct = aggregateBy(rows, 'productName', 'productName').sort((a, b) => Math.abs(b.weightVariance) - Math.abs(a.weightVariance));
  const byReason = aggregateReasons(rows);

  return {
    toleranceDays,
    rows,
    kpis: {
      plannedCount: rows.length,
      completedCount: completedRows.length,
      averageDelayDays: average(delayValues),
      complianceRate: completedRows.length > 0 ? round((onTimeCount / completedRows.length) * 100, 1) : 0,
      averageScheduleChangeDays: average(rows.map((row) => row.scheduleChangeDays)),
      delayedCount,
      weightVariance: totalWeightVariance,
    },
    monthly,
    bySupplier,
    byProduct,
    byReason,
    filterOptions: {
      suppliers: [...new Set(allRows.map((row) => row.supplierName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja')),
      products: [...new Map(allRows.filter((row) => row.productId).map((row) => [row.productId, { id: row.productId, name: row.productName }])).values()]
        .sort((a, b) => a.name.localeCompare(b.name, 'ja')),
      statuses: [...new Set(allRows.map((row) => row.status).filter(Boolean))].sort(),
    },
  };
}
