<script lang="ts">
import { buildDiagnosticsPaste, recentBreadcrumbs } from '@sanvi/telemetry/diagnostics'
import { currentLocale, t } from '@sanvi/i18n'
import { Container, EmptyState, ErrorDiagnostics, Stack, Table, type TableColumn } from '@sanvi/ui'
import type { components } from '@sanvi/api-client'
import { page } from '$app/state'
import type { PageData } from './$types'

/**
 * The public sub-processor list: role, location, purpose and the transfer
 * mechanism — rendered from the registry, so a new vendor shows up here by
 * changing data, not by editing a document.
 */
type SubProcessor = components['schemas']['SubProcessor']

let { data }: { data: PageData } = $props()

const COPY = $derived({
  title: t['legal.subProcessors.title'](),
  intro: t['legal.subProcessors.intro'](),
  nameColumn: t['legal.subProcessors.nameColumn'](),
  roleColumn: t['legal.subProcessors.roleColumn'](),
  locationColumn: t['legal.subProcessors.locationColumn'](),
  purposeColumn: t['legal.subProcessors.purposeColumn'](),
  unavailableTitle: t['legal.subProcessors.unavailableTitle'](),
  unavailableBody: t['legal.subProcessors.unavailableBody'](),
})

const active = $derived((data.subprocessors ?? []).filter((entry) => !entry.removed_at))

const columns: TableColumn<SubProcessor>[] = $derived([
  { key: 'name', header: COPY.nameColumn },
  { key: 'role', header: COPY.roleColumn },
  { key: 'location', header: COPY.locationColumn },
  { key: 'purpose', header: COPY.purposeColumn },
])

// The unavailable state carries its correlation (FR-1106), same as
// request-metrics: the server-side trace id, extended with the client-side
// breadcrumbs for the one-paste support action.
const diagnosticsText = $derived(
  data.traceId
    ? buildDiagnosticsPaste({
        release: __APP_BUILD__,
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
    <p>{COPY.intro}</p>

    {#if data.subprocessors === null}
      <EmptyState title={COPY.unavailableTitle} description={COPY.unavailableBody} />
      <ErrorDiagnostics
        traceLine={data.traceId ? t['errors.traceId']({ id: data.traceId }) : undefined}
        {diagnosticsText}
        copyLabel={t['errors.diagnostics.copy']()}
        copiedLabel={t['errors.diagnostics.copied']()}
      />
    {:else}
      <Table rows={active} getRowId={(row) => row.name} caption={COPY.title} {columns} />
    {/if}
  </Stack>
</Container>
