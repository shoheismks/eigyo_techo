import { useEffect, useMemo, useState } from 'react';
import {
  EVENT_PRIORITIES,
  EVENT_STATUSES,
  EVENT_TYPES,
  emptyEvent,
  normalizeEvent,
} from '../hooks/useEvents.js';

const VIEW_LABELS = {
  month: '月',
  week: '週',
  day: '日',
  list: '一覧',
};

const DEFAULT_COLORS = ['#2878ff', '#5ee2a0', '#ffd36a', '#af87ff', '#ff8a3d', '#ff6b7b'];
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
  user,
}) {
  const today = toDateKey(new Date());
  const [viewMode, setViewMode] = useState(() => readStoredViewMode());
  const [baseDate, setBaseDate] = useState(() => readStoredBaseDate(today));
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const systemEvents = useMemo(
    () => buildSystemEvents({ customers, samples, quotes, complaints }),
    [complaints, customers, quotes, samples],
  );
  const mergedEvents = useMemo(
    () => [
      ...events.map((event) => ({ ...event, source: 'event', date: eventDate(event) })),
      ...systemEvents,
    ].sort((a, b) => String(a.startAt || a.date).localeCompare(String(b.startAt || b.date))),
    [events, systemEvents],
  );
  const monthDays = useMemo(() => buildMonthDays(baseDate), [baseDate]);
  const weekDays = useMemo(() => buildWeekDays(baseDate), [baseDate]);
  const visibleDays = viewMode === 'week' ? weekDays : viewMode === 'day' ? [{ dateKey: baseDate, label: baseDate, inCurrentMonth: true }] : monthDays;
  const listEvents = useMemo(() => mergedEvents.filter((event) => event.status !== '中止'), [mergedEvents]);
  const calendarTitle = viewMode === 'week' ? formatWeekTitle(baseDate) : viewMode === 'day' ? formatDateLabel(baseDate) : formatMonthTitle(baseDate);

  useEffect(() => {
    window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    window.localStorage.setItem(CALENDAR_DATE_STORAGE_KEY, baseDate);
  }, [baseDate]);

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
    if (event.source !== 'event') {
      if (event.customerId) onOpenKarte?.(event.customerId);
      return;
    }
    setEditingEvent(event);
    setForm(normalizeEvent(event, user?.id ?? ''));
    setEditorOpen(true);
  }

  function closeForm() {
    setEditingEvent(null);
    setForm(null);
    setEditorOpen(false);
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
          <strong className="calendar-current-title">{calendarTitle}</strong>
          <div className="calendar-date-actions">
            <input type="date" value={baseDate} onChange={(event) => setBaseDate(event.target.value || today)} />
            <button className="primary-button compact-button" type="button" onClick={() => openAdd(baseDate)}>
              予定追加
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
              <CalendarEventButton contacts={contacts} customers={customers} event={event} key={event.id} onClick={() => openEdit(event)} />
            ))}
          </div>
          {listEvents.length === 0 && <CalendarEmpty />}
        </section>
      ) : viewMode === 'day' ? (
        <section className="calendar-day-schedule">
          {Array.from({ length: 12 }, (_, index) => index + 8).map((hour) => (
            <div
              className="calendar-time-slot"
              key={hour}
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
                        openEdit(event);
                      }}
                    />
                  ))}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="calendar-grid-panel">
          <div className="calendar-week-labels">
            {['日', '月', '火', '水', '木', '金', '土'].map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className={`calendar-grid ${viewMode === 'week' ? 'week-view' : ''}`}>
            {visibleDays.map((day) => {
              const dayEvents = eventsForDay(day.dateKey);
              const limit = viewMode === 'week' ? 8 : 4;
              return (
                <article
                  className={`calendar-day ${day.dateKey === today ? 'today' : ''} ${!day.inCurrentMonth ? 'muted' : ''}`}
                  key={day.dateKey}
                  onClick={(clickEvent) => {
                    if (clickEvent.target instanceof Element && clickEvent.target.closest('.calendar-event')) return;
                    openAdd(day.dateKey);
                  }}
                >
                  <div className="calendar-day-head">
                    <strong>{day.label}</strong>
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
                          openEdit(event);
                        }}
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

function CalendarEventButton({ event, customers, contacts, compact = false, onClick }) {
  const names = event.contactIds?.map((id) => contactName(contacts, id)).filter(Boolean).join(', ');
  return (
    <button
      type="button"
      className={`calendar-event ${event.tone || event.eventType || 'event'} ${compact ? 'compact' : ''}`}
      onClick={onClick}
      style={{ borderLeftColor: event.color || undefined }}
    >
      {!compact && <span>{event.startAt ? toDateTimeLocal(event.startAt).replace('T', ' ') : event.date}</span>}
      <strong>{event.title || event.type || event.eventType}</strong>
      <small>{customerName(customers, event.customerId)}{names ? ` / ${names}` : ''}</small>
      <em>{event.status || event.memo || '-'}</em>
    </button>
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
