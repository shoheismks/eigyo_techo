import { calculateCompanyScore } from '../../modules/customers/services/scoringService.js';
import {
  calculateContractBalanceLines,
  summarizeContractBalances,
} from '../../modules/salesOrders/services/contractBalanceService.js';

const DONE_CUSTOMER_STATUSES = ['成約', '失注'];
const CLOSED_TASK_STATUSES = ['完了', '削除', '取消', '中止', 'done', 'completed', 'cancelled', 'canceled'];
const CLOSED_EVENT_STATUSES = ['完了', '削除', '取消', '中止', 'done', 'completed', 'cancelled', 'canceled'];
const CLOSED_QUOTE_STATUSES = ['採用', '失注', '取消', 'キャンセル'];
const CLOSED_SAMPLE_STATUSES = ['採用', '不採用', '完了', '取消'];
const CLOSED_COMPLAINT_STATUSES = ['完了', '解決', '取消'];
const ACTIVE_INBOUND_STATUSES = ['pending', 'partially_received'];

export function buildHomeDashboard({
  customers = [],
  tasks = [],
  events = [],
  projects = [],
  quotes = [],
  samples = [],
  complaints = [],
  salesOrders = [],
  shipments = [],
  inventories = [],
  inboundShipments = [],
  inboundShipmentLines = [],
  inventoryLots = [],
  now = new Date(),
}) {
  const today = toDateKey(now);
  const weekEnd = addDaysKey(today, 6);
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const scoredCustomers = customers.map((customer) => ({ ...customer, ...calculateCompanyScore(customer) }));

  const activeTasks = tasks.filter(isActiveTask);
  const todayTasks = activeTasks.filter((task) => getTaskDueDate(task) === today);
  const overdueTasks = activeTasks.filter((task) => getTaskDueDate(task) && getTaskDueDate(task) < today);

  const activeEvents = events.filter(isActiveEvent);
  const todayEvents = activeEvents
    .filter((event) => getEventDate(event) === today)
    .sort((a, b) => String(a.startAt || a.start_at || '').localeCompare(String(b.startAt || b.start_at || '')));

  const followToday = scoredCustomers.filter((customer) => {
    const date = getFollowDate(customer);
    return date && date <= today && !DONE_CUSTOMER_STATUSES.includes(customer.status) && !customer.isDoNotContact;
  });

  const quoteWaiting = quotes.filter((quote) => ['作成中', '提出待ち', '未提出'].includes(String(quote.status || ''))).length;
  const quoteExpiredItems = quotes.filter((quote) => {
    const validUntil = getFirstValue(quote, ['validUntil', 'valid_until', 'expiresAt', 'expires_at']);
    return validUntil && String(validUntil).slice(0, 10) < today && !CLOSED_QUOTE_STATUSES.includes(String(quote.status || ''));
  });

  const sampleFollowItems = samples.filter((sample) => {
    const date = getFirstValue(sample, ['followUpDate', 'follow_up_date', 'nextFollowDate', 'next_follow_date']);
    return date && String(date).slice(0, 10) <= weekEnd && !CLOSED_SAMPLE_STATUSES.includes(String(sample.status || ''));
  });

  const complaintDueItems = complaints.filter((complaint) => {
    const date = getFirstValue(complaint, ['responseDueDate', 'response_due_date', 'dueDate', 'due_date', 'deadline']);
    return date && String(date).slice(0, 10) <= today && !CLOSED_COMPLAINT_STATUSES.includes(String(complaint.status || ''));
  });

  const inboundSoonItems = getInboundLines({ inboundShipments, inboundShipmentLines })
    .filter(isActiveInboundLine)
    .filter((line) => {
      const date = getInboundDate(line);
      return date && date >= today && date <= weekEnd;
    })
    .sort((a, b) => getInboundDate(a).localeCompare(getInboundDate(b)));

  const contractBalanceLines = calculateContractBalanceLines({ salesOrders, shipments });
  const contractBalanceSummary = summarizeContractBalances(contractBalanceLines);
  const contractRemainingOrders = new Set(contractBalanceLines.filter((line) => line.hasRemaining).map((line) => line.salesOrderId)).size;
  const overdueContractBalances = contractBalanceLines.filter((line) => line.isOverdue);
  const inventoryAlerts = buildInventoryAlerts({ inventories, inventoryLots, today });

  return {
    today,
    weekEnd,
    dateLabel: formatLongDate(now),
    summaryCards: [
      makeSummary('today-events', '今日の予定', todayEvents.length, 'calendar', 'blue'),
      makeSummary('today-tasks', '今日のタスク', todayTasks.length, 'task', 'green'),
      makeSummary('overdue-tasks', '期限超過', overdueTasks.length, 'task', overdueTasks.length > 0 ? 'red' : 'blue'),
      makeSummary('follow-today', '本日フォロー', followToday.length, 'pipeline', followToday.length > 0 ? 'orange' : 'blue'),
      makeSummary('inbound-soon', '入荷予定', inboundSoonItems.length, 'inbound', inboundSoonItems.length > 0 ? 'purple' : 'blue'),
      makeSummary('inventory-attention', '在庫注意', inventoryAlerts.total, 'inventory', inventoryAlerts.total > 0 ? 'gold' : 'blue'),
    ],
    nextActions: buildNextActions({
      today,
      overdueTasks,
      todayTasks,
      todayEvents,
      followToday,
      quoteExpiredItems,
      sampleFollowItems,
      complaintDueItems,
      inboundSoonItems,
      overdueContractBalances,
      customerById,
      projectById,
    }),
    businessAlerts: buildBusinessAlerts({
      quoteExpiredItems,
      contractBalanceSummary,
      contractRemainingOrders,
      overdueContractBalances,
      inventoryAlerts,
      sampleFollowItems,
      complaintDueItems,
      inboundSoonItems,
    }),
    kpis: [
      {
        id: 'quote-waiting',
        label: '提出待ち見積',
        value: quoteWaiting,
        tone: quoteWaiting > 0 ? 'blue' : 'muted',
        action: 'quote',
      },
      {
        id: 'active-deals',
        label: '商談中',
        value: countActiveDeals({ projects, customers }),
        tone: 'orange',
        action: 'pipeline',
      },
      {
        id: 'contract-balance',
        label: '契約残',
        value: contractRemainingOrders,
        note: `${formatNumber(contractBalanceSummary.totalRemainingAmount)}円`,
        tone: contractRemainingOrders > 0 ? 'gold' : 'muted',
        action: 'salesOrders',
      },
    ],
  };
}

function buildNextActions({
  today,
  overdueTasks,
  todayTasks,
  todayEvents,
  followToday,
  quoteExpiredItems,
  sampleFollowItems,
  complaintDueItems,
  inboundSoonItems,
  overdueContractBalances,
  customerById,
  projectById,
}) {
  const actions = [
    ...overdueTasks.map((task) => taskAction(task, customerById, projectById, 1, '期限超過')),
    ...todayEvents.map((event) => eventAction(event, customerById, 2)),
    ...todayTasks.map((task) => taskAction(task, customerById, projectById, 3, '本日期限')),
    ...followToday.map((customer) => followAction(customer, today, 4)),
    ...quoteExpiredItems.map((quote) => quoteAction(quote, customerById, 5)),
    ...sampleFollowItems.map((sample) => sampleAction(sample, customerById, today, 6)),
    ...complaintDueItems.map((complaint) => complaintAction(complaint, customerById, 7)),
    ...inboundSoonItems.map((line) => inboundAction(line, 8)),
    ...overdueContractBalances.map((line) => contractAction(line, 9)),
  ];

  return actions
    .filter(Boolean)
    .sort((a, b) => a.priorityGroup - b.priorityGroup || String(a.sortDate || '').localeCompare(String(b.sortDate || '')))
    .slice(0, 12);
}

function taskAction(task, customerById, projectById, priorityGroup, badge) {
  const customer = customerById.get(task.customerId || task.customer_id);
  const project = projectById.get(task.projectId || task.project_id || task.dealId || task.deal_id);
  return {
    id: `task-${task.id}`,
    type: 'task',
    badge,
    tone: priorityTone(task.priority),
    dateLabel: getTaskDueDate(task) || '期限未設定',
    sortDate: getTaskDueDate(task) || '9999-12-31',
    customerName: customer?.companyName || customer?.company_name || task.customerName || task.customer_name || project?.customerName || '',
    title: task.title || task.subject || 'タスク',
    description: task.content || task.memo || project?.title || project?.name || '',
    priority: task.priority || '',
    customerId: customer?.id || task.customerId || task.customer_id,
    actions: makeActions({ customerId: customer?.id || task.customerId || task.customer_id, calendar: true, mail: customer?.email, phone: customer?.phone }),
    priorityGroup,
  };
}

function eventAction(event, customerById, priorityGroup) {
  const customer = customerById.get(event.customerId || event.customer_id);
  return {
    id: `event-${event.id}`,
    type: 'event',
    badge: '予定',
    tone: 'blue',
    dateLabel: formatEventDateTime(event),
    sortDate: String(event.startAt || event.start_at || ''),
    customerName: customer?.companyName || customer?.company_name || event.customerName || event.customer_name || '',
    title: event.title || event.eventType || event.event_type || '予定',
    description: event.location || event.memo || '',
    customerId: customer?.id || event.customerId || event.customer_id,
    actions: makeActions({ customerId: customer?.id || event.customerId || event.customer_id, calendar: true, mail: customer?.email, phone: customer?.phone }),
    priorityGroup,
  };
}

function followAction(customer, today, priorityGroup) {
  return {
    id: `follow-${customer.id}`,
    type: 'follow',
    badge: 'フォロー',
    tone: getFollowDate(customer) < today ? 'red' : 'orange',
    dateLabel: getFollowDate(customer),
    sortDate: getFollowDate(customer),
    customerName: customer.companyName || customer.company_name || '',
    title: customer.nextAction || customer.followMemo || customer.memo || '次回フォロー',
    description: customer.status || '',
    customerId: customer.id,
    actions: makeActions({ customerId: customer.id, record: true, mail: customer.email, phone: customer.phone }),
    priorityGroup,
  };
}

function quoteAction(quote, customerById, priorityGroup) {
  const customer = customerById.get(quote.customerId || quote.customer_id);
  const validUntil = getFirstValue(quote, ['validUntil', 'valid_until', 'expiresAt', 'expires_at']);
  return {
    id: `quote-${quote.id}`,
    type: 'quote',
    badge: '見積期限',
    tone: 'red',
    dateLabel: String(validUntil || '').slice(0, 10),
    sortDate: String(validUntil || '').slice(0, 10),
    customerName: customer?.companyName || customer?.company_name || quote.customerName || quote.customer_name || '',
    title: quote.quoteNumber || quote.quote_number || quote.subject || '見積',
    description: quote.status || '',
    customerId: customer?.id || quote.customerId || quote.customer_id,
    actions: makeActions({ customerId: customer?.id || quote.customerId || quote.customer_id, quote: true }),
    priorityGroup,
  };
}

function sampleAction(sample, customerById, today, priorityGroup) {
  const customer = customerById.get(sample.customerId || sample.customer_id);
  const date = String(getFirstValue(sample, ['followUpDate', 'follow_up_date', 'nextFollowDate', 'next_follow_date']) || '').slice(0, 10);
  return {
    id: `sample-${sample.id}`,
    type: 'sample',
    badge: 'サンプル',
    tone: date < today ? 'red' : 'orange',
    dateLabel: date,
    sortDate: date,
    customerName: customer?.companyName || customer?.company_name || sample.customerName || sample.customer_name || '',
    title: sample.sampleName || sample.sample_name || sample.productName || sample.product_name || 'サンプル確認',
    description: sample.status || '',
    customerId: customer?.id || sample.customerId || sample.customer_id,
    actions: makeActions({ customerId: customer?.id || sample.customerId || sample.customer_id, record: true }),
    priorityGroup,
  };
}

function complaintAction(complaint, customerById, priorityGroup) {
  const customer = customerById.get(complaint.customerId || complaint.customer_id);
  const date = String(getFirstValue(complaint, ['responseDueDate', 'response_due_date', 'dueDate', 'due_date', 'deadline']) || '').slice(0, 10);
  return {
    id: `complaint-${complaint.id}`,
    type: 'complaint',
    badge: 'クレーム',
    tone: 'red',
    dateLabel: date,
    sortDate: date,
    customerName: customer?.companyName || customer?.company_name || complaint.customerName || complaint.customer_name || '',
    title: complaint.title || complaint.subject || 'クレーム対応',
    description: complaint.status || '',
    customerId: customer?.id || complaint.customerId || complaint.customer_id,
    actions: makeActions({ customerId: customer?.id || complaint.customerId || complaint.customer_id, mail: customer?.email, phone: customer?.phone }),
    priorityGroup,
  };
}

function inboundAction(line, priorityGroup) {
  const date = getInboundDate(line);
  return {
    id: `inbound-${line.id || line.duplicateKey || line.duplicate_key}`,
    type: 'inbound',
    badge: '入荷予定',
    tone: 'purple',
    dateLabel: date,
    sortDate: date,
    customerName: line.supplierName || line.supplier_name || line.supplier || '',
    title: line.productNameRaw || line.product_name_raw || line.productName || line.product_name || '入荷予定',
    description: `${line.contractNo || line.contract_no || '契約No未設定'} / ${formatQuantity(getRemainingQuantity(line), line.unit || 'kg')}`,
    actions: makeActions({ inbound: true, inventory: true }),
    priorityGroup,
  };
}

function contractAction(line, priorityGroup) {
  return {
    id: `contract-${line.salesOrderId}-${line.productId || line.productName}`,
    type: 'contract',
    badge: '契約残',
    tone: 'red',
    dateLabel: line.dueDate || '納期未設定',
    sortDate: line.dueDate || '9999-12-31',
    customerName: line.customerName || '',
    title: line.productName || line.salesOrderNumber || '契約残',
    description: `残 ${formatNumber(line.remainingQuantity || line.remainingAmount || 0)}`,
    actions: makeActions({ salesOrders: true, inventory: true }),
    priorityGroup,
  };
}

function buildBusinessAlerts({
  quoteExpiredItems,
  contractBalanceSummary,
  contractRemainingOrders,
  overdueContractBalances,
  inventoryAlerts,
  sampleFollowItems,
  complaintDueItems,
  inboundSoonItems,
}) {
  return [
    {
      id: 'quote-expired',
      label: '見積期限切れ',
      value: quoteExpiredItems.length,
      tone: quoteExpiredItems.length > 0 ? 'red' : 'blue',
      action: 'quote',
      description: quoteExpiredItems.length > 0 ? '期限切れ見積の再確認が必要です。' : '期限切れ見積はありません。',
    },
    {
      id: 'contract-balance',
      label: '契約残',
      value: contractRemainingOrders,
      tone: contractRemainingOrders > 0 ? 'gold' : 'blue',
      action: 'salesOrders',
      description: `残金額 ${formatNumber(contractBalanceSummary.totalRemainingAmount)}円`,
    },
    {
      id: 'contract-overdue',
      label: '納期超過',
      value: new Set(overdueContractBalances.map((line) => line.salesOrderId)).size,
      tone: overdueContractBalances.length > 0 ? 'red' : 'blue',
      action: 'salesOrders',
      description: overdueContractBalances.length > 0 ? '未出荷の納期超過があります。' : '納期超過はありません。',
    },
    {
      id: 'inventory-alert',
      label: '在庫注意',
      value: inventoryAlerts.total,
      tone: inventoryAlerts.total > 0 ? 'orange' : 'blue',
      action: 'inventory',
      description: `在庫切れ ${inventoryAlerts.outOfStock} / 安全在庫以下 ${inventoryAlerts.belowSafety} / 期限注意 ${inventoryAlerts.expiringSoon}`,
    },
    {
      id: 'sample-follow',
      label: 'サンプルフォロー',
      value: sampleFollowItems.length,
      tone: sampleFollowItems.length > 0 ? 'orange' : 'blue',
      action: 'customer',
      description: sampleFollowItems.length > 0 ? 'フォロー予定のサンプルがあります。' : 'サンプルフォローはありません。',
    },
    {
      id: 'complaint-due',
      label: 'クレーム期限',
      value: complaintDueItems.length,
      tone: complaintDueItems.length > 0 ? 'red' : 'blue',
      action: 'customer',
      description: complaintDueItems.length > 0 ? '対応期限の近いクレームがあります。' : '期限中のクレームはありません。',
    },
    {
      id: 'inbound-soon',
      label: '7日以内の入荷予定',
      value: inboundSoonItems.length,
      tone: inboundSoonItems.length > 0 ? 'purple' : 'blue',
      action: 'inbound',
      description: inboundSoonItems.length > 0 ? '通関予定が近い入荷があります。' : '7日以内の入荷予定はありません。',
    },
  ];
}

function buildInventoryAlerts({ inventories, inventoryLots, today }) {
  const soon = addDaysKey(today, 30);
  const outOfStock = inventories.filter((inventory) => Number(inventory.quantity || 0) <= 0).length;
  const belowSafety = inventories.filter(
    (inventory) => Number(inventory.safetyStock || 0) > 0 && Number(inventory.quantity || 0) <= Number(inventory.safetyStock || 0),
  ).length;
  const legacyExpiring = inventories.filter((inventory) => inventory.expiryDate && inventory.expiryDate >= today && inventory.expiryDate <= soon).length;
  const lotExpiring = inventoryLots.filter((lot) => {
    const expiry = String(lot.expiryDate || lot.expiry_date || '').slice(0, 10);
    const status = String(lot.status || '');
    return expiry && expiry >= today && expiry <= soon && Number(lot.quantity || 0) > 0 && !['deleted', 'cancelled', 'voided'].includes(status);
  }).length;
  const expiringSoon = Math.max(legacyExpiring, lotExpiring);
  return { outOfStock, belowSafety, expiringSoon, total: outOfStock + belowSafety + expiringSoon };
}

function makeSummary(id, label, value, action, tone) {
  return { id, label, value, action, tone };
}

function makeActions({ customerId, record, calendar, quote, inventory, inbound, salesOrders, mail, phone }) {
  return [
    customerId ? { type: 'karte', label: 'カルテ', customerId } : null,
    record ? { type: 'record', label: '記録' } : null,
    calendar ? { type: 'calendar', label: '予定' } : null,
    quote ? { type: 'quote', label: '見積' } : null,
    inventory ? { type: 'inventory', label: '在庫' } : null,
    inbound ? { type: 'inbound', label: '入荷予定' } : null,
    salesOrders ? { type: 'salesOrders', label: '受注' } : null,
    phone ? { type: 'phone', label: '電話', href: `tel:${phone}` } : null,
    mail ? { type: 'email', label: 'メール', href: `mailto:${mail}` } : null,
  ].filter(Boolean);
}

function getInboundLines({ inboundShipments, inboundShipmentLines }) {
  if (Array.isArray(inboundShipmentLines) && inboundShipmentLines.length > 0) {
    return inboundShipmentLines.map((line) => {
      const shipment = inboundShipments.find((item) => item.id === (line.inboundShipmentId || line.inbound_shipment_id));
      return {
        ...line,
        supplierName: line.supplierName || line.supplier_name || shipment?.supplierName || shipment?.supplier_name,
      };
    });
  }
  return inboundShipments.flatMap((shipment) => {
    const lines = Array.isArray(shipment.lines) ? shipment.lines : [];
    return lines.map((line) => ({ ...line, supplierName: shipment.supplierName || shipment.supplier_name }));
  });
}

function isActiveInboundLine(line) {
  const status = String(line.status || 'pending');
  return ACTIVE_INBOUND_STATUSES.includes(status) && getRemainingQuantity(line) > 0;
}

function getRemainingQuantity(line) {
  const weight = getNumber(line.remainingWeight ?? line.remaining_weight);
  if (weight > 0) return weight;
  const pieces = getNumber(line.remainingPieces ?? line.remaining_pieces);
  if (pieces > 0) return pieces;
  const plannedWeight = getNumber(line.weight);
  return plannedWeight > 0 ? plannedWeight : getNumber(line.quantityPieces ?? line.quantity_pieces);
}

function getInboundDate(line) {
  return String(line.customsClearancePlannedDate || line.customs_clearance_planned_date || '').slice(0, 10);
}

function getTaskDueDate(task) {
  return String(task.dueDate || task.due_date || task.deadline || '').slice(0, 10);
}

function getEventDate(event) {
  const value = event.startAt || event.start_at || event.date || '';
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  return toDateKey(value);
}

function getFollowDate(customer) {
  return String(customer.nextFollowUpDate || customer.nextFollowDate || customer.next_follow_up_date || customer.next_follow_date || '').slice(0, 10);
}

function isActiveTask(task) {
  const status = String(task.status || '');
  return !task.deletedAt && !task.deleted_at && !task.isDeleted && !CLOSED_TASK_STATUSES.includes(status);
}

function isActiveEvent(event) {
  const status = String(event.status || '');
  return !event.deletedAt && !event.deleted_at && !event.isDeleted && !CLOSED_EVENT_STATUSES.includes(status);
}

function countActiveDeals({ projects, customers }) {
  if (Array.isArray(projects) && projects.length > 0) {
    return projects.filter((project) => !['成約', '失注', '完了', '取消'].includes(String(project.status || ''))).length;
  }
  return customers.filter((customer) => customer.status === '商談中').length;
}

function priorityTone(priority) {
  if (priority === '高') return 'red';
  if (priority === '中') return 'orange';
  if (priority === '低') return 'green';
  return 'blue';
}

function formatEventDateTime(event) {
  const source = event.startAt || event.start_at || '';
  if (!source) return '';
  const date = getEventDate(event);
  const parsed = new Date(source);
  const time = Number.isNaN(parsed.getTime())
    ? String(source).slice(11, 16)
    : parsed.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  return time ? `${date} ${time}` : date;
}

function formatQuantity(value, unit) {
  return `${formatNumber(value)}${unit || ''}`;
}

export function formatNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  return number.toLocaleString('ja-JP', { maximumFractionDigits: 3 });
}

export function formatLongDate(date) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

export function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function getFirstValue(record, keys) {
  for (const key of keys) {
    if (record?.[key]) return record[key];
  }
  return '';
}

function getNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}
