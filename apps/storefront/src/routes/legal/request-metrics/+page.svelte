<script lang="ts">
import { Container, EmptyState, Stack, Table, type TableColumn } from '@sanvi/ui'
import type { components } from '@sanvi/api-client'
import type { PageData } from './$types'

/**
 * The annual request metrics disclosure: how many requests arrived, how
 * many were complied with or denied, and the median response time — one row
 * per jurisdiction and request kind, straight from the request ledger.
 */
type MetricsRow = components['schemas']['PublicMetricsRow']

let { data }: { data: PageData } = $props()

const COPY = {
  title: 'Annual request metrics',
  yearLabel: (year: number) => `Requests received in ${year}, by jurisdiction and kind`,
  receivedColumn: 'Received',
  compliedColumn: 'Complied',
  deniedColumn: 'Denied',
  jurisdictionColumn: 'Jurisdiction',
  kindColumn: 'Request kind',
  medianColumn: 'Median days to respond',
  notReported: '—',
  unavailableTitle: 'Metrics unavailable',
  unavailableBody: 'The metrics service did not answer. Please try again later.',
}

const columns: TableColumn<MetricsRow>[] = [
  { key: 'jurisdiction', header: COPY.jurisdictionColumn },
  { key: 'kind', header: COPY.kindColumn },
  { key: 'received', header: COPY.receivedColumn },
  { key: 'complied', header: COPY.compliedColumn },
  { key: 'denied', header: COPY.deniedColumn },
]
</script>

<svelte:head><title>{COPY.title}</title></svelte:head>

<Container>
  <Stack>
    <h1>{COPY.title}</h1>

    {#if data.metrics === null}
      <EmptyState title={COPY.unavailableTitle} description={COPY.unavailableBody} />
    {:else}
      <p>{COPY.yearLabel(data.year)}</p>
      <Table rows={data.metrics} getRowId={(row) => `${row.jurisdiction}-${row.kind}`} caption={COPY.title} {columns} />
    {/if}
  </Stack>
</Container>
