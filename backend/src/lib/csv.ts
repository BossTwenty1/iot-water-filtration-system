// Minimal RFC4180-ish CSV serializer — no new dependency needed for the
// column counts export.routes.ts deals with.

export type CsvValue = string | number | boolean | null | undefined

function escapeField(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(escapeField).join(',')]
  for (const row of rows) lines.push(row.map(escapeField).join(','))
  return lines.join('\r\n') + '\r\n'
}
