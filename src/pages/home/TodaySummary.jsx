export default function TodaySummary({ cards = [], onAction }) {
  return (
    <section className="home-panel today-summary-panel" aria-label="今日の業務サマリー">
      <div className="home-section-heading">
        <div>
          <p className="eyebrow">Today</p>
          <h2>今日やること</h2>
        </div>
      </div>
      <div className="today-summary-grid">
        {cards.map((card) => (
          <button
            className={`today-summary-card ${card.tone || 'blue'}`}
            key={card.id}
            type="button"
            onClick={() => onAction?.({ type: card.action })}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
