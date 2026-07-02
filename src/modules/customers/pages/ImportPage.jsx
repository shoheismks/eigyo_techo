export default function ImportPage({ error, onGoCustomers }) {
  return (
    <section className="page">
      <div className="page-header">
        <p className="eyebrow">Import</p>
        <h1>会社名を追加</h1>
        <p>Chrome拡張から受け取った会社名を営業手帳へ追加します。</p>
      </div>

      {error ? (
        <div className="empty-state">
          <h3>追加できませんでした</h3>
          <p>{error}</p>
          <button type="button" className="primary-button" onClick={onGoCustomers}>
            取引先一覧へ
          </button>
        </div>
      ) : (
        <div className="empty-state">
          <h3>取り込み中...</h3>
          <p>会社名を確認しています。</p>
        </div>
      )}
    </section>
  );
}
