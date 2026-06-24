import { PIPELINE_STATUSES } from './Pipeline.jsx';

const DEAL_TYPES = ['メール', '電話', '商談', '訪問', '見積', 'その他'];

const emptyHistory = {
  date: '',
  type: 'メール',
  summary: '',
  nextAction: '',
};

export default function CustomerDetail({
  customer,
  products,
  updateCustomer,
  setActivePage,
}) {
  if (!customer) {
    return (
      <main className="page">
        <section className="empty-state">
          <h3>顧客が見つかりません</h3>
          <p>得意先一覧から顧客を選択してください。</p>
          <button className="primary-button" onClick={() => setActivePage('Customers')}>得意先へ</button>
        </section>
      </main>
    );
  }

  function updateField(field, value) {
    updateCustomer(customer.id, { [field]: value });
  }

  function updateTags(value) {
    updateField(
      'tags',
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    );
  }

  function addHistory() {
    const today = new Date().toISOString().slice(0, 10);
    updateField('dealHistories', [
      {
        ...emptyHistory,
        id: crypto.randomUUID(),
        date: today,
      },
      ...(customer.dealHistories ?? []),
    ]);
  }

  function updateHistory(historyId, updates) {
    updateField(
      'dealHistories',
      (customer.dealHistories ?? []).map((history) =>
        history.id === historyId ? { ...history, ...updates } : history,
      ),
    );
  }

  function removeHistory(historyId) {
    updateField(
      'dealHistories',
      (customer.dealHistories ?? []).filter((history) => history.id !== historyId),
    );
  }

  function toggleProduct(productId) {
    const currentProducts = customer.proposedProducts ?? [];
    const nextProducts = currentProducts.includes(productId)
      ? currentProducts.filter((id) => id !== productId)
      : [...currentProducts, productId];
    updateField('proposedProducts', nextProducts);
  }

  return (
    <main className="page">
      <section className={`page-header ${customer.isDoNotContact ? 'ng-panel' : ''}`}>
        <p className="eyebrow">Customer detail</p>
        <h1>{customer.companyName}</h1>
        <p>{customer.industry || '業種未設定'} / {customer.area || 'エリア未設定'}</p>
      </section>

      <section className="detail-section">
        <div className="section-heading">
          <h2>会社情報</h2>
          <button className="text-button" onClick={() => setActivePage('Customers')}>一覧へ</button>
        </div>
        <label className="field-label">
          会社名
          <input value={customer.companyName} onChange={(event) => updateField('companyName', event.target.value)} />
        </label>
        <label className="field-label">
          業種
          <input value={customer.industry} onChange={(event) => updateField('industry', event.target.value)} />
        </label>
        <label className="field-label">
          エリア
          <input value={customer.area} onChange={(event) => updateField('area', event.target.value)} />
        </label>
        <label className="field-label">
          住所
          <input value={customer.address} onChange={(event) => updateField('address', event.target.value)} />
        </label>
        <div className="date-grid">
          <label className="field-label">
            電話
            <input value={customer.phone} onChange={(event) => updateField('phone', event.target.value)} />
          </label>
          <label className="field-label">
            Email
            <input value={customer.email} onChange={(event) => updateField('email', event.target.value)} />
          </label>
        </div>
        <label className="field-label">
          公式サイト
          <input value={customer.website} onChange={(event) => updateField('website', event.target.value)} />
        </label>
        <label className="field-label">
          問い合わせURL
          <input value={customer.inquiryUrl} onChange={(event) => updateField('inquiryUrl', event.target.value)} />
        </label>
      </section>

      <section className="detail-section">
        <h2>営業管理</h2>
        <label className="field-label">
          ステータス
          <select value={customer.status} onChange={(event) => updateField('status', event.target.value)}>
            {PIPELINE_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          タグ
          <input
            value={(customer.tags ?? []).join(', ')}
            placeholder="例: 高級, 食品, 再提案"
            onChange={(event) => updateTags(event.target.value)}
          />
        </label>
        <label className="field-label">
          次回フォロー日
          <input
            type="date"
            value={customer.nextFollowUpDate || customer.nextFollowDate || ''}
            onChange={(event) => updateCustomer(customer.id, {
              nextFollowUpDate: event.target.value,
              nextFollowDate: event.target.value,
            })}
          />
        </label>
        <label className="field-label">
          メモ
          <textarea value={customer.memo} onChange={(event) => updateField('memo', event.target.value)} />
        </label>
      </section>

      <section className={`detail-section ${customer.isDoNotContact ? 'ng-panel' : ''}`}>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={customer.isDoNotContact}
            onChange={(event) => updateField('isDoNotContact', event.target.checked)}
          />
          <span>配信停止・NG顧客</span>
        </label>
        <label className="field-label">
          NG理由
          <textarea
            value={customer.doNotContactReason}
            placeholder="例: 先方から連絡不要の申し出あり"
            onChange={(event) => updateField('doNotContactReason', event.target.value)}
          />
        </label>
      </section>

      <section className="detail-section">
        <div className="section-heading">
          <h2>商談履歴</h2>
          <button className="text-button" onClick={addHistory}>履歴追加</button>
        </div>
        {(customer.dealHistories ?? []).length > 0 ? (
          <div className="history-list">
            {(customer.dealHistories ?? []).map((history) => (
              <article className="history-card" key={history.id}>
                <div className="date-grid">
                  <label className="field-label">
                    日付
                    <input
                      type="date"
                      value={history.date}
                      onChange={(event) => updateHistory(history.id, { date: event.target.value })}
                    />
                  </label>
                  <label className="field-label">
                    種別
                    <select
                      value={history.type}
                      onChange={(event) => updateHistory(history.id, { type: event.target.value })}
                    >
                      {DEAL_TYPES.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field-label">
                  要約
                  <textarea
                    value={history.summary}
                    onChange={(event) => updateHistory(history.id, { summary: event.target.value })}
                  />
                </label>
                <label className="field-label">
                  次アクション
                  <input
                    value={history.nextAction}
                    onChange={(event) => updateHistory(history.id, { nextAction: event.target.value })}
                  />
                </label>
                <button className="ghost-button danger" onClick={() => removeHistory(history.id)}>削除</button>
              </article>
            ))}
          </div>
        ) : (
          <div className="pipeline-empty">商談履歴はまだありません。</div>
        )}
      </section>

      <section className="detail-section">
        <h2>提案商品</h2>
        {products.length > 0 ? (
          <div className="product-check-list">
            {products.map((product) => (
              <label className="switch-row" key={product.id}>
                <input
                  type="checkbox"
                  checked={(customer.proposedProducts ?? []).includes(product.id)}
                  onChange={() => toggleProduct(product.id)}
                />
                <span>{product.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="pipeline-empty">商品マスターに商品を登録してください。</div>
        )}
      </section>
    </main>
  );
}
