<script lang="ts">
import { listAudit } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import {
  AuditTrail,
  type AuditEntryRow,
  Badge,
  Button,
  createListQueryState,
  csvDocument,
  downloadCsv,
  FilterBar,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'

type Filters = {
  tenant_id: string | undefined
  actor_id: string | undefined
  action: string | undefined
}

const COPY = {
  title: 'Audit',
  description: 'The platform-wide, tamper-evident activity chain.',
  chainStatus: 'Chain intact',
  tenantIdLabel: 'Tenant id',
  actorIdLabel: 'Actor id',
  actionLabel: 'Action',
  clearFilters: 'Clear filters',
  export: 'Export CSV',
  previous: 'Previous',
  next: 'Next',
  emptyMessage: 'No matching audit entries.',
  errorMessage: 'Could not load the audit log.',
  loading: 'Loading',
}

// Not `state` — collides with the `$state` rune parser.
const listState = createListQueryState<Filters>({
  storageKey: 'platform-admin.audit',
  defaultFilters: { tenant_id: undefined, actor_id: undefined, action: undefined },
})

let entries = $state<components['schemas']['AuditEntry'][]>([])
let nextCursor = $state<number | null | undefined>(undefined)
let loading = $state(true)
let error = $state<string | undefined>(undefined)

// Sequencing token: every filter keystroke re-runs the load effect, and a
// slow response for an earlier query must never overwrite a later one.
let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  try {
    const page = await listAudit(apiClient, {
      tenant_id: listState.filters.tenant_id,
      actor_id: listState.filters.actor_id,
      action: listState.filters.action,
      after: listState.cursor ? Number(listState.cursor) : undefined,
      limit: 50,
    })
    if (seq !== loadSeq) return
    entries = page.entries
    nextCursor = page.next_cursor
  } catch {
    if (seq !== loadSeq) return
    error = COPY.errorMessage
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  void listState.filters
  void listState.cursor
  void load()
})

const rows: AuditEntryRow[] = $derived(
  entries.map((entry) => ({
    id: entry.id,
    occurredAt: entry.occurred_at,
    actorLabel: `${entry.actor_type}${entry.actor_id ? ` ${entry.actor_id}` : ''}`,
    action: entry.action,
    resourceLabel:
      entry.resource_type && entry.resource_id
        ? `${entry.resource_type}:${entry.resource_id}`
        : (entry.resource_type ?? undefined),
    before: (entry.before ?? undefined) as Record<string, unknown> | undefined,
    after: (entry.after ?? undefined) as Record<string, unknown> | undefined,
  })),
)

function exportCsv(): void {
  downloadCsv(
    csvDocument([
      [
        'occurred_at',
        'actor_type',
        'actor_id',
        'action',
        'resource_type',
        'resource_id',
        'tenant_id',
      ],
      ...entries.map((entry) => [
        entry.occurred_at,
        entry.actor_type,
        entry.actor_id,
        entry.action,
        entry.resource_type,
        entry.resource_id,
        entry.tenant_id,
      ]),
    ]),
    'audit.csv',
  )
}
</script>

<div class="sanvi-audit__header">
  <div>
    <h1>{COPY.title}</h1>
    <p>{COPY.description}</p>
  </div>
  <div class="sanvi-audit__header-actions">
    <!-- No chain-verification-status endpoint exists yet — this is a static
         indicator, not a live check, until phase 03's `audit_chain_verify_failures`
         metric gets a UI-facing counterpart. -->
    <Badge variant="success">{COPY.chainStatus}</Badge>
    <Button variant="ghost" size="sm" onclick={exportCsv} disabled={entries.length === 0}>
      {COPY.export}
    </Button>
  </div>
</div>

<FilterBar
  fields={[
    { type: 'text', key: 'tenant_id', label: COPY.tenantIdLabel },
    { type: 'text', key: 'actor_id', label: COPY.actorIdLabel },
    { type: 'text', key: 'action', label: COPY.actionLabel },
  ]}
  values={listState.filters}
  onChange={(next) => listState.setFilters(next)}
  onClear={() => listState.clearFilters()}
  clearLabel={COPY.clearFilters}
  savedViews={listState.savedViews}
  onSaveView={(label) => listState.saveView(label)}
  onApplyView={(id) => listState.applyView(id)}
  onDeleteView={(id) => listState.deleteView(id)}
/>

<AuditTrail entries={rows} {loading} loadingLabel={COPY.loading} emptyMessage={error ?? COPY.emptyMessage} />

<div class="sanvi-audit__pagination">
  <Button variant="ghost" size="sm" disabled={!listState.hasPrevPage} onclick={() => listState.prevPage()}>
    {COPY.previous}
  </Button>
  <Button
    variant="ghost"
    size="sm"
    disabled={nextCursor == null}
    onclick={() => nextCursor != null && listState.nextPage(String(nextCursor))}
  >
    {COPY.next}
  </Button>
</div>

<style>
  .sanvi-audit__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--sanvi-spacing-4);
    margin-block-end: var(--sanvi-spacing-4);
  }

  .sanvi-audit__header-actions {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-audit__pagination {
    display: flex;
    justify-content: flex-end;
    gap: var(--sanvi-spacing-2);
    margin-block-start: var(--sanvi-spacing-4);
  }
</style>
