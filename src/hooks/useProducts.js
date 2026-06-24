import { useMemo, useState } from 'react';

const STORAGE_KEY = 'eigyo-techo-products';

export const PRODUCT_CATEGORIES = [
  '牛肉',
  '豚肉',
  '鶏肉',
  'ラム',
  '加工肉',
  '水産',
  'チーズ',
  '乳製品',
  '冷凍食品',
  '惣菜',
  '調味料',
  'その他',
];

export const TEMPERATURE_ZONES = ['冷凍', '冷蔵', '常温'];

export const PRODUCT_UNITS = ['kg', 'g', 'パック', '箱', 'ケース', '枚', '本', '袋', '個'];

export const emptyProduct = {
  userId: '',
  name: '',
  category: '',
  manufacturerName: '',
  origin: '',
  temperatureZone: '冷凍',
  packageStyle: '',
  costPrice: '',
  costUnit: 'kg',
  desiredSellingPrice: '',
  sellingPriceUnit: 'kg',
  grossMarginRate: '',
  description: '',
  memo: '',
  imageFile: null,
  productMaterialFile: null,
  specSheetFile: null,
};

export function parsePrice(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const normalized = String(value).replace(/,/g, '').trim();
  if (!normalized) {
    return '';
  }

  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : '';
}

export function formatPrice(value) {
  const numberValue = parsePrice(value);
  return numberValue === '' ? '' : numberValue.toLocaleString('ja-JP');
}

export function calculateGrossMarginRate(costPrice, desiredSellingPrice) {
  const cost = parsePrice(costPrice);
  const price = parsePrice(desiredSellingPrice);

  if (cost === '' || price === '' || price <= 0) {
    return '';
  }

  return `${(((price - cost) / price) * 100).toFixed(1).replace(/\.0$/, '')}%`;
}

export function normalizeProduct(product = {}, userId = '') {
  const costPrice = parsePrice(product.costPrice ?? product.cost ?? '');
  const desiredSellingPrice = parsePrice(
    product.desiredSellingPrice ?? product.sellingPrice ?? '',
  );

  return {
    ...emptyProduct,
    ...product,
    id: product.id ?? crypto.randomUUID(),
    userId: product.userId ?? userId,
    category: product.category ?? '',
    manufacturerName: product.manufacturerName ?? '',
    origin: product.origin ?? '',
    temperatureZone: product.temperatureZone || '冷凍',
    packageStyle: product.packageStyle ?? '',
    costPrice,
    costUnit: product.costUnit || 'kg',
    desiredSellingPrice,
    sellingPriceUnit: product.sellingPriceUnit || 'kg',
    grossMarginRate:
      product.grossMarginRate ||
      calculateGrossMarginRate(costPrice, desiredSellingPrice),
    description: product.description ?? '',
    memo: product.memo ?? '',
    imageFile: product.imageFile ?? null,
    productMaterialFile: product.productMaterialFile ?? null,
    specSheetFile: product.specSheetFile ?? null,
    createdAt: product.createdAt ?? new Date().toISOString(),
    updatedAt: product.updatedAt ?? new Date().toISOString(),
  };
}

function readLocalProducts(userId = '') {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved
      ? JSON.parse(saved)
          .map((product) => normalizeProduct(product, userId))
          .filter((product) => !userId || product.userId === userId)
      : [];
  } catch {
    return [];
  }
}

function saveLocalProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

export function useProducts(userId = '') {
  const [products, setProducts] = useState(() => readLocalProducts(userId));

  const sortedProducts = useMemo(
    () =>
      [...products].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [products],
  );

  function addProduct(product) {
    const now = new Date().toISOString();
    const normalizedProduct = normalizeProduct({
      ...product,
      userId,
      id: product.id ?? crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }, userId);

    setProducts((current) => {
      const nextProducts = [normalizedProduct, ...current];
      saveLocalProducts(nextProducts);
      return nextProducts;
    });

    return normalizedProduct.id;
  }

  function updateProduct(id, updates) {
    setProducts((current) => {
      const nextProducts = current.map((product) =>
        product.id === id
          ? normalizeProduct({ ...product, ...updates, userId, updatedAt: new Date().toISOString() }, userId)
          : product,
      );
      saveLocalProducts(nextProducts);
      return nextProducts;
    });
  }

  function removeProduct(id) {
    setProducts((current) => {
      const nextProducts = current.filter((product) => product.id !== id);
      saveLocalProducts(nextProducts);
      return nextProducts;
    });
  }

  return {
    products: sortedProducts,
    addProduct,
    updateProduct,
    removeProduct,
  };
}
