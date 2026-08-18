<script lang="ts">
import { ApiError, provisionTenant, searchTenantAdminViews } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { handleLinkClick } from '@sanvi/spa-router'
import {
  Badge,
  Button,
  createListQueryState,
  DataTable,
  Dialog,
  Field,
  FilterBar,
  Input,
  Select,
  showToast,
  Stack,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'

type TenantRow = components['schemas']['TenantAdminView']
type Cursor = components['schemas']['TenantViewCursorView']
type Filters = { status: string | undefined; query: string | undefined }

const COPY = {
  title: 'Tenants',
  slugHeader: 'Slug',
  nameHeader: 'Name',
  statusHeader: 'Status',
  regionHeader: 'Region',
  membersHeader: 'Members',
  overridesHeader: 'Overrides',
  createdHeader: 'Created',
  emptyMessage: 'No tenants match these filters.',
  errorMessage: 'Could not load tenants.',
  retry: 'Try again',
  provisionAction: 'Provision tenant',
  provisionTitle: 'Provision a new tenant',
  slugLabel: 'Slug',
  slugPlaceholder: 'acme',
  displayNameLabel: 'Display name',
  displayNamePlaceholder: 'Acme Corporation',
  regionLabel: 'Region',
  localeLabel: 'Default locale',
  cancel: 'Cancel',
  submit: 'Provision',
  provisioned: (name: string) => `${name} provisioned.`,
  provisionError: 'Could not provision this tenant. Check the slug is available and try again.',
  searchPlaceholder: 'Search by slug or name',
  searchLabel: 'Search',
  statusLabel: 'Status',
  anyStatus: 'Any status',
  previous: 'Previous',
  next: 'Next',
}

const STATUS_OPTIONS = [
  { value: 'provisioning', label: 'Provisioning' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'archived', label: 'Archived' },
]

const REGION_OPTIONS = [
  { value: 'us', label: 'United States' },
  { value: 'eu', label: 'European Union' },
  { value: 'jp', label: 'Japan' },
]

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
]

const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  provisioning: 'info',
  active: 'success',
  suspended: 'warning',
  archived: 'neutral',
}

// Not `state` — that identifier collides with the `$state` rune's parser
// (`state.filters` reads as a store-subscription of a local called `state`).
const listState = createListQueryState<Filters>({
  storageKey: 'platform-admin.tenants',
  defaultFilters: { status: undefined, query: undefined },
})

function decodeCursor(cursor: string | undefined): Cursor | undefined {
  if (!cursor) return undefined
  try {
    return JSON.parse(cursor) as Cursor
  } catch {
    return undefined
  }
}

let rows = $state<TenantRow[]>([])
let nextCursor = $state<Cursor | null | undefined>(undefined)
let loading = $state(true)
let error = $state<string | undefined>(undefined)

async function load(): Promise<void> {
  loading = true
  error = undefined
  const cursor = decodeCursor(listState.cursor)
  try {
    const page = await searchTenantAdminViews(apiClient, {
      status: listState.filters.status,
      query: listState.filters.query,
      after_created_at: cursor?.created_at,
      after_id: cursor?.tenant_id,
      limit: 25,
    })
    rows = page.tenants
    nextCursor = page.next_cursor
  } catch {
    error = COPY.errorMessage
  } finally {
    loading = false
  }
}

$effect(() => {
  // Re-runs whenever filters/cursor change — `listState`'s fields are reactive `$state`.
  void listState.filters
  void listState.cursor
  void load()
})

function handleFilterChange(next: Partial<Filters>): void {
  listState.setFilters(next)
}

let provisionOpen = $state(false)
let provisionSlug = $state('')
let provisionName = $state('')
let provisionRegion = $state('us')
let provisionLocale = $state('en')
let provisioning = $state(false)

async function handleProvision(): Promise<void> {
  provisioning = true
  try {
    const tenant = await provisionTenant(apiClient, {
      slug: provisionSlug,
      display_name: provisionName,
      region: provisionRegion,
      default_locale: provisionLocale,
    })
    provisionOpen = false
    provisionSlug = ''
    provisionName = ''
    showToast({ variant: 'success', title: COPY.provisioned(tenant.display_name) })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.provisionError,
      description: err instanceof ApiError ? err.detail : undefined,
    })
  } finally {
    provisioning = false
  }
}
</script>

{#snippet nameCell(row: TenantRow)}
  <a href="/tenants/{row.tenant_id}" onclick={(event) => handleLinkClick(event, `/tenants/${row.tenant_id}`)}>
    {row.display_name}
  </a>
{/snippet}

{#snippet statusCell(row: TenantRow)}
  <Badge variant={STATUS_VARIANT[row.status] ?? 'neutral'}>{row.status}</Badge>
{/snippet}

<Stack gap="4">
  <div class="sanvi-tenants__header">
    <h1>{COPY.title}</h1>
    <Button onclick={() => (provisionOpen = true)}>{COPY.provisionAction}</Button>
  </div>

  <FilterBar
    fields={[
      { type: 'text', key: 'query', label: COPY.searchLabel, placeholder: COPY.searchPlaceholder },
      {
        type: 'select',
        key: 'status',
        label: COPY.statusLabel,
        options: STATUS_OPTIONS,
        placeholder: COPY.anyStatus,
      },
    ]}
    values={listState.filters}
    onChange={handleFilterChange}
    onClear={() => listState.clearFilters()}
    savedViews={listState.savedViews}
    onSaveView={(label) => listState.saveView(label)}
    onApplyView={(id) => listState.applyView(id)}
    onDeleteView={(id) => listState.deleteView(id)}
  />

  <DataTable
    columns={[
      { key: 'slug', header: COPY.slugHeader, alwaysVisible: true },
      { key: 'display_name', header: COPY.nameHeader, alwaysVisible: true, cell: nameCell },
      { key: 'status', header: COPY.statusHeader, cell: statusCell },
      { key: 'region', header: COPY.regionHeader },
      { key: 'member_count', header: COPY.membersHeader, align: 'end' },
      { key: 'override_count', header: COPY.overridesHeader, align: 'end' },
      { key: 'created_at', header: COPY.createdHeader },
    ]}
    {rows}
    getRowId={(row) => row.tenant_id}
    {loading}
    {error}
    onRetry={load}
    retryLabel={COPY.retry}
    emptyMessage={COPY.emptyMessage}
    hasPrevPage={listState.hasPrevPage}
    hasNextPage={nextCursor != null}
    onPrevPage={() => listState.prevPage()}
    onNextPage={() => nextCursor && listState.nextPage(JSON.stringify(nextCursor))}
    previousLabel={COPY.previous}
    nextLabel={COPY.next}
    columnVisibilityStorageKey="platform-admin.tenants.columns"
    csvExport
    csvFileName="tenants.csv"
  />
</Stack>

<Dialog bind:open={provisionOpen} titleText={COPY.provisionTitle}>
  {#snippet children()}
    <Stack gap="3">
      <Field label={COPY.slugLabel} required>
        {#snippet children({ id })}
          <Input {id} bind:value={provisionSlug} placeholder={COPY.slugPlaceholder} required />
        {/snippet}
      </Field>
      <Field label={COPY.displayNameLabel} required>
        {#snippet children({ id })}
          <Input {id} bind:value={provisionName} placeholder={COPY.displayNamePlaceholder} required />
        {/snippet}
      </Field>
      <Field label={COPY.regionLabel} required>
        {#snippet children({ id })}
          <Select {id} bind:value={provisionRegion} options={REGION_OPTIONS} />
        {/snippet}
      </Field>
      <Field label={COPY.localeLabel} required>
        {#snippet children({ id })}
          <Select {id} bind:value={provisionLocale} options={LOCALE_OPTIONS} />
        {/snippet}
      </Field>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (provisionOpen = false)}>{COPY.cancel}</Button>
    <Button
      disabled={!provisionSlug || !provisionName}
      loading={provisioning}
      onclick={handleProvision}
    >
      {COPY.submit}
    </Button>
  {/snippet}
</Dialog>

<style>
  .sanvi-tenants__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
</style>
