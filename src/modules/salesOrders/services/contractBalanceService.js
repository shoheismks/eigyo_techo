function numberValue(value) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function isShipped(shipment) {
  return normalizeStatus(shipment?.status) === 'shipped';
}

function isCancelled(shipment) {
  const status = normalizeStatus(shipment?.status);
  return status === 'cancelled' || status === 'canceled';
}

function lineAmount(quantity, unitPrice) {
  return Math.max(0, numberValue(quantity)) * numberValue(unitPrice);
}

function getOrderDueDate(order) {
  return order?.expectedDeliveryDate || order?.deliveryDate || order?.orderDate || '';
}

export function calculateContractBalanceLines({ salesOrders = [], shipments = [] } = {}) {
  const shipmentLineIds = new Set();
  const shipmentLinesBySalesOrderLine = new Map();

  shipments
    .filter((shipment) => !shipment?.isDeleted)
    .forEach((shipment) => {
      (shipment.shipmentLines || shipment.lines || []).forEach((line) => {
        const salesOrderLineId = line.salesOrderLineId || line.sales_order_line_id;
        const shipmentLineId = line.id || `${shipment.id}-${salesOrderLineId}-${line.inventoryLotId || line.inventory_lot_id || ''}`;
        if (!salesOrderLineId || shipmentLineIds.has(shipmentLineId)) return;
        shipmentLineIds.add(shipmentLineId);
        const current = shipmentLinesBySalesOrderLine.get(salesOrderLineId) || {
          shippedQuantity: 0,
          scheduledQuantity: 0,
        };
        const quantity = numberValue(line.quantity);
        if (isShipped(shipment)) {
          current.shippedQuantity += quantity;
        } else if (!isCancelled(shipment)) {
          current.scheduledQuantity += quantity;
        }
        shipmentLinesBySalesOrderLine.set(salesOrderLineId, current);
      });
    });

  const today = new Date().toISOString().slice(0, 10);

  return salesOrders
    .filter((order) => !order?.isDeleted)
    .flatMap((order) => (order.salesOrderLines || order.lines || []).map((line) => {
      const orderedQuantity = numberValue(line.quantity);
      const cancelledQuantity = numberValue(line.cancelledQuantity || line.cancelled_quantity);
      const totals = shipmentLinesBySalesOrderLine.get(line.id) || { shippedQuantity: 0, scheduledQuantity: 0 };
      const shippedQuantity = Math.max(0, totals.shippedQuantity);
      const scheduledQuantity = Math.max(0, totals.scheduledQuantity);
      const remainingQuantity = Math.max(0, orderedQuantity - shippedQuantity - cancelledQuantity);
      const practicalRemainingQuantity = Math.max(0, remainingQuantity - scheduledQuantity);
      const unitPrice = numberValue(line.unitPrice ?? line.unit_price);
      const orderedAmount = lineAmount(orderedQuantity, unitPrice);
      const shippedAmount = lineAmount(shippedQuantity, unitPrice);
      const remainingAmount = lineAmount(remainingQuantity, unitPrice);
      const scheduledAmount = lineAmount(scheduledQuantity, unitPrice);
      const dueDate = getOrderDueDate(order);
      const progressRate = orderedAmount > 0
        ? Math.min(100, Math.round((shippedAmount / orderedAmount) * 1000) / 10)
        : orderedQuantity > 0
          ? Math.min(100, Math.round((shippedQuantity / orderedQuantity) * 1000) / 10)
          : 0;

      return {
        salesOrderId: order.id,
        salesOrderLineId: line.id,
        salesOrderNumber: order.salesOrderNumber || order.sales_order_number || '',
        customerId: order.customerId || order.customer_id || '',
        projectId: order.projectId || order.project_id || '',
        productId: line.productId || line.product_id || '',
        productCode: line.productCode || line.product_code || '',
        productName: line.productName || line.product_name || '',
        unit: line.unit || '',
        dueDate,
        orderDate: order.orderDate || order.order_date || '',
        orderedQuantity,
        shippedQuantity,
        scheduledQuantity,
        cancelledQuantity,
        remainingQuantity,
        practicalRemainingQuantity,
        unitPrice,
        orderedAmount,
        shippedAmount,
        scheduledAmount,
        remainingAmount,
        progressRate,
        hasRemaining: remainingQuantity > 0,
        isOverdue: Boolean(dueDate && dueDate < today && remainingQuantity > 0),
      };
    }));
}

export function summarizeContractBalances(lines = []) {
  const totalOrderedAmount = lines.reduce((sum, line) => sum + numberValue(line.orderedAmount), 0);
  const totalShippedAmount = lines.reduce((sum, line) => sum + numberValue(line.shippedAmount), 0);
  const totalScheduledAmount = lines.reduce((sum, line) => sum + numberValue(line.scheduledAmount), 0);
  const totalRemainingAmount = lines.reduce((sum, line) => sum + numberValue(line.remainingAmount), 0);
  const units = [...new Set(lines.map((line) => line.unit).filter(Boolean))];
  const canAggregateQuantity = units.length <= 1;
  const orderedQuantity = canAggregateQuantity ? lines.reduce((sum, line) => sum + numberValue(line.orderedQuantity), 0) : null;
  const shippedQuantity = canAggregateQuantity ? lines.reduce((sum, line) => sum + numberValue(line.shippedQuantity), 0) : null;
  const scheduledQuantity = canAggregateQuantity ? lines.reduce((sum, line) => sum + numberValue(line.scheduledQuantity), 0) : null;
  const remainingQuantity = canAggregateQuantity ? lines.reduce((sum, line) => sum + numberValue(line.remainingQuantity), 0) : null;
  const progressRate = totalOrderedAmount > 0
    ? Math.min(100, Math.round((totalShippedAmount / totalOrderedAmount) * 1000) / 10)
    : orderedQuantity
      ? Math.min(100, Math.round((shippedQuantity / orderedQuantity) * 1000) / 10)
      : 0;
  const hasRemaining = lines.some((line) => line.remainingQuantity > 0);
  const isOverdue = lines.some((line) => line.isOverdue);

  return {
    totalOrderedAmount,
    totalShippedAmount,
    totalScheduledAmount,
    totalRemainingAmount,
    orderedQuantity,
    shippedQuantity,
    scheduledQuantity,
    remainingQuantity,
    unit: canAggregateQuantity ? units[0] || '' : '',
    canAggregateQuantity,
    progressRate,
    hasRemaining,
    isOverdue,
    status: !hasRemaining ? 'completed' : isOverdue ? 'overdue' : totalShippedAmount > 0 ? 'partial' : totalScheduledAmount > 0 ? 'scheduled' : 'unshipped',
  };
}

export function groupContractBalancesByOrder(lines = []) {
  const grouped = new Map();
  lines.forEach((line) => {
    const current = grouped.get(line.salesOrderId) || [];
    current.push(line);
    grouped.set(line.salesOrderId, current);
  });
  return grouped;
}

export function summarizeContractBalanceForOrder(order, lines = []) {
  return summarizeContractBalances(lines.filter((line) => line.salesOrderId === order?.id));
}

export function contractBalanceStatusLabel(status) {
  return {
    completed: '契約完了',
    overdue: '納期超過',
    partial: '一部出荷',
    scheduled: '出荷予定あり',
    unshipped: '未出荷',
  }[status] || '未出荷';
}

export function topContractBalanceOrders({ salesOrders = [], balanceLines = [], limit = 5 } = {}) {
  const grouped = groupContractBalancesByOrder(balanceLines);
  return salesOrders
    .filter((order) => !order?.isDeleted)
    .map((order) => ({
      order,
      lines: grouped.get(order.id) || [],
      summary: summarizeContractBalances(grouped.get(order.id) || []),
    }))
    .filter((item) => item.summary.totalRemainingAmount > 0)
    .sort((a, b) => b.summary.totalRemainingAmount - a.summary.totalRemainingAmount)
    .slice(0, limit);
}
