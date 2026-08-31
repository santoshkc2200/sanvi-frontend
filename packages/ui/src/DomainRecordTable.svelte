<script lang="ts">
import Badge from './Badge.svelte'
import CopyButton from './CopyButton.svelte'

export interface DomainRecordItem {
  type: string
  name: string
  expected: string
  observed: 'pending' | 'matched' | 'mismatch' | 'not_found'
}

interface Props {
  records: DomainRecordItem[]
  typeHeader?: string
  nameHeader?: string
  expectedHeader?: string
  statusHeader?: string
  actionsHeader?: string
  copyLabel?: string
  copiedLabel?: string
  copyAllLabel?: string
  copyAllCopiedLabel?: string
  emptyMessage?: string
  statusPendingLabel?: string
  statusMatchedLabel?: string
  statusMismatchLabel?: string
  statusNotFoundLabel?: string
  class?: string
}

let {
  records,
  typeHeader = 'Type',
  nameHeader = 'Host / Name',
  expectedHeader = 'Value / Target',
  statusHeader = 'Status',
  actionsHeader = 'Actions',
  copyLabel = 'Copy',
  copiedLabel = 'Copied!',
  copyAllLabel = 'Copy all records',
  copyAllCopiedLabel = 'Copied all!',
  emptyMessage = 'No DNS records required',
  statusPendingLabel = 'Pending',
  statusMatchedLabel = 'Configured',
  statusMismatchLabel = 'Wrong value',
  statusNotFoundLabel = 'Not found',
  class: className = '',
}: Props = $props()

const copyAllValue = $derived(records.map((r) => `${r.type}\t${r.name}\t${r.expected}`).join('\n'))

function getStatusVariant(
  observed: DomainRecordItem['observed'],
): 'neutral' | 'success' | 'warning' | 'error' {
  switch (observed) {
    case 'matched':
      return 'success'
    case 'mismatch':
      return 'warning'
    case 'not_found':
      return 'error'
    default:
      return 'neutral'
  }
}

function getStatusLabel(observed: DomainRecordItem['observed']): string {
  switch (observed) {
    case 'matched':
      return statusMatchedLabel
    case 'mismatch':
      return statusMismatchLabel
    case 'not_found':
      return statusNotFoundLabel
    default:
      return statusPendingLabel
  }
}
</script>

<div class="sanvi-domain-records {className}">
  {#if records.length > 0}
    <div class="sanvi-domain-records__toolbar">
      <CopyButton
        value={copyAllValue}
        label={copyAllLabel}
        copiedLabel={copyAllCopiedLabel}
        variant="ghost"
        size="sm"
      />
    </div>
  {/if}

  <div class="sanvi-domain-records__table-wrapper">
    <table class="sanvi-domain-records__table">
      <thead>
        <tr>
          <th scope="col" class="sanvi-domain-records__th sanvi-domain-records__th--type">{typeHeader}</th>
          <th scope="col" class="sanvi-domain-records__th">{nameHeader}</th>
          <th scope="col" class="sanvi-domain-records__th">{expectedHeader}</th>
          <th scope="col" class="sanvi-domain-records__th sanvi-domain-records__th--status">{statusHeader}</th>
          <th scope="col" class="sanvi-domain-records__th sanvi-domain-records__th--actions">{actionsHeader}</th>
        </tr>
      </thead>
      <tbody>
        {#each records as record, idx (`${record.type}-${record.name}-${idx}`)}
          <tr>
            <td class="sanvi-domain-records__td sanvi-domain-records__td--type">
              <span class="sanvi-domain-records__type-pill">{record.type}</span>
            </td>
            <td class="sanvi-domain-records__td sanvi-domain-records__td--mono">
              <code>{record.name}</code>
            </td>
            <td class="sanvi-domain-records__td sanvi-domain-records__td--mono">
              <code>{record.expected}</code>
            </td>
            <td class="sanvi-domain-records__td">
              <Badge variant={getStatusVariant(record.observed)}>
                {#snippet children()}
                  {getStatusLabel(record.observed)}
                {/snippet}
              </Badge>
            </td>
            <td class="sanvi-domain-records__td sanvi-domain-records__td--actions">
              <CopyButton
                value={record.expected}
                label={copyLabel}
                copiedLabel={copiedLabel}
                size="sm"
                variant="ghost"
              />
            </td>
          </tr>
        {:else}
          <tr>
            <td class="sanvi-domain-records__empty" colspan={5}>
              {emptyMessage}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .sanvi-domain-records {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    width: 100%;
  }

  .sanvi-domain-records__toolbar {
    display: flex;
    justify-content: flex-end;
  }

  .sanvi-domain-records__table-wrapper {
    overflow-x: auto;
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-domain-records__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
    text-align: start;
  }

  .sanvi-domain-records__th {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-secondary);
    background: var(--sanvi-color-background-secondary);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    text-align: start;
  }

  .sanvi-domain-records__th--type {
    width: var(--sanvi-spacing-16);
  }

  .sanvi-domain-records__th--status {
    width: var(--sanvi-spacing-24);
  }

  .sanvi-domain-records__th--actions {
    text-align: end;
    width: var(--sanvi-spacing-20);
  }

  .sanvi-domain-records__td {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    color: var(--sanvi-color-text-primary);
    vertical-align: middle;
  }

  .sanvi-domain-records__table tbody tr:last-child .sanvi-domain-records__td {
    border-block-end: none;
  }

  .sanvi-domain-records__td--type {
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-domain-records__type-pill {
    display: inline-block;
    padding: var(--sanvi-spacing-1) var(--sanvi-spacing-2);
    border-radius: var(--sanvi-radius-sm);
    background: var(--sanvi-color-background-tertiary);
    font-size: var(--sanvi-font-size-xs);
    font-family: var(--sanvi-font-family-mono);
  }

  .sanvi-domain-records__td--mono code {
    font-family: var(--sanvi-font-family-mono);
    font-size: var(--sanvi-font-size-xs);
    word-break: break-all;
  }

  .sanvi-domain-records__td--actions {
    text-align: end;
  }

  .sanvi-domain-records__empty {
    text-align: center;
    color: var(--sanvi-color-text-secondary);
    padding: var(--sanvi-spacing-8);
  }
</style>
