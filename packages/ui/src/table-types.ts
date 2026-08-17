import type { Snippet } from 'svelte'

export interface TableColumn<T> {
  key: string
  header: string
  /** Custom cell renderer; falls back to `String(row[key])`. */
  cell?: Snippet<[T]>
  align?: 'start' | 'end'
}
