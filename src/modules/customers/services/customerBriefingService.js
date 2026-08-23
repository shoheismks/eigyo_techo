const DONE_STATUSES = new Set(['完了', '完了済み', '終了', '削除', 'deleted', 'done']);
const CLOSED_PROJECT_STATUSES = new Set(['終了', '失注', '定番化', '削除', 'deleted']);
const CLOSED_QUOTE_STATUSES = new Set(['採用', '失注', '期限切れ', '削除', 'deleted']);
const CLOSED_SAMPLE_STATUSES = new Set(['採用', '不採用', '完了', '終了', '削除', 'deleted']);
const CLOSED_COMPLAINT_STATUSES = new Set(['完了', '解決', '終了', 'クローズ', '削除', 'deleted']);
const MEETING_TYPES = ['商談', '訪問', '電話', 'メール'];

function dateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function todayString() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

function compareDate(a, b) {
  return String(a || '9999-12-31').localeCompare(String(b || '9999-12-31'));
}

function isDoneStatus(status) {
  return DONE_STATUSES.has(String(status || '').trim());
}

function isOverdue(date, today) {
  return Boolean(date) && String(date).slice(0, 10) < today;
}

function sameCustomer(record, customerId) {
  return record?.customerId === customerId || record?.ownerId === customerId || record?.metadata?.customerId === customerId;
}

function contactScore(contact = {}) {
  const rankScore = { S: 500, A: 400, B: 300, C: 200, D: 100 };
  return Number(contact.importanceScore || contact.score || 0) + (rankScore[contact.importanceRank || contact.rank] || 0);
}

function normalizeText(value, fallback = '-') {
  if (Array.isArray(value)) return value.filter(Boolean).join(' / ') || fallback;
  return value || fallback;
}

function truncateText(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return { text, truncated: false };
  return { text: `${text.slice(0, maxLength)}...`, truncated: true };
}

function contactLabel(contact) {
  if (!contact) return '';
  return [contact.name, contact.department, contact.role].filter(Boolean).join(' / ');
}

function buildContactSummary(contacts = []) {
  const activeContacts = contacts.filter((contact) => !contact.deletedAt);
  const decisionMakers = activeContacts.filter((contact) => String(contact.decisionPower || '').trim());
  const keyContacts = [...activeContacts].sort((a, b) => contactScore(b) - contactScore(a));
  const keyContact = keyContacts[0] || null;
  const decisionMaker = decisionMakers.sort((a, b) => contactScore(b) - contactScore(a))[0] || null;

  return {
    keyContact,
    decisionMaker,
    keyContactLabel: contactLabel(keyContact),
    decisionMakerLabel: contactLabel(decisionMaker),
    phone: keyContact?.mobile || keyContact?.phone || '',
    email: keyContact?.email || '',
  };
}

function buildLastMeeting(dealHistories = [], maxLength = 180) {
  const history = [...dealHistories]
    .filter((item) => MEETING_TYPES.some((type) => String(item.type || '').includes(type)))
    .sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')))[0];

  if (!history) return null;

  const summary = truncateText(history.summary || history.nextAction || '', maxLength);
  return {
    id: history.id,
    date: dateOnly(history.date || history.createdAt),
    type: history.type || '商談',
    createdByName: history.createdByName || history.createdBy || '',
    contactNames: normalizeText(history.contactNames, ''),
    summary: summary.text,
    truncated: summary.truncated,
    nextAction: history.nextAction || '',
    replyCount: countReplies(history.replies),
  };
}

function countReplies(replies = []) {
  return replies.reduce((sum, reply) => sum + 1 + countReplies(reply.replies || []), 0);
}

function actionItem({ id, type, title, detail, date, priority = 50, tone = '', source }) {
  return {
    id,
    type,
    title: title || type,
    detail: detail || '',
    date: dateOnly(date),
    priority,
    tone,
    source,
  };
}

function buildNextActions({ customer, tasks = [], events = [], projects = [], quotes = [], samples = [], complaints = [], today }) {
  const customerId = customer.id;
  const actions = [];

  tasks
    .filter((task) => sameCustomer(task, customerId) && !task.deletedAt && !isDoneStatus(task.status))
    .forEach((task) => {
      const due = dateOnly(task.dueDate || task.due_at);
      if (isOverdue(due, today)) {
        actions.push(actionItem({
          id: `task-overdue-${task.id}`,
          type: '期限超過タスク',
          title: task.title || 'タスク',
          detail: [task.priority, task.assigneeName, task.status].filter(Boolean).join(' / '),
          date: due,
          priority: 10,
          tone: 'danger',
          source: { type: 'task', id: task.id },
        }));
        return;
      }
      if (due === today) {
        actions.push(actionItem({
          id: `task-today-${task.id}`,
          type: '今日期限タスク',
          title: task.title || 'タスク',
          detail: [task.priority, task.assigneeName, task.status].filter(Boolean).join(' / '),
          date: due,
          priority: 20,
          tone: 'warning',
          source: { type: 'task', id: task.id },
        }));
      }
    });

  events
    .filter((event) => sameCustomer(event, customerId) && !isDoneStatus(event.status))
    .filter((event) => event.startAt || event.nextFollowDate)
    .forEach((event) => {
      actions.push(actionItem({
        id: `event-${event.id}`,
        type: '次回予定',
        title: event.title || event.eventType || '予定',
        detail: [event.location, event.eventType, event.status].filter(Boolean).join(' / '),
        date: event.startAt || event.nextFollowDate,
        priority: 30,
        tone: dateOnly(event.startAt || event.nextFollowDate) === today ? 'active' : '',
        source: { type: 'event', id: event.id },
      }));
    });

  const followDate = dateOnly(customer.nextFollowUpDate || customer.nextFollowDate);
  if (followDate) {
    actions.push(actionItem({
      id: `customer-follow-${customer.id}`,
      type: '顧客フォロー',
      title: '次回フォロー',
      detail: customer.pipelineMemo || customer.memo || '顧客情報を確認',
      date: followDate,
      priority: 40,
      tone: isOverdue(followDate, today) ? 'danger' : '',
      source: { type: 'customer', id: customer.id },
    }));
  }

  projects
    .filter((project) => sameCustomer(project, customerId) && !CLOSED_PROJECT_STATUSES.has(project.status))
    .forEach((project) => {
      actions.push(actionItem({
        id: `project-${project.id}`,
        type: '進行案件',
        title: project.nextAction || project.title || '案件確認',
        detail: [project.status, project.priority].filter(Boolean).join(' / '),
        date: project.nextActionDate || project.expectedCloseDate || project.updatedAt,
        priority: 50,
        source: { type: 'project', id: project.id },
      }));
    });

  quotes
    .filter((quote) => sameCustomer(quote, customerId) && !CLOSED_QUOTE_STATUSES.has(quote.status))
    .forEach((quote) => {
      actions.push(actionItem({
        id: `quote-${quote.id}`,
        type: isOverdue(quote.validUntil, today) ? '期限切れ見積' : '有効見積',
        title: quote.quoteNumber || quote.projectName || '見積確認',
        detail: [quote.status, quote.validUntil ? `期限 ${quote.validUntil}` : ''].filter(Boolean).join(' / '),
        date: quote.validUntil || quote.updatedAt,
        priority: isOverdue(quote.validUntil, today) ? 60 : 70,
        tone: isOverdue(quote.validUntil, today) ? 'danger' : '',
        source: { type: 'quote', id: quote.id },
      }));
    });

  samples
    .filter((sample) => sameCustomer(sample, customerId) && !CLOSED_SAMPLE_STATUSES.has(sample.status))
    .forEach((sample) => {
      actions.push(actionItem({
        id: `sample-${sample.id}`,
        type: 'サンプルフォロー',
        title: sample.nextAction || sample.sampleName || 'サンプル確認',
        detail: sample.status || '',
        date: sample.followUpDate || sample.updatedAt,
        priority: 80,
        tone: isOverdue(sample.followUpDate, today) ? 'danger' : '',
        source: { type: 'sample', id: sample.id },
      }));
    });

  complaints
    .filter((complaint) => sameCustomer(complaint, customerId) && !CLOSED_COMPLAINT_STATUSES.has(complaint.status))
    .forEach((complaint) => {
      actions.push(actionItem({
        id: `complaint-${complaint.id}`,
        type: '未解決クレーム',
        title: complaint.title || complaint.memo || 'クレーム確認',
        detail: [complaint.status, complaint.severity].filter(Boolean).join(' / '),
        date: complaint.dueDate || complaint.updatedAt || complaint.createdAt,
        priority: 90,
        tone: 'danger',
        source: { type: 'complaint', id: complaint.id },
      }));
    });

  return actions.sort((a, b) => a.priority - b.priority || compareDate(a.date, b.date)).slice(0, 8);
}

function buildProgress({ customer, tasks = [], events = [], projects = [], quotes = [], samples = [] }) {
  const customerId = customer.id;
  return {
    projects: projects.filter((project) => sameCustomer(project, customerId) && !CLOSED_PROJECT_STATUSES.has(project.status)).length,
    quotes: quotes.filter((quote) => sameCustomer(quote, customerId) && !CLOSED_QUOTE_STATUSES.has(quote.status)).length,
    samples: samples.filter((sample) => sameCustomer(sample, customerId) && !CLOSED_SAMPLE_STATUSES.has(sample.status)).length,
    tasks: tasks.filter((task) => sameCustomer(task, customerId) && !task.deletedAt && !isDoneStatus(task.status)).length,
    events: events.filter((event) => sameCustomer(event, customerId) && !isDoneStatus(event.status)).length,
  };
}

function buildRisks({ customer, tasks = [], quotes = [], samples = [], complaints = [], today }) {
  const customerId = customer.id;
  const unresolvedComplaints = complaints.filter((complaint) => sameCustomer(complaint, customerId) && !CLOSED_COMPLAINT_STATUSES.has(complaint.status));
  const overdueTasks = tasks.filter((task) => sameCustomer(task, customerId) && !task.deletedAt && !isDoneStatus(task.status) && isOverdue(task.dueDate, today));
  const expiredQuotes = quotes.filter((quote) => sameCustomer(quote, customerId) && !CLOSED_QUOTE_STATUSES.has(quote.status) && isOverdue(quote.validUntil, today));
  const overdueSamples = samples.filter((sample) => sameCustomer(sample, customerId) && !CLOSED_SAMPLE_STATUSES.has(sample.status) && isOverdue(sample.followUpDate, today));

  return [
    customer.isDoNotContact && { id: 'do-not-contact', label: 'NG/配信停止', count: 1, tone: 'danger' },
    unresolvedComplaints.length > 0 && { id: 'complaints', label: '未解決クレーム', count: unresolvedComplaints.length, tone: 'danger' },
    overdueTasks.length > 0 && { id: 'tasks', label: '期限超過タスク', count: overdueTasks.length, tone: 'danger' },
    expiredQuotes.length > 0 && { id: 'quotes', label: '見積期限切れ', count: expiredQuotes.length, tone: 'warning' },
    overdueSamples.length > 0 && { id: 'samples', label: 'サンプルfollow超過', count: overdueSamples.length, tone: 'warning' },
  ].filter(Boolean);
}

export function buildCustomerBriefing({
  karte,
  customer,
  contacts = [],
  tasks = [],
  events = [],
  projects = [],
  quotes = [],
  samples = [],
  complaints = [],
}) {
  if (!customer) return null;
  const today = todayString();
  const contactSummary = buildContactSummary(contacts);
  const nextActions = buildNextActions({ customer, tasks, events, projects, quotes, samples, complaints, today });
  const lastMeeting = buildLastMeeting(karte?.dealHistories || customer.dealHistories || []);

  return {
    customer: {
      id: customer.id,
      name: customer.companyName || customer.name || '-',
      status: customer.status || '未接触',
      rank: customer.customerRank || customer.rank || 'D',
      score: customer.score ?? '',
      nextFollowDate: dateOnly(customer.nextFollowUpDate || customer.nextFollowDate),
      isDoNotContact: Boolean(customer.isDoNotContact),
    },
    contactSummary,
    nextActions,
    lastMeeting,
    progress: buildProgress({ customer, tasks, events, projects, quotes, samples }),
    risks: buildRisks({ customer, tasks, quotes, samples, complaints, today }),
  };
}
