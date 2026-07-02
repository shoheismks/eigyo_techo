import { useMemo } from 'react';
import { PIPELINE_STATUSES } from '../../deals/constants.js';

export default function AnalyticsPage({ customers, products, contacts, suppliers, complaints, setActivePage }) {
  const summary = useMemo(() => {
    const statusCounts = PIPELINE_STATUSES.map((status) => ({
      status,
      count: customers.filter((customer) => customer.status === status).length,
    }));
    const highRankCount = customers.filter((customer) => ['S', 'A'].includes(customer.customerRank)).length;
    const complaintOpenCount = complaints.filter((complaint) => complaint.status !== '解決').length;

    return {
      statusCounts,
      highRankCount,
      complaintOpenCount,
    };
  }, [complaints, customers]);

  return (
    <section className="page">
      <div className="page-header">
        <p className="eyebrow">Analytics</p>
        <h1>営業分析</h1>
        <p>PCサイドバーから確認する、営業状況の集約ビューです。</p>
      </div>

      <div className="dashboard-metrics">
        <DashboardMetric label="取引先" value={customers.length} tone="blue" />
        <DashboardMetric label="重要顧客" value={summary.highRankCount} tone="gold" />
        <DashboardMetric label="商品" value={products.length} tone="purple" />
        <DashboardMetric label="担当者" value={contacts.length} tone="blue" />
        <DashboardMetric label="仕入先" value={suppliers.length} tone="orange" />
        <DashboardMetric label="未解決クレーム" value={summary.complaintOpenCount} tone="red" />
      </div>

      <section className="section-block">
        <div className="section-heading">
          <h2>ステータス別件数</h2>
          <button type="button" className="text-button" onClick={() => setActivePage('Pipeline')}>
            案件へ
          </button>
        </div>
        <div className="status-count-grid">
          {summary.statusCounts.map((item) => (
            <div className="status-count-card" key={item.status}>
              <span>{item.count}</span>
              <p>{item.status}</p>
            </div>
          ))}
        </div>
      </section>
    </section>
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
