import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';
import { PROJECT_PRIORITIES, PROJECT_STATUSES, PROJECT_TYPES } from '../constants.js';

export const emptyProject = {
  userId: '',
  title: '',
  customerId: '',
  supplierId: '',
  contactIds: [],
  type: '新規提案',
  status: 'リード',
  priority: '通常',
  ownerUserId: '',
  productIds: [],
  inventoryIds: [],
  quoteIds: [],
  sampleIds: [],
  complaintIds: [],
  startDate: '',
  expectedCloseDate: '',
  nextActionDate: '',
  expectedSales: '',
  expectedGrossProfit: '',
  expectedOperatingProfit: '',
  memo: '',
  createdBy: '',
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function validOption(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

export function normalizeProject(project = {}, userId = '') {
  return {
    ...emptyProject,
    ...project,
    id: project.id ?? crypto.randomUUID(),
    userId: project.userId ?? userId,
    title: project.title ?? '',
    customerId: project.customerId ?? '',
    supplierId: project.supplierId ?? '',
    contactIds: asArray(project.contactIds),
    type: validOption(project.type, PROJECT_TYPES, '新規提案'),
    status: validOption(project.status, PROJECT_STATUSES, 'リード'),
    priority: validOption(project.priority, PROJECT_PRIORITIES, '通常'),
    ownerUserId: project.ownerUserId ?? '',
    productIds: asArray(project.productIds),
    inventoryIds: asArray(project.inventoryIds),
    quoteIds: asArray(project.quoteIds),
    sampleIds: asArray(project.sampleIds),
    complaintIds: asArray(project.complaintIds),
    startDate: project.startDate ?? '',
    expectedCloseDate: project.expectedCloseDate ?? '',
    nextActionDate: project.nextActionDate ?? '',
    expectedSales: project.expectedSales ?? '',
    expectedGrossProfit: project.expectedGrossProfit ?? '',
    expectedOperatingProfit: project.expectedOperatingProfit ?? '',
    memo: project.memo ?? '',
    createdBy: project.createdBy ?? userId,
    createdAt: project.createdAt ?? new Date().toISOString(),
    updatedAt: project.updatedAt ?? new Date().toISOString(),
  };
}

function toRow(project) {
  return {
    id: project.id,
    user_id: project.userId,
    title: project.title,
    customer_id: project.customerId || null,
    supplier_id: project.supplierId || null,
    contact_ids: project.contactIds,
    type: project.type,
    status: project.status,
    priority: project.priority,
    owner_user_id: project.ownerUserId,
    product_ids: project.productIds,
    inventory_ids: project.inventoryIds,
    quote_ids: project.quoteIds,
    sample_ids: project.sampleIds,
    complaint_ids: project.complaintIds,
    start_date: project.startDate || null,
    expected_close_date: project.expectedCloseDate || null,
    next_action_date: project.nextActionDate || null,
    expected_sales: project.expectedSales === '' ? null : Number(project.expectedSales),
    expected_gross_profit: project.expectedGrossProfit === '' ? null : Number(project.expectedGrossProfit),
    expected_operating_profit: project.expectedOperatingProfit === '' ? null : Number(project.expectedOperatingProfit),
    memo: project.memo,
    created_by: project.createdBy,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };
}

function fromRow(row) {
  return normalizeProject({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    customerId: row.customer_id,
    supplierId: row.supplier_id,
    contactIds: row.contact_ids,
    type: row.type,
    status: row.status,
    priority: row.priority,
    ownerUserId: row.owner_user_id,
    productIds: row.product_ids,
    inventoryIds: row.inventory_ids,
    quoteIds: row.quote_ids,
    sampleIds: row.sample_ids,
    complaintIds: row.complaint_ids,
    startDate: row.start_date,
    expectedCloseDate: row.expected_close_date,
    nextActionDate: row.next_action_date,
    expectedSales: row.expected_sales ?? '',
    expectedGrossProfit: row.expected_gross_profit ?? '',
    expectedOperatingProfit: row.expected_operating_profit ?? '',
    memo: row.memo,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const useProjects = createRecordHook({
  tableName: 'projects',
  storageKey: 'eigyo-techo-projects',
  normalize: normalizeProject,
  toRow,
  fromRow,
});
