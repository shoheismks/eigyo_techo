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
  products = [],
  preferOpenAI = true,
}) {
  if (!customer) {
    throw new Error('Customer is required to create mail drafts.');
  }

  const context = buildContext({ customer, productName, purpose, senderName, products });

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

function buildContext({ customer, productName, purpose, senderName, products }) {
  const proposedProducts = (customer.proposedProducts ?? [])
    .map((productId) => products.find((product) => product.id === productId))
    .filter(Boolean);
  const selectedProduct =
    products.find((product) => product.name === productName) ?? proposedProducts[0];
  const product = productName.trim() || selectedProduct?.name || '貴社向け商材';
  const sender = senderName.trim() || '営業担当';
  const latestHistory = [...(customer.dealHistories ?? [])]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  const productDetails = buildProductDetails(selectedProduct, proposedProducts);
  const tagNote = (customer.tags ?? []).length > 0
    ? `営業手帳では「${customer.tags.join('、')}」のタグで管理しています。`
    : '';
  const historyNote = latestHistory?.summary
    ? `直近の接点では「${latestHistory.summary}」という履歴があり、次の一手として「${latestHistory.nextAction || '追加提案'}」が適しています。`
    : '';
  const companyNote = customer.companyNote || customer.memo || customer.pipelineMemo
    ? `社内メモ: ${[customer.companyNote, customer.memo, customer.pipelineMemo].filter(Boolean).join(' / ')}`
    : `${customer.area || '貴社エリア'}で${customer.industry || '事業'}を展開されている点に合わせて、具体的な活用イメージをご提案します。`;
  const nextAction = purpose === 'サンプル提案'
    ? 'まずはサンプルまたは商品資料をご確認いただければ幸いです。'
    : '一度オンラインで15分ほど、情報交換のお時間をいただけますでしょうか。';

  return {
    companyName: customer.companyName,
    industry: customer.industry || '貴社事業',
    area: customer.area || '',
    email: customer.email || '',
    inquiryUrl: customer.inquiryUrl || '',
    memo: customer.memo || customer.pipelineMemo || '',
    tags: customer.tags ?? [],
    dealHistories: customer.dealHistories ?? [],
    proposedProducts,
    product,
    purpose,
    sender,
    companyNote: [companyNote, tagNote, historyNote, productDetails].filter(Boolean).join('\n'),
    nextAction,
  };
}

function buildProductDetails(selectedProduct, proposedProducts) {
  const products = selectedProduct ? [selectedProduct] : proposedProducts;
  if (products.length === 0) {
    return '';
  }

  return `提案商品: ${products
    .map((product) => {
      const details = [
        product.name,
        product.manufacturerName ? `メーカー: ${product.manufacturerName}` : '',
        product.origin ? `産地: ${product.origin}` : '',
        product.temperatureZone ? `温度帯: ${product.temperatureZone}` : '',
        product.packageStyle ? `荷姿: ${product.packageStyle}` : '',
        product.desiredSellingPrice !== ''
          ? `希望販売価格: ${Number(product.desiredSellingPrice).toLocaleString('ja-JP')}円/${product.sellingPriceUnit}`
          : '',
      ].filter(Boolean);
      return details.join('、');
    })
    .join(' / ')}`;
}

function toOpenAIInput(context) {
  return {
    companyName: context.companyName,
    industry: context.industry,
    area: context.area,
    email: context.email,
    inquiryUrl: context.inquiryUrl,
    memo: [
      context.memo,
      context.companyNote,
      context.tags.length > 0 ? `タグ: ${context.tags.join('、')}` : '',
      context.dealHistories.length > 0
        ? `商談履歴: ${context.dealHistories.map((history) => `${history.date || '日付未設定'} ${history.type} ${history.summary} 次:${history.nextAction}`).join(' / ')}`
        : '',
    ].filter(Boolean).join('\n'),
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

突然のご連絡失礼いたします。${context.sender}と申します。
本日は「${context.product}」のご提案でご連絡いたしました。

${context.companyNote}

${context.nextAction}
ご興味がございましたら、商品資料またはサンプルのご案内をお送りいたします。
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

--
${context.sender}`;
}

function buildProposalDraft(context) {
  return `${context.companyName}
ご担当者様

突然のご連絡失礼いたします。${context.sender}と申します。
貴社の${context.industry}領域において、新しい提案づくりや差別化にお役立ていただける可能性があると考え、「${context.product}」をご提案いたします。

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
