<script lang="ts">
import { t } from '@sanvi/i18n'
import { Container, EmptyState, Stack, Table, type TableColumn } from '@sanvi/ui'
import type { components } from '@sanvi/api-client'
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
</script>

<svelte:head><title>{COPY.title}</title></svelte:head>

<Container>
  <Stack>
    <h1>{COPY.title}</h1>
    <p>{COPY.intro}</p>

    {#if data.subprocessors === null}
      <EmptyState title={COPY.unavailableTitle} description={COPY.unavailableBody} />
    {:else}
      <Table rows={active} getRowId={(row) => row.name} caption={COPY.title} {columns} />
    {/if}
  </Stack>
</Container>
