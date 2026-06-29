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
