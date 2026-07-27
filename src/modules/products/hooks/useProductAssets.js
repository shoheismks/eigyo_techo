import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';

export const PRODUCT_IMAGE_TYPES = [
  { value: 'product', label: '商品' },
  { value: 'cut', label: 'カット' },
  { value: 'cooked', label: '調理例' },
  { value: 'package', label: '荷姿' },
  { value: 'other', label: 'その他' },
];

export const PRODUCT_DOCUMENT_TYPES = [
  { value: 'specification', label: '規格書' },
  { value: 'proposal', label: '提案資料' },
  { value: 'leaflet', label: 'リーフレット' },
  { value: 'nutrition', label: '栄養成分' },
  { value: 'allergen', label: 'アレルゲン' },
  { value: 'cooking', label: '調理資料' },
  { value: 'other', label: 'その他' },
];

export function productAssetTypeLabel(kind, value) {
  const source = kind === 'document' ? PRODUCT_DOCUMENT_TYPES : PRODUCT_IMAGE_TYPES;
  return source.find((item) => item.value === value)?.label || value || '-';
}

export function normalizeProductAsset(asset = {}, userId = '') {
  const kind = asset.assetKind ?? asset.asset_kind ?? 'image';

  return {
    id: asset.id ?? crypto.randomUUID(),
    userId: asset.userId ?? asset.user_id ?? userId,
    productId: asset.productId ?? asset.product_id ?? '',
    assetKind: kind === 'document' ? 'document' : 'image',
    assetType: asset.assetType ?? asset.asset_type ?? (kind === 'document' ? 'specification' : 'product'),
    fileName: asset.fileName ?? asset.file_name ?? asset.name ?? '',
    description: asset.description ?? '',
    sortOrder: Number(asset.sortOrder ?? asset.sort_order ?? 0) || 0,
    isMain: Boolean(asset.isMain ?? asset.is_main ?? false),
    storageBucket: asset.storageBucket ?? asset.storage_bucket ?? 'app-attachments',
    storagePath: asset.storagePath ?? asset.storage_path ?? asset.path ?? '',
    publicUrl: asset.publicUrl ?? asset.public_url ?? asset.url ?? '',
    contentType: asset.contentType ?? asset.content_type ?? asset.type ?? '',
    sizeBytes: asset.sizeBytes ?? asset.size_bytes ?? asset.size ?? 0,
    metadata: asset.metadata ?? {},
    createdAt: asset.createdAt ?? asset.created_at ?? new Date().toISOString(),
    updatedAt: asset.updatedAt ?? asset.updated_at ?? new Date().toISOString(),
  };
}

function toRow(asset) {
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

function fromRow(row) {
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

export const useProductAssets = createRecordHook({
  tableName: 'product_assets',
  storageKey: 'eigyo-techo-product-assets',
  normalize: normalizeProductAsset,
  toRow,
  fromRow,
});
