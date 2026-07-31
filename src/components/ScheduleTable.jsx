import React, { useMemo } from 'react'

function normalizeColumns(columns, rows) {
  if (Array.isArray(columns) && columns.length > 0) {
    return columns.map((column) => {
      if (typeof column === 'string') {
        return { key: column, label: column }
      }

      return {
        key: column.key,
        label: column.label || column.key,
      }
    })
  }

  const firstRow = rows?.[0] || {}
  return Object.keys(firstRow)
    .filter((column) => column !== 'id')
    .map((column) => ({
      key: column,
      label: column === 'role_id' ? 'Role' : column,
    }))
}

export default function ScheduleTable({ columns, rows = [], emptyMessage = 'No rows found.', className = '' }) {
  const normalizedColumns = useMemo(() => normalizeColumns(columns, rows), [columns, rows])

  if (!rows.length) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500 ${className}`.trim()}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`.trim()}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-700">
            <tr>
              {normalizedColumns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-3 py-3 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id ?? `${index}`} className="border-t border-slate-100 bg-white hover:bg-slate-50">
                {normalizedColumns.map((column) => (
                  <td key={`${column.key}-${index}`} className="max-w-xs whitespace-nowrap px-3 py-3 text-slate-600">
                    {String(row[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}