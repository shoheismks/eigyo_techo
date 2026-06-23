import { calculateCompanyScore } from '../services/scoringService.js';

const ACTIVE_DONE_STATUSES = ['成約', '失注'];
const PIPELINE_STATUSES = [
  '未接触',
  '送信済',
  '返信あり',
  '商談中',
  '見積提出',
  '成約',
  '失注',
];

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function withScore(customer) {
  if (typeof customer.score === 'number' && customer.rank && customer.scoreReasons) {
    return customer;
  }

  return {
    ...customer,
    ...calculateCompanyScore(customer),
  };
}

export default function Home({ customers, setActivePage }) {
  const today = todayString();
  const scoredCustomers = customers.map(withScore);
  const followToday = scoredCustomers.filter(
    (customer) =>
      customer.nextFollowDate &&
      customer.nextFollowDate <= today &&
      !ACTIVE_DONE_STATUSES.includes(customer.status),
  );
  const overdueFollows = followToday.filter((customer) => customer.nextFollowDate < today);
  const topScoredCustomers = [...scoredCustomers]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const statusCounts = PIPELINE_STATUSES.reduce((summary, status) => {
    summary[status] = scoredCustomers.filter((customer) => customer.status === status).length;
    return summary;
  }, {});

  const meetingCount = statusCounts['商談中'] ?? 0;
  const estimateCount = statusCounts['見積提出'] ?? 0;
  const wonCount = statusCounts['成約'] ?? 0;
  const lostCount = statusCounts['失注'] ?? 0;

  return (
    <main className="page">
      <section className="hero-panel dashboard-hero">
        <div>
          <p className="eyebrow">Today dashboard</p>
          <h1>営業手帳</h1>
          <p className="hero-copy">
            今日フォローすべき案件と、優先度の高い営業先をすぐ確認できます。
          </p>
        </div>
        <button className="hero-action" onClick={() => setActivePage('Pipeline')}>
          Pipelineへ
        </button>
      </section>

      <section className="dashboard-metrics" aria-label="今日の営業指標">
        <DashboardMetric label="本日フォロー" value={followToday.length} tone="blue" />
        <DashboardMetric label="商談中" value={meetingCount} tone="orange" />
        <DashboardMetric label="見積提出" value={estimateCount} tone="purple" />
        <DashboardMetric label="成約" value={wonCount} tone="gold" />
        <DashboardMetric label="失注" value={lostCount} tone="red" />
      </section>

      <section className="section-block follow-section">
        <div className="section-heading">
          <h2>今日フォローすべき案件</h2>
          <button className="text-button" onClick={() => setActivePage('Pipeline')}>
            案件へ
          </button>
        </div>
        {followToday.length > 0 ? (
          <div className="dashboard-card-list">
            {followToday.slice(0, 5).map((customer) => (
              <button
                className="dashboard-row"
                key={customer.id}
                onClick={() => setActivePage('Pipeline')}
              >
                <span>{customer.companyName}</span>
                <small>{customer.nextFollowDate}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>本日のフォローはありません</h3>
            <p>案件管理で次回フォロー日を登録すると、ここに表示されます。</p>
          </div>
        )}
      </section>

      <section className="section-block follow-section">
        <div className="section-heading">
          <h2>期限切れフォロー案件</h2>
          <button className="text-button" onClick={() => setActivePage('Pipeline')}>
            確認
          </button>
        </div>
        {overdueFollows.length > 0 ? (
          <div className="dashboard-card-list">
            {overdueFollows.slice(0, 5).map((customer) => (
              <button
                className="dashboard-row overdue"
                key={customer.id}
                onClick={() => setActivePage('Pipeline')}
              >
                <span>{customer.companyName}</span>
                <small>{customer.nextFollowDate}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <h3>期限切れはありません</h3>
            <p>今日以前の未完了フォローがあると表示されます。</p>
          </div>
        )}
      </section>

      <section className="section-block follow-section">
        <div className="section-heading">
          <h2>高スコア営業先TOP5</h2>
          <button className="text-button" onClick={() => setActivePage('Customers')}>
            得意先へ
          </button>
        </div>
        {topScoredCustomers.length > 0 ? (
          <div className="top-score-list">
            {topScoredCustomers.map((customer, index) => (
              <button
                className="top-score-card"
                key={customer.id}
                onClick={() => setActivePage('Customers')}
              >
                <span className="top-score-index">{index + 1}</span>
                <span className="top-score-main">
                  <strong>{customer.companyName}</strong>
                  <small>{customer.status}</small>
                </span>
                <span className="top-score-value">{customer.score}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>まだ営業先がありません</h3>
            <p>検索画面で候補を追加すると、スコア順に表示されます。</p>
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>ステータス別件数</h2>
          <button className="text-button" onClick={() => setActivePage('Pipeline')}>
            Pipeline
          </button>
        </div>
        <div className="status-count-grid">
          {PIPELINE_STATUSES.map((status) => (
            <div className="status-count-card" key={status}>
              <span>{statusCounts[status] ?? 0}</span>
              <p>{status}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function DashboardMetric({ label, value, tone }) {
  return (
    <div className={`dashboard-metric ${tone}`}>
      <span>{value}</span>
      <p>{label}</p>
    </div>
  );
}
