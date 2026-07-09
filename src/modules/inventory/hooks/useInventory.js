import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';
import { parsePrice } from '../../products/hooks/useProducts.js';

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

export const emptyInventory = {
  userId: '',
  productId: '',
  supplierId: '',
  cost: '',
  currency: 'JPY',
  quantity: '',
  unit: 'kg',
  stockType: '現物',
  owner: '',
  inventoryStatus: 'フリー',
  firmDeadline: '',
  eta: '',
  lot: '',
  expiryDate: '',
  memo: '',
  createdBy: '',
  createdByName: '',
};

function normalizeNumber(value) {
  const parsed = parsePrice(value);
  return parsed === '' ? '' : parsed;
}

export function normalizeInventory(inventory = {}, userId = '') {
  return {
    ...emptyInventory,
    ...inventory,
    id: inventory.id ?? crypto.randomUUID(),
    userId: inventory.userId ?? userId,
    productId: inventory.productId ?? '',
    supplierId: inventory.supplierId ?? '',
    cost: normalizeNumber(inventory.cost ?? inventory.costPrice ?? ''),
    currency: inventory.currency || 'JPY',
    quantity: normalizeNumber(inventory.quantity ?? ''),
    unit: inventory.unit || 'kg',
    stockType: inventory.stockType || inventory.stock_type || '現物',
    owner: inventory.owner ?? '',
    inventoryStatus:
      inventory.inventoryStatus ||
      inventory.inventory_status ||
      inventory.status ||
      'フリー',
    firmDeadline: inventory.firmDeadline ?? inventory.firm_deadline ?? '',
    eta: inventory.eta ?? '',
    lot: inventory.lot ?? inventory.lot_number ?? '',
    expiryDate: inventory.expiryDate ?? inventory.expiry_date ?? '',
    memo: inventory.memo ?? '',
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
    product_id: inventory.productId,
    supplier_id: inventory.supplierId || null,
    cost: inventory.cost === '' ? null : inventory.cost,
    currency: inventory.currency,
    quantity: inventory.quantity === '' ? null : inventory.quantity,
    unit: inventory.unit,
    stock_type: inventory.stockType,
    owner: inventory.owner,
    inventory_status: inventory.inventoryStatus,
    firm_deadline: inventory.firmDeadline || null,
    eta: inventory.eta || null,
    lot: inventory.lot,
    expiry_date: inventory.expiryDate || null,
    memo: inventory.memo,
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
    productId: row.product_id,
    supplierId: row.supplier_id ?? '',
    cost: row.cost ?? '',
    currency: row.currency ?? 'JPY',
    quantity: row.quantity ?? '',
    unit: row.unit ?? 'kg',
    stockType: row.stock_type ?? '現物',
    owner: row.owner ?? '',
    inventoryStatus: row.inventory_status ?? 'フリー',
    firmDeadline: row.firm_deadline ?? '',
    eta: row.eta ?? '',
    lot: row.lot ?? '',
    expiryDate: row.expiry_date ?? '',
    memo: row.memo ?? '',
    createdBy: row.created_by ?? '',
    createdByName: row.created_by_name ?? '',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  });
}

export function inventoryCostTotal(inventories = []) {
  return inventories.reduce((sum, inventory) => {
    const cost = normalizeNumber(inventory.cost);
    const quantity = normalizeNumber(inventory.quantity);
    if (cost === '') return sum;
    return sum + cost * (quantity === '' ? 1 : quantity);
  }, 0);
}

export function calculateInventoryGrossMarginRate(inventories = [], totalAmount = '') {
  const sales = normalizeNumber(totalAmount);
  if (sales === '' || sales <= 0) return '';

  const costTotal = inventoryCostTotal(inventories);
  if (costTotal <= 0) return '';

  return `${(((sales - costTotal) / sales) * 100).toFixed(1).replace(/\.0$/, '')}%`;
}

export function inventoryLabel(inventory, product, supplier) {
  return [
    product?.name,
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
