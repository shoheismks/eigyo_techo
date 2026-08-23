import CustomerKeyContacts from './CustomerKeyContacts.jsx';
import CustomerProgressSummary from './CustomerProgressSummary.jsx';
import CustomerRiskSummary from './CustomerRiskSummary.jsx';
import LastMeetingSummary from './LastMeetingSummary.jsx';
import NextCustomerAction from './NextCustomerAction.jsx';

export default function CustomerBriefingDesktop({ briefing, actions }) {
  return (
    <section className="customer-briefing customer-briefing-desktop" aria-label="商談前サマリー">
      <div className="customer-briefing-main">
        <div className="customer-briefing-card customer-briefing-hero">
          <div>
            <p className="eyebrow">Customer Briefing</p>
            <h2>{briefing.customer.name}</h2>
            <div className="lead-badges">
              <span className="status-pill active">{briefing.customer.status}</span>
              <span className="info-badge ready">Rank {briefing.customer.rank}</span>
              {briefing.customer.score !== '' && <span className="info-badge">Score {briefing.customer.score}</span>}
              {briefing.customer.nextFollowDate && <span className="info-badge active">Follow {briefing.customer.nextFollowDate}</span>}
              {briefing.customer.isDoNotContact && <span className="info-badge failed">NG/配信停止</span>}
            </div>
          </div>
          <div className="customer-briefing-actions">
            <button type="button" className="primary-button compact-action-button" onClick={actions.onAddHistory}>
              商談記録
            </button>
            <button type="button" className="ghost-button compact-action-button" onClick={actions.onAddEvent}>
              予定追加
            </button>
            <button type="button" className="ghost-button compact-action-button" onClick={actions.onAddTask}>
              タスク追加
            </button>
            <button type="button" className="ghost-button compact-action-button" onClick={actions.onCreateQuote}>
              見積作成
            </button>
            <button type="button" className="ghost-button compact-action-button" onClick={actions.onAddProject}>
              案件作成
            </button>
          </div>
        </div>
        <div className="customer-briefing-grid">
          <CustomerKeyContacts contactSummary={briefing.contactSummary} isDoNotContact={briefing.customer.isDoNotContact} />
          <NextCustomerAction actions={briefing.nextActions} limit={5} onNavigate={actions.onNavigate} />
          <LastMeetingSummary meeting={briefing.lastMeeting} onOpenHistory={actions.onOpenHistory} />
          <div className="customer-briefing-two-column">
            <CustomerProgressSummary progress={briefing.progress} onNavigate={actions.onNavigate} />
            <CustomerRiskSummary risks={briefing.risks} onNavigate={actions.onNavigate} />
          </div>
        </div>
      </div>
    </section>
  );
}
