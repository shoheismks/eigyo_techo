import { productDisplayName } from '../../products/hooks/useProducts.js';

function sameCustomer(record, customer) {
  return (
    record.customerId === customer.id ||
    record.ownerId === customer.id ||
    record.metadata?.customerId === customer.id ||
    record.companyName === customer.companyName ||
    record.customerName === customer.companyName ||
    record.metadata?.companyName === customer.companyName
  );
}

function eventDate(record = {}) {
  return record.date || record.sentAt || record.submittedDate || record.adoptedDate || record.followUpDate || record.followDate || record.createdAt || record.updatedAt || '';
}

function byDateDesc(a, b) {
  return String(eventDate(b)).localeCompare(String(eventDate(a)));
}

function hasWord(record, words) {
  const text = [
    record.type,
    record.title,
    record.summary,
    record.nextAction,
    record.memo,
    record.name,
    record.field,
  ]
    .filter(Boolean)
    .join(' ');
  return words.some((word) => text.includes(word));
}

function relatedContactNames(record, contacts) {
  if (Array.isArray(record.contactNames) && record.contactNames.length > 0) {
    return record.contactNames;
  }

  const ids = new Set(record.contactIds ?? [record.contactId].filter(Boolean));
  return contacts.filter((contact) => ids.has(contact.id)).map((contact) => contact.name).filter(Boolean);
}

function actorName(record = {}) {
  return (
    record.createdByName ||
    record.updatedByName ||
    record.createdBy ||
    record.updatedBy ||
    record.userName ||
    record.userId ||
    '-'
  );
}

function isMeaningfulUpdate(record = {}) {
  if (!record.updatedAt || !record.createdAt) return Boolean(record.updatedAt);
  return String(record.updatedAt) !== String(record.createdAt);
}

function hasAttachment(record, attachments) {
  if (record.attachment || record.attachmentUrl || record.file || record.fileUrl) return true;
  if (record.fileName || record.fileUrl) return true;
  if (Array.isArray(record.attachments) && record.attachments.length > 0) return true;
  return attachments.some(
    (attachment) =>
      attachment.ownerId === record.id ||
      attachment.metadata?.dealHistoryId === record.id ||
      attachment.metadata?.complaintId === record.id ||
      attachment.metadata?.sampleId === record.id ||
      attachment.metadata?.quoteId === record.id ||
      attachment.metadata?.sourceRecordId === record.id,
  );
}

function timelineEvent({
  id,
  date,
  type,
  content,
  createdBy = '',
  relatedContacts = [],
  hasAttachment: attached = false,
  source = '',
}) {
  return {
    id,
    date: date || '',
    type,
    content: content || '-',
    createdBy: createdBy || '-',
    relatedContacts,
    hasAttachment: attached,
    source,
  };
}

function buildActivityTimeline({
  customer,
  contacts,
  businessCards,
  dealHistories,
  complaints,
  attachments,
  samples = [],
  quotes = [],
  adoptions = [],
  calendarEvents = [],
}) {
  const events = [];
  const currentStatus = customer.status || '未接触';

  events.push(
    timelineEvent({
      id: `customer-created-${customer.id}`,
      date: customer.createdAt,
      type: '会社登録',
      content: `${customer.companyName}を営業手帳に登録`,
      createdBy: customer.createdByName || customer.createdBy || customer.userId,
      source: 'customer',
    }),
  );

  contacts.forEach((contact) => {
    events.push(
      timelineEvent({
        id: `contact-created-${contact.id}`,
        date: contact.createdAt,
        type: '担当者追加',
        content: `${contact.name || '担当者'} ${contact.department || ''} ${contact.role || ''}`.trim(),
        createdBy: actorName(contact),
        relatedContacts: [contact.name].filter(Boolean),
        source: 'contact',
      }),
    );

    if (isMeaningfulUpdate(contact)) {
      events.push(
        timelineEvent({
          id: `contact-updated-${contact.id}`,
          date: contact.updatedAt,
          type: '担当者変更',
          content: `${contact.name || '担当者'}の情報を更新`,
          createdBy: contact.updatedByName || contact.updatedBy || actorName(contact),
          relatedContacts: [contact.name].filter(Boolean),
          source: 'contact-update',
        }),
      );
    }
  });

  businessCards.forEach((card) => {
    const name = card.extracted?.name || contacts.find((contact) => contact.id === card.contactId)?.name || '名刺';
    events.push(
      timelineEvent({
        id: `business-card-${card.id}`,
        date: card.createdAt,
        type: '名刺登録',
        content: `${name}の名刺を登録`,
        createdBy: actorName(card),
        relatedContacts: [name].filter(Boolean),
        hasAttachment: Boolean(card.imageFile?.url || card.imageFile),
        source: 'business-card',
      }),
    );
  });

  dealHistories.forEach((history) => {
    const typeText = history.type || '商談';
    const eventType = hasWord(history, ['見積', '価格']) ? '見積提出' : hasWord(history, ['サンプル', '試食', '試供']) ? 'サンプル発送' : typeText.includes('メール') ? 'メール送信履歴' : '商談履歴';
    events.push(
      timelineEvent({
        id: `deal-${history.id}`,
        date: history.date || history.createdAt,
        type: eventType,
        content: history.summary || history.nextAction || typeText,
        createdBy: actorName(history),
        relatedContacts: relatedContactNames(history, contacts),
        hasAttachment: hasAttachment(history, attachments),
        source: 'deal-history',
      }),
    );
  });

  samples.forEach((sample) => {
    const productText = Array.isArray(sample.productNames) ? sample.productNames.join(', ') : '';
    events.push(
      timelineEvent({
        id: `sample-${sample.id}`,
        date: sample.shippedDate || sample.createdAt,
        type: 'サンプル発送',
        content: `${sample.sampleName || productText || 'サンプル'} / ${sample.status || '発送前'}`,
        createdBy: actorName(sample),
        relatedContacts: relatedContactNames(sample, contacts),
        hasAttachment: hasAttachment(sample, attachments),
        source: 'sample',
      }),
    );

    if (sample.followUpDate) {
      events.push(
        timelineEvent({
          id: `sample-follow-${sample.id}`,
          date: sample.followUpDate,
          type: 'フォロー予定',
          content: sample.nextAction || `${sample.sampleName || 'サンプル'}の反応確認`,
          createdBy: actorName(sample),
          relatedContacts: relatedContactNames(sample, contacts),
          hasAttachment: hasAttachment(sample, attachments),
          source: 'sample-follow',
        }),
      );
    }
  });

  quotes.forEach((quote) => {
    events.push(
      timelineEvent({
        id: `quote-${quote.id}`,
        date: quote.submittedDate || quote.createdAt,
        type: '見積提出',
        content: `${quote.quoteNumber || '見積'} / ${quote.status || '提出済'} / ${quote.totalAmount || '-'}`,
        createdBy: actorName(quote),
        relatedContacts: relatedContactNames(quote, contacts),
        hasAttachment: hasAttachment(quote, attachments),
        source: 'quote',
      }),
    );
  });

  adoptions.forEach((adoption) => {
    events.push(
      timelineEvent({
        id: `adoption-${adoption.id}`,
        date: adoption.adoptedDate || adoption.createdAt,
        type: '商品採用',
        content: `${adoption.productName || '商品'} / ${adoption.status || '採用中'}`,
        createdBy: actorName(adoption),
        source: 'adoption',
      }),
    );
  });

  calendarEvents.forEach((event) => {
    events.push(
      timelineEvent({
        id: `event-${event.id}`,
        date: event.startAt || event.nextFollowDate || event.createdAt,
        type: `予定: ${event.eventType || 'その他'}`,
        content: `${event.title || event.eventType || '予定'} / ${event.status || '予定'}`,
        createdBy: actorName(event),
        relatedContacts: relatedContactNames(event, contacts),
        source: 'event',
      }),
    );
  });

  (customer.mailHistories ?? customer.emailHistories ?? []).forEach((mail) => {
    events.push(
      timelineEvent({
        id: `mail-${mail.id ?? mail.sentAt ?? mail.createdAt}`,
        date: mail.sentAt || mail.createdAt,
        type: 'メール送信履歴',
        content: mail.subject || mail.summary || 'メール送信',
        createdBy: actorName(mail),
        relatedContacts: relatedContactNames(mail, contacts),
        hasAttachment: hasAttachment(mail, attachments),
        source: 'mail',
      }),
    );
  });

  if (customer.nextFollowUpDate || customer.nextFollowDate) {
    events.push(
      timelineEvent({
        id: `follow-${customer.id}-${customer.nextFollowUpDate || customer.nextFollowDate}`,
        date: customer.nextFollowUpDate || customer.nextFollowDate,
        type: 'フォロー予定',
        content: customer.pipelineMemo || customer.memo || '次回フォロー予定',
        createdBy: actorName(customer),
        source: 'follow',
      }),
    );
  }

  complaints.forEach((complaint) => {
    events.push(
      timelineEvent({
        id: `complaint-${complaint.id}`,
        date: complaint.occurredAt || complaint.createdAt,
        type: 'クレーム記録',
        content: complaint.title || complaint.memo || 'クレーム記録',
        createdBy: actorName(complaint),
        relatedContacts: relatedContactNames(complaint, contacts),
        hasAttachment: hasAttachment(complaint, attachments),
        source: 'complaint',
      }),
    );
  });

  attachments.forEach((attachment) => {
    events.push(
      timelineEvent({
        id: `attachment-${attachment.id}`,
        date: attachment.createdAt,
        type: '添付ファイル追加',
        content: attachment.name || attachment.field || 'ファイル追加',
        createdBy: actorName(attachment),
        relatedContacts: relatedContactNames(attachment, contacts),
        hasAttachment: true,
        source: 'attachment',
      }),
    );
  });

  (customer.statusHistory ?? customer.statusLogs ?? []).forEach((log) => {
    events.push(
      timelineEvent({
        id: `status-${log.id ?? log.createdAt ?? log.date}`,
        date: log.date || log.createdAt,
        type: 'ステータス変更',
        content: `${log.from ? `${log.from} → ` : ''}${log.to || log.status || currentStatus}`,
        createdBy: actorName(log),
        source: 'status',
      }),
    );
  });

  events.push(
    timelineEvent({
      id: `status-current-${customer.id}`,
      date: customer.updatedAt || customer.createdAt,
      type: 'ステータス変更',
      content: `現在のステータス: ${currentStatus}`,
      createdBy: actorName(customer),
      source: 'status-current',
    }),
  );

  return events
    .filter((event) => event.date || event.type === '会社登録')
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function getCustomerKarte({
  customerId,
  customers = [],
  contacts = [],
  businessCards = [],
  products = [],
  complaints = [],
  attachments = [],
  samples: sampleRecords = [],
  quotes: quoteRecords = [],
  adoptions: adoptionRecords = [],
  events: eventRecords = [],
}) {
  const customer = customers.find((item) => item.id === customerId) ?? null;

  if (!customer) {
    return null;
  }

  const customerContacts = contacts.filter((contact) => sameCustomer(contact, customer));
  const contactIds = new Set(customerContacts.map((contact) => contact.id));
  const customerCards = businessCards.filter(
    (card) =>
      sameCustomer(card, customer) ||
      contactIds.has(card.contactId) ||
      card.extracted?.companyName === customer.companyName,
  );
  const dealHistories = [...(customer.dealHistories ?? [])].sort(byDateDesc);
  const customerComplaints = complaints
    .filter((complaint) => sameCustomer(complaint, customer))
    .sort(byDateDesc);
  const proposedProducts = products.filter((product) =>
    (customer.proposedProducts ?? []).includes(product.id),
  );
  const customerAttachments = attachments
    .filter((attachment) => sameCustomer(attachment, customer))
    .sort(byDateDesc);
  const customerSamples = sampleRecords
    .filter((sample) => sample.customerId === customer.id)
    .map((sample) => ({
      ...sample,
      productNames: products
        .filter((product) => (sample.productIds ?? []).includes(product.id))
        .map((product) => productDisplayName(product))
        .filter(Boolean),
    }))
    .sort(byDateDesc);
  const customerQuotes = quoteRecords
    .filter((quote) => quote.customerId === customer.id)
    .map((quote) => ({
      ...quote,
      productNames: products
        .filter((product) => (quote.productIds ?? []).includes(product.id))
        .map((product) => productDisplayName(product))
        .filter(Boolean),
    }))
    .sort(byDateDesc);
  const customerAdoptions = adoptionRecords
    .filter((adoption) => adoption.customerId === customer.id)
    .map((adoption) => ({
      ...adoption,
      productName: productDisplayName(products.find((product) => product.id === adoption.productId), ''),
    }))
    .sort(byDateDesc);
  const customerEvents = eventRecords
    .filter((event) => sameCustomer(event, customer))
    .sort(byDateDesc);
  const estimates = [
    ...customerQuotes,
    ...dealHistories.filter((history) => hasWord(history, ['見積', '価格'])),
    ...customerAttachments.filter((attachment) => hasWord(attachment, ['見積', 'quote', 'estimate'])),
  ].sort(byDateDesc);
  const samples = [
    ...customerSamples,
    ...dealHistories.filter((history) => hasWord(history, ['サンプル', '試食', '試供'])),
    ...customerAttachments.filter((attachment) => hasWord(attachment, ['サンプル', 'sample'])),
  ].sort(byDateDesc);
  const activityTimeline = buildActivityTimeline({
    customer,
    contacts: customerContacts,
    businessCards: customerCards,
    dealHistories,
    complaints: customerComplaints,
    attachments: customerAttachments,
    samples: customerSamples,
    quotes: customerQuotes,
    adoptions: customerAdoptions,
    calendarEvents: customerEvents,
  });

  return {
    customer,
    contacts: customerContacts,
    businessCards: customerCards,
    dealHistories,
    products: proposedProducts,
    adoptions: customerAdoptions,
    complaints: customerComplaints,
    attachments: customerAttachments,
    estimates,
    samples,
    events: customerEvents,
    activityTimeline,
  };
}

export function createDummyKarteAnalysis(karte) {
  if (!karte) {
    return null;
  }

  const { customer, contacts, products, complaints, dealHistories, estimates, samples } = karte;
  const hasComplaint = complaints.length > 0;
  const hotProducts = products.slice(0, 3).map((product) => productDisplayName(product, '')).filter(Boolean);
  const nextFollowDate = customer.nextFollowUpDate || customer.nextFollowDate;

  return {
    features: [
      customer.industry ? `${customer.industry}向けの提案先です。` : '業種情報を補完すると提案精度が上がります。',
      contacts.length > 0 ? `${contacts.length}名の担当者情報があります。` : '担当者情報が未登録です。',
      dealHistories.length > 0 ? '過去の商談履歴を踏まえた再提案ができます。' : '初回接触向けの提案準備が必要です。',
    ],
    recommendedProducts: hotProducts.length > 0 ? hotProducts : ['提案商品を登録すると候補が表示されます。'],
    cautions: [
      customer.isDoNotContact ? 'NG/配信停止のためメール作成は控えてください。' : '連絡可否と送付先を確認してください。',
      hasComplaint ? 'クレーム履歴があります。提案前に対応状況を確認してください。' : 'クレーム履歴はありません。',
      estimates.length > 0 ? '見積履歴があるため価格条件の整合性に注意してください。' : '見積履歴はまだありません。',
    ],
    nextActions: [
      nextFollowDate ? `次回フォロー日: ${nextFollowDate}` : '次回フォロー日を設定してください。',
      customer.email || customer.inquiryUrl ? 'メールまたは問い合わせフォームで接点を作れます。' : '連絡先補完を先に進めてください。',
      samples.length > 0 ? 'サンプル後の反応確認を行ってください。' : '必要に応じてサンプル提案を検討してください。',
    ],
  };
}
