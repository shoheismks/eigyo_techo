import { useEffect, useMemo, useState } from 'react';
import {
  EVENT_PRIORITIES,
  EVENT_RECURRENCE_END_TYPES,
  EVENT_RECURRENCE_FREQUENCIES,
  EVENT_STATUSES,
  EVENT_TYPES,
  emptyEvent,
  normalizeEvent,
} from '../hooks/useEvents.js';
import { getCalendarDateMeta } from '../services/japaneseHolidayService.js';
import './CalendarPage.css';

const VIEW_LABELS = {
  month: '月',
  week: '週',
  day: '日',
  list: '一覧',
};

const DEFAULT_COLORS = ['#2878ff', '#5ee2a0', '#ffd36a', '#af87ff', '#ff8a3d', '#ff6b7b'];
const WEEKDAY_OPTIONS = [
  { value: 1, label: '月' },
  { value: 2, label: '火' },
  { value: 3, label: '水' },
  { value: 4, label: '木' },
  { value: 5, label: '金' },
  { value: 6, label: '土' },
  { value: 0, label: '日' },
];
const CALENDAR_VIEW_STORAGE_KEY = 'eigyo-techo-calendar-view-mode';
const CALENDAR_DATE_STORAGE_KEY = 'eigyo-techo-calendar-base-date';

function toDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value) {
  if (!value) return '';
  return new Date(value).toISOString();
}

function addHours(dateKey, hour, duration = 1) {
  const start = new Date(`${dateKey}T${String(hour).padStart(2, '0')}:00:00`);
  const end = new Date(start);
  end.setHours(start.getHours() + duration);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function addDaysString(baseDateKey, days) {
  const date = new Date(`${baseDateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function addMonthsString(baseDateKey, months) {
  const date = new Date(`${baseDateKey}T00:00:00`);
  date.setMonth(date.getMonth() + months, 1);
  return toDateKey(date);
}

function readStoredViewMode() {
  if (typeof window === 'undefined') return 'month';
  const value = window.localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
  return Object.keys(VIEW_LABELS).includes(value) ? value : 'month';
}

function readStoredBaseDate(fallback) {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(CALENDAR_DATE_STORAGE_KEY);
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : fallback;
}

function formatMonthTitle(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatDateLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function calendarDateAriaLabel(day, eventsCount = 0) {
  const meta = getCalendarDateMeta(day.dateKey);
  const dateLabel = formatDateLabel(day.dateKey);
  const weekdayLabel = ['日', '月', '火', '水', '木', '金', '土'][meta.weekday] || '';
  return [
    dateLabel,
    weekdayLabel && `${weekdayLabel}曜日`,
    meta.holidayName,
    eventsCount > 0 ? `予定${eventsCount}件` : '予定なし',
  ].filter(Boolean).join('、');
}

function calendarDayClassName(day, today) {
  const meta = getCalendarDateMeta(day.dateKey);
  return [
    'calendar-day',
    day.dateKey === today ? 'today' : '',
    !day.inCurrentMonth ? 'muted' : '',
    meta.isSunday ? 'calendar-day-sunday' : '',
    meta.isSaturday ? 'calendar-day-saturday' : '',
    meta.isHoliday ? 'calendar-day-holiday' : '',
  ].filter(Boolean).join(' ');
}

function formatWeekTitle(dateKey) {
  const days = buildWeekDays(dateKey);
  return `${formatDateLabel(days[0].dateKey)} ～ ${formatDateLabel(days[6].dateKey)}`;
}

function buildMonthDays(baseDateKey) {
  const base = new Date(`${baseDateKey}T00:00:00`);
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      dateKey: toDateKey(date),
      label: String(date.getDate()),
      inCurrentMonth: date.getMonth() === base.getMonth(),
    };
  });
}

function buildWeekDays(baseDateKey) {
  const base = new Date(`${baseDateKey}T00:00:00`);
  const start = new Date(base);
  start.setDate(base.getDate() - base.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      dateKey: toDateKey(date),
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      inCurrentMonth: true,
    };
  });
}

function customerName(customers, customerId) {
  return customers.find((customer) => customer.id === customerId)?.companyName || '顧客未選択';
}

function contactName(contacts, contactId) {
  return contacts.find((contact) => contact.id === contactId)?.name || '';
}

function createFormForDate(dateKey, user) {
  const { startAt, endAt } = addHours(dateKey, 9, 1);
  return normalizeEvent({
    ...emptyEvent,
    title: '',
    startAt,
    endAt,
    createdBy: user?.id ?? '',
    createdByName: user?.email ?? '',
  }, user?.id ?? '');
}

function eventDate(event) {
  return toDateKey(event.startAt || event.nextFollowDate || event.createdAt);
}

function dateKeyToLocalDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventSortValue(event) {
  return String(event.startAt || event.date || eventDate(event));
}

function isRecurringEvent(event = {}) {
  return Boolean(event.recurrenceFrequency && event.recurrenceFrequency !== 'none');
}

function recurrenceLabel(event = {}) {
  const frequency = EVENT_RECURRENCE_FREQUENCIES.find((item) => item.value === event.recurrenceFrequency)?.label || '繰り返しなし';
  if (!isRecurringEvent(event)) return frequency;
  const endLabel = event.recurrenceEndType === 'date' && event.recurrenceEndDate
    ? `${event.recurrenceEndDate}まで`
    : '終了なし';
  return `${frequency} / ${endLabel}`;
}

function visibleDateRange(days, fallbackDateKey) {
  const keys = days.map((day) => day.dateKey).filter(Boolean).sort();
  if (keys.length === 0) return { start: fallbackDateKey, end: fallbackDateKey };
  return { start: keys[0], end: keys[keys.length - 1] };
}

function addRecurringInterval(date, frequency) {
  const next = new Date(date);
  if (frequency === 'daily') next.setDate(next.getDate() + 1);
  else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else if (frequency === 'biweekly') next.setDate(next.getDate() + 14);
  else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  return next;
}

function normalizeWeekdays(values) {
  return [...new Set((values || []).map((value) => Number(value)).filter((value) => value >= 0 && value <= 6))].sort();
}

function startDateWeekday(event) {
  const start = dateKeyToLocalDate(eventDate(event));
  return start ? start.getDay() : 1;
}

function startDateMonthDay(event) {
  const start = dateKeyToLocalDate(eventDate(event));
  return start ? start.getDate() : 1;
}

function recurrenceNeedsDailyScan(frequency) {
  return ['weekdays', 'weekday_select', 'monthly_day'].includes(frequency);
}

function recurringEventMatchesDate(event, date) {
  const frequency = event.recurrenceFrequency;
  if (frequency === 'weekdays') {
    const weekday = date.getDay();
    return weekday >= 1 && weekday <= 5;
  }
  if (frequency === 'weekday_select') {
    const weekdays = normalizeWeekdays(event.recurrenceWeekdays);
    const selected = weekdays.length > 0 ? weekdays : [startDateWeekday(event)];
    return selected.includes(date.getDay());
  }
  if (frequency === 'monthly_day') {
    const monthDay = Number(event.recurrenceMonthDay) || startDateMonthDay(event);
    return date.getDate() === monthDay;
  }
  return false;
}

function shiftDateTimeToDate(value, dateKey) {
  if (!value) return '';
  const source = new Date(value);
  if (Number.isNaN(source.getTime())) return '';
  const shifted = new Date(`${dateKey}T00:00:00`);
  shifted.setHours(source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds());
  return shifted.toISOString();
}

function shiftEndAt(event, dateKey) {
  if (!event.endAt) return '';
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return shiftDateTimeToDate(event.endAt, dateKey);
  const shiftedStart = new Date(shiftDateTimeToDate(event.startAt, dateKey));
  return new Date(shiftedStart.getTime() + (end.getTime() - start.getTime())).toISOString();
}

function moveEventToDate(event, dateKey, hour = null) {
  const startSource = event.startAt || addHours(eventDate(event) || dateKey, 9, 1).startAt;
  const start = new Date(startSource);
  const end = event.endAt ? new Date(event.endAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const duration = Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())
    ? 60 * 60 * 1000
    : Math.max(15 * 60 * 1000, end.getTime() - start.getTime());
  const nextStart = new Date(`${dateKey}T00:00:00`);
  nextStart.setHours(hour ?? start.getHours(), hour === null ? start.getMinutes() : 0, 0, 0);
  const nextEnd = new Date(nextStart.getTime() + duration);
  return {
    startAt: nextStart.toISOString(),
    endAt: nextEnd.toISOString(),
    nextFollowDate: event.nextFollowDate === eventDate(event) ? dateKey : event.nextFollowDate,
  };
}

function resizeEventEnd(event, deltaY) {
  const start = new Date(event.startAt || new Date());
  const currentEnd = event.endAt ? new Date(event.endAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const steps = Math.round(deltaY / 20);
  const deltaMinutes = steps * 30;
  const nextEnd = new Date(currentEnd.getTime() + deltaMinutes * 60 * 1000);
  if (nextEnd.getTime() <= start.getTime()) {
    nextEnd.setTime(start.getTime() + 15 * 60 * 1000);
  }
  return { endAt: nextEnd.toISOString() };
}

function occurrenceId(event, dateKey, index) {
  return `${event.id}__${dateKey}__${index}`;
}

function expandRecurringEvent(event, rangeStartKey, rangeEndKey) {
  const base = { ...event, source: 'event', date: eventDate(event) };
  if (!isRecurringEvent(event)) return [base];

  const startDateKey = eventDate(event);
  const start = dateKeyToLocalDate(startDateKey);
  const rangeStart = dateKeyToLocalDate(rangeStartKey);
  const rangeEnd = dateKeyToLocalDate(rangeEndKey);
  if (!start || !rangeStart || !rangeEnd) return [base];

  const recurrenceEnd = event.recurrenceEndType === 'date' && event.recurrenceEndDate
    ? dateKeyToLocalDate(event.recurrenceEndDate)
    : null;
  const hardEnd = recurrenceEnd && recurrenceEnd < rangeEnd ? recurrenceEnd : rangeEnd;
  const results = [];
  const scanStart = start > rangeStart ? start : rangeStart;

  if (recurrenceNeedsDailyScan(event.recurrenceFrequency)) {
    let current = new Date(scanStart);
    let index = 0;
    while (current <= hardEnd && index < 500) {
      if (recurringEventMatchesDate(event, current)) {
        const dateKey = toDateKey(current);
        results.push({
          ...base,
          id: occurrenceId(event, dateKey, index),
          source: 'event',
          occurrenceDate: dateKey,
          date: dateKey,
          startAt: shiftDateTimeToDate(event.startAt, dateKey),
          endAt: shiftEndAt(event, dateKey),
          seriesEvent: base,
        });
      }
      current.setDate(current.getDate() + 1);
      index += 1;
    }
    return results;
  }

  let current = new Date(start);
  let index = 0;
  let guard = 0;

  while (current < rangeStart && guard < 10000) {
    current = addRecurringInterval(current, event.recurrenceFrequency);
    index += 1;
    guard += 1;
  }

  while (current <= hardEnd && guard < 10500) {
    const dateKey = toDateKey(current);
    if (dateKey >= rangeStartKey && dateKey <= rangeEndKey) {
      results.push({
        ...base,
        id: occurrenceId(event, dateKey, index),
        source: 'event',
        occurrenceDate: dateKey,
        date: dateKey,
        startAt: shiftDateTimeToDate(event.startAt, dateKey),
        endAt: shiftEndAt(event, dateKey),
        seriesEvent: base,
      });
    }
    current = addRecurringInterval(current, event.recurrenceFrequency);
    index += 1;
    guard += 1;
  }

  return results;
}

function expandCalendarEvents(events, rangeStartKey, rangeEndKey) {
  return events
    .flatMap((event) => expandRecurringEvent(event, rangeStartKey, rangeEndKey))
    .sort((a, b) => eventSortValue(a).localeCompare(eventSortValue(b)));
}

function eventTimeLabel(event) {
  if (event.allDay) return '終日';
  if (!event.startAt) return '-';
  const start = toDateTimeLocal(event.startAt).slice(11, 16);
  const end = event.endAt ? toDateTimeLocal(event.endAt).slice(11, 16) : '';
  return end ? `${start} - ${end}` : start;
}

function formatEventForClipboard(event, customers, contacts) {
  const contactNames = event.contactIds?.map((id) => contactName(contacts, id)).filter(Boolean).join(', ');
  return [
    `予定名: ${event.title || event.eventType || event.type || ''}`,
    `日時: ${event.startAt ? toDateTimeLocal(event.startAt).replace('T', ' ') : event.date || ''}${event.endAt ? ` - ${toDateTimeLocal(event.endAt).replace('T', ' ')}` : ''}`,
    `顧客: ${customerName(customers, event.customerId)}`,
    `担当者: ${contactNames || '-'}`,
    `場所: ${event.location || '-'}`,
    `メモ: ${event.memo || '-'}`,
  ].join('\n');
}

function clampMenuPosition(x, y) {
  if (typeof window === 'undefined') return { x, y };
  const width = 220;
  const height = 300;
  return {
    x: Math.min(Math.max(8, x), window.innerWidth - width - 8),
    y: Math.min(Math.max(8, y), window.innerHeight - height - 8),
  };
}

function projectName(projects, projectId) {
  return projects.find((project) => project.id === projectId)?.title || '';
}

function eventTypeIcon(event = {}) {
  const type = event.eventType || event.type || '';
  if (type.includes('電話')) return 'TEL';
  if (type.includes('メール')) return 'MAIL';
  if (type.includes('訪問')) return 'VISIT';
  if (type.includes('展示')) return 'EXPO';
  if (type.includes('出張')) return 'TRIP';
  if (type.includes('会食')) return 'MEAL';
  if (type.includes('社内')) return 'MTG';
  if (type.includes('フォロー') || type.includes('繝輔か繝ｭ繝ｼ')) return 'FOLLOW';
  if (type.includes('クレーム') || type.includes('繧ｯ繝ｬ繝ｼ繝')) return 'CLAIM';
  if (type.includes('サンプル') || type.includes('繧ｵ繝ｳ繝励Ν')) return 'SAMPLE';
  if (type.includes('見積') || type.includes('隕狗ｩ')) return 'QUOTE';
  return 'EVENT';
}

function priorityClass(priority = '') {
  if (String(priority).includes('高') || String(priority).includes('鬮')) return 'high';
  if (String(priority).includes('低') || String(priority).includes('菴')) return 'low';
  return 'normal';
}

export default function CalendarPage({
  customers,
  contacts = [],
  projects = [],
  events = [],
  samples = [],
  quotes = [],
  complaints = [],
  addEvent,
  updateEvent,
  removeEvent,
  updateCustomer,
  onOpenKarte,
  onOpenProject,
  user,
}) {
  const today = toDateKey(new Date());
  const [viewMode, setViewMode] = useState(() => readStoredViewMode());
  const [baseDate, setBaseDate] = useState(() => readStoredBaseDate(today));
  const [editingEvent, setEditingEvent] = useState(null);
  const [detailEvent, setDetailEvent] = useState(null);
  const [form, setForm] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [eventListOpen, setEventListOpen] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [resizeState, setResizeState] = useState(null);
  const [actionMenu, setActionMenu] = useState(null);
  const [savingEventId, setSavingEventId] = useState('');
  const [calendarToast, setCalendarToast] = useState('');

  const systemEvents = useMemo(
    () => buildSystemEvents({ customers, samples, quotes, complaints }),
    [complaints, customers, quotes, samples],
  );
  const monthDays = useMemo(() => buildMonthDays(baseDate), [baseDate]);
  const weekDays = useMemo(() => buildWeekDays(baseDate), [baseDate]);
  const visibleDays = viewMode === 'week' ? weekDays : viewMode === 'day' ? [{ dateKey: baseDate, label: baseDate, inCurrentMonth: true }] : monthDays;
  const visibleRange = useMemo(() => visibleDateRange(visibleDays, baseDate), [baseDate, visibleDays]);
  const expandedUserEvents = useMemo(
    () => expandCalendarEvents(events, visibleRange.start, visibleRange.end),
    [events, visibleRange.end, visibleRange.start],
  );
  const mergedEvents = useMemo(
    () => [
      ...expandedUserEvents,
      ...systemEvents,
    ].sort((a, b) => eventSortValue(a).localeCompare(eventSortValue(b))),
    [expandedUserEvents, systemEvents],
  );
  const listEvents = useMemo(() => mergedEvents.filter((event) => event.status !== '中止'), [mergedEvents]);
  const calendarTitle = viewMode === 'week' ? formatWeekTitle(baseDate) : viewMode === 'day' ? formatDateLabel(baseDate) : formatMonthTitle(baseDate);

  useEffect(() => {
    window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    window.localStorage.setItem(CALENDAR_DATE_STORAGE_KEY, baseDate);
  }, [baseDate]);

  useEffect(() => {
    if (!actionMenu) return undefined;

    function closeMenu() {
      setActionMenu(null);
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') closeMenu();
    }

    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [actionMenu]);

  useEffect(() => {
    if (!resizeState) return undefined;

    function handlePointerUp(event) {
      finishResize(event.clientY);
    }

    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [resizeState]);

  function showToast(message) {
    setCalendarToast(message);
    window.setTimeout(() => setCalendarToast(''), 2400);
  }

  function editableEvent(event) {
    const baseEvent = event.seriesEvent || event;
    return baseEvent.source === 'event' ? baseEvent : null;
  }

  function eventsForDay(dateKey) {
    return mergedEvents.filter((event) => (event.date || eventDate(event)) === dateKey);
  }

  function openAdd(dateKey, hour = 9) {
    const safeDateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : today;
    const nextForm = createFormForDate(safeDateKey, user);
    if (hour !== null) {
      const times = addHours(safeDateKey, hour, 1);
      nextForm.startAt = times.startAt;
      nextForm.endAt = times.endAt;
    }
    setEditingEvent(null);
    setForm(nextForm);
    setEditorOpen(true);
  }

  function openEdit(event) {
    setDetailEvent(null);
    const baseEvent = event.seriesEvent || event;
    if (baseEvent.source !== 'event') {
      if (baseEvent.customerId) onOpenKarte?.(baseEvent.customerId);
      return;
    }
    setEditingEvent(baseEvent);
    setForm(normalizeEvent(baseEvent, user?.id ?? ''));
    setEditorOpen(true);
  }

  function openDetail(event) {
    setDetailEvent(event);
  }

  function closeForm() {
    setEditingEvent(null);
    setForm(null);
    setEditorOpen(false);
  }

  function closeDetail() {
    setDetailEvent(null);
  }

  function updateForm(field, value) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function saveEvent(event) {
    event.preventDefault();
    if (!form.title.trim()) return;

    const normalized = normalizeEvent({
      ...form,
      title: form.title.trim(),
      recurrenceFrequency: form.recurrenceFrequency || 'none',
      recurrenceEndType: form.recurrenceFrequency === 'none' ? 'none' : (form.recurrenceEndType || 'none'),
      recurrenceEndDate: form.recurrenceFrequency !== 'none' && form.recurrenceEndType === 'date' ? form.recurrenceEndDate : '',
      recurrenceWeekdays: form.recurrenceFrequency === 'weekday_select'
        ? normalizeWeekdays(form.recurrenceWeekdays).length > 0
          ? normalizeWeekdays(form.recurrenceWeekdays)
          : [startDateWeekday(form)]
        : [],
      recurrenceMonthDay: form.recurrenceFrequency === 'monthly_day'
        ? Math.min(31, Math.max(1, Number(form.recurrenceMonthDay) || startDateMonthDay(form)))
        : '',
      createdBy: form.createdBy || user?.id || '',
      createdByName: form.createdByName || user?.email || '',
    }, user?.id ?? '');

    if (editingEvent) {
      updateEvent(editingEvent.id, normalized);
    } else {
      addEvent(normalized);
    }

    if (normalized.nextFollowDate && normalized.customerId) {
      updateCustomer?.(normalized.customerId, {
        nextFollowUpDate: normalized.nextFollowDate,
        nextFollowDate: normalized.nextFollowDate,
      });
    }

    closeForm();
  }

  function deleteEvent() {
    if (!editingEvent) return;
    removeEvent(editingEvent.id);
    closeForm();
  }

  function confirmRecurringChange(event, actionLabel) {
    if (!isRecurringEvent(event)) return true;
    return window.confirm(`繰り返し予定です。${actionLabel}は系列全体に適用します。よろしいですか？`);
  }

  function applyEventUpdate(event, updates, actionLabel = '予定を更新') {
    const baseEvent = editableEvent(event);
    if (!baseEvent) return false;
    if (!confirmRecurringChange(baseEvent, actionLabel)) return false;

    setSavingEventId(baseEvent.id);
    try {
      updateEvent(baseEvent.id, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      window.setTimeout(() => {
        setSavingEventId('');
        showToast('予定を保存しました');
      }, 350);
      return true;
    } catch (error) {
      setSavingEventId('');
      showToast(`保存に失敗しました: ${error.message}`);
      return false;
    }
  }

  function startDrag(event, dragEvent) {
    const baseEvent = editableEvent(event);
    if (!baseEvent) return;
    dragEvent.dataTransfer.effectAllowed = 'move';
    dragEvent.dataTransfer.setData('text/plain', baseEvent.id);
    setDragState({ event, baseEvent });
  }

  function finishDrop(dateKey, hour = null) {
    if (!dragState) return;
    const updates = moveEventToDate(dragState.event, dateKey, hour);
    if (window.confirm('予定の日時を変更します。よろしいですか？')) {
      applyEventUpdate(dragState.event, updates, '日時変更');
    }
    setDragState(null);
    setDropTarget(null);
  }

  function startResize(event, pointerEvent) {
    const baseEvent = editableEvent(event);
    if (!baseEvent) return;
    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();
    setResizeState({ event, baseEvent, startY: pointerEvent.clientY });
  }

  function finishResize(clientY) {
    if (!resizeState) return;
    const updates = resizeEventEnd(resizeState.event, clientY - resizeState.startY);
    if (window.confirm('予定の終了時間を変更します。よろしいですか？')) {
      applyEventUpdate(resizeState.event, updates, '終了時間変更');
    }
    setResizeState(null);
  }

  function openActionMenu(event, calendarEvent) {
    const baseEvent = editableEvent(calendarEvent);
    if (!baseEvent) return;
    event.preventDefault();
    event.stopPropagation();
    setDetailEvent(null);
    const point = clampMenuPosition(event.clientX || 24, event.clientY || 24);
    setActionMenu({ event: calendarEvent, baseEvent, ...point });
  }

  async function copyEvent(calendarEvent) {
    const baseEvent = calendarEvent.seriesEvent || calendarEvent;
    const text = formatEventForClipboard(calendarEvent, customers, contacts);
    try {
      await navigator.clipboard?.writeText(text);
      showToast('予定をコピーしました');
    } catch {
      window.prompt('予定内容をコピーしてください', text);
    }
    setActionMenu(null);
  }

  function duplicateEvent(calendarEvent) {
    const baseEvent = calendarEvent.seriesEvent || calendarEvent;
    const now = new Date().toISOString();
    addEvent(normalizeEvent({
      ...baseEvent,
      id: crypto.randomUUID(),
      title: `${baseEvent.title || '予定'} copy`,
      startAt: calendarEvent.startAt || baseEvent.startAt,
      endAt: calendarEvent.endAt || baseEvent.endAt,
      recurrenceFrequency: 'none',
      recurrenceEndType: 'none',
      recurrenceEndDate: '',
      createdAt: now,
      updatedAt: now,
    }, user?.id ?? ''));
    showToast('予定を複製しました');
    setActionMenu(null);
  }

  function changeEventColor(calendarEvent, color) {
    applyEventUpdate(calendarEvent, { color }, '色変更');
    setActionMenu(null);
  }

  function completeEvent(calendarEvent) {
    applyEventUpdate(calendarEvent, { status: EVENT_STATUSES[1] || '完了', completedAt: new Date().toISOString() }, '完了');
    setActionMenu(null);
  }

  function removeCalendarEvent(calendarEvent) {
    const baseEvent = editableEvent(calendarEvent);
    if (!baseEvent) return;
    if (!confirmRecurringChange(baseEvent, '削除')) return;
    if (!window.confirm('予定を削除します。よろしいですか？')) return;
    removeEvent(baseEvent.id);
    showToast('予定を削除しました');
    setActionMenu(null);
  }

  function completeAsDeal() {
    if (!editingEvent || !editingEvent.customerId) return;
    const customer = customers.find((item) => item.id === editingEvent.customerId);
    if (!customer) return;

    const deal = {
      id: crypto.randomUUID(),
      date: toDateKey(editingEvent.startAt || new Date()),
      type: editingEvent.eventType || '商談',
      summary: editingEvent.memo || editingEvent.title,
      nextAction: editingEvent.nextFollowDate ? `次回フォロー: ${editingEvent.nextFollowDate}` : '',
      contactIds: editingEvent.contactIds,
      contactNames: editingEvent.contactIds.map((id) => contactName(contacts, id)).filter(Boolean),
      createdAt: new Date().toISOString(),
      createdBy: user?.id || '',
      createdByName: user?.email || '',
      replies: [],
    };

    updateCustomer?.(customer.id, {
      dealHistories: [deal, ...(customer.dealHistories ?? [])],
      lastContactDate: deal.date,
      nextFollowUpDate: editingEvent.nextFollowDate || customer.nextFollowUpDate,
      nextFollowDate: editingEvent.nextFollowDate || customer.nextFollowDate,
    });
    updateEvent(editingEvent.id, { status: '完了', completedAt: new Date().toISOString() });
    closeForm();
  }

  function postponeEvent() {
    if (!editingEvent || !form.startAt) return;
    addEvent(normalizeEvent({
      ...form,
      id: crypto.randomUUID(),
      status: '予定',
      postponedFromEventId: editingEvent.id,
      postponedOriginalStartAt: editingEvent.startAt,
      postponedOriginalEndAt: editingEvent.endAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, user?.id ?? ''));
    updateEvent(editingEvent.id, { status: '延期' });
    closeForm();
  }

  function movePrevious() {
    if (viewMode === 'week') setBaseDate((current) => addDaysString(current, -7));
    else if (viewMode === 'day') setBaseDate((current) => addDaysString(current, -1));
    else setBaseDate((current) => addMonthsString(current, -1));
  }

  function moveNext() {
    if (viewMode === 'week') setBaseDate((current) => addDaysString(current, 7));
    else if (viewMode === 'day') setBaseDate((current) => addDaysString(current, 1));
    else setBaseDate((current) => addMonthsString(current, 1));
  }

  function previousLabel() {
    if (viewMode === 'week') return '＜ 前週';
    if (viewMode === 'day') return '＜ 前日';
    return '＜ 前月';
  }

  function nextLabel() {
    if (viewMode === 'week') return '翌週 ＞';
    if (viewMode === 'day') return '翌日 ＞';
    return '翌月 ＞';
  }

  return (
    <section className="page calendar-page">
      <div className="page-header calendar-page-header">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1>カレンダー</h1>
          <p>予定を登録し、顧客・担当者・案件・フォローへつなげます。</p>
        </div>
        <div className="segmented-control calendar-view-switch" aria-label="カレンダー表示切替">
          {Object.entries(VIEW_LABELS).map(([key, label]) => (
            <button type="button" className={viewMode === key ? 'selected' : ''} key={key} onClick={() => setViewMode(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="calendar-toolbar calendar-navigation">
          <div className="calendar-stepper">
            <button className="ghost-button" type="button" onClick={movePrevious}>{previousLabel()}</button>
            <button className="ghost-button" type="button" onClick={() => setBaseDate(today)}>今日</button>
            <button className="ghost-button" type="button" onClick={moveNext}>{nextLabel()}</button>
          </div>
          <strong className={`calendar-current-title ${getCalendarDateMeta(baseDate).isHoliday || getCalendarDateMeta(baseDate).isSunday ? 'calendar-title-holiday' : ''} ${getCalendarDateMeta(baseDate).isSaturday ? 'calendar-title-saturday' : ''}`}>
            {calendarTitle}
            {viewMode === 'day' && getCalendarDateMeta(baseDate).holidayName && (
              <span className="calendar-title-holiday-name">{getCalendarDateMeta(baseDate).holidayName}</span>
            )}
          </strong>
          <div className="calendar-date-actions">
            <input type="date" value={baseDate} onChange={(event) => setBaseDate(event.target.value || today)} />
            <button className="primary-button compact-button" type="button" onClick={() => openAdd(baseDate)}>
              予定追加
            </button>
            <button className="ghost-button compact-button" type="button" onClick={() => setEventListOpen(true)}>
              予定一覧
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <section className="desktop-panel">
          <div className="section-heading">
            <h2>予定一覧</h2>
            <span className="info-badge">{listEvents.length}件</span>
          </div>
          <div className="calendar-list">
            {listEvents.map((event) => (
              <CalendarEventButton
                contacts={contacts}
                customers={customers}
                event={event}
                key={event.id}
                onClick={() => openDetail(event)}
                onContextMenu={(clickEvent) => openActionMenu(clickEvent, event)}
                onDragEnd={() => {
                  setDragState(null);
                  setDropTarget(null);
                }}
                onDragStart={(dragEvent) => startDrag(event, dragEvent)}
                onResizeStart={(pointerEvent) => startResize(event, pointerEvent)}
              />
            ))}
          </div>
          {listEvents.length === 0 && <CalendarEmpty />}
        </section>
      ) : viewMode === 'day' ? (
        <section className="calendar-day-schedule">
          {Array.from({ length: 12 }, (_, index) => index + 8).map((hour) => (
            <div
              className={`calendar-time-slot ${dropTarget?.dateKey === baseDate && dropTarget?.hour === hour ? 'calendar-drop-target' : ''}`}
              key={hour}
              onDragLeave={() => setDropTarget(null)}
              onDragOver={(event) => {
                if (!dragState) return;
                event.preventDefault();
                setDropTarget({ dateKey: baseDate, hour });
              }}
              onDrop={(event) => {
                event.preventDefault();
                finishDrop(baseDate, hour);
              }}
              onClick={() => openAdd(baseDate, hour)}
            >
              <span>{String(hour).padStart(2, '0')}:00</span>
              <div>
                {eventsForDay(baseDate)
                  .filter((event) => new Date(event.startAt || `${baseDate}T00:00:00`).getHours() === hour)
                  .map((event) => (
                    <CalendarEventButton
                      compact
                      contacts={contacts}
                      customers={customers}
                      event={event}
                      key={event.id}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        openDetail(event);
                      }}
                      onContextMenu={(clickEvent) => openActionMenu(clickEvent, event)}
                      onDragEnd={() => {
                        setDragState(null);
                        setDropTarget(null);
                      }}
                      onDragStart={(dragEvent) => startDrag(event, dragEvent)}
                      onResizeStart={(pointerEvent) => startResize(event, pointerEvent)}
                    />
                  ))}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="calendar-grid-panel">
          <div className="calendar-week-labels">
            {['日', '月', '火', '水', '木', '金', '土'].map((label, index) => (
              <span className={index === 0 ? 'calendar-week-label-sunday' : index === 6 ? 'calendar-week-label-saturday' : ''} key={label}>
                {label}
              </span>
            ))}
          </div>
          <div className={`calendar-grid ${viewMode === 'week' ? 'week-view' : ''}`}>
            {visibleDays.map((day) => {
              const dayEvents = eventsForDay(day.dateKey);
              const limit = viewMode === 'week' ? 8 : 4;
              const dateMeta = getCalendarDateMeta(day.dateKey);
              return (
                <article
                  aria-label={calendarDateAriaLabel(day, dayEvents.length)}
                  className={`${calendarDayClassName(day, today)} ${dropTarget?.dateKey === day.dateKey && dropTarget?.hour === null ? 'calendar-drop-target' : ''}`}
                  key={day.dateKey}
                  onDragLeave={() => setDropTarget(null)}
                  onDragOver={(event) => {
                    if (!dragState) return;
                    event.preventDefault();
                    setDropTarget({ dateKey: day.dateKey, hour: null });
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    finishDrop(day.dateKey, null);
                  }}
                  onClick={(clickEvent) => {
                    if (clickEvent.target instanceof Element && clickEvent.target.closest('.calendar-event')) return;
                    openAdd(day.dateKey);
                  }}
                >
                  <div className="calendar-day-head">
                    <div className="calendar-date-label">
                      <strong>{day.label}</strong>
                      {dateMeta.holidayName && <small>{dateMeta.holidayName}</small>}
                    </div>
                    {dayEvents.length > 0 && <span>{dayEvents.length}</span>}
                  </div>
                  <div className="calendar-day-events">
                    {dayEvents.slice(0, limit).map((event) => (
                      <CalendarEventButton
                        compact
                        contacts={contacts}
                        customers={customers}
                        event={event}
                        key={event.id}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          openDetail(event);
                        }}
                        onContextMenu={(clickEvent) => openActionMenu(clickEvent, event)}
                        onDragEnd={() => {
                          setDragState(null);
                          setDropTarget(null);
                        }}
                        onDragStart={(dragEvent) => startDrag(event, dragEvent)}
                        onResizeStart={(pointerEvent) => startResize(event, pointerEvent)}
                      />
                    ))}
                    {dayEvents.length > limit && <small className="calendar-more">+{dayEvents.length - limit}件</small>}
                  </div>
                </article>
              );
            })}
          </div>
          {mergedEvents.length === 0 && <CalendarEmpty />}
        </section>
      )}

      {eventListOpen && (
        <CalendarEventListPopover
          contacts={contacts}
          customers={customers}
          events={listEvents}
          onClose={() => setEventListOpen(false)}
          onOpen={(event) => {
            setEventListOpen(false);
            openDetail(event);
          }}
        />
      )}

      {actionMenu && (
        <CalendarEventActionMenu
          event={actionMenu.event}
          x={actionMenu.x}
          y={actionMenu.y}
          onChangeColor={(color) => changeEventColor(actionMenu.event, color)}
          onClose={() => setActionMenu(null)}
          onComplete={() => completeEvent(actionMenu.event)}
          onCopy={() => copyEvent(actionMenu.event)}
          onDelete={() => removeCalendarEvent(actionMenu.event)}
          onDuplicate={() => duplicateEvent(actionMenu.event)}
          onEdit={() => {
            setActionMenu(null);
            openEdit(actionMenu.event);
          }}
        />
      )}

      {savingEventId && <div className="calendar-save-indicator">保存中...</div>}
      {calendarToast && <div className="calendar-toast">{calendarToast}</div>}

      {detailEvent && (
        <CalendarEventPopover
          contacts={contacts}
          customers={customers}
          event={detailEvent}
          onClose={closeDetail}
          onEdit={() => openEdit(detailEvent)}
          onOpenKarte={onOpenKarte}
          onOpenProject={onOpenProject}
          projects={projects}
        />
      )}

      {editorOpen && form && (
        <EventEditor
          contacts={contacts}
          customers={customers}
          projects={projects}
          editing={Boolean(editingEvent)}
          form={form}
          onClose={closeForm}
          onComplete={completeAsDeal}
          onDelete={deleteEvent}
          onPostpone={postponeEvent}
          onSave={saveEvent}
          updateForm={updateForm}
        />
      )}
    </section>
  );
}

function CalendarEventActionMenu({
  x,
  y,
  onClose,
  onEdit,
  onCopy,
  onDuplicate,
  onChangeColor,
  onComplete,
  onDelete,
}) {
  return (
    <div
      className="calendar-action-menu"
      role="menu"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button type="button" role="menuitem" onClick={onEdit}>✎ 編集</button>
      <button type="button" role="menuitem" onClick={onCopy}>⧉ コピー</button>
      <button type="button" role="menuitem" onClick={onDuplicate}>＋ 複製</button>
      <div className="calendar-menu-colors" aria-label="色変更">
        {DEFAULT_COLORS.map((color) => (
          <button
            aria-label={`色変更 ${color}`}
            key={color}
            style={{ background: color }}
            type="button"
            onClick={() => onChangeColor(color)}
          />
        ))}
      </div>
      <button type="button" role="menuitem" onClick={onComplete}>✓ 完了</button>
      <button className="danger" type="button" role="menuitem" onClick={onDelete}>削除</button>
      <button className="muted" type="button" role="menuitem" onClick={onClose}>閉じる</button>
    </div>
  );
}

function CalendarEventListPopover({ events, customers, contacts, onClose, onOpen }) {
  const sortedEvents = [...events].sort((a, b) => eventSortValue(a).localeCompare(eventSortValue(b)));

  return (
    <div className="calendar-list-popup-backdrop" role="presentation" onClick={onClose}>
      <article
        aria-modal="true"
        className="calendar-list-popover"
        role="dialog"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Calendar</p>
            <h2>予定一覧</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>閉じる</button>
        </div>
        <div className="calendar-list-popover-body">
          {sortedEvents.map((event) => {
            const baseEvent = event.seriesEvent || event;
            const contactNames = event.contactIds?.map((id) => contactName(contacts, id)).filter(Boolean).join(', ');
            return (
              <button
                className="calendar-list-popup-row"
                key={event.id}
                type="button"
                onClick={() => onOpen(event)}
              >
                <span>{formatDateLabel(event.date || eventDate(event))}</span>
                <span>{eventTimeLabel(event)}</span>
                <strong>{event.title || event.type || event.eventType}</strong>
                <span>{customerName(customers, event.customerId)}</span>
                <span>{contactNames || '-'}</span>
                <span>{isRecurringEvent(baseEvent) ? recurrenceLabel(baseEvent) : 'なし'}</span>
              </button>
            );
          })}
          {sortedEvents.length === 0 && <CalendarEmpty />}
        </div>
      </article>
    </div>
  );
}

function CalendarEventButton({
  event,
  customers,
  contacts,
  compact = false,
  onClick,
  onContextMenu,
  onDragEnd,
  onDragStart,
  onResizeStart,
}) {
  const names = event.contactIds?.map((id) => contactName(contacts, id)).filter(Boolean).join(', ');
  const baseEvent = event.seriesEvent || event;
  const editable = baseEvent.source === 'event';
  let longPressTimer = null;

  function startLongPress(touchEvent) {
    if (!editable || !onContextMenu) return;
    const touch = touchEvent.touches?.[0];
    if (!touch) return;
    longPressTimer = window.setTimeout(() => {
      onContextMenu({
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
    }, 650);
  }

  function cancelLongPress() {
    if (longPressTimer) window.clearTimeout(longPressTimer);
  }

  return (
    <button
      type="button"
      className={`calendar-event ${event.tone || event.eventType || 'event'} priority-${priorityClass(event.priority)} ${compact ? 'compact' : ''}`}
      draggable={editable}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragEnd={(dragEvent) => {
        cancelLongPress();
        onDragEnd?.(dragEvent);
      }}
      onDragStart={editable ? onDragStart : undefined}
      onTouchCancel={cancelLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onTouchStart={startLongPress}
      style={{ borderLeftColor: event.color || undefined }}
      title={[event.title || event.type || event.eventType, customerName(customers, event.customerId), names].filter(Boolean).join(' / ')}
    >
      <span className="calendar-event-meta">
        <b>{eventTypeIcon(event)}</b>
        {isRecurringEvent(baseEvent) && <em>Repeat</em>}
        {!compact && <span>{event.startAt ? toDateTimeLocal(event.startAt).replace('T', ' ') : event.date}</span>}
      </span>
      <strong>{event.title || event.type || event.eventType}</strong>
      {!compact && <small>{customerName(customers, event.customerId)}{names ? ` / ${names}` : ''}</small>}
      {editable && (
        <span
          aria-hidden="true"
          className="calendar-event-resize-handle"
          onPointerDown={onResizeStart}
        />
      )}
    </button>
  );
}

function CalendarEventPopover({
  event,
  customers,
  contacts,
  projects = [],
  onClose,
  onEdit,
  onOpenKarte,
  onOpenProject,
}) {
  const names = event.contactIds?.map((id) => contactName(contacts, id)).filter(Boolean).join(', ');
  const customer = customerName(customers, event.customerId);
  const project = projectName(projects, event.dealId);
  const baseEvent = event.seriesEvent || event;
  const canEdit = baseEvent.source === 'event';

  function openCustomer() {
    if (!event.customerId) return;
    onClose();
    onOpenKarte?.(event.customerId);
  }

  function openProject() {
    if (!event.dealId) return;
    onClose();
    onOpenProject?.(event.dealId);
  }

  return (
    <div className="calendar-detail-backdrop" role="presentation" onClick={onClose}>
      <article
        aria-modal="true"
        className={`calendar-detail-popover priority-${priorityClass(event.priority)}`}
        role="dialog"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{event.eventType || event.type || 'Event'}</p>
            <h2>{event.title || event.type || event.eventType}</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>閉じる</button>
        </div>
        <div className="calendar-detail-meta">
          <span className="info-badge" style={{ borderColor: event.color || undefined }}>{eventTypeIcon(event)}</span>
          <span className={`info-badge priority-${priorityClass(event.priority)}`}>{event.priority || '通常'}</span>
          <span className="info-badge">{event.status || '-'}</span>
          {isRecurringEvent(baseEvent) && <span className="info-badge">{recurrenceLabel(baseEvent)}</span>}
        </div>
        <dl className="company-details calendar-detail-list">
          <div><dt>繰り返し</dt><dd>{recurrenceLabel(baseEvent)}</dd></div>
          <div><dt>日時</dt><dd>{event.startAt ? toDateTimeLocal(event.startAt).replace('T', ' ') : event.date || '-'}{event.endAt ? ` ～ ${toDateTimeLocal(event.endAt).replace('T', ' ')}` : ''}</dd></div>
          <div><dt>顧客</dt><dd>{customer}</dd></div>
          <div><dt>担当者</dt><dd>{names || '-'}</dd></div>
          <div><dt>場所</dt><dd>{event.location || '-'}</dd></div>
          <div><dt>関連案件</dt><dd>{project || event.dealId || '-'}</dd></div>
          <div><dt>次回フォロー</dt><dd>{event.nextFollowDate || '-'}</dd></div>
          <div><dt>リマインダー</dt><dd>{event.reminder || '-'}</dd></div>
          <div className="calendar-detail-wide"><dt>メモ</dt><dd>{event.memo || '-'}</dd></div>
        </dl>
        <div className="calendar-detail-actions">
          {canEdit && <button className="primary-button" type="button" onClick={onEdit}>編集</button>}
          {event.customerId && <button className="ghost-button" type="button" onClick={openCustomer}>顧客カルテ</button>}
          {event.dealId && <button className="ghost-button" type="button" onClick={openProject}>案件詳細</button>}
        </div>
      </article>
    </div>
  );
}

function EventEditor({
  contacts,
  customers,
  projects = [],
  editing,
  form,
  onClose,
  onComplete,
  onDelete,
  onPostpone,
  onSave,
  updateForm,
}) {
  const relatedContacts = contacts.filter((contact) => !form.customerId || contact.customerId === form.customerId);

  function toggleContact(contactId) {
    const values = new Set(form.contactIds ?? []);
    if (values.has(contactId)) values.delete(contactId);
    else values.add(contactId);
    updateForm('contactIds', [...values]);
  }

  function toggleRecurrenceWeekday(weekday) {
    const values = new Set(normalizeWeekdays(form.recurrenceWeekdays));
    if (values.has(weekday)) values.delete(weekday);
    else values.add(weekday);
    updateForm('recurrenceWeekdays', normalizeWeekdays([...values]));
  }

  return (
    <div className="calendar-editor-backdrop">
      <form className="calendar-editor" onSubmit={onSave}>
        <div className="section-heading">
          <h2>{editing ? '予定編集' : '予定追加'}</h2>
          <button className="ghost-button" type="button" onClick={onClose}>閉じる</button>
        </div>
        <label className="field-label">
          件名
          <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="例: 新商品提案の商談" required />
        </label>
        <label className="field-label">
          予定種別
          <select value={form.eventType} onChange={(event) => updateForm('eventType', event.target.value)}>
            {EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="field-label">
          顧客
          <select value={form.customerId} onChange={(event) => updateForm('customerId', event.target.value)}>
            <option value="">未選択</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.companyName}</option>)}
          </select>
        </label>
        <label className="field-label">
          案件
          <select value={form.dealId} onChange={(event) => updateForm('dealId', event.target.value)}>
            <option value="">未選択</option>
            {projects
              .filter((project) => !form.customerId || project.customerId === form.customerId)
              .map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}
          </select>
        </label>
        <label className="field-label">
          場所
          <input value={form.location} onChange={(event) => updateForm('location', event.target.value)} placeholder="訪問先、会議URLなど" />
        </label>
        <label className="field-label">
          開始日時
          <input type="datetime-local" value={toDateTimeLocal(form.startAt)} onChange={(event) => updateForm('startAt', fromDateTimeLocal(event.target.value))} />
        </label>
        <label className="field-label">
          終了日時
          <input type="datetime-local" value={toDateTimeLocal(form.endAt)} onChange={(event) => updateForm('endAt', fromDateTimeLocal(event.target.value))} />
        </label>
        <label className="switch-row">
          <input type="checkbox" checked={form.allDay} onChange={(event) => updateForm('allDay', event.target.checked)} />
          終日
        </label>
        <label className="field-label">
          重要度
          <select value={form.priority} onChange={(event) => updateForm('priority', event.target.value)}>
            {EVENT_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
          </select>
        </label>
        <label className="field-label">
          ステータス
          <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
            {EVENT_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <div className="calendar-recurrence-fields">
          <label className="field-label">
            繰り返し
            <select value={form.recurrenceFrequency || 'none'} onChange={(event) => updateForm('recurrenceFrequency', event.target.value)}>
              {EVENT_RECURRENCE_FREQUENCIES.map((frequency) => (
                <option key={frequency.value} value={frequency.value}>{frequency.label}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            終了条件
            <select value={form.recurrenceEndType || 'none'} onChange={(event) => updateForm('recurrenceEndType', event.target.value)}>
              {EVENT_RECURRENCE_END_TYPES.map((endType) => (
                <option key={endType.value} value={endType.value}>{endType.label}</option>
              ))}
            </select>
          </label>
          {(form.recurrenceEndType || 'none') === 'date' && (
            <label className="field-label">
              終了日
              <input type="date" value={form.recurrenceEndDate || ''} onChange={(event) => updateForm('recurrenceEndDate', event.target.value)} />
            </label>
          )}
          {(form.recurrenceFrequency || 'none') === 'weekday_select' && (
            <div className="field-label calendar-weekday-picker">
              曜日
              <div>
                {WEEKDAY_OPTIONS.map((weekday) => (
                  <label className="switch-row" key={weekday.value}>
                    <input
                      checked={normalizeWeekdays(form.recurrenceWeekdays).includes(weekday.value)}
                      type="checkbox"
                      onChange={() => toggleRecurrenceWeekday(weekday.value)}
                    />
                    {weekday.label}
                  </label>
                ))}
              </div>
            </div>
          )}
          {(form.recurrenceFrequency || 'none') === 'monthly_day' && (
            <label className="field-label">
              毎月の日
              <input
                max="31"
                min="1"
                type="number"
                value={form.recurrenceMonthDay || startDateMonthDay(form)}
                onChange={(event) => updateForm('recurrenceMonthDay', event.target.value)}
              />
            </label>
          )}
        </div>
        <label className="field-label">
          次回フォロー日
          <input type="date" value={form.nextFollowDate || ''} onChange={(event) => updateForm('nextFollowDate', event.target.value)} />
        </label>
        <label className="field-label">
          リマインダー
          <input value={form.reminder} onChange={(event) => updateForm('reminder', event.target.value)} placeholder="例: 30分前、前日朝" />
        </label>
        <div className="field-label calendar-color-field">
          色
          <div className="calendar-color-grid">
            {DEFAULT_COLORS.map((color) => (
              <button
                aria-label={color}
                className={form.color === color ? 'selected' : ''}
                key={color}
                style={{ background: color }}
                type="button"
                onClick={() => updateForm('color', color)}
              />
            ))}
          </div>
        </div>
        <div className="field-label calendar-contact-picker">
          担当者
          <div>
            {relatedContacts.length > 0 ? relatedContacts.map((contact) => (
              <label className="switch-row" key={contact.id}>
                <input
                  checked={(form.contactIds ?? []).includes(contact.id)}
                  type="checkbox"
                  onChange={() => toggleContact(contact.id)}
                />
                {contact.name || '名称未設定'}
              </label>
            )) : <p className="inline-helper">顧客を選択すると担当者を絞り込めます。</p>}
          </div>
        </div>
        <label className="field-label calendar-editor-wide">
          メモ
          <textarea value={form.memo} onChange={(event) => updateForm('memo', event.target.value)} />
        </label>
        <div className="calendar-editor-actions">
          {editing && <button className="ghost-button danger" type="button" onClick={onDelete}>削除</button>}
          {editing && <button className="ghost-button" type="button" onClick={onPostpone}>延期として新日時を保存</button>}
          {editing && <button className="ghost-button" type="button" onClick={onComplete}>完了して商談履歴へ登録</button>}
          <button className="primary-button" type="submit">保存</button>
        </div>
      </form>
    </div>
  );
}

function CalendarEmpty() {
  return (
    <div className="empty-state compact-empty">
      <h3>予定はまだありません</h3>
      <p>日付をクリックするか、予定追加ボタンから登録できます。</p>
    </div>
  );
}

function buildSystemEvents({ customers, samples, quotes, complaints }) {
  const events = [];
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));

  customers.forEach((customer) => {
    const followDate = customer.nextFollowUpDate || customer.nextFollowDate;
    if (followDate) {
      events.push(systemEvent({
        id: `follow-${customer.id}-${followDate}`,
        date: followDate,
        type: 'フォロー',
        title: customer.pipelineMemo || customer.memo || 'フォロー予定',
        customer,
        tone: 'follow',
      }));
    }

    (customer.dealHistories ?? []).forEach((deal) => {
      if (!deal.date) return;
      events.push(systemEvent({
        id: `deal-${customer.id}-${deal.id}`,
        date: deal.date,
        type: '商談履歴',
        title: deal.summary || deal.type || '商談',
        customer,
        tone: 'deal',
      }));
    });
  });

  samples.forEach((sample) => {
    const customer = customersById.get(sample.customerId);
    if (!customer) return;
    if (sample.arrivalDate) {
      events.push(systemEvent({
        id: `sample-arrival-${sample.id}`,
        date: sample.arrivalDate,
        type: 'サンプル到着',
        title: sample.sampleName || 'サンプル到着予定',
        customer,
        tone: 'sample',
      }));
    }
    if (sample.followUpDate) {
      events.push(systemEvent({
        id: `sample-follow-${sample.id}`,
        date: sample.followUpDate,
        type: 'サンプルフォロー',
        title: sample.nextAction || sample.sampleName || 'サンプル反応確認',
        customer,
        tone: 'sample',
      }));
    }
  });

  quotes.forEach((quote) => {
    const customer = customersById.get(quote.customerId);
    if (!customer || !quote.validUntil) return;
    events.push(systemEvent({
      id: `quote-${quote.id}`,
      date: quote.validUntil,
      type: '見積期限',
      title: quote.quoteNumber || quote.memo || '見積有効期限',
      customer,
      tone: 'quote',
    }));
  });

  complaints.forEach((complaint) => {
    const customer = customersById.get(complaint.customerId);
    const dueDate = complaint.responseDueDate || complaint.dueDate || complaint.deadline || complaint.handlingDueDate;
    if (!customer || !dueDate) return;
    events.push(systemEvent({
      id: `complaint-${complaint.id}`,
      date: dueDate,
      type: 'クレーム対応',
      title: complaint.title || complaint.memo || '対応期限',
      customer,
      tone: 'complaint',
    }));
  });

  return events;
}

function systemEvent({ id, date, type, title, customer, tone }) {
  return {
    id,
    date: String(date).slice(0, 10),
    type,
    title,
    customerId: customer.id,
    customerName: customer.companyName || '顧客未設定',
    status: '参照',
    source: 'system',
    tone,
  };
}
