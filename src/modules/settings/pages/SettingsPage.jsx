import { useRef, useState } from 'react';
import {
  countBackupRecords,
  createBackupPayload,
  downloadBackup,
  readBackupFile,
  restoreBackupPayload,
} from '../services/backupService.js';

export default function SettingsPage({
  user,
  userId,
  syncState,
  syncError,
  reloadFromCloud,
  signOut,
  backupDatasets,
  restoreHandlers,
  onResetTutorial,
}) {
  const fileInputRef = useRef(null);
  const [backupMessage, setBackupMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  function handleExport() {
    const payload = createBackupPayload({
      user,
      userId,
      datasets: backupDatasets,
    });

    downloadBackup(payload);
    setBackupMessage(`JSON Export completed. ${countBackupRecords(payload)} records included.`);
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsImporting(true);
    setBackupMessage('');

    try {
      const payload = await readBackupFile(file);
      const summary = restoreBackupPayload(payload, restoreHandlers);
      const importedCount = Object.values(summary).reduce(
        (total, item) => total + item.imported,
        0,
      );

      setBackupMessage(`JSON Import completed. ${importedCount} records restored.`);
    } catch (error) {
      setBackupMessage(`JSON Import failed. ${error.message}`);
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <p className="eyebrow">Settings</p>
        <h1>設定</h1>
        <p>ログイン情報、保存先、バックアップ、初回チュートリアルを管理します。</p>
      </div>

      <section className={`sync-status-card ${syncState === 'supabase' ? 'cloud' : 'local'}`}>
        <div>
          <span>ログイン中</span>
          <strong>{user?.email}</strong>
        </div>
        <div>
          <span>保存先</span>
          <strong>{syncState === 'supabase' ? 'Supabase' : syncState === 'syncing' ? '同期中...' : 'LocalStorage'}</strong>
        </div>
        <button type="button" className="ghost-button" onClick={reloadFromCloud} disabled={syncState === 'syncing'}>
          クラウドから再読み込み
        </button>
        {syncError && <p>{syncError}</p>}
        <button type="button" className="text-button danger" onClick={signOut}>
          ログアウト
        </button>
      </section>

      <section className="sync-status-card">
        <div>
          <span>バックアップ</span>
          <strong>JSON Export / Import</strong>
        </div>
        <p>Storageのファイル本体は含めず、URLとメタ情報のみ保存します。</p>
        <div className="table-actions">
          <button type="button" className="primary-button" onClick={handleExport}>
            JSON Export
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            JSON Import
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="backup-file-input"
          onChange={handleImport}
        />
        {backupMessage && <p>{backupMessage}</p>}
      </section>

      <section className="sync-status-card">
        <div>
          <span>チュートリアル</span>
          <strong>初回ガイド</strong>
        </div>
        <p>顧客登録、担当者登録、商品登録、在庫登録、商談登録、見積作成の流れをもう一度表示します。</p>
        <button type="button" className="ghost-button" onClick={onResetTutorial}>
          チュートリアルを再表示
        </button>
      </section>
    </section>
  );
}
