import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { canUseCloud, fetchRecords, upsertRecords } from '../../../shared/services/recordSyncService.js';
import { normalizeProductCode } from '../../products/hooks/useProducts.js';

const SHIPMENTS_TABLE = 'inbound_shipments';
const LINES_TABLE = 'inbound_shipment_lines';
const ALIASES_TABLE = 'supplier_product_aliases';
const RECEIPTS_TABLE = 'inbound_receipts';
const RECEIPT_LINES_TABLE = 'inbound_receipt_lines';
const PARSER_VERSION = 'nippon-steel-delivery-notice-v1';

function nowIso() {
  return new Date().toISOString();
}

function toDateValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const normalized = text.replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function toDateTimeValue(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const normalized = text.replace(/\//g, '-');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function numericOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeInboundText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function buildInboundDuplicateKey({ shipment = {}, line = {} } = {}) {
  return [
    normalizeInboundText(shipment.supplierName ?? shipment.supplier),
    normalizeInboundText(shipment.documentNumber),
    normalizeInboundText(line.contractNo),
    line.lineNo ?? line.lineNumber ?? '',
    normalizeInboundText(line.productNameRaw ?? line.productName),
    numericOrNull(line.weight) ?? '',
    numericOrNull(line.unitPrice) ?? '',
    toDateValue(line.expiryDate),
  ].join('|');
}

function normalizeWarnings(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function normalizeSupplierProductAlias(alias = {}, userId = '') {
  return {
    id: alias.id ?? crypto.randomUUID(),
    userId: alias.userId ?? alias.user_id ?? userId,
    supplierName: alias.supplierName ?? alias.supplier_name ?? '',
    productId: alias.productId ?? alias.product_id ?? '',
    aliasName: alias.aliasName ?? alias.alias_name ?? '',
    normalizedAliasName: alias.normalizedAliasName ?? alias.normalized_alias_name ?? normalizeInboundText(alias.aliasName ?? alias.alias_name ?? ''),
    brandName: alias.brandName ?? alias.brand_name ?? '',
    factoryNo: alias.factoryNo ?? alias.factory_no ?? '',
    originCountry: alias.originCountry ?? alias.origin_country ?? '',
    isActive: alias.isActive ?? alias.is_active ?? true,
    createdAt: alias.createdAt ?? alias.created_at ?? nowIso(),
    updatedAt: alias.updatedAt ?? alias.updated_at ?? nowIso(),
  };
}

export function normalizeInboundShipment(shipment = {}, userId = '') {
  return {
    id: shipment.id ?? crypto.randomUUID(),
    userId: shipment.userId ?? shipment.user_id ?? userId,
    sourceFileName: shipment.sourceFileName ?? shipment.source_file_name ?? shipment.fileName ?? '',
    fileHash: shipment.fileHash ?? shipment.file_hash ?? '',
    documentNumber: shipment.documentNumber ?? shipment.document_number ?? '',
    supplierName: shipment.supplierName ?? shipment.supplier_name ?? shipment.supplier ?? '',
    issuedDate: shipment.issuedDate ?? shipment.issued_date ?? shipment.issueDate ?? '',
    status: shipment.status ?? 'draft',
    parserVersion: shipment.parserVersion ?? shipment.parser_version ?? PARSER_VERSION,
    rawText: shipment.rawText ?? shipment.raw_text ?? '',
    parseResult: shipment.parseResult ?? shipment.parse_result ?? {},
    warnings: normalizeWarnings(shipment.warnings),
    createdAt: shipment.createdAt ?? shipment.created_at ?? nowIso(),
    updatedAt: shipment.updatedAt ?? shipment.updated_at ?? nowIso(),
  };
}

export function normalizeInboundShipmentLine(line = {}, userId = '') {
  const plannedWeight = numericOrNull(line.plannedWeight ?? line.planned_weight ?? line.weight);
  const plannedPieces = numericOrNull(line.plannedPieces ?? line.planned_pieces ?? line.quantityPieces ?? line.quantity_pieces ?? line.pieceCount);
  const receivedWeightTotal = numericOrNull(line.receivedWeightTotal ?? line.received_weight_total) ?? 0;
  const receivedPiecesTotal = numericOrNull(line.receivedPiecesTotal ?? line.received_pieces_total) ?? 0;

  return {
    id: line.id ?? crypto.randomUUID(),
    userId: line.userId ?? line.user_id ?? userId,
    inboundShipmentId: line.inboundShipmentId ?? line.inbound_shipment_id ?? '',
    lineNo: Number(line.lineNo ?? line.line_no ?? line.lineNumber ?? 0) || 0,
    contractNo: line.contractNo ?? line.contract_no ?? '',
    brandNameRaw: line.brandNameRaw ?? line.brand_name_raw ?? line.brand ?? '',
    productNameRaw: line.productNameRaw ?? line.product_name_raw ?? line.productName ?? '',
    matchedProductId: line.matchedProductId ?? line.matched_product_id ?? '',
    matchStatus: line.matchStatus ?? line.match_status ?? 'unmatched',
    matchScore: numericOrNull(line.matchScore ?? line.match_score),
    quantityPieces: numericOrNull(line.quantityPieces ?? line.quantity_pieces ?? line.pieceCount),
    weight: numericOrNull(line.weight),
    plannedWeight,
    receivedWeightTotal,
    remainingWeight: numericOrNull(line.remainingWeight ?? line.remaining_weight) ?? Math.max((plannedWeight ?? 0) - receivedWeightTotal, 0),
    plannedPieces,
    receivedPiecesTotal,
    remainingPieces: numericOrNull(line.remainingPieces ?? line.remaining_pieces) ?? Math.max((plannedPieces ?? 0) - receivedPiecesTotal, 0),
    unit: line.unit ?? '',
    unitPrice: numericOrNull(line.unitPrice ?? line.unit_price),
    currency: line.currency ?? 'JPY',
    originCountry: line.originCountry ?? line.origin_country ?? '',
    factoryNo: line.factoryNo ?? line.factory_no ?? '',
    customsClearancePlannedDate: line.customsClearancePlannedDate ?? line.customs_clearance_planned_date ?? '',
    packingFrom: line.packingFrom ?? line.packing_from ?? '',
    packingTo: line.packingTo ?? line.packing_to ?? '',
    expiryDate: line.expiryDate ?? line.expiry_date ?? '',
    warehouseName: line.warehouseName ?? line.warehouse_name ?? line.warehouse ?? '',
    duplicateKey: line.duplicateKey ?? line.duplicate_key ?? '',
    status: line.status ?? 'draft',
    rawRow: line.rawRow ?? line.raw_row ?? line,
    warnings: normalizeWarnings(line.warnings),
    createdAt: line.createdAt ?? line.created_at ?? nowIso(),
    updatedAt: line.updatedAt ?? line.updated_at ?? nowIso(),
  };
}

export function inboundShipmentToRow(shipment) {
  return {
    id: shipment.id,
    user_id: shipment.userId,
    source_file_name: shipment.sourceFileName,
    file_hash: shipment.fileHash,
    document_number: shipment.documentNumber,
    supplier_name: shipment.supplierName,
    issued_date: toDateTimeValue(shipment.issuedDate),
    status: shipment.status,
    parser_version: shipment.parserVersion,
    raw_text: shipment.rawText,
    parse_result: shipment.parseResult,
    warnings: shipment.warnings,
    created_at: shipment.createdAt,
    updated_at: shipment.updatedAt,
  };
}

export function inboundShipmentFromRow(row) {
  return normalizeInboundShipment({
    id: row.id,
    userId: row.user_id,
    sourceFileName: row.source_file_name,
    fileHash: row.file_hash,
    documentNumber: row.document_number,
    supplierName: row.supplier_name,
    issuedDate: row.issued_date,
    status: row.status,
    parserVersion: row.parser_version,
    rawText: row.raw_text,
    parseResult: row.parse_result,
    warnings: row.warnings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function inboundShipmentLineToRow(line) {
  return {
    id: line.id,
    user_id: line.userId,
    inbound_shipment_id: line.inboundShipmentId,
    line_no: line.lineNo,
    contract_no: line.contractNo,
    brand_name_raw: line.brandNameRaw,
    product_name_raw: line.productNameRaw,
    matched_product_id: line.matchedProductId || null,
    match_status: line.matchStatus,
    match_score: line.matchScore,
    quantity_pieces: line.quantityPieces,
    weight: line.weight,
    planned_weight: line.plannedWeight,
    received_weight_total: line.receivedWeightTotal ?? 0,
    remaining_weight: line.remainingWeight ?? Math.max((line.plannedWeight ?? line.weight ?? 0) - (line.receivedWeightTotal ?? 0), 0),
    planned_pieces: line.plannedPieces,
    received_pieces_total: line.receivedPiecesTotal ?? 0,
    remaining_pieces: line.remainingPieces ?? Math.max((line.plannedPieces ?? line.quantityPieces ?? 0) - (line.receivedPiecesTotal ?? 0), 0),
    unit: line.unit,
    unit_price: line.unitPrice,
    currency: line.currency,
    origin_country: line.originCountry,
    factory_no: line.factoryNo,
    customs_clearance_planned_date: toDateValue(line.customsClearancePlannedDate) || null,
    packing_from: toDateValue(line.packingFrom) || null,
    packing_to: toDateValue(line.packingTo) || null,
    expiry_date: toDateValue(line.expiryDate) || null,
    warehouse_name: line.warehouseName,
    duplicate_key: line.duplicateKey,
    status: line.status,
    raw_row: line.rawRow,
    warnings: line.warnings,
    created_at: line.createdAt,
    updated_at: line.updatedAt,
  };
}

export function inboundShipmentLineFromRow(row) {
  return normalizeInboundShipmentLine({
    id: row.id,
    userId: row.user_id,
    inboundShipmentId: row.inbound_shipment_id,
    lineNo: row.line_no,
    contractNo: row.contract_no,
    brandNameRaw: row.brand_name_raw,
    productNameRaw: row.product_name_raw,
    matchedProductId: row.matched_product_id,
    matchStatus: row.match_status,
    matchScore: row.match_score,
    quantityPieces: row.quantity_pieces,
    weight: row.weight,
    plannedWeight: row.planned_weight,
    receivedWeightTotal: row.received_weight_total,
    remainingWeight: row.remaining_weight,
    plannedPieces: row.planned_pieces,
    receivedPiecesTotal: row.received_pieces_total,
    remainingPieces: row.remaining_pieces,
    unit: row.unit,
    unitPrice: row.unit_price,
    currency: row.currency,
    originCountry: row.origin_country,
    factoryNo: row.factory_no,
    customsClearancePlannedDate: row.customs_clearance_planned_date,
    packingFrom: row.packing_from,
    packingTo: row.packing_to,
    expiryDate: row.expiry_date,
    warehouseName: row.warehouse_name,
    duplicateKey: row.duplicate_key,
    status: row.status,
    rawRow: row.raw_row,
    warnings: row.warnings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function supplierProductAliasToRow(alias) {
  return {
    id: alias.id,
    user_id: alias.userId,
    supplier_name: alias.supplierName,
    product_id: alias.productId,
    alias_name: alias.aliasName,
    normalized_alias_name: alias.normalizedAliasName || normalizeInboundText(alias.aliasName),
    brand_name: alias.brandName,
    factory_no: alias.factoryNo,
    origin_country: alias.originCountry,
    is_active: alias.isActive !== false,
    created_at: alias.createdAt,
    updated_at: alias.updatedAt,
  };
}

export function supplierProductAliasFromRow(row) {
  return normalizeSupplierProductAlias({
    id: row.id,
    userId: row.user_id,
    supplierName: row.supplier_name,
    productId: row.product_id,
    aliasName: row.alias_name,
    normalizedAliasName: row.normalized_alias_name,
    brandName: row.brand_name,
    factoryNo: row.factory_no,
    originCountry: row.origin_country,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function normalizeInboundReceipt(receipt = {}, userId = '') {
  return {
    id: receipt.id ?? crypto.randomUUID(),
    userId: receipt.userId ?? receipt.user_id ?? userId,
    inboundShipmentId: receipt.inboundShipmentId ?? receipt.inbound_shipment_id ?? '',
    receiptNo: receipt.receiptNo ?? receipt.receipt_no ?? '',
    receivedAt: receipt.receivedAt ?? receipt.received_at ?? nowIso(),
    warehouseName: receipt.warehouseName ?? receipt.warehouse_name ?? '',
    memo: receipt.memo ?? '',
    createdAt: receipt.createdAt ?? receipt.created_at ?? nowIso(),
    updatedAt: receipt.updatedAt ?? receipt.updated_at ?? nowIso(),
  };
}

export function normalizeInboundReceiptLine(line = {}, userId = '') {
  return {
    id: line.id ?? crypto.randomUUID(),
    userId: line.userId ?? line.user_id ?? userId,
    inboundReceiptId: line.inboundReceiptId ?? line.inbound_receipt_id ?? '',
    inboundShipmentLineId: line.inboundShipmentLineId ?? line.inbound_shipment_line_id ?? '',
    productId: line.productId ?? line.product_id ?? '',
    receivedPieces: numericOrNull(line.receivedPieces ?? line.received_pieces),
    receivedWeight: numericOrNull(line.receivedWeight ?? line.received_weight),
    purchaseUnitCost: numericOrNull(line.purchaseUnitCost ?? line.purchase_unit_cost),
    expiryDate: line.expiryDate ?? line.expiry_date ?? '',
    warehouseName: line.warehouseName ?? line.warehouse_name ?? '',
    inventoryLotId: line.inventoryLotId ?? line.inventory_lot_id ?? '',
    createdAt: line.createdAt ?? line.created_at ?? nowIso(),
  };
}

export function inboundReceiptToRow(receipt) {
  return {
    id: receipt.id,
    user_id: receipt.userId,
    inbound_shipment_id: receipt.inboundShipmentId,
    receipt_no: receipt.receiptNo,
    received_at: receipt.receivedAt,
    warehouse_name: receipt.warehouseName,
    memo: receipt.memo,
    created_at: receipt.createdAt,
    updated_at: receipt.updatedAt,
  };
}

export function inboundReceiptLineToRow(line) {
  return {
    id: line.id,
    user_id: line.userId,
    inbound_receipt_id: line.inboundReceiptId,
    inbound_shipment_line_id: line.inboundShipmentLineId,
    product_id: line.productId,
    received_pieces: line.receivedPieces,
    received_weight: line.receivedWeight,
    purchase_unit_cost: line.purchaseUnitCost,
    expiry_date: toDateValue(line.expiryDate) || null,
    warehouse_name: line.warehouseName,
    inventory_lot_id: line.inventoryLotId,
    created_at: line.createdAt,
  };
}

export function matchInboundLineToProduct(line, products = [], aliases = [], supplierName = '') {
  const activeProducts = products.filter((product) => !product.deletedAt);
  const productNameKey = normalizeInboundText(line.productNameRaw ?? line.productName);
  const brandKey = normalizeInboundText(line.brandNameRaw ?? line.brand);
  const supplierKey = normalizeInboundText(supplierName);
  const factoryKey = normalizeInboundText(line.factoryNo);
  const originKey = normalizeInboundText(line.originCountry);

  const exactAliasMatches = aliases.filter((alias) => {
    if (!alias.isActive) return false;
    if (normalizeInboundText(alias.supplierName) !== supplierKey) return false;
    if (alias.normalizedAliasName !== productNameKey) return false;
    if (alias.brandName && normalizeInboundText(alias.brandName) !== brandKey) return false;
    if (alias.factoryNo && normalizeInboundText(alias.factoryNo) !== factoryKey) return false;
    if (alias.originCountry && normalizeInboundText(alias.originCountry) !== originKey) return false;
    return true;
  });
  const aliasProductIds = [...new Set(exactAliasMatches.map((alias) => alias.productId).filter(Boolean))];
  if (aliasProductIds.length === 1) {
    return { productId: aliasProductIds[0], status: 'matched', score: 100, source: 'alias' };
  }
  if (aliasProductIds.length > 1) {
    return { productId: '', status: 'ambiguous', score: 95, source: 'alias', warning: '商品別名に複数候補があります。' };
  }

  const codeMatches = activeProducts.filter((product) => {
    const code = normalizeProductCode(product.productCode ?? product.product_code ?? '');
    return code && code.toLowerCase() === productNameKey.toLowerCase();
  });
  if (codeMatches.length === 1) {
    return { productId: codeMatches[0].id, status: 'matched', score: 90, source: 'product_code' };
  }
  if (codeMatches.length > 1) {
    return { productId: '', status: 'ambiguous', score: 85, source: 'product_code', warning: '商品コードに複数候補があります。' };
  }

  const nameBrandMatches = activeProducts.filter((product) =>
    normalizeInboundText(product.name) === productNameKey &&
    normalizeInboundText(product.brandName ?? product.brand_name) === brandKey
  );
  if (nameBrandMatches.length === 1) {
    return { productId: nameBrandMatches[0].id, status: 'matched', score: 80, source: 'name_brand' };
  }
  if (nameBrandMatches.length > 1) {
    return { productId: '', status: 'ambiguous', score: 75, source: 'name_brand', warning: '商品名＋ブランドに複数候補があります。' };
  }

  const nameMatches = activeProducts.filter((product) => normalizeInboundText(product.name) === productNameKey);
  if (nameMatches.length === 1) {
    return { productId: nameMatches[0].id, status: 'matched', score: 70, source: 'name' };
  }
  if (nameMatches.length > 1) {
    return { productId: '', status: 'ambiguous', score: 65, source: 'name', warning: '商品名に複数候補があります。' };
  }

  return { productId: '', status: 'unmatched', score: 0, source: 'none' };
}

export function useInboundShipments(userId = '', products = []) {
  const [shipments, setShipments] = useState([]);
  const [lines, setLines] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [receiptLines, setReceiptLines] = useState([]);
  const [syncState, setSyncState] = useState(canUseCloud() ? 'syncing' : 'error');
  const [syncError, setSyncError] = useState('');
  const writeSequenceRef = useRef(0);

  async function reload(writeSequence = null) {
    if (!canUseCloud()) {
      setShipments([]);
      setLines([]);
      setAliases([]);
      setReceipts([]);
      setReceiptLines([]);
      setSyncState('error');
      setSyncError('Supabaseに接続できないため、入荷予定を取得できません。');
      return;
    }

    try {
      setSyncState('syncing');
      setSyncError('');
      const [nextShipments, nextLines, nextAliases, nextReceipts, nextReceiptLines] = await Promise.all([
        fetchRecords(SHIPMENTS_TABLE, userId, inboundShipmentFromRow),
        fetchRecords(LINES_TABLE, userId, inboundShipmentLineFromRow),
        fetchRecords(ALIASES_TABLE, userId, supplierProductAliasFromRow),
        fetchRecords(RECEIPTS_TABLE, userId, normalizeInboundReceipt),
        fetchRecords(RECEIPT_LINES_TABLE, userId, normalizeInboundReceiptLine),
      ]);
      if (writeSequence !== null && writeSequence !== writeSequenceRef.current) return;
      setShipments(nextShipments.filter((shipment) => shipment.status !== 'deleted'));
      setLines(nextLines.filter((line) => line.status !== 'deleted'));
      setAliases(nextAliases.filter((alias) => alias.isActive !== false));
      setReceipts(nextReceipts);
      setReceiptLines(nextReceiptLines);
      setSyncState('supabase');
    } catch (error) {
      if (writeSequence !== null && writeSequence !== writeSequenceRef.current) return;
      setShipments([]);
      setLines([]);
      setAliases([]);
      setReceipts([]);
      setReceiptLines([]);
      setSyncState('error');
      setSyncError(error.message || '入荷予定の取得に失敗しました。');
    }
  }

  useEffect(() => {
    reload();
  }, [userId]);

  const shipmentsWithLines = useMemo(
    () => shipments.map((shipment) => ({
      ...shipment,
      lines: lines
        .filter((line) => line.inboundShipmentId === shipment.id && line.status !== 'deleted')
        .sort((a, b) => a.lineNo - b.lineNo),
    })),
    [lines, shipments],
  );

  async function saveParsedShipment(preview) {
    if (!canUseCloud()) {
      const message = 'Supabaseに接続できないため、入荷予定として保存できません。';
      setSyncState('error');
      setSyncError(message);
      throw new Error(message);
    }

    const existing = shipments.find((shipment) => shipment.fileHash && shipment.fileHash === preview.fileHash);
    if (existing) {
      return { status: 'duplicate', shipmentId: existing.id };
    }

    const now = nowIso();
    const shipment = normalizeInboundShipment({
      id: crypto.randomUUID(),
      userId,
      sourceFileName: preview.fileName,
      fileHash: preview.fileHash,
      documentNumber: preview.documentNumber,
      supplierName: preview.supplier,
      issuedDate: preview.issueDate,
      status: 'matching',
      parserVersion: PARSER_VERSION,
      rawText: preview.rawText,
      parseResult: preview,
      warnings: preview.warnings,
      createdAt: now,
      updatedAt: now,
    }, userId);

    const nextLines = (preview.lines || []).map((parsedLine, index) => {
      const match = matchInboundLineToProduct(parsedLine, products, aliases, shipment.supplierName);
      const warnings = [...normalizeWarnings(parsedLine.warnings)];
      if (match.warning) warnings.push(match.warning);
      if (match.status === 'unmatched') warnings.push('商品マスターと照合できませんでした。');
      if (match.status === 'ambiguous') warnings.push('商品候補が複数あります。ユーザー確認が必要です。');

      return normalizeInboundShipmentLine({
        id: crypto.randomUUID(),
        userId,
        inboundShipmentId: shipment.id,
        lineNo: parsedLine.lineNumber || index + 1,
        contractNo: parsedLine.contractNo,
        brandNameRaw: parsedLine.brand,
        productNameRaw: parsedLine.productName,
        matchedProductId: match.productId,
        matchStatus: match.status,
        matchScore: match.score,
        quantityPieces: parsedLine.pieceCount,
        weight: parsedLine.weight,
        unit: parsedLine.unit,
        unitPrice: parsedLine.unitPrice,
        currency: parsedLine.currency,
        originCountry: parsedLine.originCountry,
        factoryNo: parsedLine.factoryNo,
        customsClearancePlannedDate: parsedLine.customsClearancePlannedDate,
        packingFrom: parsedLine.packingFrom,
        packingTo: parsedLine.packingTo,
        expiryDate: parsedLine.expiryDate,
        warehouseName: parsedLine.warehouse,
        duplicateKey: buildInboundDuplicateKey({ shipment, line: parsedLine }),
        plannedWeight: parsedLine.weight,
        plannedPieces: parsedLine.pieceCount,
        receivedWeightTotal: 0,
        receivedPiecesTotal: 0,
        remainingWeight: numericOrNull(parsedLine.weight) ?? 0,
        remainingPieces: numericOrNull(parsedLine.pieceCount) ?? 0,
        status: 'pending',
        rawRow: parsedLine,
        warnings,
        createdAt: now,
        updatedAt: now,
      }, userId);
    });

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    setSyncError('');
    try {
      await upsertRecords(SHIPMENTS_TABLE, [shipment], inboundShipmentToRow);
      await upsertRecords(LINES_TABLE, nextLines, inboundShipmentLineToRow);
      await reload(writeSequence);
      return { status: 'saved', shipmentId: shipment.id };
    } catch (error) {
      if (writeSequence === writeSequenceRef.current) {
        setSyncState('error');
        setSyncError(error.message || '入荷予定の保存に失敗しました。');
      }
      throw error;
    }
  }

  async function updateInboundLine(id, updates) {
    const currentLine = lines.find((line) => line.id === id);
    if (!currentLine) {
      throw new Error('入荷予定明細が見つかりません。');
    }
    const nextLine = normalizeInboundShipmentLine({
      ...currentLine,
      ...updates,
      userId,
      updatedAt: nowIso(),
    }, userId);
    if (updates.matchedProductId !== undefined) {
      nextLine.matchStatus = nextLine.matchedProductId ? 'manual' : 'unmatched';
      nextLine.matchScore = nextLine.matchedProductId ? 100 : 0;
    }

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    setSyncError('');
    try {
      await upsertRecords(LINES_TABLE, [nextLine], inboundShipmentLineToRow);
      await reload(writeSequence);
    } catch (error) {
      if (writeSequence === writeSequenceRef.current) {
        setSyncState('error');
        setSyncError(error.message || '入荷予定明細の保存に失敗しました。');
      }
      throw error;
    }
  }

  async function addInboundShipment(record) {
    const normalized = normalizeInboundShipment({
      ...record,
      id: record.id ?? crypto.randomUUID(),
      userId,
      createdAt: record.createdAt ?? nowIso(),
      updatedAt: record.updatedAt ?? nowIso(),
    }, userId);

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    setSyncError('');
    try {
      await upsertRecords(SHIPMENTS_TABLE, [normalized], inboundShipmentToRow);
      await reload(writeSequence);
      return normalized.id;
    } catch (error) {
      if (writeSequence === writeSequenceRef.current) {
        setSyncState('error');
        setSyncError(error.message || '入荷予定の復元に失敗しました。');
      }
      throw error;
    }
  }

  async function updateInboundShipment(id, updates) {
    const current = shipments.find((shipment) => shipment.id === id);
    const normalized = normalizeInboundShipment({
      ...(current || {}),
      ...updates,
      id,
      userId,
      updatedAt: nowIso(),
    }, userId);

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    setSyncError('');
    try {
      await upsertRecords(SHIPMENTS_TABLE, [normalized], inboundShipmentToRow);
      await reload(writeSequence);
    } catch (error) {
      if (writeSequence === writeSequenceRef.current) {
        setSyncState('error');
        setSyncError(error.message || '入荷予定の更新に失敗しました。');
      }
      throw error;
    }
  }

  async function addInboundLine(record) {
    const normalized = normalizeInboundShipmentLine({
      ...record,
      id: record.id ?? crypto.randomUUID(),
      userId,
      createdAt: record.createdAt ?? nowIso(),
      updatedAt: record.updatedAt ?? nowIso(),
    }, userId);

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    setSyncError('');
    try {
      await upsertRecords(LINES_TABLE, [normalized], inboundShipmentLineToRow);
      await reload(writeSequence);
      return normalized.id;
    } catch (error) {
      if (writeSequence === writeSequenceRef.current) {
        setSyncState('error');
        setSyncError(error.message || '入荷予定明細の復元に失敗しました。');
      }
      throw error;
    }
  }

  async function addSupplierProductAlias(alias) {
    const normalized = normalizeSupplierProductAlias({
      ...alias,
      id: alias.id ?? crypto.randomUUID(),
      userId,
      normalizedAliasName: normalizeInboundText(alias.aliasName),
      isActive: true,
      createdAt: alias.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    }, userId);

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    setSyncError('');
    try {
      await upsertRecords(ALIASES_TABLE, [normalized], supplierProductAliasToRow);
      await reload(writeSequence);
      return normalized.id;
    } catch (error) {
      if (writeSequence === writeSequenceRef.current) {
        setSyncState('error');
        setSyncError(error.message || '商品別名の保存に失敗しました。');
      }
      throw error;
    }
  }

  async function addInboundReceipt(record) {
    const normalized = normalizeInboundReceipt({
      ...record,
      id: record.id ?? crypto.randomUUID(),
      userId,
      createdAt: record.createdAt ?? nowIso(),
      updatedAt: record.updatedAt ?? nowIso(),
    }, userId);

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    setSyncError('');
    try {
      await upsertRecords(RECEIPTS_TABLE, [normalized], inboundReceiptToRow);
      await reload(writeSequence);
      return normalized.id;
    } catch (error) {
      if (writeSequence === writeSequenceRef.current) {
        setSyncState('error');
        setSyncError(error.message || '入荷確定履歴の復元に失敗しました。');
      }
      throw error;
    }
  }

  async function addInboundReceiptLine(record) {
    const normalized = normalizeInboundReceiptLine({
      ...record,
      id: record.id ?? crypto.randomUUID(),
      userId,
      createdAt: record.createdAt ?? nowIso(),
    }, userId);

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    setSyncError('');
    try {
      await upsertRecords(RECEIPT_LINES_TABLE, [normalized], inboundReceiptLineToRow);
      await reload(writeSequence);
      return normalized.id;
    } catch (error) {
      if (writeSequence === writeSequenceRef.current) {
        setSyncState('error');
        setSyncError(error.message || '入荷確定明細の復元に失敗しました。');
      }
      throw error;
    }
  }

  async function confirmInboundReceipt({ inboundShipmentId, receivedAt, warehouseName, memo, lines: receiptLinesInput = [] } = {}) {
    if (!canUseCloud()) {
      const message = 'Supabaseに接続できないため、入荷確定できません。';
      setSyncState('error');
      setSyncError(message);
      throw new Error(message);
    }

    const payloadLines = receiptLinesInput
      .filter((line) => line && line.enabled !== false)
      .map((line) => ({
        inbound_shipment_line_id: line.inboundShipmentLineId,
        received_pieces: numericOrNull(line.receivedPieces),
        received_weight: numericOrNull(line.receivedWeight),
        purchase_unit_cost: numericOrNull(line.purchaseUnitCost),
        expiry_date: toDateValue(line.expiryDate) || null,
        warehouse_name: line.warehouseName || '',
      }));

    if (payloadLines.length === 0) {
      throw new Error('入荷対象の明細を選択してください。');
    }

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    setSyncError('');
    try {
      const { data, error } = await supabase.rpc('confirm_inbound_receipt', {
        p_inbound_shipment_id: inboundShipmentId,
        p_received_at: receivedAt || new Date().toISOString(),
        p_warehouse_name: warehouseName || null,
        p_memo: memo || null,
        p_lines: payloadLines,
      });
      if (error) throw error;
      await reload(writeSequence);
      return data;
    } catch (error) {
      if (writeSequence === writeSequenceRef.current) {
        setSyncState('error');
        setSyncError(error.message || '入荷確定に失敗しました。');
      }
      throw error;
    }
  }

  return {
    records: shipmentsWithLines,
    lines,
    aliases,
    receipts,
    receiptLines,
    saveParsedShipment,
    addInboundShipment,
    updateInboundShipment,
    addInboundLine,
    updateInboundLine,
    addSupplierProductAlias,
    addInboundReceipt,
    addInboundReceiptLine,
    confirmInboundReceipt,
    reload,
    syncState,
    syncError,
  };
}
