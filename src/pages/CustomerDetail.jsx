import { useState } from 'react';
import { PIPELINE_STATUSES } from './Pipeline.jsx';

const DEAL_TYPES = ['メール', '電話', '商談', '訪問', '見積', 'その他'];
const REPLY_TYPES = ['返信', '訂正', '補足', '次回アクション', '社内メモ'];

const emptyHistory = {
  date: '',
  type: 'メール',
  summary: '',
  nextAction: '',
  createdBy: '',
};

const emptyReply = {
  type: '返信',
  summary: '',
  createdBy: '',
};

function hasCorrection(history) {
  return (history.replies ?? []).some(
    (reply) => reply.type === '訂正' || hasCorrection(reply),
  );
}

function createReply(reply) {
  return {
    id: crypto.randomUUID(),
    type: reply.type,
    summary: reply.summary,
    createdAt: new Date().toISOString(),
    createdBy: reply.createdBy,
    replies: [],
  };
}

function addReplyToTree(items, targetId, reply) {
  return items.map((item) => {
    if (item.id === targetId) {
      return {
        ...item,
        replies: [...(item.replies ?? []), reply],
      };
    }

    return {
      ...item,
      replies: addReplyToTree(item.replies ?? [], targetId, reply),
    };
  });
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function HistoryReplies({ replies, onStartReply, depth = 1 }) {
  if (!replies?.length) {
    return null;
  }

  return (
    <div className="history-replies">
      {replies.map((reply) => (
        <article className="history-reply" style={{ marginLeft: `${Math.min(depth, 3) * 14}px` }} key={reply.id}>
          <div className="history-meta">
            <span>{reply.type}</span>
            <small>{formatDateTime(reply.createdAt)}</small>
          </div>
          <p>{reply.summary || '内容未入力'}</p>
          {reply.createdBy && <small className="inline-helper">作成者: {reply.createdBy}</small>}
          <div className="card-actions compact-actions">
            <button className="ghost-button" onClick={() => onStartReply(reply.id, '返信')}>
              返信追加
            </button>
            <button className="ghost-button" onClick={() => onStartReply(reply.id, '訂正')}>
              訂正追加
            </button>
          </div>
          <HistoryReplies replies={reply.replies} onStartReply={onStartReply} depth={depth + 1} />
        </article>
      ))}
    </div>
  );
}

export default function CustomerDetail({
  customer,
  products,
  updateCustomer,
  setActivePage,
}) {
  const [historyForm, setHistoryForm] = useState(emptyHistory);
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyForm, setReplyForm] = useState(emptyReply);

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

  function addHistory(event) {
    event.preventDefault();

    if (!historyForm.summary.trim()) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    updateField('dealHistories', [
      {
        ...historyForm,
        id: crypto.randomUUID(),
        date: historyForm.date || today,
        createdAt: new Date().toISOString(),
        replies: [],
      },
      ...(customer.dealHistories ?? []),
    ]);
    setHistoryForm(emptyHistory);
  }

  function startReply(targetId, type) {
    setReplyTarget(targetId);
    setReplyForm({ ...emptyReply, type });
  }

  function addReply(event) {
    event.preventDefault();

    if (!replyTarget || !replyForm.summary.trim()) {
      return;
    }

    updateField(
      'dealHistories',
      addReplyToTree(customer.dealHistories ?? [], replyTarget, createReply(replyForm)),
    );
    setReplyTarget(null);
    setReplyForm(emptyReply);
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
        <label className="field-label">
          備考
          <textarea
            value={customer.companyNote}
            placeholder="企業の特徴、決裁者情報、取引注意点、支払い条件、社内共有メモなど"
            onChange={(event) => updateField('companyNote', event.target.value)}
          />
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
        <div className="date-grid">
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
            最終接触日
            <input
              type="date"
              value={customer.lastContactDate || ''}
              onChange={(event) => updateField('lastContactDate', event.target.value)}
            />
          </label>
        </div>
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

      <section className="detail-section timeline-section">
        <div className="section-heading">
          <h2>商談履歴</h2>
          <span>編集不可</span>
        </div>

        <form className="history-add-form" onSubmit={addHistory}>
          <div className="date-grid">
            <label className="field-label">
              日付
              <input
                type="date"
                value={historyForm.date}
                onChange={(event) => setHistoryForm({ ...historyForm, date: event.target.value })}
              />
            </label>
            <label className="field-label">
              種別
              <select
                value={historyForm.type}
                onChange={(event) => setHistoryForm({ ...historyForm, type: event.target.value })}
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
              value={historyForm.summary}
              placeholder="商談内容を追加。登録後は編集せず、訂正や補足を追記します。"
              onChange={(event) => setHistoryForm({ ...historyForm, summary: event.target.value })}
            />
          </label>
          <label className="field-label">
            次アクション
            <input
              value={historyForm.nextAction}
              onChange={(event) => setHistoryForm({ ...historyForm, nextAction: event.target.value })}
            />
          </label>
          <label className="field-label">
            作成者
            <input
              value={historyForm.createdBy}
              placeholder="例: 山田"
              onChange={(event) => setHistoryForm({ ...historyForm, createdBy: event.target.value })}
            />
          </label>
          <button className="primary-button" type="submit">履歴を追加</button>
        </form>

        {replyTarget && (
          <form className="reply-editor" onSubmit={addReply}>
            <div className="section-heading">
              <h3>返信・訂正を追加</h3>
              <button type="button" className="text-button" onClick={() => setReplyTarget(null)}>
                キャンセル
              </button>
            </div>
            <label className="field-label">
              種別
              <select
                value={replyForm.type}
                onChange={(event) => setReplyForm({ ...replyForm, type: event.target.value })}
              >
                {REPLY_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              内容
              <textarea
                value={replyForm.summary}
                onChange={(event) => setReplyForm({ ...replyForm, summary: event.target.value })}
              />
            </label>
            <label className="field-label">
              作成者
              <input
                value={replyForm.createdBy}
                onChange={(event) => setReplyForm({ ...replyForm, createdBy: event.target.value })}
              />
            </label>
            <button className="primary-button" type="submit">追加する</button>
          </form>
        )}

        {(customer.dealHistories ?? []).length > 0 ? (
          <div className="history-list timeline-list">
            {(customer.dealHistories ?? []).map((history) => (
              <article className="history-card timeline-card" key={history.id}>
                <div className="history-meta">
                  <span>{history.date || '日付未設定'} / {history.type}</span>
                  <small>編集不可</small>
                </div>
                {hasCorrection(history) && <p className="correction-badge">訂正あり</p>}
                <p>{history.summary || '内容未入力'}</p>
                {history.nextAction && <p className="inline-helper">次アクション: {history.nextAction}</p>}
                {history.createdBy && <p className="inline-helper">作成者: {history.createdBy}</p>}
                <div className="card-actions compact-actions">
                  <button className="ghost-button" onClick={() => startReply(history.id, '返信')}>
                    返信追加
                  </button>
                  <button className="ghost-button" onClick={() => startReply(history.id, '訂正')}>
                    訂正追加
                  </button>
                </div>
                <HistoryReplies replies={history.replies} onStartReply={startReply} />
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
