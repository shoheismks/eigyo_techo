function compact(items, fallback) {
  const values = items.filter(Boolean);
  return values.length > 0 ? values : [fallback];
}

function latest(records = [], dateFields = ['date', 'submittedDate', 'shippedDate', 'createdAt']) {
  return [...records].sort((a, b) => {
    const dateA = dateFields.map((field) => a[field]).find(Boolean) || '';
    const dateB = dateFields.map((field) => b[field]).find(Boolean) || '';
    return String(dateB).localeCompare(String(dateA));
  })[0];
}

function productNames(products = []) {
  return products.map((product) => product.name).filter(Boolean);
}

export async function generateMeetingPrep(karte) {
  // OpenAI APIへ差し替える場合は、この関数内で入力整形とAPI呼び出しを行う。
  const { customer, contacts, dealHistories, estimates, samples, complaints, products, adoptions } = karte;
  const latestDeal = latest(dealHistories);
  const latestQuote = latest(estimates, ['submittedDate', 'date', 'createdAt']);
  const latestSample = latest(samples, ['followUpDate', 'shippedDate', 'createdAt']);
  const hasComplaint = complaints.length > 0;
  const proposedProducts = productNames(products);
  const adoptedProducts = adoptions.map((adoption) => adoption.productName).filter(Boolean);

  return {
    features: compact(
      [
        `${customer.companyName} / ${customer.industry || '業種未設定'} / ${customer.area || '地域未設定'}`,
        contacts.length > 0 ? `担当者情報が${contacts.length}件あります。部署・役職を確認して商談相手を絞れます。` : '',
        adoptedProducts.length > 0 ? `採用品: ${adoptedProducts.slice(0, 3).join(', ')}` : '',
      ],
      '会社情報、業種、地域、担当者を補完して商談前情報を厚くしてください。',
    ),
    previousFlow: compact(
      [
        latestDeal ? `直近商談: ${latestDeal.summary || latestDeal.type || '内容未入力'}` : '',
        latestQuote ? `直近見積: ${latestQuote.quoteNumber || latestQuote.title || '見積'} / ${latestQuote.status || '-'}` : '',
        latestSample ? `直近サンプル: ${latestSample.sampleName || latestSample.name || 'サンプル'} / ${latestSample.status || '-'}` : '',
      ],
      '商談履歴・見積履歴・サンプル履歴はまだ少ないため、初回ヒアリング中心で進めてください。',
    ),
    cautions: compact(
      [
        customer.isDoNotContact ? 'NG/配信停止のため、メール作成や送付前に社内確認が必要です。' : '',
        hasComplaint ? 'クレーム履歴があります。対応状況と再発防止策を先に確認してください。' : '',
        latestQuote?.status === '失注' ? `失注理由: ${latestQuote.lostReason || '未入力'}` : '',
      ],
      '大きな注意点は未登録です。価格、納期、温度帯、配送条件を丁寧に確認してください。',
    ),
    needs: compact(
      [
        customer.industry ? `${customer.industry}向けに、安定供給・差別化・粗利を軸にした提案が合いそうです。` : '',
        samples.length > 0 ? 'サンプル後の評価、採用条件、競合品との差を確認するニーズがあります。' : '',
        estimates.length > 0 ? '見積済み条件の再確認、価格改定、数量条件の調整ニーズがあります。' : '',
      ],
      '現時点ではニーズ未確定です。利用シーン、現在の仕入れ先、困りごとから確認してください。',
    ),
    recommendedProducts: compact(
      [
        ...proposedProducts.slice(0, 4),
        adoptedProducts.length > 0 ? `採用品の横展開: ${adoptedProducts[0]}` : '',
      ],
      '提案商品が未登録です。商品マスターから候補を紐づけてください。',
    ),
    questions: [
      '現在の仕入れで困っている点は何ですか。',
      '価格、品質、納期、ロットのうち優先順位が高いものは何ですか。',
      'サンプル評価の判断基準と決裁者は誰ですか。',
      '採用する場合の想定数量と開始時期はいつですか。',
      hasComplaint ? '前回の不満点や再発防止で重視する点は何ですか。' : '競合品と比べて変えたい点はありますか。',
    ],
    nextActions: compact(
      [
        customer.nextFollowUpDate || customer.nextFollowDate ? `次回フォロー日: ${customer.nextFollowUpDate || customer.nextFollowDate}` : '',
        latestSample ? 'サンプルの評価結果を確認し、採用条件または再提案条件を整理する。' : '',
        latestQuote ? '見積条件の有効期限、数量、配送条件を確認する。' : '',
      ],
      '商談後に次回フォロー日、提案商品、見積またはサンプルの次アクションを登録してください。',
    ),
  };
}
