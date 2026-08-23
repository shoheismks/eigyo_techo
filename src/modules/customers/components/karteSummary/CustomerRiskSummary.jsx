export default function CustomerRiskSummary({ risks = [], onNavigate }) {
  return (
    <section className="customer-briefing-panel customer-risk-summary" aria-label="注意事項">
      <div className="customer-briefing-panel-header">
        <div>
          <p className="eyebrow">Risks</p>
          <h3>注意</h3>
        </div>
        <span className={`info-badge ${risks.length > 0 ? 'failed' : 'ready'}`}>{risks.length}件</span>
      </div>
      <div className="customer-risk-list">
        {risks.length > 0 ? risks.map((risk) => (
          <button
            type="button"
            className={`customer-risk-item ${risk.tone || ''}`}
            key={risk.id}
            onClick={() => {
              if (risk.id === 'tasks') onNavigate?.('calendar');
              else if (risk.id === 'quotes') onNavigate?.('quotes');
              else if (risk.id === 'samples') onNavigate?.('samples');
              else onNavigate?.('activity');
            }}
          >
            <span>{risk.label}</span>
            <strong>{risk.count}</strong>
          </button>
        )) : (
          <p className="inline-helper">現時点の注意事項はありません。</p>
        )}
      </div>
    </section>
  );
}
