export default function DesktopTable({
  columns,
  rows,
  actions,
  getRowKey = (row) => row.id,
  minWidth = 960,
  selectedRowId = '',
  onRowClick,
  rowClassName,
  emptyMessage = 'No data',
  className = '',
}) {
  const tableStyle = { minWidth: `${minWidth}px` };

  return (
    <div className={`desktop-table-shell ${className}`.trim()}>
      <table className="desktop-data-table" style={tableStyle}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  width: column.width,
                  minWidth: column.minWidth,
                }}
              >
                {column.label}
              </th>
            ))}
            {actions && <th style={{ width: '220px' }}>操作</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => {
              const rowKey = getRowKey(row);
              const isSelected = selectedRowId && selectedRowId === rowKey;
              const clickable = Boolean(onRowClick);
              const extraClass = rowClassName ? rowClassName(row) : '';

              return (
                <tr
                  className={`${isSelected ? 'selected' : ''} ${clickable ? 'clickable' : ''} ${extraClass}`.trim()}
                  key={rowKey}
                  onClick={clickable ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td
                      className={column.className ? column.className(row) : ''}
                      key={column.key}
                      style={{
                        width: column.width,
                        minWidth: column.minWidth,
                      }}
                    >
                      {column.render ? column.render(row) : row[column.key] || '-'}
                    </td>
                  ))}
                  {actions && (
                    <td onClick={(event) => event.stopPropagation()} style={{ width: '220px' }}>
                      <div className="desktop-table-actions">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              );
            })
          ) : (
            <tr>
              <td className="desktop-table-empty" colSpan={columns.length + (actions ? 1 : 0)}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
