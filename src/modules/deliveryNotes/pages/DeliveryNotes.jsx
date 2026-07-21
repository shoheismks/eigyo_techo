import { useMemo, useState } from 'react';
import DesktopTable from '../../../shared/components/DesktopTable.jsx';
import { uploadAttachment } from '../../../shared/services/storageService.js';
import { productDisplayName, formatPrice } from '../../products/hooks/useProducts.js';
import { DELIVERY_NOTE_STATUS_LABELS, normalizeDeliveryNote } from '../hooks/useDeliveryNotes.js';
import {
  buildDeliveryNotePdfContext,
  calculateDeliveryNoteTotals,
  createDeliveryNotePdfFile,
  downloadDeliveryNotePdf,
  renderDeliveryNotePreviewHtml,
} from '../services/deliveryNotePdfService.js';

function formatDate(value) {
  return value ? String(value).slice(0, 10) : '-';
}

function customerName(customer) {
  return customer?.companyName || customer?.name || '-';
}

function orderNumber(order) {
  return order?.salesOrderNumber || order?.sales_order_number || '-';
}

function shipmentNumber(shipment) {
  return shipment?.shipmentNumber || shipment?.shipment_number || '-';
}

function noteStatusLabel(status) {
  return DELIVERY_NOTE_STATUS_LABELS[status] || status || '-';
}

function lineProductName(line, productMap) {
  return line.productName || line.productSnapshot?.productName || productDisplayName(productMap.get(line.productId), line.productId || '-') || '-';
}

export default function DeliveryNotes({
  deliveryNotes = [],
  shipments = [],
  salesOrders = [],
  customers = [],
  products = [],
  issuers = [],
  createDeliveryNoteFromShipment,
  updateDeliveryNote,
  removeDeliveryNote,
  user,
}) {
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState(deliveryNotes[0]?.id || '');
  const [sourceShipmentId, setSourceShipmentId] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  const shipmentMap = useMemo(() => new Map(shipments.map((shipment) => [shipment.id, shipment])), [shipments]);
  const orderMap = useMemo(() => new Map(salesOrders.map((order) => [order.id, order])), [salesOrders]);
  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const issuerMap = useMemo(() => new Map(issuers.map((issuer) => [issuer.id, issuer])), [issuers]);
  const notesByShipment = useMemo(() => new Map(deliveryNotes.filter((note) => !note.isDeleted).map((note) => [note.shipmentId, note])), [deliveryNotes]);

  const shippedCandidates = useMemo(
    () => shipments.filter((shipment) => shipment.status === 'Shipped' && !shipment.isDeleted),
    [shipments],
  );

  const visibleNotes = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return deliveryNotes
      .filter((note) => !note.isDeleted)
      .filter((note) => {
        if (!normalizedKeyword) return true;
        const shipment = shipmentMap.get(note.shipmentId);
        const order = orderMap.get(note.salesOrderId || shipment?.salesOrderId);
        const customer = customerMap.get(note.customerId || shipment?.customerId || order?.customerId);
        return [
          note.deliveryNoteNumber,
          shipmentNumber(shipment),
          orderNumber(order),
          order?.subject,
          customer?.companyName,
        ].some((value) => String(value || '').toLowerCase().includes(normalizedKeyword));
      });
  }, [customerMap, deliveryNotes, keyword, orderMap, shipmentMap]);

  const selectedNote = visibleNotes.find((note) => note.id === selectedId) || visibleNotes[0] || null;
  const selectedShipment = selectedNote ? shipmentMap.get(selectedNote.shipmentId) : null;
  const selectedOrder = selectedNote ? orderMap.get(selectedNote.salesOrderId || selectedShipment?.salesOrderId) : null;
  const selectedCustomer = selectedNote ? customerMap.get(selectedNote.customerId || selectedShipment?.customerId || selectedOrder?.customerId) : null;
  const selectedIssuer = selectedOrder?.issuerId ? issuerMap.get(selectedOrder.issuerId) : null;
  const selectedTotals = selectedNote ? calculateDeliveryNoteTotals(selectedNote) : { lines: [], subtotal: 0, taxAmount: 0, grandTotal: 0 };

  const columns = [
    { key: 'deliveryNoteNumber', label: '納品番号', minWidth: '170px', render: (note) => <strong>{note.deliveryNoteNumber || '-'}</strong> },
    { key: 'customer', label: '顧客', minWidth: '220px', render: (note) => customerName(customerMap.get(note.customerId || shipmentMap.get(note.shipmentId)?.customerId || orderMap.get(note.salesOrderId)?.customerId)) },
    { key: 'shipment', label: '出荷番号', minWidth: '170px', render: (note) => shipmentNumber(shipmentMap.get(note.shipmentId)) },
    { key: 'order', label: '受注番号', minWidth: '170px', render: (note) => orderNumber(orderMap.get(note.salesOrderId)) },
    { key: 'issueDate', label: '発行日', minWidth: '110px', render: (note) => formatDate(note.issueDate) },
    { key: 'deliveryDate', label: '納品日', minWidth: '110px', render: (note) => formatDate(note.deliveryDate) },
    { key: 'priceVisible', label: '価格表示', minWidth: '100px', render: (note) => (note.priceVisible ? 'ON' : 'OFF') },
    { key: 'status', label: 'ステータス', minWidth: '120px', render: (note) => noteStatusLabel(note.status) },
    { key: 'pdf', label: 'PDF', minWidth: '90px', render: (note) => note.deliveryNotePdfUrl ? <a href={note.deliveryNotePdfUrl} target="_blank" rel="noreferrer">PDF</a> : '-' },
  ];

  async function createFromShipment(shipmentId = sourceShipmentId) {
    if (!shipmentId) {
      setMessage('出荷を選択してください。');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const result = await createDeliveryNoteFromShipment?.({ shipmentId, priceVisible: false });
      const nextId = result?.deliveryNoteId;
      if (nextId) setSelectedId(nextId);
      setPreviewHtml('');
      setMessage(result?.alreadyExists ? '既存の納品書を表示しました。' : '納品書を作成しました。');
    } catch (error) {
      setMessage(`納品書作成に失敗しました: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  function buildContext(note = selectedNote) {
    const shipment = shipmentMap.get(note.shipmentId);
    const order = orderMap.get(note.salesOrderId || shipment?.salesOrderId);
    const customer = customerMap.get(note.customerId || shipment?.customerId || order?.customerId);
    const issuer = order?.issuerSnapshot || issuerMap.get(order?.issuerId) || null;
    return buildDeliveryNotePdfContext({ deliveryNote: note, shipment, salesOrder: order, customer, issuer });
  }

  function updateSelected(updates) {
    if (!selectedNote) return;
    const normalized = normalizeDeliveryNote({ ...selectedNote, ...updates, updatedBy: user?.id || '', updatedByName: user?.email || '' }, user?.id || selectedNote.userId);
    updateDeliveryNote?.(selectedNote.id, normalized);
    setPreviewHtml('');
  }

  function handlePreview() {
    if (!selectedNote) return;
    setPreviewHtml(renderDeliveryNotePreviewHtml(buildContext()));
  }

  function handleDownload() {
    if (!selectedNote) return;
    downloadDeliveryNotePdf(buildContext());
  }

  async function handleSavePdf() {
    if (!selectedNote) return;
    setSaving(true);
    setMessage('');
    try {
      const context = buildContext();
      const pdfFile = createDeliveryNotePdfFile(context);
      const uploadedPdf = await uploadAttachment({
        file: pdfFile,
        userId: user?.id || selectedNote.userId,
        ownerType: 'delivery-note',
        ownerId: selectedNote.id,
        field: 'deliveryNotePdf',
      });
      const generatedAt = new Date().toISOString();
      updateDeliveryNote?.(selectedNote.id, normalizeDeliveryNote({
        ...selectedNote,
        status: selectedNote.deliveryNotePdfUrl ? 'Reissued' : 'Issued',
        deliveryNotePdfUrl: uploadedPdf?.publicUrl || uploadedPdf?.url || '',
        deliveryNotePdfFileName: uploadedPdf?.name || pdfFile.name,
        deliveryNotePdfStoragePath: uploadedPdf?.path || '',
        deliveryNotePdfGeneratedAt: generatedAt,
        deliveryNotePdfHistory: [
          ...(selectedNote.deliveryNotePdfHistory ?? []),
          {
            id: crypto.randomUUID(),
            generatedAt,
            createdBy: user?.id || '',
            createdByName: user?.email || '',
            fileName: uploadedPdf?.name || pdfFile.name,
            url: uploadedPdf?.publicUrl || uploadedPdf?.url || '',
            priceVisible: Boolean(selectedNote.priceVisible),
          },
        ],
      }, user?.id || selectedNote.userId));
      setPreviewHtml(renderDeliveryNotePreviewHtml(context));
      setMessage('納品書PDFを保存しました。');
    } catch (error) {
      setMessage(`PDF保存に失敗しました: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page delivery-notes-page">
      <div className="page-header">
        <p className="eyebrow">Delivery Notes</p>
        <h1>納品書</h1>
        <p>出荷済データから、価格表示を切り替えられる納品書を作成・再発行します。</p>
      </div>

      <section className="sync-status-card">
        <div>
          <span>納品書一覧</span>
          <strong>{visibleNotes.length}件</strong>
        </div>
        <div className="date-grid">
          <label className="field-label">検索<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="納品番号・出荷番号・顧客名で検索" /></label>
          <label className="field-label">出荷から作成<select value={sourceShipmentId} onChange={(event) => setSourceShipmentId(event.target.value)}>
            <option value="">出荷済データを選択</option>
            {shippedCandidates.map((shipment) => {
              const order = orderMap.get(shipment.salesOrderId);
              const customer = customerMap.get(shipment.customerId || order?.customerId);
              const existing = notesByShipment.get(shipment.id);
              return (
                <option value={shipment.id} key={shipment.id}>
                  {shipmentNumber(shipment)} / {customerName(customer)}{existing ? '（作成済）' : ''}
                </option>
              );
            })}
          </select></label>
        </div>
        <button type="button" className="primary-button" disabled={saving} onClick={() => createFromShipment()}>
          {saving ? '作成中...' : '出荷から納品書作成'}
        </button>
        {message && <p className={message.includes('失敗') ? 'form-error-message' : 'notice-text'}>{message}</p>}
      </section>

      <div className="desktop-split-layout">
        <DesktopTable
          actions={(note) => (
            <>
              <button type="button" className="ghost-button" onClick={() => setSelectedId(note.id)}>詳細</button>
              {note.deliveryNotePdfUrl && <a className="ghost-button external-button" href={note.deliveryNotePdfUrl} target="_blank" rel="noreferrer">PDF</a>}
              <button type="button" className="ghost-button danger" onClick={() => removeDeliveryNote?.(note.id)}>取消</button>
            </>
          )}
          actionWidth="190px"
          className="delivery-notes-common-table"
          columns={columns}
          minWidth={1320}
          rows={visibleNotes}
          selectedRowId={selectedNote?.id || ''}
          onRowClick={(note) => setSelectedId(note.id)}
          emptyMessage="納品書がありません"
        />

        <div className="card-list-mobile">
          {visibleNotes.length > 0 ? visibleNotes.map((note) => {
            const shipment = shipmentMap.get(note.shipmentId);
            const order = orderMap.get(note.salesOrderId || shipment?.salesOrderId);
            const customer = customerMap.get(note.customerId || shipment?.customerId || order?.customerId);
            return (
              <article className="product-card" key={note.id} onClick={() => setSelectedId(note.id)}>
                <div className="product-card-main">
                  <div>
                    <p className="eyebrow">Delivery Note</p>
                    <h3>{note.deliveryNoteNumber || '-'}</h3>
                    <span>{customerName(customer)} / {shipmentNumber(shipment)}</span>
                  </div>
                  <span className="pill">{noteStatusLabel(note.status)}</span>
                </div>
                <div className="price-preview">
                  <div><span>発行日</span><strong>{formatDate(note.issueDate)}</strong></div>
                  <div><span>納品日</span><strong>{formatDate(note.deliveryDate)}</strong></div>
                  <div><span>価格</span><strong>{note.priceVisible ? 'ON' : 'OFF'}</strong></div>
                  <div><span>PDF</span><strong>{note.deliveryNotePdfUrl ? '保存済' : '-'}</strong></div>
                </div>
              </article>
            );
          }) : (
            <div className="empty-state">
              <h3>納品書がありません</h3>
              <p>出荷済みの出荷データから納品書を作成できます。</p>
            </div>
          )}
        </div>

        <aside className="sync-status-card desktop-detail-panel">
          {selectedNote ? (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Delivery Note Detail</p>
                  <h2>{selectedNote.deliveryNoteNumber}</h2>
                  <span>{customerName(selectedCustomer)} / {shipmentNumber(selectedShipment)}</span>
                </div>
                <span className="pill">{noteStatusLabel(selectedNote.status)}</span>
              </div>

              <div className="price-preview">
                <div><span>受注番号</span><strong>{orderNumber(selectedOrder)}</strong></div>
                <div><span>発行日</span><strong>{formatDate(selectedNote.issueDate)}</strong></div>
                <div><span>納品日</span><strong>{formatDate(selectedNote.deliveryDate)}</strong></div>
                <div><span>明細数</span><strong>{selectedNote.deliveryNoteLines.length}件</strong></div>
                {selectedNote.priceVisible && (
                  <>
                    <div><span>小計</span><strong>{formatPrice(selectedTotals.subtotal)}円</strong></div>
                    <div><span>合計</span><strong>{formatPrice(selectedTotals.grandTotal)}円</strong></div>
                  </>
                )}
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={Boolean(selectedNote.priceVisible)}
                  onChange={(event) => updateSelected({ priceVisible: event.target.checked })}
                />
                価格を納品書に表示する
              </label>

              <div className="mail-action-row">
                <button type="button" className="ghost-button" onClick={handlePreview}>PDFプレビュー</button>
                <button type="button" className="ghost-button" onClick={handleDownload}>PDFダウンロード</button>
                <button type="button" className="primary-button" disabled={saving} onClick={handleSavePdf}>{saving ? '保存中...' : 'PDF保存・再発行'}</button>
              </div>

              {selectedNote.deliveryNotePdfUrl && (
                <p className="notice-text">PDF: <a href={selectedNote.deliveryNotePdfUrl} target="_blank" rel="noreferrer">{selectedNote.deliveryNotePdfFileName || 'PDFを開く'}</a></p>
              )}

              <section className="sample-form">
                <h3>納品明細</h3>
                <div className="timeline-list">
                  {selectedNote.deliveryNoteLines.map((line) => (
                    <div className="timeline-item" key={line.id}>
                      <strong>{lineProductName(line, productMap)}</strong>
                      <span>
                        {[
                          line.productCode || line.productSnapshot?.productCode,
                          line.specification || line.productSnapshot?.specification,
                          line.lotSnapshot?.lotNumber || line.lotSnapshot?.inventoryCode,
                          line.expirySnapshot,
                          `${formatPrice(line.quantity)} ${line.unit || ''}`,
                          selectedNote.priceVisible ? formatPrice(line.amount) : '',
                        ].filter(Boolean).join(' / ')}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <p className="notice-text">納品書を選択してください。</p>
          )}
        </aside>
      </div>

      {previewHtml && <div className="quote-preview-frame" dangerouslySetInnerHTML={{ __html: previewHtml }} />}
    </section>
  );
}
