import { fetchRecords, upsertRecords } from '../../../shared/services/recordSyncService.js';
import { normalizeEvent } from '../hooks/useEvents.js';
import { normalizeTask } from '../hooks/useTasks.js';

export const CALENDAR_LOCAL_STORAGE_KEYS = {
  events: 'eigyo-techo-events',
  tasks: 'eigyo-techo-tasks',
};

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

function normalizeLegacyEvent(event = {}, userId = '') {
  return normalizeEvent({
    ...event,
    userId: event.userId ?? event.user_id ?? userId,
    customerId: event.customerId ?? event.customer_id ?? '',
    contactIds: Array.isArray(event.contactIds) ? event.contactIds : event.contact_ids ?? [],
    dealId: event.dealId ?? event.deal_id ?? event.projectId ?? event.project_id ?? '',
    startAt: event.startAt ?? event.start_at ?? '',
    endAt: event.endAt ?? event.end_at ?? '',
    allDay: event.allDay ?? event.all_day ?? false,
    eventType: event.eventType ?? event.event_type ?? event.type,
    nextFollowDate: event.nextFollowDate ?? event.next_follow_date ?? '',
    recurrenceFrequency: event.recurrenceFrequency ?? event.recurrence_frequency ?? event.recurrence,
    recurrenceEndType: event.recurrenceEndType ?? event.recurrence_end_type,
    recurrenceEndDate: event.recurrenceEndDate ?? event.recurrence_end_date ?? '',
    recurrenceWeekdays: event.recurrenceWeekdays ?? event.recurrence_weekdays ?? [],
    recurrenceMonthDay: event.recurrenceMonthDay ?? event.recurrence_month_day ?? '',
    postponedFromEventId: event.postponedFromEventId ?? event.postponed_from_event_id ?? '',
    postponedOriginalStartAt: event.postponedOriginalStartAt ?? event.postponed_original_start_at ?? '',
    postponedOriginalEndAt: event.postponedOriginalEndAt ?? event.postponed_original_end_at ?? '',
    completedAt: event.completedAt ?? event.completed_at ?? '',
    createdBy: event.createdBy ?? event.created_by ?? userId,
    createdByName: event.createdByName ?? event.created_by_name ?? '',
    createdAt: event.createdAt ?? event.created_at,
    updatedAt: event.updatedAt ?? event.updated_at,
  }, userId);
}

function normalizeLegacyTask(task = {}, userId = '') {
  return normalizeTask({
    ...task,
    userId: task.userId ?? task.user_id ?? userId,
    recordedDate: task.recordedDate ?? task.recorded_date,
    dueDate: task.dueDate ?? task.due_date ?? '',
    assigneeId: task.assigneeId ?? task.assignee_id ?? '',
    assigneeName: task.assigneeName ?? task.assignee_name ?? '',
    customerId: task.customerId ?? task.customer_id ?? '',
    projectId: task.projectId ?? task.project_id ?? '',
    createdBy: task.createdBy ?? task.created_by ?? userId,
    createdByName: task.createdByName ?? task.created_by_name ?? '',
    createdAt: task.createdAt ?? task.created_at,
    updatedAt: task.updatedAt ?? task.updated_at,
    deletedAt: task.deletedAt ?? task.deleted_at ?? null,
  }, userId);
}

function eventToRow(event) {
  return {
    id: event.id,
    user_id: event.userId,
    title: event.title,
    event_type: event.eventType,
    customer_id: event.customerId || null,
    contact_ids: event.contactIds || [],
    deal_id: event.dealId || null,
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
    recurrence_frequency: event.recurrenceFrequency || 'none',
    recurrence_end_type: event.recurrenceEndType || 'none',
    recurrence_end_date: event.recurrenceEndDate || null,
    recurrence_weekdays: event.recurrenceWeekdays || [],
    recurrence_month_day: event.recurrenceMonthDay || null,
    postponed_from_event_id: event.postponedFromEventId || null,
    postponed_original_start_at: event.postponedOriginalStartAt || null,
    postponed_original_end_at: event.postponedOriginalEndAt || null,
    completed_at: event.completedAt || null,
    created_by: event.createdBy || null,
    created_by_name: event.createdByName || '',
    created_at: event.createdAt,
    updated_at: event.updatedAt,
  };
}

function eventFromRow(row) {
  return normalizeLegacyEvent(row, row.user_id ?? '');
}

function taskToRow(task) {
  return {
    id: task.id,
    user_id: task.userId,
    recorded_date: task.recordedDate || null,
    due_date: task.dueDate || null,
    assignee_id: task.assigneeId || null,
    assignee_name: task.assigneeName || '',
    title: task.title,
    content: task.content,
    status: task.status,
    priority: task.priority,
    customer_id: task.customerId || null,
    project_id: task.projectId || null,
    created_by: task.createdBy || null,
    created_by_name: task.createdByName || '',
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    deleted_at: task.deletedAt || null,
  };
}

function taskFromRow(row) {
  return normalizeLegacyTask(row, row.user_id ?? '');
}

function eventDuplicateReason(localEvent, remoteEvent) {
  const reasons = [];
  if (localEvent.id && remoteEvent.id === localEvent.id) {
    reasons.push('id');
  }
  if (
    localEvent.title &&
    remoteEvent.title === localEvent.title &&
    (remoteEvent.startAt || '') === (localEvent.startAt || '') &&
    (remoteEvent.endAt || '') === (localEvent.endAt || '')
  ) {
    reasons.push('件名+開始+終了');
  }
  return reasons;
}

function taskDuplicateReason(localTask, remoteTask) {
  const reasons = [];
  if (localTask.id && remoteTask.id === localTask.id) {
    reasons.push('id');
  }
  if (
    localTask.title &&
    remoteTask.title === localTask.title &&
    (remoteTask.dueDate || '') === (localTask.dueDate || '')
  ) {
    reasons.push('件名+締切');
  }
  return reasons;
}

function findDuplicate(record, remoteRecords, reasonFn) {
  return remoteRecords.find((remoteRecord) => reasonFn(record, remoteRecord).length > 0) || null;
}

function resultRecord(type, name, status, detail = '') {
  return { type, name: name || '-', status, detail };
}

export function readCalendarLegacyLocalData(userId = '') {
  const eventRead = readLocalArray(CALENDAR_LOCAL_STORAGE_KEYS.events);
  const taskRead = readLocalArray(CALENDAR_LOCAL_STORAGE_KEYS.tasks);

  return {
    events: eventRead.records.map((record) => normalizeLegacyEvent(record, userId)),
    tasks: taskRead.records.map((record) => normalizeLegacyTask(record, userId)),
    errors: {
      events: eventRead.error,
      tasks: taskRead.error,
    },
  };
}

export function hasCalendarLegacyLocalData() {
  const local = readCalendarLegacyLocalData();
  return local.events.length > 0 || local.tasks.length > 0;
}

function buildConflict(localRecord, duplicate, reasonFn, type) {
  return duplicate
    ? {
        type,
        localId: localRecord.id,
        localName: localRecord.title || '(件名なし)',
        remoteId: duplicate.id,
        remoteName: duplicate.title || '(件名なし)',
        reasons: reasonFn(localRecord, duplicate),
        action: 'skip',
      }
    : null;
}

function relationWarnings(local) {
  const warnings = [];
  local.events.forEach((event) => {
    if (!event.title) warnings.push(resultRecord('予定', event.id, 'warning', '件名が空です。'));
    if (!event.startAt && !event.allDay) warnings.push(resultRecord('予定', event.title || event.id, 'warning', '開始日時が空です。'));
    if (!event.dealId && event.projectId) warnings.push(resultRecord('予定', event.title || event.id, 'warning', '旧projectIdをdealIdへ変換します。'));
  });
  local.tasks.forEach((task) => {
    if (!task.title) warnings.push(resultRecord('タスク', task.id, 'warning', '件名が空です。'));
  });
  return warnings;
}

export async function buildCalendarLegacyMigrationPreview(userId = '') {
  const local = readCalendarLegacyLocalData(userId);
  const [remoteEvents, remoteTasks] = await Promise.all([
    fetchRecords('events', userId, eventFromRow),
    fetchRecords('tasks', userId, taskFromRow),
  ]);

  const eventConflicts = local.events
    .map((event) => buildConflict(event, findDuplicate(event, remoteEvents, eventDuplicateReason), eventDuplicateReason, 'event'))
    .filter(Boolean);
  const taskConflicts = local.tasks
    .map((task) => buildConflict(task, findDuplicate(task, remoteTasks, taskDuplicateReason), taskDuplicateReason, 'task'))
    .filter(Boolean);
  const warnings = relationWarnings(local);

  return {
    local,
    remote: {
      events: remoteEvents,
      tasks: remoteTasks,
    },
    counts: {
      localEvents: local.events.length,
      localTasks: local.tasks.length,
      remoteEvents: remoteEvents.length,
      remoteTasks: remoteTasks.length,
      duplicateEvents: eventConflicts.length,
      duplicateTasks: taskConflicts.length,
      relationWarnings: warnings.length,
    },
    eventConflicts,
    taskConflicts,
    relationWarnings: warnings,
    errors: local.errors,
  };
}

function resolveAction(record, conflictActions, remoteRecords, reasonFn) {
  const duplicate = findDuplicate(record, remoteRecords, reasonFn);
  if (!duplicate) {
    return { action: 'create', duplicate: null };
  }
  return {
    action: conflictActions[record.id] || 'skip',
    duplicate,
  };
}

async function migrateRecords({ type, localRecords, remoteRecords, conflictActions, userId, reasonFn, normalizeFn, toRow, tableName }) {
  const results = [];
  const now = new Date().toISOString();

  for (const record of localRecords) {
    const { action, duplicate } = resolveAction(record, conflictActions, remoteRecords, reasonFn);
    if (action === 'skip') {
      results.push(resultRecord(type, record.title, 'skipped', duplicate ? '重複候補のためスキップしました。' : 'スキップしました。'));
      continue;
    }

    const nextId = action === 'create' && duplicate ? crypto.randomUUID() : duplicate?.id || record.id;
    const recordForSave = normalizeFn({
      ...(action === 'update' && duplicate ? duplicate : {}),
      ...record,
      id: nextId,
      userId,
      createdAt: action === 'update' && duplicate ? duplicate.createdAt : record.createdAt || now,
      updatedAt: now,
    }, userId);

    try {
      await upsertRecords(tableName, [recordForSave], toRow);
      results.push(resultRecord(type, recordForSave.title, 'success', action === 'update' ? '既存データを更新しました。' : '新規登録しました。'));
    } catch (error) {
      results.push(resultRecord(type, record.title, 'failed', error.message || '保存に失敗しました。'));
    }
  }

  return results;
}

export async function migrateCalendarLegacyLocalData({ userId = '', preview, conflictActions = {} }) {
  const local = preview?.local ?? readCalendarLegacyLocalData(userId);
  const remoteEvents = preview?.remote?.events ?? [];
  const remoteTasks = preview?.remote?.tasks ?? [];

  const [eventResults, taskResults] = await Promise.all([
    migrateRecords({
      type: '予定',
      localRecords: local.events,
      remoteRecords: remoteEvents,
      conflictActions,
      userId,
      reasonFn: eventDuplicateReason,
      normalizeFn: normalizeLegacyEvent,
      toRow: eventToRow,
      tableName: 'events',
    }),
    migrateRecords({
      type: 'タスク',
      localRecords: local.tasks,
      remoteRecords: remoteTasks,
      conflictActions,
      userId,
      reasonFn: taskDuplicateReason,
      normalizeFn: normalizeLegacyTask,
      toRow: taskToRow,
      tableName: 'tasks',
    }),
  ]);

  return {
    events: eventResults,
    tasks: taskResults,
  };
}

export function deleteCalendarLegacyLocalData() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.removeItem(CALENDAR_LOCAL_STORAGE_KEYS.events);
  window.localStorage.removeItem(CALENDAR_LOCAL_STORAGE_KEYS.tasks);
}
