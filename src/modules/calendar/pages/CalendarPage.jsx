import { useMemo, useState } from 'react';

export default function CalendarPage({ customers, samples = [], quotes = [], complaints = [], onOpenKarte }) {
  const [viewMode, setViewMode] = useState('month');
  const today = toDateKey(new Date());
  const events = useMemo(
    () => buildCalendarEvents({ customers, samples, quotes, complaints }),
    [complaints, customers, quotes, samples],
  );
  const monthDays = useMemo(() => buildMonthDays(today), [today]);
  const weekDays = useMemo(() => buildWeekDays(today), [today]);
  const visibleDays = viewMode === 'week' ? weekDays : monthDays;
  const visibleEvents = useMemo(() => {
    if (viewMode === 'list') return events;
    const daySet = new Set(visibleDays.map((day) => day.dateKey));
    return events.filter((event) => daySet.has(event.date));
  }, [events, viewMode, visibleDays]);

  function eventsForDay(dateKey) {
    return visibleEvents.filter((event) => event.date === dateKey);
  }

  function openEvent(event) {
    if (event.customerId) {
      onOpenKarte(event.customerId);
    }
  }

  return (
    <section className="page">
      <div className="page-header calendar-page-header">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1>営業カレンダー</h1>
          <p>フォロー、商談、サンプル、見積、クレーム対応をまとめて確認できます。</p>
        </div>
        <div className="segmented-control calendar-view-switch" aria-label="カレンダー表示切替">
          <button type="button" className={viewMode === 'month' ? 'selected' : ''} onClick={() => setViewMode('month')}>月</button>
          <button type="button" className={viewMode === 'week' ? 'selected' : ''} onClick={() => setViewMode('week')}>週</button>
          <button type="button" className={viewMode === 'list' ? 'selected' : ''} onClick={() => setViewMode('list')}>リスト</button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <section className="desktop-panel">
          <div className="section-heading">
            <h2>予定一覧</h2>
            <span className="info-badge">{events.length}件</span>
          </div>
          <div className="calendar-list">
            {events.map((event) => (
              <CalendarEventButton event={event} key={event.id} onClick={() => openEvent(event)} />
            ))}
          </div>
          {events.length === 0 && <CalendarEmpty />}
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
                <article className={`calendar-day ${day.dateKey === today ? 'today' : ''} ${!day.inCurrentMonth ? 'muted' : ''}`} key={day.dateKey}>
                  <div className="calendar-day-head">
                    <strong>{day.label}</strong>
                    {dayEvents.length > 0 && <span>{dayEvents.length}</span>}
                  </div>
                  <div className="calendar-day-events">
                    {dayEvents.slice(0, limit).map((event) => (
                      <CalendarEventButton compact event={event} key={event.id} onClick={() => openEvent(event)} />
                    ))}
                    {dayEvents.length > limit && <small className="calendar-more">+{dayEvents.length - limit}件</small>}
                  </div>
                </article>
              );
            })}
          </div>
          {visibleEvents.length === 0 && <CalendarEmpty />}
        </section>
      )}
    </section>
  );
}

function CalendarEventButton({ event, compact = false, onClick }) {
  return (
    <button type="button" className={`calendar-event ${event.tone} ${compact ? 'compact' : ''}`} onClick={onClick}>
      {!compact && <span>{event.date}</span>}
      <strong>{event.type}</strong>
      <small>{event.customerName}</small>
      <em>{event.title}</em>
    </button>
  );
}

function CalendarEmpty() {
  return (
    <div className="empty-state compact-empty">
      <h3>予定はまだありません</h3>
      <p>顧客カルテ、案件、サンプル、見積、クレームに日付を登録すると表示されます。</p>
    </div>
  );
}

function buildCalendarEvents({ customers, samples, quotes, complaints }) {
  const events = [];
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));

  customers.forEach((customer) => {
    const followDate = customer.nextFollowUpDate || customer.nextFollowDate;
    if (followDate) {
      events.push(calendarEvent({
        id: `follow-${customer.id}-${followDate}`,
        date: followDate,
        type: '次回フォロー',
        title: customer.pipelineMemo || customer.memo || 'フォロー予定',
        customer,
        tone: 'follow',
      }));
    }

    (customer.dealHistories ?? []).forEach((deal) => {
      if (!deal.date) return;
      events.push(calendarEvent({
        id: `deal-${customer.id}-${deal.id}`,
        date: deal.date,
        type: '商談予定',
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
      events.push(calendarEvent({
        id: `sample-arrival-${sample.id}`,
        date: sample.arrivalDate,
        type: 'サンプル到着',
        title: sample.sampleName || 'サンプル到着予定',
        customer,
        tone: 'sample',
      }));
    }
    if (sample.followUpDate) {
      events.push(calendarEvent({
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
    events.push(calendarEvent({
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
    events.push(calendarEvent({
      id: `complaint-${complaint.id}`,
      date: dueDate,
      type: 'クレーム対応',
      title: complaint.title || complaint.memo || '対応期限',
      customer,
      tone: 'complaint',
    }));
  });

  return events
    .filter((event) => event.date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
}

function calendarEvent({ id, date, type, title, customer, tone }) {
  return {
    id,
    date: String(date).slice(0, 10),
    type,
    title,
    customerId: customer.id,
    customerName: customer.companyName || '取引先未設定',
    tone,
  };
}

function toDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
