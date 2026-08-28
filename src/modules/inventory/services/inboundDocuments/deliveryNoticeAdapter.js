import { parseDeliveryNoticePdfFile } from '../deliveryNoticePdfParser.js';
import { createNormalizedDocument, createNormalizedField } from './normalizedInboundDocument.js';

export const deliveryNoticeAdapter = {
  documentType: 'delivery_notice',
  async parse({ file, classification }) {
    const legacyPreview = await parseDeliveryNoticePdfFile(file);
    const normalizedDocument = normalizeDeliveryNotice(legacyPreview, classification);
    return { legacyPreview, normalizedDocument };
  },
};

function normalizeDeliveryNotice(preview, classification) {
  const type = 'delivery_notice';
  const warehouseArrivalNote = preview.documentNotes?.find((note) => note.type === 'warehouse-arrival');
  const documentField = (value, source = 'delivery-notice-parser') => createNormalizedField(value || null, {
    confidence: value ? 'high' : 'low',
    source,
    rawValue: value || '',
    sourceDocumentType: type,
  });

  return createNormalizedDocument({
    documentType: type,
    fileName: preview.fileName,
    fileHash: preview.fileHash,
    fileSize: preview.fileSize,
    pageCount: preview.pageCount,
    classification,
    fields: {
      documentNumber: documentField(preview.documentNumber),
      supplierName: documentField(preview.supplier),
      issuedAt: documentField(preview.issueDate),
      warehouseArrivalDate: createNormalizedField(warehouseArrivalNote?.date || null, {
        confidence: warehouseArrivalNote?.confidence || 'low',
        source: warehouseArrivalNote?.source || 'document-note',
        rawValue: warehouseArrivalNote?.text || '',
        sourceDocumentType: type,
      }),
    },
    lines: preview.lines.map((line) => ({
      id: line.id,
      lineNumber: createFieldFromMeta(line.lineNumber, line.fieldMeta?.lineNumber, type),
      contractNo: createFieldFromMeta(line.contractNo, line.fieldMeta?.contractNo, type),
      brandName: createFieldFromMeta(line.brand, line.fieldMeta?.brand, type),
      productName: createFieldFromMeta(line.productName, line.fieldMeta?.productName, type),
      quantityPieces: createFieldFromMeta(line.pieceCount, line.fieldMeta?.quantityPieces, type),
      totalWeightKg: createFieldFromMeta(line.weight, line.fieldMeta?.weightKg, type),
      unitPrice: createFieldFromMeta(line.unitPrice, line.fieldMeta?.unitPrice, type),
      currency: createFieldFromMeta(line.currency, line.fieldMeta?.currency, type),
      priceUnit: createFieldFromMeta(line.priceUnit, line.fieldMeta?.priceUnit, type),
      productType: createFieldFromMeta(line.productType, line.fieldMeta?.productType, type),
      originCountry: createFieldFromMeta(line.originCountry, line.fieldMeta?.originCountry, type),
      plantNo: createFieldFromMeta(line.factoryNo, line.fieldMeta?.plantNo, type),
      customsClearancePlannedDate: createFieldFromMeta(line.customsClearancePlannedDate, line.fieldMeta?.customsClearancePlannedDate, type),
      packingFrom: createFieldFromMeta(line.packingFrom, line.fieldMeta?.packingRange, type),
      packingTo: createFieldFromMeta(line.packingTo, line.fieldMeta?.packingRange, type),
      expiryDate: createFieldFromMeta(line.expiryDate, line.fieldMeta?.expiryDate, type),
      warehouseName: createFieldFromMeta(line.warehouse, line.fieldMeta?.warehouse, type),
      warnings: line.warnings || [],
    })),
    warnings: preview.warnings,
    rawText: preview.rawText,
    source: { template: preview.template, documentNotes: preview.documentNotes, layout: preview.layout },
  });
}

function createFieldFromMeta(value, meta, sourceDocumentType) {
  return createNormalizedField(value === '' ? null : value, {
    confidence: meta?.confidence || (value === '' ? 'low' : 'high'),
    source: meta?.source || 'delivery-notice-parser',
    rawValue: meta?.rawValue ?? (value === null || value === undefined ? '' : String(value)),
    sourceDocumentType,
  });
}
