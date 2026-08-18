<script lang="ts" generics="T extends Record<string, unknown>">
import type { Snippet } from 'svelte'
import { untrack } from 'svelte'
import Button from './Button.svelte'
import Checkbox from './Checkbox.svelte'
import Dialog from './Dialog.svelte'
import Cluster from './layout/Cluster.svelte'
import Spinner from './Spinner.svelte'
import type { DataTableBulkActionArgs, TableColumn } from './table-types'

interface Props {
  columns: TableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  caption?: string
  emptyMessage?: string
  loading?: boolean
  loadingLabel?: string
  error?: string
  retryLabel?: string
  onRetry?: () => void
  sortKey?: string
  sortDirection?: 'asc' | 'desc'
  onSortChange?: (key: string, direction: 'asc' | 'desc') => void
  selectable?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  bulkActions?: Snippet<[DataTableBulkActionArgs]>
  hasPrevPage?: boolean
  hasNextPage?: boolean
  onPrevPage?: () => void
  onNextPage?: () => void
  pageInfo?: string
  previousLabel?: string
  nextLabel?: string
  columnVisibilityStorageKey?: string
  columnsLabel?: string
  columnsDoneLabel?: string
  selectAllLabel?: string
  selectRowLabel?: string
  csvExport?: boolean
  csvFileName?: string
  exportCsvLabel?: string
  class?: string
}

let {
  columns,
  rows,
  getRowId,
  caption,
  emptyMessage,
  loading = false,
  loadingLabel = 'Loading',
  error,
  retryLabel = 'Try again',
  onRetry,
  sortKey,
  sortDirection = 'asc',
  onSortChange,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bulkActions,
  hasPrevPage = false,
  hasNextPage = false,
  onPrevPage,
  onNextPage,
  pageInfo,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  columnVisibilityStorageKey,
  columnsLabel = 'Columns',
  columnsDoneLabel = 'Done',
  selectAllLabel = 'Select all rows on this page',
  selectRowLabel = 'Select row',
  csvExport = false,
  csvFileName = 'export.csv',
  exportCsvLabel = 'Export CSV',
  class: className = '',
}: Props = $props()

function readStoredVisibleKeys(): string[] | undefined {
  if (!columnVisibilityStorageKey || typeof localStorage === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(columnVisibilityStorageKey)
    return raw ? (JSON.parse(raw) as string[]) : undefined
  } catch {
    return undefined
  }
}

// `columns` is a static per-screen config — only the initial value seeds
// visibility state, so the reactivity linter's "referenced locally" warning
// for this line is expected.
let visibleKeys = $state(untrack(() => readStoredVisibleKeys() ?? columns.map((c) => c.key)))
let columnsDialogOpen = $state(false)

const visibleColumns = $derived(columns.filter((c) => visibleKeys.includes(c.key)))

function persistVisibleKeys(next: string[]): void {
  visibleKeys = next
  if (!columnVisibilityStorageKey || typeof localStorage === 'undefined') return
  localStorage.setItem(columnVisibilityStorageKey, JSON.stringify(next))
}

function toggleColumn(key: string, visible: boolean): void {
  persistVisibleKeys(visible ? [...visibleKeys, key] : visibleKeys.filter((k) => k !== key))
}

const allSelected = $derived(
  rows.length > 0 && rows.every((row) => selectedIds.includes(getRowId(row))),
)
const someSelected = $derived(selectedIds.length > 0 && !allSelected)

function toggleAll(checked: boolean): void {
  const pageIds = rows.map(getRowId)
  onSelectionChange?.(
    checked
      ? [...new Set([...selectedIds, ...pageIds])]
      : selectedIds.filter((id) => !pageIds.includes(id)),
  )
}

function toggleRow(id: string, checked: boolean): void {
  onSelectionChange?.(checked ? [...selectedIds, id] : selectedIds.filter((rowId) => rowId !== id))
}

function clearSelection(): void {
  onSelectionChange?.([])
}

function ariaSortFor(key: string): 'ascending' | 'descending' | 'none' {
  if (sortKey !== key) return 'none'
  return sortDirection === 'asc' ? 'ascending' : 'descending'
}

function handleSort(key: string): void {
  const nextDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc'
  onSortChange?.(key, nextDirection)
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(): void {
  const exportColumns = columns.filter((c) => !c.cell)
  const header = exportColumns.map((c) => csvCell(c.header)).join(',')
  const lines = rows.map((row) => exportColumns.map((c) => csvCell(row[c.key])).join(','))
  const csv = [header, ...lines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = csvFileName
  link.click()
  URL.revokeObjectURL(url)
}

const colSpan = $derived(visibleColumns.length + (selectable ? 1 : 0))
</script>

<div class="sanvi-data-table {className}">
  {#if (selectable && selectedIds.length > 0 && bulkActions) || columnVisibilityStorageKey || csvExport}
    <Cluster justify="space-between" gap="3">
      <div>
        {#if selectable && selectedIds.length > 0 && bulkActions}
          <div role="toolbar">
            {@render bulkActions({ selectedIds, clearSelection })}
          </div>
        {/if}
      </div>
      <Cluster gap="2">
        {#if columnVisibilityStorageKey}
          <Button variant="ghost" size="sm" onclick={() => (columnsDialogOpen = true)}>
            {columnsLabel}
          </Button>
        {/if}
        {#if csvExport}
          <Button variant="ghost" size="sm" onclick={downloadCsv} disabled={rows.length === 0}>
            {exportCsvLabel}
          </Button>
        {/if}
      </Cluster>
    </Cluster>
  {/if}

  <div class="sanvi-table-wrapper">
    <table class="sanvi-table">
      {#if caption}<caption>{caption}</caption>{/if}
      <thead>
        <tr>
          {#if selectable}
            <th scope="col" class="sanvi-data-table__select-cell">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onchange={(event) => toggleAll(event.currentTarget.checked)}
              >
                <span class="sanvi-visually-hidden">{selectAllLabel}</span>
              </Checkbox>
            </th>
          {/if}
          {#each visibleColumns as column (column.key)}
            <th
              scope="col"
              class="sanvi-table__cell--{column.align ?? 'start'}"
              aria-sort={column.sortable ? ariaSortFor(column.key) : undefined}
            >
              {#if column.sortable}
                <button
                  type="button"
                  class="sanvi-data-table__sort-button"
                  onclick={() => handleSort(column.key)}
                >
                  {column.header}
                  <span aria-hidden="true" class="sanvi-data-table__sort-icon">
                    {#if sortKey === column.key}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                  </span>
                </button>
              {:else}
                {column.header}
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#if loading}
          <tr>
            <td class="sanvi-table__empty" colspan={colSpan}>
              <Spinner label={loadingLabel} />
            </td>
          </tr>
        {:else if error}
          <tr>
            <td class="sanvi-table__empty" colspan={colSpan}>
              <p role="alert">{error}</p>
              {#if onRetry}
                <Button variant="secondary" size="sm" onclick={onRetry}>{retryLabel}</Button>
              {/if}
            </td>
          </tr>
        {:else}
          {#each rows as row (getRowId(row))}
            {@const rowId = getRowId(row)}
            <tr aria-selected={selectable ? selectedIds.includes(rowId) : undefined}>
              {#if selectable}
                <td class="sanvi-data-table__select-cell">
                  <Checkbox
                    checked={selectedIds.includes(rowId)}
                    onchange={(event) => toggleRow(rowId, event.currentTarget.checked)}
                  >
                    <span class="sanvi-visually-hidden">{selectRowLabel}</span>
                  </Checkbox>
                </td>
              {/if}
              {#each visibleColumns as column (column.key)}
                <td class="sanvi-table__cell--{column.align ?? 'start'}">
                  {#if column.cell}
                    {@render column.cell(row)}
                  {:else}
                    {String(row[column.key] ?? '')}
                  {/if}
                </td>
              {/each}
            </tr>
          {:else}
            <tr>
              <td class="sanvi-table__empty" colspan={colSpan}>
                {emptyMessage ?? ''}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  {#if (hasPrevPage || hasNextPage) && !loading && !error}
    <Cluster justify="end" align="center" gap="3">
      {#if pageInfo}<span class="sanvi-data-table__page-info">{pageInfo}</span>{/if}
      <Button variant="ghost" size="sm" disabled={!hasPrevPage} onclick={onPrevPage}>
        {previousLabel}
      </Button>
      <Button variant="ghost" size="sm" disabled={!hasNextPage} onclick={onNextPage}>
        {nextLabel}
      </Button>
    </Cluster>
  {/if}
</div>

{#if columnVisibilityStorageKey && columnsDialogOpen}
  <Dialog bind:open={columnsDialogOpen} titleText={columnsLabel}>
    {#snippet children()}
      <ul class="sanvi-data-table__columns-list">
        {#each columns.filter((c) => !c.alwaysVisible) as column (column.key)}
          <li>
            <Checkbox
              checked={visibleKeys.includes(column.key)}
              onchange={(event) => toggleColumn(column.key, event.currentTarget.checked)}
            >
              {column.header}
            </Checkbox>
          </li>
        {/each}
      </ul>
    {/snippet}
    {#snippet footer()}
      <Button size="sm" onclick={() => (columnsDialogOpen = false)}>{columnsDoneLabel}</Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .sanvi-data-table {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-table-wrapper {
    overflow-x: auto;
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
  }

  .sanvi-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
  }

  caption {
    text-align: start;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    color: var(--sanvi-color-text-secondary);
  }

  th,
  td {
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  th {
    text-align: start;
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-secondary);
    background: var(--sanvi-color-background-secondary);
  }

  tbody tr:last-child td {
    border-block-end: none;
  }

  .sanvi-table__cell--end {
    text-align: end;
  }

  .sanvi-table__empty {
    text-align: center;
    color: var(--sanvi-color-text-secondary);
    padding: var(--sanvi-spacing-8);
  }

  .sanvi-data-table__select-cell {
    width: var(--sanvi-spacing-8);
  }

  .sanvi-data-table__sort-button {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-1);
    border: none;
    background: transparent;
    padding: 0;
    font: inherit;
    font-weight: inherit;
    color: inherit;
    cursor: pointer;
  }

  .sanvi-data-table__sort-icon {
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-data-table__page-info {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-data-table__columns-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
