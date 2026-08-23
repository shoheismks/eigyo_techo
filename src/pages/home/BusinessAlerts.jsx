export default function BusinessAlerts({ alerts = [], onAction }) {
  return (
    <section className="home-panel business-alert-panel" aria-label="業務アラート">
      <div className="home-section-heading">
        <div>
          <p className="eyebrow">Alerts</p>
          <h2>業務アラート</h2>
        </div>
      </div>
      <div className="business-alert-grid">
        {alerts.map((alert) => (
          <button
            className={`business-alert-card ${alert.tone || 'blue'}`}
            key={alert.id}
            type="button"
            onClick={() => onAction?.({ type: alert.action })}
          >
            <span>{alert.label}</span>
            <strong>{alert.value}</strong>
            <p>{alert.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
