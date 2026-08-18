import type { Snippet } from 'svelte'

export interface TableColumn<T> {
  key: string
  header: string
  /** Custom cell renderer; falls back to `String(row[key])`. */
  cell?: Snippet<[T]>
  align?: 'start' | 'end'
  /** `DataTable` only — `Table` ignores this. Server-driven: toggling emits `onSortChange`, it never reorders `rows` itself. */
  sortable?: boolean
  /** `DataTable` only — a fixed column (e.g. a checkbox/actions column) that the column-visibility menu can't hide. */
  alwaysVisible?: boolean
}

export interface DataTableBulkActionArgs {
  selectedIds: string[]
  clearSelection: () => void
}
