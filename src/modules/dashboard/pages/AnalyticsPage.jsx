import { useMemo } from 'react';
import { buildManagementDashboard, dashboardFormatters } from '../../../services/dashboardService.js';

export default function AnalyticsPage({
  customers,
  products,
  suppliers,
  complaints,
  quotes = [],
  samples = [],
  inventories = [],
  setActivePage,
}) {
  const dashboard = useMemo(
    () => buildManagementDashboard({ customers, products, suppliers, complaints, quotes, samples, inventories }),
    [complaints, customers, inventories, products, quotes, samples, suppliers],
  );

  return (
    <section className="page">
      <div className="page-header">
        <p className="eyebrow">Management Dashboard</p>
        <h1>経営判断ダッシュボード</h1>
        <p>見積、粗利、在庫、フォロー、クレームを既存データから集計します。</p>
      </div>

      <div className="dashboard-metrics">
        {dashboard.kpis.map((metric) => (
          <DashboardMetric key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />
        ))}
      </div>

      <section className="section-block">
        <div className="section-heading">
          <h2>ステータス別案件数</h2>
          <button type="button" className="text-button" onClick={() => setActivePage('Pipeline')}>
            案件へ
          </button>
        </div>
        <div className="status-count-grid">
          {dashboard.statusCounts.map((item) => (
            <div className="status-count-card" key={item.status}>
              <span>{item.count}</span>
              <p>{item.status}</p>
            </div>
          ))}
        </div>
      </section>

      <DashboardTable
        title="商品別見積額"
        emptyText="見積に紐づく商品データがありません。"
        rows={dashboard.productQuoteAmounts}
        columns={[
          ['productName', '商品'],
          ['quoteCount', '件数'],
          ['quoteAmount', '見積額', dashboardFormatters.money],
          ['grossMarginAmount', '見込粗利', dashboardFormatters.money],
          ['grossMarginRate', '粗利率', dashboardFormatters.percent],
        ]}
      />

      <DashboardTable
        title="顧客別見積額"
        emptyText="顧客別の見積データがありません。"
        rows={dashboard.customerQuoteAmounts}
        columns={[
          ['customerName', '顧客'],
          ['quoteCount', '件数'],
          ['quoteAmount', '見積額', dashboardFormatters.money],
          ['grossMarginAmount', '見込粗利', dashboardFormatters.money],
          ['grossMarginRate', '粗利率', dashboardFormatters.percent],
          ['latestStatus', '最新ステータス'],
        ]}
      />

      <DashboardTable
        title="在庫別引当状況"
        emptyText="在庫データがありません。"
        rows={dashboard.inventoryRows}
        columns={[
          ['productName', '商品'],
          ['supplierName', '仕入先'],
          ['status', '在庫ステータス'],
          ['quantity', '数量'],
          ['lot', 'LOT'],
          ['allocatedQuoteCount', '引当見積'],
          ['allocatedQuoteAmount', '引当額', dashboardFormatters.money],
        ]}
      />

      <section className="section-block">
        <div className="section-heading">
          <h2>経営アラート</h2>
          <button type="button" className="text-button" onClick={() => setActivePage('Customers')}>
            取引先へ
          </button>
        </div>
        <div className="management-alert-grid">
          <AlertList title="期限切れフォロー" rows={dashboard.overdueFollowRows} primaryKey="companyName" secondaryKey="nextFollowDate" />
          <AlertList title="サンプル評価待ち" rows={dashboard.sampleAwaitingRows} primaryKey="sampleName" secondaryKey="customerName" />
          <AlertList title="未解決クレーム" rows={dashboard.openComplaintRows} primaryKey="title" secondaryKey="customerName" />
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

function DashboardTable({ title, emptyText, rows, columns }) {
  return (
    <section className="section-block">
      <div className="section-heading">
        <h2>{title}</h2>
        <span>{rows.length}件</span>
      </div>
      {rows.length === 0 ? (
        <p className="compact-empty">{emptyText}</p>
      ) : (
        <>
          <div className="desktop-table management-desktop-table">
            <div className="desktop-table-head" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
              {columns.map(([, label]) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            {rows.map((row) => (
              <div
                className="desktop-table-row"
                key={row.id || row.productId || row.customerId || row.productName}
                style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
              >
                {columns.map(([key, label, formatter]) => (
                  <span key={`${label}-${key}`}>{formatter ? formatter(row[key]) : row[key] || '-'}</span>
                ))}
              </div>
            ))}
          </div>
          <div className="management-card-list">
            {rows.map((row) => (
              <article className="management-card" key={`card-${row.id || row.productId || row.customerId || row.productName}`}>
                <strong>{row.productName || row.customerName || row.sampleName || row.title || '未設定'}</strong>
                <dl>
                  {columns.slice(1).map(([key, label, formatter]) => (
                    <div key={`${label}-${key}`}>
                      <dt>{label}</dt>
                      <dd>{formatter ? formatter(row[key]) : row[key] || '-'}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function AlertList({ title, rows, primaryKey, secondaryKey }) {
  return (
    <div className="management-alert-list">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p>対象はありません。</p>
      ) : (
        rows.slice(0, 6).map((row) => (
          <div className="management-alert-row" key={row.id}>
            <strong>{row[primaryKey] || '-'}</strong>
            <span>{row[secondaryKey] || row.status || '-'}</span>
          </div>
        ))
      )}
    </div>
  );
}
