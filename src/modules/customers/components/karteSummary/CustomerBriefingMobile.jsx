import CustomerProgressSummary from './CustomerProgressSummary.jsx';
import CustomerRiskSummary from './CustomerRiskSummary.jsx';
import LastMeetingSummary from './LastMeetingSummary.jsx';
import NextCustomerAction from './NextCustomerAction.jsx';

export default function CustomerBriefingMobile({ briefing, actions }) {
  const phone = briefing.contactSummary?.phone;
  const email = briefing.contactSummary?.email;
  const decisionMaker = briefing.contactSummary?.decisionMaker;
  const decisionMakerPhone = decisionMaker?.mobile || decisionMaker?.phone || '';
  const decisionMakerEmail = decisionMaker?.email || '';

  return (
    <section className="customer-briefing customer-briefing-mobile" aria-label="商談前サマリー">
      <div className="customer-briefing-card customer-briefing-mobile-hero">
        <p className="eyebrow">商談前サマリー</p>
        <h2>{briefing.customer.name}</h2>
        <div className="lead-badges">
          <span className="status-pill active">{briefing.customer.status}</span>
          <span className="info-badge ready">Rank {briefing.customer.rank}</span>
          {briefing.customer.nextFollowDate && <span className="info-badge active">{briefing.customer.nextFollowDate}</span>}
          {briefing.customer.isDoNotContact && <span className="info-badge failed">NG</span>}
        </div>
        <div className="customer-mobile-contact">
          <span>重要担当者</span>
          <strong>{briefing.contactSummary?.keyContactLabel || '未設定'}</strong>
        </div>
        {decisionMaker && (
          <div className="customer-mobile-contact customer-mobile-decision">
            <span>決裁者</span>
            <strong>{briefing.contactSummary?.decisionMakerLabel}</strong>
            {decisionMaker.decisionPower && <small>{decisionMaker.decisionPower}</small>}
            <div className="customer-mobile-decision-actions">
              {decisionMakerPhone && <a className="ghost-button compact-action-button" href={`tel:${decisionMakerPhone}`}>電話</a>}
              {decisionMakerEmail && !briefing.customer.isDoNotContact && <a className="ghost-button compact-action-button" href={`mailto:${decisionMakerEmail}`}>メール</a>}
            </div>
          </div>
        )}
        <div className="customer-briefing-inline-actions">
          {phone && <a className="primary-button compact-action-button" href={`tel:${phone}`}>電話</a>}
          {email && !briefing.customer.isDoNotContact && <a className="ghost-button compact-action-button" href={`mailto:${email}`}>メール</a>}
          <button type="button" className="ghost-button compact-action-button" onClick={actions.onAddHistory}>商談記録</button>
        </div>
      </div>
      <NextCustomerAction actions={briefing.nextActions} limit={3} onNavigate={actions.onNavigate} />
      <LastMeetingSummary meeting={briefing.lastMeeting} compact onOpenHistory={actions.onOpenHistory} />
      <div className="customer-briefing-mobile-quick">
        <button type="button" className="primary-button" onClick={actions.onAddHistory}>商談記録</button>
        <button type="button" className="ghost-button" onClick={actions.onAddEvent}>予定追加</button>
        <button type="button" className="ghost-button" onClick={actions.onAddTask}>タスク追加</button>
      </div>
      <CustomerProgressSummary progress={briefing.progress} onNavigate={actions.onNavigate} />
      <CustomerRiskSummary risks={briefing.risks} onNavigate={actions.onNavigate} />
    </section>
  );
}
