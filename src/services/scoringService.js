const FOOD_KEYWORDS = ['食品', '飲食', '食材', 'レストラン', 'カフェ', '精肉', '惣菜'];
const MEMO_KEYWORDS = ['高級', '輸入', '差別化', '肉', 'チーズ', 'ベーコン', '和牛'];

const STATUS_SCORES = {
  返信あり: 20,
  商談中: 30,
  見積提出: 40,
  成約: 50,
  失注: -50,
};

export function calculateCompanyScore(company) {
  const reasons = [];
  let score = 0;

  if (company.email) {
    score += 30;
    reasons.push('メールあり +30');
  }

  if (company.inquiryUrl) {
    score += 20;
    reasons.push('問い合わせフォームあり +20');
  }

  if (company.website) {
    score += 10;
    reasons.push('HPあり +10');
  }

  if (company.phone) {
    score += 10;
    reasons.push('電話番号あり +10');
  }

  if (containsAny(company.industry, FOOD_KEYWORDS)) {
    score += 20;
    reasons.push('食品関連業種 +20');
  }

  const memoText = [company.memo, company.pipelineMemo, company.companyNote]
    .filter(Boolean)
    .join(' ');
  const matchedMemoKeyword = MEMO_KEYWORDS.find((keyword) => memoText.includes(keyword));
  if (matchedMemoKeyword) {
    score += 10;
    reasons.push(`注目キーワード「${matchedMemoKeyword}」+10`);
  }

  const statusScore = STATUS_SCORES[company.status] ?? 0;
  if (statusScore !== 0) {
    score += statusScore;
    reasons.push(`ステータス「${company.status}」${formatScore(statusScore)}`);
  }

  return {
    score,
    rank: toRank(score),
    scoreReasons: reasons.length > 0 ? reasons : ['加点条件なし'],
  };
}

function containsAny(value = '', keywords) {
  return keywords.some((keyword) => value.includes(keyword));
}

function formatScore(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function toRank(score) {
  if (score >= 90) return '★★★★★';
  if (score >= 70) return '★★★★☆';
  if (score >= 50) return '★★★☆☆';
  if (score >= 30) return '★★☆☆☆';
  return '★☆☆☆☆';
}
