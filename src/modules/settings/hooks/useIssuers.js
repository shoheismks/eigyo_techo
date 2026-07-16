import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';

export const PDF_TEMPLATE_OPTIONS = [
  { value: 'standard', label: '標準' },
  { value: 'compact', label: 'コンパクト' },
  { value: 'executive', label: 'エグゼクティブ' },
];

export const DEFAULT_ISSUER_TAX_RATE = '8';

export const emptyIssuer = {
  userId: '',
  name: '',
  legalName: '',
  logoUrl: '',
  logoFileName: '',
  logoStoragePath: '',
  address: '',
  phone: '',
  email: '',
  registrationNumber: '',
  bankAccount: '',
  contactPerson: '',
  sealUrl: '',
  sealFileName: '',
  sealStoragePath: '',
  defaultTaxRate: DEFAULT_ISSUER_TAX_RATE,
  defaultPaymentTerms: '',
  defaultDeliveryTerms: '',
  defaultRemarks: '',
  defaultPdfTemplate: 'standard',
  isDefault: false,
  isActive: true,
  createdAt: '',
  updatedAt: '',
};

export function normalizeIssuer(issuer = {}, userId = '') {
  return {
    ...emptyIssuer,
    ...issuer,
    id: issuer.id ?? crypto.randomUUID(),
    userId: issuer.userId ?? userId,
    name: issuer.name ?? issuer.companyName ?? '',
    legalName: issuer.legalName ?? issuer.legal_name ?? '',
    logoUrl: issuer.logoUrl ?? issuer.logo_url ?? '',
    logoFileName: issuer.logoFileName ?? issuer.logo_file_name ?? '',
    logoStoragePath: issuer.logoStoragePath ?? issuer.logo_storage_path ?? '',
    registrationNumber: issuer.registrationNumber ?? issuer.registration_number ?? '',
    bankAccount: issuer.bankAccount ?? issuer.bank_account ?? '',
    contactPerson: issuer.contactPerson ?? issuer.contact_person ?? '',
    sealUrl: issuer.sealUrl ?? issuer.seal_url ?? '',
    sealFileName: issuer.sealFileName ?? issuer.seal_file_name ?? '',
    sealStoragePath: issuer.sealStoragePath ?? issuer.seal_storage_path ?? '',
    defaultTaxRate: String(issuer.defaultTaxRate ?? issuer.default_tax_rate ?? DEFAULT_ISSUER_TAX_RATE),
    defaultPaymentTerms: issuer.defaultPaymentTerms ?? issuer.default_payment_terms ?? '',
    defaultDeliveryTerms: issuer.defaultDeliveryTerms ?? issuer.default_delivery_terms ?? '',
    defaultRemarks: issuer.defaultRemarks ?? issuer.default_remarks ?? '',
    defaultPdfTemplate: issuer.defaultPdfTemplate ?? issuer.default_pdf_template ?? 'standard',
    isDefault: Boolean(issuer.isDefault ?? issuer.is_default ?? false),
    isActive: issuer.isActive ?? issuer.is_active ?? true,
    createdAt: issuer.createdAt ?? issuer.created_at ?? new Date().toISOString(),
    updatedAt: issuer.updatedAt ?? issuer.updated_at ?? new Date().toISOString(),
  };
}

export function createIssuerSnapshot(issuer = null) {
  if (!issuer) return null;
  const normalized = normalizeIssuer(issuer, issuer.userId);
  return {
    id: normalized.id,
    name: normalized.name,
    legalName: normalized.legalName,
    logoUrl: normalized.logoUrl,
    address: normalized.address,
    phone: normalized.phone,
    email: normalized.email,
    registrationNumber: normalized.registrationNumber,
    bankAccount: normalized.bankAccount,
    contactPerson: normalized.contactPerson,
    sealUrl: normalized.sealUrl,
    defaultTaxRate: normalized.defaultTaxRate,
    defaultPaymentTerms: normalized.defaultPaymentTerms,
    defaultDeliveryTerms: normalized.defaultDeliveryTerms,
    defaultRemarks: normalized.defaultRemarks,
    defaultPdfTemplate: normalized.defaultPdfTemplate,
    snapshotCreatedAt: new Date().toISOString(),
  };
}

function toRow(issuer) {
  return {
    id: issuer.id,
    user_id: issuer.userId,
    name: issuer.name,
    legal_name: issuer.legalName,
    logo_url: issuer.logoUrl,
    logo_file_name: issuer.logoFileName,
    logo_storage_path: issuer.logoStoragePath,
    address: issuer.address,
    phone: issuer.phone,
    email: issuer.email,
    registration_number: issuer.registrationNumber,
    bank_account: issuer.bankAccount,
    contact_person: issuer.contactPerson,
    seal_url: issuer.sealUrl,
    seal_file_name: issuer.sealFileName,
    seal_storage_path: issuer.sealStoragePath,
    default_tax_rate: issuer.defaultTaxRate === '' ? null : Number(issuer.defaultTaxRate),
    default_payment_terms: issuer.defaultPaymentTerms,
    default_delivery_terms: issuer.defaultDeliveryTerms,
    default_remarks: issuer.defaultRemarks,
    default_pdf_template: issuer.defaultPdfTemplate,
    is_default: issuer.isDefault,
    is_active: issuer.isActive,
    created_at: issuer.createdAt,
    updated_at: issuer.updatedAt,
  };
}

function fromRow(row) {
  return normalizeIssuer({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    legalName: row.legal_name,
    logoUrl: row.logo_url,
    logoFileName: row.logo_file_name,
    logoStoragePath: row.logo_storage_path,
    address: row.address,
    phone: row.phone,
    email: row.email,
    registrationNumber: row.registration_number,
    bankAccount: row.bank_account,
    contactPerson: row.contact_person,
    sealUrl: row.seal_url,
    sealFileName: row.seal_file_name,
    sealStoragePath: row.seal_storage_path,
    defaultTaxRate: row.default_tax_rate ?? DEFAULT_ISSUER_TAX_RATE,
    defaultPaymentTerms: row.default_payment_terms,
    defaultDeliveryTerms: row.default_delivery_terms,
    defaultRemarks: row.default_remarks,
    defaultPdfTemplate: row.default_pdf_template,
    isDefault: row.is_default,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const useIssuers = createRecordHook({
  tableName: 'issuers',
  storageKey: 'eigyo-techo-issuers',
  normalize: normalizeIssuer,
  toRow,
  fromRow,
});
