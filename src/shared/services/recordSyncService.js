import { hasSupabaseConfig, supabase } from '../../lib/supabase.js';

export function canUseCloud() {
  return hasSupabaseConfig && Boolean(supabase) && navigator.onLine;
}

export function hasCloudConfig() {
  return hasSupabaseConfig && Boolean(supabase);
}

export async function fetchRecords(tableName, userId = '', fromRow = (row) => row) {
  if (!canUseCloud()) {
    return [];
  }

  let query = supabase
    .from(tableName)
    .select('*')
    .order('updated_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map(fromRow);
}

export async function upsertRecords(tableName, records, toRow = (record) => record) {
  if (!canUseCloud() || records.length === 0) {
    return;
  }

  const { error } = await supabase
    .from(tableName)
    .upsert(records.map(toRow), { onConflict: 'id' });

  if (error) {
    throw error;
  }
}

export async function deleteRecord(tableName, id, userId = '') {
  if (!canUseCloud()) {
    return;
  }

  let query = supabase.from(tableName).delete().eq('id', id);
  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { error } = await query;
  if (error) {
    throw error;
  }
}

export function mergeByUpdatedAt(localRecords, remoteRecords) {
  const merged = new Map();

  [...remoteRecords, ...localRecords].forEach((record) => {
    const current = merged.get(record.id);
    if (!current || getTime(record) >= getTime(current)) {
      merged.set(record.id, record);
    }
  });

  return [...merged.values()];
}

export function getLocalSyncReason(fallback = '') {
  if (!hasCloudConfig()) {
    return 'Supabase設定がないため、LocalStorageバックアップで動作しています。';
  }

  if (!navigator.onLine) {
    return 'オフラインのため、LocalStorageバックアップで動作しています。';
  }

  return fallback || 'Supabase接続に失敗したため、LocalStorageバックアップで動作しています。';
}

function getTime(record) {
  return new Date(record.updatedAt ?? record.updated_at ?? record.createdAt ?? record.created_at ?? 0).getTime();
}
