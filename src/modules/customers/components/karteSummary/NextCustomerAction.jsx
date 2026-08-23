function formatDate(value) {
  if (!value) return '日付未設定';
  return String(value).slice(0, 10);
}

export default function NextCustomerAction({ actions = [], limit = 3, onNavigate }) {
  const visibleActions = actions.slice(0, limit);

  return (
    <section className="customer-briefing-panel customer-briefing-next" aria-label="次にやること">
      <div className="customer-briefing-panel-header">
        <div>
          <p className="eyebrow">Next Action</p>
          <h3>次にやること</h3>
        </div>
        <span className="info-badge">{actions.length}件</span>
      </div>
      <div className="customer-action-list">
        {visibleActions.length > 0 ? visibleActions.map((action) => (
          <article className={`customer-action-item ${action.tone || ''}`} key={action.id}>
            <div className="customer-action-date">
              <span>{formatDate(action.date)}</span>
              <strong>{action.type}</strong>
            </div>
            <div className="customer-action-body">
              <h4>{action.title}</h4>
              {action.detail && <p>{action.detail}</p>}
            </div>
            <div className="customer-action-buttons">
              {action.source?.type === 'task' && (
                <button type="button" className="ghost-button compact-action-button" onClick={() => onNavigate?.('calendar')}>
                  タスク
                </button>
              )}
              {action.source?.type === 'event' && (
                <button type="button" className="ghost-button compact-action-button" onClick={() => onNavigate?.('calendar')}>
                  予定
                </button>
              )}
              {action.source?.type === 'project' && (
                <button type="button" className="ghost-button compact-action-button" onClick={() => onNavigate?.('projects')}>
                  案件
                </button>
              )}
              {action.source?.type === 'quote' && (
                <button type="button" className="ghost-button compact-action-button" onClick={() => onNavigate?.('quotes')}>
                  見積
                </button>
              )}
              {action.source?.type === 'sample' && (
                <button type="button" className="ghost-button compact-action-button" onClick={() => onNavigate?.('samples')}>
                  サンプル
                </button>
              )}
              {action.source?.type === 'complaint' && (
                <button type="button" className="ghost-button compact-action-button" onClick={() => onNavigate?.('activity')}>
                  確認
                </button>
              )}
            </div>
          </article>
        )) : (
          <p className="inline-helper">直近のアクションはありません。</p>
        )}
      </div>
    </section>
  );
}
