const ACTIVE_INBOUND_STATUSES = new Set(['pending', 'partially_received']);
const EXCLUDED_INBOUND_STATUSES = new Set(['received', 'skipped', 'cancelled', 'failed', 'excluded', 'deleted']);
const WEIGHT_UNITS = new Set(['kg', 'kgs', 'kilogram', 'kilograms', 'キロ', '重量']);
const PIECE_UNITS = new Set(['cs', 'case', 'cases', 'ケース', '箱', '個', 'pcs', 'piece', 'pieces']);

function numberOrZero(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function roundStockQuantity(value) {
  return Math.round((numberOrZero(value) + Number.EPSILON) * 1000) / 1000;
}

export function formatPlannedQuantity(value, unit = '') {
  const quantity = roundStockQuantity(value);
  return `${quantity.toLocaleString('ja-JP', { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ''}`;
}

export function normalizeInventoryUnit(unit = '') {
  const normalized = String(unit || '').normalize('NFKC').trim();
  const lower = normalized.toLowerCase();
  if (WEIGHT_UNITS.has(lower)) return 'kg';
  if (PIECE_UNITS.has(lower)) {
    if (lower === 'cs' || lower === 'case' || lower === 'cases') return 'ケース';
    if (lower === 'pcs' || lower === 'piece' || lower === 'pieces') return '個';
  }
  return normalized || '';
}

function productName(product) {
  return product?.name || product?.productName || product?.product_name || '商品未設定';
}

function productCode(product) {
  return product?.productCode || product?.product_code || '';
}

function inventoryQuantity(inventory) {
  return numberOrZero(inventory?.quantity);
}

function reservedQuantity(inventory) {
  return numberOrZero(inventory?.reservedQuantity ?? inventory?.reserved_quantity);
}

function availableQuantity(inventory) {
  return Math.max(inventoryQuantity(inventory) - reservedQuantity(inventory), 0);
}

function firstDate(a, b) {
  if (!a) return b || '';
  if (!b) return a;
  return a <= b ? a : b;
}

export function getInboundShipmentLines(inboundShipments = []) {
  return inboundShipments.flatMap((shipment) =>
    (shipment?.lines || []).map((line) => ({
      ...line,
      shipmentId: shipment.id,
      supplierName: shipment.supplierName || shipment.supplier_name || '',
      sourceFileName: shipment.sourceFileName || shipment.source_file_name || '',
      documentNumber: shipment.documentNumber || shipment.document_number || '',
    })),
  );
}

export function getPlannedLineQuantity(line = {}) {
  const status = line.status || 'pending';
  if (!ACTIVE_INBOUND_STATUSES.has(status) || EXCLUDED_INBOUND_STATUSES.has(status)) return null;
  const matchedProductId = line.matchedProductId ?? line.matched_product_id;
  if (!matchedProductId) return null;

  const remainingWeight = numberOrNull(line.remainingWeight ?? line.remaining_weight);
  if (remainingWeight !== null && remainingWeight > 0) {
    return {
      quantity: roundStockQuantity(remainingWeight),
      unit: 'kg',
      source: 'remaining_weight',
    };
  }

  const remainingPieces = numberOrNull(line.remainingPieces ?? line.remaining_pieces);
  if (remainingPieces !== null && remainingPieces > 0) {
    return {
      quantity: roundStockQuantity(remainingPieces),
      unit: normalizeInventoryUnit(line.unit || '個') || '個',
      source: 'remaining_pieces',
    };
  }

  return null;
}

function choosePrimaryUnit(product, stockRows, plannedEntries) {
  const stockUnit = stockRows.find((row) => normalizeInventoryUnit(row.unit))?.unit;
  if (stockUnit) return normalizeInventoryUnit(stockUnit);
  const plannedUnit = plannedEntries.find((entry) => entry.unit)?.unit;
  if (plannedUnit) return normalizeInventoryUnit(plannedUnit);
  return normalizeInventoryUnit(product?.costUnit || product?.sellingPriceUnit || product?.unit || '');
}

export function buildPlannedInventoryRows({
  products = [],
  inventories = [],
  inboundShipments = [],
} = {}) {
  const plannedLines = getInboundShipmentLines(inboundShipments);
  const productIds = new Set([
    ...products.map((product) => product.id).filter(Boolean),
    ...inventories.map((inventory) => inventory.productId ?? inventory.product_id).filter(Boolean),
    ...plannedLines.map((line) => line.matchedProductId ?? line.matched_product_id).filter(Boolean),
  ]);

  return [...productIds].map((productId) => {
    const product = products.find((item) => item.id === productId) || { id: productId };
    const stockRows = inventories.filter((inventory) => (inventory.productId ?? inventory.product_id) === productId);
    const plannedEntries = plannedLines
      .filter((line) => (line.matchedProductId ?? line.matched_product_id) === productId)
      .map((line) => {
        const quantity = getPlannedLineQuantity(line);
        if (!quantity) return null;
        return {
          ...quantity,
          line,
          customsDate: line.customsClearancePlannedDate ?? line.customs_clearance_planned_date ?? '',
          contractNo: line.contractNo ?? line.contract_no ?? '',
          warehouseName: line.warehouseName ?? line.warehouse_name ?? line.warehouse ?? '',
        };
      })
      .filter(Boolean);

    const unit = choosePrimaryUnit(product, stockRows, plannedEntries);
    const warnings = [];
    const stockForUnit = stockRows.filter((row) => normalizeInventoryUnit(row.unit) === unit);
    const skippedStockUnits = [...new Set(stockRows
      .filter((row) => normalizeInventoryUnit(row.unit) !== unit)
      .map((row) => normalizeInventoryUnit(row.unit) || '単位未設定'))];
    if (skippedStockUnits.length) {
      warnings.push(`現在庫に異なる単位があります: ${skippedStockUnits.join(' / ')}`);
    }

    const plannedForUnit = plannedEntries.filter((entry) => entry.unit === unit);
    const skippedPlannedUnits = [...new Set(plannedEntries
      .filter((entry) => entry.unit !== unit)
      .map((entry) => entry.unit || '単位未設定'))];
    if (skippedPlannedUnits.length) {
      warnings.push(`入荷予定に異なる単位があります: ${skippedPlannedUnits.join(' / ')}`);
    }

    const timeline = plannedForUnit
      .map((entry) => ({
        id: entry.line.id,
        customsDate: entry.customsDate,
        quantity: entry.quantity,
        unit: entry.unit,
        contractNo: entry.contractNo,
        warehouseName: entry.warehouseName,
        supplierName: entry.line.supplierName || '',
        productNameRaw: entry.line.productNameRaw ?? entry.line.product_name_raw ?? '',
        status: entry.line.status || 'pending',
      }))
      .sort((a, b) =>
        String(a.customsDate || '9999-12-31').localeCompare(String(b.customsDate || '9999-12-31')) ||
        String(a.contractNo || '').localeCompare(String(b.contractNo || '')),
      );

    const currentStock = roundStockQuantity(stockForUnit.reduce((sum, row) => sum + inventoryQuantity(row), 0));
    const reserved = roundStockQuantity(stockForUnit.reduce((sum, row) => sum + reservedQuantity(row), 0));
    const available = roundStockQuantity(stockForUnit.reduce((sum, row) => sum + availableQuantity(row), 0));
    const planned = roundStockQuantity(plannedForUnit.reduce((sum, entry) => sum + entry.quantity, 0));

    return {
      productId,
      product,
      productName: productName(product),
      productCode: productCode(product),
      unit,
      currentStock,
      reserved,
      available,
      plannedInbound: planned,
      projectedStock: roundStockQuantity(currentStock + planned),
      nextCustomsDate: timeline.reduce((next, entry) => firstDate(next, entry.customsDate), ''),
      inboundCount: timeline.length,
      timeline,
      warnings,
    };
  }).sort((a, b) => a.productName.localeCompare(b.productName, 'ja'));
}

export function findPlannedInventoryRow(rows = [], productId = '') {
  return rows.find((row) => row.productId === productId) || null;
}
