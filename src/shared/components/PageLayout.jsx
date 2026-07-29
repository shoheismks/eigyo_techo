export default function PageLayout({ eyebrow, title, description, kpis, actionBar, children, className = '' }) {
  return (
    <main className={`page-layout ${className}`.trim()}>
      <section className="page-header">
        {eyebrow && <span>{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </section>
      {kpis}
      {actionBar}
      {children}
    </main>
  );
}
