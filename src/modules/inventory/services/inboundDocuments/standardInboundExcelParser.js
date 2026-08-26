import { createNormalizedDocument, createNormalizedField } from './normalizedInboundDocument.js';

const SHEET_NAME = 'IMPORT_TEMPLATE';

const FIELD_DEFINITIONS = {
  documentType: ['document_type'],
  documentNumber: ['document_number'],
  supplierName: ['supplier_name'],
  warehouseName: ['warehouse_name'],
  contractNo: ['contract_no'],
  sourceLineNo: ['source_line_no'],
  lotNo: ['lot_no'],
  productCode: ['product_code'],
  brandName: ['brand_name'],
  productName: ['product_name'],
  packingFrom: ['packing_from'],
  packingTo: ['packing_to'],
  productionDate: ['production_date'],
  expiryDate: ['expiry_date'],
  customsClearancePlannedDate: ['customs_clearance_planned_date'],
  warehouseArrivalDate: ['warehouse_arrival_date'],
  receivedDate: ['received_date'],
  quantityPieces: ['quantity_pieces'],
  unitWeightKg: ['unit_weight_kg'],
  totalWeightKg: ['total_weight_kg'],
  unitPrice: ['unit_price'],
  baseUnitPrice: ['base_unit_price'],
  coefficient: ['coefficient'],
  additionalCost: ['additional_cost'],
  billedUnitPrice: ['billed_unit_price'],
  currency: ['currency'],
  priceUnit: ['price_unit'],
  category: ['category'],
  originCountry: ['origin_country'],
  factoryNo: ['factory_no'],
  sourceFile: ['source_file'],
  sourceNote: ['source_note'],
  confidence: ['confidence'],
  requiresReview: ['requires_review'],
};

const IDENTIFIER_FIELDS = new Set(['documentNumber', 'contractNo', 'lotNo', 'productCode', 'factoryNo']);
const DATE_FIELDS = new Set([
  'packingFrom',
  'packingTo',
  'productionDate',
  'expiryDate',
  'customsClearancePlannedDate',
  'warehouseArrivalDate',
  'receivedDate',
]);
const NUMBER_FIELDS = new Set([
  'sourceLineNo',
  'quantityPieces',
  'unitWeightKg',
  'totalWeightKg',
  'unitPrice',
  'baseUnitPrice',
  'coefficient',
  'additionalCost',
  'billedUnitPrice',
]);

export async function parseStandardInboundExcelFile(file) {
  if (!file) throw new Error('Excelファイルを選択してください。');
  if (!/\.xlsx$/i.test(file.name || '')) throw new Error('.xlsxファイルを選択してください。');

  const [{ default: ExcelJS }, data] = await Promise.all([
    import('exceljs'),
    file.arrayBuffer(),
  ]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await normalizeSpreadsheetNamespacePrefixes(data));
  const worksheet = workbook.getWorksheet(SHEET_NAME);
  if (!worksheet) throw new Error(`「${SHEET_NAME}」シートが見つかりません。`);

  const header = findHeaderRow(worksheet);
  if (!header) throw new Error('IMPORT_TEMPLATEのheader行を認識できません。');

  const parsedRows = [];
  for (let rowNumber = header.rowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if (isMappedRowEmpty(row, header.columns)) continue;
    parsedRows.push(parseRow(row, rowNumber, header.columns));
  }
  if (!parsedRows.length) throw new Error('IMPORT_TEMPLATEに取込可能な明細がありません。');

  const dataBytes = new Uint8Array(data);
  const fileHash = await sha256Hex(dataBytes);
  const documentNumber = firstPopulated(parsedRows, 'documentNumber');
  const supplierName = firstPopulated(parsedRows, 'supplierName');
  const warnings = buildDocumentWarnings(parsedRows);
  const classification = {
    documentType: 'standard_excel_import',
    confidence: 'high',
    reasons: [`${SHEET_NAME}シートと標準headerを認識`],
  };
  const normalizedDocument = materializeNormalizedDocument({
    file,
    fileHash,
    classification,
    parsedRows,
    documentNumber,
    supplierName,
    warnings,
  });

  return {
    classification,
    normalizedDocument,
    preview: materializePreview({
      file,
      fileHash,
      classification,
      normalizedDocument,
      parsedRows,
      documentNumber,
      supplierName,
      warnings,
    }),
  };
}

async function normalizeSpreadsheetNamespacePrefixes(data) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(data);
  const workbookEntry = zip.file('xl/workbook.xml');
  if (!workbookEntry) return data;

  const workbookXml = await workbookEntry.async('string');
  const namespaceMatch = workbookXml.match(/xmlns:([A-Za-z_][\w.-]*)=["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/);
  if (!namespaceMatch) return data;

  const prefix = namespaceMatch[1];
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const elementPattern = new RegExp(`<(/?)${escapedPrefix}:`, 'g');
  const namespacePattern = new RegExp(`xmlns:${escapedPrefix}=`, 'g');

  await Promise.all(Object.entries(zip.files).map(async ([name, entry]) => {
    if (entry.dir || !name.endsWith('.xml')) return;
    const xml = await entry.async('string');
    if (!xml.includes(`xmlns:${prefix}="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`)
      && !xml.includes(`xmlns:${prefix}='http://schemas.openxmlformats.org/spreadsheetml/2006/main'`)) return;
    zip.file(name, xml.replace(elementPattern, '<$1').replace(namespacePattern, 'xmlns='));
  }));

  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

function findHeaderRow(worksheet) {
  const required = new Set(['contractNo', 'productName']);
  const lastCandidateRow = Math.min(worksheet.rowCount, 30);
  for (let rowNumber = 1; rowNumber <= lastCandidateRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const columns = new Map();
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const field = fieldForHeader(cell.text || cell.value);
      if (field && !columns.has(field)) columns.set(field, { columnNumber, header: cell.text || String(cell.value || '') });
    });
    if ([...required].every((field) => columns.has(field))) return { rowNumber, columns };
  }
  return null;
}

function fieldForHeader(value) {
  const normalized = normalizeHeader(value);
  return Object.entries(FIELD_DEFINITIONS).find(([, aliases]) => aliases.some((alias) => normalizeHeader(alias) === normalized))?.[0] || '';
}

function normalizeHeader(value) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isMappedRowEmpty(row, columns) {
  return [...columns.values()].every(({ columnNumber }) => isBlank(cellValue(row.getCell(columnNumber))));
}

function parseRow(row, rowNumber, columns) {
  const values = {};
  const rawValues = {};
  const headers = {};
  for (const [field, { columnNumber, header }] of columns) {
    const cell = row.getCell(columnNumber);
    rawValues[field] = rawCellValue(cell);
    headers[field] = header;
    values[field] = normalizeCell(field, cell);
  }
  const confidence = normalizeConfidence(values.confidence);
  const requiresReview = normalizeBoolean(values.requiresReview);
  return { rowNumber, values, rawValues, headers, confidence, requiresReview };
}

function normalizeCell(field, cell) {
  if (IDENTIFIER_FIELDS.has(field)) return identifierValue(cell);
  if (DATE_FIELDS.has(field)) return normalizeDateValue(cellValue(cell));
  if (NUMBER_FIELDS.has(field)) return normalizeNumber(cellValue(cell));
  if (field === 'requiresReview') return normalizeBoolean(cellValue(cell));
  return stringValue(cellValue(cell));
}

function cellValue(cell) {
  const value = cell?.value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (Object.prototype.hasOwnProperty.call(value, 'result')) return value.result;
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
    if (Object.prototype.hasOwnProperty.call(value, 'text')) return value.text;
  }
  return value;
}

function rawCellValue(cell) {
  const value = cellValue(cell);
  if (value instanceof Date) return value.toISOString();
  return value ?? '';
}

function identifierValue(cell) {
  if (isBlank(cellValue(cell))) return '';
  const value = cellValue(cell);
  const zeroPattern = String(cell.numFmt || '').trim();
  if (typeof value === 'number' && Number.isInteger(value) && /^0+$/.test(zeroPattern)) {
    return String(value).padStart(zeroPattern.length, '0');
  }
  const text = String(cell.text || '').trim();
  if (text) return text;
  return String(value).trim();
}

function stringValue(value) {
  return isBlank(value) ? '' : String(value).trim();
}

function normalizeNumber(value) {
  if (isBlank(value)) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value).normalize('NFKC').replace(/,/g, '').trim();
  const match = normalized.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) return '';
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : '';
}

function normalizeDateValue(value) {
  if (isBlank(value)) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDate(value);
  if (typeof value === 'number' && Number.isFinite(value)) {
    const utcMilliseconds = Math.round((value - 25569) * 86400 * 1000);
    const date = new Date(utcMilliseconds);
    return Number.isNaN(date.getTime()) ? '' : formatDate(date, true);
  }

  const normalized = String(value).normalize('NFKC').trim();
  const match = normalized.match(/^(\d{2,4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
  if (!match) return '';
  const year = match[1].length === 2 ? 2000 + Number(match[1]) : Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year.toString().padStart(4, '0')}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

function formatDate(value, useUtc = false) {
  const year = useUtc ? value.getUTCFullYear() : value.getFullYear();
  const month = (useUtc ? value.getUTCMonth() : value.getMonth()) + 1;
  const day = useUtc ? value.getUTCDate() : value.getDate();
  return `${year.toString().padStart(4, '0')}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

function normalizeBoolean(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || isBlank(value)) return false;
  return ['true', 'yes', 'y', '1', '要確認'].includes(String(value).normalize('NFKC').trim().toLowerCase());
}

function normalizeConfidence(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['high', 'medium', 'low'].includes(normalized) ? normalized : 'high';
}

function firstPopulated(rows, field) {
  return rows.find((row) => !isBlank(row.values[field]))?.values[field] || '';
}

function buildDocumentWarnings(rows) {
  const warnings = [];
  for (const field of ['documentNumber', 'supplierName']) {
    const unique = new Set(rows.map((row) => row.values[field]).filter((value) => !isBlank(value)));
    if (unique.size > 1) warnings.push(`${FIELD_DEFINITIONS[field][0]}が明細間で一致していません。`);
  }
  const reviewCount = rows.filter((row) => row.requiresReview).length;
  if (reviewCount) warnings.push(`要確認の明細が${reviewCount}件あります。`);
  return warnings;
}

function materializeNormalizedDocument({ file, fileHash, classification, parsedRows, documentNumber, supplierName, warnings }) {
  const sourceDocumentType = 'standard_excel_import';
  const field = (value, name, row = null) => createNormalizedField(value, {
    confidence: row?.confidence || (isBlank(value) ? 'low' : 'high'),
    source: row ? `excel-column:${row.headers[name] || FIELD_DEFINITIONS[name]?.[0] || name}` : 'excel-document',
    rawValue: row?.rawValues[name] ?? value ?? '',
    sourceDocumentType,
  });
  return createNormalizedDocument({
    documentType: sourceDocumentType,
    fileName: file.name,
    fileHash,
    fileSize: file.size,
    classification,
    fields: {
      documentNumber: field(documentNumber, 'documentNumber'),
      supplierName: field(supplierName, 'supplierName'),
    },
    lines: parsedRows.map((row, index) => ({
      id: `excel-line-${row.rowNumber}`,
      ...Object.fromEntries(Object.keys(FIELD_DEFINITIONS).map((name) => [name, field(row.values[name] ?? '', name, row)])),
      lineNumber: field(row.values.sourceLineNo || index + 1, 'sourceLineNo', row),
      warnings: row.requiresReview ? ['要確認: requires_reviewがTRUEです。'] : [],
      requiresReview: row.requiresReview,
    })),
    warnings,
    source: { sheetName: SHEET_NAME },
  });
}

function materializePreview({ file, fileHash, classification, normalizedDocument, parsedRows, documentNumber, supplierName, warnings }) {
  return {
    documentType: 'standard_excel_import',
    classification,
    normalizedDocument,
    fileName: file.name,
    fileHash,
    fileSize: file.size,
    pageCount: 0,
    issueDate: '',
    documentNumber,
    supplier: supplierName,
    warnings,
    rawText: '',
    lines: parsedRows.map((row, index) => ({
      id: `excel-line-${row.rowNumber}`,
      lineNumber: row.values.sourceLineNo || index + 1,
      contractNo: row.values.contractNo || '',
      brand: row.values.brandName || '',
      productName: row.values.productName || '',
      productCode: row.values.productCode || '',
      lotNo: row.values.lotNo || '',
      productType: row.values.category || '',
      pieceCount: row.values.quantityPieces,
      unitWeightKg: row.values.unitWeightKg,
      weight: row.values.totalWeightKg,
      unit: row.values.totalWeightKg === '' ? '' : 'KG',
      unitPrice: row.values.unitPrice,
      baseUnitPrice: row.values.baseUnitPrice,
      coefficient: row.values.coefficient,
      additionalCost: row.values.additionalCost,
      billedUnitPrice: row.values.billedUnitPrice,
      currency: row.values.currency || '',
      priceUnit: row.values.priceUnit || '',
      originCountry: row.values.originCountry || '',
      factoryNo: row.values.factoryNo || '',
      customsClearancePlannedDate: row.values.customsClearancePlannedDate || '',
      packingFrom: row.values.packingFrom || '',
      packingTo: row.values.packingTo || '',
      productionDate: row.values.productionDate || '',
      expiryDate: row.values.expiryDate || '',
      warehouseArrivalDate: row.values.warehouseArrivalDate || '',
      receivedDate: row.values.receivedDate || '',
      warehouse: row.values.warehouseName || '',
      sourceFile: row.values.sourceFile || '',
      sourceNote: row.values.sourceNote || '',
      confidence: row.confidence,
      requiresReview: row.requiresReview,
      warnings: row.requiresReview ? ['要確認: requires_reviewがTRUEです。'] : [],
      fieldMeta: normalizedDocument.lines[index],
    })),
  };
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

async function sha256Hex(data) {
  if (!globalThis.crypto?.subtle) return '';
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
