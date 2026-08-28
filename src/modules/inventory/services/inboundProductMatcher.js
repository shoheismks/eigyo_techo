import {
  normalizeProductAliasText,
  normalizeSupplierProductCode,
} from '../../products/services/productAliasNormalization.js';

const text = (value) => String(value ?? '').trim();
const activeProducts = (products) => (products || []).filter((item) => item && !item.deletedAt && !item.deleted_at);
const activeAliases = (aliases) => (aliases || []).filter((item) => item && (item.isActive ?? item.is_active ?? true));
const productCode = (product) => inboundProductCode(product?.productCode ?? product?.product_code);
const aliasProductId = (alias) => alias?.productId ?? alias?.product_id ?? '';
const aliasSupplierId = (alias) => alias?.supplierId ?? alias?.supplier_id ?? '';
const aliasSupplierName = (alias) => alias?.supplierNameSnapshot ?? alias?.supplier_name_snapshot ?? '';
const supplierName = (supplier) => supplier?.name ?? supplier?.companyName ?? supplier?.company_name ?? '';

export function inboundProductCode(value) {
  return normalizeSupplierProductCode(value);
}

function aliasName(alias) {
  return alias?.normalizedAlias ?? alias?.normalized_alias ??
    normalizeProductAliasText(alias?.aliasName ?? alias?.alias_name);
}

function aliasSupplierCode(alias) {
  return alias?.normalizedSupplierProductCode ?? alias?.normalized_supplier_product_code ??
    normalizeSupplierProductCode(alias?.supplierProductCode ?? alias?.supplier_product_code);
}

export function resolveInboundSupplierContext(line = {}, suppliers = [], options = {}) {
  const requestedId = text(line.supplierId ?? line.supplier_id ?? options.supplierId);
  const requestedName = text(line.supplierName ?? line.supplier_name ?? line.supplier ?? options.supplierName);
  const available = (suppliers || []).filter((item) => item && !item.deletedAt && !item.deleted_at);

  if (requestedId) {
    const matches = available.filter((supplier) => supplier.id === requestedId);
    return matches.length === 1
      ? { status: 'resolved', supplierId: requestedId, supplierName: supplierName(matches[0]), supplier: matches[0] }
      : { status: 'ambiguous', supplierId: '', supplierName: requestedName, supplier: null, reason: 'supplier_id_not_unique' };
  }
  if (!requestedName) return { status: 'global', supplierId: '', supplierName: '', supplier: null };

  const normalized = normalizeProductAliasText(requestedName);
  const matches = available.filter((supplier) => normalizeProductAliasText(supplierName(supplier)) === normalized);
  if (matches.length === 1) {
    return { status: 'resolved', supplierId: matches[0].id, supplierName: supplierName(matches[0]), supplier: matches[0] };
  }
  return {
    status: 'ambiguous', supplierId: '', supplierName: requestedName, supplier: null,
    reason: matches.length > 1 ? 'supplier_name_not_unique' : 'supplier_not_found',
  };
}

function aliasContext(alias) {
  if (text(aliasSupplierId(alias))) return { type: 'supplier_id', value: text(aliasSupplierId(alias)) };
  if (text(aliasSupplierName(alias))) {
    return { type: 'supplier_name', value: normalizeProductAliasText(aliasSupplierName(alias)) };
  }
  return { type: 'global', value: '' };
}

function supplierAliasMatches(alias, context) {
  if (context.status !== 'resolved') return false;
  const aliasScope = aliasContext(alias);
  if (aliasScope.type === 'supplier_id') return aliasScope.value === context.supplierId;
  if (aliasScope.type === 'supplier_name') {
    return aliasScope.value === normalizeProductAliasText(context.supplierName);
  }
  return false;
}

function nameAliasMatchesContext(alias, context) {
  return aliasContext(alias).type === 'global' || supplierAliasMatches(alias, context);
}

function fieldDifferences(line, product) {
  const pairs = [
    ['productName', '商品名', line.productName ?? line.productNameRaw, product.name],
    ['brand', 'ブランド', line.brand ?? line.brandNameRaw, product.brandName ?? product.brand_name],
    ['origin', '原産国', line.originCountry ?? line.origin_country, product.origin],
    ['category', 'カテゴリ', line.productType ?? line.category, product.category],
  ];
  return pairs
    .filter(([, , imported, registered]) => text(imported) && text(registered) &&
      normalizeProductAliasText(imported) !== normalizeProductAliasText(registered))
    .map(([field, label, imported, registered]) => ({
      field, label, imported: text(imported), registered: text(registered),
    }));
}

const candidate = (product, score, differences = []) => ({
  productId: product.id, product, score: Math.round(score * 100), differences,
});

function matchResult({ status, source = 'none', product = null, alias = null, candidates = [], differences = [], message = '' }) {
  return {
    productMatchStatus: status,
    productMatchSource: source,
    matchedProductId: product?.id || '',
    matchedProduct: product,
    matchedAliasId: alias?.id || '',
    candidates,
    differences,
    message,
    productMatchCandidates: candidates.map((item) => item.product ?? item),
    productMatchDifferences: differences,
    productMatchMessage: message,
  };
}

function resolveAliasMatches(matches, productsById, source, line) {
  if (!matches.length) return null;
  const resolved = matches.map((alias) => ({ alias, product: productsById.get(aliasProductId(alias)) || null }));
  const targets = new Set(resolved.map(({ alias, product }) => product?.id || `missing:${aliasProductId(alias)}`));
  if (resolved.length !== 1 || targets.size !== 1 || !resolved[0].product) {
    return matchResult({
      status: 'review', source: 'alias_conflict',
      candidates: resolved.filter(({ product }) => product).map(({ product }) => candidate(product, 1, fieldDifferences(line, product))),
      message: '商品Aliasの確認が必要です。',
    });
  }
  const { alias, product } = resolved[0];
  const differences = fieldDifferences(line, product);
  return matchResult({ status: 'matched', source, product, alias, differences });
}

const SIGNIFICANT_TOKEN = /^(?:f\d+|gf|\d+(?:d|dgf|days?)?|thin|thick|grain|grass|fed|tongue|skirt)$/i;
const tokens = (value) => normalizeProductAliasText(value).match(/[\p{L}\p{N}]+/gu) || [];

function similarityScore(importedName, product) {
  const imported = new Set(tokens(importedName));
  const registered = new Set(tokens([product.name, product.brandName ?? product.brand_name].filter(Boolean).join(' ')));
  if (!imported.size || !registered.size) return 0;
  const intersection = [...imported].filter((token) => registered.has(token)).length;
  let score = intersection / new Set([...imported, ...registered]).size;
  const importedText = normalizeProductAliasText(importedName);
  const registeredText = normalizeProductAliasText(product.name);
  if (importedText === registeredText) score = 1;
  else if (importedText.includes(registeredText) || registeredText.includes(importedText)) score += 0.2;
  const importantMismatch = [...imported]
    .filter((token) => SIGNIFICANT_TOKEN.test(token))
    .some((token) => !registered.has(token) && [...registered].some((item) => SIGNIFICANT_TOKEN.test(item)));
  return Math.min(importantMismatch ? score * 0.45 : score, 1);
}

function buildCandidates(line, products) {
  const importedName = text(line.productName ?? line.productNameRaw ?? line.product_name);
  if (!importedName) return [];
  return activeProducts(products)
    .map((product) => ({ product, score: similarityScore(importedName, product) }))
    .filter(({ score }) => score >= 0.15)
    .sort((a, b) => b.score - a.score || String(a.product.id).localeCompare(String(b.product.id)))
    .slice(0, 3)
    .map(({ product, score }) => candidate(product, score, fieldDifferences(line, product)));
}

export function matchInboundProduct(line, products = [], options = {}) {
  const available = activeProducts(products);
  const productsById = new Map(available.map((product) => [product.id, product]));
  const aliases = options.productAliases ?? options.aliases ?? [];
  const active = activeAliases(aliases);
  const supplierContext = resolveInboundSupplierContext(line, options.suppliers ?? [], options);
  const code = inboundProductCode(line?.productCode ?? line?.product_code);

  if (code) {
    const matches = available.filter((product) => productCode(product) === code);
    if (matches.length === 1) {
      const differences = fieldDifferences(line, matches[0]);
      return matchResult({
        status: 'matched', source: 'product_code', product: matches[0], differences,
        candidates: [candidate(matches[0], 1, differences)],
        message: differences.length ? '帳票と商品マスタに差異があります。商品マスタは更新しません。' : '',
      });
    }
    if (matches.length > 1) {
      return matchResult({
        status: 'review', source: 'product_code_conflict',
        candidates: matches.map((product) => candidate(product, 1, fieldDifferences(line, product))),
        message: '同じ商品コードの候補が複数あるため確認が必要です。',
      });
    }
  }

  const supplierCode = normalizeSupplierProductCode(
    line?.supplierProductCode ?? line?.supplier_product_code ?? line?.productCode ?? line?.product_code,
  );
  if (supplierCode && supplierContext.status === 'resolved') {
    const aliasMatch = resolveAliasMatches(active.filter((alias) =>
      aliasSupplierCode(alias) === supplierCode && supplierAliasMatches(alias, supplierContext)), productsById, 'supplier_code_alias', line);
    if (aliasMatch) return aliasMatch;
  }

  const normalizedName = normalizeProductAliasText(line?.productName ?? line?.productNameRaw ?? line?.product_name);
  if (normalizedName) {
    const aliasMatch = resolveAliasMatches(active.filter((alias) =>
      aliasName(alias) === normalizedName && nameAliasMatchesContext(alias, supplierContext)), productsById, 'name_alias', line);
    if (aliasMatch) return aliasMatch;

    const inactive = (aliases || []).filter((alias) =>
      !(alias.isActive ?? alias.is_active ?? true) && aliasName(alias) === normalizedName &&
      nameAliasMatchesContext(alias, supplierContext));
    if (inactive.length > 1) {
      return matchResult({
        status: 'review', source: 'inactive_alias_conflict',
        candidates: inactive.map((alias) => productsById.get(aliasProductId(alias))).filter(Boolean)
          .map((product) => candidate(product, 1, fieldDifferences(line, product))),
        message: '無効化された競合Aliasがあるため確認が必要です。',
      });
    }
  }

  const candidates = buildCandidates(line, available);
  const supplierScopedInputAlias = active.some((alias) =>
    aliasContext(alias).type !== 'global' &&
    ((supplierCode && aliasSupplierCode(alias) === supplierCode) ||
      (normalizedName && aliasName(alias) === normalizedName)));
  if (supplierContext.status === 'ambiguous' && supplierScopedInputAlias) {
    return matchResult({
      status: 'review', source: 'supplier_context_ambiguous', candidates,
      message: '仕入先を一意に特定できないため確認が必要です。',
    });
  }
  if (candidates.length) {
    return matchResult({
      status: 'candidate', source: 'candidate', candidates,
      message: '商品候補があります。自動確定していません。',
    });
  }
  return matchResult({
    status: code ? 'unmatched' : 'review', source: 'none',
    message: code ? '商品マスタに未登録です。' : '商品コードがないため確認が必要です。',
  });
}

export function matchInboundPreview(preview, products = [], options = {}) {
  if (!preview) return preview;
  const supplierNameValue = preview.supplierName ?? preview.supplier ?? options.supplierName ?? '';
  const supplierId = preview.supplierId ?? preview.supplier_id ?? options.supplierId ?? '';
  return {
    ...preview,
    lines: (preview.lines || []).map((line) => ({
      ...line,
      ...matchInboundProduct(line, products, { ...options, supplierName: supplierNameValue, supplierId }),
    })),
  };
}

export function matchInboundLineForPersistence(line, products = [], options = {}) {
  const match = matchInboundProduct(line, products, options);
  return {
    productId: match.matchedProductId,
    status: ['review', 'candidate'].includes(match.productMatchStatus) ? 'ambiguous' : match.productMatchStatus,
    score: match.productMatchStatus === 'matched' ? 100 : 0,
    source: match.productMatchSource,
    warning: match.productMatchMessage,
  };
}

export function productMatchStatusLabel(status) {
  return {
    matched: '照合済み', unmatched: '未登録商品', review: '要確認', candidate: '候補あり',
  }[status] || '要確認';
}
