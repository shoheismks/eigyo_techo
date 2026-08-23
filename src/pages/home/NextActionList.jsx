export default function NextActionList({ actions = [], compact = false, onAction }) {
  return (
    <section className={`home-panel next-action-panel ${compact ? 'compact' : ''}`} aria-label="次のアクション">
      <div className="home-section-heading">
        <div>
          <p className="eyebrow">Next action</p>
          <h2>次のアクション</h2>
        </div>
      </div>
      {actions.length > 0 ? (
        <div className="next-action-list">
          {actions.map((action) => (
            <article className={`next-action-card ${action.tone || 'blue'}`} key={action.id}>
              <div className="next-action-time">
                <span>{action.dateLabel || '-'}</span>
                <small>{action.badge}</small>
              </div>
              <div className="next-action-main">
                {action.customerName && <p className="next-action-customer">{action.customerName}</p>}
                <h3>{action.title}</h3>
                {action.description && <p>{action.description}</p>}
                {action.priority && <span className={`priority-chip ${action.tone || 'blue'}`}>{action.priority}</span>}
              </div>
              {action.actions?.length > 0 && (
                <div className="next-action-buttons">
                  {action.actions.map((button) => (
                    button.href ? (
                      <a className="mini-action-button" href={button.href} key={`${action.id}-${button.type}`}>
                        {button.label}
                      </a>
                    ) : (
                      <button
                        className="mini-action-button"
                        key={`${action.id}-${button.type}`}
                        type="button"
                        onClick={() => onAction?.({ ...button, customerId: button.customerId || action.customerId })}
                      >
                        {button.label}
                      </button>
                    )
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state compact-empty">
          <h3>今日の重要アクションはありません</h3>
          <p>予定、タスク、フォロー日、入荷予定が近づくとここに表示されます。</p>
        </div>
      )}
    </section>
  );
}
