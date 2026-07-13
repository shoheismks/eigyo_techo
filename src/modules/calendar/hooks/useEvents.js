import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';

export const EVENT_TYPES = [
  '商談',
  '電話',
  'メール',
  '訪問',
  '展示会',
  '出張',
  'フォロー',
  '会食',
  '社内会議',
  'その他',
];

export const EVENT_STATUSES = ['予定', '完了', '中止', '延期'];
export const EVENT_PRIORITIES = ['低', '通常', '高', '最重要'];

export const emptyEvent = {
  userId: '',
  title: '',
  eventType: '商談',
  customerId: '',
  contactIds: [],
  dealId: '',
  location: '',
  startAt: '',
  endAt: '',
  allDay: false,
  priority: '通常',
  color: '#2878ff',
  memo: '',
  nextFollowDate: '',
  reminder: '',
  status: '予定',
  postponedFromEventId: '',
  postponedOriginalStartAt: '',
  postponedOriginalEndAt: '',
  completedAt: '',
  createdBy: '',
  createdByName: '',
};

export function normalizeEvent(event = {}, userId = '') {
  return {
    ...emptyEvent,
    ...event,
    id: event.id ?? crypto.randomUUID(),
    userId: event.userId ?? userId,
    title: event.title ?? '',
    eventType: event.eventType ?? event.type ?? '商談',
    customerId: event.customerId ?? '',
    contactIds: Array.isArray(event.contactIds) ? event.contactIds : [],
    dealId: event.dealId ?? '',
    startAt: event.startAt ?? '',
    endAt: event.endAt ?? '',
    allDay: Boolean(event.allDay),
    priority: event.priority || '通常',
    color: event.color || '#2878ff',
    status: event.status || '予定',
    createdBy: event.createdBy ?? userId,
    createdByName: event.createdByName ?? '',
    createdAt: event.createdAt ?? new Date().toISOString(),
    updatedAt: event.updatedAt ?? new Date().toISOString(),
  };
}

function toRow(event) {
  return {
    id: event.id,
    user_id: event.userId,
    title: event.title,
    event_type: event.eventType,
    customer_id: event.customerId,
    contact_ids: event.contactIds,
    deal_id: event.dealId,
    location: event.location,
    start_at: event.startAt || null,
    end_at: event.endAt || null,
    all_day: event.allDay,
    priority: event.priority,
    color: event.color,
    memo: event.memo,
    next_follow_date: event.nextFollowDate || null,
    reminder: event.reminder,
    status: event.status,
    postponed_from_event_id: event.postponedFromEventId,
    postponed_original_start_at: event.postponedOriginalStartAt || null,
    postponed_original_end_at: event.postponedOriginalEndAt || null,
    completed_at: event.completedAt || null,
    created_by: event.createdBy,
    created_by_name: event.createdByName,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
  };
}

function fromRow(row) {
  return normalizeEvent({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    eventType: row.event_type,
    customerId: row.customer_id,
    contactIds: row.contact_ids,
    dealId: row.deal_id,
    location: row.location,
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: row.all_day,
    priority: row.priority,
    color: row.color,
    memo: row.memo,
    nextFollowDate: row.next_follow_date,
    reminder: row.reminder,
    status: row.status,
    postponedFromEventId: row.postponed_from_event_id,
    postponedOriginalStartAt: row.postponed_original_start_at,
    postponedOriginalEndAt: row.postponed_original_end_at,
    completedAt: row.completed_at,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const useEvents = createRecordHook({
  tableName: 'events',
  storageKey: 'eigyo-techo-events',
  normalize: normalizeEvent,
  toRow,
  fromRow,
});
