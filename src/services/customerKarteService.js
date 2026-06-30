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

function byDateDesc(a, b) {
  const dateA = a.date || a.createdAt || a.updatedAt || '';
  const dateB = b.date || b.createdAt || b.updatedAt || '';
  return String(dateB).localeCompare(String(dateA));
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

export function getCustomerKarte({
  customerId,
  customers = [],
  contacts = [],
  businessCards = [],
  products = [],
  complaints = [],
  attachments = [],
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
  const estimates = [
    ...dealHistories.filter((history) => hasWord(history, ['見積', '価格'])),
    ...customerAttachments.filter((attachment) => hasWord(attachment, ['見積', 'quote', 'estimate'])),
  ].sort(byDateDesc);
  const samples = [
    ...dealHistories.filter((history) => hasWord(history, ['サンプル', '試食', '試供'])),
    ...customerAttachments.filter((attachment) => hasWord(attachment, ['サンプル', 'sample'])),
  ].sort(byDateDesc);
  const activityTimeline = [
    ...dealHistories.map((history) => ({ ...history, activityType: '商談' })),
    ...customerComplaints.map((complaint) => ({ ...complaint, activityType: 'クレーム' })),
    ...customerAttachments.map((attachment) => ({ ...attachment, activityType: '添付' })),
  ].sort(byDateDesc);

  return {
    customer,
    contacts: customerContacts,
    businessCards: customerCards,
    dealHistories,
    products: proposedProducts,
    complaints: customerComplaints,
    attachments: customerAttachments,
    estimates,
    samples,
    activityTimeline,
  };
}

export function createDummyKarteAnalysis(karte) {
  if (!karte) {
    return null;
  }

  const { customer, contacts, products, complaints, dealHistories, estimates, samples } = karte;
  const hasComplaint = complaints.length > 0;
  const hotProducts = products.slice(0, 3).map((product) => product.name).filter(Boolean);
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
