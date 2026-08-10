import { useMemo, useState } from 'react';

function defaultRowKey(row) {
  return row.id;
}

function getCellText(column, row) {
  const value = column.exportValue?.(row) ?? column.value?.(row) ?? row[column.key] ?? '';
  if (Array.isArray(value)) return value.join(' / ');
  return String(value ?? '');
}

function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function compareValues(a, b) {
  const left = a ?? '';
  const right = b ?? '';
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && left !== '' && right !== '') {
    return leftNumber - rightNumber;
  }
  return String(left).localeCompare(String(right), 'ja');
}

export default function DataTable({
  columns = [],
  rows = [],
  actions,
  actionWidth = '160px',
  getRowKey = defaultRowKey,
  minWidth = 960,
  selectedRowId = '',
  onRowClick,
  rowClassName,
  emptyMessage = 'データがありません',
  className = '',
  sortKey: controlledSortKey = '',
  sortDirection: controlledSortDirection = 'asc',
  onSort,
  searchValue,
  onSearch,
  searchPlaceholder = '検索',
  searchable = false,
  showColumnToggle = true,
  showCsvExport = true,
  csvFileName = 'export.csv',
  selectable = false,
  selectedIds,
  onSelectionChange,
  bulkActions,
  paginate = false,
  pageSize = 40,
  stickyHeader = true,
}) {
  const [internalSearch, setInternalSearch] = useState('');
  const [internalSort, setInternalSort] = useState({ key: controlledSortKey, direction: controlledSortDirection });
  const [internalSelectedIds, setInternalSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(() => columns.map((column) => column.key));
  const [columnWidths, setColumnWidths] = useState({});

  const selectedRowIds = selectedIds ?? internalSelectedIds;
  const activeSearch = searchValue ?? internalSearch;
  const sortKey = controlledSortKey || internalSort.key;
  const sortDirection = controlledSortKey ? controlledSortDirection : internalSort.direction;
  const tableStyle = { minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth };
  const actionStyle = { width: typeof actionWidth === 'number' ? `${actionWidth}px` : actionWidth };

  const visibleColumns = useMemo(
    () => columns.filter((column) => visibleColumnKeys.includes(column.key)),
    [columns, visibleColumnKeys],
  );

  const processedRows = useMemo(() => {
    const keyword = String(activeSearch ?? '').trim().toLowerCase();
    const searchedRows = keyword
      ? rows.filter((row) => visibleColumns.some((column) => getCellText(column, row).toLowerCase().includes(keyword)))
      : rows;

    if (!sortKey) return searchedRows;
    const sortColumn = columns.find((column) => column.key === sortKey);
    if (!sortColumn) return searchedRows;

    return [...searchedRows].sort((a, b) => {
      const left = sortColumn.sortValue?.(a) ?? sortColumn.value?.(a) ?? a[sortColumn.key];
      const right = sortColumn.sortValue?.(b) ?? sortColumn.value?.(b) ?? b[sortColumn.key];
      const result = compareValues(left, right);
      return sortDirection === 'desc' ? -result : result;
    });
  }, [activeSearch, columns, rows, sortDirection, sortKey, visibleColumns]);

  const totalPages = paginate ? Math.max(1, Math.ceil(processedRows.length / pageSize)) : 1;
  const pageRows = paginate ? processedRows.slice((page - 1) * pageSize, page * pageSize) : processedRows;

  function updateSelection(nextIds) {
    if (onSelectionChange) onSelectionChange(nextIds);
    else setInternalSelectedIds(nextIds);
  }

  function toggleAll(checked) {
    const ids = pageRows.map(getRowKey);
    updateSelection(checked ? [...new Set([...selectedRowIds, ...ids])] : selectedRowIds.filter((id) => !ids.includes(id)));
  }

  function toggleRow(row, checked) {
    const id = getRowKey(row);
    updateSelection(checked ? [...new Set([...selectedRowIds, id])] : selectedRowIds.filter((selectedId) => selectedId !== id));
  }

  function handleSort(column) {
    if (!column.sortable) return;
    const nextDirection = sortKey === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
    if (onSort) onSort(column.key);
    else setInternalSort({ key: column.key, direction: nextDirection });
  }

  function handleSearchChange(event) {
    setPage(1);
    if (onSearch) onSearch(event.target.value);
    else setInternalSearch(event.target.value);
  }

  function exportCsv() {
    const header = visibleColumns.map((column) => escapeCsvValue(column.label)).join(',');
    const body = processedRows.map((row) => visibleColumns.map((column) => escapeCsvValue(getCellText(column, row))).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = csvFileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function toggleColumn(columnKey) {
    setVisibleColumnKeys((current) => {
      if (current.includes(columnKey)) {
        return current.length > 1 ? current.filter((key) => key !== columnKey) : current;
      }
      return [...current, columnKey];
    });
  }

  const allPageRowsSelected = pageRows.length > 0 && pageRows.every((row) => selectedRowIds.includes(getRowKey(row)));

  return (
    <div className={`data-table ${className}`.trim()}>
      {(searchable || showColumnToggle || showCsvExport || bulkActions) && (
        <div className="data-table-toolbar">
          {searchable && (
            <label className="data-table-search">
              <span>検索</span>
              <input value={activeSearch} placeholder={searchPlaceholder} onChange={handleSearchChange} />
            </label>
          )}
          <div className="data-table-toolbar-actions">
            {bulkActions && selectedRowIds.length > 0 && <div className="data-table-bulk-actions">{bulkActions(selectedRowIds)}</div>}
            {showColumnToggle && (
              <details className="data-table-column-menu">
                <summary>列</summary>
                <div>
                  {columns.map((column) => (
                    <label key={column.key}>
                      <input type="checkbox" checked={visibleColumnKeys.includes(column.key)} onChange={() => toggleColumn(column.key)} />
                      <span>{column.label}</span>
                      <input
                        aria-label={`${column.label}の幅`}
                        className="data-table-width-input"
                        inputMode="numeric"
                        placeholder="px"
                        value={columnWidths[column.key] ?? ''}
                        onChange={(event) => setColumnWidths((current) => ({ ...current, [column.key]: event.target.value.replace(/[^0-9]/g, '') }))}
                      />
                    </label>
                  ))}
                </div>
              </details>
            )}
            {showCsvExport && <button type="button" className="ghost-button" onClick={exportCsv}>CSV</button>}
          </div>
        </div>
      )}

      <div className={`desktop-table-shell data-table-shell ${stickyHeader ? 'sticky-enabled' : ''}`.trim()}>
        <table className="desktop-data-table data-table-grid" style={tableStyle}>
          <thead>
            <tr>
              {selectable && (
                <th className="data-table-select-cell">
                  <input type="checkbox" checked={allPageRowsSelected} onChange={(event) => toggleAll(event.target.checked)} />
                </th>
              )}
              {visibleColumns.map((column) => {
                const width = columnWidths[column.key] ? `${columnWidths[column.key]}px` : column.minWidth;
                const style = width ? { minWidth: width, width } : undefined;
                return (
                  <th key={column.key} className={column.headerClassName || ''} style={style}>
                    {column.sortable ? (
                      <button type="button" className="desktop-table-sort-button" onClick={() => handleSort(column)}>
                        <span>{column.label}</span>
                        <small>{sortKey === column.key ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</small>
                      </button>
                    ) : column.label}
                  </th>
                );
              })}
              {actions && <th style={actionStyle}>操作</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.length > 0 ? pageRows.map((row) => {
              const key = getRowKey(row);
              const selected = selectedRowId === key;
              const extraClass = typeof rowClassName === 'function' ? rowClassName(row) : rowClassName || '';
              return (
                <tr
                  key={key}
                  className={`${onRowClick ? 'clickable' : ''} ${selected ? 'selected' : ''} ${extraClass}`.trim()}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td className="data-table-select-cell" data-label="選択" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" checked={selectedRowIds.includes(key)} onChange={(event) => toggleRow(row, event.target.checked)} />
                    </td>
                  )}
                  {visibleColumns.map((column) => {
                    const className = typeof column.className === 'function' ? column.className(row) : column.className || '';
                    const width = columnWidths[column.key] ? `${columnWidths[column.key]}px` : column.minWidth;
                    const style = width ? { minWidth: width, width } : undefined;
                    return (
                      <td key={column.key} className={className} data-label={column.label} style={style}>
                        {column.render ? column.render(row) : row[column.key] ?? '-'}
                      </td>
                    );
                  })}
                  {actions && (
                    <td className="desktop-table-actions" data-label="操作" style={actionStyle} onClick={(event) => event.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              );
            }) : (
              <tr>
                <td className="desktop-table-empty" colSpan={visibleColumns.length + (actions ? 1 : 0) + (selectable ? 1 : 0)}>{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {paginate && totalPages > 1 && (
        <div className="data-table-pager">
          <button type="button" className="ghost-button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>前へ</button>
          <span>{page} / {totalPages}</span>
          <button type="button" className="ghost-button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>次へ</button>
        </div>
      )}
    </div>
  );
}
