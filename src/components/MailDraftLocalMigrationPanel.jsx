import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  buildMailDraftLegacyMigrationPreview,
  deleteMailDraftLegacyLocalData,
  hasLegacyMailDrafts,
  migrateMailDraftLegacyLocalData,
} from '../services/mailDraftSyncService.js';

const CONFLICT_ACTIONS = [
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
  const counts = countByStatus(results?.drafts || []);
  return `成功 ${counts.success || 0} / スキップ ${counts.skipped || 0} / 失敗 ${counts.failed || 0} / 警告 ${counts.warning || 0}`;
}

function hasParseErrors(errors = {}) {
  return Object.values(errors).some(Boolean);
}

function ResultGroup({ records = [] }) {
  const counts = countByStatus(records);

  return (
    <section className="customer-editor-section">
      <h3>移行結果</h3>
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

export default function MailDraftLocalMigrationPanel({
  userId,
  reloadDrafts,
}) {
  const [isVisible, setIsVisible] = useState(() => hasLegacyMailDrafts(userId));
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
    localDrafts: 0,
    remoteDrafts: 0,
    duplicateDrafts: 0,
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
      const nextPreview = await buildMailDraftLegacyMigrationPreview(userId);
      const nextActions = {};
      nextPreview.conflicts.forEach((conflict) => {
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
      const nextResults = await migrateMailDraftLegacyLocalData({
        userId,
        preview,
        conflictActions,
      });
      setResults(nextResults);
      setMessage(`移行が完了しました。${resultSummary(nextResults)}。端末内の旧データは削除していません。`);
      await reloadDrafts?.();
      setPreview(await buildMailDraftLegacyMigrationPreview(userId));
    } catch (err) {
      setError(err.message || '移行に失敗しました。端末内の旧データは削除していません。');
    } finally {
      setIsMigrating(false);
    }
  }

  function updateConflictAction(localId, action) {
    setConflictActions((current) => ({ ...current, [localId]: action }));
  }

  function deleteLocalData() {
    deleteMailDraftLegacyLocalData();
    setPreview(null);
    setResults(null);
    setIsPreviewOpen(false);
    setIsConfirmingDelete(false);
    setIsVisible(false);
  }

  const previewModal = isPreviewOpen && typeof document !== 'undefined'
    ? createPortal(
        <div className="modal-backdrop" role="presentation" onClick={() => setIsPreviewOpen(false)}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-label="旧メール下書きデータ移行確認" onClick={(event) => event.stopPropagation()}>
            <div className="customer-editor-header">
              <div>
                <p className="eyebrow">メール下書き移行</p>
                <h2>旧メール下書きデータの移行確認</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setIsPreviewOpen(false)}>
                閉じる
              </button>
            </div>

            {isLoadingPreview ? (
              <p className="notice-text">端末内の旧データとクラウド側の件数を確認しています...</p>
            ) : (
              <>
                <div className="kpi-card-row">
                  <article className="kpi-card">
                    <span>端末内の旧データ</span>
                    <strong>{counts.localDrafts}件</strong>
                    <small>旧メール下書き</small>
                  </article>
                  <article className="kpi-card">
                    <span>クラウド側</span>
                    <strong>{counts.remoteDrafts}件</strong>
                    <small>現在のメール下書き</small>
                  </article>
                  <article className="kpi-card">
                    <span>確認事項</span>
                    <strong>重複 {counts.duplicateDrafts}件</strong>
                    <small>既定ではスキップ</small>
                  </article>
                </div>

                {hasParseErrors(preview?.errors) && (
                  <div className="form-error-message">
                    {preview.errors.drafts && <p>メール下書き: {preview.errors.drafts}</p>}
                  </div>
                )}

                {preview?.conflicts?.length > 0 ? (
                  <section className="customer-editor-section">
                    <h3>重複候補</h3>
                    {preview.conflicts.map((conflict) => (
                      <label className="field-label" key={conflict.localId}>
                        {conflict.localName}
                        <small>
                          クラウド側: {conflict.remoteName} / 判定: {conflict.reasons.join(', ')}
                        </small>
                        <select
                          value={conflictActions[conflict.localId] || 'skip'}
                          onChange={(event) => updateConflictAction(conflict.localId, event.target.value)}
                        >
                          {CONFLICT_ACTIONS.map((action) => (
                            <option key={action.value} value={action.value}>{action.label}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </section>
                ) : (
                  <p className="notice-text">重複候補はありません。</p>
                )}

                {results && <ResultGroup records={results.drafts} />}

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
          <div className="modal-panel" role="dialog" aria-modal="true" aria-label="旧メール下書きローカルデータ削除" onClick={(event) => event.stopPropagation()}>
            <div className="customer-editor-header">
              <div>
                <p className="eyebrow">端末内の旧データ</p>
                <h2>旧メール下書きのローカルデータを削除しますか？</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setIsConfirmingDelete(false)}>
                閉じる
              </button>
            </div>
            <p className="form-error-message">
              この操作は端末内の旧メール下書きだけを削除します。クラウド上のメール下書きは削除しません。
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
    <section className="search-panel" aria-label="旧メール下書きデータ移行">
      <div className="section-heading">
        <div>
          <h2>旧ローカルメール下書きデータがあります</h2>
          <p className="notice-text">
            自動移行・自動削除は行いません。内容を確認し、必要な下書きだけクラウドへ移行できます。
          </p>
        </div>
      </div>

      <div className="customer-editor-actions">
        <button type="button" className="ghost-button" onClick={openPreview}>
          内容を確認
        </button>
        <button type="button" className="primary-button compact-button" onClick={openPreview}>
          クラウドへ移行
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
