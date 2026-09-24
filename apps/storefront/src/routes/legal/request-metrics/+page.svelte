<script lang="ts">
import { buildDiagnosticsPaste, recentBreadcrumbs } from '@sanvi/telemetry/diagnostics'
import { currentLocale, t } from '@sanvi/i18n'
import { Container, EmptyState, ErrorDiagnostics, Stack, Table, type TableColumn } from '@sanvi/ui'
import type { components } from '@sanvi/api-client'
import { page } from '$app/state'
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

// The unavailable state carries its correlation id (FR-1106): the id the
// failed request produced, plus the one-paste support action — so a
// degraded disclosure is diagnosable without asking the user to read an id
// aloud. Only rendered when there is an id; otherwise the labelled-empty
// state stands alone.
const diagnosticsText = $derived(
  data.traceId
    ? buildDiagnosticsPaste({
        release: __APP_BUILD__,
        // Route stays a pattern — the raw pathname carries ids (the
        // DiagnosticsFields contract).
        route: page.route.id ?? '',
        tenantId: null,
        locale: currentLocale(),
        traceId: data.traceId,
        breadcrumbs: recentBreadcrumbs(),
      })
    : undefined,
)
</script>

<svelte:head><title>{COPY.title}</title></svelte:head>

<Container>
  <Stack>
    <h1>{COPY.title}</h1>

    {#if data.metrics === null}
      <EmptyState title={COPY.unavailableTitle} description={COPY.unavailableBody} />
      <ErrorDiagnostics
        traceLine={data.traceId ? t['errors.traceId']({ id: data.traceId }) : undefined}
        {diagnosticsText}
        copyLabel={t['errors.diagnostics.copy']()}
        copiedLabel={t['errors.diagnostics.copied']()}
      />
    {:else}
      <p>{COPY.yearLabel(data.year)}</p>
      <Table rows={data.metrics} getRowId={(row) => `${row.jurisdiction}-${row.kind}`} caption={COPY.title} {columns} />
    {/if}
  </Stack>
</Container>
