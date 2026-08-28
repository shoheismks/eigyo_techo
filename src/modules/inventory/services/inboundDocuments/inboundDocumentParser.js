import { extractPdfText } from '../deliveryNoticePdfParser.js';
import { classifyInboundDocument } from './documentClassifier.js';
import { deliveryNoticeAdapter } from './deliveryNoticeAdapter.js';
import { productPriceListAdapter } from './productPriceListAdapter.js';
import { createNormalizedDocument } from './normalizedInboundDocument.js';

const ADAPTERS = new Map([
  [deliveryNoticeAdapter.documentType, deliveryNoticeAdapter],
  [productPriceListAdapter.documentType, productPriceListAdapter],
]);

export async function parseInboundDocumentFile(file) {
  if (!file) throw new Error('PDFファイルを選択してください。');
  const data = new Uint8Array(await file.arrayBuffer());
  const [fileHash, extraction] = await Promise.all([sha256Hex(data), extractPdfText(data)]);
  const classification = classifyInboundDocument(extraction);
  const adapter = ADAPTERS.get(classification.documentType);

  if (!adapter) {
    return {
      classification,
      normalizedDocument: createNormalizedDocument({
        documentType: classification.documentType,
        fileName: file.name,
        fileHash,
        fileSize: file.size,
        pageCount: extraction.pageCount,
        classification,
        warnings: [classification.documentType === 'warehouse_receipt_candidate'
          ? '画像PDFの可能性があります。OCR対応は次のStepで実装します。'
          : '対応する書類parserがありません。'],
        rawText: extraction.text,
      }),
      preview: null,
    };
  }

  const result = await adapter.parse({ file, extraction, fileHash, classification });
  const normalizedDocument = result.normalizedDocument;
  return {
    classification,
    normalizedDocument,
    preview: classification.documentType === 'delivery_notice'
      ? augmentDeliveryPreview(result.legacyPreview, classification, normalizedDocument)
      : materializePriceListPreview(normalizedDocument),
  };
}

function augmentDeliveryPreview(preview, classification, normalizedDocument) {
  return { ...preview, documentType: 'delivery_notice', classification, normalizedDocument };
}

function materializePriceListPreview(document) {
  const value = (field) => field?.value ?? '';
  return {
    documentType: 'product_price_list',
    classification: document.classification,
    normalizedDocument: document,
    fileName: document.fileName,
    fileHash: document.fileHash,
    fileSize: document.fileSize,
    pageCount: document.pageCount,
    issueDate: '',
    documentNumber: value(document.fields.documentNumber),
    supplier: '',
    warnings: document.warnings,
    lines: document.lines.map((line) => ({
      id: line.id,
      lineNumber: value(line.lineNumber),
      productCode: value(line.productCode),
      productName: value(line.productName),
      baseUnitPrice: value(line.baseUnitPrice),
      coefficient: value(line.coefficient),
      additionalCost: value(line.additionalCost),
      billedUnitPrice: value(line.billedUnitPrice),
      currency: value(line.currency),
      priceUnit: value(line.priceUnit),
      warnings: line.warnings || [],
      fieldMeta: line,
    })),
    rawText: document.rawText,
  };
}
async function sha256Hex(data) {
  if (!globalThis.crypto?.subtle) return '';
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
