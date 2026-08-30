import { useEffect, useMemo, useState } from 'react';

const STEPS = [
  { key: 'upload', label: '取込' },
  { key: 'content', label: '内容確認' },
  { key: 'products', label: '商品確認' },
  { key: 'save', label: '保存' },
];

const SUPPORTED_DOCUMENT_TYPES = new Set(['delivery_notice', 'standard_excel_import']);

function documentTypeLabel(type) {
  return {
    delivery_notice: '入荷予定案内',
    standard_excel_import: '標準Excel',
    product_price_list: '商品価格表',
    warehouse_receipt_candidate: '倉庫受領書の可能性',
    unknown: '書類形式を確認してください',
  }[type] || '書類形式を確認してください';
}

function requestedStep() {
  if (typeof window === 'undefined') return 'upload';
  const step = new URLSearchParams(window.location.search).get('step');
  return STEPS.some((item) => item.key === step) ? step : 'upload';
}

function writeStepUrl(step, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', 'arrival');
  url.searchParams.set('view', 'import');
  if (step === 'upload') url.searchParams.delete('step');
  else url.searchParams.set('step', step);
  window.history[replace ? 'replaceState' : 'pushState']({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function lineIsConfirmed(line) {
  const status = line.productMatchStatus || line.matchStatus;
  return Boolean(line.matchedProductId) && ['matched', 'manual'].includes(status);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

export default function InboundImportFlow({
  preview,
  parsing = false,
  saving = false,
  error = '',
  onUpload,
  onExcelUpload,
  onReset,
  onSave,
  renderContent,
  renderProductCheck,
}) {
  const supported = SUPPORTED_DOCUMENT_TYPES.has(preview?.documentType);
  const [step, setStep] = useState(() => preview ? requestedStep() : 'upload');
  const progress = useMemo(() => {
    const lines = preview?.lines || [];
    const confirmed = lines.filter(lineIsConfirmed).length;
    return { confirmed, total: lines.length, remaining: Math.max(lines.length - confirmed, 0) };
  }, [preview]);
  const contracts = useMemo(() => uniqueValues((preview?.lines || []).map((line) => line.contractNo)), [preview]);
  const customsDates = useMemo(
    () => uniqueValues((preview?.lines || []).map((line) => line.customsClearancePlannedDate)),
    [preview],
  );
  const arrivalDates = useMemo(
    () => uniqueValues([
      ...(preview?.lines || []).map((line) => line.warehouseArrivalDate),
      preview?.normalizedDocument?.fields?.warehouseArrivalDate?.value,
    ]),
    [preview],
  );

  function safeStep(next) {
    if (!preview) return 'upload';
    if (!supported && ['products', 'save'].includes(next)) return 'content';
    return next;
  }

  function moveTo(next, replace = false) {
    const resolved = safeStep(next);
    setStep(resolved);
    writeStepUrl(resolved, replace);
  }

  useEffect(() => {
    if (preview && step === 'upload') moveTo('content', true);
    if (!preview && step !== 'upload') moveTo('upload', true);
  }, [preview]);

  useEffect(() => {
    const handlePopState = () => setStep(safeStep(requestedStep()));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [preview, supported]);

  function resetImport() {
    onReset?.();
    setStep('upload');
    writeStepUrl('upload');
  }

  const currentIndex = STEPS.findIndex((item) => item.key === step);
  const confidence = preview?.classification?.confidence;

  return (
    <div className={`inbound-import-flow ${preview ? 'delivery-notice-preview' : ''}`}>
      <ol className="inbound-import-stepper" aria-label="入荷予定取込の進行状況">
        {STEPS.map((item, index) => {
          const unavailable = !supported && index >= 2;
          const state = unavailable ? 'unavailable' : index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming';
          return (
            <li className={state} aria-current={state === 'current' ? 'step' : undefined} key={item.key}>
              <span>{state === 'complete' ? '✓' : index + 1}</span>
              <strong>{item.label}</strong>
            </li>
          );
        })}
      </ol>

      {parsing && <p className="notice-text">ファイルを解析しています...</p>}
      {saving && <p className="notice-text">入荷予定として保存しています...</p>}
      {error && <p className="error-text">{error}</p>}

      {step === 'upload' && !parsing && (
        <>
          <div className="inbound-import-choice">
            <label className="delivery-notice-upload-button">
              <strong>PDFから取り込む</strong>
              <span>入荷案内PDF、商品単価表など</span>
              <span className="primary-button">PDFを選択</span>
              <input type="file" accept="application/pdf,.pdf" onChange={onUpload} />
            </label>
            <label className="delivery-notice-upload-button standard-excel-upload-button">
              <strong>標準Excelから取り込む</strong>
              <span>IMPORT_TEMPLATE形式</span>
              <span className="secondary-button">Excelを選択</span>
              <input type="file" accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx" onChange={onExcelUpload} />
            </label>
          </div>
          {!preview && <div className="empty-state delivery-notice-empty"><h3>取込方法を選択してください</h3><p>保存前に内容と商品を順番に確認できます。</p></div>}
        </>
      )}

      {preview && step === 'content' && (
        <section className="inbound-import-stage" aria-labelledby="inbound-content-title">
          <div className="section-heading"><div><p className="eyebrow">Step 2</p><h3 id="inbound-content-title">内容確認</h3><p className="inline-helper">帳票から読み取った内容を確認してください。</p></div></div>
          <div className="delivery-notice-summary inbound-content-summary">
            <div className="summary-card"><span>書類種別</span><strong>{documentTypeLabel(preview.documentType)}</strong></div>
            <div className="summary-card"><span>ファイル名</span><strong>{preview.fileName || '-'}</strong></div>
            <div className="summary-card"><span>仕入先</span><strong>{preview.supplier || preview.supplierName || '-'}</strong></div>
            <div className="summary-card"><span>帳票番号</span><strong>{preview.documentNumber || '-'}</strong></div>
            <div className="summary-card"><span>契約No</span><strong>{contracts.join(' / ') || '-'}</strong></div>
            <div className="summary-card"><span>明細数</span><strong>{preview.lines?.length || 0}件</strong></div>
          </div>
          <dl className="company-details inbound-date-details">
            <div><dt>発行日</dt><dd>{preview.issueDate || '-'}</dd></div>
            <div><dt>通関予定</dt><dd>{customsDates.join(' / ') || '-'}</dd></div>
            <div><dt>倉庫入庫予定</dt><dd>{arrivalDates.join(' / ') || '-'}</dd></div>
          </dl>
          {confidence === 'medium' && <p className="notice-text">一部の読み取り内容は確認をおすすめします。</p>}
          {confidence === 'low' && <p className="warning-text">読み取り結果の確認が必要です。</p>}
          {(preview.warnings || []).length > 0 && (
            <div className="delivery-notice-warning-box"><h3>読み取り確認事項</h3><ul>{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>
          )}
          {renderContent?.()}
          {!supported && (
            <div className="inbound-document-readonly">
              <strong>この書類は入荷予定として保存できません。</strong>
              <p>{preview.documentType === 'product_price_list' ? '商品価格表の内容確認のみ行えます。' : '書類形式と読み取り内容を確認してください。'}</p>
            </div>
          )}
          <div className="inbound-flow-actions">
            <button type="button" className="ghost-button" onClick={resetImport}>取込をやり直す</button>
            {supported && <button type="button" className="primary-button" onClick={() => moveTo('products')}>商品確認へ</button>}
          </div>
        </section>
      )}

      {preview && supported && step === 'products' && (
        <section className="inbound-import-stage" aria-labelledby="inbound-products-title">
          <div className="section-heading"><div><p className="eyebrow">Step 3</p><h3 id="inbound-products-title">商品確認</h3><p className="inline-helper">確認済み {progress.confirmed} / {progress.total}　残り {progress.remaining}件</p></div></div>
          <div className="inbound-product-progress" role="progressbar" aria-valuemin="0" aria-valuemax={progress.total} aria-valuenow={progress.confirmed}><span style={{ width: `${progress.total ? (progress.confirmed / progress.total) * 100 : 0}%` }} /></div>
          {renderProductCheck?.()}
          <div className="inbound-flow-actions">
            <button type="button" className="ghost-button" onClick={() => moveTo('content')}>内容確認へ戻る</button>
            <button type="button" className="primary-button" onClick={() => moveTo('save')}>保存内容を確認</button>
          </div>
        </section>
      )}

      {preview && supported && step === 'save' && (
        <section className="inbound-import-stage" aria-labelledby="inbound-save-title">
          <div className="section-heading"><div><p className="eyebrow">Step 4</p><h3 id="inbound-save-title">保存内容の確認</h3><p className="inline-helper">入荷予定として保存する内容を確認してください。</p></div></div>
          <dl className="company-details inbound-save-summary">
            <div><dt>仕入先</dt><dd>{preview.supplier || preview.supplierName || '-'}</dd></div>
            <div><dt>帳票番号</dt><dd>{preview.documentNumber || '-'}</dd></div>
            <div><dt>契約No</dt><dd>{contracts.join(' / ') || '-'}</dd></div>
            <div><dt>明細数</dt><dd>{progress.total}件</dd></div>
            <div><dt>商品確認</dt><dd>{progress.confirmed} / {progress.total}（残り{progress.remaining}件）</dd></div>
            <div><dt>通関予定</dt><dd>{customsDates.join(' / ') || '-'}</dd></div>
          </dl>
          <p className="notice-text">保存しても在庫数量には加算されません。</p>
          <div className="inbound-flow-actions">
            <button type="button" className="ghost-button" onClick={() => moveTo('products')}>商品確認へ戻る</button>
            <button type="button" className="primary-button" disabled={saving || parsing} onClick={onSave}>入荷予定として保存</button>
          </div>
        </section>
      )}
    </div>
  );
}
