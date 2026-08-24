import { QUICK_RECORD_STATUS } from '../../services/customerQuickRecordService.js';

const LABELS = {
  meeting: '商談記録',
  event: '次回予定',
  task: 'タスク',
};

const STATUS_LABELS = {
  [QUICK_RECORD_STATUS.SUCCESS]: '成功',
  [QUICK_RECORD_STATUS.FAILED]: '失敗',
  [QUICK_RECORD_STATUS.SKIPPED]: '未作成',
  [QUICK_RECORD_STATUS.IDLE]: '未実行',
};

export default function QuickRecordResult({ draft, result, onRetry, saving }) {
  if (!result) return null;

  const rows = [
    ['meeting', true],
    ['event', draft.createEvent],
    ['task', draft.createTask],
  ].filter(([, enabled]) => enabled);

  if (rows.length === 0) return null;

  return (
    <section className="quick-record-result" aria-live="polite">
      <h3>保存結果</h3>
      {rows.map(([key]) => {
        const item = result[key] || {};
        const failed = item.status === QUICK_RECORD_STATUS.FAILED;
        return (
          <div className={`quick-record-result-row ${item.status || QUICK_RECORD_STATUS.IDLE}`} key={key}>
            <span>{LABELS[key]}</span>
            <strong>{STATUS_LABELS[item.status] || '未実行'}</strong>
            <small>{item.message}</small>
            {failed && (
              <button type="button" className="ghost-button compact-action-button" disabled={saving} onClick={() => onRetry(key)}>
                再試行
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
