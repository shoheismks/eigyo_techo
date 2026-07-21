import { useState } from 'react';
import { PIPELINE_STATUSES } from '../../deals/constants.js';
import ProjectPanel from '../../deals/components/ProjectPanel.jsx';
import { productDisplayName } from '../../products/hooks/useProducts.js';
import {
  businessCodeFormatMessage,
  isValidBusinessCode,
  normalizeBusinessCode,
} from '../../../shared/utils/businessCode.js';
import {
  OFFICE_TYPE_OPTIONS,
  displayCustomerOfficeName,
  getParentCustomer,
  officeTypeLabel,
} from '../services/customerOfficeService.js';

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

function googleSearchUrl(companyName) {
  return `https://www.google.com/search?q=${encodeURIComponent(companyName)}`;
}

function hasCorrection(history) {
  return (history.replies ?? []).some(
    (reply) => reply.type === '訂正' || hasCorrection(reply),
  );
}

function createReply(reply, userId = '') {
  return {
    id: crypto.randomUUID(),
    type: reply.type,
    summary: reply.summary,
    createdAt: new Date().toISOString(),
    createdBy: reply.createdBy,
    userId,
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
  customers = [],
  products,
  projects = [],
  suppliers = [],
  issuers = [],
  contacts = [],
  inventories = [],
  quotes = [],
  invoices = [],
  samples = [],
  complaints = [],
  events = [],
  attachments = [],
  addProject,
  updateProject,
  removeProject,
  onOpenKarte,
  onCreateQuote,
  onCreateInvoice,
  updateCustomer,
  setActivePage,
}) {
  const [historyForm, setHistoryForm] = useState(emptyHistory);
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyForm, setReplyForm] = useState(emptyReply);
  const [codeError, setCodeError] = useState('');

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

  const headOfficeOptions = customers.filter(
    (item) => item.id !== customer.id && !item.parentCustomerId && (item.officeType || 'head_office') === 'head_office',
  );
  const customerOptions = customers.filter((item) => item.id !== customer.id && !item.isDeleted);
  const parentCustomer = getParentCustomer(customer, customers);
  const billingCustomer = customers.find((item) => item.id === customer.billingCustomerId);
  const shippingCustomer = customers.find((item) => item.id === customer.shippingCustomerId);

  function updateOfficeType(value) {
    updateCustomer(customer.id, {
      officeType: value,
      parentCustomerId: value === 'head_office' ? '' : customer.parentCustomerId,
      isHeadOffice: value === 'head_office',
    });
  }

  function copyParentCompanyInfo() {
    if (!parentCustomer) return;

    updateCustomer(customer.id, {
      companyName: parentCustomer.companyName || customer.companyName,
      companyKana: parentCustomer.companyKana || customer.companyKana,
      corporateNumber: parentCustomer.corporateNumber || customer.corporateNumber,
      industry: parentCustomer.industry || customer.industry,
      website: parentCustomer.website || customer.website,
      billingCustomerId: customer.billingCustomerId || parentCustomer.id,
    });
  }

  function updateCustomerCode(value) {
    const customerCode = normalizeBusinessCode(value);
    if (!isValidBusinessCode(customerCode)) {
      setCodeError(businessCodeFormatMessage('顧客コード'));
      return;
    }

    setCodeError('');
    updateField('customerCode', customerCode);
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
        userId: customer.userId,
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
      addReplyToTree(customer.dealHistories ?? [], replyTarget, createReply(replyForm, customer.userId)),
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

        <a
          className="ghost-button external-button"
          href={googleSearchUrl(customer.companyName)}
          target="_blank"
          rel="noreferrer"
        >
          Google検索
        </a>

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
          顧客コード
          <input
            value={customer.customerCode || ''}
            placeholder="例: CUST-001"
            onChange={(event) => updateField('customerCode', event.target.value)}
            onBlur={(event) => updateCustomerCode(event.target.value)}
          />
        </label>
        {codeError && <p className="form-error-message">{codeError}</p>}
        <div className="detail-subsection office-detail-panel">
          <h3>本社・支社／支店</h3>
          <div className="date-grid">
            <label className="field-label">
              拠点区分
              <select value={customer.officeType || 'head_office'} onChange={(event) => updateOfficeType(event.target.value)}>
                {OFFICE_TYPE_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              本社／親会社
              <select
                value={customer.parentCustomerId || ''}
                disabled={(customer.officeType || 'head_office') === 'head_office'}
                onChange={(event) => updateField('parentCustomerId', event.target.value)}
              >
                <option value="">未設定</option>
                {headOfficeOptions.map((item) => (
                  <option value={item.id} key={item.id}>{displayCustomerOfficeName(item)}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="date-grid">
            <label className="field-label">
              支社名／支店名
              <input value={customer.branchName || ''} onChange={(event) => updateField('branchName', event.target.value)} />
            </label>
            <label className="field-label">
              拠点コード
              <input value={customer.branchCode || ''} onChange={(event) => updateField('branchCode', event.target.value.trim())} />
            </label>
          </div>
          <div className="date-grid">
            <label className="field-label">
              請求先
              <select value={customer.billingCustomerId || ''} onChange={(event) => updateField('billingCustomerId', event.target.value)}>
                <option value="">この拠点</option>
                {customerOptions.map((item) => (
                  <option value={item.id} key={item.id}>{displayCustomerOfficeName(item)}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              標準納品先
              <select value={customer.shippingCustomerId || ''} onChange={(event) => updateField('shippingCustomerId', event.target.value)}>
                <option value="">この拠点</option>
                {customerOptions.map((item) => (
                  <option value={item.id} key={item.id}>{displayCustomerOfficeName(item)}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="office-relation-summary">
            <span>現在: {officeTypeLabel(customer.officeType)}</span>
            {parentCustomer && <span>本社: {displayCustomerOfficeName(parentCustomer)}</span>}
            {billingCustomer && <span>請求先: {displayCustomerOfficeName(billingCustomer)}</span>}
            {shippingCustomer && <span>納品先: {displayCustomerOfficeName(shippingCustomer)}</span>}
          </div>
          {parentCustomer && (
            <button type="button" className="ghost-button compact-action-button" onClick={copyParentCompanyInfo}>
              本社の会社情報をコピー
            </button>
          )}
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
          既定発行元
          <select value={customer.defaultIssuerId || ''} onChange={(event) => updateField('defaultIssuerId', event.target.value)}>
            <option value="">未設定</option>
            {issuers.filter((issuer) => issuer.isActive !== false).map((issuer) => <option value={issuer.id} key={issuer.id}>{issuer.name || issuer.legalName}</option>)}
          </select>
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
            メールアドレス
            <input value={customer.email} onChange={(event) => updateField('email', event.target.value)} />
          </label>
        </div>
        <label className="field-label">
          公式サイトURL
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

        <div className="score-reasons">
          <p>スコア理由</p>
          <ul>
            {(customer.scoreReasons ?? []).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
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

      <ProjectPanel
        title="案件"
        projects={projects}
        customers={customer ? [customer] : []}
        suppliers={suppliers}
        contacts={contacts}
        products={products}
        inventories={inventories}
        issuers={issuers}
        quotes={quotes}
        invoices={invoices}
        samples={samples}
        complaints={complaints}
        events={events}
        attachments={attachments}
        addProject={addProject}
        updateProject={updateProject}
        removeProject={removeProject}
        defaultCustomerId={customer.id}
        setActivePage={setActivePage}
        onOpenKarte={onOpenKarte}
        onCreateQuote={onCreateQuote}
        onCreateInvoice={onCreateInvoice}
      />

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
                <span>{productDisplayName(product)}</span>
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
