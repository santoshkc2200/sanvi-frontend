<script lang="ts">
import { t } from '@sanvi/i18n'
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

const COPY = $derived({
  title: t['legal.requestMetrics.title'](),
  yearLabel: (year: number) => t['legal.requestMetrics.yearLabel']({ year }),
  receivedColumn: t['legal.requestMetrics.receivedColumn'](),
  compliedColumn: t['legal.requestMetrics.compliedColumn'](),
  deniedColumn: t['legal.requestMetrics.deniedColumn'](),
  jurisdictionColumn: t['legal.requestMetrics.jurisdictionColumn'](),
  kindColumn: t['legal.requestMetrics.kindColumn'](),
  unavailableTitle: t['legal.requestMetrics.unavailableTitle'](),
  unavailableBody: t['legal.requestMetrics.unavailableBody'](),
})

const columns: TableColumn<MetricsRow>[] = $derived([
  { key: 'jurisdiction', header: COPY.jurisdictionColumn },
  { key: 'kind', header: COPY.kindColumn },
  { key: 'received', header: COPY.receivedColumn },
  { key: 'complied', header: COPY.compliedColumn },
  { key: 'denied', header: COPY.deniedColumn },
])
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
