const actions = [
  { key: 'company', label: '会社を追加', description: '検索・補完から取引先を登録' },
  { key: 'business-card', label: '名刺を撮影', description: '画像から担当者を作成' },
  { key: 'deal', label: '商談メモ追加', description: '案件とフォローを記録' },
  { key: 'complaint', label: 'クレーム記録', description: '対応状況を残す' },
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
        <div className="section-heading">
          <div>
            <p className="eyebrow">Add</p>
            <h2>追加する内容を選択</h2>
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
              className="add-action-button"
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
