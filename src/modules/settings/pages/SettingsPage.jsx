import { useRef, useState } from 'react';
import {
  countBackupRecords,
  createBackupPayload,
  downloadBackup,
  readBackupFile,
  restoreBackupPayload,
} from '../services/backupService.js';
import { uploadAttachment } from '../../../shared/services/storageService.js';
import { PDF_TEMPLATE_OPTIONS, emptyIssuer } from '../hooks/useIssuers.js';

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
  issuers = [],
  addIssuer,
  updateIssuer,
}) {
  const fileInputRef = useRef(null);
  const [backupMessage, setBackupMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [issuerForm, setIssuerForm] = useState(emptyIssuer);
  const [issuerMessage, setIssuerMessage] = useState('');
  const [issuerSaving, setIssuerSaving] = useState(false);

  function updateIssuerForm(field, value) {
    setIssuerForm((current) => ({ ...current, [field]: value }));
  }

  function editIssuer(issuer) {
    setIssuerForm({ ...emptyIssuer, ...issuer, logoFile: null, sealFile: null });
    setIssuerMessage('');
  }

  function resetIssuerForm() {
    setIssuerForm(emptyIssuer);
    setIssuerMessage('');
  }

  async function handleSaveIssuer(event) {
    event.preventDefault();
    if (!issuerForm.name.trim()) {
      setIssuerMessage('発行元の会社名を入力してください。');
      return;
    }

    setIssuerSaving(true);
    setIssuerMessage('');
    try {
      const id = issuerForm.id || crypto.randomUUID();
      let logoMeta = {};
      let sealMeta = {};

      if (issuerForm.logoFile) {
        const uploadedLogo = await uploadAttachment({
          file: issuerForm.logoFile,
          userId,
          ownerType: 'issuer',
          ownerId: id,
          field: 'logo',
        });
        logoMeta = {
          logoUrl: uploadedLogo?.url || uploadedLogo?.publicUrl || '',
          logoFileName: uploadedLogo?.name || issuerForm.logoFile.name,
          logoStoragePath: uploadedLogo?.path || '',
        };
      }

      if (issuerForm.sealFile) {
        const uploadedSeal = await uploadAttachment({
          file: issuerForm.sealFile,
          userId,
          ownerType: 'issuer',
          ownerId: id,
          field: 'seal',
        });
        sealMeta = {
          sealUrl: uploadedSeal?.url || uploadedSeal?.publicUrl || '',
          sealFileName: uploadedSeal?.name || issuerForm.sealFile.name,
          sealStoragePath: uploadedSeal?.path || '',
        };
      }

      const payload = {
        ...issuerForm,
        id,
        userId,
        ...logoMeta,
        ...sealMeta,
      };
      delete payload.logoFile;
      delete payload.sealFile;

      if (payload.isDefault) {
        issuers
          .filter((issuer) => issuer.id !== id && issuer.isDefault)
          .forEach((issuer) => updateIssuer?.(issuer.id, { isDefault: false }));
      }

      if (issuers.some((issuer) => issuer.id === id)) {
        updateIssuer?.(id, payload);
      } else {
        addIssuer?.(payload);
      }

      setIssuerMessage('発行元を保存しました。');
      resetIssuerForm();
    } catch (error) {
      setIssuerMessage(error.message || '発行元の保存に失敗しました。');
    } finally {
      setIssuerSaving(false);
    }
  }

  function duplicateIssuer(issuer) {
    addIssuer?.({
      ...issuer,
      id: crypto.randomUUID(),
      name: `${issuer.name || '発行元'} copy`,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIssuerMessage('発行元を複製しました。');
  }

  function disableIssuer(issuer) {
    updateIssuer?.(issuer.id, { isActive: false, isDefault: false });
    setIssuerMessage('発行元を無効化しました。');
  }

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
          <span>見積発行元</span>
          <strong>Issuer Master</strong>
        </div>
        <p>複数の所属会社・事業体を登録し、見積ごとに発行元とPDFテンプレートを切り替えます。</p>
        <form className="sample-form" onSubmit={handleSaveIssuer}>
          <div className="date-grid">
            <label className="field-label">会社名<input value={issuerForm.name || ''} onChange={(event) => updateIssuerForm('name', event.target.value)} /></label>
            <label className="field-label">正式社名<input value={issuerForm.legalName || ''} onChange={(event) => updateIssuerForm('legalName', event.target.value)} /></label>
            <label className="field-label">住所<input value={issuerForm.address || ''} onChange={(event) => updateIssuerForm('address', event.target.value)} /></label>
            <label className="field-label">電話<input value={issuerForm.phone || ''} onChange={(event) => updateIssuerForm('phone', event.target.value)} /></label>
            <label className="field-label">メール<input value={issuerForm.email || ''} onChange={(event) => updateIssuerForm('email', event.target.value)} /></label>
            <label className="field-label">登録番号<input value={issuerForm.registrationNumber || ''} onChange={(event) => updateIssuerForm('registrationNumber', event.target.value)} /></label>
            <label className="field-label">担当者<input value={issuerForm.contactPerson || ''} onChange={(event) => updateIssuerForm('contactPerson', event.target.value)} /></label>
            <label className="field-label">既定税率<input inputMode="decimal" value={issuerForm.defaultTaxRate || ''} onChange={(event) => updateIssuerForm('defaultTaxRate', event.target.value)} /></label>
            <label className="field-label">既定PDFテンプレート<select value={issuerForm.defaultPdfTemplate || 'standard'} onChange={(event) => updateIssuerForm('defaultPdfTemplate', event.target.value)}>{PDF_TEMPLATE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
          </div>
          <label className="field-label">振込先<textarea value={issuerForm.bankAccount || ''} onChange={(event) => updateIssuerForm('bankAccount', event.target.value)} /></label>
          <label className="field-label">既定支払条件<input value={issuerForm.defaultPaymentTerms || ''} onChange={(event) => updateIssuerForm('defaultPaymentTerms', event.target.value)} /></label>
          <label className="field-label">既定納品条件<input value={issuerForm.defaultDeliveryTerms || ''} onChange={(event) => updateIssuerForm('defaultDeliveryTerms', event.target.value)} /></label>
          <label className="field-label">既定備考<textarea value={issuerForm.defaultRemarks || ''} onChange={(event) => updateIssuerForm('defaultRemarks', event.target.value)} /></label>
          <div className="date-grid">
            <label className="field-label file-field">ロゴ<input type="file" accept="image/*" onChange={(event) => updateIssuerForm('logoFile', event.target.files?.[0] ?? null)} /></label>
            <label className="field-label file-field">印影<input type="file" accept="image/*" onChange={(event) => updateIssuerForm('sealFile', event.target.files?.[0] ?? null)} /></label>
          </div>
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(issuerForm.isDefault)} onChange={(event) => updateIssuerForm('isDefault', event.target.checked)} /> 既定発行元にする</label>
          <label className="checkbox-row"><input type="checkbox" checked={issuerForm.isActive !== false} onChange={(event) => updateIssuerForm('isActive', event.target.checked)} /> 有効</label>
          <div className="table-actions">
            <button className="primary-button" type="submit" disabled={issuerSaving}>{issuerSaving ? '保存中...' : issuerForm.id ? '発行元を更新' : '発行元を追加'}</button>
            <button className="ghost-button" type="button" onClick={resetIssuerForm}>新規入力</button>
          </div>
          {issuerMessage && <p>{issuerMessage}</p>}
        </form>
        <div className="karte-card-list">
          {issuers.length > 0 ? issuers.map((issuer) => (
            <article className={`karte-mini-card ${issuer.isActive === false ? 'muted-card' : ''}`} key={issuer.id}>
              <h3>{issuer.name || issuer.legalName || '名称未設定'}</h3>
              <p>{issuer.address || '-'}</p>
              <p>{[issuer.phone, issuer.email].filter(Boolean).join(' / ') || '-'}</p>
              <div className="lead-badges">
                {issuer.isDefault && <span className="info-badge ready">既定</span>}
                <span className="info-badge">{issuer.isActive === false ? '無効' : '有効'}</span>
                <span className="info-badge">税率 {issuer.defaultTaxRate || '10'}%</span>
              </div>
              <div className="card-actions">
                <button className="ghost-button" type="button" onClick={() => editIssuer(issuer)}>編集</button>
                <button className="ghost-button" type="button" onClick={() => duplicateIssuer(issuer)}>複製</button>
                {issuer.isActive !== false && <button className="ghost-button danger" type="button" onClick={() => disableIssuer(issuer)}>無効化</button>}
              </div>
            </article>
          )) : <p>発行元が未登録です。最初の1件を登録すると見積作成時の既定発行元になります。</p>}
        </div>
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
