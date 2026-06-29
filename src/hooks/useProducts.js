import { useEffect, useMemo, useState } from 'react';
import {
  canUseCloud,
  deleteRecord,
  fetchRecords,
  getLocalSyncReason,
  mergeByUpdatedAt,
  upsertRecords,
} from '../services/recordSyncService.js';

const STORAGE_KEY = 'eigyo-techo-products';
const TABLE_NAME = 'products';

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
  tags: [],
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
  attachments: [],
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
    tags: Array.isArray(product.tags) ? product.tags : [],
    costPrice,
    costUnit: product.costUnit || 'kg',
    desiredSellingPrice,
    sellingPriceUnit: product.sellingPriceUnit || 'kg',
    grossMarginRate:
      product.grossMarginRate ||
      calculateGrossMarginRate(costPrice, desiredSellingPrice),
    description: product.description ?? '',
    memo: product.memo ?? '',
    imageFile: normalizeAttachment(product.imageFile),
    productMaterialFile: normalizeAttachment(product.productMaterialFile),
    specSheetFile: normalizeAttachment(product.specSheetFile),
    attachments: Array.isArray(product.attachments)
      ? product.attachments.map(normalizeAttachment).filter(Boolean)
      : [],
    createdAt: product.createdAt ?? new Date().toISOString(),
    updatedAt: product.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeAttachment(file) {
  if (!file || file.dataUrl) {
    return null;
  }

  return {
    id: file.id ?? crypto.randomUUID(),
    name: file.name ?? '',
    type: file.type ?? '',
    size: file.size ?? 0,
    path: file.path ?? '',
    url: file.url ?? '',
    field: file.field ?? '',
    uploadedAt: file.uploadedAt ?? '',
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products.map((product) => normalizeProduct(product))));
}

function toSupabaseRow(product) {
  return {
    id: product.id,
    user_id: product.userId,
    name: product.name,
    category: product.category,
    manufacturer_name: product.manufacturerName,
    origin: product.origin,
    temperature_zone: product.temperatureZone,
    package_style: product.packageStyle,
    tags: product.tags,
    cost_price: product.costPrice === '' ? null : product.costPrice,
    cost_unit: product.costUnit,
    desired_selling_price: product.desiredSellingPrice === '' ? null : product.desiredSellingPrice,
    selling_price_unit: product.sellingPriceUnit,
    gross_margin_rate: product.grossMarginRate,
    description: product.description,
    memo: product.memo,
    image_file: product.imageFile,
    product_material_file: product.productMaterialFile,
    spec_sheet_file: product.specSheetFile,
    attachments: product.attachments,
    created_at: product.createdAt,
    updated_at: product.updatedAt ?? new Date().toISOString(),
  };
}

function fromSupabaseRow(row) {
  return normalizeProduct({
    id: row.id,
    userId: row.user_id ?? '',
    name: row.name ?? '',
    category: row.category ?? '',
    manufacturerName: row.manufacturer_name ?? '',
    origin: row.origin ?? '',
    temperatureZone: row.temperature_zone ?? '冷凍',
    packageStyle: row.package_style ?? '',
    tags: row.tags ?? [],
    costPrice: row.cost_price ?? '',
    costUnit: row.cost_unit ?? 'kg',
    desiredSellingPrice: row.desired_selling_price ?? '',
    sellingPriceUnit: row.selling_price_unit ?? 'kg',
    grossMarginRate: row.gross_margin_rate ?? '',
    description: row.description ?? '',
    memo: row.memo ?? '',
    imageFile: row.image_file ?? null,
    productMaterialFile: row.product_material_file ?? null,
    specSheetFile: row.spec_sheet_file ?? null,
    attachments: row.attachments ?? [],
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  });
}

export function useProducts(userId = '') {
  const [products, setProducts] = useState(() => (canUseCloud() ? [] : readLocalProducts(userId)));
  const [syncState, setSyncState] = useState(canUseCloud() ? 'syncing' : 'local');
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function syncProducts() {
      if (!canUseCloud()) {
        setProducts(readLocalProducts(userId));
        setSyncState('local');
        setSyncError(getLocalSyncReason());
        return;
      }

      try {
        setSyncState('syncing');
        setSyncError('');
        const localProducts = readLocalProducts(userId);
        const remoteProducts = await fetchRecords(TABLE_NAME, userId, fromSupabaseRow);
        const mergedProducts = mergeByUpdatedAt(localProducts, remoteProducts)
          .map((product) => normalizeProduct(product, userId));

        if (localProducts.length > 0) {
          await upsertRecords(TABLE_NAME, mergedProducts, toSupabaseRow);
        }

        const refreshedProducts = await fetchRecords(TABLE_NAME, userId, fromSupabaseRow);
        const nextProducts = refreshedProducts.length > 0 ? refreshedProducts : mergedProducts;

        if (ignore) {
          return;
        }

        setProducts(nextProducts);
        saveLocalProducts(nextProducts);
        setSyncState('supabase');
      } catch (error) {
        setProducts(readLocalProducts(userId));
        setSyncState('local');
        setSyncError(getLocalSyncReason(error.message));
      }
    }

    syncProducts();

    return () => {
      ignore = true;
    };
  }, [userId]);

  const sortedProducts = useMemo(
    () =>
      [...products].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [products],
  );

  async function reloadProducts() {
    if (!canUseCloud()) {
      setProducts(readLocalProducts(userId));
      setSyncState('local');
      setSyncError(getLocalSyncReason());
      return;
    }

    try {
      setSyncState('syncing');
      const remoteProducts = await fetchRecords(TABLE_NAME, userId, fromSupabaseRow);
      setProducts(remoteProducts);
      saveLocalProducts(remoteProducts);
      setSyncState('supabase');
      setSyncError('');
    } catch (error) {
      setSyncState('local');
      setSyncError(getLocalSyncReason(error.message));
    }
  }

  function syncProducts(nextProducts, changedProduct = null) {
    saveLocalProducts(nextProducts);

    if (!canUseCloud()) {
      setSyncState('local');
      setSyncError(getLocalSyncReason());
      return;
    }

    setSyncState('syncing');
    setSyncError('');
    const writePromise = changedProduct
      ? upsertRecords(TABLE_NAME, [changedProduct], toSupabaseRow)
      : upsertRecords(TABLE_NAME, nextProducts, toSupabaseRow);

    writePromise
      .then(reloadProducts)
      .catch((error) => {
        setSyncState('local');
        setSyncError(getLocalSyncReason(error.message));
      });
  }

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
      syncProducts(nextProducts, normalizedProduct);
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
      const changedProduct = nextProducts.find((product) => product.id === id);
      syncProducts(nextProducts, changedProduct);
      return nextProducts;
    });
  }

  function removeProduct(id) {
    setProducts((current) => {
      const nextProducts = current.filter((product) => product.id !== id);
      saveLocalProducts(nextProducts);

      if (canUseCloud()) {
        deleteRecord(TABLE_NAME, id, userId)
          .then(reloadProducts)
          .catch((error) => {
            setSyncState('local');
            setSyncError(getLocalSyncReason(error.message));
          });
      }

      return nextProducts;
    });
  }

  return {
    products: sortedProducts,
    addProduct,
    updateProduct,
    removeProduct,
    reloadProducts,
    productSyncState: syncState,
    productSyncError: syncError,
  };
}
