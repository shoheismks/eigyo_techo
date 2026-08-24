import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  buildProductLegacyMigrationPreview,
  deleteProductLegacyLocalData,
  hasProductLegacyLocalData,
  migrateProductLegacyLocalData,
} from '../services/productLocalMigrationService.js';

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
  const all = [
    ...(results?.brands || []),
    ...(results?.products || []),
    ...(results?.productAssets || []),
  ];
  const counts = countByStatus(all);
  return `成功 ${counts.success || 0} / スキップ ${counts.skipped || 0} / 失敗 ${counts.failed || 0} / 警告 ${counts.warning || 0}`;
}

function hasParseErrors(errors = {}) {
  return Object.values(errors).some(Boolean);
}

function resultClassName(status) {
  return status === 'failed' ? 'form-error-message' : 'notice-text';
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
        <p key={`${record.type}-${record.name}-${index}`} className={resultClassName(record.status)}>
          {record.type}: {record.name} / {record.status} / {record.detail}
        </p>
      )) : (
        <p className="notice-text">対象なし</p>
      )}
    </section>
  );
}

export default function ProductLocalMigrationPanel({
  userId,
  products = [],
  brands = [],
  productAssets = [],
  reloadProducts,
  reloadBrands,
  reloadProductAssets,
}) {
  const [isVisible, setIsVisible] = useState(() => hasProductLegacyLocalData());
  const [preview, setPreview] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [conflictActions, setConflictActions] = useState({});

  const localCounts = preview?.counts ?? {
    localProducts: 0,
    localBrands: 0,
    localProductAssets: 0,
    remoteProducts: products.length,
    remoteBrands: brands.length,
    remoteProductAssets: productAssets.length,
    duplicateProducts: 0,
    duplicateBrands: 0,
    duplicateProductAssets: 0,
    storageMissingProductAssets: 0,
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
      const nextPreview = await buildProductLegacyMigrationPreview(userId);
      const nextActions = {};
      nextPreview.productConflicts.forEach((conflict) => {
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
      const nextResults = await migrateProductLegacyLocalData({
        userId,
        preview,
        conflictActions,
      });
      setResults(nextResults);
      setMessage(`移行が完了しました。${resultSummary(nextResults)}。端末内の旧データは削除していません。`);
      await Promise.all([
        reloadProducts?.(),
        reloadBrands?.(),
        reloadProductAssets?.(),
      ]);
      setPreview(await buildProductLegacyMigrationPreview(userId));
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
    deleteProductLegacyLocalData();
    setPreview(null);
    setResults(null);
    setIsPreviewOpen(false);
    setIsConfirmingDelete(false);
    setIsVisible(false);
  }

  const previewModal = isPreviewOpen && typeof document !== 'undefined'
    ? createPortal(
        <div className="modal-backdrop" role="presentation" onClick={() => setIsPreviewOpen(false)}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-label="旧商品データ移行確認" onClick={(event) => event.stopPropagation()}>
            <div className="customer-editor-header">
              <div>
                <p className="eyebrow">商品データ移行</p>
                <h2>旧商品データの移行確認</h2>
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
                    <strong>{localCounts.localProducts} 商品</strong>
                    <small>ブランド {localCounts.localBrands} / アセット {localCounts.localProductAssets}</small>
                  </article>
                  <article className="kpi-card">
                    <span>クラウド側</span>
                    <strong>{localCounts.remoteProducts} 商品</strong>
                    <small>ブランド {localCounts.remoteBrands} / アセット {localCounts.remoteProductAssets}</small>
                  </article>
                  <article className="kpi-card">
                    <span>重複候補</span>
                    <strong>{localCounts.duplicateProducts} 商品</strong>
                    <small>ブランド {localCounts.duplicateBrands} / アセット {localCounts.duplicateProductAssets}</small>
                  </article>
                </div>

                {localCounts.storageMissingProductAssets > 0 && (
                  <section className="customer-editor-section">
                    <h3>添付ファイル本体なし：移行対象外</h3>
                    <p className="notice-text">{localCounts.storageMissingProductAssets}件の旧添付ファイルは保存先情報がないため移行しません。</p>
                    {(preview?.storageMissingProductAssets || []).map((asset) => (
                      <p className="notice-text" key={asset.id}>
                        {asset.fileName} / {asset.reason}
                      </p>
                    ))}
                  </section>
                )}

                {hasParseErrors(preview?.errors) && (
                  <div className="form-error-message">
                    {preview.errors.products && <p>商品: {preview.errors.products}</p>}
                    {preview.errors.brands && <p>ブランド: {preview.errors.brands}</p>}
                    {preview.errors.productAssets && <p>商品アセット: {preview.errors.productAssets}</p>}
                  </div>
                )}

                {preview?.productConflicts?.length > 0 ? (
                  <section className="customer-editor-section">
                    <h3>商品重複候補</h3>
                    {preview.productConflicts.map((conflict) => (
                      <label className="field-label" key={conflict.localId}>
                        {conflict.localName}
                        <small>
                          端末内: {conflict.localCode || '-'} / クラウド側: {conflict.remoteName} {conflict.remoteCode || '-'} / 判定: {conflict.reasons.join(', ')}
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
                  <p className="notice-text">商品重複候補はありません。</p>
                )}

                {results && (
                  <section className="customer-editor-section">
                    <h3>移行結果</h3>
                    <p className="notice-text">{resultSummary(results)}</p>
                    <ResultGroup title="ブランド" records={results.brands} />
                    <ResultGroup title="商品" records={results.products} />
                    <ResultGroup title="商品添付" records={results.productAssets} />
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
          <div className="modal-panel" role="dialog" aria-modal="true" aria-label="旧ローカル商品データ削除" onClick={(event) => event.stopPropagation()}>
            <div className="customer-editor-header">
              <div>
                <p className="eyebrow">端末内の旧データ</p>
                <h2>ローカルデータを削除しますか？</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setIsConfirmingDelete(false)}>
                閉じる
              </button>
            </div>
            <p className="form-error-message">
              この操作は端末内の旧商品データだけを削除します。クラウド上の商品データは削除しません。
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
    <section className="search-panel" aria-label="旧商品データ移行">
      <div className="section-heading">
        <div>
          <h2>旧ローカル商品データがあります</h2>
          <p className="notice-text">
            自動移行・自動削除は行いません。内容を確認し、必要なものだけクラウドへ移行できます。
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
