export default function CustomerProgressSummary({ progress, onNavigate }) {
  const items = [
    { key: 'projects', label: '案件', tab: 'projects' },
    { key: 'quotes', label: '見積', tab: 'quotes' },
    { key: 'samples', label: 'サンプル', tab: 'samples' },
    { key: 'tasks', label: '未完了タスク', tab: 'calendar' },
    { key: 'events', label: '次回予定', tab: 'calendar' },
  ];

  return (
    <section className="customer-briefing-panel customer-progress-summary" aria-label="進行中">
      <div className="customer-briefing-panel-header">
        <div>
          <p className="eyebrow">Progress</p>
          <h3>進行中</h3>
        </div>
      </div>
      <div className="customer-progress-grid">
        {items.map((item) => (
          <button type="button" className="customer-progress-item" key={item.key} onClick={() => onNavigate?.(item.tab)}>
            <span>{item.label}</span>
            <strong>{progress?.[item.key] ?? 0}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
