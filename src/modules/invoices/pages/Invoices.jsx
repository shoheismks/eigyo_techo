import { useEffect, useMemo, useState } from 'react';
import DesktopTable from '../../../shared/components/DesktopTable.jsx';
import { uploadAttachment } from '../../../shared/services/storageService.js';
import { formatPrice } from '../../products/hooks/useProducts.js';
import {
  DEFAULT_INVOICE_TAX_RATE,
  INVOICE_PAYMENT_METHODS,
  INVOICE_STATUSES,
  ROUNDING_MODES,
  calculateInvoiceTotals,
  emptyInvoiceLine,
  emptyInvoicePayment,
  normalizeInvoice,
} from '../hooks/useInvoices.js';
import {
  buildInvoiceDraftFromQuote,
  buildInvoicePdfContext,
  createInvoicePdfFile,
  downloadInvoicePdf,
  generateInvoiceNumber,
  invoiceMoney,
  renderInvoicePreviewHtml,
} from '../services/invoicePdfService.js';

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysString(value, days) {
  const date = new Date(`${value || todayString()}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : '-';
}

function customerName(customer) {
  return customer?.companyName || customer?.name || '-';
}

function makeIssuerSnapshot(issuer) {
  if (!issuer) return null;
  return {
    id: issuer.id,
    name: issuer.name,
    legalName: issuer.legalName,
    logoUrl: issuer.logoUrl,
    sealUrl: issuer.sealUrl,
    address: issuer.address,
    phone: issuer.phone,
    email: issuer.email,
    registrationNumber: issuer.registrationNumber,
    contactPerson: issuer.contactPerson,
    bankAccount: issuer.bankAccount,
    defaultTaxRate: issuer.defaultTaxRate || DEFAULT_INVOICE_TAX_RATE,
    invoiceRoundingMode: issuer.invoiceRoundingMode || 'round',
  };
}

function makeBankSnapshot(issuer) {
  return {
    bankAccount: issuer?.bankAccount || '',
    bankName: issuer?.defaultBankName || '',
    branchName: issuer?.defaultBankBranch || '',
    accountType: issuer?.defaultBankAccountType || '',
    accountNumber: issuer?.defaultBankAccountNumber || '',
    accountHolder: issuer?.defaultBankAccountHolder || '',
  };
}

function makeCustomerSnapshot(customer) {
  if (!customer) return null;
  return {
    id: customer.id,
    companyName: customer.companyName,
    address: customer.address,
    email: customer.email,
    phone: customer.phone,
    customerCode: customer.customerCode,
  };
}

function makeBlankInvoice({ invoices = [], issuers = [], user }) {
  const issuer = issuers.find((item) => item.isDefault && item.isActive !== false) || issuers.find((item) => item.isActive !== false) || issuers[0];
  const issueDate = todayString();
  return normalizeInvoice({
    invoiceNumber: generateInvoiceNumber(invoices, issuer?.id || ''),
    issueDate,
    invoiceDate: issueDate,
    dueDate: addDaysString(issueDate, issuer?.defaultInvoiceDueDays || 30),
    transactionDate: issueDate,
    issuerId: issuer?.id || '',
    issuerSnapshot: makeIssuerSnapshot(issuer),
    bankSnapshot: makeBankSnapshot(issuer),
    transferFeeText: issuer?.defaultTransferFeeText || '振込手数料は貴社にてご負担ください。',
    paymentTerms: issuer?.defaultPaymentTerms || '',
    remarks: issuer?.defaultInvoiceRemarks || issuer?.defaultRemarks || '',
    invoiceLines: [emptyInvoiceLine()],
    createdBy: user?.id || '',
    createdByName: user?.email || '',
  }, user?.id || '');
}

function sourceLabel(invoice) {
  return [
    invoice.sourceQuoteSnapshot?.quoteNumber && `見積 ${invoice.sourceQuoteSnapshot.quoteNumber}`,
    invoice.sourceConfirmationSnapshot?.confirmationPdfUrl && '成約確認書あり',
  ].filter(Boolean).join(' / ') || '-';
}

export default function Invoices({
  invoices = [],
  addInvoice,
  updateInvoice,
  removeInvoice,
  customers = [],
  contacts = [],
  projects = [],
  quotes = [],
  issuers = [],
  initialDraft = null,
  onDraftHandled,
  user,
}) {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(() => makeBlankInvoice({ invoices, issuers, user }));
  const [previewHtml, setPreviewHtml] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const contactMap = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const issuerMap = useMemo(() => new Map(issuers.map((issuer) => [issuer.id, issuer])), [issuers]);

  useEffect(() => {
    if (!initialDraft) return;
    const base = makeBlankInvoice({ invoices, issuers, user });
    const customer = customers.find((item) => item.id === initialDraft.customerId);
    const contact = contacts.find((item) => item.id === initialDraft.contactId);
    setForm(normalizeInvoice({
      ...base,
      ...initialDraft,
      invoiceNumber: initialDraft.invoiceNumber || base.invoiceNumber,
      invoiceLines: initialDraft.invoiceLines?.length ? initialDraft.invoiceLines : base.invoiceLines,
      billingName: initialDraft.billingName || customer?.companyName || base.billingName,
      billingAddress: initialDraft.billingAddress || customer?.address || base.billingAddress,
      billingContactName: initialDraft.billingContactName || contact?.name || base.billingContactName,
      customerSnapshot: initialDraft.customerSnapshot || makeCustomerSnapshot(customer) || base.customerSnapshot,
    }, user?.id || ''));
    setEditingId(initialDraft.id || '');
    setFormOpen(true);
    setPreviewHtml('');
    setMessage('');
    onDraftHandled?.();
  }, [contacts, customers, initialDraft, invoices, issuers, onDraftHandled, user]);

  const filteredInvoices = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return invoices
      .filter((invoice) => !invoice.isDeleted)
      .filter((invoice) => !statusFilter || invoice.status === statusFilter)
      .filter((invoice) => {
        if (!normalizedKeyword) return true;
        const customer = customerMap.get(invoice.customerId);
        return [
          invoice.invoiceNumber,
          invoice.subject,
          invoice.billingName,
          invoice.status,
          invoice.sourceQuoteSnapshot?.quoteNumber,
          customer?.companyName,
        ].some((value) => String(value || '').toLowerCase().includes(normalizedKeyword));
      });
  }, [customerMap, invoices, keyword, statusFilter]);

  const totals = useMemo(() => calculateInvoiceTotals(form), [form]);
  const selectedCustomer = customerMap.get(form.customerId);
  const selectedIssuer = issuerMap.get(form.issuerId);
  const selectedProject = projectMap.get(form.projectId);
  const relatedContacts = contacts.filter((contact) => !form.customerId || contact.customerId === form.customerId);

  const columns = [
    { key: 'invoiceNumber', label: '請求書番号', minWidth: '150px' },
    { key: 'customer', label: '顧客名', minWidth: '220px', render: (invoice) => invoice.billingName || customerName(customerMap.get(invoice.customerId)) },
    { key: 'subject', label: '件名', minWidth: '220px', render: (invoice) => invoice.subject || '-' },
    { key: 'invoiceDate', label: '請求日', minWidth: '110px', render: (invoice) => formatDate(invoice.invoiceDate || invoice.issueDate) },
    { key: 'dueDate', label: '支払期限', minWidth: '110px', render: (invoice) => formatDate(invoice.dueDate) },
    { key: 'grandTotal', label: '請求金額', minWidth: '120px', render: (invoice) => invoiceMoney(invoice.grandTotal) },
    { key: 'paidAmount', label: '入金額', minWidth: '110px', render: (invoice) => invoiceMoney(invoice.paidAmount) },
    { key: 'unpaidAmount', label: '未入金', minWidth: '110px', render: (invoice) => invoiceMoney(invoice.unpaidAmount) },
    { key: 'status', label: 'ステータス', minWidth: '100px' },
    { key: 'source', label: '元帳票', minWidth: '180px', render: sourceLabel },
    { key: 'pdf', label: 'PDF', minWidth: '90px', render: (invoice) => invoice.invoicePdfUrl ? <a href={invoice.invoicePdfUrl} target="_blank" rel="noreferrer">PDF</a> : '-' },
  ];

  function updateField(field, value) {
    setMessage('');
    setForm((current) => {
      if (field === 'customerId') {
        const customer = customerMap.get(value);
        return {
          ...current,
          customerId: value,
          billingName: customer?.companyName || current.billingName,
          billingAddress: customer?.address || current.billingAddress,
          customerSnapshot: makeCustomerSnapshot(customer) || current.customerSnapshot,
        };
      }

      if (field === 'contactId') {
        const contact = contactMap.get(value);
        return {
          ...current,
          contactId: value,
          billingContactName: contact?.name || current.billingContactName,
        };
      }

      if (field === 'issuerId') {
        const issuer = issuerMap.get(value);
        return {
          ...current,
          issuerId: value,
          issuerSnapshot: makeIssuerSnapshot(issuer) || current.issuerSnapshot,
          bankSnapshot: makeBankSnapshot(issuer),
          paymentTerms: current.paymentTerms || issuer?.defaultPaymentTerms || '',
          transferFeeText: current.transferFeeText || issuer?.defaultTransferFeeText || '振込手数料は貴社にてご負担ください。',
          remarks: current.remarks || issuer?.defaultInvoiceRemarks || '',
        };
      }

      return { ...current, [field]: value };
    });
  }

  function updateLine(lineId, field, value) {
    setForm((current) => ({
      ...current,
      invoiceLines: current.invoiceLines.map((line) => line.id === lineId ? { ...line, [field]: value } : line),
    }));
  }

  function addLine() {
    setForm((current) => ({ ...current, invoiceLines: [...current.invoiceLines, emptyInvoiceLine()] }));
  }

  function removeLine(lineId) {
    setForm((current) => {
      const nextLines = current.invoiceLines.filter((line) => line.id !== lineId);
      return { ...current, invoiceLines: nextLines.length ? nextLines : [emptyInvoiceLine()] };
    });
  }

  function addPayment() {
    setForm((current) => ({ ...current, payments: [...current.payments, emptyInvoicePayment()] }));
  }

  function updatePayment(paymentId, field, value) {
    setForm((current) => ({
      ...current,
      payments: current.payments.map((payment) => payment.id === paymentId ? { ...payment, [field]: value } : payment),
    }));
  }

  function removePayment(paymentId) {
    setForm((current) => ({ ...current, payments: current.payments.filter((payment) => payment.id !== paymentId) }));
  }

  function startNew() {
    setEditingId('');
    setForm(makeBlankInvoice({ invoices, issuers, user }));
    setFormOpen(true);
    setPreviewHtml('');
    setMessage('');
  }

  function startEdit(invoice) {
    setEditingId(invoice.id);
    setForm(normalizeInvoice(invoice, user?.id || ''));
    setFormOpen(true);
    setPreviewHtml('');
    setMessage('');
  }

  function duplicateInvoice(invoice) {
    const payload = normalizeInvoice({
      ...invoice,
      id: crypto.randomUUID(),
      invoiceNumber: generateInvoiceNumber(invoices, invoice.issuerId),
      status: '下書き',
      invoicePdfUrl: '',
      invoicePdfFileName: '',
      invoicePdfStoragePath: '',
      invoicePdfGeneratedAt: '',
      invoicePdfHistory: [],
      payments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, user?.id || '');
    setEditingId('');
    setForm(payload);
    setFormOpen(true);
    setPreviewHtml('');
  }

  function createFromQuote(quoteId) {
    const quote = quotes.find((item) => item.id === quoteId);
    if (!quote) return;
    const customer = customerMap.get(quote.customerId);
    const contact = contactMap.get(quote.contactIds?.[0]);
    const project = projectMap.get(quote.projectId);
    const issuer = issuerMap.get(quote.issuerId);
    setForm(buildInvoiceDraftFromQuote({ quote, customer, contact, project, issuer, invoices, user }));
    setEditingId('');
    setFormOpen(true);
    setPreviewHtml('');
    setMessage('');
  }

  function validate() {
    if (!form.invoiceNumber.trim()) return '請求書番号を入力してください。';
    if (!form.customerId && !form.billingName.trim()) return '顧客または請求先名を入力してください。';
    if (!form.issuerId && !form.issuerSnapshot?.name) return '発行元を選択してください。';
    if (!form.dueDate) return '支払期限を入力してください。';
    if (!form.invoiceLines.length || form.invoiceLines.some((line) => !String(line.productName || '').trim())) return '明細の商品名を入力してください。';
    return '';
  }

  function buildContext(nextInvoice = form) {
    return buildInvoicePdfContext({
      invoice: normalizeInvoice(nextInvoice, user?.id || ''),
      customer: selectedCustomer,
      issuer: selectedIssuer,
    });
  }

  function handlePreview() {
    const validation = validate();
    if (validation) {
      setMessage(validation);
      return;
    }
    setPreviewHtml(renderInvoicePreviewHtml(buildContext()));
  }

  async function handleSave({ generatePdf = false } = {}) {
    const validation = validate();
    if (validation) {
      setMessage(validation);
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const statusHistoryEntry = {
        id: crypto.randomUUID(),
        status: form.status,
        changedAt: new Date().toISOString(),
        changedBy: user?.id || '',
        changedByName: user?.email || '',
      };
      let payload = normalizeInvoice({
        ...form,
        statusHistory: [...(form.statusHistory ?? []), statusHistoryEntry],
        updatedBy: user?.id || '',
        updatedByName: user?.email || '',
      }, user?.id || '');

      if (generatePdf) {
        const context = buildInvoicePdfContext({ invoice: payload, customer: selectedCustomer, issuer: selectedIssuer });
        const pdfFile = createInvoicePdfFile(context);
        const uploadedPdf = await uploadAttachment({
          file: pdfFile,
          userId: user?.id || payload.userId,
          ownerType: 'invoice',
          ownerId: payload.id,
          field: 'invoicePdf',
        });
        const generatedAt = new Date().toISOString();
        payload = normalizeInvoice({
          ...payload,
          invoicePdfUrl: uploadedPdf?.publicUrl || uploadedPdf?.url || '',
          invoicePdfFileName: uploadedPdf?.name || pdfFile.name,
          invoicePdfStoragePath: uploadedPdf?.path || '',
          invoicePdfGeneratedAt: generatedAt,
          invoicePdfHistory: [
            ...(payload.invoicePdfHistory ?? []),
            {
              id: crypto.randomUUID(),
              generatedAt,
              createdBy: user?.id || '',
              createdByName: user?.email || '',
              fileName: uploadedPdf?.name || pdfFile.name,
              url: uploadedPdf?.publicUrl || uploadedPdf?.url || '',
            },
          ],
        }, user?.id || '');
      }

      if (invoices.some((invoice) => invoice.id === payload.id)) {
        updateInvoice?.(payload.id, payload);
      } else {
        addInvoice?.(payload);
      }
      setEditingId(payload.id);
      setForm(payload);
      setMessage(generatePdf ? '請求書を保存し、PDFを出力しました。' : '請求書を保存しました。');
    } catch (error) {
      setMessage(error.message || '請求書の保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  function handleDownload() {
    const validation = validate();
    if (validation) {
      setMessage(validation);
      return;
    }
    downloadInvoicePdf(buildContext());
  }

  return (
    <section className="page invoices-page">
      <div className="page-header">
        <p className="eyebrow">Invoices</p>
        <h1>請求書</h1>
        <p>成約確認書または見積書を基に、請求書作成・PDF出力・入金確認を管理します。</p>
      </div>

      <section className="sync-status-card">
        <div>
          <span>請求書一覧</span>
          <strong>{filteredInvoices.length}件</strong>
        </div>
        <div className="date-grid">
          <label className="field-label">検索<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="請求書番号・顧客・件名で検索" /></label>
          <label className="field-label">ステータス<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">すべて</option>{INVOICE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="field-label">見積から作成<select value="" onChange={(event) => createFromQuote(event.target.value)}><option value="">元見積を選択</option>{quotes.map((quote) => <option value={quote.id} key={quote.id}>{quote.quoteNumber || quote.projectName || quote.id}</option>)}</select></label>
        </div>
        <button type="button" className="primary-button" onClick={startNew}>＋ 新規請求書</button>
      </section>

      {formOpen && (
        <section className="sync-status-card invoice-editor">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{editingId ? 'Edit Invoice' : 'New Invoice'}</p>
              <h2>{form.invoiceNumber || '請求書作成'}</h2>
              <span>{selectedCustomer?.companyName || form.billingName || '請求先未選択'}</span>
            </div>
            <div className="mail-action-row">
              <button type="button" className="ghost-button" onClick={() => setFormOpen(false)}>閉じる</button>
            </div>
          </div>

          <div className="invoice-editor-grid">
            <div className="sample-form">
              <div className="date-grid">
                <label className="field-label">請求書番号<input value={form.invoiceNumber} onChange={(event) => updateField('invoiceNumber', event.target.value)} disabled={Boolean(editingId && form.status !== '下書き')} /></label>
                <label className="field-label">ステータス<select value={form.status} onChange={(event) => updateField('status', event.target.value)}>{INVOICE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
                <label className="field-label">顧客<select value={form.customerId} onChange={(event) => updateField('customerId', event.target.value)}><option value="">未選択</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.companyName}</option>)}</select></label>
                <label className="field-label">顧客担当者<select value={form.contactId} onChange={(event) => updateField('contactId', event.target.value)}><option value="">未選択</option>{relatedContacts.map((contact) => <option value={contact.id} key={contact.id}>{contact.name}</option>)}</select></label>
                <label className="field-label">発行元<select value={form.issuerId} onChange={(event) => updateField('issuerId', event.target.value)}><option value="">未選択</option>{issuers.filter((issuer) => issuer.isActive !== false).map((issuer) => <option value={issuer.id} key={issuer.id}>{issuer.name || issuer.legalName}</option>)}</select></label>
                <label className="field-label">案件<select value={form.projectId} onChange={(event) => updateField('projectId', event.target.value)}><option value="">未選択</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.title || project.projectCode}</option>)}</select></label>
                <label className="field-label">請求日<input type="date" value={form.invoiceDate} onChange={(event) => updateField('invoiceDate', event.target.value)} /></label>
                <label className="field-label">発行日<input type="date" value={form.issueDate} onChange={(event) => updateField('issueDate', event.target.value)} /></label>
                <label className="field-label">支払期限<input type="date" value={form.dueDate} onChange={(event) => updateField('dueDate', event.target.value)} /></label>
                <label className="field-label">取引日/納品日<input type="date" value={form.transactionDate} onChange={(event) => updateField('transactionDate', event.target.value)} /></label>
              </div>
              <label className="field-label">件名<input value={form.subject} onChange={(event) => updateField('subject', event.target.value)} /></label>
              <div className="date-grid">
                <label className="field-label">請求先名<input value={form.billingName} onChange={(event) => updateField('billingName', event.target.value)} /></label>
                <label className="field-label">請求先部署<input value={form.billingDepartment} onChange={(event) => updateField('billingDepartment', event.target.value)} /></label>
                <label className="field-label">請求先担当者<input value={form.billingContactName} onChange={(event) => updateField('billingContactName', event.target.value)} /></label>
              </div>
              <label className="field-label">請求先住所<input value={form.billingAddress} onChange={(event) => updateField('billingAddress', event.target.value)} /></label>

              <div className="section-heading">
                <div>
                  <h3>明細</h3>
                  <span>元帳票の商品スナップショットを請求書側で編集できます。</span>
                </div>
                <button type="button" className="ghost-button" onClick={addLine}>明細追加</button>
              </div>
              {form.invoiceLines.map((line, index) => (
                <article className="karte-mini-card" key={line.id}>
                  <div className="history-meta">
                    <span>明細 {index + 1}</span>
                    <button type="button" className="ghost-button danger" onClick={() => removeLine(line.id)}>削除</button>
                  </div>
                  <div className="date-grid">
                    <label className="field-label">商品コード<input value={line.productCode} onChange={(event) => updateLine(line.id, 'productCode', event.target.value)} /></label>
                    <label className="field-label">商品名<input value={line.productName} onChange={(event) => updateLine(line.id, 'productName', event.target.value)} /></label>
                    <label className="field-label">規格<input value={line.specification} onChange={(event) => updateLine(line.id, 'specification', event.target.value)} /></label>
                    <label className="field-label">数量<input inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(line.id, 'quantity', event.target.value)} /></label>
                    <label className="field-label">単位<input value={line.unit} onChange={(event) => updateLine(line.id, 'unit', event.target.value)} /></label>
                    <label className="field-label">単価<input inputMode="decimal" value={line.unitPrice} onChange={(event) => updateLine(line.id, 'unitPrice', event.target.value)} /></label>
                    <label className="field-label">税率(%)<input inputMode="decimal" value={line.taxRate} onChange={(event) => updateLine(line.id, 'taxRate', event.target.value)} /></label>
                    <label className="checkbox-row"><input type="checkbox" checked={Boolean(line.reducedTax)} onChange={(event) => updateLine(line.id, 'reducedTax', event.target.checked)} /> 軽減税率対象</label>
                  </div>
                  <label className="field-label">備考<input value={line.memo} onChange={(event) => updateLine(line.id, 'memo', event.target.value)} /></label>
                </article>
              ))}

              <div className="date-grid">
                <label className="field-label">支払条件<input value={form.paymentTerms} onChange={(event) => updateField('paymentTerms', event.target.value)} /></label>
                <label className="field-label">振込手数料負担<input value={form.transferFeeText} onChange={(event) => updateField('transferFeeText', event.target.value)} /></label>
                <label className="field-label">税端数処理<select value={form.issuerSnapshot?.invoiceRoundingMode || 'round'} onChange={(event) => updateField('issuerSnapshot', { ...(form.issuerSnapshot ?? {}), invoiceRoundingMode: event.target.value })}>{ROUNDING_MODES.map((mode) => <option value={mode.value} key={mode.value}>{mode.label}</option>)}</select></label>
              </div>
              <label className="field-label">振込先<textarea value={form.bankSnapshot?.bankAccount || ''} onChange={(event) => updateField('bankSnapshot', { ...(form.bankSnapshot ?? {}), bankAccount: event.target.value })} /></label>
              <label className="field-label">備考<textarea value={form.remarks} onChange={(event) => updateField('remarks', event.target.value)} /></label>

              <div className="section-heading">
                <div>
                  <h3>入金管理</h3>
                  <span>複数回入金や一部入金を記録します。</span>
                </div>
                <button type="button" className="ghost-button" onClick={addPayment}>入金追加</button>
              </div>
              {form.payments.map((payment) => (
                <article className="karte-mini-card" key={payment.id}>
                  <div className="date-grid">
                    <label className="field-label">入金日<input type="date" value={payment.paidAt} onChange={(event) => updatePayment(payment.id, 'paidAt', event.target.value)} /></label>
                    <label className="field-label">金額<input inputMode="decimal" value={payment.amount} onChange={(event) => updatePayment(payment.id, 'amount', event.target.value)} /></label>
                    <label className="field-label">方法<select value={payment.method} onChange={(event) => updatePayment(payment.id, 'method', event.target.value)}>{INVOICE_PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</select></label>
                  </div>
                  <label className="field-label">メモ<input value={payment.memo} onChange={(event) => updatePayment(payment.id, 'memo', event.target.value)} /></label>
                  <button type="button" className="ghost-button danger" onClick={() => removePayment(payment.id)}>入金削除</button>
                </article>
              ))}
            </div>

            <aside className="sample-form">
              <div className="price-preview">
                <div><span>税抜合計</span><strong>{formatPrice(totals.subtotal) || '-'} 円</strong></div>
                <div><span>消費税</span><strong>{formatPrice(totals.taxAmount) || '-'} 円</strong></div>
                <div><span>税込請求額</span><strong>{formatPrice(totals.grandTotal) || '-'} 円</strong></div>
                <div><span>入金額</span><strong>{formatPrice(totals.paidAmount) || '-'} 円</strong></div>
                <div><span>未入金</span><strong>{formatPrice(totals.unpaidAmount) || '-'} 円</strong></div>
              </div>
              {totals.unpaidAmount < 0 && <p className="form-error-message">過入金の可能性があります。</p>}
              {!form.issuerSnapshot?.registrationNumber && <p className="notice-text">発行元の登録番号が未設定です。適格請求書として使う前に税理士等へ確認してください。</p>}
              <div className="sample-form">
                <h3>税率別集計</h3>
                {totals.taxBreakdown.map((item) => (
                  <p key={item.rate}>{item.rate}%: 対価 {invoiceMoney(item.taxableAmount)} / 税 {invoiceMoney(item.tax)}</p>
                ))}
              </div>
              <div className="mail-action-row">
                <button type="button" className="ghost-button" onClick={handlePreview}>PDFプレビュー</button>
                <button type="button" className="ghost-button" onClick={handleDownload}>PDFダウンロード</button>
                <button type="button" className="primary-button" disabled={saving} onClick={() => handleSave({ generatePdf: true })}>{saving ? '保存中...' : '保存してPDF出力'}</button>
                <button type="button" className="ghost-button" disabled={saving} onClick={() => handleSave({ generatePdf: false })}>下書き保存</button>
              </div>
              {message && <p className={message.includes('失敗') || message.includes('入力') || message.includes('選択') ? 'form-error-message' : 'notice-text'}>{message}</p>}
              {form.invoicePdfUrl && <p className="notice-text">PDF: <a href={form.invoicePdfUrl} target="_blank" rel="noreferrer">{form.invoicePdfFileName || 'PDFを開く'}</a></p>}
              {selectedProject && <p className="inline-helper">案件: {selectedProject.title}</p>}
            </aside>
          </div>
          {previewHtml && <div className="quote-preview-frame" dangerouslySetInnerHTML={{ __html: previewHtml }} />}
        </section>
      )}

      <DesktopTable
        actions={(invoice) => (
          <>
            <button type="button" className="ghost-button" onClick={() => startEdit(invoice)}>編集</button>
            <button type="button" className="ghost-button" onClick={() => duplicateInvoice(invoice)}>複製</button>
            {invoice.invoicePdfUrl && <a className="ghost-button external-button" href={invoice.invoicePdfUrl} target="_blank" rel="noreferrer">PDF</a>}
            <button type="button" className="ghost-button danger" onClick={() => removeInvoice?.(invoice.id)}>取消/削除</button>
          </>
        )}
        actionWidth="280px"
        className="invoices-common-table"
        columns={columns}
        minWidth={1460}
        rows={filteredInvoices}
        emptyMessage="請求書がありません"
      />

      <div className="card-grid two-column-grid desktop-card-fallback">
        {filteredInvoices.map((invoice) => (
          <article className="company-card" key={invoice.id}>
            <div className="company-heading">
              <h3>{invoice.invoiceNumber || '請求書番号未設定'}</h3>
              <p>{invoice.billingName || customerName(customerMap.get(invoice.customerId))}</p>
            </div>
            <div className="lead-badges">
              <span className="info-badge">{invoice.status}</span>
              {invoice.unpaidAmount > 0 && <span className="info-badge failed">未入金 {invoiceMoney(invoice.unpaidAmount)}</span>}
            </div>
            <p>{invoice.subject || '-'}</p>
            <p className="inline-helper">請求額 {invoiceMoney(invoice.grandTotal)} / 支払期限 {formatDate(invoice.dueDate)}</p>
            <div className="card-actions">
              <button type="button" className="ghost-button" onClick={() => startEdit(invoice)}>編集</button>
              {invoice.invoicePdfUrl && <a className="ghost-button external-button" href={invoice.invoicePdfUrl} target="_blank" rel="noreferrer">PDF</a>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
