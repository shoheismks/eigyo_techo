function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function getCustomerName(customersById, customerId) {
  return customersById.get(customerId)?.companyName || '取引先未設定';
}

function pushNotification(items, notification) {
  if (!notification.date) return;
  items.push({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    customerId: notification.customerId,
    customerName: notification.customerName || '取引先未設定',
    date: String(notification.date).slice(0, 10),
    tone: notification.tone || 'info',
  });
}

export function buildNotifications({ customers = [], samples = [], quotes = [], complaints = [] }) {
  const today = todayKey();
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const items = [];

  customers.forEach((customer) => {
    const followDate = customer.nextFollowUpDate || customer.nextFollowDate;
    const isDone = ['成約', '失注'].includes(customer.status);
    if (!followDate || isDone || customer.isDoNotContact) return;

    if (followDate === today) {
      pushNotification(items, {
        id: `follow-today-${customer.id}`,
        type: '今日のフォロー',
        title: customer.pipelineMemo || customer.memo || '本日フォロー予定です',
        customerId: customer.id,
        customerName: customer.companyName,
        date: followDate,
        tone: 'today',
      });
    }

    if (followDate < today) {
      pushNotification(items, {
        id: `follow-overdue-${customer.id}`,
        type: '期限切れフォロー',
        title: customer.pipelineMemo || customer.memo || 'フォロー期限を過ぎています',
        customerId: customer.id,
        customerName: customer.companyName,
        date: followDate,
        tone: 'danger',
      });
    }
  });

  quotes.forEach((quote) => {
    if (!quote.validUntil || ['採用', '失注'].includes(quote.status)) return;
    if (quote.validUntil < today) {
      pushNotification(items, {
        id: `quote-overdue-${quote.id}`,
        type: '見積期限切れ',
        title: quote.quoteNumber || quote.memo || '見積期限を過ぎています',
        customerId: quote.customerId,
        customerName: getCustomerName(customersById, quote.customerId),
        date: quote.validUntil,
        tone: 'danger',
      });
    }
  });

  samples.forEach((sample) => {
    if (!sample.followUpDate || ['採用', '不採用'].includes(sample.status)) return;
    if (sample.followUpDate <= today) {
      pushNotification(items, {
        id: `sample-reminder-${sample.id}`,
        type: 'サンプル催促日',
        title: sample.nextAction || sample.sampleName || 'サンプル評価を確認してください',
        customerId: sample.customerId,
        customerName: getCustomerName(customersById, sample.customerId),
        date: sample.followUpDate,
        tone: sample.followUpDate < today ? 'danger' : 'today',
      });
    }
  });

  complaints.forEach((complaint) => {
    const dueDate = complaint.responseDueDate || complaint.dueDate || complaint.deadline || complaint.handlingDueDate;
    const isDone = ['完了', '解決'].includes(complaint.status);

    if (dueDate && !isDone && dueDate <= today) {
      pushNotification(items, {
        id: `complaint-due-${complaint.id}`,
        type: 'クレーム対応期限',
        title: complaint.title || complaint.memo || 'クレーム対応期限です',
        customerId: complaint.customerId,
        customerName: getCustomerName(customersById, complaint.customerId),
        date: dueDate,
        tone: dueDate < today ? 'danger' : 'today',
      });
    }

    if (!isDone && !dueDate) {
      pushNotification(items, {
        id: `complaint-task-${complaint.id}`,
        type: '未対応タスク',
        title: complaint.title || complaint.memo || '未対応のクレームがあります',
        customerId: complaint.customerId,
        customerName: getCustomerName(customersById, complaint.customerId),
        date: complaint.updatedAt || complaint.createdAt || today,
        tone: 'warning',
      });
    }
  });

  return items.sort((a, b) => {
    const toneOrder = { danger: 0, today: 1, warning: 2, info: 3 };
    return (toneOrder[a.tone] ?? 9) - (toneOrder[b.tone] ?? 9) || a.date.localeCompare(b.date);
  });
}
