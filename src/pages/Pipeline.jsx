import { useMemo, useState } from 'react';

export const PIPELINE_STATUSES = [
  '未接触',
  '送信済',
  '返信あり',
  '商談中',
  '見積提出',
  '成約',
  '失注',
];

const statusLabels = {
  未接触: 'gray',
  送信済: 'blue',
  返信あり: 'green',
  商談中: 'orange',
  見積提出: 'purple',
  成約: 'gold',
  失注: 'red',
};

function followDate(customer) {
  return customer.nextFollowUpDate || customer.nextFollowDate || '';
}

export default function Pipeline({ customers, updateCustomer }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id ?? '');
  const [statusFilter, setStatusFilter] = useState('すべて');
  const [keyword, setKeyword] = useState('');

  const counts = PIPELINE_STATUSES.reduce((summary, status) => {
    summary[status] = customers.filter((customer) => customer.status === status).length;
    return summary;
  }, {});

  const filteredCustomers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return customers
      .filter((customer) => statusFilter === 'すべて' || customer.status === statusFilter)
      .filter((customer) => {
        if (!normalizedKeyword) return true;
        return [
          customer.companyName,
          customer.industry,
          customer.area,
          customer.pipelineMemo,
          customer.memo,
          ...(customer.tags ?? []),
        ].some((value) => String(value ?? '').toLowerCase().includes(normalizedKeyword));
      })
      .sort((a, b) => (followDate(a) || '9999-12-31').localeCompare(followDate(b) || '9999-12-31'));
  }, [customers, keyword, statusFilter]);

  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ||
    filteredCustomers[0] ||
    customers[0];

  return (
    <main className="page pipeline-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h1>案件管理</h1>
          <p>PCでは商談一覧と詳細を並べ、状況更新と次アクション整理をしやすくします。</p>
        </div>
      </section>

      <section className="pipeline-summary" aria-label="ステータス別件数">
        {PIPELINE_STATUSES.map((status) => (
          <button
            type="button"
            className={`pipeline-count ${statusLabels[status]} ${statusFilter === status ? 'selected' : ''}`}
            key={status}
            onClick={() => setStatusFilter(status)}
          >
            <span>{counts[status] ?? 0}</span>
            <p>{status}</p>
          </button>
        ))}
      </section>

      <section className="pipeline-desktop">
        <aside className="pipeline-list-pane">
          <div className="search-panel desktop-filter-panel">
            <label className="field-label filter-search">
              検索
              <input value={keyword} placeholder="会社名・メモ・タグで検索" onChange={(event) => setKeyword(event.target.value)} />
            </label>
            <label className="field-label">
              ステータス
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {['すべて', ...PIPELINE_STATUSES].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="desktop-table pipeline-history-table">
            <div className="desktop-table-head">
              <span>会社名</span>
              <span>状況</span>
              <span>次回</span>
              <span>スコア</span>
            </div>
            {filteredCustomers.map((customer) => (
              <button
                type="button"
                className={`desktop-table-row row-button ${selectedCustomer?.id === customer.id ? 'selected' : ''}`}
                key={customer.id}
                onClick={() => setSelectedCustomerId(customer.id)}
              >
                <strong>{customer.companyName}</strong>
                <span>{customer.status || '-'}</span>
                <span>{followDate(customer) || '-'}</span>
                <span>{customer.score ?? 0}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="pipeline-detail-pane">
          {selectedCustomer ? (
            <PipelineDetail customer={selectedCustomer} updateCustomer={updateCustomer} />
          ) : (
            <div className="empty-state">
              <h3>案件がありません</h3>
              <p>取引先を追加するとここに表示されます。</p>
            </div>
          )}
        </section>
      </section>

      <section className="pipeline-board">
        {PIPELINE_STATUSES.map((status) => {
          const items = customers
            .filter((customer) => customer.status === status)
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

          return (
            <section className="pipeline-lane" key={status}>
              <div className="pipeline-lane-heading">
                <h2>
                  <span className={`pipeline-dot ${statusLabels[status]}`} />
                  {status}
                </h2>
                <span>{items.length}件</span>
              </div>

              {items.length > 0 ? (
                <div className="pipeline-card-stack">
                  {items.map((customer) => (
                    <PipelineCard key={customer.id} customer={customer} updateCustomer={updateCustomer} />
                  ))}
                </div>
              ) : (
                <div className="pipeline-empty">このステータスの案件はありません。</div>
              )}
            </section>
          );
        })}
      </section>
    </main>
  );
}

function PipelineDetail({ customer, updateCustomer }) {
  const histories = customer.dealHistories ?? [];

  return (
    <article className={`pipeline-card ${statusLabels[customer.status]}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Deal Detail</p>
          <h2>{customer.companyName}</h2>
        </div>
        <span className="status-pill active">{customer.status}</span>
      </div>

      <div className="score-panel">
        <div>
          <span>Score</span>
          <strong>{customer.score ?? 0}</strong>
        </div>
        <div>
          <span>ランク</span>
          <strong>{customer.customerRank || customer.rank || 'D'}</strong>
        </div>
      </div>

      <label className="field-label">
        ステータス
        <select
          value={customer.status}
          onChange={(event) => updateCustomer(customer.id, { status: event.target.value })}
        >
          {PIPELINE_STATUSES.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>

      <div className="date-grid">
        <label className="field-label">
          最終接触日
          <input
            type="date"
            value={customer.lastContactDate || ''}
            onChange={(event) => updateCustomer(customer.id, { lastContactDate: event.target.value })}
          />
        </label>
        <label className="field-label">
          次回フォロー日
          <input
            type="date"
            value={followDate(customer)}
            onChange={(event) =>
              updateCustomer(customer.id, {
                nextFollowUpDate: event.target.value,
                nextFollowDate: event.target.value,
              })
            }
          />
        </label>
      </div>

      <label className="field-label">
        案件メモ
        <textarea
          value={customer.pipelineMemo || ''}
          placeholder="次にやること、温度感、提案内容など"
          onChange={(event) => updateCustomer(customer.id, { pipelineMemo: event.target.value })}
        />
      </label>

      <section className="desktop-panel nested-panel">
        <div className="section-heading">
          <h3>商談履歴</h3>
          <span>{histories.length}件</span>
        </div>
        <div className="timeline-list">
          {histories.length > 0 ? (
            histories.map((history) => (
              <article className={`history-card timeline-card ${history.hasComplaint ? 'ng-card' : ''}`} key={history.id}>
                <div className="history-meta">
                  <span>{history.date || '-'} / {history.type}</span>
                  <small>{history.createdByName || history.createdBy || '-'}</small>
                </div>
                <p>{history.summary || '-'}</p>
                {history.nextAction && <p className="inline-helper">次回: {history.nextAction}</p>}
              </article>
            ))
          ) : (
            <p className="inline-helper">商談履歴はまだありません。</p>
          )}
        </div>
      </section>
    </article>
  );
}

function PipelineCard({ customer, updateCustomer }) {
  return (
    <article className={`pipeline-card ${statusLabels[customer.status]}`} key={customer.id}>
      <div className="pipeline-card-heading">
        <h3>{customer.companyName}</h3>
        <p>{customer.industry || '業種未設定'} / {customer.area || 'エリア未設定'}</p>
      </div>

      <div className="score-panel">
        <div>
          <span>Score</span>
          <strong>{customer.score ?? 0}</strong>
        </div>
        <div>
          <span>顧客ランク</span>
          <strong>{customer.customerRank || customer.rank || 'D'}</strong>
        </div>
      </div>

      <label className="field-label">
        ステータス
        <select
          value={customer.status}
          onChange={(event) => updateCustomer(customer.id, { status: event.target.value })}
        >
          {PIPELINE_STATUSES.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>

      <div className="date-grid">
        <label className="field-label">
          最終接触日
          <input
            type="date"
            value={customer.lastContactDate || ''}
            onChange={(event) => updateCustomer(customer.id, { lastContactDate: event.target.value })}
          />
        </label>
        <label className="field-label">
          次回フォロー日
          <input
            type="date"
            value={followDate(customer)}
            onChange={(event) =>
              updateCustomer(customer.id, {
                nextFollowUpDate: event.target.value,
                nextFollowDate: event.target.value,
              })
            }
          />
        </label>
      </div>

      <label className="field-label">
        案件メモ
        <textarea
          value={customer.pipelineMemo || ''}
          placeholder="次にやること、温度感、提案内容など"
          onChange={(event) => updateCustomer(customer.id, { pipelineMemo: event.target.value })}
        />
      </label>
    </article>
  );
}
