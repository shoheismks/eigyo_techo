import { createNormalizedDocument, createNormalizedField } from './normalizedInboundDocument.js';

const HEADER_ALIASES = {
  productCode: ['code', '商品コード'],
  productName: ['item', '商品', '商品名', '品名', 'product'],
  baseUnitPrice: ['単価', 'unitprice', 'baseprice'],
  coefficient: ['係数', 'coefficient', 'factor'],
  additionalCost: ['諸費用', 'additionalcost', 'charges'],
  billedUnitPrice: ['請求単価', 'billedprice', 'invoiceprice'],
};

export const productPriceListAdapter = {
  documentType: 'product_price_list',
  async parse({ file, extraction, fileHash, classification }) {
    return {
      normalizedDocument: parseProductPriceList({
        extraction,
        fileName: file.name,
        fileSize: file.size,
        fileHash,
        classification,
      }),
    };
  },
};

export function parseProductPriceList({
  extraction = {},
  fileName = '',
  fileSize = 0,
  fileHash = '',
  classification = null,
} = {}) {
  const pages = extraction.pages || [];
  const warnings = [];
  const rows = [];
  let recognizedHeader = null;

  pages.forEach((page) => {
    const header = detectHeader(page.items || [], page.width || 1);
    if (!header) {
      warnings.push(`ページ${page.pageNumber}: 単価表ヘッダーを認識できませんでした。`);
      return;
    }
    recognizedHeader ||= header;
    rows.push(...extractRows(page, header));
  });

  const documentNumber = findDocumentNumber(extraction.text || '');
  if (!documentNumber) warnings.push('単価表番号を取得できませんでした。');
  if (rows.length === 0) warnings.push('商品単価行を取得できませんでした。');

  const type = 'product_price_list';
  return createNormalizedDocument({
    documentType: type,
    fileName,
    fileHash,
    fileSize,
    pageCount: extraction.pageCount || pages.length,
    classification,
    fields: {
      documentNumber: field(documentNumber || null, 'high', 'document-pattern', documentNumber, type),
      currency: field('JPY', 'high', 'price-header', '¥', type),
      priceUnit: field('KG', 'high', 'price-header', '¥/kg', type),
    },
    lines: rows,
    warnings,
    rawText: extraction.text || '',
    source: { header: recognizedHeader?.summary || null },
  });
}

function detectHeader(items, pageWidth) {
  const candidates = items
    .map((item) => ({ ...item, field: matchHeader(item.text) }))
    .filter((item) => item.field);
  let bestGroup = [];
  candidates.forEach((anchor) => {
    const group = candidates.filter((candidate) => Math.abs(candidate.y - anchor.y) <= Math.max(anchor.height || 8, 12));
    if (new Set(group.map((item) => item.field)).size > new Set(bestGroup.map((item) => item.field)).size) bestGroup = group;
  });
  const unique = chooseOnePerField(bestGroup);
  const fields = new Set(unique.map((item) => item.field));
  if (!fields.has('productCode') || !fields.has('productName') || !fields.has('baseUnitPrice') || fields.size < 5) return null;

  const columns = unique
    .sort((left, right) => left.x - right.x)
    .map((item) => ({ field: item.field, center: item.x + item.width / 2, header: item }));
  columns.forEach((column, index) => {
    column.left = index === 0 ? 0 : (columns[index - 1].center + column.center) / 2;
    column.right = index === columns.length - 1 ? pageWidth : (column.center + columns[index + 1].center) / 2;
  });
  return {
    headerBottom: Math.min(...unique.map((item) => item.y)) - 2,
    columns,
    summary: { fields: [...fields], confidence: fields.size === 6 ? 'high' : 'medium' },
  };
}

function extractRows(page, header) {
  const codeColumn = header.columns.find((column) => column.field === 'productCode');
  const anchors = (page.items || [])
    .filter((item) => item.y < header.headerBottom)
    .filter((item) => inColumn(item, codeColumn))
    .filter((item) => /^\d{5,}$/.test(item.text.trim()))
    .sort((left, right) => right.y - left.y);

  return anchors.map((anchor, index) => {
    const top = index === 0 ? header.headerBottom : (anchors[index - 1].y + anchor.y) / 2;
    const bottom = index === anchors.length - 1 ? anchor.y - rowGap(anchors) / 2 : (anchor.y + anchors[index + 1].y) / 2;
    const rowItems = (page.items || []).filter((item) => item.y <= top && item.y > bottom);
    const raw = Object.fromEntries(header.columns.map((column) => [
      column.field,
      rowItems.filter((item) => inColumn(item, column)).sort((a, b) => b.y - a.y || a.x - b.x).map((item) => item.text).join(' ').trim(),
    ]));
    const combinedCodeAndName = String(raw.productCode || '').match(/^(\d{5,})\s+(.+)$/);
    if (combinedCodeAndName) {
      raw.productCode = combinedCodeAndName[1];
      raw.productName = [combinedCodeAndName[2], raw.productName].filter(Boolean).join(' ').trim();
    }
    const sourceType = 'product_price_list';
    const lineNumber = index + 1;
    return {
      id: `${raw.productCode || 'price'}-${lineNumber}`,
      lineNumber: field(lineNumber, 'high', 'row-order', String(lineNumber), sourceType),
      productCode: field(raw.productCode || null, raw.productCode ? 'high' : 'low', 'table-column', raw.productCode, sourceType),
      productName: field(raw.productName || null, raw.productName ? 'high' : 'low', 'table-column', raw.productName, sourceType),
      baseUnitPrice: numericField(raw.baseUnitPrice, sourceType),
      coefficient: numericField(raw.coefficient, sourceType),
      additionalCost: numericField(raw.additionalCost, sourceType),
      billedUnitPrice: numericField(raw.billedUnitPrice, sourceType),
      currency: field('JPY', 'high', 'price-header', '¥', sourceType),
      priceUnit: field('KG', 'high', 'price-header', '¥/kg', sourceType),
      warnings: requiredWarnings(raw),
    };
  });
}

function matchHeader(value) {
  const normalized = normalize(value);
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((alias) => normalize(alias) === normalized)) return key;
  }
  return null;
}

function chooseOnePerField(items) {
  return [...new Map(items.map((item) => [item.field, item])).values()];
}

function findDocumentNumber(text) {
  return String(text || '').match(/\b[A-Z]{1,4}\d{3,}\b/)?.[0] || '';
}

function numericField(rawValue, sourceDocumentType) {
  const match = String(rawValue || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  const value = match ? Number(match[0]) : null;
  return field(value, Number.isFinite(value) ? 'high' : 'low', 'table-column', rawValue, sourceDocumentType);
}

function field(value, confidence, source, rawValue, sourceDocumentType) {
  return createNormalizedField(value, { confidence, source, rawValue: rawValue || '', sourceDocumentType });
}

function requiredWarnings(raw) {
  return Object.entries({
    productCode: '商品コード', productName: '商品名', baseUnitPrice: '基礎単価',
    coefficient: '係数', additionalCost: '諸費用', billedUnitPrice: '請求単価',
  }).flatMap(([key, label]) => raw[key] ? [] : [`${label}を取得できませんでした。`]);
}

function normalize(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[\s:：._/-]+/g, '');
}

function inColumn(item, column) {
  return item.x >= column.left && item.x < column.right;
}

function rowGap(anchors) {
  if (anchors.length < 2) return 28;
  const gaps = anchors.slice(0, -1).map((anchor, index) => anchor.y - anchors[index + 1].y).sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] || 28;
}
