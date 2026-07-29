import { useRef, useState } from 'react';
import {
  countBackupRecords,
  createBackupPayload,
  downloadBackup,
  readBackupFile,
  restoreBackupPayload,
} from '../services/backupService.js';
import { uploadAttachment } from '../../../shared/services/storageService.js';
import { DEFAULT_ISSUER_TAX_RATE, PDF_TEMPLATE_OPTIONS, emptyIssuer } from '../hooks/useIssuers.js';
import { DEFAULT_THEME_COLOR, isValidThemeColor, sanitizeThemeColor } from '../../../shared/utils/themeColor.js';
import { TERMS_FIELDS } from '../../quotes/services/termsTemplateService.js';
import './SettingsPage.css';

const SETTINGS_CATEGORIES = [
  { id: 'basic', label: '基本設定', description: 'ログイン状態、保存先、同期状態を確認します。' },
  { id: 'company', label: '会社情報', description: '発行元会社の基本情報を管理します。' },
  { id: 'users', label: 'ユーザー／権限', description: '現在のユーザー情報とログアウトを管理します。' },
  { id: 'sales', label: '営業設定', description: '見積や営業帳票の既定条件を管理します。' },
  { id: 'products', label: '商品／価格設定', description: '商品、価格、税率に関する設定を確認します。' },
  { id: 'inventory', label: '在庫／物流設定', description: '在庫、出荷、納品に関する設定を確認します。' },
  { id: 'documents', label: '帳票設定', description: '見積書、成約確認書、請求書の発行元と約款を管理します。' },
  { id: 'data', label: 'データ管理', description: 'Backup、Restore、インポート、エクスポートを実行します。' },
  { id: 'integrations', label: '連携設定', description: 'Supabaseなど外部連携の状態を確認します。' },
];

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
  const [activeCategory, setActiveCategory] = useState('basic');

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
        themeColor: issuerForm.themeColor ? sanitizeThemeColor(issuerForm.themeColor) : '',
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

  const activeCategoryMeta = SETTINGS_CATEGORIES.find((category) => category.id === activeCategory) ?? SETTINGS_CATEGORIES[0];

  return (
    <section className="page settings-page-v2">
      <div className="page-header settings-page-header">
        <p className="eyebrow">Settings</p>
        <div>
          <h1>設定</h1>
          <p>営業手帳の基本設定、発行元、帳票、データ管理をカテゴリごとに整理します。</p>
        </div>
      </div>

      <div className="settings-mobile-category">
        <label className="field-label">
          設定カテゴリ
          <select value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)}>
            {SETTINGS_CATEGORIES.map((category) => (
              <option value={category.id} key={category.id}>{category.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="settings-shell">
        <aside className="settings-category-menu" aria-label="設定カテゴリ">
          {SETTINGS_CATEGORIES.map((category) => (
            <button
              type="button"
              key={category.id}
              className={activeCategory === category.id ? 'active' : ''}
              onClick={() => setActiveCategory(category.id)}
            >
              <strong>{category.label}</strong>
              <span>{category.description}</span>
            </button>
          ))}
        </aside>

        <main className="settings-content-panel">
          <div className="settings-content-header">
            <div>
              <span>SETTINGS</span>
              <h2>{activeCategoryMeta.label}</h2>
              <p>{activeCategoryMeta.description}</p>
            </div>
            {activeCategory === 'documents' && (
              <button className="primary-button" type="button" onClick={resetIssuerForm}>＋ 発行元追加</button>
            )}
          </div>

          {activeCategory === 'basic' && (
            <div className="settings-card-grid">
              <article className={['settings-card', syncState === 'supabase' ? 'cloud' : 'local'].join(' ')}>
                <header>
                  <h3>保存先と同期</h3>
                  <p>現在の保存先とクラウド同期状態を確認できます。</p>
                </header>
                <dl className="settings-definition-list">
                  <div><dt>保存先</dt><dd>{syncState === 'supabase' ? 'Supabase' : syncState === 'syncing' ? '同期中...' : 'LocalStorage'}</dd></div>
                  <div><dt>ログイン</dt><dd>{user?.email || '-'}</dd></div>
                  {syncError && <div><dt>警告</dt><dd>{syncError}</dd></div>}
                </dl>
                <footer>
                  <button type="button" className="ghost-button" onClick={reloadFromCloud} disabled={syncState === 'syncing'}>
                    クラウドから再読み込み
                  </button>
                </footer>
              </article>

              <article className="settings-card">
                <header>
                  <h3>初回チュートリアル</h3>
                  <p>操作ガイドをもう一度表示します。</p>
                </header>
                <footer>
                  <button type="button" className="ghost-button" onClick={onResetTutorial}>チュートリアルを再表示</button>
                </footer>
              </article>
            </div>
          )}

          {activeCategory === 'company' && (
            <div className="settings-card-grid">
              <article className="settings-card wide-card">
                <header>
                  <h3>登録済み発行元</h3>
                  <p>会社情報は帳票の発行元として利用されます。編集する発行元を選択してください。</p>
                </header>
                <div className="issuer-picker-list settings-issuer-list">
                  {issuers.length > 0 ? issuers.map((issuer) => (
                    <button className={['issuer-picker-item', issuerForm.id === issuer.id ? 'active' : ''].join(' ')} type="button" onClick={() => { editIssuer(issuer); setActiveCategory('documents'); }} key={issuer.id}>
                      <strong>{issuer.name || issuer.legalName || '名称未設定'}</strong>
                      <span>{[issuer.phone, issuer.email].filter(Boolean).join(' / ') || issuer.address || '-'}</span>
                      <span className="issuer-theme-preview" style={{ '--issuer-preview-color': sanitizeThemeColor(issuer.themeColor || DEFAULT_THEME_COLOR) }}>
                        {issuer.themeColor || '標準色'}
                      </span>
                      <small>{issuer.isDefault ? '既定 / ' : ''}{issuer.isActive === false ? '無効' : '有効'} / 税率 {issuer.defaultTaxRate || DEFAULT_ISSUER_TAX_RATE}%</small>
                    </button>
                  )) : <p className="muted-text">発行元が未登録です。帳票設定から追加してください。</p>}
                </div>
                <footer>
                  <button className="primary-button" type="button" onClick={() => { resetIssuerForm(); setActiveCategory('documents'); }}>発行元を追加</button>
                </footer>
              </article>
            </div>
          )}

          {activeCategory === 'users' && (
            <div className="settings-card-grid">
              <article className="settings-card">
                <header>
                  <h3>ログインユーザー</h3>
                  <p>現在ログインしているアカウントです。</p>
                </header>
                <dl className="settings-definition-list">
                  <div><dt>メールアドレス</dt><dd>{user?.email || '-'}</dd></div>
                  <div><dt>User ID</dt><dd>{userId || '-'}</dd></div>
                </dl>
              </article>
              <article className="settings-card danger-card">
                <header>
                  <h3>セッション</h3>
                  <p>共有PCを使う場合は、作業後にログアウトしてください。</p>
                </header>
                <footer>
                  <button type="button" className="text-button danger" onClick={signOut}>ログアウト</button>
                </footer>
              </article>
            </div>
          )}

          {activeCategory === 'sales' && (
            <div className="settings-card-grid">
              <article className="settings-card">
                <header>
                  <h3>営業条件</h3>
                  <p>支払条件、納品条件、見積書末尾文言は帳票設定の発行元フォームで編集します。</p>
                </header>
                <footer>
                  <button className="ghost-button" type="button" onClick={() => setActiveCategory('documents')}>帳票設定を開く</button>
                </footer>
              </article>
            </div>
          )}

          {activeCategory === 'products' && (
            <div className="settings-card-grid">
              <article className="settings-card">
                <header>
                  <h3>商品／価格設定</h3>
                  <p>商品マスター、ブランド、顧客別価格は各専用画面で管理します。</p>
                </header>
                <p className="muted-text">顧客別価格の履歴や価格判定ロジックは既存機能を維持しています。</p>
              </article>
            </div>
          )}

          {activeCategory === 'inventory' && (
            <div className="settings-card-grid">
              <article className="settings-card">
                <header>
                  <h3>在庫／物流設定</h3>
                  <p>在庫、入出庫、出荷、納品書は各専用画面で管理します。</p>
                </header>
                <p className="muted-text">RLS、Storage、同期方式は既存設定を維持します。</p>
              </article>
            </div>
          )}

          {activeCategory === 'documents' && (
            <div className="settings-document-layout">
              <article className="settings-card issuer-list-card">
                <header>
                  <h3>発行元一覧</h3>
                  <p>見積書、成約確認書、請求書で使う会社情報です。</p>
                </header>
                <div className="issuer-picker-list settings-issuer-list">
                  {issuers.length > 0 ? issuers.map((issuer) => (
                    <button className={['issuer-picker-item', issuerForm.id === issuer.id ? 'active' : ''].join(' ')} type="button" onClick={() => editIssuer(issuer)} key={issuer.id}>
                      <strong>{issuer.name || issuer.legalName || '名称未設定'}</strong>
                      <span>{[issuer.phone, issuer.email].filter(Boolean).join(' / ') || issuer.address || '-'}</span>
                      <span className="issuer-theme-preview" style={{ '--issuer-preview-color': sanitizeThemeColor(issuer.themeColor || DEFAULT_THEME_COLOR) }}>
                        {issuer.themeColor || '標準色'}
                      </span>
                      <small>{issuer.isDefault ? '既定 / ' : ''}{issuer.isActive === false ? '無効' : '有効'} / 税率 {issuer.defaultTaxRate || DEFAULT_ISSUER_TAX_RATE}%</small>
                    </button>
                  )) : <p className="muted-text">発行元が未登録です。右側のフォームから追加してください。</p>}
                </div>
              </article>

              <form className="settings-card issuer-form-panel settings-form-card" onSubmit={handleSaveIssuer}>
                <header>
                  <h3>{issuerForm.id ? '発行元を編集' : '発行元を追加'}</h3>
                  <p>会社情報、帳票の既定条件、約款テンプレートを管理します。</p>
                </header>

                <section className="settings-form-section">
                  <h4>会社情報</h4>
                  <div className="settings-form-grid">
                    <label className="field-label">会社名<input value={issuerForm.name || ''} onChange={(event) => updateIssuerForm('name', event.target.value)} /></label>
                    <label className="field-label">正式社名<input value={issuerForm.legalName || ''} onChange={(event) => updateIssuerForm('legalName', event.target.value)} /></label>
                    <label className="field-label wide-field">住所<input value={issuerForm.address || ''} onChange={(event) => updateIssuerForm('address', event.target.value)} /></label>
                    <label className="field-label">電話<input value={issuerForm.phone || ''} onChange={(event) => updateIssuerForm('phone', event.target.value)} /></label>
                    <label className="field-label">メール<input value={issuerForm.email || ''} onChange={(event) => updateIssuerForm('email', event.target.value)} /></label>
                    <label className="field-label">登録番号<input value={issuerForm.registrationNumber || ''} onChange={(event) => updateIssuerForm('registrationNumber', event.target.value)} /></label>
                    <label className="field-label">担当者<input value={issuerForm.contactPerson || ''} onChange={(event) => updateIssuerForm('contactPerson', event.target.value)} /></label>
                    <label className="field-label">既定税率<input inputMode="decimal" value={issuerForm.defaultTaxRate || ''} onChange={(event) => updateIssuerForm('defaultTaxRate', event.target.value)} /></label>
                    <label className="field-label">テーマカラー
                      <span className="issuer-theme-field">
                        <input
                          type="color"
                          value={isValidThemeColor(issuerForm.themeColor) && issuerForm.themeColor ? sanitizeThemeColor(issuerForm.themeColor) : DEFAULT_THEME_COLOR}
                          onChange={(event) => updateIssuerForm('themeColor', event.target.value)}
                        />
                        <input
                          value={issuerForm.themeColor || ''}
                          placeholder={DEFAULT_THEME_COLOR}
                          onChange={(event) => updateIssuerForm('themeColor', event.target.value.trim())}
                          onBlur={(event) => {
                            if (!isValidThemeColor(event.target.value)) {
                              updateIssuerForm('themeColor', '');
                            }
                          }}
                        />
                      </span>
                    </label>
                    <label className="field-label">PDFテンプレート<select value={issuerForm.defaultPdfTemplate || 'standard'} onChange={(event) => updateIssuerForm('defaultPdfTemplate', event.target.value)}>{PDF_TEMPLATE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                  </div>
                </section>

                <section className="settings-form-section">
                  <h4>請求・振込設定</h4>
                  <div className="settings-form-grid">
                    <label className="field-label wide-field">振込先<textarea value={issuerForm.bankAccount || ''} onChange={(event) => updateIssuerForm('bankAccount', event.target.value)} /></label>
                    <label className="field-label">支払期限日数<input inputMode="numeric" value={issuerForm.defaultInvoiceDueDays || ''} onChange={(event) => updateIssuerForm('defaultInvoiceDueDays', event.target.value)} /></label>
                    <label className="field-label">税端数処理<select value={issuerForm.invoiceRoundingMode || 'round'} onChange={(event) => updateIssuerForm('invoiceRoundingMode', event.target.value)}><option value="round">四捨五入</option><option value="floor">切り捨て</option><option value="ceil">切り上げ</option></select></label>
                    <label className="field-label">請求書番号ルール<input value={issuerForm.invoiceNumberRule || ''} onChange={(event) => updateIssuerForm('invoiceNumberRule', event.target.value)} /></label>
                    <label className="field-label">金融機関名<input value={issuerForm.defaultBankName || ''} onChange={(event) => updateIssuerForm('defaultBankName', event.target.value)} /></label>
                    <label className="field-label">支店名<input value={issuerForm.defaultBankBranch || ''} onChange={(event) => updateIssuerForm('defaultBankBranch', event.target.value)} /></label>
                    <label className="field-label">口座種別<input value={issuerForm.defaultBankAccountType || ''} onChange={(event) => updateIssuerForm('defaultBankAccountType', event.target.value)} /></label>
                    <label className="field-label">口座番号<input value={issuerForm.defaultBankAccountNumber || ''} onChange={(event) => updateIssuerForm('defaultBankAccountNumber', event.target.value)} /></label>
                    <label className="field-label">口座名義<input value={issuerForm.defaultBankAccountHolder || ''} onChange={(event) => updateIssuerForm('defaultBankAccountHolder', event.target.value)} /></label>
                    <label className="field-label wide-field">振込手数料負担文言<input value={issuerForm.defaultTransferFeeText || ''} onChange={(event) => updateIssuerForm('defaultTransferFeeText', event.target.value)} /></label>
                    <label className="field-label wide-field">請求書備考<textarea value={issuerForm.defaultInvoiceRemarks || ''} onChange={(event) => updateIssuerForm('defaultInvoiceRemarks', event.target.value)} /></label>
                  </div>
                  {!issuerForm.registrationNumber && <p className="notice-text">適格請求書として使う場合は登録番号を設定し、税理士等へ確認してください。</p>}
                </section>

                <section className="settings-form-section">
                  <h4>見積・納品条件</h4>
                  <div className="settings-form-grid">
                    <label className="field-label">既定支払条件<input value={issuerForm.defaultPaymentTerms || ''} onChange={(event) => updateIssuerForm('defaultPaymentTerms', event.target.value)} /></label>
                    <label className="field-label">既定納品条件<input value={issuerForm.defaultDeliveryTerms || ''} onChange={(event) => updateIssuerForm('defaultDeliveryTerms', event.target.value)} /></label>
                    <label className="field-label wide-field">既定備考<textarea value={issuerForm.defaultRemarks || ''} onChange={(event) => updateIssuerForm('defaultRemarks', event.target.value)} /></label>
                    <label className="field-label wide-field">見積書末尾文言<textarea value={issuerForm.defaultQuoteTermsSummary || ''} onChange={(event) => updateIssuerForm('defaultQuoteTermsSummary', event.target.value)} /></label>
                  </div>
                </section>

                <section className="settings-form-section">
                  <h4>約款・免責テンプレート</h4>
                  <p className="notice-text">仮テンプレートです。実運用前に専門家確認を行ってください。</p>
                  <div className="settings-form-grid">
                    <label className="field-label">約款バージョン<input value={issuerForm.termsVersion || ''} onChange={(event) => updateIssuerForm('termsVersion', event.target.value)} /></label>
                    <label className="field-label">適用開始日<input type="date" value={issuerForm.termsEffectiveDate || ''} onChange={(event) => updateIssuerForm('termsEffectiveDate', event.target.value)} /></label>
                  </div>
                  <div className="terms-field-list settings-terms-list">
                    {TERMS_FIELDS.map((field) => (
                      <label className="field-label terms-field-card" key={field.key}>
                        {field.label}
                        <textarea
                          value={issuerForm[field.issuerKey] || ''}
                          onChange={(event) => updateIssuerForm(field.issuerKey, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="settings-form-section">
                  <h4>ロゴ・印影</h4>
                  <div className="settings-form-grid">
                    <label className="field-label file-field">ロゴ<input type="file" accept="image/*" onChange={(event) => updateIssuerForm('logoFile', event.target.files?.[0] ?? null)} /></label>
                    <label className="field-label file-field">印影<input type="file" accept="image/*" onChange={(event) => updateIssuerForm('sealFile', event.target.files?.[0] ?? null)} /></label>
                  </div>
                </section>

                <section className="settings-form-section compact-options">
                  <label className="checkbox-row"><input type="checkbox" checked={Boolean(issuerForm.isDefault)} onChange={(event) => updateIssuerForm('isDefault', event.target.checked)} /> 既定発行元にする</label>
                  <label className="checkbox-row"><input type="checkbox" checked={issuerForm.isActive !== false} onChange={(event) => updateIssuerForm('isActive', event.target.checked)} /> 有効</label>
                </section>

                <footer className="settings-card-footer">
                  <button className="primary-button" type="submit" disabled={issuerSaving}>{issuerSaving ? '保存中...' : issuerForm.id ? '発行元を更新' : '発行元を追加'}</button>
                  <button className="ghost-button" type="button" onClick={resetIssuerForm}>新規入力</button>
                </footer>
                {issuerMessage && <p className="settings-message">{issuerMessage}</p>}
              </form>

              <article className="settings-card danger-card wide-card">
                <header>
                  <h3>危険な操作</h3>
                  <p>発行元を無効化すると新しい帳票の選択候補から外れます。過去帳票は保持されます。</p>
                </header>
                <div className="karte-card-list issuer-legacy-actions">
                  {issuers.length > 0 ? issuers.map((issuer) => (
                    <article className={['karte-mini-card', issuer.isActive === false ? 'muted-card' : ''].join(' ')} key={issuer.id}>
                      <h3>{issuer.name || issuer.legalName || '名称未設定'}</h3>
                      <p>{issuer.address || '-'}</p>
                      <div className="lead-badges">
                        {issuer.isDefault && <span className="info-badge ready">既定</span>}
                        <span className="info-badge">{issuer.isActive === false ? '無効' : '有効'}</span>
                        <span className="info-badge">税率 {issuer.defaultTaxRate || DEFAULT_ISSUER_TAX_RATE}%</span>
                        <span className="issuer-theme-preview" style={{ '--issuer-preview-color': sanitizeThemeColor(issuer.themeColor || DEFAULT_THEME_COLOR) }}>{issuer.themeColor || '標準色'}</span>
                      </div>
                      <div className="card-actions">
                        <button className="ghost-button" type="button" onClick={() => editIssuer(issuer)}>編集</button>
                        <button className="ghost-button" type="button" onClick={() => duplicateIssuer(issuer)}>複製</button>
                        {issuer.isActive !== false && <button className="ghost-button danger" type="button" onClick={() => disableIssuer(issuer)}>無効化</button>}
                      </div>
                    </article>
                  )) : <p className="muted-text">無効化できる発行元はありません。</p>}
                </div>
              </article>
            </div>
          )}

          {activeCategory === 'data' && (
            <div className="settings-card-grid">
              <article className="settings-card">
                <header>
                  <h3>Backup</h3>
                  <p>現在のデータをJSONとして保存します。Storage本体ではなくURLとメタ情報を出力します。</p>
                </header>
                <footer>
                  <button type="button" className="primary-button" onClick={handleExport}>JSON Export</button>
                </footer>
              </article>

              <article className="settings-card">
                <header>
                  <h3>Restore</h3>
                  <p>JSONバックアップからデータを復元します。既存形式との互換性を維持します。</p>
                </header>
                <footer>
                  <button type="button" className="ghost-button" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                    {isImporting ? 'Import中...' : 'JSON Import'}
                  </button>
                  <input ref={fileInputRef} type="file" accept="application/json,.json" className="backup-file-input" onChange={handleImport} />
                </footer>
              </article>

              <article className="settings-card">
                <header>
                  <h3>エクスポート</h3>
                  <p>CSVやExcel出力は各一覧画面のエクスポート機能を利用してください。</p>
                </header>
              </article>

              <article className="settings-card">
                <header>
                  <h3>インポート</h3>
                  <p>商品や顧客の個別インポートは各機能画面へ段階的に追加します。</p>
                </header>
              </article>

              <article className="settings-card danger-card wide-card">
                <header>
                  <h3>危険な操作</h3>
                  <p>データ初期化や全消去は現在この画面から実行できません。必要な場合はBackup取得後に管理者が実施してください。</p>
                </header>
              </article>
              {backupMessage && <p className="settings-message wide-message">{backupMessage}</p>}
            </div>
          )}

          {activeCategory === 'integrations' && (
            <div className="settings-card-grid">
              <article className={['settings-card', syncState === 'supabase' ? 'cloud' : 'local'].join(' ')}>
                <header>
                  <h3>Supabase接続</h3>
                  <p>クラウド同期の接続状態を表示します。</p>
                </header>
                <dl className="settings-definition-list">
                  <div><dt>状態</dt><dd>{syncState === 'supabase' ? '接続中' : syncState === 'syncing' ? '同期中' : 'LocalStorage'}</dd></div>
                  {syncError && <div><dt>エラー</dt><dd>{syncError}</dd></div>}
                </dl>
                <footer>
                  <button type="button" className="ghost-button" onClick={reloadFromCloud} disabled={syncState === 'syncing'}>クラウドから再読み込み</button>
                </footer>
              </article>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
