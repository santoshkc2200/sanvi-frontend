<script lang="ts">
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

const COPY = {
  title: 'Sub-processors',
  intro:
    'These are the third parties that process data for this storefront on our behalf, with their role and the transfer mechanism for data leaving its region.',
  nameColumn: 'Name',
  roleColumn: 'Role',
  locationColumn: 'Location',
  purposeColumn: 'Purpose',
  unavailableTitle: 'List unavailable',
  unavailableBody: 'The sub-processor registry did not answer. Please try again later.',
}

const active = $derived((data.subprocessors ?? []).filter((entry) => !entry.removed_at))

const columns: TableColumn<SubProcessor>[] = [
  { key: 'name', header: COPY.nameColumn },
  { key: 'role', header: COPY.roleColumn },
  { key: 'location', header: COPY.locationColumn },
  { key: 'purpose', header: COPY.purposeColumn },
]
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
