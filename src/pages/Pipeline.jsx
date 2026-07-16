import { useEffect, useMemo, useState } from 'react';
import DesktopTable from '../shared/components/DesktopTable.jsx';
import { PIPELINE_STATUSES } from '../modules/deals/constants.js';
import ProjectPanel from '../modules/deals/components/ProjectPanel.jsx';

const ALL = 'すべて';

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

export default function Pipeline({
  customers,
  suppliers = [],
  contacts = [],
  products = [],
  inventories = [],
  issuers = [],
  quotes = [],
  samples = [],
  complaints = [],
  events = [],
  attachments = [],
  projects = [],
  addProject,
  updateProject,
  removeProject,
  updateCustomer,
  setActivePage,
  onOpenKarte,
  onCreateQuote,
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id ?? '');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [keyword, setKeyword] = useState('');

  const counts = PIPELINE_STATUSES.reduce((summary, status) => {
    summary[status] = customers.filter((customer) => customer.status === status).length;
    return summary;
  }, {});

  const filteredCustomers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return customers
      .filter((customer) => statusFilter === ALL || customer.status === statusFilter)
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

  const desktopColumns = useMemo(
    () => [
      { key: 'companyName', label: '会社名', width: '32%', render: (customer) => <strong>{customer.companyName}</strong> },
      { key: 'status', label: '状況', minWidth: '110px', render: (customer) => customer.status || '-' },
      { key: 'follow', label: '次回', minWidth: '120px', render: (customer) => followDate(customer) || '-' },
      { key: 'score', label: 'スコア', minWidth: '80px', render: (customer) => customer.score ?? 0 },
    ],
    [],
  );

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
            className={`pipeline-count ${statusLabels[status] || 'gray'} ${statusFilter === status ? 'selected' : ''}`}
            key={status}
            onClick={() => setStatusFilter(status)}
          >
            <span>{counts[status] ?? 0}</span>
            <p>{status}</p>
          </button>
        ))}
      </section>

      <section className="mobile-field-panel pipeline-mobile-controls" aria-label="スマホ用案件検索">
        <label className="field-label">
          会社名・メモ検索
          <input value={keyword} placeholder="会社名やメモを検索" onChange={(event) => setKeyword(event.target.value)} />
        </label>
        <label className="field-label">
          ステータス
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {[ALL, ...PIPELINE_STATUSES].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
      </section>

      <ProjectPanel
        title="案件一覧"
        projects={projects}
        customers={customers}
        suppliers={suppliers}
        contacts={contacts}
        products={products}
        inventories={inventories}
        issuers={issuers}
        quotes={quotes}
        samples={samples}
        complaints={complaints}
        events={events}
        attachments={attachments}
        addProject={addProject}
        updateProject={updateProject}
        removeProject={removeProject}
        setActivePage={setActivePage}
        onOpenKarte={onOpenKarte}
        onCreateQuote={onCreateQuote}
      />

      <section className="pipeline-desktop">
        <aside className="pipeline-list-pane">
          <div className="pipeline-filter-panel">
            <label className="field-label filter-search">
              検索
              <input value={keyword} placeholder="会社名・メモ・タグで検索" onChange={(event) => setKeyword(event.target.value)} />
            </label>
            <label className="field-label">
              ステータス
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {[ALL, ...PIPELINE_STATUSES].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>

          <DesktopTable
            className="pipeline-common-table"
            columns={desktopColumns}
            minWidth={620}
            onRowClick={(customer) => setSelectedCustomerId(customer.id)}
            rows={filteredCustomers}
            selectedRowId={selectedCustomer?.id}
          />
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
          const items = filteredCustomers
            .filter((customer) => customer.status === status)
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

          return (
            <section className="pipeline-lane" key={status}>
              <div className="pipeline-lane-heading">
                <h2>
                  <span className={`pipeline-dot ${statusLabels[status] || 'gray'}`} />
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
  const [memoDraft, setMemoDraft] = useState(customer.pipelineMemo || '');

  useEffect(() => {
    setMemoDraft(customer.pipelineMemo || '');
  }, [customer.id, customer.pipelineMemo]);

  function saveMemoDraft() {
    if (memoDraft !== (customer.pipelineMemo || '')) {
      updateCustomer(customer.id, { pipelineMemo: memoDraft });
    }
  }

  return (
    <article className={`pipeline-card ${statusLabels[customer.status] || 'gray'}`}>
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
          value={memoDraft}
          placeholder="次にやること、温度感、提案内容など"
          onChange={(event) => setMemoDraft(event.target.value)}
          onBlur={saveMemoDraft}
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
  const [memoDraft, setMemoDraft] = useState(customer.pipelineMemo || '');

  useEffect(() => {
    setMemoDraft(customer.pipelineMemo || '');
  }, [customer.id, customer.pipelineMemo]);

  function saveMemoDraft() {
    if (memoDraft !== (customer.pipelineMemo || '')) {
      updateCustomer(customer.id, { pipelineMemo: memoDraft });
    }
  }

  return (
    <article className={`pipeline-card ${statusLabels[customer.status] || 'gray'}`} key={customer.id}>
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
          value={memoDraft}
          placeholder="次にやること、温度感、提案内容など"
          onChange={(event) => setMemoDraft(event.target.value)}
          onBlur={saveMemoDraft}
        />
      </label>
    </article>
  );
}
