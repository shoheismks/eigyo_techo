const tutorialSteps = [
  {
    title: '1. 顧客登録',
    body: 'まず取引先を登録します。会社名だけでも登録でき、あとから住所、電話、Web、タグを補完できます。',
    actionLabel: '顧客登録へ',
    page: 'LeadSearch',
  },
  {
    title: '2. 担当者登録',
    body: '会社に紐づく担当者を登録します。部署、役職、メール、電話、人物メモを残すと商談準備が楽になります。',
    actionLabel: '担当者へ',
    page: 'Contacts',
  },
  {
    title: '3. 商品登録',
    body: '商品マスターを登録します。カテゴリー、メーカー、産地、温度帯、原価、希望販売価格を入力します。',
    actionLabel: '商品登録へ',
    page: 'Products',
  },
  {
    title: '4. 在庫登録',
    body: '商品詳細から在庫を登録します。数量、単位、LOT、ETA、賞味期限、在庫ステータスを管理できます。',
    actionLabel: '商品へ',
    page: 'Products',
  },
  {
    title: '5. 商談登録',
    body: '案件画面または顧客カルテで商談内容、次回アクション、フォロー日を残します。',
    actionLabel: '案件へ',
    page: 'Pipeline',
  },
  {
    title: '6. 見積作成',
    body: '顧客カルテで商品・在庫・数量・単価を選び、PDFプレビューとダウンロードを行います。',
    actionLabel: '取引先へ',
    page: 'Customers',
  },
];

export default function OnboardingTutorial({
  open,
  stepIndex,
  onNext,
  onBack,
  onSkip,
  onClose,
  onNavigateStep,
}) {
  if (!open) return null;

  const step = tutorialSteps[stepIndex] ?? tutorialSteps[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === tutorialSteps.length - 1;

  return (
    <div className="tutorial-backdrop" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <section className="tutorial-card">
        <div className="tutorial-header">
          <p className="eyebrow">First Guide</p>
          <button type="button" className="text-button compact-button" onClick={onSkip}>
            スキップ
          </button>
        </div>
        <h2 id="tutorial-title">{step.title}</h2>
        <p>{step.body}</p>

        <div className="tutorial-progress" aria-label="チュートリアル進行状況">
          {tutorialSteps.map((item, index) => (
            <span className={index <= stepIndex ? 'active' : ''} key={item.title} />
          ))}
        </div>

        <div className="tutorial-actions">
          <button type="button" className="ghost-button" onClick={onBack} disabled={isFirst}>
            戻る
          </button>
          <button type="button" className="ghost-button" onClick={() => onNavigateStep(step.page)}>
            {step.actionLabel}
          </button>
          <button type="button" className="primary-button" onClick={isLast ? onClose : onNext}>
            {isLast ? '完了' : '次へ'}
          </button>
        </div>
      </section>
    </div>
  );
}
