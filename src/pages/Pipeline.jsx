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

export default function Pipeline({ customers, updateCustomer }) {
  const counts = PIPELINE_STATUSES.reduce((summary, status) => {
    summary[status] = customers.filter((customer) => customer.status === status).length;
    return summary;
  }, {});

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Pipeline</p>
        <h1>案件管理</h1>
        <p>営業先ごとの進捗、次回フォロー日、最終接触日、優先スコアを管理します。</p>
      </section>

      <section className="pipeline-summary" aria-label="ステータス別件数">
        {PIPELINE_STATUSES.map((status) => (
          <div className={`pipeline-count ${statusLabels[status]}`} key={status}>
            <span>{counts[status] ?? 0}</span>
            <p>{status}</p>
          </div>
        ))}
      </section>

      <section className="pipeline-board">
        {PIPELINE_STATUSES.map((status) => {
          const items = customers
            .filter((customer) => customer.status === status)
            .sort((a, b) => b.score - a.score);

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
                    <article className={`pipeline-card ${statusLabels[customer.status]}`} key={customer.id}>
                      <div className="pipeline-card-heading">
                        <h3>{customer.companyName}</h3>
                        <p>{customer.industry || '業種未設定'} / {customer.area || 'エリア未設定'}</p>
                      </div>

                      <div className="score-panel">
                        <div>
                          <span>Score</span>
                          <strong>{customer.score}</strong>
                        </div>
                        <div>
                          <span>顧客ランク</span>
                          <strong>{customer.customerRank || customer.rank}</strong>
                        </div>
                      </div>

                      <div className="score-reasons">
                        <p>スコア理由</p>
                        <ul>
                          {(customer.scoreReasons ?? []).map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>

                      <label className="field-label">
                        ステータス
                        <select
                          value={customer.status}
                          onChange={(event) =>
                            updateCustomer(customer.id, { status: event.target.value })
                          }
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
                            value={customer.lastContactDate}
                            onChange={(event) =>
                              updateCustomer(customer.id, {
                                lastContactDate: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="field-label">
                          次回フォロー日
                          <input
                            type="date"
                            value={customer.nextFollowUpDate || customer.nextFollowDate}
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
                          value={customer.pipelineMemo}
                          placeholder="次にやること、温度感、提案内容など"
                          onChange={(event) =>
                            updateCustomer(customer.id, {
                              pipelineMemo: event.target.value,
                            })
                          }
                        />
                      </label>
                    </article>
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
