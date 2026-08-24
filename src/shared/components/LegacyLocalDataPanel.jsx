import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  removeLegacyLocalDataGroups,
  summarizeLegacyLocalData,
} from '../services/legacyLocalDataService.js';

function previewValue(value) {
  const sample = Array.isArray(value) ? value.slice(0, 5) : value;
  return JSON.stringify(sample, null, 2);
}

function LegacyModal({ title, children, onClose }) {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="modal-backdrop legacy-local-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel legacy-local-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">旧データ</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            閉じる
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default function LegacyLocalDataPanel() {
  const [groups, setGroups] = useState([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [message, setMessage] = useState('');

  function refresh() {
    setGroups(summarizeLegacyLocalData());
  }

  useEffect(() => {
    refresh();
  }, []);

  const totalCount = useMemo(
    () => groups.reduce((sum, group) => sum + group.count, 0),
    [groups],
  );

  if (groups.length === 0) {
    return null;
  }

  function handleDelete() {
    const removedKeys = removeLegacyLocalDataGroups(groups);
    setIsConfirmingDelete(false);
    setMessage(`${removedKeys.length}個の旧データを削除しました。`);
    refresh();
  }

  return (
    <section className="legacy-local-data-panel" aria-label="旧業務データ警告">
      <div>
        <p className="eyebrow">旧ローカル業務データ</p>
        <h2>この端末に旧データがあります</h2>
        <p>
          自動移行・自動削除は行いません。必要に応じて内容を確認し、
          不要な場合だけ対象データを削除してください。
        </p>
      </div>
      <div className="legacy-local-summary">
        {groups.map((group) => (
          <span key={group.id}>{group.label}: 旧データ {group.count}件</span>
        ))}
        <strong>合計 {totalCount}件</strong>
      </div>
      <div className="legacy-local-actions">
        <button type="button" className="ghost-button" onClick={() => setIsPreviewOpen(true)}>
          内容を確認
        </button>
        <button type="button" className="danger-button" onClick={() => setIsConfirmingDelete(true)}>
          ローカルデータを削除
        </button>
      </div>
      {message && <p className="notice-text">{message}</p>}

      {isPreviewOpen && (
        <LegacyModal title="旧ローカルデータの内容確認" onClose={() => setIsPreviewOpen(false)}>
          <div className="legacy-local-preview-list">
            {groups.map((group) => (
              <section className="legacy-local-preview-card" key={group.id}>
                <h3>{group.label}</h3>
                <p className="notice-text">旧データ {group.count}件</p>
                {group.entries.map((entry) => (
                  <div className="legacy-local-key-preview" key={entry.key}>
                    <strong>{entry.key}</strong>
                    <span>{entry.count}件</span>
                    <pre>{previewValue(entry.value)}</pre>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </LegacyModal>
      )}

      {isConfirmingDelete && (
        <LegacyModal title="旧ローカルデータを削除" onClose={() => setIsConfirmingDelete(false)}>
          <p className="form-error-message">
            この操作は表示中の旧業務データだけを削除します。
            クラウド上のデータ、画面設定、商品/カレンダー/メールの個別移行対象データは削除しません。
          </p>
          <div className="legacy-local-delete-list">
            {groups.flatMap((group) =>
              group.entries.map((entry) => (
                <span key={`${group.id}-${entry.key}`}>{entry.key}</span>
              )),
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={() => setIsConfirmingDelete(false)}>
              キャンセル
            </button>
            <button type="button" className="danger-button" onClick={handleDelete}>
              対象データだけ削除
            </button>
          </div>
        </LegacyModal>
      )}
    </section>
  );
}
