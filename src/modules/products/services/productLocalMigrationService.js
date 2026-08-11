import { fetchRecords, upsertRecords } from '../../../shared/services/recordSyncService.js';
import {
  normalizeProduct,
  normalizeProductCode,
} from '../hooks/useProducts.js';
import {
  normalizeBrand,
  normalizeBrandKey,
} from '../hooks/useBrands.js';
import {
  normalizeProductAsset,
} from '../hooks/useProductAssets.js';

export const PRODUCT_LOCAL_STORAGE_KEYS = {
  products: 'eigyo-techo-products',
  brands: 'eigyo-techo-brands',
  productAssets: 'eigyo-techo-product-assets',
};

function readLocalArray(key) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { records: [], error: '' };
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return { records: [], error: '' };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      records: Array.isArray(parsed) ? parsed : [],
      error: Array.isArray(parsed) ? '' : '配列形式ではありません。',
    };
  } catch (error) {
    return { records: [], error: error.message || 'JSONを解析できません。' };
  }
}

function productNameKey(value) {
  return String(value ?? '').trim().normalize('NFKC').toLowerCase();
}

function productCodeKey(value) {
  return normalizeProductCode(value).toLowerCase();
}

function candidateReason(localProduct, remoteProduct) {
  const reasons = [];
  if (localProduct.id && remoteProduct.id === localProduct.id) {
    reasons.push('id');
  }
  if (productCodeKey(localProduct.productCode) && productCodeKey(localProduct.productCode) === productCodeKey(remoteProduct.productCode)) {
    reasons.push('商品コード');
  }
  if (productNameKey(localProduct.name) && productNameKey(localProduct.name) === productNameKey(remoteProduct.name)) {
    reasons.push('商品名');
  }
  return reasons;
}

function findProductDuplicate(localProduct, remoteProducts) {
  return remoteProducts.find((remoteProduct) => candidateReason(localProduct, remoteProduct).length > 0) || null;
}

function findAssetDuplicate(localAsset, remoteAssets) {
  return remoteAssets.find((remoteAsset) => {
    if (localAsset.id && remoteAsset.id === localAsset.id) return true;
    if (localAsset.storagePath && remoteAsset.storagePath && localAsset.storagePath === remoteAsset.storagePath) return true;
    if (localAsset.publicUrl && remoteAsset.publicUrl && localAsset.publicUrl === remoteAsset.publicUrl) return true;
    return false;
  }) || null;
}

function hasUsableAssetStorage(asset) {
  return Boolean(String(asset.storagePath || '').trim() || String(asset.publicUrl || '').trim());
}

function productToSupabaseRow(product) {
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

function productFromSupabaseRow(row) {
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
    temperatureZone: row.temperature_zone ?? '',
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

function brandToSupabaseRow(brand) {
  return {
    id: brand.id,
    user_id: brand.userId,
    name: brand.name,
    manufacturer_id: brand.manufacturerId || null,
    supplier_id: brand.supplierId || null,
    country: brand.country,
    description: brand.description,
    website_url: brand.websiteUrl,
    logo_url: brand.logoUrl,
    is_active: brand.isActive !== false,
    deleted_at: brand.deletedAt || null,
    created_at: brand.createdAt,
    updated_at: brand.updatedAt,
  };
}

function brandFromSupabaseRow(row) {
  return normalizeBrand({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    manufacturerId: row.manufacturer_id,
    supplierId: row.supplier_id,
    country: row.country,
    description: row.description,
    websiteUrl: row.website_url,
    logoUrl: row.logo_url,
    isActive: row.is_active,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function productAssetToSupabaseRow(asset) {
  return {
    id: asset.id,
    user_id: asset.userId,
    product_id: asset.productId,
    asset_kind: asset.assetKind,
    asset_type: asset.assetType,
    file_name: asset.fileName,
    description: asset.description,
    sort_order: asset.sortOrder,
    is_main: asset.isMain,
    storage_bucket: asset.storageBucket,
    storage_path: asset.storagePath,
    public_url: asset.publicUrl,
    content_type: asset.contentType,
    size_bytes: asset.sizeBytes,
    metadata: asset.metadata,
    created_at: asset.createdAt,
    updated_at: asset.updatedAt,
  };
}

function productAssetFromSupabaseRow(row) {
  return normalizeProductAsset({
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    assetKind: row.asset_kind,
    assetType: row.asset_type,
    fileName: row.file_name,
    description: row.description,
    sortOrder: row.sort_order,
    isMain: row.is_main,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function readProductLegacyLocalData(userId = '') {
  const productRead = readLocalArray(PRODUCT_LOCAL_STORAGE_KEYS.products);
  const brandRead = readLocalArray(PRODUCT_LOCAL_STORAGE_KEYS.brands);
  const assetRead = readLocalArray(PRODUCT_LOCAL_STORAGE_KEYS.productAssets);

  return {
    products: productRead.records.map((record) => normalizeProduct(record, userId)),
    brands: brandRead.records.map((record) => normalizeBrand(record, userId)),
    productAssets: assetRead.records.map((record) => normalizeProductAsset(record, userId)),
    errors: {
      products: productRead.error,
      brands: brandRead.error,
      productAssets: assetRead.error,
    },
  };
}

export function hasProductLegacyLocalData() {
  const localData = readProductLegacyLocalData();
  return localData.products.length > 0 || localData.brands.length > 0 || localData.productAssets.length > 0;
}

export async function buildProductLegacyMigrationPreview(userId = '') {
  const localData = readProductLegacyLocalData(userId);
  const [remoteProducts, remoteBrands, remoteAssets] = await Promise.all([
    fetchRecords('products', userId, productFromSupabaseRow),
    fetchRecords('brands', userId, brandFromSupabaseRow),
    fetchRecords('product_assets', userId, productAssetFromSupabaseRow),
  ]);

  const productConflicts = localData.products
    .map((product) => {
      const duplicate = findProductDuplicate(product, remoteProducts);
      return duplicate
        ? {
            localId: product.id,
            localName: product.name || '(名称なし)',
            localCode: product.productCode || '',
            remoteId: duplicate.id,
            remoteName: duplicate.name || '(名称なし)',
            remoteCode: duplicate.productCode || '',
            reasons: candidateReason(product, duplicate),
            action: 'skip',
          }
        : null;
    })
    .filter(Boolean);

  const duplicateBrandCount = localData.brands.filter((brand) =>
    remoteBrands.some((remoteBrand) => normalizeBrandKey(remoteBrand.name) === normalizeBrandKey(brand.name)),
  ).length;

  const duplicateAssetCount = localData.productAssets.filter((asset) => findAssetDuplicate(asset, remoteAssets)).length;
  const storageMissingProductAssets = localData.productAssets
    .filter((asset) => !hasUsableAssetStorage(asset))
    .map((asset) => ({
      id: asset.id,
      productId: asset.productId,
      fileName: asset.fileName || asset.name || '(file name missing)',
      assetKind: asset.assetKind,
      reason: 'Storage実体なし：移行対象外',
    }));

  return {
    local: localData,
    remote: {
      products: remoteProducts,
      brands: remoteBrands,
      productAssets: remoteAssets,
    },
    counts: {
      localProducts: localData.products.length,
      localBrands: localData.brands.length,
      localProductAssets: localData.productAssets.length,
      remoteProducts: remoteProducts.length,
      remoteBrands: remoteBrands.length,
      remoteProductAssets: remoteAssets.length,
      duplicateProducts: productConflicts.length,
      duplicateBrands: duplicateBrandCount,
      duplicateProductAssets: duplicateAssetCount,
      storageMissingProductAssets: storageMissingProductAssets.length,
    },
    productConflicts,
    storageMissingProductAssets,
    errors: localData.errors,
  };
}

function resultRecord(type, name, status, detail = '') {
  return { type, name: name || '-', status, detail };
}

function resolveProductAction(product, conflictActions, remoteProducts) {
  const duplicate = findProductDuplicate(product, remoteProducts);
  if (!duplicate) {
    return { action: 'create', duplicate: null };
  }

  return {
    action: conflictActions[product.id] || 'skip',
    duplicate,
  };
}

export async function migrateProductLegacyLocalData({ userId = '', preview, conflictActions = {} }) {
  const local = preview?.local ?? readProductLegacyLocalData(userId);
  const remoteProducts = preview?.remote?.products ?? [];
  const remoteBrands = preview?.remote?.brands ?? [];
  const remoteAssets = preview?.remote?.productAssets ?? [];
  const now = new Date().toISOString();
  const results = {
    products: [],
    brands: [],
    productAssets: [],
  };
  const brandIdMap = new Map();
  const failedBrandIds = new Set();
  const productIdMap = new Map();
  const migratedProductIds = new Set();

  for (const remoteProduct of remoteProducts) {
    productIdMap.set(remoteProduct.id, remoteProduct.id);
  }

  for (const brand of local.brands) {
    const normalizedBrand = normalizeBrand({ ...brand, userId }, userId);
    const duplicate = remoteBrands.find((remoteBrand) => normalizeBrandKey(remoteBrand.name) === normalizeBrandKey(normalizedBrand.name));

    if (duplicate) {
      brandIdMap.set(normalizedBrand.id, duplicate.id);
      results.brands.push(resultRecord('ブランド', normalizedBrand.name, 'skipped', '同名ブランドがSupabaseにあるため既存ブランドへ紐付けました。'));
      continue;
    }

    try {
      await upsertRecords('brands', [{
        ...normalizedBrand,
        userId,
        createdAt: normalizedBrand.createdAt || now,
        updatedAt: now,
      }], brandToSupabaseRow);
      brandIdMap.set(normalizedBrand.id, normalizedBrand.id);
      results.brands.push(resultRecord('ブランド', normalizedBrand.name, 'success', '新規登録しました。'));
    } catch (error) {
      failedBrandIds.add(normalizedBrand.id);
      results.brands.push(resultRecord('ブランド', normalizedBrand.name, 'failed', error.message || '保存に失敗しました。'));
    }
  }

  for (const product of local.products) {
    const { action, duplicate } = resolveProductAction(product, conflictActions, remoteProducts);
    const originalId = product.id;

    if (action === 'skip') {
      results.products.push(resultRecord('商品', product.name, 'skipped', duplicate ? '重複候補のためスキップしました。' : 'スキップしました。'));
      continue;
    }

    const hasFailedBrandLink = Boolean(product.brandId && failedBrandIds.has(product.brandId));
    const nextId = action === 'create' ? originalId : duplicate?.id || originalId;
    const productForSave = normalizeProduct({
      ...(action === 'update' && duplicate ? duplicate : {}),
      ...product,
      id: action === 'create' && duplicate ? crypto.randomUUID() : nextId,
      userId,
      brandId: hasFailedBrandLink ? '' : brandIdMap.get(product.brandId) || product.brandId || '',
      createdAt: action === 'update' && duplicate ? duplicate.createdAt : product.createdAt || now,
      updatedAt: now,
    }, userId);

    try {
      await upsertRecords('products', [productForSave], productToSupabaseRow);
      productIdMap.set(originalId, productForSave.id);
      migratedProductIds.add(originalId);
      results.products.push(resultRecord(
        '商品',
        productForSave.name,
        'success',
        action === 'update' ? '既存商品を更新しました。' : '新規登録しました。',
      ));
      if (hasFailedBrandLink) {
        results.products.push(resultRecord(
          '商品',
          productForSave.name,
          'warning',
          'ブランド紐付け失敗。brandIdを空にして商品を移行しました。',
        ));
      }
    } catch (error) {
      results.products.push(resultRecord('商品', product.name, 'failed', error.message || '保存に失敗しました。'));
    }
  }

  for (const asset of local.productAssets) {
    if (!hasUsableAssetStorage(asset)) {
      results.productAssets.push(resultRecord('商品アセット', asset.fileName, 'warning', 'Storage実体なし：移行対象外'));
      continue;
    }

    const mappedProductId = productIdMap.get(asset.productId);
    const sourceProductWasMigrated = migratedProductIds.has(asset.productId) || remoteProducts.some((product) => product.id === asset.productId);

    if (!mappedProductId || !sourceProductWasMigrated) {
      results.productAssets.push(resultRecord('商品アセット', asset.fileName, 'skipped', '関連商品が移行対象外のためスキップしました。'));
      continue;
    }

    const duplicate = findAssetDuplicate(asset, remoteAssets);
    if (duplicate) {
      results.productAssets.push(resultRecord('商品アセット', asset.fileName, 'skipped', '同じファイル候補がSupabaseにあるためスキップしました。'));
      continue;
    }

    const assetForSave = normalizeProductAsset({
      ...asset,
      userId,
      productId: mappedProductId,
      createdAt: asset.createdAt || now,
      updatedAt: now,
    }, userId);

    try {
      await upsertRecords('product_assets', [assetForSave], productAssetToSupabaseRow);
      results.productAssets.push(resultRecord('商品アセット', assetForSave.fileName, 'success', '新規登録しました。'));
    } catch (error) {
      results.productAssets.push(resultRecord('商品アセット', asset.fileName, 'failed', error.message || '保存に失敗しました。'));
    }
  }

  return results;
}

export function deleteProductLegacyLocalData() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  Object.values(PRODUCT_LOCAL_STORAGE_KEYS).forEach((key) => {
    window.localStorage.removeItem(key);
  });
}
