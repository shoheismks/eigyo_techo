export function calculateCompanyScore(company) {
  const reasons = [];
  let score = 0;

  if (company.email) {
    score += 30;
    reasons.push('メールあり +30');
  }

  if (company.inquiryUrl) {
    score += 20;
    reasons.push('問い合わせURLあり +20');
  }

  if (company.website) {
    score += 10;
    reasons.push('HPあり +10');
  }

  if ((company.tags ?? []).length > 0) {
    score += 10;
    reasons.push('タグあり +10');
  }

  if ((company.dealHistories ?? []).length > 0) {
    score += 20;
    reasons.push('商談履歴あり +20');
  }

  if (company.status === '未接触') {
    score += 10;
    reasons.push('未接触 +10');
  }

  const customerRank = toCustomerRank(score);

  return {
    score,
    rank: customerRank,
    customerRank,
    scoreReasons: reasons.length > 0 ? reasons : ['加点条件なし'],
  };
}

function toCustomerRank(score) {
  if (score >= 80) return 'S';
  if (score >= 60) return 'A';
  if (score >= 40) return 'B';
  if (score >= 20) return 'C';
  return 'D';
}
