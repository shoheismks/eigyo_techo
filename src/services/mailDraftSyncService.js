import { hasSupabaseConfig, supabase } from '../lib/supabase.js';

const TABLE_NAME = 'mail_drafts';
const STORAGE_KEY = 'eigyo-techo-mail-drafts';

function canUseSupabase() {
  return hasSupabaseConfig && Boolean(supabase) && isOnline();
}

export function readLocalMailDrafts(customerId = '', userId = '') {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const drafts = saved
      ? JSON.parse(saved).map((draft) => normalizeMailDraft(draft, userId))
      : [];
    return drafts.filter((draft) => {
      const matchesCustomer = !customerId || draft.customerId === customerId;
      const matchesUser = !userId || draft.userId === userId;
      return matchesCustomer && matchesUser;
    });
  } catch {
    return [];
  }
}

export function saveLocalMailDrafts(drafts) {
  const normalizedDrafts = drafts.map((draft) => normalizeMailDraft(draft));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedDrafts));
}

export async function fetchMailDrafts(customerId = '', userId = '') {
  if (!canUseSupabase()) {
    return readLocalMailDrafts(customerId, userId);
  }

  let query = supabase
    .from(TABLE_NAME)
    .select('*')
    .order('created_at', { ascending: false });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const drafts = (data ?? []).map((row) => fromSupabaseRow(row, userId));
  mergeLocalMailDrafts(drafts, userId);
  return drafts;
}

export async function upsertMailDrafts(drafts, userId = '') {
  const normalizedDrafts = drafts.map((draft) => normalizeMailDraft(draft, userId));
  mergeLocalMailDrafts(normalizedDrafts, userId);

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
  return fetchMailDrafts(customerId, userId);
}

export async function deleteMailDraft(id, userId = '') {
  const remainingDrafts = readLocalMailDrafts('', userId).filter((draft) => draft.id !== id);
  saveLocalMailDrafts(remainingDrafts);

  if (!canUseSupabase()) {
    return remainingDrafts;
  }

  let query = supabase.from(TABLE_NAME).delete().eq('id', id);
  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { error } = await query;

  if (error) {
    throw error;
  }

  return fetchMailDrafts('', userId);
}

export function normalizeGeneratedDrafts({ customer, drafts, productName, purpose, source, userId = '' }) {
  const createdAt = new Date().toISOString();
  const draftUserId = userId || customer.userId || '';

  return drafts.map((draft) =>
    normalizeMailDraft({
      ...draft,
      id: `${customer.id}-${draft.id}-${Date.now()}`,
      userId: draftUserId,
      customerId: customer.id,
      customerName: customer.companyName,
      productName,
      purpose,
      source,
      createdAt,
      updatedAt: createdAt,
    }, draftUserId),
  );
}

function mergeLocalMailDrafts(incomingDrafts, userId = '') {
  const merged = new Map();
  [...readLocalMailDrafts('', userId), ...incomingDrafts].forEach((draft) => {
    merged.set(draft.id, normalizeMailDraft(draft, userId));
  });
  saveLocalMailDrafts([...merged.values()]);
}

function normalizeMailDraft(draft, userId = '') {
  const now = new Date().toISOString();

  return {
    id: draft.id ?? crypto.randomUUID(),
    userId: draft.userId ?? userId,
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
    user_id: draft.userId,
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

function fromSupabaseRow(row, userId = '') {
  return normalizeMailDraft({
    id: row.id,
    userId: row.user_id ?? row.userId ?? userId,
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
  }, userId);
}

function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
