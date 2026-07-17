export const TERMS_FIELDS = [
  { key: 'tradeTerms', label: '取引約款', issuerKey: 'defaultTradeTerms' },
  { key: 'disclaimer', label: '免責事項', issuerKey: 'defaultDisclaimer' },
  { key: 'returnPolicy', label: '返品・交換条件', issuerKey: 'defaultReturnPolicy' },
  { key: 'cancellationPolicy', label: 'キャンセル条件', issuerKey: 'defaultCancellationPolicy' },
  { key: 'qualityGuarantee', label: '品質・規格に関する条件', issuerKey: 'defaultQualityGuarantee' },
  { key: 'storageTerms', label: '賞味期限・保管条件', issuerKey: 'defaultStorageTerms' },
  { key: 'deliveryDisclaimer', label: '配送遅延・破損に関する条件', issuerKey: 'defaultDeliveryDisclaimer' },
  { key: 'forceMajeure', label: '不可抗力', issuerKey: 'defaultForceMajeure' },
  { key: 'priceRevisionTerms', label: '価格改定条件', issuerKey: 'defaultPriceRevisionTerms' },
  { key: 'confidentialityTerms', label: '秘密保持', issuerKey: 'defaultConfidentialityTerms' },
  { key: 'governingLaw', label: '準拠法・合意管轄', issuerKey: 'defaultGoverningLaw' },
];

export const DEFAULT_ISSUER_TERMS = {
  defaultTradeTerms: '本確認書および個別条件に定める内容を優先し、記載のない事項は発行元と顧客が協議して定めます。',
  defaultDisclaimer: '納品後の保管、取扱い、加工、再冷凍、温度逸脱等に起因する品質劣化については、発行元の責任範囲外とします。',
  defaultReturnPolicy: '返品・交換は納品後の検品期限内に申告され、発行元が認めた場合に限ります。顧客都合による返品は原則不可とします。',
  defaultCancellationPolicy: 'ファーム、取り置き、受注生産品、輸入手配済み商品は、発行元の承諾なくキャンセルできません。',
  defaultQualityGuarantee: '天然物、畜産物等は規格内で重量、色、形状、脂肪量、歩留まりに個体差が生じる場合があります。',
  defaultStorageTerms: '指定温度帯で保管してください。解凍後、開封後、加工後の品質保証範囲は個別条件に従います。',
  defaultDeliveryDisclaimer: '天候、交通、災害、通関、船便遅延、輸入品の入港遅延等により納期が変動する場合があります。',
  defaultForceMajeure: '不可抗力により履行が困難となった場合、双方協議のうえ対応を決定します。',
  defaultPriceRevisionTerms: '為替、原料、市況、物流費等の変動により、価格を改定する場合があります。',
  defaultConfidentialityTerms: '本取引で知り得た相手方の営業上、技術上、価格上の情報を第三者へ開示しないものとします。',
  defaultGoverningLaw: '本取引は日本法に準拠し、紛争が生じた場合は発行元所在地を管轄する裁判所を合意管轄とします。',
};

export function createTermsSnapshotFromIssuer(issuer = {}, existing = {}) {
  const terms = TERMS_FIELDS.reduce((snapshot, field) => ({
    ...snapshot,
    [field.key]: existing[field.key] ?? issuer[field.issuerKey] ?? DEFAULT_ISSUER_TERMS[field.issuerKey] ?? '',
  }), {});

  return {
    ...terms,
    createdAt: existing.createdAt ?? new Date().toISOString(),
  };
}

export function normalizeVisibleTerms(visibleTerms = {}) {
  return TERMS_FIELDS.reduce((nextVisible, field) => ({
    ...nextVisible,
    [field.key]: visibleTerms[field.key] !== false,
  }), {});
}

export function termsSummary(termsSnapshot = {}) {
  return [
    termsSnapshot.storageTerms,
    termsSnapshot.returnPolicy,
    termsSnapshot.cancellationPolicy,
    termsSnapshot.deliveryDisclaimer,
  ].filter(Boolean).slice(0, 3);
}
