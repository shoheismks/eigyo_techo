const moreGroups = [
  {
    id: 'sales',
    label: '営業',
    items: [
      { key: 'Pipeline', label: '案件', description: '商談・フォロー' },
      { key: 'Quotes', label: '見積', description: '見積一覧・PDF' },
      { key: 'SalesOrders', label: '受注', description: '契約残・受注' },
      { key: 'MailAI', label: 'AIメール', description: '文面作成' },
    ],
  },
  {
    id: 'products',
    label: '商品・在庫',
    items: [
      { key: 'Products', label: '商品', description: '商品マスター' },
      { key: 'CustomerProductPrices', label: '顧客別価格', description: '価格マスター' },
      { action: 'inventory-list', label: '在庫', description: '現在庫・予定在庫' },
      { action: 'inventory-arrival', label: '入荷予定', description: 'PDF取込・照合' },
      { action: 'inventory-analysis', label: '入荷分析', description: '予定 vs 実績' },
      { key: 'Suppliers', label: '仕入先', description: '仕入先・メーカー' },
    ],
  },
  {
    id: 'logistics',
    label: '物流・帳票',
    items: [
      { key: 'Shipments', label: '出荷', description: 'ピッキング・出荷' },
      { key: 'DeliveryNotes', label: '納品書', description: '納品書PDF' },
      { key: 'Invoices', label: '請求書', description: '請求・入金' },
    ],
  },
  {
    id: 'admin',
    label: '管理',
    items: [
      { key: 'Analytics', label: '分析', description: '営業分析' },
      { key: 'Settings', label: '設定', description: '会社・マスター' },
      { key: 'Help', label: 'ヘルプ', description: '操作マニュアル' },
    ],
  },
];

export default function MobileMoreMenu({ open, onClose, onNavigate, onAction }) {
  if (!open) return null;

  function handleSelect(item) {
    if (item.action) onAction?.(item.action);
    else onNavigate?.(item.key);
    onClose?.();
  }

  return (
    <div className="mobile-more-backdrop" role="presentation" onClick={onClose}>
      <section
        className="mobile-more-menu"
        role="dialog"
        aria-modal="true"
        aria-label="その他メニュー"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading mobile-more-heading">
          <div>
            <p className="eyebrow">More</p>
            <h2>その他</h2>
          </div>
          <button type="button" className="text-button compact-button" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="mobile-more-groups">
          {moreGroups.map((group) => (
            <section className="mobile-more-group" key={group.id}>
              <h3>{group.label}</h3>
              <div className="mobile-more-grid">
                {group.items.map((item) => (
                  <button type="button" key={item.key || item.action} onClick={() => handleSelect(item)}>
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
