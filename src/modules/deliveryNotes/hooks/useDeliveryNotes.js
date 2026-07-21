import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { canUseCloud, getLocalSyncReason } from '../../../shared/services/recordSyncService.js';
import { parsePrice } from '../../products/hooks/useProducts.js';

const STORAGE_KEY = 'eigyo-techo-delivery-notes';

export const DELIVERY_NOTE_STATUSES = ['Draft', 'Issued', 'Reissued', 'Cancelled'];

export const DELIVERY_NOTE_STATUS_LABELS = {
  Draft: '下書き',
  Issued: '発行済み',
  Reissued: '再発行',
  Cancelled: '取消',
};

function nowIso() {
  return new Date().toISOString();
}

function numberOrZero(value) {
  const parsed = parsePrice(value);
  return parsed === '' ? 0 : parsed;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeLine(line = {}, userId = '', noteId = '') {
  const productSnapshot = line.productSnapshot ?? line.product_snapshot ?? {};
  const quantity = numberOrZero(line.quantity);
  const unitPrice = line.unitPrice ?? line.unit_price ?? '';
  const amount = line.amount ?? (unitPrice === '' ? '' : quantity * numberOrZero(unitPrice));
  const taxRate = line.taxRate ?? line.tax_rate ?? '';

  return {
    id: line.id ?? crypto.randomUUID(),
    userId: line.userId ?? line.user_id ?? userId,
    deliveryNoteId: line.deliveryNoteId ?? line.delivery_note_id ?? noteId,
    shipmentLineId: line.shipmentLineId ?? line.shipment_line_id ?? '',
    productId: line.productId ?? line.product_id ?? productSnapshot.productId ?? '',
    productSnapshot,
    productCode: line.productCode ?? productSnapshot.productCode ?? '',
    productName: line.productName ?? productSnapshot.productName ?? '',
    brandId: line.brandId ?? line.brand_id ?? productSnapshot.brandId ?? '',
    brandName: line.brandName ?? line.brand_name ?? productSnapshot.brandName ?? '',
    specification: line.specification ?? productSnapshot.specification ?? '',
    temperatureZone: line.temperatureZone ?? productSnapshot.temperatureZone ?? '',
    quantity: line.quantity ?? '',
    unit: line.unit ?? '',
    unitPrice,
    amount,
    taxRate,
    taxAmount: line.taxAmount ?? line.tax_amount ?? (amount === '' || taxRate === '' ? '' : Math.round(numberOrZero(amount) * (numberOrZero(taxRate) / 100))),
    lotSnapshot: line.lotSnapshot ?? line.lot_snapshot ?? null,
    expirySnapshot: line.expirySnapshot ?? line.expiry_snapshot ?? productSnapshot.expirationText ?? '',
    createdAt: line.createdAt ?? line.created_at ?? nowIso(),
  };
}

export function normalizeDeliveryNote(note = {}, userId = '') {
  const id = note.id ?? crypto.randomUUID();
  return {
    id,
    userId: note.userId ?? note.user_id ?? userId,
    deliveryNoteNumber: note.deliveryNoteNumber ?? note.delivery_note_number ?? '',
    shipmentId: note.shipmentId ?? note.shipment_id ?? '',
    salesOrderId: note.salesOrderId ?? note.sales_order_id ?? '',
    customerId: note.customerId ?? note.customer_id ?? '',
    issueDate: note.issueDate ?? note.issue_date ?? '',
    deliveryDate: note.deliveryDate ?? note.delivery_date ?? '',
    priceVisible: Boolean(note.priceVisible ?? note.price_visible ?? false),
    status: DELIVERY_NOTE_STATUSES.includes(note.status) ? note.status : 'Issued',
    snapshot: note.snapshot ?? {},
    deliveryNotePdfUrl: note.deliveryNotePdfUrl ?? note.delivery_note_pdf_url ?? '',
    deliveryNotePdfFileName: note.deliveryNotePdfFileName ?? note.delivery_note_pdf_file_name ?? '',
    deliveryNotePdfStoragePath: note.deliveryNotePdfStoragePath ?? note.delivery_note_pdf_storage_path ?? '',
    deliveryNotePdfGeneratedAt: note.deliveryNotePdfGeneratedAt ?? note.delivery_note_pdf_generated_at ?? '',
    deliveryNotePdfHistory: asArray(note.deliveryNotePdfHistory ?? note.delivery_note_pdf_history),
    deliveryNoteLines: asArray(note.deliveryNoteLines ?? note.delivery_note_lines ?? note.lines).map((line) => normalizeLine(line, userId, id)),
    createdBy: note.createdBy ?? note.created_by ?? userId,
    createdByName: note.createdByName ?? note.created_by_name ?? '',
    updatedBy: note.updatedBy ?? note.updated_by ?? '',
    updatedByName: note.updatedByName ?? note.updated_by_name ?? '',
    isDeleted: Boolean(note.isDeleted ?? note.is_deleted ?? false),
    deletedAt: note.deletedAt ?? note.deleted_at ?? '',
    createdAt: note.createdAt ?? note.created_at ?? nowIso(),
    updatedAt: note.updatedAt ?? note.updated_at ?? nowIso(),
  };
}

function noteToRow(note) {
  return {
    id: note.id,
    user_id: note.userId,
    delivery_note_number: note.deliveryNoteNumber,
    shipment_id: note.shipmentId,
    sales_order_id: note.salesOrderId,
    customer_id: note.customerId || null,
    issue_date: note.issueDate || null,
    delivery_date: note.deliveryDate || null,
    price_visible: Boolean(note.priceVisible),
    status: note.status || 'Issued',
    snapshot: note.snapshot || {},
    delivery_note_pdf_url: note.deliveryNotePdfUrl || '',
    delivery_note_pdf_file_name: note.deliveryNotePdfFileName || '',
    delivery_note_pdf_storage_path: note.deliveryNotePdfStoragePath || '',
    delivery_note_pdf_generated_at: note.deliveryNotePdfGeneratedAt || null,
    delivery_note_pdf_history: note.deliveryNotePdfHistory || [],
    created_by: note.createdBy || null,
    created_by_name: note.createdByName || '',
    updated_by: note.updatedBy || null,
    updated_by_name: note.updatedByName || '',
    is_deleted: Boolean(note.isDeleted),
    deleted_at: note.deletedAt || null,
    created_at: note.createdAt || nowIso(),
    updated_at: note.updatedAt || nowIso(),
  };
}

function lineToRow(line, note) {
  return {
    id: line.id,
    user_id: note.userId,
    delivery_note_id: note.id,
    shipment_line_id: line.shipmentLineId,
    product_id: line.productId || null,
    product_snapshot: line.productSnapshot || {},
    quantity: line.quantity === '' ? 0 : Number(line.quantity),
    unit: line.unit || '',
    unit_price: line.unitPrice === '' ? null : Number(line.unitPrice),
    amount: line.amount === '' ? null : Number(line.amount),
    tax_rate: line.taxRate === '' ? null : Number(line.taxRate),
    tax_amount: line.taxAmount === '' ? null : Number(line.taxAmount),
    lot_snapshot: line.lotSnapshot || null,
    expiry_snapshot: line.expirySnapshot || '',
    created_at: line.createdAt || nowIso(),
  };
}

function rowToNote(row, lines = [], userId = '') {
  return normalizeDeliveryNote({
    id: row.id,
    userId: row.user_id,
    deliveryNoteNumber: row.delivery_note_number,
    shipmentId: row.shipment_id,
    salesOrderId: row.sales_order_id,
    customerId: row.customer_id,
    issueDate: row.issue_date,
    deliveryDate: row.delivery_date,
    priceVisible: row.price_visible,
    status: row.status,
    snapshot: row.snapshot,
    deliveryNotePdfUrl: row.delivery_note_pdf_url,
    deliveryNotePdfFileName: row.delivery_note_pdf_file_name,
    deliveryNotePdfStoragePath: row.delivery_note_pdf_storage_path,
    deliveryNotePdfGeneratedAt: row.delivery_note_pdf_generated_at,
    deliveryNotePdfHistory: row.delivery_note_pdf_history,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliveryNoteLines: lines,
  }, userId);
}

function readLocal(userId = '') {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return saved.map((record) => normalizeDeliveryNote(record, userId)).filter((record) => !userId || record.userId === userId);
  } catch {
    return [];
  }
}

function saveLocal(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.map((record) => normalizeDeliveryNote(record))));
}

async function fetchRemote(userId = '') {
  if (!canUseCloud()) return [];
  const noteQuery = supabase.from('delivery_notes').select('*').order('updated_at', { ascending: false });
  const lineQuery = supabase.from('delivery_note_lines').select('*').order('created_at', { ascending: true });
  const [noteResult, lineResult] = await Promise.all([
    userId ? noteQuery.eq('user_id', userId) : noteQuery,
    userId ? lineQuery.eq('user_id', userId) : lineQuery,
  ]);
  if (noteResult.error) throw noteResult.error;
  if (lineResult.error) throw lineResult.error;

  const linesByNote = new Map();
  (lineResult.data ?? []).forEach((row) => {
    const line = normalizeLine(row, userId, row.delivery_note_id);
    linesByNote.set(row.delivery_note_id, [...(linesByNote.get(row.delivery_note_id) ?? []), line]);
  });

  return (noteResult.data ?? [])
    .map((row) => rowToNote(row, linesByNote.get(row.id) ?? [], userId))
    .filter((note) => !note.isDeleted);
}

async function persistNote(note) {
  if (!canUseCloud()) return;
  await supabase.from('delivery_notes').upsert(noteToRow(note), { onConflict: 'id' }).throwOnError();
  await supabase.from('delivery_note_lines').delete().eq('delivery_note_id', note.id).eq('user_id', note.userId).throwOnError();
  if (note.deliveryNoteLines.length) {
    await supabase.from('delivery_note_lines').insert(note.deliveryNoteLines.map((line) => lineToRow(normalizeLine(line, note.userId, note.id), note))).throwOnError();
  }
}

export function useDeliveryNotes(userId = '') {
  const [records, setRecords] = useState(() => (canUseCloud() ? [] : readLocal(userId)));
  const [syncState, setSyncState] = useState(canUseCloud() ? 'syncing' : 'local');
  const [syncError, setSyncError] = useState('');
  const writeSequenceRef = useRef(0);

  async function reload(writeSequence = null) {
    if (!canUseCloud()) {
      setRecords(readLocal(userId));
      setSyncState('local');
      setSyncError(getLocalSyncReason());
      return;
    }

    try {
      setSyncState('syncing');
      const remote = await fetchRemote(userId);
      if (writeSequence !== null && writeSequence !== writeSequenceRef.current) return;
      setRecords(remote);
      saveLocal(remote);
      setSyncState('supabase');
      setSyncError('');
    } catch (error) {
      if (writeSequence !== null && writeSequence !== writeSequenceRef.current) return;
      setRecords(readLocal(userId));
      setSyncState('local');
      setSyncError(getLocalSyncReason(error.message));
    }
  }

  useEffect(() => {
    reload();
  }, [userId]);

  async function createDeliveryNoteFromShipment({ shipmentId, priceVisible = false, issueDate = '' }) {
    if (!canUseCloud()) {
      throw new Error('納品書作成はSupabase接続時のみ実行できます。');
    }

    setSyncState('syncing');
    const { data, error } = await supabase.rpc('create_delivery_note_from_shipment', {
      p_shipment_id: shipmentId,
      p_price_visible: Boolean(priceVisible),
      p_issue_date: issueDate || null,
    });
    if (error) {
      setSyncError(getLocalSyncReason(error.message));
      throw error;
    }
    await reload(++writeSequenceRef.current);
    return data;
  }

  function upsertLocal(nextRecord) {
    const normalized = normalizeDeliveryNote(nextRecord, userId);
    setRecords((current) => {
      const next = current.some((record) => record.id === normalized.id)
        ? current.map((record) => (record.id === normalized.id ? normalized : record))
        : [normalized, ...current];
      saveLocal(next);
      return next;
    });

    if (canUseCloud()) {
      const writeSequence = ++writeSequenceRef.current;
      setSyncState('syncing');
      persistNote(normalized)
        .then(() => reload(writeSequence))
        .catch((error) => {
          setSyncState('local');
          setSyncError(getLocalSyncReason(error.message));
        });
    }
    return normalized.id;
  }

  function addRecord(note) {
    const now = nowIso();
    return upsertLocal(normalizeDeliveryNote({
      ...note,
      id: note.id ?? crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    }, userId));
  }

  function updateRecord(id, updates) {
    const previous = records.find((record) => record.id === id);
    if (!previous) return;
    upsertLocal(normalizeDeliveryNote({
      ...previous,
      ...updates,
      id,
      userId,
      updatedAt: nowIso(),
    }, userId));
  }

  function removeRecord(id) {
    updateRecord(id, { isDeleted: true, status: 'Cancelled', deletedAt: nowIso() });
  }

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()),
    [records],
  );

  return {
    records: sortedRecords,
    addRecord,
    updateRecord,
    removeRecord,
    createDeliveryNoteFromShipment,
    reload,
    syncState,
    syncError,
  };
}
