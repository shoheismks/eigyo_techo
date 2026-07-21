const actions = [
  { key: 'business-card', label: '名刺を撮影', description: 'カメラで名刺を追加', tone: 'primary' },
  { key: 'deal', label: '商談メモ', description: '今すぐ商談内容を記録', tone: 'primary' },
  { key: 'quote', label: '見積作成', description: '顧客と商品を選んで見積PDFを作成', tone: 'primary' },
  { key: 'salesOrder', label: '受注作成', description: '見積・成約確認書から受注を登録', tone: 'primary' },
  { key: 'invoice', label: '請求書作成', description: '見積・成約確認書をもとに請求書を作成', tone: 'primary' },
  { key: 'inventory', label: '在庫登録', description: '商品、ロット、賞味期限、保管場所を登録', tone: 'primary' },
  { key: 'company', label: '会社を追加', description: '検索・補完から取引先登録' },
  { key: 'complaint', label: 'クレーム記録', description: '対応内容と期限を残す' },
  { key: 'product', label: '商品追加', description: '商品マスターを登録' },
  { key: 'supplier', label: '仕入先追加', description: '仕入先情報を登録' },
];

export default function AddActionMenu({ open, onClose, onAction }) {
  if (!open) return null;

  return (
    <div className="add-menu-backdrop" role="presentation" onClick={onClose}>
      <section
        className="add-action-menu"
        role="dialog"
        aria-modal="true"
        aria-label="追加メニュー"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading add-action-heading">
          <div>
            <p className="eyebrow">Quick Add</p>
            <h2>現場で記録する</h2>
          </div>
          <button type="button" className="text-button compact-button" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="add-action-grid">
          {actions.map((action) => (
            <button
              type="button"
              key={action.key}
              className={`add-action-button ${action.tone === 'primary' ? 'primary-action' : ''}`}
              onClick={() => onAction(action.key)}
            >
              <strong>{action.label}</strong>
              <span>{action.description}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
