import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';

export const TASK_STATUSES = ['未着手', '対応中', '完了', '保留'];
export const TASK_PRIORITIES = ['高', '中', '低'];

export const emptyTask = {
  userId: '',
  recordedDate: '',
  dueDate: '',
  assigneeId: '',
  assigneeName: '',
  title: '',
  content: '',
  status: '未着手',
  priority: '中',
  customerId: '',
  projectId: '',
  createdBy: '',
  createdByName: '',
};

function validOption(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

export function normalizeTask(task = {}, userId = '') {
  return {
    ...emptyTask,
    ...task,
    id: task.id ?? crypto.randomUUID(),
    userId: task.userId ?? userId,
    recordedDate: task.recordedDate ?? task.recorded_date ?? new Date().toISOString().slice(0, 10),
    dueDate: task.dueDate ?? task.due_date ?? '',
    assigneeId: task.assigneeId ?? task.assignee_id ?? '',
    assigneeName: task.assigneeName ?? task.assignee_name ?? '',
    title: task.title ?? '',
    content: task.content ?? '',
    status: validOption(task.status, TASK_STATUSES, '未着手'),
    priority: validOption(task.priority, TASK_PRIORITIES, '中'),
    customerId: task.customerId ?? task.customer_id ?? '',
    projectId: task.projectId ?? task.project_id ?? '',
    createdBy: task.createdBy ?? task.created_by ?? userId,
    createdByName: task.createdByName ?? task.created_by_name ?? '',
    createdAt: task.createdAt ?? task.created_at ?? new Date().toISOString(),
    updatedAt: task.updatedAt ?? task.updated_at ?? new Date().toISOString(),
    deletedAt: task.deletedAt ?? task.deleted_at ?? null,
  };
}

function toRow(task) {
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

function fromRow(row) {
  return normalizeTask({
    id: row.id,
    userId: row.user_id,
    recordedDate: row.recorded_date,
    dueDate: row.due_date,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    title: row.title,
    content: row.content,
    status: row.status,
    priority: row.priority,
    customerId: row.customer_id,
    projectId: row.project_id,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });
}

export const useTasks = createRecordHook({
  tableName: 'tasks',
  storageKey: 'eigyo-techo-tasks',
  normalize: normalizeTask,
  toRow,
  fromRow,
});
