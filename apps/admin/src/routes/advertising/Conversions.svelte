<script lang="ts">
import { ApiError, listAdConversions, listAdPlatforms } from '@sanvi/api-client'
import type { ConversionEvent, UploadState } from '@sanvi/api-client'
import { fmt, t } from '@sanvi/i18n'
import { navigate } from '@sanvi/spa-router'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Cluster,
  Container,
  DataTable,
  EmptyState,
  NO_VALUE,
  Spinner,
  Stack,
  UpgradePrompt,
  formatAdCurrency,
  humanizeOptionValue,
} from '@sanvi/ui'
import { apiClient } from '../../lib/api'
import {
  conversionCurrency,
  conversionValue,
  directiveOutcome,
  purposeLabel,
} from '../../lib/advertising/tracking'

/**
 * The captured-conversions list (phase 10, TASK-014 / slice 10.5, upload
 * columns lit by TASK-015).
 *
 * Every row is an event the storefront captured, newest first, shown with
 * its value, where that value came from, the directive outcome the
 * capture-time gate froze onto it, and — since TASK-015 — the per-platform
 * upload states. A partial success renders each platform independently,
 * never as one blended status; the full story (taxonomy, attempt history,
 * retry) lives on the diagnostics screen this list links to.
 */
let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let events = $state<ConversionEvent[]>([])
let platformNames = $state<Record<string, string>>({})
let sortKey = $state('occurred_at')
let sortDirection = $state<'asc' | 'desc'>('desc')

const sortedEvents = $derived.by(() => {
  if (!sortKey) return events
  const factor = sortDirection === 'asc' ? 1 : -1
  const key = sortKey
  return [...events].sort((left, right) => {
    if (key === 'occurred_at') {
      return (Date.parse(left.occurred_at) - Date.parse(right.occurred_at)) * factor
    }
    return 0
  })
})

let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true
  events = []
  try {
    const [list, catalog] = await Promise.all([
      listAdConversions(apiClient),
      listAdPlatforms(apiClient).catch(() => undefined),
    ])
    if (seq !== loadSeq) return
    events = list ?? []
    const names: Record<string, string> = {}
    for (const platform of catalog?.platforms ?? []) {
      names[platform.key] = platform.display_name
    }
    platformNames = names
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      entitled = false
    } else {
      error = t['admin.advertising.genericError']()
    }
  } finally {
    if (seq === loadSeq) loading = false
  }
}

function sourceLabel(source: string): string {
  if (source === 'payment_record') return t['admin.advertising.conversions.sourcePaymentRecord']()
  if (source === 'client_reported') return t['admin.advertising.conversions.sourceClientReported']()
  return humanizeOptionValue(source)
}

function valueText(event: ConversionEvent): string {
  const amountMinor = conversionValue(event)
  const currency = conversionCurrency(event)
  if (amountMinor === null || !currency) return NO_VALUE
  return formatAdCurrency(amountMinor, currency)
}

function statusLabel(state: UploadState): string {
  switch (state.status) {
    case 'pending':
      return t['admin.advertising.diagnostics.status.pending']()
    case 'uploaded':
      return t['admin.advertising.diagnostics.status.uploaded']()
    case 'failed':
      return t['admin.advertising.diagnostics.status.failed']()
    case 'parked':
      return t['admin.advertising.diagnostics.status.parked']()
    case 'retracted':
      return t['admin.advertising.diagnostics.status.retracted']()
    case 'unpropagated':
      return t['admin.advertising.diagnostics.status.unpropagated']()
  }
}

function platformEntries(event: ConversionEvent): [string, UploadState][] {
  return Object.entries(event.upload_states ?? {})
}

$effect(() => {
  void getActiveTenantId()
  void load()
})
</script>

{#snippet occurredCell(row: ConversionEvent)}
  {fmt.datetime(new Date(row.occurred_at))}
{/snippet}

{#snippet eventCell(row: ConversionEvent)}
  {row.name}
{/snippet}

{#snippet valueCell(row: ConversionEvent)}
  {valueText(row)}
{/snippet}

{#snippet sourceCell(row: ConversionEvent)}
  {#if row.value_source}
    <Badge variant="neutral">{sourceLabel(row.value_source)}</Badge>
  {:else}
    {NO_VALUE}
  {/if}
{/snippet}

{#snippet outcomeCell(row: ConversionEvent)}
  {@const outcome = directiveOutcome(row.consent)}
  {#if outcome.suppressed}
    {t['admin.advertising.conversions.outcomeSuppressed']({
      purpose: purposeLabel(outcome.purpose ?? ''),
      source: humanizeOptionValue(outcome.source),
    })}
  {:else}
    {t['admin.advertising.conversions.outcomePermitted']()}
  {/if}
{/snippet}

{#snippet uploadCell(row: ConversionEvent)}
  {#if platformEntries(row).length === 0}
    <span class="sanvi-conversions__upload-pending">
      {t['admin.advertising.conversions.uploadSuppressedNote']()}
    </span>
  {:else}
    <Stack gap="1">
      {#each platformEntries(row) as [platform, state] (platform)}
        <span class="sanvi-conversions__upload-state">
          <span class="sanvi-conversions__platform">
            {platformNames[platform] ?? humanizeOptionValue(platform)}:
          </span>
          {statusLabel(state)}
        </span>
      {/each}
    </Stack>
  {/if}
{/snippet}

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.advertising.conversions.title']()}</h1>
      <p>{t['admin.advertising.conversions.description']()}</p>
    </div>

    {#if error}
      <Alert variant="error">
        {error}
        <Button variant="secondary" onclick={() => void load()}>
          {t['common.retry']()}
        </Button>
      </Alert>
    {/if}

    {#if loading}
      <Spinner label={t['admin.advertising.loading']()} />
    {:else if !entitled}
      <UpgradePrompt
        title={t['admin.advertising.upgradeTitle']()}
        description={t['admin.advertising.upgradeDescription']()}
        upgradeHref="/billing"
      />
    {:else if events.length === 0}
      <EmptyState
        title={t['admin.advertising.conversions.emptyTitle']()}
        description={t['admin.advertising.conversions.emptyBody']()}
      />
    {:else}
      <DataTable
        columns={[
          {
            key: 'occurred_at',
            header: t['admin.advertising.conversions.columnOccurredAt'](),
            cell: occurredCell,
            sortable: true,
          },
          {
            key: 'name',
            header: t['admin.advertising.conversions.columnEvent'](),
            cell: eventCell,
          },
          {
            key: 'value',
            header: t['admin.advertising.conversions.columnValue'](),
            align: 'end',
            cell: valueCell,
          },
          {
            key: 'value_source',
            header: t['admin.advertising.conversions.columnSource'](),
            cell: sourceCell,
          },
          {
            key: 'outcome',
            header: t['admin.advertising.conversions.columnOutcome'](),
            cell: outcomeCell,
          },
          {
            key: 'upload',
            header: t['admin.advertising.conversions.columnUpload'](),
            cell: uploadCell,
          },
        ]}
        rows={sortedEvents}
        getRowId={(row) => row.id}
        caption={t['admin.advertising.conversions.caption']()}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={(key, direction) => {
          sortKey = key
          sortDirection = direction
        }}
      />

      <Cluster gap="4">
        <Button variant="secondary" onclick={() => navigate('/advertising/tracking')}>
          {t['admin.advertising.conversions.backToSetup']()}
        </Button>
        <Button variant="primary" onclick={() => navigate('/advertising/diagnostics')}>
          {t['admin.advertising.conversions.diagnosticsLink']()}
        </Button>
      </Cluster>
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-conversions__upload-pending {
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-conversions__upload-state {
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-conversions__platform {
    color: var(--sanvi-color-text-secondary);
  }
</style>
