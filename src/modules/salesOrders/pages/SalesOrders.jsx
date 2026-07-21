import { useEffect, useMemo, useState } from 'react';
import DesktopTable from '../../../shared/components/DesktopTable.jsx';
import { formatPrice } from '../../products/hooks/useProducts.js';
import {
  SALES_ORDER_STATUSES,
  buildSalesOrderDraft,
  emptySalesOrderLine,
  generateSalesOrderNumber,
  normalizeSalesOrder,
} from '../hooks/useSalesOrders.js';

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : '-';
}

function money(value) {
  return `${formatPrice(value) || '0'}円`;
}

function customerName(customer) {
  return customer?.companyName || customer?.name || '-';
}

function sourceLabel(order) {
  if (order.sourceType === 'confirmation') return `成約確認書 / ${order.sourceSnapshot?.quoteNumber || order.confirmationQuoteId || '-'}`;
  if (order.sourceType === 'quote') return `見積書 / ${order.sourceSnapshot?.quoteNumber || order.quoteId || '-'}`;
  return '手動';
}

function sourceKey(order) {
  if (order.sourceType === 'confirmation' && order.confirmationQuoteId) return `confirmation:${order.confirmationQuoteId}`;
  if (order.sourceType === 'quote' && order.quoteId) return `quote:${order.quoteId}`;
  return '';
}

function makeManualDraft({ orders, issuers, user }) {
  const issuer = issuers.find((item) => item.isDefault && item.isActive !== false) || issuers.find((item) => item.isActive !== false) || issuers[0];
  return buildSalesOrderDraft({
    sourceType: 'manual',
    issuer,
    orders,
    user,
    initial: {
      issuerId: issuer?.id || '',
      orderDate: todayString(),
      salesOrderNumber: generateSalesOrderNumber(orders, issuer?.id || ''),
      salesOrderLines: [emptySalesOrderLine()],
    },
  });
}

export default function SalesOrders({
  salesOrders = [],
  addSalesOrder,
  updateSalesOrder,
  removeSalesOrder,
  customers = [],
  contacts = [],
  projects = [],
  quotes = [],
  issuers = [],
  initialDraft = null,
  onDraftHandled,
  onOpenKarte,
  onOpenProject,
  user,
}) {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(() => makeManualDraft({ orders: salesOrders, issuers, user }));
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const contactMap = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const issuerMap = useMemo(() => new Map(issuers.map((issuer) => [issuer.id, issuer])), [issuers]);

  useEffect(() => {
    if (!initialDraft) return;
    setForm(normalizeSalesOrder(initialDraft, user?.id || ''));
    setEditingId(initialDraft.id || '');
    setFormOpen(true);
    setMessage('');
    onDraftHandled?.();
  }, [initialDraft, onDraftHandled, user]);

  const visibleOrders = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return salesOrders
      .filter((order) => !order.isDeleted)
      .filter((order) => !statusFilter || order.status === statusFilter)
      .filter((order) => {
        if (!normalizedKeyword) return true;
        const customer = customerMap.get(order.customerId);
        const project = projectMap.get(order.projectId);
        return [
          order.salesOrderNumber,
          order.subject,
          order.status,
          order.sourceSnapshot?.quoteNumber,
          customer?.companyName,
          project?.title,
        ].some((value) => String(value || '').toLowerCase().includes(normalizedKeyword));
      });
  }, [customerMap, keyword, projectMap, salesOrders, statusFilter]);

  const relatedContacts = contacts.filter((contact) => !form.customerId || contact.customerId === form.customerId);
  const duplicateSource = useMemo(() => {
    const key = sourceKey(form);
    if (!key) return null;
    return salesOrders.find((order) => !order.isDeleted && order.id !== form.id && sourceKey(order) === key);
  }, [form, salesOrders]);

  const columns = [
    { key: 'salesOrderNumber', label: '受注番号', minWidth: '160px', render: (order) => <strong>{order.salesOrderNumber || '-'}</strong> },
    { key: 'customer', label: '顧客', minWidth: '220px', render: (order) => customerName(customerMap.get(order.customerId)) },
    { key: 'subject', label: '件名', minWidth: '220px', render: (order) => order.subject || '-' },
    { key: 'source', label: '元帳票', minWidth: '180px', render: sourceLabel },
    { key: 'orderDate', label: '受注日', minWidth: '110px', render: (order) => formatDate(order.orderDate) },
    { key: 'expectedDeliveryDate', label: '納品予定', minWidth: '110px', render: (order) => formatDate(order.expectedDeliveryDate) },
    { key: 'grandTotal', label: '受注金額', minWidth: '120px', render: (order) => money(order.grandTotal) },
    { key: 'status', label: 'ステータス', minWidth: '110px', render: (order) => order.status || '-' },
    { key: 'updatedAt', label: '更新日', minWidth: '130px', render: (order) => formatDate(order.updatedAt) },
  ];

  function startNew() {
    setEditingId('');
    setForm(makeManualDraft({ orders: salesOrders, issuers, user }));
    setFormOpen(true);
    setMessage('');
  }

  function startEdit(order) {
    setEditingId(order.id);
    setForm(normalizeSalesOrder(order, user?.id || ''));
    setFormOpen(true);
    setMessage('');
  }

  function createFromQuote(quoteId, sourceType = 'quote') {
    const quote = quotes.find((item) => item.id === quoteId);
    if (!quote) return;
    const customer = customerMap.get(quote.customerId);
    const contact = contactMap.get(quote.contactIds?.[0]);
    const project = projectMap.get(quote.projectId);
    const issuer = issuerMap.get(quote.issuerId);
    setEditingId('');
    setForm(buildSalesOrderDraft({ sourceType, quote, customer, contact, project, issuer, orders: salesOrders, user }));
    setFormOpen(true);
    setMessage('');
  }

  function updateField(field, value) {
    setMessage('');
    setForm((current) => {
      if (field === 'customerId') {
        const customer = customerMap.get(value);
        return { ...current, customerId: value, customerSnapshot: customer ? { ...customer } : current.customerSnapshot };
      }
      if (field === 'issuerId') {
        const issuer = issuerMap.get(value);
        return {
          ...current,
          issuerId: value,
          salesOrderNumber: current.salesOrderNumber || generateSalesOrderNumber(salesOrders, value),
          issuerSnapshot: issuer ? { ...issuer } : current.issuerSnapshot,
        };
      }
      return { ...current, [field]: value };
    });
  }

  function updateLine(lineId, field, value) {
    setForm((current) => ({
      ...current,
      salesOrderLines: current.salesOrderLines.map((line) => (line.id === lineId ? { ...line, [field]: value } : line)),
    }));
  }

  function addLine() {
    setForm((current) => ({
      ...current,
      salesOrderLines: [...current.salesOrderLines, { ...emptySalesOrderLine(), lineNumber: current.salesOrderLines.length + 1 }],
    }));
  }

  function removeLine(lineId) {
    setForm((current) => {
      const lines = current.salesOrderLines.filter((line) => line.id !== lineId);
      return { ...current, salesOrderLines: lines.length ? lines : [emptySalesOrderLine()] };
    });
  }

  function validate() {
    if (!form.salesOrderNumber.trim()) return '受注番号を入力してください。';
    if (!form.customerId) return '顧客を選択してください。';
    if (!form.issuerId && !form.issuerSnapshot?.name) return '発行元を選択してください。';
    if (!form.salesOrderLines.length || form.salesOrderLines.some((line) => !String(line.productName || '').trim())) return '明細の商品名を入力してください。';
    return '';
  }

  function saveOrder(event) {
    event.preventDefault();
    const validation = validate();
    if (validation) {
      setMessage(validation);
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const payload = normalizeSalesOrder({
      ...form,
      updatedBy: user?.id || '',
      updatedByName: user?.email || '',
      confirmedAt: form.status === '受注確定' ? form.confirmedAt || now : form.confirmedAt,
    }, user?.id || '');
    try {
      if (salesOrders.some((order) => order.id === payload.id)) {
        updateSalesOrder?.(payload.id, payload);
      } else {
        addSalesOrder?.(payload);
      }
      setEditingId(payload.id);
      setForm(payload);
      setMessage('受注を保存しました。');
    } catch (error) {
      setMessage(error.message || '受注の保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page sales-orders-page">
      <div className="page-header">
        <p className="eyebrow">Sales Orders</p>
        <h1>受注管理</h1>
        <p>見積書または成約確認書の内容を固定スナップショットとして受注へ引き継ぎます。</p>
      </div>

      <section className="sync-status-card">
        <div>
          <span>受注一覧</span>
          <strong>{visibleOrders.length}件</strong>
        </div>
        <div className="date-grid">
          <label className="field-label">検索<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="受注番号・顧客・件名で検索" /></label>
          <label className="field-label">ステータス<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">すべて</option>{SALES_ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="field-label">見積から作成<select value="" onChange={(event) => createFromQuote(event.target.value, 'quote')}><option value="">元見積を選択</option>{quotes.map((quote) => <option value={quote.id} key={quote.id}>{quote.quoteNumber || quote.projectName || quote.id}</option>)}</select></label>
          <label className="field-label">成約確認書から作成<select value="" onChange={(event) => createFromQuote(event.target.value, 'confirmation')}><option value="">元成約確認書を選択</option>{quotes.filter((quote) => quote.confirmationPdfUrl || quote.acceptedAt).map((quote) => <option value={quote.id} key={quote.id}>{quote.quoteNumber || quote.projectName || quote.id}</option>)}</select></label>
        </div>
        <button type="button" className="primary-button" onClick={startNew}>＋受注作成</button>
      </section>

      {formOpen && (
        <form className="sync-status-card invoice-editor" onSubmit={saveOrder}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{editingId ? 'Edit Sales Order' : 'New Sales Order'}</p>
              <h2>{form.salesOrderNumber || '受注作成'}</h2>
              <span>{sourceLabel(form)}</span>
            </div>
            <button type="button" className="ghost-button" onClick={() => setFormOpen(false)}>閉じる</button>
          </div>

          {duplicateSource && (
            <p className="form-error-message">同じ元帳票から受注が作成済みです: {duplicateSource.salesOrderNumber}</p>
          )}

          <div className="invoice-editor-grid">
            <div className="sample-form">
              <div className="date-grid">
                <label className="field-label">受注番号<input value={form.salesOrderNumber} onChange={(event) => updateField('salesOrderNumber', event.target.value)} disabled={editingId && form.status === '受注確定'} /></label>
                <label className="field-label">ステータス<select value={form.status} onChange={(event) => updateField('status', event.target.value)}>{SALES_ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
                <label className="field-label">顧客<select value={form.customerId} onChange={(event) => updateField('customerId', event.target.value)}><option value="">未選択</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.companyName}</option>)}</select></label>
                <label className="field-label">担当者<select value={form.contactId} onChange={(event) => updateField('contactId', event.target.value)}><option value="">未選択</option>{relatedContacts.map((contact) => <option value={contact.id} key={contact.id}>{contact.name}</option>)}</select></label>
                <label className="field-label">案件<select value={form.projectId} onChange={(event) => updateField('projectId', event.target.value)}><option value="">未選択</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.title || project.projectCode}</option>)}</select></label>
                <label className="field-label">発行元<select value={form.issuerId} onChange={(event) => updateField('issuerId', event.target.value)}><option value="">未選択</option>{issuers.filter((issuer) => issuer.isActive !== false).map((issuer) => <option value={issuer.id} key={issuer.id}>{issuer.name || issuer.legalName}</option>)}</select></label>
                <label className="field-label">受注日<input type="date" value={form.orderDate} onChange={(event) => updateField('orderDate', event.target.value)} /></label>
                <label className="field-label">納品予定日<input type="date" value={form.expectedDeliveryDate} onChange={(event) => updateField('expectedDeliveryDate', event.target.value)} /></label>
              </div>
              <label className="field-label">件名<input value={form.subject} onChange={(event) => updateField('subject', event.target.value)} /></label>

              <div className="section-heading">
                <div>
                  <h3>受注明細</h3>
                  <span>元帳票の内容を受注作成時点でスナップショット保存します。</span>
                </div>
                <button type="button" className="ghost-button" onClick={addLine}>明細追加</button>
              </div>
              {form.salesOrderLines.map((line, index) => (
                <article className="karte-mini-card" key={line.id}>
                  <div className="history-meta">
                    <span>明細 {index + 1}</span>
                    <button type="button" className="ghost-button danger" onClick={() => removeLine(line.id)}>削除</button>
                  </div>
                  <div className="date-grid">
                    <label className="field-label">商品コード<input value={line.productCode} onChange={(event) => updateLine(line.id, 'productCode', event.target.value)} /></label>
                    <label className="field-label">商品名<input value={line.productName} onChange={(event) => updateLine(line.id, 'productName', event.target.value)} /></label>
                    <label className="field-label">規格/荷姿<input value={line.specification} onChange={(event) => updateLine(line.id, 'specification', event.target.value)} /></label>
                    <label className="field-label">温度帯<input value={line.temperatureZone} onChange={(event) => updateLine(line.id, 'temperatureZone', event.target.value)} /></label>
                    <label className="field-label">賞味期限<input value={line.expirationText} onChange={(event) => updateLine(line.id, 'expirationText', event.target.value)} /></label>
                    <label className="field-label">数量<input inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(line.id, 'quantity', event.target.value)} /></label>
                    <label className="field-label">単位<input value={line.unit} onChange={(event) => updateLine(line.id, 'unit', event.target.value)} /></label>
                    <label className="field-label">単価<input inputMode="decimal" value={line.unitPrice} onChange={(event) => updateLine(line.id, 'unitPrice', event.target.value)} /></label>
                    <label className="field-label">税率(%)<input inputMode="decimal" value={line.taxRate} onChange={(event) => updateLine(line.id, 'taxRate', event.target.value)} /></label>
                  </div>
                  <label className="field-label">備考<input value={line.memo} onChange={(event) => updateLine(line.id, 'memo', event.target.value)} /></label>
                </article>
              ))}
              <label className="field-label">メモ<textarea value={form.memo} onChange={(event) => updateField('memo', event.target.value)} /></label>
            </div>

            <aside className="sample-form">
              <div className="price-preview">
                <div><span>税抜小計</span><strong>{money(normalizeSalesOrder(form).subtotal)}</strong></div>
                <div><span>消費税</span><strong>{money(normalizeSalesOrder(form).taxAmount)}</strong></div>
                <div><span>税込合計</span><strong>{money(normalizeSalesOrder(form).grandTotal)}</strong></div>
              </div>
              <div className="sample-form">
                <h3>スナップショット</h3>
                <p>元帳票: {sourceLabel(form)}</p>
                <p>作成後に見積書や成約確認書を変更しても、この受注内容は変わりません。</p>
              </div>
              <div className="mail-action-row">
                <button type="submit" className="primary-button" disabled={saving}>{saving ? '保存中...' : '受注を保存'}</button>
                {editingId && <button type="button" className="ghost-button danger" onClick={() => removeSalesOrder?.(editingId)}>取消/削除</button>}
              </div>
              {message && <p className={message.includes('失敗') || message.includes('入力') || message.includes('選択') ? 'form-error-message' : 'notice-text'}>{message}</p>}
            </aside>
          </div>
        </form>
      )}

      <DesktopTable
        actions={(order) => (
          <>
            <button type="button" className="ghost-button" onClick={() => startEdit(order)}>詳細/編集</button>
            {order.customerId && <button type="button" className="ghost-button" onClick={() => onOpenKarte?.(order.customerId)}>カルテ</button>}
            {order.projectId && <button type="button" className="ghost-button" onClick={() => onOpenProject?.(order.projectId)}>案件</button>}
            <button type="button" className="ghost-button danger" onClick={() => removeSalesOrder?.(order.id)}>取消</button>
          </>
        )}
        actionWidth="320px"
        className="sales-orders-common-table"
        columns={columns}
        minWidth={1420}
        rows={visibleOrders}
        selectedRowId={editingId}
        onRowClick={startEdit}
        emptyMessage="受注がありません"
      />

      <div className="card-grid two-column-grid desktop-card-fallback">
        {visibleOrders.map((order) => (
          <article className="company-card" key={order.id}>
            <div className="company-heading">
              <h3>{order.salesOrderNumber || '受注番号未設定'}</h3>
              <p>{customerName(customerMap.get(order.customerId))}</p>
            </div>
            <div className="lead-badges">
              <span className="info-badge">{order.status}</span>
              <span className="info-badge ready">{money(order.grandTotal)}</span>
            </div>
            <p>{order.subject || '-'}</p>
            <p className="inline-helper">{sourceLabel(order)} / 納品予定 {formatDate(order.expectedDeliveryDate)}</p>
            <div className="card-actions">
              <button type="button" className="ghost-button" onClick={() => startEdit(order)}>詳細/編集</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
