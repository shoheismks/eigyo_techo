import { calculateCompanyScore } from '../modules/customers/services/scoringService.js';
import { buildNotifications } from '../services/notificationService.js';
import { PIPELINE_STATUSES } from '../modules/deals/constants.js';

const ACTIVE_DONE_STATUSES = ['成約', '失注'];

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function addDaysString(baseDate, days) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  const year = nextDate.getFullYear();
  const month = String(nextDate.getMonth() + 1).padStart(2, '0');
  const date = String(nextDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function followDate(customer) {
  return customer.nextFollowUpDate || customer.nextFollowDate || '';
}

function eventDate(event) {
  return String(event.startAt || event.nextFollowDate || event.createdAt || '').slice(0, 10);
}

function withScore(customer) {
  return {
    ...customer,
    ...calculateCompanyScore(customer),
  };
}

export default function Home({
  customers,
  samples = [],
  quotes = [],
  complaints = [],
  events = [],
  setActivePage,
  syncState = 'local',
  syncError = '',
  reloadFromCloud,
  onOpenKarte,
}) {
  const today = todayString();
  const weekEnd = addDaysString(today, 6);
  const scoredCustomers = customers.map(withScore);
  const notifications = buildNotifications({ customers: scoredCustomers, samples, quotes, complaints, events });
  const activeEvents = events.filter((event) => !['完了', '中止'].includes(event.status));
  const todayEvents = activeEvents
    .filter((event) => eventDate(event) === today)
    .sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)))
    .slice(0, 5);
  const weekEvents = activeEvents
    .filter((event) => eventDate(event) > today && eventDate(event) <= weekEnd)
    .sort((a, b) => eventDate(a).localeCompare(eventDate(b)))
    .slice(0, 5);
  const overdueEvents = activeEvents
    .filter((event) => eventDate(event) && eventDate(event) < today)
    .sort((a, b) => eventDate(a).localeCompare(eventDate(b)))
    .slice(0, 5);
  const sRankCount = scoredCustomers.filter((customer) => customer.customerRank === 'S').length;
  const followToday = scoredCustomers.filter(
    (customer) =>
      followDate(customer) &&
      followDate(customer) <= today &&
      !ACTIVE_DONE_STATUSES.includes(customer.status) &&
      !customer.isDoNotContact,
  );
  const followThisWeek = scoredCustomers.filter(
    (customer) =>
      followDate(customer) &&
      followDate(customer) > today &&
      followDate(customer) <= weekEnd &&
      !ACTIVE_DONE_STATUSES.includes(customer.status) &&
      !customer.isDoNotContact,
  );
  const overdueFollows = followToday.filter((customer) => followDate(customer) < today);
  const sampleFollows = samples
    .filter((sample) => sample.followUpDate && sample.followUpDate <= weekEnd && !['採用', '不採用'].includes(sample.status))
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
    .slice(0, 5)
    .map((sample) => ({
      ...sample,
      customerName: customers.find((customer) => customer.id === sample.customerId)?.companyName ?? '-',
    }));
  const topScoredCustomers = [...scoredCustomers]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const statusCounts = PIPELINE_STATUSES.reduce((summary, status) => {
    summary[status] = scoredCustomers.filter((customer) => customer.status === status).length;
    return summary;
  }, {});

  return (
    <main className="page">
      <section className="hero-panel dashboard-hero">
        <div>
          <p className="eyebrow">Today dashboard</p>
          <h1>営業手帳</h1>
          <p className="hero-copy">
            今日フォローすべき案件と、優先度の高い営業先を朝すぐ確認できます。
          </p>
        </div>
        <button className="hero-action" onClick={() => setActivePage('Pipeline')}>
          Pipelineへ
        </button>
      </section>

      <section className="dashboard-metrics" aria-label="今日の営業指標">
        <DashboardMetric label="通知" value={notifications.length} tone={notifications.some((item) => item.tone === 'danger') ? 'red' : 'blue'} />
        <DashboardMetric label="今日の予定" value={todayEvents.length} tone="blue" />
        <DashboardMetric label="期限切れ予定" value={overdueEvents.length} tone={overdueEvents.length > 0 ? 'red' : 'blue'} />
        <DashboardMetric label="Sランク顧客" value={sRankCount} tone="gold" />
        <DashboardMetric label="本日フォロー" value={followToday.length} tone="blue" />
        <DashboardMetric label="今週フォロー" value={followThisWeek.length} tone="blue" />
        <DashboardMetric label="商談中" value={statusCounts['商談中'] ?? 0} tone="orange" />
        <DashboardMetric label="見積提出" value={statusCounts['見積提出'] ?? 0} tone="purple" />
        <DashboardMetric label="成約" value={statusCounts['成約'] ?? 0} tone="gold" />
        <DashboardMetric label="失注" value={statusCounts['失注'] ?? 0} tone="red" />
      </section>

      <section className="section-block notification-section">
        <div className="section-heading">
          <h2>通知</h2>
          <button className="text-button" onClick={() => setActivePage('Calendar')}>
            カレンダーへ
          </button>
        </div>
        {notifications.length > 0 ? (
          <div className="notification-list">
            {notifications.slice(0, 8).map((notification) => (
              <button
                className={`notification-card ${notification.tone}`}
                key={notification.id}
                onClick={() => notification.customerId ? onOpenKarte?.(notification.customerId) : setActivePage('Customers')}
              >
                <span>{notification.type}</span>
                <strong>{notification.customerName}</strong>
                <small>{notification.date}</small>
                <p>{notification.title}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <h3>通知はありません</h3>
            <p>今日対応が必要なフォロー、見積、サンプル、クレームがあるとここに表示されます。</p>
          </div>
        )}
      </section>

      <section className="section-block follow-section">
        <div className="section-heading">
          <h2>今日の予定</h2>
          <button className="text-button" onClick={() => setActivePage('Calendar')}>
            カレンダーへ
          </button>
        </div>
        {todayEvents.length > 0 ? (
          <div className="dashboard-card-list">
            {todayEvents.map((event) => (
              <button
                className="dashboard-row"
                key={event.id}
                onClick={() => event.customerId ? onOpenKarte?.(event.customerId) : setActivePage('Calendar')}
              >
                <span>{event.title || event.eventType}</span>
                <small>{eventDate(event)} / {event.status}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <h3>今日の予定はありません</h3>
            <p>カレンダーで予定を登録すると、ここに表示されます。</p>
          </div>
        )}
      </section>

      <section className="section-block follow-section">
        <div className="section-heading">
          <h2>今週の予定</h2>
          <button className="text-button" onClick={() => setActivePage('Calendar')}>
            一覧を見る
          </button>
        </div>
        {weekEvents.length > 0 ? (
          <div className="dashboard-card-list">
            {weekEvents.map((event) => (
              <button
                className="dashboard-row"
                key={event.id}
                onClick={() => event.customerId ? onOpenKarte?.(event.customerId) : setActivePage('Calendar')}
              >
                <span>{event.title || event.eventType}</span>
                <small>{eventDate(event)} / {event.status}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <h3>今週の追加予定はありません</h3>
            <p>商談・訪問・フォロー予定をカレンダーから登録できます。</p>
          </div>
        )}
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
                <small>{followDate(customer)}</small>
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
          <h2>今週フォローすべき顧客</h2>
          <button className="text-button" onClick={() => setActivePage('Customers')}>
            得意先へ
          </button>
        </div>
        {followThisWeek.length > 0 ? (
          <div className="dashboard-card-list">
            {followThisWeek.slice(0, 5).map((customer) => (
              <button
                className="dashboard-row"
                key={customer.id}
                onClick={() => setActivePage('Customers')}
              >
                <span>{customer.companyName}</span>
                <small>{followDate(customer)}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <h3>今週の追加フォローはありません</h3>
            <p>得意先詳細で次回フォロー日を登録すると、ここに表示されます。</p>
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
                <small>{followDate(customer)}</small>
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
                  <small>{customer.status} / {customer.customerRank}ランク</small>
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

      <section className="section-block follow-section">
        <div className="section-heading">
          <h2>サンプルフォロー予定</h2>
          <button className="text-button" onClick={() => setActivePage('Customers')}>
            顧客カルテへ
          </button>
        </div>
        {sampleFollows.length > 0 ? (
          <div className="dashboard-card-list">
            {sampleFollows.map((sample) => (
              <button
                className={`dashboard-row ${sample.followUpDate <= today ? 'overdue' : ''}`}
                key={sample.id}
                onClick={() => setActivePage('Customers')}
              >
                <span>{sample.customerName} / {sample.sampleName || 'サンプル'}</span>
                <small>{sample.followUpDate} / {sample.status}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <h3>サンプルフォローはありません</h3>
            <p>顧客カルテでサンプルのフォロー日を登録すると、ここに表示されます。</p>
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

      <section className={`sync-status-card ${syncState === 'supabase' ? 'cloud' : 'local'}`}>
        <div>
          <span>保存先</span>
          <strong>{syncState === 'supabase' ? 'Supabase' : syncState === 'syncing' ? '同期中...' : 'LocalStorage'}</strong>
        </div>
        <button className="ghost-button" onClick={reloadFromCloud} disabled={syncState === 'syncing'}>
          クラウドから再読み込み
        </button>
        {syncError && <p>{syncError}</p>}
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
