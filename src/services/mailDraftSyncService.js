import { hasSupabaseConfig, supabase } from '../lib/supabase.js';

const TABLE_NAME = 'mail_drafts';
export const MAIL_DRAFT_LOCAL_STORAGE_KEY = 'eigyo-techo-mail-drafts';

const CLOUD_REQUIRED_MESSAGE = 'Supabaseに接続できないため、メール下書きを保存・取得できません。ネットワークと設定を確認してください。';

function canUseSupabase() {
  return hasSupabaseConfig && Boolean(supabase) && isOnline();
}

function ensureSupabase() {
  if (!canUseSupabase()) {
    throw new Error(CLOUD_REQUIRED_MESSAGE);
  }
}

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

export function readLegacyMailDrafts(customerId = '', userId = '') {
  const read = readLocalArray(MAIL_DRAFT_LOCAL_STORAGE_KEY);
  return read.records
    .map((draft) => normalizeMailDraft(draft, userId))
    .filter((draft) => {
      const matchesCustomer = !customerId || draft.customerId === customerId;
      const matchesUser = !userId || !draft.userId || draft.userId === userId;
      return matchesCustomer && matchesUser;
    });
}

export function hasLegacyMailDrafts(userId = '') {
  return readLegacyMailDrafts('', userId).length > 0;
}

export async function fetchMailDrafts(customerId = '', userId = '') {
  ensureSupabase();

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

  return (data ?? []).map((row) => fromSupabaseRow(row, userId));
}

export async function upsertMailDrafts(drafts, userId = '') {
  ensureSupabase();

  const normalizedDrafts = drafts.map((draft) => normalizeMailDraft(draft, userId));
  if (normalizedDrafts.length === 0) {
    return [];
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
  ensureSupabase();

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

export async function buildMailDraftLegacyMigrationPreview(userId = '') {
  const localRead = readLocalArray(MAIL_DRAFT_LOCAL_STORAGE_KEY);
  const localDrafts = readLegacyMailDrafts('', userId);
  const remoteDrafts = await fetchMailDrafts('', userId);
  const conflicts = localDrafts
    .map((draft) => buildConflict(draft, findDuplicateDraft(draft, remoteDrafts)))
    .filter(Boolean);

  return {
    local: {
      drafts: localDrafts,
    },
    remote: {
      drafts: remoteDrafts,
    },
    counts: {
      localDrafts: localDrafts.length,
      remoteDrafts: remoteDrafts.length,
      duplicateDrafts: conflicts.length,
    },
    conflicts,
    errors: {
      drafts: localRead.error,
    },
  };
}

export async function migrateMailDraftLegacyLocalData({
  userId = '',
  preview,
  conflictActions = {},
}) {
  ensureSupabase();

  const localDrafts = preview?.local?.drafts ?? readLegacyMailDrafts('', userId);
  const remoteDrafts = preview?.remote?.drafts ?? await fetchMailDrafts('', userId);
  const results = [];
  const now = new Date().toISOString();

  for (const draft of localDrafts) {
    const duplicate = findDuplicateDraft(draft, remoteDrafts);
    const action = duplicate ? conflictActions[draft.id] || 'skip' : 'create';

    if (action === 'skip') {
      results.push(resultRecord(draft, 'skipped', duplicate ? '重複候補のためスキップしました。' : 'スキップしました。'));
      continue;
    }

    const nextId = action === 'create' && duplicate ? crypto.randomUUID() : duplicate?.id || draft.id;
    const draftForSave = normalizeMailDraft({
      ...(action === 'update' && duplicate ? duplicate : {}),
      ...draft,
      id: nextId,
      userId,
      createdAt: action === 'update' && duplicate ? duplicate.createdAt : draft.createdAt || now,
      updatedAt: now,
    }, userId);

    try {
      await supabase
        .from(TABLE_NAME)
        .upsert([toSupabaseRow(draftForSave)], { onConflict: 'id' })
        .throwOnError();
      results.push(resultRecord(draftForSave, 'success', action === 'update' ? '既存下書きを更新しました。' : '新規下書きとして移行しました。'));
    } catch (error) {
      results.push(resultRecord(draft, 'failed', error.message || '保存に失敗しました。'));
    }
  }

  return {
    drafts: results,
  };
}

export function deleteMailDraftLegacyLocalData() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.removeItem(MAIL_DRAFT_LOCAL_STORAGE_KEY);
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

function normalizeMailDraft(draft, userId = '') {
  const now = new Date().toISOString();

  return {
    id: draft.id ?? crypto.randomUUID(),
    userId: draft.userId ?? draft.user_id ?? userId,
    customerId: draft.customerId ?? draft.customer_id ?? '',
    customerName: draft.customerName ?? draft.customer_name ?? '',
    title: draft.title ?? 'メール案',
    subject: draft.subject ?? '',
    body: draft.body ?? '',
    productName: draft.productName ?? draft.product_name ?? '',
    purpose: draft.purpose ?? '',
    source: draft.source ?? 'Template',
    createdAt: draft.createdAt ?? draft.created_at ?? now,
    updatedAt: draft.updatedAt ?? draft.updated_at ?? now,
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

function findDuplicateDraft(localDraft, remoteDrafts) {
  return remoteDrafts.find((remoteDraft) => duplicateReasons(localDraft, remoteDraft).length > 0) || null;
}

function duplicateReasons(localDraft, remoteDraft) {
  const reasons = [];
  if (localDraft.id && remoteDraft.id === localDraft.id) {
    reasons.push('id');
  }
  if (
    localDraft.subject &&
    remoteDraft.subject === localDraft.subject &&
    remoteDraft.body === localDraft.body &&
    (remoteDraft.customerId || '') === (localDraft.customerId || '')
  ) {
    reasons.push('顧客 + 件名 + 本文');
  }
  return reasons;
}

function buildConflict(localDraft, duplicate) {
  return duplicate
    ? {
        localId: localDraft.id,
        localName: localDraft.subject || localDraft.title || '(件名なし)',
        remoteId: duplicate.id,
        remoteName: duplicate.subject || duplicate.title || '(件名なし)',
        reasons: duplicateReasons(localDraft, duplicate),
        action: 'skip',
      }
    : null;
}

function resultRecord(draft, status, detail = '') {
  return {
    type: 'メール下書き',
    name: draft.subject || draft.title || '(件名なし)',
    status,
    detail,
  };
}

function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
