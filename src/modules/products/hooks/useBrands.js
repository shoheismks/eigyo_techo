import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';

const STORAGE_KEY = 'eigyo-techo-brands';

export const emptyBrand = {
  userId: '',
  name: '',
  manufacturerId: '',
  supplierId: '',
  country: '',
  description: '',
  websiteUrl: '',
  logoUrl: '',
  isActive: true,
  deletedAt: '',
};

export function normalizeBrandName(value) {
  return String(value ?? '').trim();
}

export function normalizeBrandKey(value) {
  return normalizeBrandName(value).normalize('NFKC').toLowerCase();
}

export function findDuplicateBrand(brands = [], name = '', currentId = '') {
  const key = normalizeBrandKey(name);
  if (!key) return null;
  return brands.find((brand) => brand.id !== currentId && !brand.deletedAt && normalizeBrandKey(brand.name) === key) || null;
}

export function normalizeBrand(brand = {}, userId = '') {
  return {
    ...emptyBrand,
    ...brand,
    id: brand.id ?? crypto.randomUUID(),
    userId: brand.userId ?? brand.user_id ?? userId,
    name: normalizeBrandName(brand.name),
    manufacturerId: brand.manufacturerId ?? brand.manufacturer_id ?? '',
    supplierId: brand.supplierId ?? brand.supplier_id ?? '',
    country: brand.country ?? '',
    description: brand.description ?? '',
    websiteUrl: brand.websiteUrl ?? brand.website_url ?? '',
    logoUrl: brand.logoUrl ?? brand.logo_url ?? '',
    isActive: brand.isActive ?? brand.is_active ?? true,
    deletedAt: brand.deletedAt ?? brand.deleted_at ?? '',
    createdAt: brand.createdAt ?? brand.created_at ?? new Date().toISOString(),
    updatedAt: brand.updatedAt ?? brand.updated_at ?? new Date().toISOString(),
  };
}

function toRow(brand) {
  return {
    id: brand.id,
    user_id: brand.userId,
    name: normalizeBrandName(brand.name),
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

function fromRow(row) {
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

export const useBrands = createRecordHook({
  tableName: 'brands',
  storageKey: STORAGE_KEY,
  normalize: normalizeBrand,
  toRow,
  fromRow,
});
