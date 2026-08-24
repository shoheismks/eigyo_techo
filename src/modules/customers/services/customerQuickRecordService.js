const RESULT_KEYS = ['meeting', 'event', 'task'];

export const QUICK_RECORD_STATUS = {
  IDLE: 'idle',
  SUCCESS: 'success',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

export function createQuickRecordDraft({ customer, user }) {
  const now = new Date();
  const today = formatDateKey(now);
  const createdBy = user?.id || customer?.userId || '';
  const createdByName = user?.email || '';

  return {
    quickRecordId: crypto.randomUUID(),
    meetingHistoryId: crypto.randomUUID(),
    eventId: crypto.randomUUID(),
    taskId: crypto.randomUUID(),
    meeting: {
      summary: '',
      type: '商談',
      nextAction: '',
    },
    createEvent: false,
    event: {
      title: '',
      startAt: '',
      endAt: '',
      eventType: '商談',
      status: '予定',
      customerId: customer?.id || '',
      memo: '',
      createdBy,
      createdByName,
    },
    createTask: false,
    task: {
      title: '',
      dueDate: '',
      recordedDate: today,
      status: '未着手',
      priority: '中',
      customerId: customer?.id || '',
      assigneeId: createdBy,
      assigneeName: createdByName,
      content: '',
      createdBy,
      createdByName,
    },
  };
}

export function emptyQuickRecordResult() {
  return RESULT_KEYS.reduce((result, key) => ({
    ...result,
    [key]: { status: QUICK_RECORD_STATUS.IDLE, message: '' },
  }), {});
}

export function validateQuickRecordDraft(draft) {
  const errors = {};

  if (!draft?.meeting?.summary?.trim()) {
    errors.meeting = '商談メモを入力してください。';
  }

  if (draft?.createEvent) {
    if (!draft.event?.title?.trim()) {
      errors.eventTitle = '予定の件名を入力してください。';
    }
    if (!draft.event?.startAt) {
      errors.eventStartAt = '予定の開始日時を入力してください。';
    }
    if (!draft.event?.endAt) {
      errors.eventEndAt = '予定の終了日時を入力してください。';
    }
  }

  if (draft?.createTask) {
    if (!draft.task?.title?.trim()) {
      errors.taskTitle = 'タスクの件名を入力してください。';
    }
    if (!draft.task?.dueDate) {
      errors.taskDueDate = 'タスクの締め切りを入力してください。';
    }
  }

  return errors;
}

export async function saveCustomerQuickRecord({
  draft,
  result = emptyQuickRecordResult(),
  getCurrentCustomer,
  updateCustomer,
  addEvent,
  addTask,
  user,
  retryKeys = RESULT_KEYS,
}) {
  const nextResult = { ...emptyQuickRecordResult(), ...result };
  const retrySet = new Set(retryKeys);

  if (retrySet.has('meeting') && nextResult.meeting.status !== QUICK_RECORD_STATUS.SUCCESS) {
    nextResult.meeting = await saveMeetingHistory({ draft, getCurrentCustomer, updateCustomer, user });
  }

  const meetingSaved = nextResult.meeting.status === QUICK_RECORD_STATUS.SUCCESS;

  if (draft.createEvent && !meetingSaved) {
    nextResult.event = { status: QUICK_RECORD_STATUS.SKIPPED, message: '商談記録の保存後に作成します。' };
  } else if (draft.createEvent && retrySet.has('event') && nextResult.event.status !== QUICK_RECORD_STATUS.SUCCESS) {
    nextResult.event = await saveEvent({ draft, addEvent, user });
  } else if (!draft.createEvent) {
    nextResult.event = { status: QUICK_RECORD_STATUS.SKIPPED, message: '次回予定は作成しませんでした。' };
  }

  if (draft.createTask && !meetingSaved) {
    nextResult.task = { status: QUICK_RECORD_STATUS.SKIPPED, message: '商談記録の保存後に作成します。' };
  } else if (draft.createTask && retrySet.has('task') && nextResult.task.status !== QUICK_RECORD_STATUS.SUCCESS) {
    nextResult.task = await saveTask({ draft, addTask, user });
  } else if (!draft.createTask) {
    nextResult.task = { status: QUICK_RECORD_STATUS.SKIPPED, message: 'タスクは作成しませんでした。' };
  }

  return nextResult;
}

export function isQuickRecordComplete(result, draft) {
  if (result.meeting?.status !== QUICK_RECORD_STATUS.SUCCESS) return false;
  if (draft.createEvent && result.event?.status !== QUICK_RECORD_STATUS.SUCCESS) return false;
  if (draft.createTask && result.task?.status !== QUICK_RECORD_STATUS.SUCCESS) return false;
  return true;
}

export function resultSummary(result, draft) {
  const failed = [];
  const success = [];

  if (result.meeting?.status === QUICK_RECORD_STATUS.SUCCESS) success.push('商談記録');
  if (draft.createEvent && result.event?.status === QUICK_RECORD_STATUS.SUCCESS) success.push('次回予定');
  if (draft.createTask && result.task?.status === QUICK_RECORD_STATUS.SUCCESS) success.push('タスク');

  if (result.meeting?.status === QUICK_RECORD_STATUS.FAILED) failed.push('商談記録');
  if (draft.createEvent && result.event?.status === QUICK_RECORD_STATUS.FAILED) failed.push('次回予定');
  if (draft.createTask && result.task?.status === QUICK_RECORD_STATUS.FAILED) failed.push('タスク');

  return { success, failed };
}

async function saveMeetingHistory({ draft, getCurrentCustomer, updateCustomer, user }) {
  if (typeof updateCustomer !== 'function') {
    return fail('顧客保存処理が利用できません。');
  }

  const currentCustomer = getCurrentCustomer?.();
  if (!currentCustomer?.id) {
    return fail('顧客情報を取得できません。');
  }

  const histories = Array.isArray(currentCustomer.dealHistories) ? currentCustomer.dealHistories : [];
  if (histories.some((history) => history.id === draft.meetingHistoryId)) {
    return ok('商談記録は保存済みです。');
  }

  const now = new Date().toISOString();
  const history = {
    id: draft.meetingHistoryId,
    userId: user?.id || currentCustomer.userId || '',
    date: formatDateKey(new Date()),
    type: draft.meeting.type || '商談',
    summary: draft.meeting.summary.trim(),
    nextAction: draft.meeting.nextAction.trim(),
    createdAt: now,
    createdBy: user?.id || currentCustomer.userId || '',
    createdByName: user?.email || '',
    replies: [],
  };

  try {
    const saved = await updateCustomer(currentCustomer.id, {
      dealHistories: [history, ...histories],
    });
    if (!saved) return fail('商談記録の保存に失敗しました。');
    return ok('商談記録を保存しました。');
  } catch (error) {
    return fail(error?.message || '商談記録の保存に失敗しました。');
  }
}

async function saveEvent({ draft, addEvent, user }) {
  if (typeof addEvent !== 'function') {
    return fail('予定保存処理が利用できません。');
  }

  try {
    await addEvent({
      id: draft.eventId,
      userId: user?.id || '',
      title: draft.event.title.trim(),
      eventType: draft.event.eventType || '商談',
      customerId: draft.event.customerId || '',
      contactIds: [],
      dealId: '',
      location: '',
      startAt: toIsoString(draft.event.startAt),
      endAt: toIsoString(draft.event.endAt),
      allDay: false,
      priority: '通常',
      color: '#2878ff',
      memo: draft.event.memo || draft.meeting.summary,
      nextFollowDate: '',
      reminder: '',
      status: draft.event.status || '予定',
      recurrenceFrequency: 'none',
      recurrenceEndType: 'none',
      recurrenceEndDate: '',
      recurrenceWeekdays: [],
      recurrenceMonthDay: '',
      createdBy: user?.id || '',
      createdByName: user?.email || '',
    });
    return ok('次回予定を保存しました。');
  } catch (error) {
    return fail(error?.message || '次回予定の保存に失敗しました。');
  }
}

async function saveTask({ draft, addTask, user }) {
  if (typeof addTask !== 'function') {
    return fail('タスク保存処理が利用できません。');
  }

  try {
    await addTask({
      id: draft.taskId,
      userId: user?.id || '',
      recordedDate: draft.task.recordedDate || formatDateKey(new Date()),
      dueDate: draft.task.dueDate,
      assigneeId: draft.task.assigneeId || user?.id || '',
      assigneeName: draft.task.assigneeName || user?.email || '',
      title: draft.task.title.trim(),
      content: draft.task.content || draft.meeting.summary,
      status: draft.task.status || '未着手',
      priority: draft.task.priority || '中',
      customerId: draft.task.customerId || '',
      projectId: '',
      createdBy: user?.id || '',
      createdByName: user?.email || '',
    });
    return ok('タスクを保存しました。');
  } catch (error) {
    return fail(error?.message || 'タスクの保存に失敗しました。');
  }
}

function ok(message) {
  return { status: QUICK_RECORD_STATUS.SUCCESS, message };
}

function fail(message) {
  return { status: QUICK_RECORD_STATUS.FAILED, message };
}

function formatDateKey(date) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

function toIsoString(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}
