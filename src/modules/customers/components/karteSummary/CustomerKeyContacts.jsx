export default function CustomerKeyContacts({ contactSummary, isDoNotContact = false }) {
  const keyContact = contactSummary?.keyContact;
  const decisionMaker = contactSummary?.decisionMaker;
  const phone = contactSummary?.phone;
  const email = contactSummary?.email;

  return (
    <section className="customer-briefing-panel customer-key-contacts" aria-label="担当者">
      <div className="customer-briefing-panel-header">
        <div>
          <p className="eyebrow">Contacts</p>
          <h3>担当者</h3>
        </div>
      </div>
      <div className="customer-contact-stack">
        <div>
          <span className="customer-briefing-label">重要担当者</span>
          <strong>{contactSummary?.keyContactLabel || '未設定'}</strong>
        </div>
        <div>
          <span className="customer-briefing-label">決裁者</span>
          <strong>{decisionMaker ? contactSummary.decisionMakerLabel : '明示情報なし'}</strong>
          {decisionMaker?.decisionPower && <small>{decisionMaker.decisionPower}</small>}
        </div>
      </div>
      <div className="customer-briefing-inline-actions">
        {phone && (
          <a className="ghost-button compact-action-button" href={`tel:${phone}`}>
            電話
          </a>
        )}
        {email && !isDoNotContact && (
          <a className="ghost-button compact-action-button" href={`mailto:${email}`}>
            メール
          </a>
        )}
        {email && isDoNotContact && <span className="info-badge failed">メール停止</span>}
        {!keyContact && <p className="inline-helper">担当者情報を追加すると商談前確認が楽になります。</p>}
      </div>
    </section>
  );
}
