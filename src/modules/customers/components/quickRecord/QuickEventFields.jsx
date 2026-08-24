export default function QuickEventFields({ draft, errors, onChange, onToggle }) {
  return (
    <section className="quick-record-section">
      <label className="quick-record-toggle">
        <input
          type="checkbox"
          checked={draft.createEvent}
          onChange={(event) => onToggle('createEvent', event.target.checked)}
        />
        <span>
          <strong>次回予定を作成</strong>
          <small>日時が決まっている場合だけ登録します。</small>
        </span>
      </label>
      {draft.createEvent && (
        <div className="quick-record-collapsible">
          <label className="field-label">
            件名 *
            <input
              value={draft.event.title}
              onChange={(event) => onChange('event', 'title', event.target.value)}
              placeholder="例: 見積回答"
            />
            {errors.eventTitle && <small className="quick-record-error">{errors.eventTitle}</small>}
          </label>
          <div className="quick-record-two-columns">
            <label className="field-label">
              開始日時 *
              <input
                type="datetime-local"
                value={draft.event.startAt}
                onChange={(event) => onChange('event', 'startAt', event.target.value)}
              />
              {errors.eventStartAt && <small className="quick-record-error">{errors.eventStartAt}</small>}
            </label>
            <label className="field-label">
              終了日時 *
              <input
                type="datetime-local"
                value={draft.event.endAt}
                onChange={(event) => onChange('event', 'endAt', event.target.value)}
              />
              {errors.eventEndAt && <small className="quick-record-error">{errors.eventEndAt}</small>}
            </label>
          </div>
          <label className="field-label">
            メモ
            <input
              value={draft.event.memo}
              onChange={(event) => onChange('event', 'memo', event.target.value)}
              placeholder="予定に残す補足"
            />
          </label>
        </div>
      )}
    </section>
  );
}
