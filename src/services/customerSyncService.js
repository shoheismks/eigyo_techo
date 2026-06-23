import { hasSupabaseConfig, supabase } from '../lib/supabase.js';

const TABLE_NAME = 'customers';

export function canUseSupabase() {
  return hasSupabaseConfig && Boolean(supabase) && navigator.onLine;
}

export async function fetchRemoteCustomers() {
  if (!canUseSupabase()) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(fromSupabaseRow);
}

export async function upsertRemoteCustomers(customers) {
  if (!canUseSupabase() || customers.length === 0) {
    return;
  }

  const rows = customers.map(toSupabaseRow);
  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    throw error;
  }
}

export async function deleteRemoteCustomer(id) {
  if (!canUseSupabase()) {
    return;
  }

  const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);

  if (error) {
    throw error;
  }
}

export function mergeCustomers(localCustomers, remoteCustomers) {
  const merged = new Map();

  [...remoteCustomers, ...localCustomers].forEach((customer) => {
    const key = customer.id || `${customer.companyName}-${customer.address}`;
    const current = merged.get(key);

    if (!current || isNewer(customer, current)) {
      merged.set(key, customer);
    }
  });

  return [...merged.values()];
}

function isNewer(a, b) {
  return new Date(a.updatedAt ?? a.createdAt ?? 0).getTime() >=
    new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
}

function toSupabaseRow(customer) {
  return {
    id: customer.id,
    place_id: customer.placeId,
    company_name: customer.companyName,
    industry: customer.industry,
    area: customer.area,
    address: customer.address,
    phone: customer.phone,
    website: customer.website,
    email: customer.email,
    email_type: customer.emailType,
    inquiry_url: customer.inquiryUrl,
    status: customer.status,
    memo: customer.memo,
    source: customer.source,
    contact_status: customer.contactStatus,
    last_contact_date: customer.lastContactDate || null,
    next_follow_date: customer.nextFollowDate || null,
    pipeline_memo: customer.pipelineMemo,
    score: customer.score,
    rank: customer.rank,
    score_reasons: customer.scoreReasons,
    created_at: customer.createdAt,
    updated_at: customer.updatedAt ?? new Date().toISOString(),
  };
}

function fromSupabaseRow(row) {
  return {
    id: row.id,
    placeId: row.place_id ?? row.placeId ?? '',
    companyName: row.company_name ?? row.companyName ?? '',
    industry: row.industry ?? '',
    area: row.area ?? '',
    address: row.address ?? '',
    phone: row.phone ?? '',
    website: row.website ?? '',
    email: row.email ?? '',
    emailType: row.email_type ?? row.emailType ?? '',
    inquiryUrl: row.inquiry_url ?? row.inquiryUrl ?? '',
    status: row.status ?? '未接触',
    memo: row.memo ?? '',
    source: row.source ?? 'Supabase',
    contactStatus: row.contact_status ?? row.contactStatus ?? '未取得',
    lastContactDate: row.last_contact_date ?? row.lastContactDate ?? '',
    nextFollowDate: row.next_follow_date ?? row.nextFollowDate ?? '',
    pipelineMemo: row.pipeline_memo ?? row.pipelineMemo ?? '',
    score: row.score ?? 0,
    rank: row.rank ?? '★☆☆☆☆',
    scoreReasons: row.score_reasons ?? row.scoreReasons ?? [],
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.updatedAt ?? '',
  };
}
