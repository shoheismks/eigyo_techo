import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { parseDeliveryNoticeLayout } from './deliveryNoticeLayoutParser.js';

const PDFJS_ASSET_BASE = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/`;
const CMAP_URL = `${PDFJS_ASSET_BASE}cmaps/`;
const STANDARD_FONT_DATA_URL = `${PDFJS_ASSET_BASE}standard_fonts/`;

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

const FULL_DATE_RE = /\d{4}\/\d{2}\/\d{2}\s+\d{1,2}:\d{2}/;
const SHORT_DATE_RE = /^\d{2}\/\d{2}\/\d{2}$/;

export async function parseDeliveryNoticePdfFile(file) {
  if (!file) {
    throw new Error('PDFファイルを選択してください。');
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const [fileHash, extraction] = await Promise.all([
    sha256Hex(data),
    extractPdfText(data),
  ]);

  return parseDeliveryNoticeText({
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
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent({ normalizeWhitespace: true });
    const items = content.items
      .map((item, index) => ({
        index,
        text: String(item.str || '').trim(),
        x: Number(item.transform?.[4] || 0),
        y: Number(item.transform?.[5] || 0),
        width: Number(item.width || 0),
        height: Number(item.height || 0),
      }))
      .filter((item) => item.text);
    const lines = items.map((item) => item.text);
    pages.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      lines,
      text: lines.join('\n'),
      items,
    });
  }

  return {
    pageCount: pdf.numPages,
    text: pages.map((page) => page.text).join('\n'),
    pages,
  };
}

export function parseDeliveryNoticeText({
  fileName = '',
  fileHash = '',
  fileSize = 0,
  pageCount = 0,
  text = '',
  pages = [],
} = {}) {
  const lines = splitLines(text);
  const warnings = [];
  const extractedIssueDate = firstMatch(lines, FULL_DATE_RE);
  const layoutResult = parseDeliveryNoticeLayout(pages, { issueDate: extractedIssueDate });
  const issueDate = extractedIssueDate || layoutResult.documentFields.issuedDate?.value || '';
  const documentNumber = layoutResult.documentFields.documentNumber?.value || findDocumentNumber(lines);
  const supplier = layoutResult.documentFields.supplier?.value || findSupplierCandidate(lines);

  if (!issueDate) warnings.push('発行日を取得できませんでした。');
  if (!documentNumber) warnings.push('帳票番号を取得できませんでした。');
  if (!supplier) warnings.push('仕入先を取得できませんでした。');

  const detailLines = layoutResult.rows.map((row, index) => materializeCommonLine(row, index));
  warnings.push(...layoutResult.warnings);
  if (detailLines.length === 0) {
    warnings.push('明細行を取得できませんでした。PDFの表構造を確認してください。');
  }

  return {
    template: 'delivery_notice_layout_v1',
    fileName,
    fileHash,
    fileSize,
    pageCount,
    issueDate,
    documentNumber,
    supplier,
    lines: detailLines,
    warnings,
    documentFields: layoutResult.documentFields,
    documentNotes: layoutResult.documentNotes,
    layout: layoutResult.layout,
    rawText: text,
    pages,
  };
}

function materializeCommonLine(row, index) {
  const fields = row.fields || {};
  const value = (key) => fields[key]?.value ?? '';
  const packing = value('packingRange') || {};
  const lineNumber = Number(value('lineNumber') || index + 1);
  const contractNo = String(value('contractNo') || '');

  return {
    id: `${contractNo || 'line'}-${lineNumber}`,
    lineNumber,
    contractNo,
    brand: value('brand'),
    productName: value('productName'),
    productType: value('productType'),
    pieceCount: value('quantityPieces'),
    weight: value('weightKg'),
    unit: value('weightUnit'),
    unitPrice: value('unitPrice'),
    currency: value('currency'),
    priceUnit: value('priceUnit'),
    originCountry: value('originCountry'),
    factoryNo: value('plantNo'),
    customsClearancePlannedDate: normalizeShortDate(value('customsClearancePlannedDate')),
    packingFrom: normalizeShortDate(packing.from),
    packingTo: normalizeShortDate(packing.to),
    expiryDate: normalizeShortDate(value('expiryDate')),
    warehouse: value('warehouse'),
    warnings: row.warnings || [],
    fieldMeta: fields,
  };
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

function findSupplierCandidate(lines) {
  return lines.find((line) => /(?:株式会社|有限会社|\b(?:Co\.?|Ltd\.?|Inc\.?)\b)/i.test(line)) || '';
}

function normalizeShortDate(value) {
  const text = String(value || '').trim();
  if (!SHORT_DATE_RE.test(text)) return text;
  const [year, month, day] = text.split('/');
  return `20${year}/${month}/${day}`;
}

async function sha256Hex(data) {
  if (!globalThis.crypto?.subtle) return '';
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
