<script lang="ts">
import { ApiError, provisionTenant, searchTenantAdminViews } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
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

// `$derived`, not plain consts — the labels go through `t`, so a locale
// switch has to rebuild the options the selects and FilterBar display.
const STATUS_OPTIONS = $derived([
  { value: 'provisioning', label: t['platform.tenants.statusProvisioning']() },
  { value: 'active', label: t['platform.tenants.statusActive']() },
  { value: 'suspended', label: t['platform.tenants.statusSuspended']() },
  { value: 'archived', label: t['platform.tenants.statusArchived']() },
])

const REGION_OPTIONS = $derived([
  { value: 'us', label: t['platform.tenants.regionUs']() },
  { value: 'eu', label: t['platform.tenants.regionEu']() },
  { value: 'jp', label: t['platform.tenants.regionJp']() },
])

// Native self-names ("English" / "日本語") label the locale itself rather
// than being UI copy — untranslated by design, like the LocaleSwitcher.
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

// Sequencing token: every filter keystroke re-runs the load effect, and a
// slow response for an earlier query must never overwrite a later one.
let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
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
    if (seq !== loadSeq) return
    rows = page.tenants
    nextCursor = page.next_cursor
  } catch {
    if (seq !== loadSeq) return
    error = t['platform.tenants.errorMessage']()
  } finally {
    if (seq === loadSeq) loading = false
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
    showToast({
      variant: 'success',
      title: t['platform.tenants.provisioned']({ name: tenant.display_name }),
    })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['platform.tenants.provisionError'](),
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
    <h1>{t['platform.tenants.title']()}</h1>
    <Button onclick={() => (provisionOpen = true)}>{t['platform.tenants.provisionAction']()}</Button>
  </div>

  <FilterBar
    fields={[
      { type: 'text', key: 'query', label: t['platform.tenants.searchLabel'](), placeholder: t['platform.tenants.searchPlaceholder']() },
      {
        type: 'select',
        key: 'status',
        label: t['platform.tenants.statusLabel'](),
        options: STATUS_OPTIONS,
        placeholder: t['platform.tenants.anyStatus'](),
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
      { key: 'slug', header: t['platform.tenants.slugHeader'](), alwaysVisible: true },
      { key: 'display_name', header: t['platform.tenants.nameHeader'](), alwaysVisible: true, cell: nameCell },
      { key: 'status', header: t['platform.tenants.statusHeader'](), cell: statusCell },
      { key: 'region', header: t['platform.tenants.regionHeader']() },
      { key: 'member_count', header: t['platform.tenants.membersHeader'](), align: 'end' },
      { key: 'override_count', header: t['platform.tenants.overridesHeader'](), align: 'end' },
      { key: 'created_at', header: t['platform.tenants.createdHeader']() },
    ]}
    {rows}
    getRowId={(row) => row.tenant_id}
    {loading}
    {error}
    onRetry={load}
    retryLabel={t['common.retry']()}
    emptyMessage={t['platform.tenants.emptyMessage']()}
    hasPrevPage={listState.hasPrevPage}
    hasNextPage={nextCursor != null}
    onPrevPage={() => listState.prevPage()}
    onNextPage={() => nextCursor && listState.nextPage(JSON.stringify(nextCursor))}
    previousLabel={t['platform.tenants.previous']()}
    nextLabel={t['platform.tenants.next']()}
    columnVisibilityStorageKey="platform-admin.tenants.columns"
    csvExport
    csvFileName="tenants.csv"
  />
</Stack>

<Dialog bind:open={provisionOpen} titleText={t['platform.tenants.provisionTitle']()}>
  {#snippet children()}
    <Stack gap="3">
      <Field label={t['platform.tenants.slugLabel']()} required>
        {#snippet children({ id })}
          <Input {id} bind:value={provisionSlug} placeholder={t['platform.tenants.slugPlaceholder']()} required />
        {/snippet}
      </Field>
      <Field label={t['platform.tenants.displayNameLabel']()} required>
        {#snippet children({ id })}
          <Input {id} bind:value={provisionName} placeholder={t['platform.tenants.displayNamePlaceholder']()} required />
        {/snippet}
      </Field>
      <Field label={t['platform.tenants.regionLabel']()} required>
        {#snippet children({ id })}
          <Select {id} bind:value={provisionRegion} options={REGION_OPTIONS} />
        {/snippet}
      </Field>
      <Field label={t['platform.tenants.localeLabel']()} required>
        {#snippet children({ id })}
          <Select {id} bind:value={provisionLocale} options={LOCALE_OPTIONS} />
        {/snippet}
      </Field>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (provisionOpen = false)}>{t['platform.tenants.cancel']()}</Button>
    <Button
      disabled={!provisionSlug || !provisionName}
      loading={provisioning}
      onclick={handleProvision}
    >
      {t['platform.tenants.submit']()}
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
