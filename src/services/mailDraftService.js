import { generateSalesMailDrafts, hasOpenAIConfig } from './openaiService.js';

export const SALES_PURPOSES = [
  '新規営業',
  'サンプル提案',
  '展示会フォロー',
  '再提案',
  '価格案内',
  '未返信フォロー',
];

export async function createMailDrafts({
  customer,
  productName,
  purpose,
  senderName = '',
  preferOpenAI = true,
}) {
  if (!customer) {
    throw new Error('Customer is required to create mail drafts.');
  }

  const context = buildContext({ customer, productName, purpose, senderName });

  if (preferOpenAI && hasOpenAIConfig()) {
    try {
      const drafts = await generateSalesMailDrafts(toOpenAIInput(context));
      return {
        drafts,
        source: 'OpenAI API',
        fallbackReason: '',
      };
    } catch {
      return {
        drafts: buildTemplateDrafts(context),
        source: 'テンプレート',
        fallbackReason: 'AI生成に失敗したためテンプレートで作成しました',
      };
    }
  }

  await wait(250);

  return {
    drafts: buildTemplateDrafts(context),
    source: 'テンプレート',
    fallbackReason: hasOpenAIConfig()
      ? ''
      : 'OpenAI APIキーが未設定のためテンプレートで作成しました',
  };
}

function buildContext({ customer, productName, purpose, senderName }) {
  const product = productName.trim() || '貴社の営業活動を支援するサービス';
  const sender = senderName.trim() || '営業担当';
  const companyNote = customer.memo
    ? `営業手帳のメモに「${customer.memo}」とあり、今回のご案内が検討材料になるのではないかと考えております。`
    : `${customer.area || '貴社エリア'}で${customer.industry || '事業'}を展開されている貴社に合わせて、具体的な活用イメージをご提案できると考えております。`;
  const nextAction = purpose === 'サンプル提案'
    ? 'まずはサンプル資料またはデモをご確認いただけますと幸いです。'
    : '一度オンラインで15分ほど、情報交換のお時間をいただけますでしょうか。';

  return {
    companyName: customer.companyName,
    industry: customer.industry || '貴社事業',
    area: customer.area || '',
    email: customer.email || '',
    inquiryUrl: customer.inquiryUrl || '',
    memo: customer.memo || customer.pipelineMemo || '',
    product,
    purpose,
    sender,
    companyNote,
    nextAction,
  };
}

function toOpenAIInput(context) {
  return {
    companyName: context.companyName,
    industry: context.industry,
    area: context.area,
    email: context.email,
    inquiryUrl: context.inquiryUrl,
    memo: context.memo,
    productName: context.product,
    purpose: context.purpose,
    senderName: context.sender,
  };
}

function buildTemplateDrafts(context) {
  return [
    {
      id: 'polite',
      title: '丁寧版',
      subject: `${context.product}に関するご提案`,
      body: buildPoliteDraft(context),
    },
    {
      id: 'short',
      title: '簡潔版',
      subject: `${context.product}のご案内`,
      body: buildShortDraft(context),
    },
    {
      id: 'proposal',
      title: '提案型',
      subject: `${context.companyName}様向けのご提案`,
      body: buildProposalDraft(context),
    },
  ];
}

function buildPoliteDraft(context) {
  return `${context.companyName}
ご担当者様

突然のご連絡失礼いたします。
${context.sender}と申します。

本日は「${context.product}」のご提案でご連絡いたしました。
${context.companyNote}

${context.nextAction}
ご興味がございましたら、候補日をいくつかお送りいただけますと幸いです。

ご多忙のところ恐れ入りますが、ご検討のほどよろしくお願いいたします。

--
${context.sender}`;
}

function buildShortDraft(context) {
  return `${context.companyName}
ご担当者様

お世話になります。${context.sender}です。
${context.purpose}の件で、「${context.product}」をご案内したくご連絡しました。

${context.companyNote}

${context.nextAction}
ご都合のよい日程を2、3候補いただけますでしょうか。

よろしくお願いいたします。

--
${context.sender}`;
}

function buildProposalDraft(context) {
  return `${context.companyName}
ご担当者様

突然のご連絡失礼いたします。
${context.sender}と申します。

貴社の${context.industry}領域において、業務効率化や新しい顧客接点づくりにお役立ていただける可能性があると考え、「${context.product}」をご提案いたします。

${context.companyNote}

まずは貴社の状況に合わせた活用例と導入イメージをご説明できればと思います。
${context.nextAction}

ご確認のうえ、ご返信またはお問い合わせフォームよりご連絡いただけますと幸いです。

--
${context.sender}`;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
