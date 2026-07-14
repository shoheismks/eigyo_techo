export const PROJECT_PRODUCT_STATUSES = [
  '未提案',
  '提案済',
  'サンプル',
  '評価中',
  '見積',
  '交渉中',
  '採用',
  '不採用',
  '保留',
];

export const PROJECT_PRODUCT_REASON_OPTIONS = [
  '価格',
  '品質',
  '規格',
  '納期',
  '競合',
  '在庫',
  '条件',
  'その他',
];

export const PROJECT_PRODUCT_UNITS = ['kg', 'g', 'パック', '箱', 'ケース', '枚', '本', '袋', '個'];

export function toProposalNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/,/g, '').replace(/%/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateProjectProductProposal(proposal = {}) {
  const monthlyQuantity = toProposalNumber(proposal.monthlyExpectedQuantity);
  const annualQuantity = toProposalNumber(proposal.annualExpectedQuantity) || monthlyQuantity * 12;
  const sellingPrice = toProposalNumber(proposal.expectedSellingPrice);
  const cost = toProposalNumber(proposal.expectedCost);
  const expense = toProposalNumber(proposal.expectedExpense);
  const sales = annualQuantity * sellingPrice;
  const costTotal = annualQuantity * cost;
  const grossProfit = sales - costTotal;
  const operatingProfit = grossProfit - expense;
  const realProfit = operatingProfit;

  return {
    monthlyQuantity,
    annualQuantity,
    sales,
    costTotal,
    grossProfit,
    operatingProfit,
    realProfit,
  };
}

export function emptyProjectProductProposal(productId = '') {
  return normalizeProjectProductProposal({
    id: crypto.randomUUID(),
    productId,
    status: '未提案',
  });
}

export function normalizeProjectProductProposal(proposal = {}) {
  const status = PROJECT_PRODUCT_STATUSES.includes(proposal.status) ? proposal.status : '未提案';
  const reasonCategory = PROJECT_PRODUCT_REASON_OPTIONS.includes(proposal.reasonCategory)
    ? proposal.reasonCategory
    : '';
  const normalized = {
    id: proposal.id ?? crypto.randomUUID(),
    productId: proposal.productId ?? proposal.product_id ?? '',
    status,
    monthlyExpectedQuantity: proposal.monthlyExpectedQuantity ?? proposal.monthly_expected_quantity ?? '',
    annualExpectedQuantity: proposal.annualExpectedQuantity ?? proposal.annual_expected_quantity ?? '',
    unit: proposal.unit ?? 'kg',
    expectedSellingPrice: proposal.expectedSellingPrice ?? proposal.expected_selling_price ?? '',
    expectedCost: proposal.expectedCost ?? proposal.expected_cost ?? '',
    expectedExpense: proposal.expectedExpense ?? proposal.expected_expense ?? '',
    adoptionReason: proposal.adoptionReason ?? proposal.adoption_reason ?? '',
    rejectionReason: proposal.rejectionReason ?? proposal.rejection_reason ?? '',
    reasonCategory,
    competitorProduct: proposal.competitorProduct ?? proposal.competitor_product ?? '',
    memo: proposal.memo ?? '',
    createdAt: proposal.createdAt ?? proposal.created_at ?? new Date().toISOString(),
    updatedAt: proposal.updatedAt ?? proposal.updated_at ?? new Date().toISOString(),
  };
  const totals = calculateProjectProductProposal(normalized);

  return {
    ...normalized,
    expectedGrossProfit: totals.grossProfit,
    expectedOperatingProfit: totals.operatingProfit,
    expectedRealProfit: totals.realProfit,
  };
}

export function summarizeProjectProductProposals(proposals = []) {
  return proposals.reduce((totals, proposal) => {
    const next = calculateProjectProductProposal(proposal);
    return {
      sales: totals.sales + next.sales,
      cost: totals.cost + next.costTotal,
      grossMargin: totals.grossMargin + next.grossProfit,
      expenseTotal: totals.expenseTotal + toProposalNumber(proposal.expectedExpense),
      operatingProfit: totals.operatingProfit + next.operatingProfit,
      realProfit: totals.realProfit + next.realProfit,
    };
  }, {
    sales: 0,
    cost: 0,
    grossMargin: 0,
    expenseTotal: 0,
    operatingProfit: 0,
    realProfit: 0,
  });
}
