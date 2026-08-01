import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { canUseCloud } from '../../../shared/services/recordSyncService.js';
import { parsePrice } from '../../products/hooks/useProducts.js';

const SHIPMENTS_STORAGE_KEY = 'eigyo-techo-shipments';

export const SHIPMENT_STATUSES = ['Draft', 'Picking', 'Ready', 'Shipped', 'Cancelled'];

export const SHIPMENT_STATUS_LABELS = {
  Draft: '下書き',
  Picking: 'ピッキング',
  Ready: '出荷準備完了',
  Shipped: '出荷済',
  Cancelled: '取消',
};

export const SALES_ORDER_SHIPMENT_STATUS_LABELS = {
  unshipped: '未出荷',
  partial: '一部出荷',
  shipped: '出荷済',
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeNumber(value) {
  const parsed = parsePrice(value);
  return parsed === '' ? 0 : parsed;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeShipmentLine(line = {}, userId = '', shipmentId = '') {
  return {
    id: line.id ?? crypto.randomUUID(),
    userId: line.userId ?? line.user_id ?? userId,
    shipmentId: line.shipmentId ?? line.shipment_id ?? shipmentId,
    salesOrderLineId: line.salesOrderLineId ?? line.sales_order_line_id ?? '',
    inventoryReservationId: line.inventoryReservationId ?? line.inventory_reservation_id ?? '',
    inventoryLotId: line.inventoryLotId ?? line.inventory_lot_id ?? '',
    productId: line.productId ?? line.product_id ?? '',
    quantity: normalizeNumber(line.quantity ?? ''),
    unit: line.unit ?? '',
    lotSnapshot: line.lotSnapshot ?? line.lot_snapshot ?? null,
    expirySnapshot: line.expirySnapshot ?? line.expiry_snapshot ?? '',
    createdAt: line.createdAt ?? line.created_at ?? nowIso(),
  };
}

export function normalizeShipment(shipment = {}, userId = '') {
  const id = shipment.id ?? crypto.randomUUID();
  return {
    id,
    userId: shipment.userId ?? shipment.user_id ?? userId,
    shipmentNumber: shipment.shipmentNumber ?? shipment.shipment_number ?? '',
    salesOrderId: shipment.salesOrderId ?? shipment.sales_order_id ?? '',
    customerId: shipment.customerId ?? shipment.customer_id ?? '',
    status: SHIPMENT_STATUSES.includes(shipment.status) ? shipment.status : 'Draft',
    shipmentDate: shipment.shipmentDate ?? shipment.shipment_date ?? '',
    plannedDeliveryDate: shipment.plannedDeliveryDate ?? shipment.planned_delivery_date ?? '',
    carrier: shipment.carrier ?? '',
    trackingNumber: shipment.trackingNumber ?? shipment.tracking_number ?? '',
    deliveryAddressSnapshot: shipment.deliveryAddressSnapshot ?? shipment.delivery_address_snapshot ?? null,
    note: shipment.note ?? '',
    shippedAt: shipment.shippedAt ?? shipment.shipped_at ?? '',
    cancelledAt: shipment.cancelledAt ?? shipment.cancelled_at ?? '',
    statusHistory: asArray(shipment.statusHistory ?? shipment.status_history),
    shipmentLines: asArray(shipment.shipmentLines ?? shipment.shipment_lines ?? shipment.lines)
      .map((line) => normalizeShipmentLine(line, userId, id)),
    createdBy: shipment.createdBy ?? shipment.created_by ?? userId,
    createdByName: shipment.createdByName ?? shipment.created_by_name ?? '',
    updatedBy: shipment.updatedBy ?? shipment.updated_by ?? '',
    updatedByName: shipment.updatedByName ?? shipment.updated_by_name ?? '',
    isDeleted: Boolean(shipment.isDeleted ?? shipment.is_deleted ?? false),
    createdAt: shipment.createdAt ?? shipment.created_at ?? nowIso(),
    updatedAt: shipment.updatedAt ?? shipment.updated_at ?? nowIso(),
  };
}

function hasLegacyLocalShipments() {
  try {
    const saved = localStorage.getItem(SHIPMENTS_STORAGE_KEY);
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return Boolean(localStorage.getItem(SHIPMENTS_STORAGE_KEY));
  }
}

async function fetchRemote(userId = '') {
  if (!canUseCloud()) return [];
  const shipmentQuery = supabase.from('shipments').select('*').order('updated_at', { ascending: false });
  const lineQuery = supabase.from('shipment_lines').select('*').order('created_at', { ascending: true });
  const [shipmentResult, lineResult] = await Promise.all([
    userId ? shipmentQuery.eq('user_id', userId) : shipmentQuery,
    userId ? lineQuery.eq('user_id', userId) : lineQuery,
  ]);
  if (shipmentResult.error) throw shipmentResult.error;
  if (lineResult.error) throw lineResult.error;

  const linesByShipment = new Map();
  (lineResult.data ?? []).forEach((row) => {
    const line = normalizeShipmentLine(row, userId, row.shipment_id);
    linesByShipment.set(row.shipment_id, [...(linesByShipment.get(row.shipment_id) ?? []), line]);
  });

  return (shipmentResult.data ?? [])
    .map((row) => normalizeShipment({ ...row, shipmentLines: linesByShipment.get(row.id) ?? [] }, userId))
    .filter((shipment) => !shipment.isDeleted);
}

export function useShipments(userId = '') {
  const [records, setRecords] = useState([]);
  const [syncState, setSyncState] = useState(canUseCloud() ? 'syncing' : 'error');
  const [syncError, setSyncError] = useState('');
  const [legacyLocalDataWarning] = useState(() =>
    hasLegacyLocalShipments()
      ? '旧ローカル出荷データがあります。安全のため自動移行・自動削除は行いません。'
      : '',
  );
  const writeSequenceRef = useRef(0);

  async function reload(writeSequence = null) {
    if (!canUseCloud()) {
      setRecords([]);
      setSyncState('error');
      setSyncError('Supabaseに接続できないため、出荷データは取得・保存できません。ネットワークと設定を確認してください。');
      return;
    }

    try {
      setSyncState('syncing');
      const remote = await fetchRemote(userId);
      if (writeSequence !== null && writeSequence !== writeSequenceRef.current) return;
      setRecords(remote);
      setSyncState('supabase');
      setSyncError('');
    } catch (error) {
      if (writeSequence !== null && writeSequence !== writeSequenceRef.current) return;
      setRecords([]);
      setSyncState('error');
      setSyncError(error.message || '出荷データの取得に失敗しました。');
    }
  }

  useEffect(() => {
    reload();
  }, [userId]);

  async function runShipmentRpc(functionName, params) {
    if (!canUseCloud()) {
      throw new Error('出荷処理はSupabase接続時のみ実行できます。');
    }

    setSyncState('syncing');
    const { data, error } = await supabase.rpc(functionName, params);
    if (error) {
      setSyncState('error');
      setSyncError(error.message || '出荷処理に失敗しました。');
      throw error;
    }
    await reload(++writeSequenceRef.current);
    return data;
  }

  function createShipmentFromOrder({
    salesOrderId,
    lines = null,
    status = 'Draft',
    shipmentDate = '',
    plannedDeliveryDate = '',
    carrier = '',
    trackingNumber = '',
    note = '',
  }) {
    return runShipmentRpc('create_sales_order_shipment', {
      p_sales_order_id: salesOrderId,
      p_lines: lines,
      p_status: status,
      p_shipment_date: shipmentDate || null,
      p_planned_delivery_date: plannedDeliveryDate || null,
      p_carrier: carrier || null,
      p_tracking_number: trackingNumber || null,
      p_note: note || null,
    });
  }

  function updateShipmentStatus(shipmentId, status, options = {}) {
    return runShipmentRpc('update_sales_order_shipment_status', {
      p_shipment_id: shipmentId,
      p_status: status,
      p_shipment_date: options.shipmentDate || null,
      p_note: options.note || null,
    });
  }

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()),
    [records],
  );

  return {
    records: sortedRecords,
    createShipmentFromOrder,
    updateShipmentStatus,
    shipShipment: (shipmentId, options = {}) => updateShipmentStatus(shipmentId, 'Shipped', options),
    cancelShipment: (shipmentId, options = {}) => updateShipmentStatus(shipmentId, 'Cancelled', options),
    reload,
    syncState,
    syncError,
    legacyLocalDataWarning,
  };
}
