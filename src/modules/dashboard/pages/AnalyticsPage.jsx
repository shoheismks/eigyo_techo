import { useMemo, useState } from 'react';
import { buildManagementDashboard, dashboardFormatters } from '../../../services/dashboardService.js';

const PERIOD_OPTIONS = [
  { value: 'all', label: '全期間' },
  { value: 'this-year', label: '今年' },
  { value: 'last-12', label: '直近12か月' },
  { value: 'last-6', label: '直近6か月' },
  { value: 'last-3', label: '直近3か月' },
];

const CHART_COLORS = {
  sales: '#60a5fa',
  grossMarginAmount: '#facc15',
  operatingProfit: '#34d399',
  realProfit: '#a78bfa',
  realProfitRate: '#fb7185',
  productCost: '#94a3b8',
  expenseTotal: '#fb923c',
};

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/,/g, '').replace(/%/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function recordDate(record = {}) {
  return String(record.submittedDate || record.issueDate || record.orderDate || record.salesOrderDate || record.createdAt || '').slice(0, 10);
}

function isWithinPeriod(record, period) {
  if (period === 'all') return true;
  const rawDate = recordDate(record);
  if (!rawDate) return true;
  const date = new Date(`${rawDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return true;

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === 'this-year') {
    return date.getFullYear() === now.getFullYear();
  }

  const months = period === 'last-12' ? 12 : period === 'last-6' ? 6 : 3;
  start.setMonth(start.getMonth() - months + 1);
  start.setDate(1);
  return date >= start;
}

function compactMoney(value) {
  const numeric = toNumber(value);
  const abs = Math.abs(numeric);
  if (abs >= 100000000) return `¥${(numeric / 100000000).toFixed(1).replace(/\.0$/, '')}億`;
  if (abs >= 10000) return `¥${(numeric / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  return dashboardFormatters.money(numeric);
}

function percent(value) {
  return dashboardFormatters.percent(value);
}

function maxValue(rows, keys) {
  return Math.max(1, ...rows.flatMap((row) => keys.map((key) => Math.abs(toNumber(row[key])))));
}

function monthLabel(month) {
  if (!month || month === '未設定') return '未設定';
  const [, monthPart] = String(month).split('-');
  return monthPart ? `${Number(monthPart)}月` : month;
}

function stageCount(rows, matcher) {
  return rows.filter((row) => matcher(String(row.status || row.latestStatus || '').toLowerCase())).length;
}

function getRecordProductIds(record = {}) {
  const directIds = Array.isArray(record.productIds) ? record.productIds : [];
  const lineIds = [
    ...(Array.isArray(record.quoteLines) ? record.quoteLines : []),
    ...(Array.isArray(record.lines) ? record.lines : []),
    ...(Array.isArray(record.salesOrderLines) ? record.salesOrderLines : []),
    ...(Array.isArray(record.orderLines) ? record.orderLines : []),
  ].map((line) => line.productId).filter(Boolean);
  return [...new Set([...directIds, ...lineIds].filter(Boolean))];
}

function recordHasProduct(record, productId) {
  return productId === 'all' || getRecordProductIds(record).includes(productId);
}

function recordStaffValues(record = {}) {
  return [
    record.ownerUserId,
    record.ownerName,
    record.salesOwner,
    record.salesPerson,
    record.assignedUserName,
    record.createdByName,
    record.createdBy,
    record.updatedByName,
  ].filter(Boolean).map((value) => String(value));
}

function recordMatchesStaff(record, staffValue) {
  return staffValue === 'all' || recordStaffValues(record).includes(staffValue);
}

export default function AnalyticsPage({
  customers = [],
  products = [],
  suppliers = [],
  complaints = [],
  quotes = [],
  salesOrders = [],
  samples = [],
  inventories = [],
  setActivePage,
}) {
  const [period, setPeriod] = useState('last-12');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');

  const filteredQuotes = useMemo(() => (
    quotes.filter((quote) =>
      isWithinPeriod(quote, period) &&
      (customerFilter === 'all' || quote.customerId === customerFilter) &&
      recordHasProduct(quote, productFilter) &&
      recordMatchesStaff(quote, staffFilter))
  ), [customerFilter, period, productFilter, quotes, staffFilter]);

  const filteredOrders = useMemo(() => (
    salesOrders.filter((order) =>
      isWithinPeriod(order, period) &&
      (customerFilter === 'all' || order.customerId === customerFilter) &&
      recordHasProduct(order, productFilter) &&
      recordMatchesStaff(order, staffFilter))
  ), [customerFilter, period, productFilter, salesOrders, staffFilter]);

  const filteredSamples = useMemo(() => (
    samples.filter((sample) => customerFilter === 'all' || sample.customerId === customerFilter)
  ), [customerFilter, samples]);

  const filteredComplaints = useMemo(() => (
    complaints.filter((complaint) => customerFilter === 'all' || complaint.customerId === customerFilter)
  ), [complaints, customerFilter]);

  const filteredCustomers = useMemo(() => (
    customerFilter === 'all' ? customers : customers.filter((customer) => customer.id === customerFilter)
  ), [customerFilter, customers]);

  const staffOptions = useMemo(() => {
    const values = new Set();
    [...quotes, ...salesOrders].forEach((record) => {
      recordStaffValues(record).forEach((value) => values.add(value));
    });
    return [...values].sort((a, b) => a.localeCompare(b, 'ja'));
  }, [quotes, salesOrders]);

  const dashboard = useMemo(
    () => buildManagementDashboard({
      customers,
      products,
      suppliers,
      complaints: filteredComplaints,
      quotes: filteredQuotes,
      samples: filteredSamples,
      inventories,
    }),
    [customers, filteredComplaints, filteredQuotes, filteredSamples, inventories, products, suppliers],
  );

  const trendRows = useMemo(() => (
    [...dashboard.profitByMonth]
      .filter((row) => row.month && row.month !== '未設定')
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))
      .slice(-12)
  ), [dashboard.profitByMonth]);

  const customerBars = dashboard.profitByCustomer.slice(0, 10);
  const productBars = dashboard.profitByProduct.slice(0, 10);
  const topCustomers = dashboard.profitByCustomer.slice(0, 10);
  const topProducts = dashboard.profitByProduct.slice(0, 10);

  const donutRows = [
    { label: '商品原価', value: Math.max(0, dashboard.totals.productCost), color: CHART_COLORS.productCost },
    { label: '諸経費', value: Math.max(0, dashboard.totals.expenseTotal), color: CHART_COLORS.expenseTotal },
    { label: '実質利益', value: Math.max(0, dashboard.totals.realProfit), color: CHART_COLORS.realProfit },
  ];

  const funnelRows = [
    { label: '見積', value: filteredQuotes.length },
    { label: '提出済', value: stageCount(filteredQuotes, (status) => !status.includes('作成中')) },
    { label: '受注', value: filteredOrders.length },
    {
      label: '成約',
      value: stageCount(filteredQuotes, (status) => status.includes('採用') || status.includes('成約')) ||
        stageCount(filteredOrders, (status) => status.includes('確定') || status.includes('完了') || status.includes('出荷')),
    },
  ];
  const wonCount = funnelRows[3]?.value || 0;
  const winRate = filteredQuotes.length > 0 ? (wonCount / filteredQuotes.length) * 100 : 0;
  const kpiHighlights = [
    { label: '見積提出', value: filteredQuotes.length.toLocaleString('ja-JP'), tone: 'blue', icon: '見', sub: `成約率 ${winRate.toFixed(0)}%`, sparkKey: 'sales' },
    { label: '成約', value: wonCount.toLocaleString('ja-JP'), tone: 'green', icon: '成', sub: `受注 ${filteredOrders.length.toLocaleString('ja-JP')}件`, sparkKey: 'realProfit' },
    { label: '失注', value: stageCount(filteredQuotes, (status) => status.includes('失注')).toLocaleString('ja-JP'), tone: 'red', icon: '失', sub: '要因確認', sparkKey: 'expenseTotal' },
    { label: '売上合計', value: compactMoney(dashboard.totals.quoteAmount), tone: 'gold', icon: '¥', sub: `粗利 ${compactMoney(dashboard.totals.grossMargin)}`, sparkKey: 'sales' },
    { label: '営業利益', value: compactMoney(dashboard.totals.operatingProfit), tone: 'purple', icon: '益', sub: `実質 ${compactMoney(dashboard.totals.realProfit)}`, sparkKey: 'operatingProfit' },
    { label: '営業利益率(平均)', value: percent(dashboard.totals.operatingProfitRate), tone: 'blue', icon: '%', sub: `実質 ${percent(dashboard.totals.realProfitRate)}`, sparkKey: 'realProfitRate' },
  ];

  function exportDashboard() {
    const rows = [
      ['指標', '値'],
      ...kpiHighlights.map((metric) => [metric.label, metric.value]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="page analytics-page">
      <div className="page-header analytics-hero analytics-titlebar">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>分析 / 営業状況</h1>
          <p>営業活動・売上・利益の状況を分析します。</p>
        </div>
        <button type="button" className="ghost-button analytics-export-button" onClick={exportDashboard}>
          エクスポート
        </button>
      </div>

      <div className="analytics-kpi-grid">
        {kpiHighlights.map((metric) => (
          <DashboardMetric
            key={metric.label}
            label={metric.label}
            value={metric.value}
            tone={metric.tone}
            icon={metric.icon}
            sub={metric.sub}
            sparkRows={trendRows}
            sparkKey={metric.sparkKey}
          />
        ))}
      </div>

      <section className="analytics-filter-bar" aria-label="分析フィルター">
        <label className="field-label">
          期間
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            {PERIOD_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          取引先
          <select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}>
            <option value="all">すべて</option>
            {customers.map((customer) => (
              <option value={customer.id} key={customer.id}>{customer.companyName || '名称未設定'}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          商品
          <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
            <option value="all">すべて</option>
            {products.map((product) => (
              <option value={product.id} key={product.id}>
                {product.productCode ? `${product.productCode} / ` : ''}{product.name || '名称未設定'}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          担当者
          <select value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)}>
            <option value="all">すべて</option>
            {staffOptions.map((staff) => (
              <option value={staff} key={staff}>{staff}</option>
            ))}
          </select>
        </label>
        <div className="analytics-filter-summary">
          <span>{filteredQuotes.length} 見積</span>
          <span>{filteredOrders.length} 受注</span>
          <span>{filteredCustomers.length} 取引先</span>
        </div>
      </section>

      <section className="analytics-chart-grid dashboard-main">
        <ChartPanel title="売上推移" subtitle="月別の売上">
          <LineChart
            rows={trendRows}
            xKey="month"
            series={[{ key: 'sales', label: '売上', color: CHART_COLORS.sales }]}
            valueFormatter={compactMoney}
          />
        </ChartPanel>
        <ChartPanel title="営業利益推移" subtitle="月別の営業利益・実質利益">
          <LineChart
            rows={trendRows}
            xKey="month"
            series={[
              { key: 'operatingProfit', label: '営業利益', color: CHART_COLORS.operatingProfit },
              { key: 'realProfit', label: '実質利益', color: CHART_COLORS.realProfit },
            ]}
            valueFormatter={compactMoney}
          />
        </ChartPanel>
        <ChartPanel title="利益率推移" subtitle="月別の実質利益率">
          <LineChart
            rows={trendRows}
            xKey="month"
            series={[{ key: 'realProfitRate', label: '実質利益率', color: CHART_COLORS.realProfitRate }]}
            valueFormatter={percent}
          />
        </ChartPanel>
      </section>

      <section className="analytics-chart-grid focus-bars">
        <ChartPanel title="取引先別売上 TOP10" subtitle="売上と実質利益を比較">
          <HorizontalBarChart rows={customerBars} labelKey="customerName" valueKeys={[
            { key: 'sales', label: '売上', color: CHART_COLORS.sales },
            { key: 'realProfit', label: '実質利益', color: CHART_COLORS.realProfit },
          ]} />
        </ChartPanel>
        <ChartPanel title="商品別売上 TOP10" subtitle="売上と実質利益を比較">
          <HorizontalBarChart rows={productBars} labelKey="productName" valueKeys={[
            { key: 'sales', label: '売上', color: CHART_COLORS.sales },
            { key: 'realProfit', label: '実質利益', color: CHART_COLORS.realProfit },
          ]} />
        </ChartPanel>
      </section>

      <section className="analytics-chart-grid compact analytics-secondary-charts">
        <ChartPanel title="営業利益構成" subtitle="原価・諸経費・実質利益">
          <DonutChart rows={donutRows} />
        </ChartPanel>
        <ChartPanel title="見積 → 成約ファネル" subtitle="見積から成約までの流れ">
          <FunnelChart rows={funnelRows} />
        </ChartPanel>
        <ChartPanel title="月別売上比較" subtitle="月別の売上・粗利">
          <VerticalBarChart rows={trendRows} labelKey="month" valueKeys={[
            { key: 'sales', label: '売上', color: CHART_COLORS.sales },
            { key: 'grossMarginAmount', label: '粗利', color: CHART_COLORS.grossMarginAmount },
          ]} />
        </ChartPanel>
      </section>

      <section className="analytics-ranking-grid">
        <RankingPanel title="顧客別サマリー TOP10" rows={topCustomers} labelKey="customerName" />
        <RankingPanel title="商品別サマリー TOP10" rows={topProducts} labelKey="productName" />
        <RankingPanel title="見積別サマリー TOP10" rows={dashboard.profitByQuote.slice(0, 10)} labelKey="quoteNumber" />
      </section>

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

      <section className="analytics-detail-tables">
        <div className="section-heading">
          <h2>詳細データ</h2>
          <span>必要な時だけ確認</span>
        </div>
        <DashboardTable
          title="見積別 詳細データ"
          emptyText="詳細データがありません。"
          rows={dashboard.profitByQuote}
          columns={[
            ['quoteNumber', '見積番号'],
            ['customerName', '取引先'],
            ['projectName', '案件'],
            ['sales', '売上', dashboardFormatters.money],
            ['productCost', '商品原価', dashboardFormatters.money],
            ['grossMarginAmount', '粗利額', dashboardFormatters.money],
            ['expenseTotal', '諸経費', dashboardFormatters.money],
            ['operatingProfit', '営業利益', dashboardFormatters.money],
            ['realProfit', '実質利益', dashboardFormatters.money],
          ]}
        />
      </section>
    </section>
  );
}

function DashboardMetric({ label, value, tone, icon, sub, sparkRows = [], sparkKey = 'sales' }) {
  return (
    <div className={`dashboard-metric analytics-kpi ${tone}`}>
      <div className="analytics-kpi-main">
        <i>{icon}</i>
        <div>
          <p>{label}</p>
          <span>{value}</span>
          {sub && <small>{sub}</small>}
        </div>
      </div>
      <MiniSparkline rows={sparkRows} valueKey={sparkKey} />
    </div>
  );
}

function MiniSparkline({ rows, valueKey }) {
  const values = rows.map((row) => toNumber(row[valueKey]));
  if (values.length < 2) return <span className="mini-sparkline empty" aria-hidden="true" />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 82;
  const height = 32;
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 5) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="mini-sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartPanel({ title, subtitle, children }) {
  return (
    <article className="analytics-panel">
      <div className="analytics-panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </article>
  );
}

function LineChart({ rows, xKey, series, valueFormatter }) {
  if (!rows.length) return <EmptyChart />;
  const width = 720;
  const height = 260;
  const padding = { top: 24, right: 24, bottom: 42, left: 58 };
  const values = rows.flatMap((row) => series.map((item) => toNumber(row[item.key])));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const xFor = (index) => padding.left + (index / Math.max(1, rows.length - 1)) * (width - padding.left - padding.right);
  const yFor = (value) => padding.top + ((max - value) / range) * (height - padding.top - padding.bottom);
  const zeroY = yFor(0);

  return (
    <div className="analytics-svg-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="時系列グラフ">
        <line x1={padding.left} x2={width - padding.right} y1={zeroY} y2={zeroY} className="chart-axis zero" />
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + ratio * (height - padding.top - padding.bottom);
          return <line key={ratio} x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart-grid-line" />;
        })}
        {series.map((item) => {
          const points = rows.map((row, index) => `${xFor(index)},${yFor(toNumber(row[item.key]))}`).join(' ');
          return (
            <g key={item.key}>
              <polyline points={points} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {rows.map((row, index) => (
                <circle key={`${item.key}-${row[xKey]}`} cx={xFor(index)} cy={yFor(toNumber(row[item.key]))} r="4" fill={item.color}>
                  <title>{`${row[xKey]} ${item.label}: ${valueFormatter(toNumber(row[item.key]))}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {rows.map((row, index) => (
          <text key={row[xKey]} x={xFor(index)} y={height - 14} textAnchor="middle" className="chart-label">
            {monthLabel(row[xKey])}
          </text>
        ))}
      </svg>
      <ChartLegend items={series} />
    </div>
  );
}

function VerticalBarChart({ rows, labelKey, valueKeys }) {
  if (!rows.length) return <EmptyChart />;
  const max = maxValue(rows, valueKeys.map((item) => item.key));

  return (
    <div className="vertical-bar-chart">
      {rows.map((row) => (
        <div className="vertical-bar-group" key={row[labelKey]}>
          <div className="vertical-bars">
            {valueKeys.map((item) => (
              <span
                key={item.key}
                style={{
                  '--bar-height': `${Math.max(4, (Math.max(0, toNumber(row[item.key])) / max) * 100)}%`,
                  '--bar-color': item.color,
                }}
                title={`${item.label}: ${compactMoney(row[item.key])}`}
              />
            ))}
          </div>
          <small>{row[labelKey] || '-'}</small>
        </div>
      ))}
      <ChartLegend items={valueKeys} />
    </div>
  );
}

function HorizontalBarChart({ rows, labelKey, valueKeys }) {
  if (!rows.length) return <EmptyChart />;
  const max = maxValue(rows, valueKeys.map((item) => item.key));

  return (
    <div className="horizontal-bar-chart">
      {rows.map((row) => (
        <div className="horizontal-bar-row" key={row[labelKey]}>
          <strong>{row[labelKey] || '-'}</strong>
          <div className="horizontal-bar-lines">
            {valueKeys.map((item) => (
              <span key={item.key}>
                <i style={{ width: `${Math.max(3, (Math.max(0, toNumber(row[item.key])) / max) * 100)}%`, background: item.color }} />
                <em>{compactMoney(row[item.key])}</em>
              </span>
            ))}
          </div>
        </div>
      ))}
      <ChartLegend items={valueKeys} />
    </div>
  );
}

function DonutChart({ rows }) {
  const total = rows.reduce((sum, row) => sum + toNumber(row.value), 0);
  if (total <= 0) return <EmptyChart />;
  let offset = 25;
  const circumference = 100;

  return (
    <div className="donut-chart">
      <svg viewBox="0 0 42 42" className="donut-svg" role="img" aria-label="利益構成比">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(148, 163, 184, .18)" strokeWidth="6" />
        {rows.map((row) => {
          const value = (toNumber(row.value) / total) * circumference;
          const currentOffset = offset;
          offset -= value;
          return (
            <circle
              key={row.label}
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke={row.color}
              strokeWidth="6"
              strokeDasharray={`${value} ${circumference - value}`}
              strokeDashoffset={currentOffset}
            />
          );
        })}
        <text x="21" y="20" textAnchor="middle" className="donut-total">{compactMoney(total)}</text>
        <text x="21" y="25" textAnchor="middle" className="donut-caption">構成</text>
      </svg>
      <div className="donut-legend">
        {rows.map((row) => (
          <div key={row.label}>
            <span style={{ background: row.color }} />
            <strong>{row.label}</strong>
            <small>{compactMoney(row.value)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function FunnelChart({ rows }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="funnel-chart">
      {rows.map((row, index) => {
        const rate = rows[0]?.value ? (row.value / rows[0].value) * 100 : 0;
        return (
          <div className="funnel-step" key={row.label}>
            <div>
              <span>{index + 1}</span>
              <strong>{row.label}</strong>
              <small>{row.value.toLocaleString('ja-JP')}件 / {rate.toFixed(0)}%</small>
            </div>
            <i style={{ width: `${Math.max(10, (row.value / max) * 100)}%` }} />
          </div>
        );
      })}
    </div>
  );
}

function RankingPanel({ title, rows, labelKey }) {
  const max = Math.max(1, ...rows.map((row) => toNumber(row.sales)));
  return (
    <section className="analytics-panel ranking-panel">
      <div className="analytics-panel-heading">
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? <EmptyChart /> : rows.map((row, index) => (
        <article className="ranking-row" key={row[labelKey] || index}>
          <span>{index + 1}</span>
          <div>
            <strong>{row[labelKey] || '-'}</strong>
            <small>売上 {compactMoney(row.sales)} / 実質利益 {compactMoney(row.realProfit)}</small>
            <i style={{ width: `${Math.max(4, (toNumber(row.sales) / max) * 100)}%` }} />
          </div>
        </article>
      ))}
    </section>
  );
}

function ChartLegend({ items }) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span key={item.key || item.label}>
          <i style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function EmptyChart() {
  return <p className="compact-empty chart-empty">表示できるデータがありません。</p>;
}

function DashboardTable({ title, emptyText, rows, columns }) {
  return (
    <section className="section-block analytics-table-section">
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
                key={row.id || row.quoteId || row.productId || row.customerId || row.supplierId || row.inventoryId || row.month || row.productName}
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
              <article className="management-card" key={`card-${row.id || row.quoteId || row.productId || row.customerId || row.supplierId || row.inventoryId || row.month || row.productName}`}>
                <strong>{row.quoteNumber || row.productName || row.customerName || row.supplierName || row.projectName || row.month || row.sampleName || row.title || '未設定'}</strong>
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
