import { useEffect, useMemo, useRef, useState } from 'react';
import { hasSupabaseConfig, supabase } from '../../../lib/supabase.js';
import {
  isValidBusinessCode,
  normalizeBusinessCode,
} from '../../../shared/utils/businessCode.js';
import { parsePrice, productDisplayName } from '../../products/hooks/useProducts.js';

export const INVENTORY_STATUSES = [
  'フリー',
  '案内中',
  '出庫待ち',
  '予約済',
  'ファーム',
  '欠品',
  '入港待ち',
  '売切',
];

export const INVENTORY_TYPES = ['現物', '先物'];

export const INVENTORY_UNITS = ['kg', 'g', 'パック', '箱', 'ケース', '枚', '本', '袋', '個'];

export const INVENTORY_MOVEMENT_TYPES = ['入庫', '出庫', '棚卸'];

export const INVENTORY_INBOUND_REASONS = ['仕入', '返品', '製造', '在庫調整', '棚卸差異', 'その他'];

export const INVENTORY_OUTBOUND_REASONS = ['販売', 'サンプル', '返品', '廃棄', '社内利用', '在庫調整', 'その他'];

const LOCAL_STORAGE_KEY = 'eigyo-techo-inventories';
const LOTS_STORAGE_KEY = 'eigyo-techo-inventory-lots';
const MOVEMENTS_STORAGE_KEY = 'eigyo-techo-inventory-movements';
const RESERVATIONS_STORAGE_KEY = 'eigyo-techo-inventory-reservations';
const STOCKTAKES_STORAGE_KEY = 'eigyo-techo-stocktakes';
const STOCKTAKE_LINES_STORAGE_KEY = 'eigyo-techo-stocktake-lines';

const STATUS_TO_LOT_STATUS = {
  フリー: 'active',
  案内中: 'active',
  出庫待ち: 'active',
  予約済: 'active',
  ファーム: 'active',
  欠品: 'exhausted',
  入港待ち: 'active',
  売切: 'exhausted',
  隔離: 'quarantined',
};

const LOT_STATUS_TO_STATUS = {
  active: 'フリー',
  exhausted: '欠品',
  expired: '売切',
  quarantined: '案内中',
  deleted: '売切',
};

const MOVEMENT_TYPE_TO_LABEL = {
  receipt: '入庫',
  shipment: '出庫',
  sample: '出庫',
  return_in: '入庫',
  return_out: '出庫',
  disposal: '出庫',
  stocktake_adjustment: '棚卸',
  transfer_in: '入庫',
  transfer_out: '出庫',
  manual_adjustment: '棚卸',
  reservation: '引当',
  reservation_release: '引当解除',
};

export const emptyInventory = {
  userId: '',
  inventoryCode: '',
  productId: '',
  supplierId: '',
  cost: '',
  currency: 'JPY',
  quantity: '',
  reservedQuantity: '',
  unit: 'kg',
  stockType: '現物',
  owner: '',
  inventoryStatus: 'フリー',
  location: '',
  safetyStock: '',
  firmDeadline: '',
  eta: '',
  lot: '',
  expiryDate: '',
  manufactureDate: '',
  receivedDate: '',
  voucherNumber: '',
  handlerName: '',
  memo: '',
  movementHistory: [],
  createdBy: '',
  createdByName: '',
};

export function normalizeInventoryCode(value) {
  return normalizeBusinessCode(value);
}

export function isValidInventoryCode(value) {
  return isValidBusinessCode(value);
}

function canUseCloud() {
  return hasSupabaseConfig && Boolean(supabase) && (typeof navigator === 'undefined' || navigator.onLine);
}

function syncReason(fallback = '') {
  if (!hasSupabaseConfig || !supabase) {
    return 'Supabase設定がないため、LocalStorageバックアップで動作しています。';
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'オフラインのため、LocalStorageバックアップで動作しています。';
  }
  return fallback || 'Supabase接続に失敗したため、LocalStorageバックアップで動作しています。';
}

function normalizeNumber(value) {
  const parsed = parsePrice(value);
  return parsed === '' ? '' : parsed;
}

function normalizeDbNumber(value, fallback = 0) {
  const parsed = normalizeNumber(value);
  return parsed === '' ? fallback : parsed;
}

function normalizeStatus(value) {
  if (!value) return 'フリー';
  return LOT_STATUS_TO_STATUS[value] || value;
}

function normalizeStockType(value) {
  if (!value) return '現物';
  return value;
}

function nowIso() {
  return new Date().toISOString();
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function readLocal(key, userId = '', normalize = (record) => record) {
  try {
    const saved = localStorage.getItem(key);
    return saved
      ? JSON.parse(saved)
          .map((record) => normalize(record, userId))
          .filter((record) => !userId || record.userId === userId || record.user_id === userId)
      : [];
  } catch {
    return [];
  }
}

function saveLocal(key, records) {
  localStorage.setItem(key, JSON.stringify(records));
}

function movementLabel(movementType) {
  return MOVEMENT_TYPE_TO_LABEL[movementType] || movementType || '履歴';
}

function movementQuantityForUi(movement) {
  const quantity = normalizeDbNumber(movement.quantity, 0);
  return movement.movementType === 'shipment' || movement.movementType === 'disposal'
    ? Math.abs(quantity)
    : quantity;
}

export function appendInventoryMovement(inventory, movement) {
  const history = Array.isArray(inventory?.movementHistory) ? inventory.movementHistory : [];
  return [
    {
      id: movement.id ?? crypto.randomUUID(),
      type: movement.type || '入庫',
      quantity: normalizeNumber(movement.quantity ?? ''),
      unit: movement.unit || inventory?.unit || 'kg',
      reason: movement.reason || '',
      date: movement.date || todayString(),
      handlerName: movement.handlerName || '',
      memo: movement.memo || '',
      projectId: movement.projectId || '',
      quoteId: movement.quoteId || '',
      invoiceId: movement.invoiceId || '',
      createdAt: movement.createdAt || nowIso(),
    },
    ...history,
  ];
}

export function normalizeInventory(inventory = {}, userId = '') {
  return {
    ...emptyInventory,
    ...inventory,
    id: inventory.id ?? crypto.randomUUID(),
    userId: inventory.userId ?? inventory.user_id ?? userId,
    inventoryCode: normalizeInventoryCode(inventory.inventoryCode ?? inventory.inventory_code ?? ''),
    productId: inventory.productId ?? inventory.product_id ?? '',
    supplierId: inventory.supplierId ?? inventory.supplier_id ?? '',
    cost: normalizeNumber(inventory.cost ?? inventory.costPrice ?? inventory.purchase_unit_cost ?? ''),
    currency: inventory.currency || 'JPY',
    quantity: normalizeNumber(inventory.quantity ?? ''),
    reservedQuantity: normalizeNumber(inventory.reservedQuantity ?? inventory.reserved_quantity ?? ''),
    unit: inventory.unit || 'kg',
    stockType: normalizeStockType(inventory.stockType || inventory.stock_type),
    owner: inventory.owner ?? '',
    inventoryStatus: normalizeStatus(inventory.inventoryStatus || inventory.inventory_status || inventory.status),
    location: inventory.location ?? '',
    safetyStock: normalizeNumber(inventory.safetyStock ?? inventory.safety_stock ?? ''),
    firmDeadline: inventory.firmDeadline ?? inventory.firm_deadline ?? '',
    eta: inventory.eta ?? '',
    lot: inventory.lot ?? inventory.lot_number ?? '',
    expiryDate: inventory.expiryDate ?? inventory.expiry_date ?? '',
    manufactureDate: inventory.manufactureDate ?? inventory.manufacture_date ?? '',
    receivedDate: inventory.receivedDate ?? inventory.received_date ?? '',
    voucherNumber: inventory.voucherNumber ?? inventory.voucher_number ?? '',
    handlerName: inventory.handlerName ?? inventory.handler_name ?? '',
    memo: inventory.memo ?? inventory.notes ?? '',
    movementHistory: Array.isArray(inventory.movementHistory)
      ? inventory.movementHistory
      : Array.isArray(inventory.movement_history)
        ? inventory.movement_history
        : [],
    createdBy: inventory.createdBy ?? inventory.created_by ?? userId,
    createdByName: inventory.createdByName ?? inventory.created_by_name ?? '',
    createdAt: inventory.createdAt ?? inventory.created_at ?? nowIso(),
    updatedAt: inventory.updatedAt ?? inventory.updated_at ?? nowIso(),
  };
}

function normalizeLot(row = {}, userId = '') {
  return {
    id: row.id ?? crypto.randomUUID(),
    userId: row.userId ?? row.user_id ?? userId,
    productId: row.productId ?? row.product_id ?? '',
    supplierId: row.supplierId ?? row.supplier_id ?? '',
    lotNumber: row.lotNumber ?? row.lot_number ?? row.lot ?? '',
    quantity: normalizeNumber(row.quantity ?? ''),
    reservedQuantity: normalizeNumber(row.reservedQuantity ?? row.reserved_quantity ?? ''),
    availableQuantity: normalizeNumber(row.availableQuantity ?? row.available_quantity ?? ''),
    unit: row.unit || 'kg',
    location: row.location ?? '',
    manufactureDate: row.manufactureDate ?? row.manufacture_date ?? '',
    receivedDate: row.receivedDate ?? row.received_date ?? '',
    expiryDate: row.expiryDate ?? row.expiry_date ?? '',
    purchaseUnitCost: normalizeNumber(row.purchaseUnitCost ?? row.purchase_unit_cost ?? row.cost ?? ''),
    currency: row.currency || 'JPY',
    stockType: normalizeStockType(row.stockType ?? row.stock_type),
    owner: row.owner ?? '',
    inventoryCode: normalizeInventoryCode(row.inventoryCode ?? row.inventory_code ?? ''),
    safetyStock: normalizeNumber(row.safetyStock ?? row.safety_stock ?? ''),
    firmDeadline: row.firmDeadline ?? row.firm_deadline ?? '',
    eta: row.eta ?? '',
    voucherNumber: row.voucherNumber ?? row.voucher_number ?? '',
    handlerName: row.handlerName ?? row.handler_name ?? '',
    status: row.status || 'active',
    notes: row.notes ?? '',
    createdBy: row.createdBy ?? row.created_by ?? userId,
    createdByName: row.createdByName ?? row.created_by_name ?? '',
    createdAt: row.createdAt ?? row.created_at ?? nowIso(),
    updatedAt: row.updatedAt ?? row.updated_at ?? nowIso(),
    deletedAt: row.deletedAt ?? row.deleted_at ?? '',
  };
}

function lotToInventory(lot, movements = []) {
  const movementHistory = movements
    .filter((movement) => movement.inventoryLotId === lot.id)
    .map((movement) => ({
      id: movement.id,
      type: movementLabel(movement.movementType),
      quantity: movementQuantityForUi(movement),
      unit: movement.unit || lot.unit,
      reason: movement.reason || '',
      date: movement.movementDate || '',
      handlerName: movement.handlerName || '',
      memo: movement.notes || '',
      projectId: movement.projectId || '',
      quoteId: movement.quoteId || '',
      invoiceId: movement.invoiceId || '',
      createdAt: movement.createdAt,
    }));

  return normalizeInventory({
    id: lot.id,
    userId: lot.userId,
    inventoryCode: lot.inventoryCode,
    productId: lot.productId,
    supplierId: lot.supplierId,
    cost: lot.purchaseUnitCost,
    currency: lot.currency,
    quantity: lot.quantity,
    reservedQuantity: lot.reservedQuantity,
    unit: lot.unit,
    stockType: lot.stockType,
    owner: lot.owner,
    inventoryStatus: normalizeStatus(lot.status),
    location: lot.location,
    safetyStock: lot.safetyStock,
    firmDeadline: lot.firmDeadline,
    eta: lot.eta,
    lot: lot.lotNumber,
    expiryDate: lot.expiryDate,
    manufactureDate: lot.manufactureDate,
    receivedDate: lot.receivedDate,
    voucherNumber: lot.voucherNumber,
    handlerName: lot.handlerName,
    memo: lot.notes,
    movementHistory,
    createdBy: lot.createdBy,
    createdByName: lot.createdByName,
    createdAt: lot.createdAt,
    updatedAt: lot.updatedAt,
  }, lot.userId);
}

function inventoryToReceiveParams(inventory) {
  return {
    p_inventory_lot_id: inventory.id || null,
    p_product_id: inventory.productId || null,
    p_supplier_id: inventory.supplierId || null,
    p_lot_number: inventory.lot || null,
    p_quantity: normalizeDbNumber(inventory.quantity, 0),
    p_unit: inventory.unit || 'kg',
    p_location: inventory.location || null,
    p_manufacture_date: inventory.manufactureDate || null,
    p_received_date: inventory.receivedDate || todayString(),
    p_expiry_date: inventory.expiryDate || null,
    p_purchase_unit_cost: inventory.cost === '' ? null : normalizeDbNumber(inventory.cost, 0),
    p_currency: inventory.currency || 'JPY',
    p_stock_type: inventory.stockType || null,
    p_owner: inventory.owner || null,
    p_inventory_code: normalizeInventoryCode(inventory.inventoryCode || '') || null,
    p_safety_stock: inventory.safetyStock === '' ? null : normalizeDbNumber(inventory.safetyStock, 0),
    p_firm_deadline: inventory.firmDeadline || null,
    p_eta: inventory.eta || null,
    p_voucher_number: inventory.voucherNumber || null,
    p_handler_name: inventory.handlerName || null,
    p_reason: inventory.movementHistory?.[0]?.reason || '仕入',
    p_notes: inventory.memo || null,
  };
}

function inventoryToPatch(inventory, updates = {}) {
  const merged = normalizeInventory({ ...inventory, ...updates }, inventory.userId);
  return {
    supplierId: merged.supplierId,
    lot: merged.lot,
    quantity: merged.quantity,
    reservedQuantity: merged.reservedQuantity,
    unit: merged.unit,
    location: merged.location,
    manufactureDate: merged.manufactureDate,
    receivedDate: merged.receivedDate,
    expiryDate: merged.expiryDate,
    cost: merged.cost,
    currency: merged.currency,
    stockType: merged.stockType,
    owner: merged.owner,
    inventoryCode: normalizeInventoryCode(merged.inventoryCode || ''),
    safetyStock: merged.safetyStock,
    firmDeadline: merged.firmDeadline,
    eta: merged.eta,
    voucherNumber: merged.voucherNumber,
    handlerName: merged.handlerName,
    inventoryStatus: merged.inventoryStatus,
    memo: merged.memo,
  };
}

function normalizeMovement(row = {}, userId = '') {
  return {
    id: row.id ?? crypto.randomUUID(),
    userId: row.userId ?? row.user_id ?? userId,
    productId: row.productId ?? row.product_id ?? '',
    inventoryLotId: row.inventoryLotId ?? row.inventory_lot_id ?? '',
    movementType: row.movementType ?? row.movement_type ?? '',
    quantity: normalizeNumber(row.quantity ?? ''),
    unit: row.unit ?? '',
    movementDate: row.movementDate ?? row.movement_date ?? '',
    reason: row.reason ?? '',
    locationFrom: row.locationFrom ?? row.location_from ?? '',
    locationTo: row.locationTo ?? row.location_to ?? '',
    supplierId: row.supplierId ?? row.supplier_id ?? '',
    customerId: row.customerId ?? row.customer_id ?? '',
    projectId: row.projectId ?? row.project_id ?? '',
    quoteId: row.quoteId ?? row.quote_id ?? '',
    invoiceId: row.invoiceId ?? row.invoice_id ?? '',
    orderId: row.orderId ?? row.order_id ?? '',
    shipmentId: row.shipmentId ?? row.shipment_id ?? '',
    voucherNumber: row.voucherNumber ?? row.voucher_number ?? '',
    handlerName: row.handlerName ?? row.handler_name ?? '',
    notes: row.notes ?? '',
    originalPayload: row.originalPayload ?? row.original_payload ?? null,
    createdBy: row.createdBy ?? row.created_by ?? userId,
    createdAt: row.createdAt ?? row.created_at ?? nowIso(),
  };
}

function normalizeReservation(row = {}, userId = '') {
  return {
    id: row.id ?? crypto.randomUUID(),
    userId: row.userId ?? row.user_id ?? userId,
    productId: row.productId ?? row.product_id ?? '',
    inventoryLotId: row.inventoryLotId ?? row.inventory_lot_id ?? '',
    customerId: row.customerId ?? row.customer_id ?? '',
    projectId: row.projectId ?? row.project_id ?? '',
    orderId: row.orderId ?? row.order_id ?? '',
    salesOrderLineId: row.salesOrderLineId ?? row.sales_order_line_id ?? '',
    quoteId: row.quoteId ?? row.quote_id ?? '',
    reservedQuantity: normalizeNumber(row.reservedQuantity ?? row.reserved_quantity ?? ''),
    fulfilledQuantity: normalizeNumber(row.fulfilledQuantity ?? row.fulfilled_quantity ?? ''),
    releasedQuantity: normalizeNumber(row.releasedQuantity ?? row.released_quantity ?? ''),
    unit: row.unit ?? '',
    status: row.status ?? 'active',
    reservedAt: row.reservedAt ?? row.reserved_at ?? '',
    requiredDate: row.requiredDate ?? row.required_date ?? '',
    expiresAt: row.expiresAt ?? row.expires_at ?? '',
    notes: row.notes ?? '',
    createdBy: row.createdBy ?? row.created_by ?? userId,
    createdAt: row.createdAt ?? row.created_at ?? '',
    updatedAt: row.updatedAt ?? row.updated_at ?? '',
  };
}

function normalizeStocktake(row = {}, userId = '') {
  return {
    id: row.id ?? crypto.randomUUID(),
    userId: row.userId ?? row.user_id ?? userId,
    stocktakeNumber: row.stocktakeNumber ?? row.stocktake_number ?? '',
    location: row.location ?? '',
    status: row.status ?? 'draft',
    stocktakeDate: row.stocktakeDate ?? row.stocktake_date ?? '',
    startedAt: row.startedAt ?? row.started_at ?? '',
    completedAt: row.completedAt ?? row.completed_at ?? '',
    notes: row.notes ?? '',
    createdBy: row.createdBy ?? row.created_by ?? userId,
    createdAt: row.createdAt ?? row.created_at ?? '',
    updatedAt: row.updatedAt ?? row.updated_at ?? '',
  };
}

function normalizeStocktakeLine(row = {}, userId = '') {
  return {
    id: row.id ?? crypto.randomUUID(),
    userId: row.userId ?? row.user_id ?? userId,
    stocktakeId: row.stocktakeId ?? row.stocktake_id ?? '',
    productId: row.productId ?? row.product_id ?? '',
    inventoryLotId: row.inventoryLotId ?? row.inventory_lot_id ?? '',
    systemQuantity: normalizeNumber(row.systemQuantity ?? row.system_quantity ?? ''),
    actualQuantity: normalizeNumber(row.actualQuantity ?? row.actual_quantity ?? ''),
    differenceQuantity: normalizeNumber(row.differenceQuantity ?? row.difference_quantity ?? ''),
    unit: row.unit ?? '',
    differenceReason: row.differenceReason ?? row.difference_reason ?? '',
    adjustmentMovementId: row.adjustmentMovementId ?? row.adjustment_movement_id ?? '',
    countedBy: row.countedBy ?? row.counted_by ?? '',
    countedAt: row.countedAt ?? row.counted_at ?? '',
    createdAt: row.createdAt ?? row.created_at ?? '',
    updatedAt: row.updatedAt ?? row.updated_at ?? '',
  };
}

async function fetchTable(tableName, userId, mapper) {
  let query = supabase.from(tableName).select('*');
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapper(row, userId));
}

function sortInventories(records) {
  return [...records].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime(),
  );
}

function findNewMovement(currentInventory, updates) {
  const nextHistory = Array.isArray(updates?.movementHistory) ? updates.movementHistory : [];
  const currentHistory = Array.isArray(currentInventory?.movementHistory) ? currentInventory.movementHistory : [];
  if (nextHistory.length <= currentHistory.length) return null;
  return nextHistory[0] || null;
}

export function inventoryAvailableQuantity(inventory) {
  const quantity = normalizeNumber(inventory?.quantity ?? '');
  const reservedQuantity = normalizeNumber(inventory?.reservedQuantity ?? '');
  return Math.max(0, (quantity === '' ? 0 : quantity) - (reservedQuantity === '' ? 0 : reservedQuantity));
}

export function inventoryCostTotal(inventories = []) {
  return inventories.reduce((sum, inventory) => {
    const cost = normalizeNumber(inventory.cost);
    const quantity = normalizeNumber(inventory.quantity);
    if (cost === '') return sum;
    return sum + cost * (quantity === '' ? 1 : quantity);
  }, 0);
}

export function inventoryUnitCost(inventories = []) {
  const validInventories = inventories
    .map((inventory) => ({
      cost: normalizeNumber(inventory.cost),
      quantity: normalizeNumber(inventory.quantity),
    }))
    .filter((inventory) => inventory.cost !== '');

  if (validInventories.length === 0) return '';

  const quantityTotal = validInventories.reduce(
    (sum, inventory) => sum + (inventory.quantity === '' ? 0 : inventory.quantity),
    0,
  );

  if (quantityTotal > 0) {
    const weightedCostTotal = validInventories.reduce(
      (sum, inventory) => sum + inventory.cost * (inventory.quantity === '' ? 0 : inventory.quantity),
      0,
    );
    return weightedCostTotal / quantityTotal;
  }

  return validInventories.reduce((sum, inventory) => sum + inventory.cost, 0) / validInventories.length;
}

export function inventoryQuoteCostTotal(inventories = [], quoteQuantity = '') {
  const quantity = normalizeNumber(quoteQuantity);
  const unitCost = inventoryUnitCost(inventories);

  if (quantity !== '' && quantity > 0 && unitCost !== '') {
    return unitCost * quantity;
  }

  return inventoryCostTotal(inventories);
}

export function calculateInventoryGrossMarginRate(inventories = [], totalAmount = '', quoteQuantity = '') {
  const sales = normalizeNumber(totalAmount);
  if (sales === '' || sales <= 0) return '';

  const costTotal = inventoryQuoteCostTotal(inventories, quoteQuantity);
  if (costTotal <= 0) return '';

  return `${(((sales - costTotal) / sales) * 100).toFixed(1).replace(/\.0$/, '')}%`;
}

export function inventoryLabel(inventory, product, supplier) {
  return [
    inventory.inventoryCode,
    productDisplayName(product, ''),
    inventory.lot && `LOT ${inventory.lot}`,
    inventory.inventoryStatus,
    inventory.quantity !== '' ? `${inventory.quantity}${inventory.unit}` : '',
    supplier?.name || supplier?.companyName,
  ]
    .filter(Boolean)
    .join(' / ');
}

export function useInventory(userId = '') {
  const [inventoryLots, setInventoryLots] = useState(() => readLocal(LOTS_STORAGE_KEY, userId, normalizeLot));
  const [inventoryMovements, setInventoryMovements] = useState(() => readLocal(MOVEMENTS_STORAGE_KEY, userId, normalizeMovement));
  const [inventoryReservations, setInventoryReservations] = useState(() => readLocal(RESERVATIONS_STORAGE_KEY, userId, normalizeReservation));
  const [stocktakes, setStocktakes] = useState(() => readLocal(STOCKTAKES_STORAGE_KEY, userId, normalizeStocktake));
  const [stocktakeLines, setStocktakeLines] = useState(() => readLocal(STOCKTAKE_LINES_STORAGE_KEY, userId, normalizeStocktakeLine));
  const [legacyRecords, setLegacyRecords] = useState(() => readLocal(LOCAL_STORAGE_KEY, userId, normalizeInventory));
  const [syncState, setSyncState] = useState(canUseCloud() ? 'syncing' : 'local');
  const [syncError, setSyncError] = useState('');
  const writeSequenceRef = useRef(0);

  const records = useMemo(() => {
    const activeLots = inventoryLots.filter((lot) => lot.status !== 'deleted' && !lot.deletedAt);
    const normalized = activeLots.map((lot) => lotToInventory(lot, inventoryMovements));
    return sortInventories(normalized.length > 0 ? normalized : legacyRecords);
  }, [inventoryLots, inventoryMovements, legacyRecords]);

  function persistLocal(nextRecords, lots = inventoryLots, movements = inventoryMovements) {
    saveLocal(LOCAL_STORAGE_KEY, nextRecords);
    saveLocal(LOTS_STORAGE_KEY, lots);
    saveLocal(MOVEMENTS_STORAGE_KEY, movements);
    saveLocal(RESERVATIONS_STORAGE_KEY, inventoryReservations);
    saveLocal(STOCKTAKES_STORAGE_KEY, stocktakes);
    saveLocal(STOCKTAKE_LINES_STORAGE_KEY, stocktakeLines);
  }

  async function reload(writeSequence = null) {
    if (!canUseCloud()) {
      setLegacyRecords(readLocal(LOCAL_STORAGE_KEY, userId, normalizeInventory));
      setSyncState('local');
      setSyncError(syncReason());
      return;
    }

    try {
      setSyncState('syncing');
      const [
        nextLots,
        nextMovements,
        nextReservations,
        nextStocktakes,
        nextStocktakeLines,
      ] = await Promise.all([
        fetchTable('inventory_lots', userId, normalizeLot),
        fetchTable('inventory_movements', userId, normalizeMovement),
        fetchTable('inventory_reservations', userId, normalizeReservation),
        fetchTable('stocktakes', userId, normalizeStocktake),
        fetchTable('stocktake_lines', userId, normalizeStocktakeLine),
      ]);

      if (writeSequence !== null && writeSequence !== writeSequenceRef.current) return;

      const nextRecords = sortInventories(nextLots.filter((lot) => lot.status !== 'deleted').map((lot) => lotToInventory(lot, nextMovements)));
      setInventoryLots(nextLots);
      setInventoryMovements(nextMovements.sort((a, b) => String(b.movementDate || b.createdAt).localeCompare(String(a.movementDate || a.createdAt))));
      setInventoryReservations(nextReservations);
      setStocktakes(nextStocktakes);
      setStocktakeLines(nextStocktakeLines);
      setLegacyRecords(nextRecords);
      persistLocal(nextRecords, nextLots, nextMovements);
      setSyncState('supabase');
      setSyncError('');
    } catch (error) {
      if (writeSequence !== null && writeSequence !== writeSequenceRef.current) return;
      setLegacyRecords(readLocal(LOCAL_STORAGE_KEY, userId, normalizeInventory));
      setSyncState('local');
      setSyncError(syncReason(error.message));
    }
  }

  useEffect(() => {
    reload();
  }, [userId]);

  function addLocalRecord(record) {
    const now = nowIso();
    const normalized = normalizeInventory({
      ...record,
      id: record.id ?? crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    }, userId);
    setLegacyRecords((current) => {
      const next = [normalized, ...current];
      persistLocal(next);
      return next;
    });
    return normalized.id;
  }

  function updateLocalRecord(id, updates) {
    setLegacyRecords((current) => {
      const next = current.map((record) =>
        record.id === id
          ? normalizeInventory({ ...record, ...updates, userId, updatedAt: nowIso() }, userId)
          : record,
      );
      persistLocal(next);
      return next;
    });
  }

  function removeLocalRecord(id) {
    setLegacyRecords((current) => {
      const next = current.filter((record) => record.id !== id);
      persistLocal(next);
      return next;
    });
  }

  function addRecord(record) {
    const id = record.id || crypto.randomUUID();
    const normalized = normalizeInventory({ ...record, id, userId }, userId);

    setLegacyRecords((current) => sortInventories([normalized, ...current.filter((item) => item.id !== id)]));

    if (!canUseCloud()) {
      return addLocalRecord(normalized);
    }

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    supabase
      .rpc('receive_inventory', inventoryToReceiveParams(normalized))
      .then(({ error }) => {
        if (error) throw error;
        return reload(writeSequence);
      })
      .catch((error) => {
        setSyncState('local');
        setSyncError(syncReason(error.message));
      });

    return id;
  }

  function updateRecord(id, updates) {
    const currentRecord = records.find((record) => record.id === id);
    const movement = findNewMovement(currentRecord, updates);
    const optimistic = currentRecord
      ? normalizeInventory({ ...currentRecord, ...updates, updatedAt: nowIso() }, userId)
      : null;

    if (optimistic) {
      setLegacyRecords((current) => sortInventories(current.map((record) => (record.id === id ? optimistic : record))));
    }

    if (!canUseCloud()) {
      updateLocalRecord(id, updates);
      return;
    }

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');

    let writePromise;
    if (movement?.type === '出庫') {
      writePromise = supabase.rpc('issue_inventory', {
        p_inventory_lot_id: id,
        p_quantity: normalizeDbNumber(movement.quantity, 0),
        p_movement_type: movement.reason === 'サンプル' ? 'sample' : movement.reason === '廃棄' ? 'disposal' : 'shipment',
        p_movement_date: movement.date || todayString(),
        p_reason: movement.reason || null,
        p_project_id: movement.projectId || null,
        p_quote_id: movement.quoteId || null,
        p_invoice_id: movement.invoiceId || null,
        p_handler_name: movement.handlerName || null,
        p_notes: movement.memo || null,
      });
    } else if (movement?.type === '棚卸') {
      writePromise = supabase.rpc('complete_stocktake', {
        p_inventory_lot_id: id,
        p_actual_quantity: normalizeDbNumber(updates.quantity, 0),
        p_stocktake_date: movement.date || todayString(),
        p_reason: movement.reason || '棚卸差異',
        p_counted_by: movement.handlerName || null,
        p_notes: movement.memo || null,
      });
    } else if (movement?.type === '入庫') {
      writePromise = supabase.rpc('receive_inventory', inventoryToReceiveParams(optimistic));
    } else {
      writePromise = supabase.rpc('update_inventory_lot', {
        p_inventory_lot_id: id,
        p_patch: inventoryToPatch(currentRecord, updates),
      });
    }

    writePromise
      .then(({ error }) => {
        if (error) throw error;
        return reload(writeSequence);
      })
      .catch((error) => {
        setSyncState('local');
        setSyncError(syncReason(error.message));
      });
  }

  function removeRecord(id) {
    setLegacyRecords((current) => current.filter((record) => record.id !== id));

    if (!canUseCloud()) {
      removeLocalRecord(id);
      return;
    }

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    supabase
      .rpc('update_inventory_lot', {
        p_inventory_lot_id: id,
        p_patch: { status: 'deleted', inventoryStatus: '売切' },
      })
      .then(({ error }) => {
        if (error) throw error;
        return reload(writeSequence);
      })
      .catch((error) => {
        setSyncState('local');
        setSyncError(syncReason(error.message));
      });
  }

  return {
    records,
    addRecord,
    updateRecord,
    removeRecord,
    reload,
    syncState,
    syncError,
    inventoryLots,
    inventoryMovements,
    inventoryReservations,
    stocktakes,
    stocktakeLines,
  };
}
