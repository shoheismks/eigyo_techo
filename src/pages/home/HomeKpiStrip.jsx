export default function HomeKpiStrip({ kpis = [], onAction }) {
  return (
    <section className="home-panel home-kpi-panel" aria-label="営業KPI">
      <div className="home-section-heading">
        <div>
          <p className="eyebrow">Sales KPI</p>
          <h2>営業状況</h2>
        </div>
      </div>
      <div className="home-kpi-strip">
        {kpis.map((kpi) => (
          <button
            className={`home-kpi-card ${kpi.tone || 'blue'}`}
            key={kpi.id}
            type="button"
            onClick={() => onAction?.({ type: kpi.action })}
          >
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            {kpi.note && <small>{kpi.note}</small>}
          </button>
        ))}
      </div>
    </section>
  );
}
