import { hasSupabaseConfig, supabase } from '../lib/supabase.js';

const TABLE_NAME = 'mail_drafts';
const STORAGE_KEY = 'eigyo-techo-mail-drafts';

function canUseSupabase() {
  return hasSupabaseConfig && Boolean(supabase) && navigator.onLine;
}

export function readLocalMailDrafts(customerId = '') {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const drafts = saved ? JSON.parse(saved).map(normalizeMailDraft) : [];
    return customerId ? drafts.filter((draft) => draft.customerId === customerId) : drafts;
  } catch {
    return [];
  }
}

export function saveLocalMailDrafts(drafts) {
  const normalizedDrafts = drafts.map(normalizeMailDraft);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedDrafts));
}

export async function fetchMailDrafts(customerId = '') {
  if (!canUseSupabase()) {
    return readLocalMailDrafts(customerId);
  }

  let query = supabase
    .from(TABLE_NAME)
    .select('*')
    .order('created_at', { ascending: false });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const drafts = (data ?? []).map(fromSupabaseRow);
  mergeLocalMailDrafts(drafts);
  return drafts;
}

export async function upsertMailDrafts(drafts) {
  const normalizedDrafts = drafts.map(normalizeMailDraft);
  mergeLocalMailDrafts(normalizedDrafts);

  if (!canUseSupabase() || normalizedDrafts.length === 0) {
    return normalizedDrafts;
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert(normalizedDrafts.map(toSupabaseRow), { onConflict: 'id' });

  if (error) {
    throw error;
  }

  const customerId = normalizedDrafts[0]?.customerId ?? '';
  return fetchMailDrafts(customerId);
}

export async function deleteMailDraft(id) {
  const remainingDrafts = readLocalMailDrafts().filter((draft) => draft.id !== id);
  saveLocalMailDrafts(remainingDrafts);

  if (!canUseSupabase()) {
    return remainingDrafts;
  }

  const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);

  if (error) {
    throw error;
  }

  return fetchMailDrafts();
}

export function normalizeGeneratedDrafts({ customer, drafts, productName, purpose, source }) {
  const createdAt = new Date().toISOString();

  return drafts.map((draft) =>
    normalizeMailDraft({
      ...draft,
      id: `${customer.id}-${draft.id}-${Date.now()}`,
      customerId: customer.id,
      customerName: customer.companyName,
      productName,
      purpose,
      source,
      createdAt,
      updatedAt: createdAt,
    }),
  );
}

function mergeLocalMailDrafts(incomingDrafts) {
  const merged = new Map();
  [...readLocalMailDrafts(), ...incomingDrafts].forEach((draft) => {
    merged.set(draft.id, normalizeMailDraft(draft));
  });
  saveLocalMailDrafts([...merged.values()]);
}

function normalizeMailDraft(draft) {
  const now = new Date().toISOString();

  return {
    id: draft.id ?? crypto.randomUUID(),
    customerId: draft.customerId ?? '',
    customerName: draft.customerName ?? '',
    title: draft.title ?? 'メール案',
    subject: draft.subject ?? '',
    body: draft.body ?? '',
    productName: draft.productName ?? '',
    purpose: draft.purpose ?? '',
    source: draft.source ?? 'Template',
    createdAt: draft.createdAt ?? now,
    updatedAt: draft.updatedAt ?? now,
  };
}

function toSupabaseRow(draft) {
  return {
    id: draft.id,
    customer_id: draft.customerId,
    customer_name: draft.customerName,
    title: draft.title,
    subject: draft.subject,
    body: draft.body,
    product_name: draft.productName,
    purpose: draft.purpose,
    source: draft.source,
    created_at: draft.createdAt,
    updated_at: draft.updatedAt ?? new Date().toISOString(),
  };
}

function fromSupabaseRow(row) {
  return normalizeMailDraft({
    id: row.id,
    customerId: row.customer_id ?? '',
    customerName: row.customer_name ?? '',
    title: row.title ?? '',
    subject: row.subject ?? '',
    body: row.body ?? '',
    productName: row.product_name ?? '',
    purpose: row.purpose ?? '',
    source: row.source ?? '',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  });
}
