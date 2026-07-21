import { useMemo, useState } from 'react';
import DesktopTable from '../../../shared/components/DesktopTable.jsx';
import { formatPrice, productDisplayName } from '../../products/hooks/useProducts.js';
import { SHIPMENT_STATUS_LABELS } from '../hooks/useShipments.js';

function formatDate(value) {
  return value ? String(value).slice(0, 10) : '-';
}

function numberValue(value) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function customerName(customer) {
  return customer?.companyName || customer?.name || '-';
}

function shipmentStatusLabel(status) {
  return SHIPMENT_STATUS_LABELS[status] || status || '-';
}

function shippedQuantity(shipment) {
  return (shipment.shipmentLines ?? []).reduce((sum, line) => sum + numberValue(line.quantity), 0);
}

export default function Shipments({
  shipments = [],
  salesOrders = [],
  customers = [],
  products = [],
  inventoryLots = [],
  deliveryNotes = [],
  updateShipmentStatus,
  onOpenSalesOrder,
  onOpenDeliveryNotes,
  onCreateDeliveryNote,
}) {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState(shipments[0]?.id || '');
  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const orderMap = useMemo(() => new Map(salesOrders.map((order) => [order.id, order])), [salesOrders]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const lotMap = useMemo(() => new Map(inventoryLots.map((lot) => [lot.id, lot])), [inventoryLots]);
  const deliveryNoteMap = useMemo(() => new Map(deliveryNotes.filter((note) => !note.isDeleted).map((note) => [note.shipmentId, note])), [deliveryNotes]);

  const visibleShipments = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return shipments
      .filter((shipment) => !shipment.isDeleted)
      .filter((shipment) => !statusFilter || shipment.status === statusFilter)
      .filter((shipment) => {
        if (!normalizedKeyword) return true;
        const order = orderMap.get(shipment.salesOrderId);
        const customer = customerMap.get(shipment.customerId || order?.customerId);
        return [
          shipment.shipmentNumber,
          order?.salesOrderNumber,
          order?.subject,
          customer?.companyName,
          shipment.carrier,
          shipment.trackingNumber,
        ].some((value) => String(value || '').toLowerCase().includes(normalizedKeyword));
      });
  }, [customerMap, keyword, orderMap, shipments, statusFilter]);

  const selectedShipment = visibleShipments.find((shipment) => shipment.id === selectedId) || visibleShipments[0] || null;
  const selectedOrder = selectedShipment ? orderMap.get(selectedShipment.salesOrderId) : null;

  const columns = [
    { key: 'shipmentNumber', label: '出荷番号', minWidth: '170px', render: (shipment) => <strong>{shipment.shipmentNumber || '-'}</strong> },
    { key: 'salesOrder', label: '受注番号', minWidth: '160px', render: (shipment) => orderMap.get(shipment.salesOrderId)?.salesOrderNumber || '-' },
    { key: 'customer', label: '顧客', minWidth: '220px', render: (shipment) => customerName(customerMap.get(shipment.customerId || orderMap.get(shipment.salesOrderId)?.customerId)) },
    { key: 'shipmentDate', label: '出荷日', minWidth: '110px', render: (shipment) => formatDate(shipment.shipmentDate) },
    { key: 'plannedDeliveryDate', label: '納品予定', minWidth: '110px', render: (shipment) => formatDate(shipment.plannedDeliveryDate) },
    { key: 'status', label: 'ステータス', minWidth: '130px', render: (shipment) => shipmentStatusLabel(shipment.status) },
    { key: 'quantity', label: '数量', minWidth: '100px', render: (shipment) => shippedQuantity(shipment).toLocaleString('ja-JP') },
    { key: 'carrier', label: '配送会社', minWidth: '140px', render: (shipment) => shipment.carrier || '-' },
    { key: 'trackingNumber', label: '追跡番号', minWidth: '160px', render: (shipment) => shipment.trackingNumber || '-' },
  ];

  function changeStatus(shipment, status) {
    updateShipmentStatus?.(shipment.id, status, { shipmentDate: shipment.shipmentDate });
  }

  function hasDeliveryNote(shipment) {
    return deliveryNoteMap.has(shipment.id);
  }

  return (
    <section className="page shipments-page">
      <div className="page-header">
        <p className="eyebrow">Shipments</p>
        <h1>出荷管理</h1>
        <p>受注から作成した出荷予定、ピッキング、出荷確定、取消を確認します。</p>
      </div>

      <section className="sync-status-card">
        <div>
          <span>出荷一覧</span>
          <strong>{visibleShipments.length}件</strong>
        </div>
        <div className="date-grid">
          <label className="field-label">検索<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="出荷番号・受注番号・顧客・追跡番号" /></label>
          <label className="field-label">ステータス<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">すべて</option>
            {Object.entries(SHIPMENT_STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select></label>
        </div>
      </section>

      <div className="desktop-split-layout">
        <DesktopTable
          actions={(shipment) => (
            <>
              <button type="button" className="ghost-button" onClick={() => setSelectedId(shipment.id)}>詳細</button>
              {shipment.salesOrderId && <button type="button" className="ghost-button" onClick={() => onOpenSalesOrder?.(shipment.salesOrderId)}>受注</button>}
              {shipment.status === 'Shipped' && (
                <button type="button" className="ghost-button" onClick={() => (hasDeliveryNote(shipment) ? onOpenDeliveryNotes?.(shipment.id) : onCreateDeliveryNote?.(shipment.id))}>
                  {hasDeliveryNote(shipment) ? '納品書' : '納品書作成'}
                </button>
              )}
            </>
          )}
          actionWidth="260px"
          columns={columns}
          minWidth={1300}
          rows={visibleShipments}
          selectedRowId={selectedShipment?.id || ''}
          onRowClick={(shipment) => setSelectedId(shipment.id)}
          emptyMessage="出荷データがありません"
        />

        <div className="card-list-mobile">
          {visibleShipments.length > 0 ? visibleShipments.map((shipment) => {
            const order = orderMap.get(shipment.salesOrderId);
            const customer = customerMap.get(shipment.customerId || order?.customerId);
            return (
              <article className="product-card" key={shipment.id} onClick={() => setSelectedId(shipment.id)}>
                <div className="product-card-main">
                  <div>
                    <p className="eyebrow">Shipment</p>
                    <h3>{shipment.shipmentNumber || '-'}</h3>
                    <span>{customerName(customer)} / {order?.salesOrderNumber || '-'}</span>
                  </div>
                  <span className="pill">{shipmentStatusLabel(shipment.status)}</span>
                </div>
                <div className="price-preview">
                  <div><span>出荷日</span><strong>{formatDate(shipment.shipmentDate)}</strong></div>
                  <div><span>納品予定</span><strong>{formatDate(shipment.plannedDeliveryDate)}</strong></div>
                  <div><span>数量</span><strong>{shippedQuantity(shipment).toLocaleString('ja-JP')}</strong></div>
                  <div><span>追跡番号</span><strong>{shipment.trackingNumber || '-'}</strong></div>
                </div>
                <div className="mail-action-row" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="ghost-button" onClick={() => setSelectedId(shipment.id)}>詳細</button>
                  {shipment.salesOrderId && <button type="button" className="ghost-button" onClick={() => onOpenSalesOrder?.(shipment.salesOrderId)}>受注</button>}
                  {shipment.status === 'Shipped' && (
                    <button type="button" className="ghost-button" onClick={() => (hasDeliveryNote(shipment) ? onOpenDeliveryNotes?.(shipment.id) : onCreateDeliveryNote?.(shipment.id))}>
                      {hasDeliveryNote(shipment) ? '納品書' : '納品書作成'}
                    </button>
                  )}
                </div>
              </article>
            );
          }) : (
            <div className="empty-state">
              <h3>出荷データがありません</h3>
              <p>受注詳細から出荷登録すると、ここに出荷履歴が表示されます。</p>
            </div>
          )}
        </div>

        <aside className="sync-status-card desktop-detail-panel">
          {selectedShipment ? (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Shipment Detail</p>
                  <h2>{selectedShipment.shipmentNumber}</h2>
                  <span>{shipmentStatusLabel(selectedShipment.status)} / {selectedOrder?.salesOrderNumber || '-'}</span>
                </div>
              </div>
              <div className="price-preview">
                <div><span>顧客</span><strong>{customerName(customerMap.get(selectedShipment.customerId || selectedOrder?.customerId))}</strong></div>
                <div><span>出荷日</span><strong>{formatDate(selectedShipment.shipmentDate)}</strong></div>
                <div><span>配送会社</span><strong>{selectedShipment.carrier || '-'}</strong></div>
                <div><span>追跡番号</span><strong>{selectedShipment.trackingNumber || '-'}</strong></div>
              </div>
              <div className="mail-action-row">
                <button type="button" className="ghost-button" disabled={selectedShipment.status === 'Shipped' || selectedShipment.status === 'Cancelled'} onClick={() => changeStatus(selectedShipment, 'Picking')}>Picking</button>
                <button type="button" className="ghost-button" disabled={selectedShipment.status === 'Shipped' || selectedShipment.status === 'Cancelled'} onClick={() => changeStatus(selectedShipment, 'Ready')}>Ready</button>
                <button type="button" className="primary-button" disabled={selectedShipment.status === 'Shipped' || selectedShipment.status === 'Cancelled'} onClick={() => changeStatus(selectedShipment, 'Shipped')}>Shipped</button>
                <button type="button" className="ghost-button danger" disabled={selectedShipment.status === 'Cancelled'} onClick={() => changeStatus(selectedShipment, 'Cancelled')}>取消</button>
                {selectedShipment.status === 'Shipped' && (
                  <button type="button" className="primary-button" onClick={() => (hasDeliveryNote(selectedShipment) ? onOpenDeliveryNotes?.(selectedShipment.id) : onCreateDeliveryNote?.(selectedShipment.id))}>
                    {hasDeliveryNote(selectedShipment) ? '納品書を開く' : '納品書作成'}
                  </button>
                )}
              </div>
              <section className="sample-form">
                <h3>ピッキングリスト</h3>
                <div className="timeline-list">
                  {selectedShipment.shipmentLines.map((line) => {
                    const product = productMap.get(line.productId);
                    const lot = lotMap.get(line.inventoryLotId);
                    return (
                      <div className="timeline-item" key={line.id}>
                        <strong>{productDisplayName(product, line.productId || '-') || line.productId || '-'}</strong>
                        <span>{[
                          line.lotSnapshot?.inventoryCode || lot?.inventoryCode,
                          line.lotSnapshot?.lotNumber || lot?.lotNumber,
                          line.expirySnapshot || lot?.expiryDate,
                          lot?.location,
                          `${formatPrice(line.quantity)} ${line.unit || lot?.unit || ''}`,
                        ].filter(Boolean).join(' / ')}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          ) : (
            <p className="notice-text">出荷を選択してください。</p>
          )}
        </aside>
      </div>
    </section>
  );
}
