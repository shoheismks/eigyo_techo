const ROLE_SCORES = [
  { keywords: ['社長', '代表', 'CEO', 'オーナー'], score: 50, reason: '決裁者に近い役職' },
  { keywords: ['役員', '取締役', '本部長'], score: 40, reason: '上位役職' },
  { keywords: ['部長', 'マネージャー', '責任者'], score: 30, reason: '部門責任者' },
  { keywords: ['課長', '主任', 'リーダー'], score: 20, reason: '現場リーダー' },
];

const COMPANY_SIZE_SCORES = [
  { keywords: ['大手', '上場', '1000', '500'], score: 35, reason: '会社規模が大きい' },
  { keywords: ['中堅', '300', '100'], score: 25, reason: '中堅規模' },
  { keywords: ['小規模', '個人', '10'], score: 10, reason: '小規模' },
];

export function calculateImportanceScore({ companySize = '', role = '', tags = [] } = {}) {
  const reasons = [];
  let score = 0;

  const roleMatch = ROLE_SCORES.find((item) =>
    item.keywords.some((keyword) => role.includes(keyword)),
  );
  if (roleMatch) {
    score += roleMatch.score;
    reasons.push(roleMatch.reason);
  }

  const sizeText = String(companySize);
  const sizeMatch = COMPANY_SIZE_SCORES.find((item) =>
    item.keywords.some((keyword) => sizeText.includes(keyword)),
  );
  if (sizeMatch) {
    score += sizeMatch.score;
    reasons.push(sizeMatch.reason);
  }

  if (tags.length > 0) {
    score += 10;
    reasons.push('タグあり');
  }

  const cappedScore = Math.max(0, Math.min(100, score));

  return {
    importanceScore: cappedScore,
    importanceReasons: reasons,
    importanceRank: cappedScore >= 80 ? 'S' : cappedScore >= 60 ? 'A' : cappedScore >= 40 ? 'B' : cappedScore >= 20 ? 'C' : 'D',
  };
}
