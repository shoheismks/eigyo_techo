export default function LastMeetingSummary({ meeting, compact = false, onOpenHistory }) {
  return (
    <section className="customer-briefing-panel customer-last-meeting" aria-label="前回商談">
      <div className="customer-briefing-panel-header">
        <div>
          <p className="eyebrow">Last Meeting</p>
          <h3>前回商談</h3>
        </div>
        {meeting?.date && <span className="info-badge">{meeting.date}</span>}
      </div>
      {meeting ? (
        <div className="customer-last-meeting-body">
          <div className="customer-briefing-meta">
            <span>{meeting.type}</span>
            {meeting.createdByName && <span>{meeting.createdByName}</span>}
            {meeting.contactNames && <span>{meeting.contactNames}</span>}
          </div>
          <p>{meeting.summary || '-'}</p>
          {meeting.nextAction && <p className="inline-helper">次: {meeting.nextAction}</p>}
          <div className="customer-briefing-inline-actions">
            {meeting.replyCount > 0 && <span className="info-badge ready">追記 {meeting.replyCount}</span>}
            {(meeting.truncated || compact) && (
              <button type="button" className="text-button" onClick={onOpenHistory}>
                全文を見る
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="inline-helper">商談履歴はまだありません。</p>
      )}
    </section>
  );
}
