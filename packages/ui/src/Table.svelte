<script lang="ts" generics="T extends Record<string, unknown>">
import type { TableColumn } from './table-types'

interface Props {
  columns: TableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  caption?: string
  emptyMessage?: string
  class?: string
}

let { columns, rows, getRowId, caption, emptyMessage, class: className = '' }: Props = $props()
</script>

<div class="sanvi-table-wrapper {className}">
  <table class="sanvi-table">
    {#if caption}<caption>{caption}</caption>{/if}
    <thead>
      <tr>
        {#each columns as column (column.key)}
          <th scope="col" class="sanvi-table__cell--{column.align ?? 'start'}">{column.header}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row (getRowId(row))}
        <tr>
          {#each columns as column (column.key)}
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
          <td class="sanvi-table__empty" colspan={columns.length}>
            {emptyMessage ?? ''}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
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
</style>
