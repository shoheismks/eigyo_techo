import {
  DELIVERY_NOTICE_DOCUMENT_FIELD_DEFINITIONS,
  DELIVERY_NOTICE_FIELD_DEFINITIONS,
  fieldDefinitionByKey,
  matchDeliveryNoticeHeader,
  normalizeHeaderText,
} from './deliveryNoticeFieldDefinitions.js';

const DATE_RE = /\b\d{2}\/\d{2}\/\d{2}\b/;
const PACKING_RANGE_RE = /(\d{2}\/\d{2}\/\d{2})\s*[～~-]\s*(\d{2}\/\d{2}\/\d{2})/;
const CURRENCY_UNIT_RE = /\b([A-Z]{3})\/([A-Z]{1,8})\b/;
const WEIGHT_UNIT_RE = /\b(KG|KGS|KILOGRAMS?)\b/i;

export function parseDeliveryNoticeLayout(pages = [], { issueDate = '' } = {}) {
  const documentFields = extractDocumentFields(pages);
  const effectiveIssueDate = issueDate || documentFields.issuedDate?.value || '';
  const documentNotes = extractDocumentNotes(pages, effectiveIssueDate);
  const rows = [];
  const warnings = [];
  const pageLayouts = [];

  pages.forEach((page) => {
    const layout = detectTableLayout(page);
    pageLayouts.push(layout.summary);
    if (!layout.usable) {
      warnings.push(`ページ${page.pageNumber}: 表ヘッダーを十分に認識できませんでした。`);
      return;
    }

    const pageRows = reconstructRows(page, layout, { documentFields });
    if (pageRows.length === 0) {
      warnings.push(`ページ${page.pageNumber}: 明細行を安全に再構成できませんでした。`);
    }
    rows.push(...pageRows);
  });

  return {
    rows: rows.sort((left, right) => numericValue(left.fields.lineNumber) - numericValue(right.fields.lineNumber)),
    documentFields,
    documentNotes,
    warnings,
    layout: pageLayouts,
  };
}

function detectTableLayout(page) {
  const items = page.items || [];
  const pageWidth = page.width || inferPageWidth(items);
  const pageHeight = page.height || inferPageHeight(items);
  const candidates = items
    .map((item) => ({ ...item, columnX: item.x, match: matchDeliveryNoticeHeader(item.text) }))
    .filter((item) => item.match);
  const headerWindow = Math.max(32, pageHeight * 0.085);

  let headerItems = [];
  candidates.forEach((anchor) => {
    const group = candidates.filter((candidate) => Math.abs(candidate.y - anchor.y) <= headerWindow);
    if (distinctFieldCount(group) > distinctFieldCount(headerItems)) headerItems = group;
  });

  headerItems = chooseBestHeaderPerField(headerItems);
  const uniqueFields = new Set(headerItems.map((item) => item.match.field));
  const usable = uniqueFields.size >= 4 && (
    uniqueFields.has('lineNumber') || uniqueFields.has('contractNo') || uniqueFields.has('productName')
  );
  if (!usable) {
    return {
      usable: false,
      summary: { pageNumber: page.pageNumber, recognizedFields: [...uniqueFields], confidence: 'low' },
    };
  }

  const mergeTolerance = Math.max(10, pageWidth * 0.02);
  const columns = clusterColumns(headerItems, mergeTolerance, pageWidth);
  const anchorHeader = headerItems.find((item) => item.match.field === 'lineNumber')
    || headerItems.find((item) => item.match.field === 'productName')
    || headerItems[Math.floor(headerItems.length / 2)];
  const headerBottom = Math.min(...headerItems.map((item) => item.y));

  return {
    usable: true,
    pageWidth,
    pageHeight,
    headerItems,
    columns,
    anchorHeader,
    headerBottom,
    summary: {
      pageNumber: page.pageNumber,
      recognizedFields: [...uniqueFields],
      confidence: uniqueFields.size >= 8 ? 'high' : 'medium',
      columns: columns.map((column) => column.fields.map((item) => item.match.field)),
    },
  };
}

function reconstructRows(page, layout, context) {
  const items = page.items || [];
  const markerColumn = layout.columns.find((column) => column.fields.some((item) => item.match.field === 'lineNumber'));
  let anchors = [];

  if (markerColumn) {
    anchors = items
      .filter((item) => item.y < layout.headerBottom - 2)
      .filter((item) => inColumn(item, markerColumn))
      .filter((item) => /^\d{1,4}$/.test(item.text.trim()))
      .map((item) => ({ y: item.y, lineNumber: Number(item.text), sourceItem: item }));
  }

  if (anchors.length === 0) {
    anchors = inferRowAnchors(items, layout);
  }

  anchors = dedupeAnchors(anchors).sort((left, right) => right.y - left.y);
  if (anchors.length === 0) return [];

  const rowGap = median(anchors.slice(0, -1).map((anchor, index) => anchor.y - anchors[index + 1].y))
    || Math.max(24, layout.pageHeight * 0.06);

  return anchors.map((anchor, index) => {
    const top = index === 0 ? Math.min(layout.headerBottom - 1, anchor.y + rowGap / 2) : (anchors[index - 1].y + anchor.y) / 2;
    const bottom = index === anchors.length - 1 ? anchor.y - rowGap / 2 : (anchor.y + anchors[index + 1].y) / 2;
    const rowItems = items.filter((item) => item.y <= top && item.y > bottom);
    const fields = {};

    layout.headerItems.forEach((header) => {
      const key = header.match.field;
      const column = layout.columns.find((candidate) => candidate.fields.includes(header));
      const expectedY = anchor.y + (header.y - layout.anchorHeader.y);
      const verticalBounds = fieldVerticalBounds(column, header, anchor.y, layout.anchorHeader.y, top, bottom);
      const cellItems = rowItems
        .filter((item) => inColumn(item, column))
        .filter((item) => item.y <= verticalBounds.top && item.y > verticalBounds.bottom)
        .filter((item) => item !== anchor.sourceItem)
        .sort((left, right) => right.y - left.y || left.x - right.x);
      const rawValue = joinCellItems(cellItems);
      fields[key] = normalizeField(key, rawValue, {
        confidence: rawValue ? header.match.confidence : 'low',
        source: 'table-column',
        rowItems,
        expectedY,
      });
    });

    fields.lineNumber = extracted(anchor.lineNumber, 'high', 'row-boundary', String(anchor.lineNumber));
    applyDocumentFallbacks(fields, context.documentFields);
    applyRowSemanticValues(fields, rowItems);
    return { pageNumber: page.pageNumber, fields, warnings: buildRowWarnings(fields) };
  });
}

function fieldVerticalBounds(column, header, rowAnchorY, headerAnchorY, rowTop, rowBottom) {
  const positions = column.fields
    .map((item) => ({ item, y: rowAnchorY + (item.y - headerAnchorY) }))
    .sort((left, right) => right.y - left.y);
  const index = positions.findIndex((position) => position.item === header);
  return {
    top: index === 0 ? rowTop : (positions[index - 1].y + positions[index].y) / 2,
    bottom: index === positions.length - 1 ? rowBottom : (positions[index].y + positions[index + 1].y) / 2,
  };
}

function normalizeField(key, rawValue, context) {
  const raw = String(rawValue || '').trim();
  if (!raw) return extracted(null, 'low', context.source, raw);

  switch (key) {
    case 'lineNumber':
    case 'quantityPieces': {
      const match = raw.match(/\d[\d,]*/);
      return extracted(match ? Number(match[0].replace(/,/g, '')) : null, match ? context.confidence : 'low', context.source, raw);
    }
    case 'weightKg':
    case 'unitPrice': {
      const match = raw.match(/\d[\d,]*(?:\.\d+)?/);
      return extracted(match ? Number(match[0].replace(/,/g, '')) : null, match ? context.confidence : 'low', context.source, raw);
    }
    case 'contractNo': {
      const match = raw.match(/\b\d{5,}\b/);
      return extracted(match?.[0] || null, match ? context.confidence : 'low', context.source, raw);
    }
    case 'packingRange': {
      const match = raw.match(PACKING_RANGE_RE);
      return extracted(match ? { from: match[1], to: match[2] } : null, match ? context.confidence : 'low', context.source, raw);
    }
    case 'expiryDate':
    case 'customsClearancePlannedDate': {
      const match = raw.match(DATE_RE);
      return extracted(match?.[0] || null, match ? context.confidence : 'low', context.source, raw);
    }
    case 'brand':
      return extracted(normalizeBrand(raw), context.confidence, context.source, raw);
    case 'productName':
      return extracted(normalizeProductName(raw), context.confidence, context.source, raw);
    case 'originCountry':
      return extracted(normalizeCountry(raw), context.confidence, context.source, raw);
    case 'warehouse':
      return extracted(normalizeWarehouse(raw), context.confidence, context.source, raw);
    default:
      return extracted(raw, context.confidence, context.source, raw);
  }
}

function applyRowSemanticValues(fields, rowItems) {
  const texts = rowItems.map((item) => item.text.normalize('NFKC'));
  const currencyUnit = texts.map((text) => text.match(CURRENCY_UNIT_RE)).find(Boolean);
  const weightUnit = texts.map((text) => text.match(WEIGHT_UNIT_RE)).find(Boolean);
  fields.currency = extracted(currencyUnit?.[1] || null, currencyUnit ? 'high' : 'low', 'row-semantic', currencyUnit?.[0] || '');
  fields.priceUnit = extracted(currencyUnit?.[2] || null, currencyUnit ? 'high' : 'low', 'row-semantic', currencyUnit?.[0] || '');
  fields.weightUnit = extracted(normalizeWeightUnit(weightUnit?.[1] || currencyUnit?.[2]), weightUnit || currencyUnit ? 'high' : 'low', 'row-semantic', weightUnit?.[0] || currencyUnit?.[0] || '');

  const weight = fields.weightKg;
  if (
    weight?.source === 'table-column'
    && Number.isFinite(weight.value)
    && weightUnit
  ) {
    fields.weightKg = {
      ...weight,
      confidence: 'high',
      validation: 'numeric-with-recognized-weight-unit',
    };
  }
}

function applyDocumentFallbacks(fields, documentFields) {
  ['productType', 'originCountry', 'warehouse'].forEach((key) => {
    if (!fields[key]?.value && documentFields[key]?.value && documentFields[key].confidence === 'high') {
      fields[key] = { ...documentFields[key], source: 'document-label' };
    }
  });
}

function extractDocumentFields(pages) {
  const result = {};
  pages.forEach((page) => {
    const items = page.items || [];
    items.forEach((item) => {
      const inline = splitInlineLabel(item.text, DELIVERY_NOTICE_DOCUMENT_FIELD_DEFINITIONS);
      if (inline && !result[inline.field]) {
        result[inline.field] = extracted(normalizeDocumentValue(inline.field, inline.value), 'high', 'document-label-inline', item.text);
        return;
      }

      const match = matchDeliveryNoticeHeader(item.text, DELIVERY_NOTICE_DOCUMENT_FIELD_DEFINITIONS);
      if (!match || result[match.field]) return;
      const rightValue = items
        .filter((candidate) => candidate.x > item.x + item.width)
        .filter((candidate) => Math.abs(candidate.y - item.y) <= Math.max(item.height, 5))
        .sort((left, right) => left.x - right.x)[0];
      if (rightValue) {
        result[match.field] = extracted(
          normalizeDocumentValue(match.field, rightValue.text),
          match.confidence,
          'document-label-adjacent',
          rightValue.text,
        );
      }
    });
  });
  return result;
}

function splitInlineLabel(text, definitions) {
  const parts = String(text || '').split(/[:：]/, 2);
  if (parts.length !== 2 || !parts[1].trim()) return null;
  const match = matchDeliveryNoticeHeader(parts[0], definitions);
  return match ? { field: match.field, value: parts[1].trim() } : null;
}

function extractDocumentNotes(pages, issueDate) {
  const issueYear = String(issueDate || '').match(/^(\d{4})\//)?.[1];
  const notes = [];
  for (const page of pages) {
    for (const item of page.items || []) {
      const text = item.text.normalize('NFKC');
      const match = text.match(/(\d{1,2})\/(\d{1,2}).*(入庫|到着)/);
      if (match) {
        notes.push({
          type: 'warehouse-arrival',
          text: item.text,
          date: issueYear ? `${issueYear}/${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}` : null,
          confidence: issueYear ? 'medium' : 'low',
          source: 'document-note',
          pageNumber: page.pageNumber,
        });
      }
    }
  }
  return notes.filter((note, index) => notes.findIndex((candidate) => (
    candidate.type === note.type
    && candidate.text === note.text
    && candidate.date === note.date
  )) === index);
}

function inferRowAnchors(items, layout) {
  const primary = layout.headerItems.find((item) => item.match.field === 'contractNo')
    || layout.headerItems.find((item) => item.match.field === 'productName');
  if (!primary) return [];
  const column = layout.columns.find((candidate) => candidate.fields.includes(primary));
  return items
    .filter((item) => item.y < layout.headerBottom - 2 && inColumn(item, column))
    .map((item) => ({ y: item.y - (primary.y - layout.anchorHeader.y), lineNumber: 0, sourceItem: null }));
}

function clusterColumns(headerItems, tolerance, pageWidth) {
  const sorted = [...headerItems].sort((left, right) => left.columnX - right.columnX);
  const clusters = [];
  sorted.forEach((item) => {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(last.columnX - item.columnX) <= tolerance) {
      last.fields.push(item);
      last.columnX = average(last.fields.map((fieldItem) => fieldItem.columnX));
    } else {
      clusters.push({ columnX: item.columnX, fields: [item] });
    }
  });
  clusters.forEach((column, index) => {
    column.left = index === 0 ? 0 : (clusters[index - 1].columnX + column.columnX) / 2;
    column.right = index === clusters.length - 1 ? pageWidth : (column.columnX + clusters[index + 1].columnX) / 2;
  });
  return clusters;
}

function chooseBestHeaderPerField(items) {
  const byField = new Map();
  items.forEach((item) => {
    const current = byField.get(item.match.field);
    if (!current || confidenceRank(item.match.confidence) > confidenceRank(current.match.confidence)) {
      byField.set(item.match.field, item);
    }
  });
  return [...byField.values()];
}

function buildRowWarnings(fields) {
  const required = ['contractNo', 'productName', 'quantityPieces', 'weightKg', 'unitPrice'];
  return required.flatMap((key) => {
    if (fields[key]?.value !== null && fields[key]?.value !== undefined && fields[key]?.value !== '') return [];
    return [`${fieldDefinitionByKey(key)?.label || key}を取得できませんでした。`];
  });
}

function extracted(value, confidence, source, rawValue) {
  return { value, confidence, source, rawValue };
}

function joinCellItems(items) {
  return items.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim();
}

function inColumn(item, column) {
  return item.x >= column.left && item.x < column.right;
}

function distinctFieldCount(items) {
  return new Set(items.map((item) => item.match.field)).size;
}

function dedupeAnchors(anchors) {
  const result = [];
  anchors.forEach((anchor) => {
    if (!result.some((existing) => Math.abs(existing.y - anchor.y) < 2)) result.push(anchor);
  });
  return result;
}

function normalizeBrand(value) {
  const text = value.trim();
  return text.replace(/\b([A-Z])\.([A-Z]{2,})\b/g, (match, first, rest) => `${first}.${rest.charAt(0)}${rest.slice(1).toLowerCase()}`);
}

function normalizeProductName(value) {
  const text = value.trim();
  const letters = text.match(/[A-Za-z]/g) || [];
  const uppercaseRatio = letters.length
    ? letters.filter((letter) => letter === letter.toUpperCase()).length / letters.length
    : 0;
  if (text && uppercaseRatio >= 0.8) {
    const lower = text.toLocaleLowerCase('en-US');
    return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
  }
  return text;
}

function normalizeCountry(value) {
  return value.normalize('NFKC').trim();
}

function normalizeWarehouse(value) {
  return value.normalize('NFKC').replace(/(?:\(株\)|株式会社)/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeWeightUnit(value) {
  const unit = String(value || '').toUpperCase();
  return ['KG', 'KGS', 'KILOGRAM', 'KILOGRAMS'].includes(unit) ? 'KG' : unit || null;
}

function normalizeDocumentValue(field, value) {
  const text = String(value || '').trim();
  if (field === 'originCountry') return normalizeCountry(text);
  if (field === 'warehouse') return normalizeWarehouse(text);
  return text;
}

function numericValue(field) {
  return Number(field?.value || 0);
}

function inferPageWidth(items) {
  return Math.max(1, ...items.map((item) => item.x + item.width));
}

function inferPageHeight(items) {
  return Math.max(1, ...items.map((item) => item.y + item.height));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function confidenceRank(value) {
  return { low: 1, medium: 2, high: 3 }[value] || 0;
}
