import { hasSupabaseConfig, supabase } from '../../lib/supabase.js';
import { getTableOrderColumn } from '../config/TABLE_CONFIG.js';

const SUPABASE_UNAVAILABLE_MESSAGE = 'Supabase is not available.';

export function canUseCloud() {
  return hasSupabaseConfig && Boolean(supabase) && isOnline();
}

export function hasCloudConfig() {
  return hasSupabaseConfig && Boolean(supabase);
}

export async function fetchRecords(tableName, userId = '', fromRow = (row) => row, orderColumn = '') {
  if (!canUseCloud()) {
    throw new Error(SUPABASE_UNAVAILABLE_MESSAGE);
  }

  const resolvedOrderColumn = getTableOrderColumn(tableName, orderColumn);
  let query = supabase
    .from(tableName)
    .select('*')
    .order(resolvedOrderColumn, { ascending: false });

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
  if (!Array.isArray(records) || records.length === 0) {
    return;
  }

  if (!canUseCloud()) {
    throw new Error(SUPABASE_UNAVAILABLE_MESSAGE);
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
    throw new Error(SUPABASE_UNAVAILABLE_MESSAGE);
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

function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
