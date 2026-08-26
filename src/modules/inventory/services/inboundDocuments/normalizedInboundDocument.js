export function createNormalizedField(
  value,
  {
    confidence = value === null || value === undefined || value === '' ? 'low' : 'high',
    source = 'unknown',
    rawValue = value === null || value === undefined ? '' : String(value),
    sourceDocumentType = 'unknown',
  } = {},
) {
  return { value, confidence, source, rawValue, sourceDocumentType };
}

export function createNormalizedDocument({
  documentType = 'unknown',
  fileName = '',
  fileHash = '',
  fileSize = 0,
  pageCount = 0,
  classification = null,
  fields = {},
  lines = [],
  warnings = [],
  rawText = '',
  source = {},
} = {}) {
  return {
    schemaVersion: 'inbound_document_v1',
    documentType,
    fileName,
    fileHash,
    fileSize,
    pageCount,
    classification,
    fields,
    lines,
    warnings,
    rawText,
    source,
  };
}

export function normalizedFieldValue(field, fallback = '') {
  return field?.value ?? fallback;
}
