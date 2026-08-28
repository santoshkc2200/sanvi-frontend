<script lang="ts">
import EmptyState from './EmptyState.svelte'
import Spinner from './Spinner.svelte'

export interface AuditEntryRow {
  id: string
  occurredAt: string
  actorLabel: string
  action: string
  resourceLabel?: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
}

interface DiffRow {
  key: string
  before: string
  after: string
  changed: boolean
}

interface Props {
  entries: AuditEntryRow[]
  loading?: boolean
  loadingLabel?: string
  emptyMessage?: string
  diffLabel?: string
  fieldLabel?: string
  beforeLabel?: string
  afterLabel?: string
  class?: string
}

let {
  entries,
  loading = false,
  loadingLabel = 'Loading',
  emptyMessage = 'No activity yet.',
  diffLabel = 'View changes',
  fieldLabel = 'Field',
  beforeLabel = 'Before',
  afterLabel = 'After',
  class: className = '',
}: Props = $props()

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'object') return stableStringify(value)
  return String(value)
}

/**
 * Key-order-independent stringify that also treats `null` and `undefined` as
 * equal (both render as "—"): `JSON.stringify` alone flags reordered object
 * keys and nullish pairs as changes that visually aren't.
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, member]) => member !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([key, member]) => `${JSON.stringify(key)}:${stableStringify(member)}`).join(',')}}`
}

/** Human-readable wall-clock time; the ISO string stays on the `datetime` attribute. */
function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  )
}

let expandedIds = $state(new Set<string>())

// Controlled entirely from `expandedIds`, not native `<details>` toggle
// state — the diff table must not exist in the DOM until expanded (jsdom's
// `<details>` doesn't reliably fire `toggle` on a synthetic click, and even
// where it does, native collapse is a CSS `display:none`, not DOM removal).
function toggleExpanded(id: string): void {
  const next = new Set(expandedIds)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds = next
}

function diffRows(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): DiffRow[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  return [...keys].sort().map((key) => {
    const beforeValue = before?.[key]
    const afterValue = after?.[key]
    return {
      key,
      before: formatValue(beforeValue),
      after: formatValue(afterValue),
      changed: stableStringify(beforeValue) !== stableStringify(afterValue),
    }
  })
}
</script>

<div class="sanvi-audit-trail {className}">
  {#if loading}
    <Spinner label={loadingLabel} />
  {:else if entries.length === 0}
    <EmptyState title={emptyMessage} />
  {:else}
    <ol class="sanvi-audit-trail__list">
      {#each entries as entry (entry.id)}
        <li class="sanvi-audit-trail__entry">
          <div class="sanvi-audit-trail__row">
            <time class="sanvi-audit-trail__time" datetime={entry.occurredAt}>{formatTimestamp(entry.occurredAt)}</time>
            <span class="sanvi-audit-trail__actor">{entry.actorLabel}</span>
            <span class="sanvi-audit-trail__action">{entry.action}</span>
            {#if entry.resourceLabel}
              <span class="sanvi-audit-trail__resource">{entry.resourceLabel}</span>
            {/if}
          </div>
          {#if entry.before || entry.after}
            <details class="sanvi-audit-trail__diff" open={expandedIds.has(entry.id)}>
              <summary
                onclick={(event) => {
                  event.preventDefault()
                  toggleExpanded(entry.id)
                }}
              >
                {diffLabel}
              </summary>
              {#if expandedIds.has(entry.id)}
                <table class="sanvi-audit-trail__diff-table">
                  <thead>
                    <tr>
                      <th scope="col">{fieldLabel}</th>
                      <th scope="col">{beforeLabel}</th>
                      <th scope="col">{afterLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each diffRows(entry.before, entry.after) as row (row.key)}
                      <tr class:sanvi-audit-trail__diff-row--changed={row.changed}>
                        <td>{row.key}</td>
                        <td>{row.before}</td>
                        <td>{row.after}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              {/if}
            </details>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .sanvi-audit-trail__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .sanvi-audit-trail__entry {
    padding: var(--sanvi-spacing-3) 0;
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }
  .sanvi-audit-trail__entry:last-child {
    border-block-end: none;
  }

  .sanvi-audit-trail__row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sanvi-spacing-3);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-audit-trail__time {
    color: var(--sanvi-color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .sanvi-audit-trail__actor {
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-audit-trail__action {
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-audit-trail__resource {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-audit-trail__diff {
    margin-block-start: var(--sanvi-spacing-2);
  }

  .sanvi-audit-trail__diff > summary {
    cursor: pointer;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-audit-trail__diff-table {
    margin-block-start: var(--sanvi-spacing-2);
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-audit-trail__diff-table th,
  .sanvi-audit-trail__diff-table td {
    padding: var(--sanvi-spacing-1) var(--sanvi-spacing-2);
    text-align: start;
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-audit-trail__diff-row--changed {
    background: var(--sanvi-color-background-secondary);
  }
</style>
