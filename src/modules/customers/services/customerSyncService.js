import { hasSupabaseConfig, supabase } from '../../../lib/supabase.js';
import { normalizeBusinessCode } from '../../../shared/utils/businessCode.js';

const TABLE_NAME = 'customers';

export function canUseSupabase() {
  return hasSupabaseConfig && Boolean(supabase) && isOnline();
}

export function hasCloudConfig() {
  return hasSupabaseConfig && Boolean(supabase);
}

export async function fetchRemoteCustomers(userId = '') {
  if (!canUseSupabase()) {
    return [];
  }

  let query = supabase
    .from(TABLE_NAME)
    .select('*')
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    if (userId && isMissingColumnError(error, 'user_id')) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });

      if (!fallbackError) {
        return (fallbackData ?? []).map(fromSupabaseRow);
      }
    }

    throw error;
  }

  return (data ?? []).map(fromSupabaseRow);
}

export async function upsertRemoteCustomers(customers) {
  if (!canUseSupabase() || customers.length === 0) {
    return;
  }

  let rows = customers.map(toSupabaseRow);
  const omittedColumns = new Set();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert(rows, { onConflict: 'id' });

    if (!error) {
      return;
    }

    const missingColumn = getMissingColumnName(error);

    if (!missingColumn || omittedColumns.has(missingColumn)) {
      throw error;
    }

    omittedColumns.add(missingColumn);
    rows = rows.map(({ [missingColumn]: _omitted, ...row }) => row);
  }
}

export async function upsertRemoteCustomer(customer) {
  await upsertRemoteCustomers([customer]);
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
    user_id: customer.userId,
    customer_code: normalizeBusinessCode(customer.customerCode) || null,
    place_id: customer.placeId,
    corporate_number: customer.corporateNumber,
    company_name: customer.companyName,
    company_kana: customer.companyKana,
    industry: customer.industry,
    area: customer.area,
    address: customer.address,
    postal_code: customer.postalCode,
    phone: customer.phone,
    fax: customer.fax,
    website: customer.website,
    email: customer.email,
    email_type: customer.emailType,
    inquiry_url: customer.inquiryUrl,
    status: customer.status,
    tags: customer.tags,
    memo: customer.memo,
    company_note: customer.companyNote,
    next_follow_up_date: customer.nextFollowUpDate || customer.nextFollowDate || null,
    sales_owner: customer.salesOwner,
    default_issuer_id: customer.defaultIssuerId,
    importance_rank: customer.importanceRank,
    referral_source: customer.referralSource,
    prospect_rank: customer.prospectRank,
    payment_terms: customer.paymentTerms,
    closing_day: customer.closingDay,
    delivery_destination: customer.deliveryDestination,
    billing_destination: customer.billingDestination,
    credit_memo: customer.creditMemo,
    is_do_not_contact: customer.isDoNotContact,
    do_not_contact_reason: customer.doNotContactReason,
    deal_histories: customer.dealHistories,
    proposed_products: customer.proposedProducts,
    source: customer.source,
    contact_status: customer.contactStatus,
    last_contact_date: customer.lastContactDate || null,
    next_follow_date: customer.nextFollowUpDate || customer.nextFollowDate || null,
    pipeline_memo: customer.pipelineMemo,
    score: customer.score,
    rank: customer.customerRank || customer.rank,
    score_reasons: customer.scoreReasons,
    created_at: customer.createdAt,
    updated_at: customer.updatedAt ?? new Date().toISOString(),
  };
}

function fromSupabaseRow(row) {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId ?? '',
    customerCode: row.customer_code ?? row.customerCode ?? '',
    placeId: row.place_id ?? row.placeId ?? '',
    corporateNumber: row.corporate_number ?? row.corporateNumber ?? '',
    companyName: row.company_name ?? row.companyName ?? '',
    companyKana: row.company_kana ?? row.companyKana ?? '',
    industry: row.industry ?? '',
    area: row.area ?? '',
    address: row.address ?? '',
    postalCode: row.postal_code ?? row.postalCode ?? '',
    phone: row.phone ?? '',
    fax: row.fax ?? '',
    website: row.website ?? '',
    email: row.email ?? '',
    emailType: row.email_type ?? row.emailType ?? '',
    inquiryUrl: row.inquiry_url ?? row.inquiryUrl ?? '',
    status: row.status ?? '未接触',
    tags: row.tags ?? [],
    memo: row.memo ?? '',
    companyNote: row.company_note ?? row.companyNote ?? '',
    nextFollowUpDate: row.next_follow_up_date ?? row.nextFollowUpDate ?? row.next_follow_date ?? '',
    salesOwner: row.sales_owner ?? row.salesOwner ?? '',
    defaultIssuerId: row.default_issuer_id ?? row.defaultIssuerId ?? '',
    importanceRank: row.importance_rank ?? row.importanceRank ?? '',
    referralSource: row.referral_source ?? row.referralSource ?? '',
    prospectRank: row.prospect_rank ?? row.prospectRank ?? '',
    paymentTerms: row.payment_terms ?? row.paymentTerms ?? '',
    closingDay: row.closing_day ?? row.closingDay ?? '',
    deliveryDestination: row.delivery_destination ?? row.deliveryDestination ?? '',
    billingDestination: row.billing_destination ?? row.billingDestination ?? '',
    creditMemo: row.credit_memo ?? row.creditMemo ?? '',
    isDoNotContact: Boolean(row.is_do_not_contact ?? row.isDoNotContact ?? false),
    doNotContactReason: row.do_not_contact_reason ?? row.doNotContactReason ?? '',
    dealHistories: row.deal_histories ?? row.dealHistories ?? [],
    proposedProducts: row.proposed_products ?? row.proposedProducts ?? [],
    source: row.source ?? 'Supabase',
    contactStatus: row.contact_status ?? row.contactStatus ?? '未取得',
    lastContactDate: row.last_contact_date ?? row.lastContactDate ?? '',
    nextFollowDate: row.next_follow_up_date ?? row.next_follow_date ?? row.nextFollowDate ?? '',
    pipelineMemo: row.pipeline_memo ?? row.pipelineMemo ?? '',
    score: row.score ?? 0,
    rank: row.rank ?? 'D',
    customerRank: row.customer_rank ?? row.customerRank ?? row.rank ?? 'D',
    scoreReasons: row.score_reasons ?? row.scoreReasons ?? [],
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.updatedAt ?? '',
  };
}

function isMissingColumnError(error, columnName) {
  const message = error?.message || error?.details || '';
  return message.includes(columnName) && message.includes('column');
}

function getMissingColumnName(error) {
  const message = error?.message || error?.details || '';
  const match =
    message.match(/column ["']?([a-zA-Z0-9_]+)["']?/) ||
    message.match(/Could not find the '([^']+)' column/);

  return match?.[1] || '';
}

function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
