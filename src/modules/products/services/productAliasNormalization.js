export const PRODUCT_ALIAS_NORMALIZATION_VERSION = 1;

const HYPHENS = /[‐‑‒–—―−]/g;
const SAFE_SEPARATORS = /[\s　/_,，、。・･;；:：()[\]{}]+/g;

export function normalizeProductAliasText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(HYPHENS, '-')
    .replace(SAFE_SEPARATORS, ' ')
    .trim();
}

export function normalizeSupplierProductCode(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(HYPHENS, '-')
    .replace(/[\s　]+/g, ' ')
    .trim();
}
