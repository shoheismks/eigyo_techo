export const lineIntegrationDesign = {
  provider: 'LINE Messaging API',
  inboundWebhookPath: '/api/line/webhook',
  futureTables: ['line_conversations', 'line_messages', 'line_accounts'],
  notes: [
    'LINE公式アカウントのWebhookから顧客・担当者に紐づくメッセージを保存する',
    '送信は必ずユーザー操作を起点にし、自動営業送信はしない',
    'LINE userId と営業手帳の contactId/customerId を別テーブルで紐づける',
  ],
};

export function createLineFollowNote({ customer, contacts = [] }) {
  const contactNames = contacts.map((contact) => contact.name).filter(Boolean);

  return [
    `LINE連携先: ${customer?.companyName || '未選択'}`,
    `対象担当者: ${contactNames.length > 0 ? contactNames.join(', ') : '未設定'}`,
    '用途: LINE公式アカウントのWebhookで受信した会話を、顧客・担当者の履歴へ保存する想定です。',
    '注意: 個人LINEへの自動送信や自動巡回は行いません。',
    '次の実装候補: line_accounts / line_conversations / line_messages を追加し、contactId と LINE userId を紐づけます。',
  ].join('\n');
}
