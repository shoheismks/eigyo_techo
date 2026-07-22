import { parsePrice } from '../../products/hooks/useProducts.js';

export const PRICE_TYPES = [
  { value: 'regular', label: '通常' },
  { value: 'special', label: '特別' },
  { value: 'campaign', label: 'キャンペーン' },
  { value: 'contract', label: '契約' },
  { value: 'spot', label: 'スポット' },
  { value: 'sample', label: 'サンプル' },
  { value: 'other', label: 'その他' },
];

export const PRICE_UNITS = ['kg', 'case', 'piece', 'pack', 'unit'];

const PRICE_TYPE_LABELS = {
  regular: '通常',
  special: '特別',
  campaign: 'キャンペーン',
  contract: '契約',
  spot: 'スポット',
  sample: 'サンプル',
  standard: '商品標準',
  other: 'その他',
};

export function priceTypeLabel(value = '') {
  return PRICE_TYPE_LABELS[value] || value || '-';
}

export function normalizePriceNumber(value) {
  const parsed = parsePrice(value);
  return parsed === '' ? '' : parsed;
}

export function isActivePrice(price = {}, targetDate = new Date().toISOString().slice(0, 10)) {
  if (price.isActive === false || price.deletedAt) return false;
  if (price.validFrom && String(price.validFrom).slice(0, 10) > targetDate) return false;
  if (price.validTo && String(price.validTo).slice(0, 10) < targetDate) return false;
  return true;
}

function quantityMatches(price = {}, quantityValue = '') {
  const quantity = normalizePriceNumber(quantityValue);
  if (quantity === '') return true;
  const min = normalizePriceNumber(price.minimumQuantity);
  const max = normalizePriceNumber(price.maximumQuantity);
  if (min !== '' && quantity < min) return false;
  if (max !== '' && quantity > max) return false;
  return true;
}

function numericRange(minValue, maxValue) {
  const min = normalizePriceNumber(minValue);
  const max = normalizePriceNumber(maxValue);
  return {
    min: min === '' ? Number.NEGATIVE_INFINITY : Number(min),
    max: max === '' ? Number.POSITIVE_INFINITY : Number(max),
  };
}

function dateRange(fromValue, toValue) {
  return {
    min: fromValue ? new Date(`${String(fromValue).slice(0, 10)}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY,
    max: toValue ? new Date(`${String(toValue).slice(0, 10)}T00:00:00`).getTime() : Number.POSITIVE_INFINITY,
  };
}

function overlaps(left, right) {
  return left.min <= right.max && right.min <= left.max;
}

function sameScope(left = {}, right = {}) {
  return (
    String(left.customerId || '') === String(right.customerId || '') &&
    String(left.parentCustomerId || '') === String(right.parentCustomerId || '') &&
    String(left.productId || '') === String(right.productId || '') &&
    String(left.priceUnit || '') === String(right.priceUnit || '') &&
    String(left.officeScope || 'customer') === String(right.officeScope || 'customer') &&
    Boolean(left.applyToChildCustomers) === Boolean(right.applyToChildCustomers)
  );
}

export function findExactDuplicatePrice(prices = [], form = {}) {
  return prices.find((price) => (
    price.id !== form.id &&
    !price.deletedAt &&
    sameScope(price, form) &&
    String(price.priceType || '') === String(form.priceType || '') &&
    String(price.unitPrice || '') === String(form.unitPrice || '') &&
    String(price.minimumQuantity || '') === String(form.minimumQuantity || '') &&
    String(price.maximumQuantity || '') === String(form.maximumQuantity || '') &&
    String(price.validFrom || '') === String(form.validFrom || '') &&
    String(price.validTo || '') === String(form.validTo || '') &&
    Number(price.priority || 0) === Number(form.priority || 0)
  )) || null;
}

export function findOverlappingPriceConflicts(prices = [], form = {}) {
  const quantityRange = numericRange(form.minimumQuantity, form.maximumQuantity);
  const periodRange = dateRange(form.validFrom, form.validTo);
  return prices.filter((price) => (
    price.id !== form.id &&
    !price.deletedAt &&
    sameScope(price, form) &&
    overlaps(numericRange(price.minimumQuantity, price.maximumQuantity), quantityRange) &&
    overlaps(dateRange(price.validFrom, price.validTo), periodRange)
  ));
}

function scopeRank(price, customer) {
  if (!customer?.id) return 0;
  if (price.customerId === customer.id) return 400;
  if (
    price.applyToChildCustomers &&
    customer.parentCustomerId &&
    price.customerId === customer.parentCustomerId
  ) {
    return 300;
  }
  if (price.applyToChildCustomers && customer.id === price.parentCustomerId) {
    return 250;
  }
  if (
    customer.parentCustomerId &&
    price.parentCustomerId &&
    price.parentCustomerId === customer.parentCustomerId
  ) {
    return 200;
  }
  return 0;
}

function candidateScore(price, customer, quantity, targetDate) {
  const rank = scopeRank(price, customer);
  if (!rank) return null;
  if (!isActivePrice(price, targetDate)) return null;
  if (!quantityMatches(price, quantity)) return null;

  const hasPeriod = price.validFrom || price.validTo ? 30 : 0;
  const hasQuantityRange = price.minimumQuantity || price.maximumQuantity ? 20 : 0;
  const priority = Number(price.priority || 0);
  const validFrom = price.validFrom ? new Date(price.validFrom).getTime() : 0;
  const updatedAt = price.updatedAt ? new Date(price.updatedAt).getTime() : 0;

  return rank + hasPeriod + hasQuantityRange + priority + validFrom / 10000000000000 + updatedAt / 100000000000000;
}

function coreScore(score) {
  return Math.floor(Number(score || 0));
}

export function formatPriceReason(price = {}) {
  if (!price?.id) return '';
  const period = `${price.validFrom || '開始未設定'} - ${price.validTo || '終了未設定'}`;
  const quantity = `${price.minimumQuantity || '0'} - ${price.maximumQuantity || '上限なし'} ${price.priceUnit || ''}`.trim();
  return `${priceTypeLabel(price.priceType)} / 有効期間: ${period} / 数量帯: ${quantity}`;
}

export function resolveCustomerProductPrice({
  customerId,
  productId,
  quantity = '',
  priceUnit = '',
  targetDate = new Date().toISOString().slice(0, 10),
  customers = [],
  products = [],
  prices = [],
}) {
  const product = products.find((item) => item.id === productId);
  const customer = customers.find((item) => item.id === customerId);
  const normalizedUnit = priceUnit || product?.sellingPriceUnit || product?.costUnit || 'kg';

  if (!productId || !product) {
    return {
      unitPrice: '',
      priceType: '',
      priceMasterId: '',
      priceSource: 'none',
      priceUnit: normalizedUnit,
      warning: '商品マスターから商品を選択してください。',
    };
  }

  const candidates = prices
    .filter((price) => price.productId === productId)
    .filter((price) => !normalizedUnit || !price.priceUnit || price.priceUnit === normalizedUnit)
    .map((price) => ({ price, score: candidateScore(price, customer, quantity, targetDate) }))
    .filter((item) => item.score !== null)
    .sort((a, b) => b.score - a.score);

  if (candidates.length > 0) {
    const best = candidates[0];
    const conflicts = candidates.filter((item) => coreScore(item.score) === coreScore(best.score));
    const price = best.price;
    const reason = formatPriceReason(price);
    return {
      unitPrice: price.unitPrice,
      priceType: price.priceType || 'regular',
      priceMasterId: price.id,
      priceSource: scopeRank(price, customer) >= 400
        ? 'customer_price'
        : scopeRank(price, customer) >= 300
          ? 'head_office_price'
          : 'customer_group_price',
      priceUnit: price.priceUnit || normalizedUnit,
      validFrom: price.validFrom || '',
      validTo: price.validTo || '',
      matchedRule: [reason, price.notes].filter(Boolean).join(' / '),
      warning: conflicts.length > 1 ? `同順位の価格候補が${conflicts.length}件あります。採用価格の根拠を確認してください。` : '',
    };
  }

  return {
    unitPrice: product.desiredSellingPrice ?? '',
    priceType: 'standard',
    priceMasterId: '',
    priceSource: product.desiredSellingPrice !== '' ? 'product_standard' : 'none',
    priceUnit: product.sellingPriceUnit || normalizedUnit,
    validFrom: '',
    validTo: '',
    matchedRule: '商品マスター希望販売価格',
    warning: product.desiredSellingPrice !== '' ? '' : '有効な価格が見つかりません。',
  };
}

export function applyResolvedPriceToLine(line = {}, resolved = {}, { markManual = false } = {}) {
  return {
    ...line,
    unitPrice: resolved.unitPrice !== '' && resolved.unitPrice !== undefined ? resolved.unitPrice : line.unitPrice,
    originalUnitPrice: line.originalUnitPrice || resolved.unitPrice || line.unitPrice || '',
    priceSource: resolved.priceSource || line.priceSource || '',
    priceType: resolved.priceType || line.priceType || '',
    priceMasterId: resolved.priceMasterId || line.priceMasterId || '',
    priceUnit: resolved.priceUnit || line.priceUnit || line.unit || '',
    priceValidFrom: resolved.validFrom || line.priceValidFrom || '',
    priceValidTo: resolved.validTo || line.priceValidTo || '',
    priceMatchedRule: resolved.matchedRule || line.priceMatchedRule || '',
    priceWarning: resolved.warning || '',
    isManualPrice: markManual ? true : line.isManualPrice || false,
    priceOverriddenAt: markManual ? new Date().toISOString() : line.priceOverriddenAt || '',
  };
}
