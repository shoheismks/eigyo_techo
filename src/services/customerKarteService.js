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

  const customerContacts = contacts.filter(
    (contact) => contact.customerId === customerId || contact.companyName === customer.companyName,
  );
  const contactIds = new Set(customerContacts.map((contact) => contact.id));
  const customerCards = businessCards.filter(
    (card) =>
      card.customerId === customerId ||
      contactIds.has(card.contactId) ||
      card.extracted?.companyName === customer.companyName,
  );
  const customerComplaints = complaints.filter(
    (complaint) => complaint.customerId === customerId || complaint.customerName === customer.companyName,
  );
  const proposedProducts = products.filter((product) =>
    (customer.proposedProducts ?? []).includes(product.id),
  );
  const customerAttachments = attachments.filter(
    (attachment) =>
      attachment.ownerId === customerId ||
      attachment.metadata?.customerId === customerId ||
      attachment.metadata?.companyName === customer.companyName,
  );

  return {
    customer,
    contacts: customerContacts,
    businessCards: customerCards,
    dealHistories: customer.dealHistories ?? [],
    products: proposedProducts,
    complaints: customerComplaints,
    attachments: customerAttachments,
  };
}

export function createDummyKarteAnalysis(karte) {
  if (!karte) {
    return null;
  }

  const { customer, contacts, products, complaints, dealHistories } = karte;
  const hasComplaint = complaints.length > 0;
  const hotProducts = products.slice(0, 3).map((product) => product.name).filter(Boolean);

  return {
    features: [
      customer.industry ? `${customer.industry}業界の顧客です。` : '業種情報を補完すると提案精度が上がります。',
      contacts.length > 0 ? `${contacts.length}名の担当者情報があります。` : '担当者情報が未登録です。',
      dealHistories.length > 0 ? '商談履歴が残っているため、過去経緯を踏まえて提案できます。' : '初回接触向けの準備が必要です。',
    ],
    recommendedProducts: hotProducts.length > 0 ? hotProducts : ['提案商品を登録してください。'],
    cautions: [
      customer.isDoNotContact ? 'NG/配信停止のためメール作成は控えてください。' : '連絡可否を確認してください。',
      hasComplaint ? 'クレーム履歴があります。提案前に対応状況を確認してください。' : 'クレーム履歴はありません。',
    ],
    nextActions: [
      customer.nextFollowUpDate || customer.nextFollowDate
        ? `次回フォロー日: ${customer.nextFollowUpDate || customer.nextFollowDate}`
        : '次回フォロー日を登録してください。',
      customer.email || customer.inquiryUrl ? 'メールまたは問い合わせフォームで接点を作れます。' : '連絡先補完を先に進めてください。',
    ],
  };
}
