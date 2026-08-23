const QUICK_ACTIONS = [
  { type: 'schedule', label: '予定追加', description: 'カレンダーで予定を登録' },
  { type: 'task', label: 'タスク追加', description: 'ToDoを登録' },
  { type: 'customer', label: '顧客カルテ', description: '顧客情報を確認' },
  { type: 'record', label: '商談記録', description: '案件・フォローを記録' },
];

export default function QuickActionPanel({ onAction }) {
  return (
    <section className="home-panel quick-record-panel" aria-label="クイック記録">
      <div className="home-section-heading">
        <div>
          <p className="eyebrow">Quick</p>
          <h2>＋クイック記録</h2>
        </div>
      </div>
      <div className="quick-record-grid">
        {QUICK_ACTIONS.map((action) => (
          <button
            className="quick-record-button"
            key={action.type}
            type="button"
            onClick={() => onAction?.(action)}
          >
            <strong>{action.label}</strong>
            <span>{action.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
