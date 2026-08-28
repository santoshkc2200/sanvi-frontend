/**
 * CSV serialisation shared by every console export (DataTable, the audit
 * screen). Kept out of the components so the escaping rules are unit-testable
 * on their own.
 */

/**
 * Cells whose first character can be interpreted as a formula by spreadsheet
 * apps (=, +, -, @, tab, CR) are prefixed with `'` — the standard CSV-injection
 * mitigation (OWASP CSV Injection cheat sheet). Exported cells routinely carry
 * operator-influenced text (tenant names, audit reasons), so this is security
 * hardening, not cosmetics.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/

export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = FORMULA_PREFIX.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

export function csvDocument(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

/** Shared download plumbing for the export buttons — builds a Blob and clicks a temporary link. */
export function downloadCsv(csv: string, fileName: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
