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
import { SALES_ORDER_SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_LABELS } from '../../shipments/hooks/useShipments.js';

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : '-';
}

function money(value) {
  return `${formatPrice(value) || '0'}円`;
}

const PRIORITY_OPTIONS = [
  { value: 1, label: '1 最優先' },
  { value: 2, label: '2 高' },
  { value: 3, label: '3 通常' },
  { value: 4, label: '4 低' },
  { value: 5, label: '5 最低' },
];

const RESERVATION_STATUS_LABELS = {
  unreserved: '未引当',
  partial: '一部引当',
  reserved: '全量引当',
  shortage: '不足',
};

function numberValue(value) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function netReserved(reservation) {
  if (!['active', 'partially_fulfilled'].includes(reservation.status)) return 0;
  return Math.max(0, numberValue(reservation.reservedQuantity) - numberValue(reservation.fulfilledQuantity) - numberValue(reservation.releasedQuantity));
}

function isUsableLot(lot) {
  const today = todayString();
  if (lot.status !== 'active') return false;
  if (lot.expiryDate && lot.expiryDate < today) return false;
  return numberValue(lot.availableQuantity) > 0;
}

function lotAvailableQuantity(lot) {
  return Math.max(0, numberValue(lot.availableQuantity) || (numberValue(lot.quantity) - numberValue(lot.reservedQuantity)));
}

function reservationStatusLabel(status) {
  return RESERVATION_STATUS_LABELS[status] || status || '未引当';
}

function shipmentStatusLabel(status) {
  return SALES_ORDER_SHIPMENT_STATUS_LABELS[status] || status || '未出荷';
}

function shipmentDocumentStatusLabel(status) {
  return SHIPMENT_STATUS_LABELS[status] || status || '-';
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
  shipments = [],
  addSalesOrder,
  updateSalesOrder,
  removeSalesOrder,
  customers = [],
  contacts = [],
  projects = [],
  quotes = [],
  issuers = [],
  products = [],
  inventoryLots = [],
  inventoryReservations = [],
  reserveLineFefo,
  reserveLineLot,
  releaseLineReservations,
  reallocateLineFefo,
  createShipmentFromOrder,
  updateShipmentStatus,
  shipShipment,
  cancelShipment,
  reloadShipments,
  reloadInventory,
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
  const [reservationBusy, setReservationBusy] = useState('');
  const [selectedLotByLine, setSelectedLotByLine] = useState({});
  const [reservationQuantityByLine, setReservationQuantityByLine] = useState({});
  const [shipmentBusy, setShipmentBusy] = useState('');
  const [shipmentQuantityByLine, setShipmentQuantityByLine] = useState({});

  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const contactMap = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const issuerMap = useMemo(() => new Map(issuers.map((issuer) => [issuer.id, issuer])), [issuers]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

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

  const activeReservations = useMemo(
    () => inventoryReservations.filter((reservation) => ['active', 'partially_fulfilled'].includes(reservation.status)),
    [inventoryReservations],
  );

  const reservationSummaryByOrder = useMemo(() => {
    const result = new Map();
    salesOrders.forEach((order) => {
      const ordered = order.salesOrderLines.reduce((sum, line) => sum + numberValue(line.quantity), 0);
      const reserved = activeReservations
        .filter((reservation) => reservation.orderId === order.id)
        .reduce((sum, reservation) => sum + netReserved(reservation), 0);
      const shortage = Math.max(0, ordered - reserved);
      const status = ordered <= 0
        ? 'unreserved'
        : reserved >= ordered
          ? 'reserved'
          : reserved > 0
            ? 'partial'
            : 'unreserved';
      result.set(order.id, { ordered, reserved, shortage, status, rate: ordered > 0 ? Math.round((reserved / ordered) * 100) : 0 });
    });
    return result;
  }, [activeReservations, salesOrders]);

  const formReservationSummary = useMemo(() => {
    const lines = form.salesOrderLines.map((line) => {
      const lineReservations = activeReservations.filter((reservation) => reservation.orderId === form.id && reservation.salesOrderLineId === line.id);
      const productLots = inventoryLots.filter((lot) => lot.productId === line.productId && isUsableLot(lot));
      const ordered = numberValue(line.quantity);
      const reserved = lineReservations.reduce((sum, reservation) => sum + netReserved(reservation), 0);
      const available = productLots.reduce((sum, lot) => sum + lotAvailableQuantity(lot), 0);
      const unreserved = Math.max(0, ordered - reserved);
      const shortage = Math.max(0, unreserved - available);
      const status = ordered <= 0
        ? 'unreserved'
        : reserved >= ordered
          ? 'reserved'
          : reserved > 0
            ? 'partial'
            : unreserved > available
              ? 'shortage'
              : 'unreserved';
      return { line, ordered, reserved, unreserved, available, shortage, status, reservations: lineReservations, lots: productLots };
    });
    const ordered = lines.reduce((sum, item) => sum + item.ordered, 0);
    const reserved = lines.reduce((sum, item) => sum + item.reserved, 0);
    const available = lines.reduce((sum, item) => sum + item.available, 0);
    const shortage = lines.reduce((sum, item) => sum + item.shortage, 0);
    return { lines, ordered, reserved, available, shortage, rate: ordered > 0 ? Math.round((reserved / ordered) * 100) : 0 };
  }, [activeReservations, form.id, form.salesOrderLines, inventoryLots]);

  const activeShipments = useMemo(
    () => shipments.filter((shipment) => !shipment.isDeleted && shipment.status !== 'Cancelled'),
    [shipments],
  );

  const shipmentSummaryByOrder = useMemo(() => {
    const result = new Map();
    salesOrders.forEach((order) => {
      const ordered = order.salesOrderLines.reduce((sum, line) => sum + numberValue(line.quantity), 0);
      const shipped = activeShipments
        .filter((shipment) => shipment.salesOrderId === order.id && shipment.status === 'Shipped')
        .flatMap((shipment) => shipment.shipmentLines || [])
        .reduce((sum, line) => sum + numberValue(line.quantity), 0);
      const pending = activeShipments
        .filter((shipment) => shipment.salesOrderId === order.id && shipment.status !== 'Shipped')
        .flatMap((shipment) => shipment.shipmentLines || [])
        .reduce((sum, line) => sum + numberValue(line.quantity), 0);
      const status = ordered <= 0 ? 'unshipped' : shipped >= ordered ? 'shipped' : shipped > 0 ? 'partial' : 'unshipped';
      result.set(order.id, { ordered, shipped, pending, remaining: Math.max(0, ordered - shipped), status });
    });
    return result;
  }, [activeShipments, salesOrders]);

  const formShipments = useMemo(
    () => shipments.filter((shipment) => !shipment.isDeleted && shipment.salesOrderId === form.id),
    [form.id, shipments],
  );

  const formShipmentSummary = useMemo(() => {
    const shippedLines = formShipments
      .filter((shipment) => shipment.status === 'Shipped')
      .flatMap((shipment) => shipment.shipmentLines || []);
    const pendingLines = formShipments
      .filter((shipment) => shipment.status !== 'Cancelled' && shipment.status !== 'Shipped')
      .flatMap((shipment) => shipment.shipmentLines || []);

    const lines = form.salesOrderLines.map((line) => {
      const shipped = shippedLines
        .filter((shipmentLine) => shipmentLine.salesOrderLineId === line.id)
        .reduce((sum, shipmentLine) => sum + numberValue(shipmentLine.quantity), 0);
      const pending = pendingLines
        .filter((shipmentLine) => shipmentLine.salesOrderLineId === line.id)
        .reduce((sum, shipmentLine) => sum + numberValue(shipmentLine.quantity), 0);
      const ordered = numberValue(line.quantity);
      return {
        line,
        ordered,
        shipped,
        pending,
        remaining: Math.max(0, ordered - shipped),
      };
    });
    const ordered = lines.reduce((sum, item) => sum + item.ordered, 0);
    const shipped = lines.reduce((sum, item) => sum + item.shipped, 0);
    const pending = lines.reduce((sum, item) => sum + item.pending, 0);
    const status = ordered <= 0 ? 'unshipped' : shipped >= ordered ? 'shipped' : shipped > 0 ? 'partial' : 'unshipped';
    return { lines, ordered, shipped, pending, remaining: Math.max(0, ordered - shipped), status };
  }, [form.salesOrderLines, formShipments]);

  const columns = [
    { key: 'salesOrderNumber', label: '受注番号', minWidth: '160px', render: (order) => <strong>{order.salesOrderNumber || '-'}</strong> },
    { key: 'customer', label: '顧客', minWidth: '220px', render: (order) => customerName(customerMap.get(order.customerId)) },
    { key: 'subject', label: '件名', minWidth: '220px', render: (order) => order.subject || '-' },
    { key: 'source', label: '元帳票', minWidth: '180px', render: sourceLabel },
    { key: 'orderDate', label: '受注日', minWidth: '110px', render: (order) => formatDate(order.orderDate) },
    { key: 'expectedDeliveryDate', label: '納品予定', minWidth: '110px', render: (order) => formatDate(order.expectedDeliveryDate) },
    { key: 'priority', label: '優先度', minWidth: '100px', render: (order) => PRIORITY_OPTIONS.find((item) => item.value === Number(order.priority || 3))?.label || '3 通常' },
    { key: 'reservationStatus', label: '引当状況', minWidth: '130px', render: (order) => {
      const summary = reservationSummaryByOrder.get(order.id);
      return `${reservationStatusLabel(summary?.status)} ${summary?.rate || 0}%`;
    } },
    { key: 'shipmentStatus', label: '出荷状況', minWidth: '130px', render: (order) => {
      const summary = shipmentSummaryByOrder.get(order.id);
      return `${shipmentStatusLabel(summary?.status)} ${summary?.shipped || 0}/${summary?.ordered || 0}`;
    } },
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

  async function runReservationAction(lineId, action) {
    if (!editingId) {
      setMessage('在庫引当は受注を保存してから実行してください。');
      return;
    }
    setReservationBusy(lineId);
    setMessage('');
    try {
      await action();
      await reloadInventory?.();
      setMessage('在庫引当を更新しました。');
    } catch (error) {
      setMessage(error.message || '在庫引当に失敗しました。');
    } finally {
      setReservationBusy('');
    }
  }

  function autoReserveLine(line) {
    return runReservationAction(line.id, () => reserveLineFefo?.(form.id, line.id, reservationQuantityByLine[line.id] || null));
  }

  function reserveSelectedLot(line) {
    const lotId = selectedLotByLine[line.id];
    if (!lotId) {
      setMessage('引当するロットを選択してください。');
      return;
    }
    return runReservationAction(line.id, () => reserveLineLot?.(form.id, line.id, lotId, reservationQuantityByLine[line.id] || null));
  }

  function releaseLine(line) {
    return runReservationAction(line.id, () => releaseLineReservations?.(form.id, line.id, null, reservationQuantityByLine[line.id] || null));
  }

  function reallocateLine(line) {
    return runReservationAction(line.id, () => reallocateLineFefo?.(form.id, line.id, reservationQuantityByLine[line.id] || null));
  }

  async function runShipmentAction(action) {
    if (!editingId) {
      setMessage('出荷登録は受注を保存してから実行してください。');
      return;
    }
    setShipmentBusy('order');
    setMessage('');
    try {
      await action();
      await Promise.all([reloadShipments?.(), reloadInventory?.()]);
      setMessage('出荷情報を更新しました。');
    } catch (error) {
      setMessage(error.message || '出荷処理に失敗しました。');
    } finally {
      setShipmentBusy('');
    }
  }

  function createFullShipment() {
    return runShipmentAction(() => createShipmentFromOrder?.({
      salesOrderId: form.id,
      lines: null,
      status: 'Draft',
      shipmentDate: todayString(),
      plannedDeliveryDate: form.expectedDeliveryDate || '',
      note: 'full shipment from sales order',
    }));
  }

  function createPartialShipment() {
    const lines = form.salesOrderLines
      .map((line) => ({
        salesOrderLineId: line.id,
        quantity: shipmentQuantityByLine[line.id] || '',
      }))
      .filter((line) => numberValue(line.quantity) > 0);
    if (!lines.length) {
      setMessage('一部出荷する数量を入力してください。');
      return;
    }
    return runShipmentAction(() => createShipmentFromOrder?.({
      salesOrderId: form.id,
      lines,
      status: 'Draft',
      shipmentDate: todayString(),
      plannedDeliveryDate: form.expectedDeliveryDate || '',
      note: 'partial shipment from sales order',
    }));
  }

  function changeShipmentStatus(shipment, status) {
    return runShipmentAction(() => {
      if (status === 'Shipped') return shipShipment?.(shipment.id, { shipmentDate: shipment.shipmentDate || todayString() });
      if (status === 'Cancelled') return cancelShipment?.(shipment.id);
      return updateShipmentStatus?.(shipment.id, status, { shipmentDate: shipment.shipmentDate || todayString() });
    });
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
                <label className="field-label">優先度<select value={form.priority || 3} onChange={(event) => updateField('priority', Number(event.target.value))}>{PRIORITY_OPTIONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
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

              <div className="section-heading">
                <div>
                  <h3>在庫引当</h3>
                  <span>FEFO自動引当、ロット指定引当、引当解除を受注明細ごとに実行します。</span>
                </div>
              </div>
              {!editingId && <p className="notice-text">在庫引当は受注を保存してから実行できます。</p>}
              {formReservationSummary.lines.map(({ line, ordered, reserved, unreserved, available, shortage, status, reservations, lots }) => {
                const product = productMap.get(line.productId);
                return (
                  <article className="karte-mini-card" key={`reserve-${line.id}`}>
                    <div className="history-meta">
                      <strong>{line.productName || product?.name || '商品未設定'}</strong>
                      <span className={shortage > 0 ? 'form-error-message' : 'notice-text'}>{reservationStatusLabel(status)}</span>
                    </div>
                    <div className="date-grid">
                      <div><span>受注数量</span><strong>{ordered.toLocaleString('ja-JP')} {line.unit || ''}</strong></div>
                      <div><span>引当済</span><strong>{reserved.toLocaleString('ja-JP')} {line.unit || ''}</strong></div>
                      <div><span>未引当</span><strong>{unreserved.toLocaleString('ja-JP')} {line.unit || ''}</strong></div>
                      <div><span>使用可能在庫</span><strong>{available.toLocaleString('ja-JP')} {line.unit || ''}</strong></div>
                      <div><span>不足数量</span><strong className={shortage > 0 ? 'danger-text' : ''}>{shortage.toLocaleString('ja-JP')} {line.unit || ''}</strong></div>
                    </div>
                    <div className="date-grid">
                      <label className="field-label">引当数量<input inputMode="decimal" value={reservationQuantityByLine[line.id] || ''} onChange={(event) => setReservationQuantityByLine((current) => ({ ...current, [line.id]: event.target.value }))} placeholder="空欄なら未引当分" /></label>
                      <label className="field-label">ロット指定<select value={selectedLotByLine[line.id] || ''} onChange={(event) => setSelectedLotByLine((current) => ({ ...current, [line.id]: event.target.value }))}><option value="">FEFO自動</option>{lots.map((lot) => <option value={lot.id} key={lot.id}>{[lot.inventoryCode, lot.lotNumber && `LOT ${lot.lotNumber}`, lot.expiryDate && `賞味 ${lot.expiryDate}`, `${lotAvailableQuantity(lot).toLocaleString('ja-JP')}${lot.unit || ''}`].filter(Boolean).join(' / ')}</option>)}</select></label>
                    </div>
                    <div className="mail-action-row">
                      <button type="button" className="primary-button" disabled={!editingId || reservationBusy === line.id} onClick={() => autoReserveLine(line)}>自動引当</button>
                      <button type="button" className="ghost-button" disabled={!editingId || reservationBusy === line.id} onClick={() => reserveSelectedLot(line)}>ロット指定</button>
                      <button type="button" className="ghost-button" disabled={!editingId || reservationBusy === line.id} onClick={() => reallocateLine(line)}>再引当</button>
                      <button type="button" className="ghost-button danger" disabled={!editingId || reservationBusy === line.id || reservations.length === 0} onClick={() => releaseLine(line)}>解除</button>
                    </div>
                    {reservations.length > 0 && (
                      <div className="timeline-list">
                        {reservations.map((reservation) => {
                          const lot = inventoryLots.find((item) => item.id === reservation.inventoryLotId);
                          return (
                            <div className="timeline-item" key={reservation.id}>
                              <strong>{netReserved(reservation).toLocaleString('ja-JP')} {reservation.unit || lot?.unit || line.unit}</strong>
                              <span>{[lot?.inventoryCode, lot?.lotNumber && `LOT ${lot.lotNumber}`, lot?.expiryDate && `賞味 ${lot.expiryDate}`].filter(Boolean).join(' / ') || 'ロット情報なし'}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}

              <div className="section-heading">
                <div>
                  <h3>出荷</h3>
                  <span>受注から出荷を作成し、Shipped時に在庫と引当を確定します。</span>
                </div>
                <div className="mail-action-row">
                  <button type="button" className="primary-button" disabled={!editingId || shipmentBusy === 'order'} onClick={createFullShipment}>全量出荷登録</button>
                  <button type="button" className="ghost-button" disabled={!editingId || shipmentBusy === 'order'} onClick={createPartialShipment}>一部出荷登録</button>
                </div>
              </div>
              {!editingId && <p className="notice-text">出荷登録は受注を保存してから実行できます。</p>}
              <div className="price-preview">
                <div><span>受注数量</span><strong>{formShipmentSummary.ordered.toLocaleString('ja-JP')}</strong></div>
                <div><span>出荷済</span><strong>{formShipmentSummary.shipped.toLocaleString('ja-JP')}</strong></div>
                <div><span>出荷予定</span><strong>{formShipmentSummary.pending.toLocaleString('ja-JP')}</strong></div>
                <div><span>残数量</span><strong className={formShipmentSummary.remaining > 0 ? '' : 'notice-text'}>{formShipmentSummary.remaining.toLocaleString('ja-JP')}</strong></div>
                <div><span>出荷状況</span><strong>{shipmentStatusLabel(formShipmentSummary.status)}</strong></div>
              </div>
              {formShipmentSummary.lines.map(({ line, ordered, shipped, pending, remaining }) => (
                <article className="karte-mini-card" key={`shipment-plan-${line.id}`}>
                  <div className="history-meta">
                    <strong>{line.productName || productMap.get(line.productId)?.name || '商品未設定'}</strong>
                    <span>{shipped.toLocaleString('ja-JP')} / {ordered.toLocaleString('ja-JP')} {line.unit || ''}</span>
                  </div>
                  <div className="date-grid">
                    <div><span>出荷済</span><strong>{shipped.toLocaleString('ja-JP')} {line.unit || ''}</strong></div>
                    <div><span>出荷予定</span><strong>{pending.toLocaleString('ja-JP')} {line.unit || ''}</strong></div>
                    <div><span>残数量</span><strong>{remaining.toLocaleString('ja-JP')} {line.unit || ''}</strong></div>
                    <label className="field-label">一部出荷数量<input inputMode="decimal" value={shipmentQuantityByLine[line.id] || ''} onChange={(event) => setShipmentQuantityByLine((current) => ({ ...current, [line.id]: event.target.value }))} placeholder="例: 10" /></label>
                  </div>
                </article>
              ))}
              <div className="timeline-list">
                {formShipments.length > 0 ? formShipments.map((shipment) => (
                  <div className="timeline-item" key={shipment.id}>
                    <strong>{shipment.shipmentNumber} / {shipmentDocumentStatusLabel(shipment.status)}</strong>
                    <span>{formatDate(shipment.shipmentDate)} / {shipment.shipmentLines.reduce((sum, line) => sum + numberValue(line.quantity), 0).toLocaleString('ja-JP')}</span>
                    <div className="mail-action-row">
                      <button type="button" className="ghost-button" disabled={shipment.status === 'Shipped' || shipment.status === 'Cancelled' || shipmentBusy === 'order'} onClick={() => changeShipmentStatus(shipment, 'Picking')}>Picking</button>
                      <button type="button" className="ghost-button" disabled={shipment.status === 'Shipped' || shipment.status === 'Cancelled' || shipmentBusy === 'order'} onClick={() => changeShipmentStatus(shipment, 'Ready')}>Ready</button>
                      <button type="button" className="primary-button" disabled={shipment.status === 'Shipped' || shipment.status === 'Cancelled' || shipmentBusy === 'order'} onClick={() => changeShipmentStatus(shipment, 'Shipped')}>Shipped</button>
                      <button type="button" className="ghost-button danger" disabled={shipment.status === 'Cancelled' || shipmentBusy === 'order'} onClick={() => changeShipmentStatus(shipment, 'Cancelled')}>取消</button>
                    </div>
                    <div className="timeline-list">
                      {shipment.shipmentLines.map((shipmentLine) => {
                        const lot = inventoryLots.find((item) => item.id === shipmentLine.inventoryLotId);
                        const sourceLine = form.salesOrderLines.find((item) => item.id === shipmentLine.salesOrderLineId);
                        return (
                          <div className="timeline-item" key={shipmentLine.id}>
                            <strong>{sourceLine?.productName || productMap.get(shipmentLine.productId)?.name || shipmentLine.productId}</strong>
                            <span>{[
                              shipmentLine.lotSnapshot?.inventoryCode || lot?.inventoryCode,
                              shipmentLine.lotSnapshot?.lotNumber || lot?.lotNumber,
                              shipmentLine.expirySnapshot || lot?.expiryDate,
                              lot?.location,
                              `${shipmentLine.quantity.toLocaleString('ja-JP')} ${shipmentLine.unit || lot?.unit || sourceLine?.unit || ''}`,
                            ].filter(Boolean).join(' / ')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )) : <p className="notice-text">出荷履歴はまだありません。</p>}
              </div>
              <label className="field-label">メモ<textarea value={form.memo} onChange={(event) => updateField('memo', event.target.value)} /></label>
            </div>

            <aside className="sample-form">
              <div className="price-preview">
                <div><span>税抜小計</span><strong>{money(normalizeSalesOrder(form).subtotal)}</strong></div>
                <div><span>消費税</span><strong>{money(normalizeSalesOrder(form).taxAmount)}</strong></div>
                <div><span>税込合計</span><strong>{money(normalizeSalesOrder(form).grandTotal)}</strong></div>
              </div>
              <div className="price-preview">
                <div><span>現在庫</span><strong>{formReservationSummary.lines.reduce((sum, item) => sum + item.available + item.reserved, 0).toLocaleString('ja-JP')}</strong></div>
                <div><span>引当済</span><strong>{formReservationSummary.reserved.toLocaleString('ja-JP')}</strong></div>
                <div><span>使用可能在庫</span><strong>{formReservationSummary.available.toLocaleString('ja-JP')}</strong></div>
                <div><span>受注数量</span><strong>{formReservationSummary.ordered.toLocaleString('ja-JP')}</strong></div>
                <div><span>不足数量</span><strong className={formReservationSummary.shortage > 0 ? 'danger-text' : ''}>{formReservationSummary.shortage.toLocaleString('ja-JP')}</strong></div>
                <div><span>引当率</span><strong>{formReservationSummary.rate}%</strong></div>
              </div>
              <div className="price-preview">
                <div><span>出荷状況</span><strong>{shipmentStatusLabel(formShipmentSummary.status)}</strong></div>
                <div><span>出荷済</span><strong>{formShipmentSummary.shipped.toLocaleString('ja-JP')}</strong></div>
                <div><span>出荷予定</span><strong>{formShipmentSummary.pending.toLocaleString('ja-JP')}</strong></div>
                <div><span>残数量</span><strong>{formShipmentSummary.remaining.toLocaleString('ja-JP')}</strong></div>
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
        minWidth={1660}
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
              <span className="info-badge">{reservationStatusLabel(reservationSummaryByOrder.get(order.id)?.status)}</span>
              <span className="info-badge">{shipmentStatusLabel(shipmentSummaryByOrder.get(order.id)?.status)}</span>
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
