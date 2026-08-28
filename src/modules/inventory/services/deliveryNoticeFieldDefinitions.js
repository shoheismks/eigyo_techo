export const DELIVERY_NOTICE_FIELD_DEFINITIONS = [
  field('lineNumber', '行番号', ['No', 'No.', '行', '行番号', 'Line', 'Line No']),
  field('contractNo', '契約No', ['契約NO', '契約No', '契約番号', 'Contract No', 'Contract No.', 'Contract Number']),
  field('brand', 'ブランド', ['ブランド', 'Brand', 'Brand Name']),
  field('productName', '商品名', ['商品', '商品名', '品名', 'Description', 'Product', 'Product Name']),
  field('quantityPieces', '個数', ['個数', '個 数', '数量(個)', 'Qty', 'QTY', 'Quantity', 'Pieces', 'Cases']),
  field('weightKg', '重量', [
    '重量', 'Weight', 'NET WT', 'Net Weight', 'KG', 'KGS',
    { text: '数量', confidence: 'medium' },
    { text: '数 量', confidence: 'medium' },
  ]),
  field('unitPrice', '単価', ['単価', '単 価', 'Price', 'Unit Price', 'JPY/KG']),
  field('productType', '種別', ['種別', 'Category', 'Type', 'Product Type']),
  field('originCountry', '原産国', ['原産国', '原産地', 'Country of Origin', 'Origin Country', 'Origin']),
  field('plantNo', '工場No', ['工場NO', '工場No', '工場番号', 'Plant No', 'Plant No.', 'Establishment No', 'Factory No']),
  field('customsClearancePlannedDate', '通関予定日', ['通関予定', '通関予定日', 'Customs Date', 'Customs Clearance', 'ETA']),
  field('packingRange', 'パッキング日', [
    'Packing', 'Packing Date', 'Pack Date', '製造日', 'パッキング予定From/To', 'ﾊﾟｯｷﾝｸﾞ予定From/To',
  ]),
  field('expiryDate', '賞味期限', ['賞味期限', 'Expiry', 'Expiry Date', 'Best Before', 'Use By']),
  field('warehouse', '倉庫', ['倉庫', '保管倉庫', 'Warehouse', 'Storage Location']),
];

export const DELIVERY_NOTICE_DOCUMENT_FIELD_DEFINITIONS = [
  field('supplier', '仕入先', ['仕入先', 'Supplier', 'Vendor', 'Shipper']),
  field('issuedDate', '発行日', ['発行日', 'Issued Date', 'Issue Date', 'Date']),
  field('documentNumber', '帳票番号', ['帳票番号', 'Document No', 'Document No.', 'Notice No', 'Reference No']),
  field('productType', '種別', ['種別', 'Category', 'Product Type']),
  field('originCountry', '原産国', ['原産国', 'Country of Origin', 'Origin Country']),
  field('warehouse', '倉庫', ['倉庫', 'Warehouse', 'Storage Location']),
];

export function normalizeHeaderText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\s:：._-]+/g, '')
    .trim();
}

export function matchDeliveryNoticeHeader(value, definitions = DELIVERY_NOTICE_FIELD_DEFINITIONS) {
  const normalized = normalizeHeaderText(value);
  if (!normalized) return null;

  let best = null;
  definitions.forEach((definition) => {
    definition.aliases.forEach((alias) => {
      if (alias.normalized !== normalized) return;
      if (!best || confidenceRank(alias.confidence) > confidenceRank(best.confidence)) {
        best = {
          field: definition.key,
          label: definition.label,
          confidence: alias.confidence,
          matchedAlias: alias.text,
        };
      }
    });
  });
  return best;
}

export function fieldDefinitionByKey(key) {
  return DELIVERY_NOTICE_FIELD_DEFINITIONS.find((definition) => definition.key === key) || null;
}

function field(key, label, aliases) {
  return {
    key,
    label,
    aliases: aliases.map((alias) => {
      const entry = typeof alias === 'string' ? { text: alias, confidence: 'high' } : alias;
      return { ...entry, normalized: normalizeHeaderText(entry.text) };
    }),
  };
}

function confidenceRank(value) {
  return { low: 1, medium: 2, high: 3 }[value] || 0;
}
