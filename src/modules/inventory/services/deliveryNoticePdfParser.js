import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

const PDFJS_ASSET_BASE = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/`;
const CMAP_URL = `${PDFJS_ASSET_BASE}cmaps/`;
const STANDARD_FONT_DATA_URL = `${PDFJS_ASSET_BASE}standard_fonts/`;

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

const DATE_RE = /^\d{2}\/\d{2}\/\d{2}$/;
const FULL_DATE_RE = /\d{4}\/\d{2}\/\d{2}\s+\d{1,2}:\d{2}/;
const CONTRACT_RE = /^\d{7,}$/;
const INTEGER_RE = /^\d+$/;
const DECIMAL_RE = /^\d+(?:\.\d+)?$/;
const PRICE_RE = /^\d{1,3}(?:,\d{3})*(?:\.\d+)?$/;
const CURRENCY_UNIT_RE = /^[A-Z]{3}\/[A-Z]+$/;
const PACKING_RANGE_RE = /^\d{2}\/\d{2}\/\d{2}\s*[～~-]\s*\d{2}\/\d{2}\/\d{2}$/;

export async function parseDeliveryNoticePdfFile(file) {
  if (!file) {
    throw new Error('PDFファイルを選択してください。');
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const [fileHash, extraction] = await Promise.all([
    sha256Hex(data),
    extractPdfText(data),
  ]);

  return parseNipponSteelDeliveryNoticeText({
    ...extraction,
    fileName: file.name,
    fileHash,
    fileSize: file.size,
  });
}

export async function extractPdfText(data) {
  const pdf = await pdfjsLib.getDocument({
    data,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    useWorkerFetch: false,
  }).promise;

  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent({ normalizeWhitespace: true });
    const lines = content.items
      .map((item) => String(item.str || '').trim())
      .filter(Boolean);
    pages.push({ pageNumber, lines, text: lines.join('\n') });
  }

  return {
    pageCount: pdf.numPages,
    text: pages.map((page) => page.text).join('\n'),
    pages,
  };
}

export function parseNipponSteelDeliveryNoticeText({
  fileName = '',
  fileHash = '',
  fileSize = 0,
  pageCount = 0,
  text = '',
  pages = [],
} = {}) {
  const lines = splitLines(text);
  const warnings = [];
  const issueDate = firstMatch(lines, FULL_DATE_RE);
  const documentNumber = findDocumentNumber(lines);
  const supplier = lines.find((line) => line.includes('日鉄物産')) || '';

  if (!issueDate) warnings.push('発行日を取得できませんでした。');
  if (!documentNumber) warnings.push('帳票番号を取得できませんでした。');
  if (!supplier) warnings.push('仕入先を取得できませんでした。');

  const detailLines = parseDetailLines(lines);
  if (detailLines.length === 0) {
    warnings.push('明細行を取得できませんでした。PDFの表構造を確認してください。');
  }

  return {
    template: 'nippon_steel_delivery_notice',
    fileName,
    fileHash,
    fileSize,
    pageCount,
    issueDate,
    documentNumber,
    supplier,
    lines: detailLines,
    warnings,
    rawText: text,
    pages,
  };
}

function parseDetailLines(lines) {
  const contractIndexes = findIndexes(lines, (line) => CONTRACT_RE.test(line));
  const contractNos = contractIndexes.map((index) => lines[index]);
  const rowCount = contractNos.length;
  if (rowCount === 0) return [];

  let cursor = contractIndexes[contractIndexes.length - 1] + 1;
  const brands = take(lines, cursor, rowCount);
  cursor += brands.length;
  const pieceNumbers = takeMatching(lines, cursor, rowCount, INTEGER_RE);
  cursor += pieceNumbers.length;
  cursor += skipMatching(lines, cursor, 1, INTEGER_RE);
  const origins = take(lines, cursor + rowCount, rowCount);
  cursor += rowCount * 2;
  const customsDates = takeMatching(lines, cursor, rowCount, DATE_RE);
  cursor += customsDates.length;
  const factoryNos = takeMatching(lines, cursor, rowCount, INTEGER_RE);
  cursor += factoryNos.length;
  const rowNumbers = takeMatching(lines, cursor, rowCount, INTEGER_RE);
  cursor += rowNumbers.length;

  const totalIndex = lines.findIndex((line, index) => index >= cursor && line === '【');
  const beforeTotal = totalIndex >= 0 ? lines.slice(cursor, totalIndex) : lines.slice(cursor);
  const productNames = beforeTotal
    .filter((line) => /[A-Z]/.test(line) && !DATE_RE.test(line) && !INTEGER_RE.test(line))
    .slice(-rowCount);

  cursor = totalIndex >= 0 ? totalIndex : cursor + beforeTotal.length;
  while (cursor < lines.length && !DECIMAL_RE.test(lines[cursor])) cursor += 1;
  const weights = takeMatching(lines, cursor, rowCount, DECIMAL_RE);
  cursor += weights.length;
  cursor += skipMatching(lines, cursor, 1, DECIMAL_RE);
  const units = takeMatching(lines, cursor, rowCount, /^[A-Z]{2,5}$/);
  cursor += units.length;
  cursor += skipMatching(lines, cursor, 1, /^[A-Z]{2,5}$/);
  const unitPrices = takeMatching(lines, cursor, rowCount, PRICE_RE);
  cursor += unitPrices.length;
  const packingRanges = takeMatching(lines, cursor, rowCount, PACKING_RANGE_RE);
  cursor += packingRanges.length;
  const expiryDates = takeMatching(lines, cursor, rowCount, DATE_RE);
  cursor += expiryDates.length;
  const currencyUnits = takeMatching(lines, cursor, rowCount, CURRENCY_UNIT_RE);
  cursor += currencyUnits.length;
  const warehouses = take(lines, cursor, rowCount);

  return Array.from({ length: rowCount }, (_, index) => {
    const [packingFrom = '', packingTo = ''] = String(packingRanges[index] || '').split(/[～~-]/).map((value) => value.trim());
    const [currency = '', priceUnit = ''] = String(currencyUnits[index] || '').split('/');
    const line = {
      id: `${contractNos[index] || 'line'}-${index + 1}`,
      lineNumber: Number(rowNumbers[index] || index + 1),
      contractNo: contractNos[index] || '',
      brand: brands[index] || '',
      productName: productNames[index] || '',
      pieceCount: parseNumeric(pieceNumbers[index]),
      weight: parseNumeric(weights[index]),
      unit: units[index] || priceUnit || '',
      unitPrice: parseNumeric(unitPrices[index]),
      currency,
      originCountry: origins[index] || '',
      factoryNo: factoryNos[index] || '',
      customsClearancePlannedDate: normalizeShortDate(customsDates[index]),
      packingFrom: normalizeShortDate(packingFrom),
      packingTo: normalizeShortDate(packingTo),
      expiryDate: normalizeShortDate(expiryDates[index]),
      warehouse: warehouses[index] || '',
      warnings: [],
    };

    addMissingWarnings(line);
    return line;
  });
}

function addMissingWarnings(line) {
  [
    ['contractNo', '契約No'],
    ['brand', 'ブランド'],
    ['productName', '商品名'],
    ['pieceCount', '個数'],
    ['weight', '重量'],
    ['unitPrice', '単価'],
    ['customsClearancePlannedDate', '通関予定日'],
    ['packingFrom', 'Packing From'],
    ['packingTo', 'Packing To'],
    ['expiryDate', '賞味期限'],
    ['warehouse', '倉庫'],
  ].forEach(([key, label]) => {
    if (line[key] === '' || line[key] === null || line[key] === undefined) {
      line.warnings.push(`${label}を取得できませんでした。`);
    }
  });
}

function splitLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function firstMatch(lines, pattern) {
  for (const line of lines) {
    const match = line.match(pattern);
    if (match) return match[0];
  }
  return '';
}

function findDocumentNumber(lines) {
  const pageMarkerIndex = lines.findIndex((line) => /^\d+\/\s*\d+$/.test(line));
  if (pageMarkerIndex > 0) {
    const candidate = lines[pageMarkerIndex - 1];
    if (/^[A-Z0-9 -]+$/.test(candidate)) return candidate;
  }
  return lines.find((line) => /^\d{3,}\s+[A-Z0-9-]+$/.test(line)) || '';
}

function findIndexes(lines, predicate) {
  return lines.reduce((indexes, line, index) => {
    if (predicate(line)) indexes.push(index);
    return indexes;
  }, []);
}

function take(lines, start, count) {
  return lines.slice(start, start + count);
}

function takeMatching(lines, start, count, pattern) {
  const values = [];
  for (let index = start; index < lines.length && values.length < count; index += 1) {
    if (pattern.test(lines[index])) values.push(lines[index]);
  }
  return values;
}

function skipMatching(lines, start, count, pattern) {
  let skipped = 0;
  for (let index = start; index < lines.length && skipped < count; index += 1) {
    if (!pattern.test(lines[index])) break;
    skipped += 1;
  }
  return skipped;
}

function parseNumeric(value) {
  if (value === '' || value === null || value === undefined) return '';
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : '';
}

function normalizeShortDate(value) {
  const text = String(value || '').trim();
  if (!DATE_RE.test(text)) return text;
  const [year, month, day] = text.split('/');
  return `20${year}/${month}/${day}`;
}

async function sha256Hex(data) {
  if (!globalThis.crypto?.subtle) return '';
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
