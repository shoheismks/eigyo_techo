import { generateMeetingPrep } from './meetingPrepService.js';

function compactLines(lines) {
  return lines.filter(Boolean).join('\n');
}

function latest(records = [], dateFields = ['date', 'submittedDate', 'followUpDate', 'createdAt']) {
  return [...records].sort((a, b) => {
    const dateA = dateFields.map((field) => a[field]).find(Boolean) || '';
    const dateB = dateFields.map((field) => b[field]).find(Boolean) || '';
    return String(dateB).localeCompare(String(dateA));
  })[0];
}

function productSummary(product) {
  if (!product) return '';
  return [
    product.name,
    product.category,
    product.manufacturerName,
    product.origin,
    product.temperatureZone,
  ].filter(Boolean).join(' / ');
}

export async function generateAiMeetingPrep(karte) {
  return generateMeetingPrep(karte);
}

export async function generateSalesAssistantNote(karte) {
  const { customer, dealHistories = [], estimates = [], samples = [], complaints = [] } = karte;
  const latestDeal = latest(dealHistories);
  const latestQuote = latest(estimates);
  const latestSample = latest(samples);
  const hasComplaint = complaints.length > 0;

  return compactLines([
    `顧客: ${customer.companyName}`,
    `状況: ${customer.status || '未設定'} / Rank ${customer.customerRank || customer.rank || 'D'} / Score ${customer.score ?? 0}`,
    latestDeal ? `直近商談: ${latestDeal.summary || latestDeal.type || '-'}` : '直近商談: 未登録',
    latestQuote ? `見積: ${latestQuote.quoteNumber || '番号未設定'} / ${latestQuote.status || '-'} / 期限 ${latestQuote.validUntil || '-'}` : '見積: 未登録',
    latestSample ? `サンプル: ${latestSample.sampleName || '-'} / ${latestSample.status || '-'} / フォロー ${latestSample.followUpDate || '-'}` : 'サンプル: 未登録',
    hasComplaint ? '注意: クレーム履歴があります。商談前に対応状況を確認してください。' : '注意: 大きなクレーム履歴は未登録です。',
    customer.nextFollowUpDate || customer.nextFollowDate
      ? `次アクション: ${customer.nextFollowUpDate || customer.nextFollowDate} のフォロー内容を確認`
      : '次アクション: 次回フォロー日を設定',
  ]);
}

export async function generateProductProposalNote(karte) {
  const { customer, products = [], adoptions = [], samples = [], estimates = [] } = karte;
  const proposedProducts = products.slice(0, 5).map(productSummary).filter(Boolean);
  const adoptedProducts = adoptions.map((adoption) => adoption.productName).filter(Boolean);
  const sampleProducts = samples.flatMap((sample) => sample.productNames ?? []).filter(Boolean);
  const quoteProducts = estimates.flatMap((quote) => quote.productNames ?? []).filter(Boolean);
  const productLines = [...new Set([...proposedProducts, ...adoptedProducts, ...sampleProducts, ...quoteProducts])].slice(0, 6);

  return compactLines([
    `提案先: ${customer.companyName}`,
    customer.industry ? `業種に合わせた切り口: ${customer.industry}向けに、品質・安定供給・差別化を軸に提案` : '切り口: 業種情報を補完すると提案精度が上がります。',
    productLines.length > 0 ? `候補商品:\n- ${productLines.join('\n- ')}` : '候補商品: 商品マスターまたは提案商品を登録してください。',
    samples.length > 0 ? '進め方: サンプル評価の結果を確認し、採用条件または再提案条件を整理' : '進め方: まず少量サンプルまたは資料提案から開始',
    estimates.length > 0 ? '価格: 既存見積の有効期限・粗利率・数量条件を確認' : '価格: 希望販売価格と粗利率を確認して見積準備',
  ]);
}

export async function generateMailSupportNote({ customer, productName, purpose }) {
  return compactLines([
    `宛先: ${customer?.companyName || '未選択'}`,
    `目的: ${purpose || '未設定'}`,
    `商材: ${productName || '未設定'}`,
    '方針: 相手企業に合わせた一言、具体的な提案、次の商談またはサンプル提案を入れてください。',
    customer?.isDoNotContact ? '注意: NG/配信停止のため送信前に必ず確認してください。' : '',
  ]);
}
