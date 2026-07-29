export default function KpiCards({ cards = [] }) {
  if (!cards.length) return null;

  function handleClick(card) {
    if (card.onClick) {
      card.onClick();
      return;
    }
    if (card.targetId) {
      document.getElementById(card.targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <section className="kpi-card-row" aria-label="KPI">
      {cards.map((card) => (
        <button
          type="button"
          key={card.id || card.label}
          className={`kpi-card ${card.tone ? `tone-${card.tone}` : ''}`.trim()}
          onClick={() => handleClick(card)}
          disabled={!card.onClick && !card.targetId}
        >
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          {card.helper && <small>{card.helper}</small>}
        </button>
      ))}
    </section>
  );
}
