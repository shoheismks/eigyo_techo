import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  buildCalendarLegacyMigrationPreview,
  deleteCalendarLegacyLocalData,
  hasCalendarLegacyLocalData,
  migrateCalendarLegacyLocalData,
} from '../services/calendarLocalMigrationService.js';

const ACTIONS = [
  { value: 'skip', label: 'スキップ' },
  { value: 'create', label: '新規として追加' },
  { value: 'update', label: '既存を更新' },
];

function countByStatus(records = []) {
  return records.reduce((counts, record) => {
    counts[record.status] = (counts[record.status] || 0) + 1;
    return counts;
  }, {});
}

function resultSummary(results) {
  const all = [...(results?.events || []), ...(results?.tasks || [])];
  const counts = countByStatus(all);
  return `成功 ${counts.success || 0} / スキップ ${counts.skipped || 0} / 失敗 ${counts.failed || 0} / 警告 ${counts.warning || 0}`;
}

function hasParseErrors(errors = {}) {
  return Object.values(errors).some(Boolean);
}

function ResultGroup({ title, records = [] }) {
  const counts = countByStatus(records);
  return (
    <section className="customer-editor-section">
      <h3>{title}</h3>
      <p className="notice-text">
        成功 {counts.success || 0} / スキップ {counts.skipped || 0} / 失敗 {counts.failed || 0} / 警告 {counts.warning || 0}
      </p>
      {records.length > 0 ? records.map((record, index) => (
        <p key={`${record.type}-${record.name}-${index}`} className={record.status === 'failed' ? 'form-error-message' : 'notice-text'}>
          {record.type}: {record.name} / {record.status} / {record.detail}
        </p>
      )) : (
        <p className="notice-text">対象なし</p>
      )}
    </section>
  );
}

function ConflictSelector({ conflict, value, onChange }) {
  return (
    <label className="field-label">
      {conflict.localName}
      <small>
        Supabase: {conflict.remoteName} / 判定: {conflict.reasons.join(', ')}
      </small>
      <select value={value || 'skip'} onChange={(event) => onChange(conflict.localId, event.target.value)}>
        {ACTIONS.map((action) => (
          <option key={action.value} value={action.value}>{action.label}</option>
        ))}
      </select>
    </label>
  );
}

export default function CalendarLocalMigrationPanel({
  userId,
  reloadEvents,
  reloadTasks,
}) {
  const [isVisible, setIsVisible] = useState(() => hasCalendarLegacyLocalData());
  const [preview, setPreview] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [conflictActions, setConflictActions] = useState({});

  const counts = preview?.counts ?? {
    localEvents: 0,
    localTasks: 0,
    remoteEvents: 0,
    remoteTasks: 0,
    duplicateEvents: 0,
    duplicateTasks: 0,
    relationWarnings: 0,
  };

  const canMigrate = useMemo(
    () => Boolean(preview) && !hasParseErrors(preview.errors) && !isMigrating,
    [isMigrating, preview],
  );

  if (!isVisible) {
    return null;
  }

  async function openPreview() {
    setIsPreviewOpen(true);
    setMessage('');
    setError('');
    setResults(null);
    setIsLoadingPreview(true);

    try {
      const nextPreview = await buildCalendarLegacyMigrationPreview(userId);
      const nextActions = {};
      [...nextPreview.eventConflicts, ...nextPreview.taskConflicts].forEach((conflict) => {
        nextActions[conflict.localId] = conflict.action || 'skip';
      });
      setPreview(nextPreview);
      setConflictActions(nextActions);
    } catch (err) {
      setError(err.message || '移行前確認に失敗しました。');
    } finally {
      setIsLoadingPreview(false);
    }
  }

  async function runMigration() {
    if (!preview) {
      await openPreview();
      return;
    }

    setIsMigrating(true);
    setMessage('');
    setError('');

    try {
      const nextResults = await migrateCalendarLegacyLocalData({
        userId,
        preview,
        conflictActions,
      });
      setResults(nextResults);
      setMessage(`移行が完了しました。${resultSummary(nextResults)}。LocalStorageは削除していません。`);
      await Promise.all([reloadEvents?.(), reloadTasks?.()]);
      setPreview(await buildCalendarLegacyMigrationPreview(userId));
    } catch (err) {
      setError(err.message || '移行に失敗しました。LocalStorageは削除していません。');
    } finally {
      setIsMigrating(false);
    }
  }

  function updateConflictAction(localId, action) {
    setConflictActions((current) => ({ ...current, [localId]: action }));
  }

  function deleteLocalData() {
    deleteCalendarLegacyLocalData();
    setPreview(null);
    setResults(null);
    setIsPreviewOpen(false);
    setIsConfirmingDelete(false);
    setIsVisible(false);
  }

  const previewModal = isPreviewOpen && typeof document !== 'undefined'
    ? createPortal(
        <div className="modal-backdrop" role="presentation" onClick={() => setIsPreviewOpen(false)}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-label="旧カレンダーデータ移行確認" onClick={(event) => event.stopPropagation()}>
            <div className="customer-editor-header">
              <div>
                <p className="eyebrow">Calendar Migration</p>
                <h2>旧予定・タスクデータの移行確認</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setIsPreviewOpen(false)}>
                閉じる
              </button>
            </div>

            {isLoadingPreview ? (
              <p className="notice-text">LocalStorageとSupabaseの件数を確認しています...</p>
            ) : (
              <>
                <div className="kpi-card-row">
                  <article className="kpi-card">
                    <span>LocalStorage</span>
                    <strong>旧予定 {counts.localEvents}件</strong>
                    <small>旧タスク {counts.localTasks}件</small>
                  </article>
                  <article className="kpi-card">
                    <span>Supabase</span>
                    <strong>予定 {counts.remoteEvents}件</strong>
                    <small>タスク {counts.remoteTasks}件</small>
                  </article>
                  <article className="kpi-card">
                    <span>確認事項</span>
                    <strong>重複 {counts.duplicateEvents + counts.duplicateTasks}件</strong>
                    <small>関連ID不整合 {counts.relationWarnings}件</small>
                  </article>
                </div>

                {hasParseErrors(preview?.errors) && (
                  <div className="form-error-message">
                    {preview.errors.events && <p>予定: {preview.errors.events}</p>}
                    {preview.errors.tasks && <p>タスク: {preview.errors.tasks}</p>}
                  </div>
                )}

                {preview?.relationWarnings?.length > 0 && (
                  <ResultGroup title="関連ID不整合・警告" records={preview.relationWarnings} />
                )}

                {(preview?.eventConflicts?.length > 0 || preview?.taskConflicts?.length > 0) ? (
                  <section className="customer-editor-section">
                    <h3>重複候補</h3>
                    {preview.eventConflicts.map((conflict) => (
                      <ConflictSelector
                        key={`event-${conflict.localId}`}
                        conflict={conflict}
                        value={conflictActions[conflict.localId]}
                        onChange={updateConflictAction}
                      />
                    ))}
                    {preview.taskConflicts.map((conflict) => (
                      <ConflictSelector
                        key={`task-${conflict.localId}`}
                        conflict={conflict}
                        value={conflictActions[conflict.localId]}
                        onChange={updateConflictAction}
                      />
                    ))}
                  </section>
                ) : (
                  <p className="notice-text">重複候補はありません。</p>
                )}

                {results && (
                  <section className="customer-editor-section">
                    <h3>移行結果</h3>
                    <p className="notice-text">{resultSummary(results)}</p>
                    <ResultGroup title="予定" records={results.events} />
                    <ResultGroup title="タスク" records={results.tasks} />
                  </section>
                )}

                <div className="customer-editor-actions">
                  <button type="button" className="ghost-button" onClick={() => setIsPreviewOpen(false)}>
                    キャンセル
                  </button>
                  <button type="button" className="primary-button compact-button" disabled={!canMigrate} onClick={runMigration}>
                    {isMigrating ? '移行中...' : '移行する'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  const deleteModal = isConfirmingDelete && typeof document !== 'undefined'
    ? createPortal(
        <div className="modal-backdrop" role="presentation" onClick={() => setIsConfirmingDelete(false)}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-label="旧ローカル予定タスクデータ削除" onClick={(event) => event.stopPropagation()}>
            <div className="customer-editor-header">
              <div>
                <p className="eyebrow">LocalStorage</p>
                <h2>旧予定・タスクのローカルデータを削除しますか？</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setIsConfirmingDelete(false)}>
                閉じる
              </button>
            </div>
            <p className="form-error-message">
              この操作は端末内の `eigyo-techo-events` と `eigyo-techo-tasks` だけを削除します。Supabaseのデータは削除しません。
            </p>
            <div className="customer-editor-actions">
              <button type="button" className="ghost-button" onClick={() => setIsConfirmingDelete(false)}>
                キャンセル
              </button>
              <button type="button" className="ghost-button danger" onClick={deleteLocalData}>
                確認してローカルデータを削除
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <section className="search-panel calendar-local-migration-panel" aria-label="旧予定タスクLocalStorageデータ移行">
      <div className="section-heading">
        <div>
          <h2>旧ローカル予定・タスクデータがあります</h2>
          <p className="notice-text">
            自動移行・自動削除は行いません。内容を確認し、必要なものだけSupabaseへ移行できます。
          </p>
        </div>
      </div>

      <div className="customer-editor-actions">
        <button type="button" className="ghost-button" onClick={openPreview}>
          内容を確認
        </button>
        <button type="button" className="primary-button compact-button" onClick={openPreview}>
          Supabaseへ移行
        </button>
        <button type="button" className="ghost-button danger" onClick={() => setIsConfirmingDelete(true)}>
          ローカルデータを削除
        </button>
      </div>

      {message && <p className="notice-text">{message}</p>}
      {error && <p className="form-error-message">{error}</p>}
      {previewModal}
      {deleteModal}
    </section>
  );
}
