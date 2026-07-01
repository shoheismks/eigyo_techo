import { createRecordHook } from '../shared/hooks/useSupabaseRecords.js';
import { calculateImportanceScore } from '../services/importanceScoringService.js';

export const emptyContact = {
  userId: '',
  customerId: '',
  companyName: '',
  name: '',
  department: '',
  role: '',
  companySize: '',
  email: '',
  phone: '',
  mobile: '',
  decisionPower: '',
  memo: '',
  tags: [],
  importanceScore: 0,
  importanceRank: 'D',
  importanceReasons: [],
};

export function normalizeContact(contact = {}, userId = '') {
  const score = calculateImportanceScore({
    companySize: contact.companySize ?? '',
    role: contact.role ?? '',
    tags: Array.isArray(contact.tags) ? contact.tags : [],
  });

  return {
    ...emptyContact,
    ...contact,
    id: contact.id ?? crypto.randomUUID(),
    userId: contact.userId ?? userId,
    tags: Array.isArray(contact.tags) ? contact.tags : [],
    ...score,
    createdAt: contact.createdAt ?? new Date().toISOString(),
    updatedAt: contact.updatedAt ?? new Date().toISOString(),
  };
}

function toRow(contact) {
  return {
    id: contact.id,
    user_id: contact.userId,
    customer_id: contact.customerId,
    company_name: contact.companyName,
    name: contact.name,
    department: contact.department,
    role: contact.role,
    company_size: contact.companySize,
    email: contact.email,
    phone: contact.phone,
    mobile: contact.mobile,
    decision_power: contact.decisionPower,
    memo: contact.memo,
    tags: contact.tags,
    importance_score: contact.importanceScore,
    importance_rank: contact.importanceRank,
    importance_reasons: contact.importanceReasons,
    created_at: contact.createdAt,
    updated_at: contact.updatedAt,
  };
}

function fromRow(row) {
  return normalizeContact({
    id: row.id,
    userId: row.user_id,
    customerId: row.customer_id,
    companyName: row.company_name,
    name: row.name,
    department: row.department,
    role: row.role,
    companySize: row.company_size,
    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    decisionPower: row.decision_power,
    memo: row.memo,
    tags: row.tags,
    importanceScore: row.importance_score,
    importanceRank: row.importance_rank,
    importanceReasons: row.importance_reasons,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const useContacts = createRecordHook({
  tableName: 'contacts',
  storageKey: 'eigyo-techo-contacts',
  normalize: normalizeContact,
  toRow,
  fromRow,
});
