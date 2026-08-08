import { useEffect, useMemo, useRef, useState } from 'react';
import {
  canUseCloud,
  deleteRecord,
  fetchRecords,
  upsertRecords,
} from '../../../shared/services/recordSyncService.js';
import {
  isValidBusinessCode,
  normalizeBusinessCode,
} from '../../../shared/utils/businessCode.js';

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
  productCode: '',
  name: '',
  brandId: '',
  brandName: '',
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

export function normalizeProductCode(value) {
  return normalizeBusinessCode(value);
}

export function isValidProductCode(value) {
  return isValidBusinessCode(value);
}

export function productDisplayName(product, fallback = '商品') {
  if (!product) return fallback;
  const code = normalizeProductCode(product.productCode ?? product.product_code ?? '');
  const name = product.name ?? '';
  return [code, name].filter(Boolean).join(' / ') || fallback;
}

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
    productCode: normalizeProductCode(product.productCode ?? product.product_code ?? ''),
    brandId: product.brandId ?? product.brand_id ?? '',
    brandName: product.brandName ?? product.brand_name ?? product.brandNameSnapshot ?? product.brand_name_snapshot ?? '',
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

function hasLegacyLocalProducts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return false;
    }

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return true;
  }
}

function legacyLocalDataMessage() {
  return '\u65e7\u30ed\u30fc\u30ab\u30eb\u5546\u54c1\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u3059\u3002\u5b89\u5168\u306e\u305f\u3081\u81ea\u52d5\u79fb\u884c\u30fb\u81ea\u52d5\u524a\u9664\u306f\u884c\u3044\u307e\u305b\u3093\u3002';
}

function unavailableMessage() {
  return 'Supabase is unavailable. Product data cannot be saved.';
}

function toSupabaseRow(product) {
  return {
    id: product.id,
    user_id: product.userId,
    product_code: product.productCode || null,
    name: product.name,
    brand_id: product.brandId || null,
    brand_name: product.brandName || '',
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
    productCode: row.product_code ?? '',
    name: row.name ?? '',
    brandId: row.brand_id ?? '',
    brandName: row.brand_name ?? row.brand_name_snapshot ?? '',
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
  const [products, setProducts] = useState([]);
  const [syncState, setSyncState] = useState(canUseCloud() ? 'syncing' : 'error');
  const [syncError, setSyncError] = useState(() => (canUseCloud() ? '' : unavailableMessage()));
  const [legacyLocalDataWarning, setLegacyLocalDataWarning] = useState('');
  const writeSequenceRef = useRef(0);

  useEffect(() => {
    setLegacyLocalDataWarning(hasLegacyLocalProducts() ? legacyLocalDataMessage() : '');
  }, []);

  useEffect(() => {
    let ignore = false;

    async function syncProducts() {
      if (!canUseCloud()) {
        setProducts([]);
        setSyncState('error');
        setSyncError(unavailableMessage());
        return;
      }

      try {
        setSyncState('syncing');
        setSyncError('');
        const remoteProducts = await fetchRecords(TABLE_NAME, userId, fromSupabaseRow);

        if (ignore) {
          return;
        }

        setProducts(remoteProducts.map((product) => normalizeProduct(product, userId)));
        setSyncState('supabase');
      } catch (error) {
        if (ignore) {
          return;
        }

        setProducts([]);
        setSyncState('error');
        setSyncError(error.message || unavailableMessage());
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

  async function reloadProducts(writeSequence = null) {
    if (!canUseCloud()) {
      setProducts([]);
      setSyncState('error');
      setSyncError(unavailableMessage());
      return;
    }

    try {
      setSyncState('syncing');
      setSyncError('');
      const remoteProducts = await fetchRecords(TABLE_NAME, userId, fromSupabaseRow);

      if (writeSequence !== null && writeSequence !== writeSequenceRef.current) {
        return;
      }

      setProducts(remoteProducts.map((product) => normalizeProduct(product, userId)));
      setSyncState('supabase');
    } catch (error) {
      if (writeSequence !== null && writeSequence !== writeSequenceRef.current) {
        return;
      }

      setSyncState('error');
      setSyncError(error.message || unavailableMessage());
      throw error;
    }
  }

  async function persistProduct(changedProduct) {
    if (!canUseCloud()) {
      const message = unavailableMessage();
      setSyncState('error');
      setSyncError(message);
      throw new Error(message);
    }

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    setSyncError('');

    try {
      await upsertRecords(TABLE_NAME, [changedProduct], toSupabaseRow);
      await reloadProducts(writeSequence);
    } catch (error) {
      if (writeSequence === writeSequenceRef.current) {
        setSyncState('error');
        setSyncError(error.message || unavailableMessage());
      }

      throw error;
    }
  }

  async function addProduct(product) {
    const now = new Date().toISOString();
    const normalizedProduct = normalizeProduct({
      ...product,
      userId,
      id: product.id ?? crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }, userId);

    try {
      await persistProduct(normalizedProduct);
      return normalizedProduct.id;
    } catch {
      return null;
    }
  }

  async function updateProduct(id, updates) {
    const currentProduct = products.find((product) => product.id === id);
    if (!currentProduct) {
      const error = new Error('Product was not found.');
      setSyncError(error.message);
      throw error;
    }

    const changedProduct = normalizeProduct({
      ...currentProduct,
      ...updates,
      userId,
      updatedAt: new Date().toISOString(),
    }, userId);

    await persistProduct(changedProduct);
    return changedProduct;
  }

  async function removeProduct(id) {
    if (!canUseCloud()) {
      const message = unavailableMessage();
      setSyncState('error');
      setSyncError(message);
      return false;
    }

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    setSyncError('');

    try {
      await deleteRecord(TABLE_NAME, id, userId);
      await reloadProducts(writeSequence);
      return true;
    } catch (error) {
      if (writeSequence === writeSequenceRef.current) {
        setSyncState('error');
        setSyncError(error.message || unavailableMessage());
      }
      return false;
    }
  }

  return {
    products: sortedProducts,
    addProduct,
    updateProduct,
    removeProduct,
    reloadProducts,
    productSyncState: syncState,
    productSyncError: syncError,
    productLegacyLocalDataWarning: legacyLocalDataWarning,
  };
}
