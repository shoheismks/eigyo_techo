import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';
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

function normalizeNumber(value) {
  const parsed = parsePrice(value);
  return parsed === '' ? '' : parsed;
}

function normalizeStatus(value) {
  if (!value) return 'フリー';
  return value;
}

function normalizeStockType(value) {
  if (!value) return '現物';
  return value;
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
      date: movement.date || new Date().toISOString().slice(0, 10),
      handlerName: movement.handlerName || '',
      memo: movement.memo || '',
      projectId: movement.projectId || '',
      quoteId: movement.quoteId || '',
      invoiceId: movement.invoiceId || '',
      createdAt: movement.createdAt || new Date().toISOString(),
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
    cost: normalizeNumber(inventory.cost ?? inventory.costPrice ?? ''),
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
    memo: inventory.memo ?? '',
    movementHistory: Array.isArray(inventory.movementHistory)
      ? inventory.movementHistory
      : Array.isArray(inventory.movement_history)
        ? inventory.movement_history
        : [],
    createdBy: inventory.createdBy ?? inventory.created_by ?? userId,
    createdByName: inventory.createdByName ?? inventory.created_by_name ?? '',
    createdAt: inventory.createdAt ?? inventory.created_at ?? new Date().toISOString(),
    updatedAt: inventory.updatedAt ?? inventory.updated_at ?? new Date().toISOString(),
  };
}

function toRow(inventory) {
  return {
    id: inventory.id,
    user_id: inventory.userId,
    inventory_code: inventory.inventoryCode || null,
    product_id: inventory.productId,
    supplier_id: inventory.supplierId || null,
    cost: inventory.cost === '' ? null : inventory.cost,
    currency: inventory.currency,
    quantity: inventory.quantity === '' ? null : inventory.quantity,
    reserved_quantity: inventory.reservedQuantity === '' ? null : inventory.reservedQuantity,
    unit: inventory.unit,
    stock_type: inventory.stockType,
    owner: inventory.owner,
    inventory_status: inventory.inventoryStatus,
    location: inventory.location,
    safety_stock: inventory.safetyStock === '' ? null : inventory.safetyStock,
    firm_deadline: inventory.firmDeadline || null,
    eta: inventory.eta || null,
    lot: inventory.lot,
    expiry_date: inventory.expiryDate || null,
    manufacture_date: inventory.manufactureDate || null,
    received_date: inventory.receivedDate || null,
    voucher_number: inventory.voucherNumber,
    handler_name: inventory.handlerName,
    memo: inventory.memo,
    movement_history: inventory.movementHistory ?? [],
    created_by: inventory.createdBy,
    created_by_name: inventory.createdByName,
    created_at: inventory.createdAt,
    updated_at: inventory.updatedAt,
  };
}

function fromRow(row) {
  return normalizeInventory({
    id: row.id,
    userId: row.user_id,
    inventoryCode: row.inventory_code ?? '',
    productId: row.product_id,
    supplierId: row.supplier_id ?? '',
    cost: row.cost ?? '',
    currency: row.currency ?? 'JPY',
    quantity: row.quantity ?? '',
    reservedQuantity: row.reserved_quantity ?? '',
    unit: row.unit ?? 'kg',
    stockType: row.stock_type ?? '現物',
    owner: row.owner ?? '',
    inventoryStatus: row.inventory_status ?? 'フリー',
    location: row.location ?? '',
    safetyStock: row.safety_stock ?? '',
    firmDeadline: row.firm_deadline ?? '',
    eta: row.eta ?? '',
    lot: row.lot ?? '',
    expiryDate: row.expiry_date ?? '',
    manufactureDate: row.manufacture_date ?? '',
    receivedDate: row.received_date ?? '',
    voucherNumber: row.voucher_number ?? '',
    handlerName: row.handler_name ?? '',
    memo: row.memo ?? '',
    movementHistory: row.movement_history ?? [],
    createdBy: row.created_by ?? '',
    createdByName: row.created_by_name ?? '',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  });
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

export const useInventory = createRecordHook({
  tableName: 'inventories',
  storageKey: 'eigyo-techo-inventories',
  normalize: normalizeInventory,
  toRow,
  fromRow,
});
