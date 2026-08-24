import QuickEventFields from './QuickEventFields.jsx';
import QuickMeetingForm from './QuickMeetingForm.jsx';
import QuickRecordResult from './QuickRecordResult.jsx';
import QuickTaskFields from './QuickTaskFields.jsx';

export default function CustomerQuickRecordDesktop({
  customer,
  draft,
  errors,
  result,
  saving,
  onChange,
  onClose,
  onRetry,
  onSave,
  onToggle,
}) {
  return (
    <div className="quick-record-modal quick-record-desktop-modal" role="dialog" aria-modal="true" aria-label="商談直後クイック記録">
      <form className="quick-record-dialog quick-record-dialog-desktop" onSubmit={onSave}>
        <header className="quick-record-header">
          <div>
            <p className="eyebrow">Quick Record</p>
            <h2>{customer.companyName || '顧客'}の商談を記録</h2>
          </div>
          <button type="button" className="ghost-button compact-action-button" onClick={onClose}>閉じる</button>
        </header>

        <div className="quick-record-body quick-record-desktop-grid">
          <QuickMeetingForm draft={draft} errors={errors} onChange={onChange} />
          <div className="quick-record-side">
            <QuickEventFields draft={draft} errors={errors} onChange={onChange} onToggle={onToggle} />
            <QuickTaskFields draft={draft} errors={errors} onChange={onChange} onToggle={onToggle} />
            <QuickRecordResult draft={draft} result={result} saving={saving} onRetry={onRetry} />
          </div>
        </div>

        <footer className="quick-record-footer">
          <span>商談記録は必須、予定とタスクは任意です。</span>
          <button type="submit" className="primary-button" disabled={saving || !draft.meeting.summary.trim()}>
            {saving ? '保存中...' : 'まとめて保存'}
          </button>
        </footer>
      </form>
    </div>
  );
}
