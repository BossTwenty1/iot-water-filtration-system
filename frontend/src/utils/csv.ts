export function downloadCsv(filename: string, rows: Array<Record<string, string | number | undefined>>) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escapeCell = (value: string | number | undefined) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const csv = [headers.map(escapeCell), ...rows.map((row) => headers.map((header) => escapeCell(row[header])))].map((row) => row.join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
