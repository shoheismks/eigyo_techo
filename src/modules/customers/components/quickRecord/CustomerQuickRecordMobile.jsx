import QuickEventFields from './QuickEventFields.jsx';
import QuickMeetingForm from './QuickMeetingForm.jsx';
import QuickRecordResult from './QuickRecordResult.jsx';
import QuickTaskFields from './QuickTaskFields.jsx';

export default function CustomerQuickRecordMobile({
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
    <div className="quick-record-modal quick-record-mobile-modal" role="dialog" aria-modal="true" aria-label="商談直後クイック記録">
      <form className="quick-record-dialog quick-record-dialog-mobile" onSubmit={onSave}>
        <header className="quick-record-header">
          <div>
            <p className="eyebrow">商談を記録</p>
            <h2>{customer.companyName || '顧客'}</h2>
          </div>
          <button type="button" className="ghost-button compact-action-button" onClick={onClose}>閉じる</button>
        </header>

        <div className="quick-record-body">
          <QuickMeetingForm draft={draft} errors={errors} onChange={onChange} />
          <QuickEventFields draft={draft} errors={errors} onChange={onChange} onToggle={onToggle} />
          <QuickTaskFields draft={draft} errors={errors} onChange={onChange} onToggle={onToggle} />
          <QuickRecordResult draft={draft} result={result} saving={saving} onRetry={onRetry} />
        </div>

        <footer className="quick-record-footer">
          <button type="submit" className="primary-button" disabled={saving || !draft.meeting.summary.trim()}>
            {saving ? '保存中...' : 'まとめて保存'}
          </button>
        </footer>
      </form>
    </div>
  );
}
