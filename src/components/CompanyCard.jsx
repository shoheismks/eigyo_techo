const PIPELINE_STATUSES = [
  '未接触',
  '送信済',
  '返信あり',
  '商談中',
  '見積提出',
  '成約',
  '失注',
];

const statusTone = {
  未接触: 'neutral',
  送信済: 'active',
  返信あり: 'won',
  商談中: 'proposal',
  見積提出: 'estimate',
  成約: 'gold',
  失注: 'lost',
};

export default function CompanyCard({
  company,
  actionLabel,
  actionDisabled = false,
  onAction,
  onStatusChange,
  onMemoChange,
  onRemove,
  onDiscoverContact,
  contactLoading = false,
  contactError = '',
  compact = false,
  showLeadBadges = false,
}) {
  const tone = statusTone[company.status] ?? 'neutral';
  const canDiscoverContact = Boolean(company.website) && !contactLoading;

  return (
    <article className={`company-card ${compact ? 'compact' : ''}`}>
      <div className="card-topline">
        <span className={`status-pill ${tone}`}>{company.status}</span>
        <span className="area-chip">{company.area}</span>
      </div>

      <div className="company-heading">
        <h3>{company.companyName}</h3>
        <p>{company.industry}</p>
      </div>

      <div className="score-panel">
        <div>
          <span>Score</span>
          <strong>{company.score ?? 0}</strong>
        </div>
        <div>
          <span>Rank</span>
          <strong>{company.rank ?? '★☆☆☆☆'}</strong>
        </div>
      </div>

      {(showLeadBadges || onDiscoverContact) && (
        <div className="lead-badges" aria-label="取得済み情報">
          <span className={company.website ? 'info-badge ready' : 'info-badge'}>
            HP
          </span>
          <span className={company.phone ? 'info-badge ready' : 'info-badge'}>
            電話
          </span>
          <span className={company.email ? 'info-badge ready' : 'info-badge muted'}>
            {company.email ? `✉️ ${company.email}` : 'メール未取得'}
          </span>
          <span className={company.inquiryUrl ? 'info-badge ready' : 'info-badge muted'}>
            {company.inquiryUrl ? '問い合わせあり' : '問い合わせ未取得'}
          </span>
          {company.contactStatus && (
            <span className={`info-badge ${contactStatusClass(company.contactStatus)}`}>
              {contactStatusLabel(company.contactStatus)}
            </span>
          )}
        </div>
      )}

      <dl className="company-details">
        <div>
          <dt>住所</dt>
          <dd>{company.address || '未取得'}</dd>
        </div>
        <div>
          <dt>電話</dt>
          <dd>{company.phone || '未取得'}</dd>
        </div>
        <div>
          <dt>HP</dt>
          <dd>{company.website || '未取得'}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{company.email || 'メール未取得'}</dd>
        </div>
        <div>
          <dt>問合せ</dt>
          <dd>{company.inquiryUrl || '問い合わせ未取得'}</dd>
        </div>
        <div>
          <dt>取得元</dt>
          <dd>{company.source || 'Manual'}</dd>
        </div>
      </dl>

      <div className="score-reasons">
        <p>スコア理由</p>
        <ul>
          {(company.scoreReasons ?? []).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      {onDiscoverContact && (
        <div className="contact-discovery">
          <button
            className="ghost-button"
            disabled={!canDiscoverContact}
            onClick={onDiscoverContact}
          >
            {contactLoading ? '連絡先を検索中...' : '連絡先を探す'}
          </button>
          {!company.website && <p>website がある会社だけ実行できます。</p>}
          {contactError && <p className="inline-error">{contactError}</p>}
        </div>
      )}

      {onStatusChange && (
        <label className="field-label">
          ステータス
          <select
            value={company.status}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            {PIPELINE_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
      )}

      {onMemoChange && (
        <label className="field-label">
          メモ
          <textarea
            value={company.memo}
            placeholder="次回アクションや担当者情報を記録"
            onChange={(event) => onMemoChange(event.target.value)}
          />
        </label>
      )}

      <div className="card-actions">
        {onAction && (
          <button className="primary-button" disabled={actionDisabled} onClick={onAction}>
            {actionDisabled ? '追加済み' : actionLabel}
          </button>
        )}
        {onRemove && (
          <button className="ghost-button danger" onClick={onRemove}>
            削除
          </button>
        )}
      </div>
    </article>
  );
}

function contactStatusLabel(status) {
  if (status === '取得済') return '取得済';
  if (status === '取得失敗') return '取得失敗';
  return '連絡先未取得';
}

function contactStatusClass(status) {
  if (status === '取得済') return 'ready';
  if (status === '取得失敗') return 'failed';
  return 'muted';
}
