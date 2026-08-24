export default function QuickMeetingForm({ draft, errors, onChange }) {
  return (
    <section className="quick-record-section">
      <div className="quick-record-section-heading">
        <span>1</span>
        <div>
          <h3>商談記録</h3>
          <p>商談メモだけでも保存できます。</p>
        </div>
      </div>
      <label className="field-label">
        商談メモ *
        <textarea
          autoFocus
          value={draft.meeting.summary}
          onChange={(event) => onChange('meeting', 'summary', event.target.value)}
          placeholder="例: F1タンを月10csで検討。4,800円/kgで回答予定"
          required
        />
        {errors.meeting && <small className="quick-record-error">{errors.meeting}</small>}
      </label>
      <div className="quick-record-two-columns">
        <label className="field-label">
          種別
          <select value={draft.meeting.type} onChange={(event) => onChange('meeting', 'type', event.target.value)}>
            {['商談', '訪問', '電話', 'メール', '見積', 'その他'].map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="field-label">
          次アクション
          <input
            value={draft.meeting.nextAction}
            onChange={(event) => onChange('meeting', 'nextAction', event.target.value)}
            placeholder="例: 見積を作成して送付"
          />
        </label>
      </div>
    </section>
  );
}
