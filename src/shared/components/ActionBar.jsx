export default function ActionBar({
  onNew,
  onFilter,
  onCsv,
  onExcel,
  onImport,
  onExport,
  searchValue = '',
  onSearch,
  searchPlaceholder = '検索',
  newLabel = '新規',
  showSearch = true,
  showNew = true,
  showFilter = false,
  showCsv = false,
  showExcel = false,
  showImport = false,
  showExport = false,
  children,
}) {
  return (
    <div className="action-bar">
      {showSearch && (
        <label className="action-bar-search">
          <span>検索</span>
          <input value={searchValue} placeholder={searchPlaceholder} onChange={(event) => onSearch?.(event.target.value)} />
        </label>
      )}
      <div className="action-bar-actions">
        {children}
        {showFilter && <button type="button" className="ghost-button" onClick={onFilter}>フィルター</button>}
        {showCsv && <button type="button" className="ghost-button" onClick={onCsv}>CSV</button>}
        {showExcel && <button type="button" className="ghost-button" onClick={onExcel}>Excel</button>}
        {showImport && <button type="button" className="ghost-button" onClick={onImport}>インポート</button>}
        {showExport && <button type="button" className="ghost-button" onClick={onExport}>エクスポート</button>}
        {showNew && <button type="button" className="primary-button" onClick={onNew}>{newLabel}</button>}
      </div>
    </div>
  );
}
