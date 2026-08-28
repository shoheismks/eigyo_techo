import { useMemo, useState } from 'react';
import DesktopTable from '../../../shared/components/DesktopTable.jsx';

function statusLabel(status) {
  return {
    draft: '下書き',
    matching: '商品確認が必要',
    confirmed: '入荷待ち',
    partially_received: '一部入荷',
    received: '入荷済み',
    cancelled: '取消済み',
    deleted: '削除済み',
  }[status] || status || '-';
}

function statusClass(status) {
  if (status === 'received') return 'ready';
  if (status === 'partially_received' || status === 'matching') return 'warning';
  if (status === 'cancelled') return 'danger';
  return 'muted';
}

function contractNumbers(shipment) {
  return [...new Set((shipment.lines || []).map((line) => line.contractNo).filter(Boolean))].join(' / ') || '-';
}

export default function InboundPlanList({ shipments = [], error = '', onImport, onOpenDetail }) {
  const [query, setQuery] = useState('');
  const visibleShipments = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    if (!keyword) return shipments;
    return shipments.filter((shipment) => [
      shipment.supplierName,
      shipment.documentNumber,
      shipment.sourceFileName,
      contractNumbers(shipment),
    ].some((value) => String(value || '').toLocaleLowerCase().includes(keyword)));
  }, [query, shipments]);

  const columns = [
    { key: 'supplier', label: '仕入先', minWidth: '200px', render: (row) => row.supplierName || '-' },
    { key: 'document', label: '帳票番号', minWidth: '140px', render: (row) => row.documentNumber || '-' },
    { key: 'contract', label: '契約No', minWidth: '160px', render: contractNumbers },
    { key: 'lines', label: '明細数', width: '90px', render: (row) => `${row.lines?.length || 0}件` },
    { key: 'status', label: '状態', minWidth: '140px', render: (row) => <span className={`info-badge ${statusClass(row.status)}`}>{statusLabel(row.status)}</span> },
  ];

  return (
    <section className="detail-section inbound-plan-list">
      <div className="section-heading inbound-plan-list-heading">
        <div>
          <p className="eyebrow">Inbound plans</p>
          <h2>入荷予定</h2>
          <p className="inline-helper">保存済みの入荷予定を確認できます。</p>
        </div>
        <button type="button" className="primary-button" onClick={onImport}>＋ 新しく取り込む</button>
      </div>

      <label className="field-label inbound-plan-search">
        入荷予定を検索
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="契約No・仕入先・帳票番号" />
      </label>

      {error && <p className="error-text">{error}</p>}

      {visibleShipments.length === 0 ? (
        <div className="empty-state inbound-plan-empty">
          <h3>{shipments.length === 0 ? '保存済みの入荷予定はありません' : '該当する入荷予定はありません'}</h3>
          <p>{shipments.length === 0 ? '「新しく取り込む」からPDFまたは標準Excelを選択してください。' : '検索条件を変更してください。'}</p>
        </div>
      ) : (
        <>
          <DesktopTable
            className="inventory-common-table inbound-plan-table"
            columns={columns}
            rows={visibleShipments}
            getRowKey={(row) => row.id}
            minWidth={900}
            actions={(shipment) => (
              <button type="button" className="ghost-button" onClick={() => onOpenDetail?.(shipment.id)}>詳細を見る</button>
            )}
          />
          <div className="card-list-mobile inbound-plan-card-list">
            {visibleShipments.map((shipment) => (
              <article className="product-card inbound-plan-card" key={shipment.id}>
                <div className="company-heading">
                  <p>{shipment.documentNumber || '帳票番号未取得'}</p>
                  <h3>{shipment.supplierName || '仕入先未取得'}</h3>
                </div>
                <dl className="company-details">
                  <div><dt>契約No</dt><dd>{contractNumbers(shipment)}</dd></div>
                  <div><dt>明細数</dt><dd>{shipment.lines?.length || 0}件</dd></div>
                  <div><dt>状態</dt><dd><span className={`info-badge ${statusClass(shipment.status)}`}>{statusLabel(shipment.status)}</span></dd></div>
                </dl>
                <div className="card-actions">
                  <button type="button" className="ghost-button" onClick={() => onOpenDetail?.(shipment.id)}>詳細を見る</button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
