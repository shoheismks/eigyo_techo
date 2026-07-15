import { useEffect, useMemo, useState } from 'react';
import { uploadAttachment } from '../../../shared/services/storageService.js';
import { formatPrice, productDisplayName } from '../../products/hooks/useProducts.js';
import {
  QUOTE_STATUSES,
  ROUNDING_MODES,
  TAX_DISPLAY_MODES,
  calculateQuoteTotals,
  emptyQuote,
  emptyQuoteLine,
  normalizeQuote,
} from '../hooks/useQuotes.js';
import {
  buildQuotePdfContext,
  createQuotePdfFile,
  downloadQuotePdf,
  renderQuotePreviewHtml,
} from '../services/quotePdfService.js';

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysString(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function generateQuoteNumber(quotes = []) {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}-`;
  const max = quotes.reduce((currentMax, quote) => {
    const number = quote.quoteNumber || '';
    if (!number.startsWith(prefix)) return currentMax;
    const value = Number(number.replace(prefix, ''));
    return Number.isFinite(value) ? Math.max(currentMax, value) : currentMax;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

function createInitialQuote({ draft, quotes, user }) {
  return normalizeQuote({
    ...emptyQuote,
    ...draft,
    quoteNumber: draft?.quoteNumber || generateQuoteNumber(quotes),
    issueDate: todayString(),
    submittedDate: todayString(),
    validUntil: addDaysString(todayString(), 14),
    taxRate: '10',
    defaultTaxRate: '10',
    taxDisplayMode: 'tax_excluded',
    roundingMode: 'round',
    quoteLines: draft?.quoteLines?.length ? draft.quoteLines : [emptyQuoteLine()],
    createdBy: user?.id ?? '',
    createdByName: user?.email ?? '',
  }, user?.id ?? '');
}

function buildLineSnapshot(line = {}, product, inventory, defaultTaxRate = '10') {
  const productName = productDisplayName(product, line.productName || line.description || '');
  return {
    ...line,
    productId: product?.id || line.productId || '',
    inventoryId: inventory?.id || line.inventoryId || '',
    productCode: product?.productCode || line.productCode || '',
    productName,
    description: productName,
    category: product?.category || line.category || '',
    manufacturerName: product?.manufacturerName || line.manufacturerName || '',
    origin: product?.origin || line.origin || '',
    packageStyle: product?.packageStyle || line.packageStyle || '',
    temperatureZone: product?.temperatureZone || line.temperatureZone || '',
    shelfLife: product?.shelfLife || line.shelfLife || '',
    expirationText: inventory?.expiryDate || inventory?.expirationDate || line.expirationText || product?.shelfLife || '',
    inventoryCode: inventory?.inventoryCode || inventory?.inventory_code || line.inventoryCode || '',
    inventoryOwner: inventory?.owner || line.inventoryOwner || '',
    inventoryStockType: inventory?.stockType || line.inventoryStockType || '',
    inventoryLot: inventory?.lot || line.inventoryLot || '',
    inventoryExpiryDate: inventory?.expiryDate || inventory?.expirationDate || line.inventoryExpiryDate || '',
    unit: product?.sellingPriceUnit || product?.costUnit || inventory?.unit || line.unit || 'kg',
    unitPrice: line.unitPrice || product?.desiredSellingPrice || '',
    costPrice: inventory?.cost || inventory?.costPrice || line.costPrice || product?.costPrice || '',
    taxRate: line.taxRate || defaultTaxRate || '10',
    snapshotCreatedAt: line.snapshotCreatedAt || new Date().toISOString(),
    sourceProductUpdatedAt: product?.updatedAt || line.sourceProductUpdatedAt || '',
    sourceInventoryUpdatedAt: inventory?.updatedAt || line.sourceInventoryUpdatedAt || '',
  };
}

export default function QuoteFormModal({
  open,
  draft,
  customers = [],
  contacts = [],
  products = [],
  inventories = [],
  suppliers = [],
  quotes = [],
  addQuote,
  updateQuote,
  user,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => createInitialQuote({ draft, quotes, user }));
  const [productSearch, setProductSearch] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(createInitialQuote({ draft, quotes, user }));
    setProductSearch('');
    setPreviewHtml('');
    setError('');
  }, [draft, open, quotes, user]);

  const selectedCustomer = customers.find((customer) => customer.id === form.customerId);
  const visibleContacts = contacts.filter((contact) => !form.customerId || contact.customerId === form.customerId);
  const productOptions = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter((product) => [
      product.productCode,
      product.name,
      product.manufacturerName,
      product.category,
    ].filter(Boolean).join(' ').toLowerCase().includes(keyword));
  }, [productSearch, products]);
  const totals = useMemo(() => calculateQuoteTotals(form), [form]);
  const linesReady = (form.quoteLines ?? []).length > 0 && (form.quoteLines ?? []).every((line) => line.productId);

  if (!open) return null;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateLine(lineId, field, value) {
    setForm((current) => {
      const quoteLines = (current.quoteLines?.length ? current.quoteLines : [emptyQuoteLine()]).map((line) => {
        if (line.id !== lineId) return line;
        if (field === 'productId') {
          const product = products.find((item) => item.id === value);
          return buildLineSnapshot({ ...line, productId: value, inventoryId: '' }, product, null, current.defaultTaxRate);
        }
        if (field === 'inventoryId') {
          const inventory = inventories.find((item) => item.id === value);
          const product = products.find((item) => item.id === (inventory?.productId || line.productId));
          return buildLineSnapshot(line, product, inventory, current.defaultTaxRate);
        }
        return { ...line, [field]: value };
      });
      return {
        ...current,
        quoteLines,
        productIds: [...new Set(quoteLines.map((line) => line.productId).filter(Boolean))],
        inventoryIds: [...new Set(quoteLines.map((line) => line.inventoryId).filter(Boolean))],
      };
    });
  }

  function addLine() {
    setForm((current) => ({ ...current, quoteLines: [...(current.quoteLines ?? []), emptyQuoteLine()] }));
  }

  function removeLine(lineId) {
    setForm((current) => {
      const quoteLines = (current.quoteLines ?? []).filter((line) => line.id !== lineId);
      const nextLines = quoteLines.length ? quoteLines : [emptyQuoteLine()];
      return { ...current, quoteLines: nextLines };
    });
  }

  function buildContext() {
    const quoteLines = (form.quoteLines ?? []).map((line) => {
      const product = products.find((item) => item.id === line.productId);
      const inventory = inventories.find((item) => item.id === line.inventoryId);
      return buildLineSnapshot(line, product, inventory, form.defaultTaxRate);
    });
    const financials = calculateQuoteTotals({ ...form, quoteLines });
    const quote = normalizeQuote({
      ...form,
      quoteLines,
      productIds: [...new Set(quoteLines.map((line) => line.productId).filter(Boolean))],
      inventoryIds: [...new Set(quoteLines.map((line) => line.inventoryId).filter(Boolean))],
      subtotal: financials.subtotal,
      taxAmount: financials.taxAmount,
      taxBreakdown: financials.taxBreakdown,
      grandTotal: financials.grandTotal,
      totalAmount: financials.totalAmount,
      inventoryCostTotal: financials.costTotal,
      grossMarginAmount: financials.grossMarginAmount,
      grossMarginRate: financials.grossMarginRate,
      updatedBy: user?.id ?? '',
      updatedByName: user?.email ?? '',
      createdBy: form.createdBy || user?.id || '',
      createdByName: form.createdByName || user?.email || '',
    }, user?.id ?? '');

    return buildQuotePdfContext({
      quote,
      customer: selectedCustomer,
      contacts,
      products,
      inventories,
      suppliers,
      financials,
    });
  }

  function validate() {
    if (!form.customerId) return '顧客を選択してください。';
    if (!form.quoteNumber.trim()) return '見積番号を入力してください。';
    if (!linesReady) return '商品マスターから商品を選択した明細を1件以上登録してください。';
    return '';
  }

  function handlePreview() {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError('');
    setPreviewHtml(renderQuotePreviewHtml(buildContext()));
  }

  function handleDownload() {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError('');
    downloadQuotePdf(buildContext());
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const message = validate();
    if (message) {
      setError(message);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const context = buildContext();
      const pdfFile = createQuotePdfFile(context);
      const uploadedPdf = await uploadAttachment({
        file: pdfFile,
        userId: user?.id ?? context.quote.userId,
        ownerType: 'quote',
        ownerId: context.quote.id,
        field: 'quotePdf',
      });
      const generatedAt = new Date().toISOString();
      const payload = normalizeQuote({
        ...context.quote,
        pdfUrl: uploadedPdf?.publicUrl || uploadedPdf?.url || context.quote.pdfUrl,
        pdfFileName: uploadedPdf?.name || pdfFile.name,
        pdfStoragePath: uploadedPdf?.path || context.quote.pdfStoragePath,
        pdfGeneratedAt: generatedAt,
        pdfHistory: [
          ...(context.quote.pdfHistory ?? []),
          {
            id: crypto.randomUUID(),
            generatedAt,
            fileName: uploadedPdf?.name || pdfFile.name,
            url: uploadedPdf?.publicUrl || uploadedPdf?.url || '',
          },
        ],
      }, user?.id ?? '');

      const exists = quotes.some((quote) => quote.id === payload.id);
      if (exists && updateQuote) {
        await updateQuote(payload.id, payload);
      } else {
        await addQuote(payload);
      }
      onSaved?.(payload);
      onClose?.();
    } catch (err) {
      setError(err.message || '見積の保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-panel quote-form-modal" onSubmit={handleSubmit}>
        <div className="section-heading">
          <div>
            <h2>見積作成</h2>
            <span>{selectedCustomer?.companyName || '顧客未選択'}</span>
          </div>
          <button type="button" className="text-button" onClick={onClose}>閉じる</button>
        </div>

        <div className="date-grid">
          <label className="field-label">顧客<select value={form.customerId} onChange={(event) => updateField('customerId', event.target.value)}><option value="">選択してください</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.companyName}</option>)}</select></label>
          <label className="field-label">担当者<select value={form.contactIds?.[0] || ''} onChange={(event) => updateField('contactIds', event.target.value ? [event.target.value] : [])}><option value="">未選択</option>{visibleContacts.map((contact) => <option value={contact.id} key={contact.id}>{contact.name}</option>)}</select></label>
          <label className="field-label">見積番号<input value={form.quoteNumber} onChange={(event) => updateField('quoteNumber', event.target.value)} /></label>
          <label className="field-label">案件<input value={form.projectName} onChange={(event) => updateField('projectName', event.target.value)} /></label>
          <label className="field-label">ステータス<select value={form.status} onChange={(event) => updateField('status', event.target.value)}>{QUOTE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="field-label">有効期限<input type="date" value={form.validUntil} onChange={(event) => updateField('validUntil', event.target.value)} /></label>
        </div>

        <div className="date-grid">
          <label className="field-label">既定税率(%)<input inputMode="decimal" value={form.defaultTaxRate} onChange={(event) => { updateField('defaultTaxRate', event.target.value); updateField('taxRate', event.target.value); }} /></label>
          <label className="field-label">税表示<select value={form.taxDisplayMode} onChange={(event) => updateField('taxDisplayMode', event.target.value)}>{TAX_DISPLAY_MODES.map((mode) => <option value={mode.value} key={mode.value}>{mode.label}</option>)}</select></label>
          <label className="field-label">端数処理<select value={form.roundingMode} onChange={(event) => updateField('roundingMode', event.target.value)}>{ROUNDING_MODES.map((mode) => <option value={mode.value} key={mode.value}>{mode.label}</option>)}</select></label>
          <label className="field-label">通貨<input value={form.currency} onChange={(event) => updateField('currency', event.target.value)} /></label>
        </div>

        <label className="field-label">商品マスター検索<input value={productSearch} placeholder="商品名・商品コード・メーカー・カテゴリーで検索" onChange={(event) => setProductSearch(event.target.value)} /></label>

        <div className="sample-form">
          {(form.quoteLines?.length ? form.quoteLines : [emptyQuoteLine()]).map((line, index) => {
            const lineInventories = inventories.filter((inventory) => !line.productId || inventory.productId === line.productId);
            const calculatedLine = calculateQuoteTotals({ ...form, quoteLines: [line] }).lines[0];
            return (
              <article className="karte-mini-card" key={line.id}>
                <div className="history-meta">
                  <span>明細 {index + 1}</span>
                  <button type="button" className="ghost-button" onClick={() => removeLine(line.id)}>削除</button>
                </div>
                <div className="date-grid">
                  <label className="field-label">商品<select value={line.productId || ''} onChange={(event) => updateLine(line.id, 'productId', event.target.value)}><option value="">未選択</option>{productOptions.map((product) => <option value={product.id} key={product.id}>{productDisplayName(product, '商品名未設定')}</option>)}</select></label>
                  <label className="field-label">在庫<select value={line.inventoryId || ''} onChange={(event) => updateLine(line.id, 'inventoryId', event.target.value)}><option value="">未選択</option>{lineInventories.map((inventory) => <option value={inventory.id} key={inventory.id}>{[inventory.inventoryCode, inventory.owner, inventory.lot, inventory.quantity && `${inventory.quantity}${inventory.unit || ''}`].filter(Boolean).join(' / ') || inventory.id}</option>)}</select></label>
                  <label className="field-label">数量<input inputMode="decimal" value={line.quantity || ''} onChange={(event) => updateLine(line.id, 'quantity', event.target.value)} /></label>
                  <label className="field-label">単位<input value={line.unit || ''} onChange={(event) => updateLine(line.id, 'unit', event.target.value)} /></label>
                  <label className="field-label">単価<input inputMode="decimal" value={line.unitPrice || ''} onChange={(event) => updateLine(line.id, 'unitPrice', event.target.value)} /></label>
                  <label className="field-label">原価<input inputMode="decimal" value={line.costPrice || ''} onChange={(event) => updateLine(line.id, 'costPrice', event.target.value)} /></label>
                  <label className="field-label">税率(%)<input inputMode="decimal" value={line.taxRate || form.defaultTaxRate || '10'} onChange={(event) => updateLine(line.id, 'taxRate', event.target.value)} /></label>
                  <label className="field-label">賞味期限<input value={line.expirationText || ''} onChange={(event) => updateLine(line.id, 'expirationText', event.target.value)} /></label>
                </div>
                <label className="field-label">明細備考<input value={line.memo || ''} onChange={(event) => updateLine(line.id, 'memo', event.target.value)} /></label>
                <dl className="company-details">
                  <div><dt>商品コード</dt><dd>{line.productCode || '-'}</dd></div>
                  <div><dt>商品名</dt><dd>{line.productName || '-'}</dd></div>
                  <div><dt>温度帯</dt><dd>{line.temperatureZone || '-'}</dd></div>
                  <div><dt>金額</dt><dd>{formatPrice(calculatedLine?.amount) || '-'}</dd></div>
                  <div><dt>粗利</dt><dd>{formatPrice(calculatedLine?.grossMarginAmount) || '-'}</dd></div>
                </dl>
              </article>
            );
          })}
          <button type="button" className="ghost-button" onClick={addLine}>明細を追加</button>
        </div>

        <div className="date-grid">
          <label className="field-label">運賃<input inputMode="decimal" value={form.freight} onChange={(event) => updateField('freight', event.target.value)} /></label>
          <label className="field-label">値引<input inputMode="decimal" value={form.discount} onChange={(event) => updateField('discount', event.target.value)} /></label>
          <label className="field-label">支払条件<input value={form.paymentTerms} onChange={(event) => updateField('paymentTerms', event.target.value)} /></label>
          <label className="field-label">配送条件<input value={form.deliveryTerms} onChange={(event) => updateField('deliveryTerms', event.target.value)} /></label>
          <label className="field-label">納期<input value={form.deliveryDate} onChange={(event) => updateField('deliveryDate', event.target.value)} /></label>
        </div>
        <label className="field-label">備考<textarea value={form.remarks} onChange={(event) => updateField('remarks', event.target.value)} /></label>

        <div className="price-preview">
          <div><span>小計</span><strong>{formatPrice(totals.subtotal) || '-'} {form.currency}</strong></div>
          <div><span>消費税</span><strong>{formatPrice(totals.taxAmount) || '-'} {form.currency}</strong></div>
          <div><span>税込合計</span><strong>{formatPrice(totals.grandTotal) || '-'} {form.currency}</strong></div>
          <div><span>粗利率</span><strong>{totals.grossMarginRate || '-'}</strong></div>
        </div>

        {error && <p className="error-text">{error}</p>}
        <div className="mail-action-row">
          <button type="button" className="ghost-button" onClick={handlePreview} disabled={!linesReady}>PDFプレビュー</button>
          <button type="button" className="ghost-button" onClick={handleDownload} disabled={!linesReady}>PDFダウンロード</button>
          <button type="submit" className="primary-button" disabled={saving || !linesReady}>{saving ? '保存中...' : '保存して見積詳細へ'}</button>
        </div>
        {previewHtml && <div className="quote-preview-frame" dangerouslySetInnerHTML={{ __html: previewHtml }} />}
      </form>
    </div>
  );
}
