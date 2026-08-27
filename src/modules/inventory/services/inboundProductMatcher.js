function text(value) {
  return String(value ?? '').trim();
}

function comparable(value) {
  return text(value).normalize('NFKC').toLocaleLowerCase('ja-JP');
}

export function inboundProductCode(value) {
  return text(value);
}

function productCode(product) {
  return inboundProductCode(product?.productCode ?? product?.product_code);
}

function activeProducts(products) {
  return (products || []).filter((product) => product && !product.deletedAt && !product.deleted_at);
}

function fieldDifferences(line, product) {
  const pairs = [
    ['商品名', line.productName, product.name],
    ['ブランド', line.brand, product.brandName ?? product.brand_name],
    ['原産国', line.originCountry, product.origin],
    ['カテゴリ', line.productType ?? line.category, product.category],
  ];

  return pairs
    .filter(([, imported, registered]) => text(imported) && text(registered) && comparable(imported) !== comparable(registered))
    .map(([label, imported, registered]) => ({ label, imported: text(imported), registered: text(registered) }));
}

export function matchInboundProduct(line, products = []) {
  const code = inboundProductCode(line?.productCode ?? line?.product_code);
  if (!code) {
    return {
      productMatchStatus: 'review', matchedProductId: '', matchedProduct: null,
      productMatchCandidates: [], productMatchDifferences: [],
      productMatchMessage: '商品コードがないため確認が必要です。',
    };
  }

  const candidates = activeProducts(products).filter((product) => productCode(product) === code);
  if (candidates.length === 1) {
    const matchedProduct = candidates[0];
    const differences = fieldDifferences(line, matchedProduct);
    return {
      productMatchStatus: 'matched', matchedProductId: matchedProduct.id, matchedProduct,
      productMatchCandidates: candidates, productMatchDifferences: differences,
      productMatchMessage: differences.length ? '帳票と商品マスタに差異があります。商品マスタは更新しません。' : '',
    };
  }

  if (candidates.length > 1) {
    return {
      productMatchStatus: 'review', matchedProductId: '', matchedProduct: null,
      productMatchCandidates: candidates, productMatchDifferences: [],
      productMatchMessage: '同じ商品コードの候補が複数あるため確認が必要です。',
    };
  }

  return {
    productMatchStatus: 'unmatched', matchedProductId: '', matchedProduct: null,
    productMatchCandidates: [], productMatchDifferences: [], productMatchMessage: '商品マスタに未登録です。',
  };
}

export function matchInboundPreview(preview, products = []) {
  if (!preview) return preview;
  return { ...preview, lines: (preview.lines || []).map((line) => ({ ...line, ...matchInboundProduct(line, products) })) };
}

export function productMatchStatusLabel(status) {
  return { matched: '照合済み', unmatched: '未登録商品', review: '要確認' }[status] || '要確認';
}
